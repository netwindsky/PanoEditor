import type {
  Scene,
  SceneDto,
  SceneLocation,
  SceneViewConfigJson,
  InitialView,
  CreateSceneParams,
  UpdateSceneParams,
  TileProgress,
} from '@/types'
import { DEFAULT_INITIAL_VIEW } from '@/types'
import * as sceneApi from '@/api/scene'

/**
 * 场景数据仓库接口
 * 负责场景相关的数据访问操作
 */
export interface ISceneRepository {
  fetchScenes(projectId: string): Promise<Scene[]>
  fetchScene(projectId: string, sceneId: string): Promise<Scene>
  createScene(projectId: string, params: CreateSceneParams): Promise<Scene>
  updateScene(sceneId: string, params: UpdateSceneParams): Promise<Scene>
  deleteScene(sceneId: string): Promise<void>
  fetchTilingProgress(sceneId: string): Promise<TileProgress>
}

// ============ 内部工具：DTO → Domain 归一化 ============

/** 尝试 JSON.parse；失败或空返回 null */
function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** 数值兜底 parser：字符串/数字/undefined 都能吞 */
function toNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

/**
 * imageConfig.view 的 krpano 命名 → domain InitialView 映射
 * （切片流水线写死的 hlookat/vlookat/fov 字段，字符串类型）
 */
function initialViewFromImageConfigView(view: Record<string, unknown>): InitialView {
  const fovTypeRaw = String(view.fovtype ?? DEFAULT_INITIAL_VIEW.fovType).toUpperCase()
  const limitRaw = String(view.limitview ?? DEFAULT_INITIAL_VIEW.limitView)
  return {
    yaw: toNum(view.hlookat, DEFAULT_INITIAL_VIEW.yaw),
    pitch: -toNum(view.vlookat, DEFAULT_INITIAL_VIEW.pitch),
    hfov: toNum(view.fov, DEFAULT_INITIAL_VIEW.hfov),
    fovMin: toNum(view.fovmin, DEFAULT_INITIAL_VIEW.fovMin),
    fovMax: toNum(view.fovmax, DEFAULT_INITIAL_VIEW.fovMax),
    maxPixelZoom: toNum(view.maxpixelzoom, DEFAULT_INITIAL_VIEW.maxPixelZoom),
    limitView: (['auto', 'range', 'off'] as const).includes(limitRaw as any)
      ? (limitRaw as InitialView['limitView'])
      : DEFAULT_INITIAL_VIEW.limitView,
    fovType: (['MFOV', 'VFOV', 'DFOV', 'HFOV'] as const).includes(fovTypeRaw as any)
      ? (fovTypeRaw as InitialView['fovType'])
      : DEFAULT_INITIAL_VIEW.fovType,
  }
}

/** 用默认值补齐 Partial<InitialView> 缺失字段 */
function completeInitialView(partial: Partial<InitialView>): InitialView {
  return {
    yaw: partial.yaw ?? DEFAULT_INITIAL_VIEW.yaw,
    pitch: partial.pitch ?? DEFAULT_INITIAL_VIEW.pitch,
    hfov: partial.hfov ?? DEFAULT_INITIAL_VIEW.hfov,
    fovMin: partial.fovMin ?? DEFAULT_INITIAL_VIEW.fovMin,
    fovMax: partial.fovMax ?? DEFAULT_INITIAL_VIEW.fovMax,
    maxPixelZoom: partial.maxPixelZoom ?? DEFAULT_INITIAL_VIEW.maxPixelZoom,
    limitView: partial.limitView ?? DEFAULT_INITIAL_VIEW.limitView,
    fovType: partial.fovType ?? DEFAULT_INITIAL_VIEW.fovType,
  }
}

/**
 * 将后端 DTO 归一化为 domain Scene。
 *
 * 视角字段四级 fallback（避免"三份数据、来源不一"的历史 bug）：
 *   1. dto.initialView（JSON string） →
 *   2. viewConfig.initialView →
 *   3. imageConfig.view（krpano 命名） →
 *   4. DEFAULT_INITIAL_VIEW
 *
 * location / onstart 也在此层从 dto 顶层与 viewConfig 抽取，
 * 使 domain 消费者永远无需碰 JSON 字符串。
 */
