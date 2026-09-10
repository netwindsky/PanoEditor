import http from './index'
import type { SunLightConfig } from '@panoview'
import type { ApiResponse, LightingConfig, UpdateLightingParams } from '@/types'

export function getLighting(sceneId: string) {
  return http.get<ApiResponse<LightingConfig>>(`/scenes/${sceneId}/lighting`)
}

export function updateLighting(sceneId: string, params: UpdateLightingParams) {
  return http.put<ApiResponse<LightingConfig>>(`/scenes/${sceneId}/lighting`, params)
}

/** toSunConfig 所需的最小字段集（LightingConfig 的太阳光子集，表单模型同样满足） */
export type SunFields = Pick<
  LightingConfig,
  'sunEnabled' | 'sunAzimuth' | 'sunElevation' | 'sunIntensity' | 'sunColor'
>

/**
 * 后端光照配置 → 引擎太阳光配置（去掉 sun 前缀）。
 * 纯函数：字段映射集中在此，组件与场景加载逻辑共用。
 * 方位角在此统一归一化到 [0,360)（gizmo 反演 atan2 可能产生负角）。
 */
export function toSunConfig(lighting: SunFields): SunLightConfig {
  return {
    enabled: lighting.sunEnabled,
    azimuth: normalizeAzimuth(lighting.sunAzimuth),
    elevation: lighting.sunElevation,
    intensity: lighting.sunIntensity,
    color: lighting.sunColor,
  }
}

/** 引擎太阳光配置 → 后端太阳光字段（toSunConfig 的逆映射，持久化用） */
export function toSunFields(sun: {
  enabled: boolean
  azimuth: number
  elevation: number
  intensity: number
  color: string
}): SunFields {
  return {
    sunEnabled: sun.enabled,
    sunAzimuth: normalizeAzimuth(sun.azimuth),
    sunElevation: sun.elevation,
    sunIntensity: sun.intensity,
    sunColor: sun.color,
  }
}

/** 将方位角归一化到 [0, 360)：gizmo 反演 atan2 可能产生负角/超圈角 */
export function normalizeAzimuth(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** 将仰角钳位到 [-90, 90] */
function clampElevation(deg: number): number {
  return Math.max(-90, Math.min(90, deg))
}

/** 引擎太阳光配置形状（SunLightConfig 的结构子集，避免跨仓导入耦合） */
export interface SunConfigLike {
  enabled: boolean
  azimuth: number
  elevation: number
  intensity: number
  color: string
}

/**
 * 把部分字段补丁合并到当前太阳光配置（Model 层合并规则）。
 *
 * - 未提供的字段保留 current（引擎当前值）或 fallback（引擎无配置时的兜底）；
 * - azimuth 归一化到 [0,360)，elevation 钳位到 [-90,90]；
 * - 供 VM 在"面板只改了强度/颜色"等场景下使用，杜绝旧方向覆盖 gizmo 拖拽结果。
 */
export function mergeSunConfig(
  current: SunConfigLike | null,
  patch: Partial<SunConfigLike>,
  fallback: SunConfigLike,
): SunConfigLike {
  const base = current ?? fallback
  const merged: SunConfigLike = { ...base, ...patch }
  if (patch.azimuth !== undefined) merged.azimuth = normalizeAzimuth(merged.azimuth)
  if (patch.elevation !== undefined) merged.elevation = clampElevation(merged.elevation)
  return merged
}

/**
 * 太阳光可单独持久化的字段键（开关/方位角/仰角/强度/颜色）。
 * 方位角/仰角只下发被变更的字段，避免表单旧值覆盖画布 gizmo 拖拽后的引擎快照。
 */
export type SunUpdateKey = 'sunEnabled' | 'sunAzimuth' | 'sunElevation' | 'sunIntensity' | 'sunColor'

/** buildSunUpdate 输入：面板表单（SunFields）或后端配置（LightingConfig）均满足 */
type SunFormLike = Pick<
  LightingConfig,
  'sunEnabled' | 'sunAzimuth' | 'sunElevation' | 'sunIntensity' | 'sunColor'
>

/**
 * 从表单中挑出被变更的太阳光字段，构造部分更新参数。
 *
 * 背景：后端 PUT /lighting 为逐字段部分更新；若每次把整份表单（含表单里的
 * 方位角/仰角）全部下发，当表单滞后于引擎（如 gizmo 拖拽后尚未回填）时，
 * 调强度这类操作会用旧方位角/仰角覆盖拖拽结果，表现为太阳标注“重置”。
 * 故只下发本次实际变更的字段。纯函数，供面板调度持久化时调用。
 */
export function buildSunUpdate(form: SunFormLike, changedKeys: SunUpdateKey[]): UpdateLightingParams {
  const params: UpdateLightingParams = {}
  for (const key of changedKeys) {
    params[key] = form[key]
  }
  return params
}

/** 从环境贴图 URL 提取文件名，用于面板展示 */
export function envMapFileName(url: string | null): string {
  if (!url) return ''
  const segments = url.split('/')
  return decodeURIComponent(segments[segments.length - 1] || '')
}
