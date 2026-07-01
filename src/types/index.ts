// ============ 通用 ============
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PaginatedData<T> {
  records: T[]
  total: number
  current: number
  size: number
}

// ============ 认证 ============
export interface LoginParams {
  email: string
  password: string
}

export interface LoginResult {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: UserInfo
}

export interface UserInfo {
  id: string
  name: string
  avatarUrl: string
  email: string
  role: string
  status: string
  createdAt: string
}

// ============ 项目 ============
export interface Project {
  id: string
  name: string
  description: string
  coverUrl: string
  sceneCount: number
  settings?: string
  createdAt: string
  updatedAt: string
}

export interface CreateProjectParams {
  name: string
  description?: string
}

export interface UpdateProjectParams {
  name?: string
  description?: string
  settings?: string
}

/** 全局漫游配置（存入 Project.settings JSON 字符串） */
export interface TourSettings {
  autoRotate: boolean
  autoRotateSpeed: number
  defaultFov: number
  minFov: number
  maxFov: number
  enableCompass: boolean
  controlbar: boolean
  thumbs: boolean
  tooltips: boolean
  designStyle: string
  loadsceneBlend: string
}

// ============ 场景 ============
export type LimitViewMode = 'auto' | 'range' | 'off'
export type FovType = 'MFOV' | 'VFOV' | 'DFOV' | 'HFOV'

/** 初始视角（所有字段必填，缺失部分由 Repository 用默认值补齐） */
export interface InitialView {
  yaw: number
  pitch: number
  hfov: number
  fovMin: number
  fovMax: number
  maxPixelZoom: number
  limitView: LimitViewMode
  fovType: FovType
}

/** 默认初始视角（供 sceneFromDto 兜底 / 组件初始化使用） */
export const DEFAULT_INITIAL_VIEW: InitialView = {
  yaw: 0,
  pitch: 0,
  hfov: 100,
  fovMin: 70,
  fovMax: 140,
  maxPixelZoom: 2.0,
  limitView: 'auto',
  fovType: 'MFOV',
}

/** GPS 位置（可选字段独立管理） */
export interface SceneLocation {
  lat?: number
  lng?: number
  heading?: number
}

/**
 * 场景领域模型（domain）
 *
 * 关键约束：
 * - `initialView` 必为对象（Repository 从 DTO 三级 fallback + 默认值合成，保证下游无需判空）
 * - `location` / `onstart` 是 domain 一等字段；不再暴露 `viewConfig` JSON 字符串
 * - `imageConfig` 保留为原始 JSON 字符串（仅供瓦片/level 消费，不再是视角源）
 */
