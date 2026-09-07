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
 */
export function toSunConfig(lighting: SunFields): SunLightConfig {
  return {
    enabled: lighting.sunEnabled,
    azimuth: lighting.sunAzimuth,
    elevation: lighting.sunElevation,
    intensity: lighting.sunIntensity,
    color: lighting.sunColor,
  }
}

/** 从环境贴图 URL 提取文件名，用于面板展示 */
export function envMapFileName(url: string | null): string {
  if (!url) return ''
  const segments = url.split('/')
  return decodeURIComponent(segments[segments.length - 1] || '')
}