export function sceneFromDto(dto: SceneDto): Scene {
  const parsedInitialView = safeParse<Partial<InitialView>>(dto.initialView)
  const viewConfig = safeParse<SceneViewConfigJson>(dto.viewConfig) ?? {}
  const imageConfigObj = safeParse<{ view?: Record<string, unknown> }>(dto.imageConfig) ?? {}

  let initialView: InitialView
  if (parsedInitialView) {
    initialView = completeInitialView(parsedInitialView)
  } else if (viewConfig.initialView) {
    initialView = completeInitialView(viewConfig.initialView)
  } else if (imageConfigObj.view && typeof imageConfigObj.view === 'object') {
    initialView = initialViewFromImageConfigView(imageConfigObj.view as Record<string, unknown>)
  } else {
    initialView = { ...DEFAULT_INITIAL_VIEW }
  }

  const location: SceneLocation = {}
  const lat = dto.lat ?? viewConfig.lat
  const lng = dto.lng ?? viewConfig.lng
  const heading = dto.heading ?? viewConfig.heading
  if (lat != null) location.lat = lat
  if (lng != null) location.lng = lng
  if (heading != null) location.heading = heading

  return {
    id: dto.id,
    projectId: dto.projectId,
    name: dto.name,
    title: dto.title ?? '',
    description: dto.description ?? undefined,
    previewUrl: dto.previewUrl ?? '',
    thumbUrl: dto.thumbUrl ?? '',
    imageConfig: dto.imageConfig ?? '',
    status: dto.status,
    initialView,
    location,
    onstart: viewConfig.onstart ?? '',
    sortOrder: dto.sortOrder,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

/**
 * 将 domain UpdateSceneParams 展开为后端能吃的字段。
 *
 * fan-out 策略：为兼容旧后端，"视角"同时写入两处：
 *  - `initialView`（JSON string，独立列）
 *  - `viewConfig`（JSON string，内嵌 initialView + location + onstart）
 * 不写 imageConfig.view（后端 retiling 会覆盖，写了无效）。
 * 顶层 lat/lng/heading 亦双写以兼容旧后端。
 */
export function patchToDto(params: UpdateSceneParams): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  // 简单直传字段
  if (params.name !== undefined) out.name = params.name
  if (params.title !== undefined) out.title = params.title
  if (params.description !== undefined) out.description = params.description
  if (params.previewUrl !== undefined) out.previewUrl = params.previewUrl
  if (params.thumbUrl !== undefined) out.thumbUrl = params.thumbUrl
  if (params.sortOrder !== undefined) out.sortOrder = params.sortOrder

  // 是否需要构造 viewConfig JSON —— 只要 initialView/location/onstart 任一给出就需要
  const hasView = params.initialView !== undefined
  const hasLocation = params.location !== undefined && (
    params.location.lat !== undefined ||
    params.location.lng !== undefined ||
    params.location.heading !== undefined
  )
  const hasOnstart = params.onstart !== undefined

  if (hasView) {
    out.initialView = JSON.stringify(params.initialView)
  }

  if (hasLocation) {
    const loc = params.location!
    if (loc.lat !== undefined) out.lat = loc.lat
    if (loc.lng !== undefined) out.lng = loc.lng
    if (loc.heading !== undefined) out.heading = loc.heading
  }

  if (hasView || hasLocation || hasOnstart) {
    const vc: SceneViewConfigJson = {}
    if (params.initialView) vc.initialView = params.initialView
    if (params.location?.lat !== undefined) vc.lat = params.location.lat
    if (params.location?.lng !== undefined) vc.lng = params.location.lng
    if (params.location?.heading !== undefined) vc.heading = params.location.heading
    if (params.onstart !== undefined) vc.onstart = params.onstart
    out.viewConfig = JSON.stringify(vc)
  }

  return out
}

/**
 * 场景数据仓库实现
 *
 * 所有 fetch/create/update 路径都在此层做 DTO ↔ Domain 归一化，
 * 上游（Service / ViewModel / View）拿到的永远是干净的 domain Scene。
 */
export class SceneRepository implements ISceneRepository {
  async fetchScenes(projectId: string): Promise<Scene[]> {
    const res = await sceneApi.getScenes(projectId)
    const dtos = (res.data.data ?? []) as unknown as SceneDto[]
    return dtos.map(sceneFromDto)
  }

  async fetchScene(projectId: string, sceneId: string): Promise<Scene> {
    const res = await sceneApi.getScene(projectId, sceneId)
    return sceneFromDto(res.data.data as unknown as SceneDto)
  }

  async createScene(projectId: string, params: CreateSceneParams): Promise<Scene> {
    // CreateSceneParams 目前只有 name/previewUrl/initialView(可选)，透传即可
    const body: Record<string, unknown> = { name: params.name, previewUrl: params.previewUrl }
    if (params.initialView) {
      body.initialView = JSON.stringify(completeInitialView(params.initialView))
    }
    const res = await sceneApi.createScene(projectId, body as any)
    return sceneFromDto(res.data.data as unknown as SceneDto)
  }

  async updateScene(sceneId: string, params: UpdateSceneParams): Promise<Scene> {
    const body = patchToDto(params)
    const res = await sceneApi.updateScene(sceneId, body as any)
    return sceneFromDto(res.data.data as unknown as SceneDto)
  }

  async deleteScene(sceneId: string): Promise<void> {
    await sceneApi.deleteScene(sceneId)
  }

  async fetchTilingProgress(sceneId: string): Promise<TileProgress> {
    const res = await sceneApi.getTilingProgress(sceneId)
    return res.data.data
  }
}