export interface Scene {
  id: string
  projectId: string
  name: string
  title: string
  description?: string
  previewUrl: string
  thumbUrl: string
  imageConfig: string
  status: string
  /** 唯一视角真相：sceneFromDto 保证非 null */
  initialView: InitialView
  location: SceneLocation
  onstart: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * 后端 DTO（axios 直接接收的形状；仅 Repository 内部使用）
 *
 * 后端字段特点：
 * - `initialView` 是 JSON 字符串或 null
 * - `viewConfig` 是 JSON 字符串（包含 initialView / lat / lng / heading / onstart 冗余备份）
 * - `imageConfig` 是 JSON 字符串（包含 tile levels + krpano-style view 默认值）
 * - `lat` / `lng` / `heading` 顶层字段（历史遗留）
 */
export interface SceneDto {
  id: string
  projectId: string
  name: string
  title: string | null
  description?: string | null
  previewUrl: string
  thumbUrl: string
  imageConfig: string | null
  status: string
  initialView: string | null
  viewConfig: string | null
  sortOrder: number
  lat: number | null
  lng: number | null
  heading: number | null
  createdAt: string
  updatedAt: string
}

/**
 * Repository 内部使用的 viewConfig JSON 结构
 * @internal 仅在 SceneRepository 的 sceneFromDto/patchToDto 内使用
 */
export interface SceneViewConfigJson {
  lat?: number
  lng?: number
  heading?: number
  onstart?: string
  initialView?: Partial<InitialView>
}

/**
 * @deprecated 使用 SceneViewConfigJson。保留仅为兼容 stores/scene.ts 遗留导入。
 */
export type SceneViewConfig = SceneViewConfigJson

export interface CreateSceneParams {
  name: string
  previewUrl: string
  initialView?: Partial<InitialView>
}

/**
 * 场景更新参数（domain 层）
 * Repository 会自动 fan-out 到后端的 initialView / viewConfig 两个字段。
 */
export interface UpdateSceneParams {
  name?: string
  title?: string
  description?: string
  previewUrl?: string
  thumbUrl?: string
  initialView?: InitialView
  location?: SceneLocation
  onstart?: string
  sortOrder?: number
}

// ============ 热点 ============
// 热点类型枚举
export type HotspotType = 'info' | 'scene' | 'image' | 'quad' | 'model' | 'video'

// 与后端HotspotResponse完全对齐，使用ath/atv球坐标（与PanoViewV2标准库一致）
export interface Hotspot {
  id: string
  sceneId: string
  name: string
  type: HotspotType
  ath: number
  atv: number
  points?: string
  style?: string
  url?: string
  width?: number
  height?: number
  scale?: number
  rotate?: number
  blendmode?: string
  bgcolor?: string
  tolerance?: number
  feather?: number
  linkedSceneId?: string
  tooltip?: string
  events?: string
  onclick?: string
  content?: string
  followZoom?: boolean
  visible?: boolean
  shader?: string
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

// 创建热点参数 - 与后端POST接口完全对齐
export interface CreateHotspotParams {
  name: string
  type: HotspotType
  ath: number
  atv: number
  points?: string
  style?: string
  url?: string
  width?: number
  height?: number
  scale?: number
  rotate?: number
  blendmode?: string
  bgcolor?: string
  tolerance?: number
  feather?: number
  linkedSceneId?: string
  tooltip?: string
  events?: string
  onclick?: string
  content?: string
  followZoom?: boolean
  visible?: boolean
  shader?: string
  sortOrder?: number
}

// 更新热点参数 - 与后端PUT接口完全对齐
export interface UpdateHotspotParams {
  name?: string
  type?: HotspotType
  ath?: number
  atv?: number
  points?: string
  style?: string
  url?: string
  width?: number
  height?: number
  scale?: number
  rotate?: number
  blendmode?: string
  bgcolor?: string
  tolerance?: number
  feather?: number
  linkedSceneId?: string
  tooltip?: string
  events?: string
  onclick?: string
  content?: string
  followZoom?: boolean
  visible?: boolean
  shader?: string
  sortOrder?: number
}

// ============ 资源 ============
export type ResourceType = 'image' | 'video' | 'audio' | 'panorama'

export interface Resource {
  id: string
  projectId: string
  name: string
  type: string
  mimeType: string
  sizeBytes: number
  url: string
  thumbUrl: string
  createdAt: string
}

export interface UploadResourceParams {
  file: File
  type: ResourceType
}

export interface BatchUploadResponse {
  succeeded: Resource[]
  failed: FailedItem[]
}

export interface FailedItem {
  fileName: string
  error: string
}

// ============ 后期处理 ============
export interface PostProcessing {
  id: string
  sceneId: string
  presetStyle: string
  lutResourceId: string
  toneMapping: string
  exposure: number
  contrast: number
  saturation: number
  colorTemperature: number
  bloomStrength: number
  bloomThreshold: number
  enabled: boolean
}

export interface UpdatePostProcessingParams {
  presetStyle?: string
  lutResourceId?: string
  toneMapping?: string
  exposure?: number
  contrast?: number
  saturation?: number
  colorTemperature?: number
  bloomStrength?: number
  bloomThreshold?: number
  enabled?: boolean
}

export interface RegisterParams {
  name: string
  email: string
  password: string
}

export interface UpdatePasswordParams {
  oldPassword: string
  newPassword: string
}

export interface UpdateProfileParams {
  name?: string
  avatar?: string
}

// ============ 音频 ============
export interface AudioSettings {
  sceneId: string
  backgroundMusicUrl: string
  backgroundMusicVolume: number
  backgroundMusicLoop: boolean
  narrationUrl: string
  narrationVolume: number
  narrationAutoPlay: boolean
}

export interface UpdateAudioSettingsParams {
  backgroundMusicUrl?: string
  backgroundMusicVolume?: number
  backgroundMusicLoop?: boolean
  narrationUrl?: string
  narrationVolume?: number
  narrationAutoPlay?: boolean
}

// ============ 切片进度 ============
export interface TileProgress {
  sceneId: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  totalLevels: number
  completedLevels: number
  totalTiles: number
  completedTiles: number
  percentage: number
  message: string
  tileConfig: string | null
}

// ============ 编辑器状态 ============
export type EditorTool = 'select' | 'hotspot' | 'pan' | 'zoom'

export type HotspotToolType = 'info' | 'scene' | 'image' | 'quad' | 'model' | 'video'

export type LeftPanelTab = 'scene' | 'asset' | 'layer'

export type RightPanelSection = 'scene' | 'hotspot' | 'audio' | 'postprocessing' | 'asset' | 'tour' | 'overlay'

/** krpano 覆盖层类型 */
export type LayerType = 'text' | 'image' | 'button' | 'container'

/** krpano 对齐方式 */
export type LayerAlign = 'lefttop' | 'top' | 'righttop' | 'left' | 'center' | 'right' | 'leftbottom' | 'bottom' | 'rightbottom'

/** krpano 覆盖层配置（存入 Project.settings JSON 的 layers 数组） */
export interface OverlayLayer {
  id: string
  name: string
  type: LayerType
  url?: string
  html?: string
  css?: string
  align?: LayerAlign
  x?: number
  y?: number
  width?: string
  height?: string
  scale?: number
  visible: boolean
  background?: boolean
  border?: boolean
  enabled?: boolean
  vcenter?: boolean
  onclick?: string
}
