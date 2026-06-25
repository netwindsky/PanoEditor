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
}

// ============ 场景 ============
export interface Scene {
  id: string
  projectId: string
  name: string
  previewUrl: string
  thumbUrl: string
  imageConfig: string
  status: string
  initialView: InitialView
  order: number
  createdAt: string
  updatedAt: string
}

export interface InitialView {
  hfov: number
  pitch: number
  yaw: number
}

export interface CreateSceneParams {
  name: string
  previewUrl: string
  initialView?: Partial<InitialView>
}

export interface UpdateSceneParams {
  name?: string
  previewUrl?: string
  initialView?: Partial<InitialView>
  order?: number
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
  followZoom?: boolean
  visible?: boolean
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
  followZoom?: boolean
  visible?: boolean
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
  followZoom?: boolean
  visible?: boolean
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

export type HotspotToolType = 'info' | 'scene' | 'image' | 'quad' | 'model'

export type LeftPanelTab = 'scene' | 'asset' | 'layer'

export type RightPanelSection = 'scene' | 'hotspot' | 'audio' | 'postprocessing' | 'asset'
