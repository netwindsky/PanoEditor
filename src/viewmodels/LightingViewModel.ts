import { ref, watch, type WatchStopHandle } from 'vue'
import {
  getLighting,
  updateLighting,
  toSunConfig,
  toSunFields,
  mergeSunConfig,
  normalizeAzimuth,
  type SunConfigLike,
  type SunUpdateKey,
} from '@/api/lighting'
import { uploadResource } from '@/api/resource'
import type { LightingConfig, UpdateLightingParams, ResourceType } from '@/types'
import type { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'

/**
 * 太阳光照 Model（MVC 的 M）。
 *
 * 引擎太阳/环境、面板滑块、后端持久化三方共享这里的唯一响应式状态：
 * - 画布 gizmo 拖拽 → setSunDirection → 状态更新 → 面板滑块自动跟随；
 * - 面板改强度/颜色 → setSunFields → 状态更新 → 引擎即时预览；
 * - 场景切换 → watch 场景 id 自动 loadForScene；
 * - 持久化只发变更字段，杜绝表单旧值覆盖。
 *
 * View（LightingPanel / EditorCanvas gizmo）只读状态、只调方法，不持有状态。
 */

/** 太阳光可变更键（面板/gizmo 触发的部分更新） */
type SunPatchKey = 'sunEnabled' | 'sunAzimuth' | 'sunElevation' | 'sunIntensity' | 'sunColor'

export interface LightingViewModelOptions {
  /** 当前场景 id 供给函数（来自 EditorViewModel，运行时可变） */
  getSceneId: () => string | null
  /** 当前项目 id 供给函数（环境贴图上传需要） */
  getProjectId: () => string | null
  /** 脏标记回调（透传 editorStore.markDirty） */
  onDirty: () => void
}

const DEFAULT_SUN = {
  enabled: false,
  azimuth: 180,
  elevation: 30,
  intensity: 1,
  color: '#ffffff',
}

export class LightingViewModel {
  /** 太阳光配置（唯一数据源；滑块与 gizmo 都订阅它） */
  readonly sunConfig = ref({ ...DEFAULT_SUN })
  /** 环境贴图地址（null = 默认 RoomEnvironment） */
  readonly envMapUrl = ref<string | null>(null)
  /** 环境贴图上传中（面板按钮 loading） */
  readonly uploadingEnv = ref(false)

  private adapter: PanoEngineAdapter | null = null
  /** 配置所属场景（防跨场景写入守卫） */
  private loadedSceneId: string | null = null
  /** 防抖定时器与其捕获的场景 id / 变更键 */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private debounceSceneId: string | null = null
  private pendingSunKeys = new Set<SunUpdateKey>()

  private stopSceneWatch: WatchStopHandle | null = null

  constructor(private options: LightingViewModelOptions) {
    // 场景切换：自动重新加载该场景光照（覆盖所有切换路径，View/编排层零接线）
    this.stopSceneWatch = watch(
      () => this.options.getSceneId(),
      async (sceneId) => {
        // 丢弃上一场景未完成的防抖持久化
        this.cancelPendingPersist()
        if (!sceneId) {
          this.loadedSceneId = null
          this.resetToDefaults()
          return
        }
        await this.loadForScene(sceneId)
      },
    )
  }

  // ==================== 引擎接线 ====================

  /** 引擎就绪时调用：把当前状态（env + sun）推给引擎；顺序与 loadForScene 无关（幂等） */
  attachEngine(adapter: PanoEngineAdapter): void {
    this.adapter = adapter
    void this.applyToEngine()
  }

  /** 引擎销毁（组件卸载）时调用 */
  detachEngine(): void {
    this.adapter = null
  }

  /** 把当前状态完整推给引擎（幂等：attachEngine 与 loadForScene 完成时都会调用，后到覆盖） */
  private async applyToEngine(): Promise<void> {
    const adapter = this.adapter
    if (!adapter) return
    try {
      await adapter.setEnvironmentMap(this.envMapUrl.value)
    } catch (e) {
      console.warn('setEnvironmentMap failed:', e)
    }
    adapter.setSunLight(toSunConfig(this.sunFields()))
  }

  // ==================== 场景加载 ====================

  /** 从后端拉取指定场景的光照配置，填充状态并应用到引擎 */
  async loadForScene(sceneId: string): Promise<void> {
    try {
      const res = await getLighting(sceneId)
      // 响应返回时场景可能已再次切换：过期响应直接丢弃
      if (this.options.getSceneId() !== sceneId) return
      const data = res.data.data
      if (data) {
        this.applyLightingConfig(data)
        this.loadedSceneId = sceneId
        await this.applyToEngine()
      } else {
        this.resetToDefaults()
      }
    } catch {
      this.resetToDefaults()
    }
  }

  /** 后端配置 → VM 状态 */
  private applyLightingConfig(data: LightingConfig): void {
    this.envMapUrl.value = data.envMapUrl ?? null
    this.sunConfig.value = {
      enabled: data.sunEnabled ?? DEFAULT_SUN.enabled,
      azimuth: normalizeAzimuth(data.sunAzimuth ?? DEFAULT_SUN.azimuth),
      elevation: data.sunElevation ?? DEFAULT_SUN.elevation,
      intensity: data.sunIntensity ?? DEFAULT_SUN.intensity,
      color: data.sunColor || DEFAULT_SUN.color,
    }
  }

  private resetToDefaults(): void {
    this.envMapUrl.value = null
    this.sunConfig.value = { ...DEFAULT_SUN }
  }

  // ==================== 画布 gizmo 拖拽 ====================

  /**
   * gizmo 拖拽改向：更新状态（滑块自动跟随）+ 引擎预览。
   * @param persist true=松手，立即持久化方位角/仰角（只发这两个字段）
   */
  setSunDirection(azimuth: number, elevation: number, opts: { persist: boolean }): void {
    const patch = { azimuth: normalizeAzimuth(azimuth), elevation }
    this.sunConfig.value = mergeSunConfig(this.sunConfig.value, patch, this.sunConfig.value)
    this.pushSunToEngine()
    if (opts.persist) {
      const sceneId = this.options.getSceneId()
      if (!sceneId) return
      void updateLighting(sceneId, {
        sunAzimuth: this.sunConfig.value.azimuth,
        sunElevation: this.sunConfig.value.elevation,
      })
        .then(() => this.options.onDirty())
        .catch((err) => console.warn('太阳方向持久化失败:', err))
    }
  }

  // ==================== 面板交互 ====================

  /**
   * 面板修改太阳光字段（开关/颜色/强度/方位/仰角滑块）：
   * 合并进状态 → 引擎即时预览 → 300ms 防抖持久化（只发变更键）。
   * 补丁键（enabled/azimuth/...）与持久化键（sunEnabled/sunAzimuth/...）一一对应。
   */
  setSunFields(patch: Partial<SunConfigLike>): void {
    const keys: SunPatchKey[] = []
    for (const k of Object.keys(patch) as SunPatchKey[]) {
      if (patch[k] !== undefined) keys.push(k)
    }
    if (keys.length === 0) return

    // 补丁键 → 持久化键（enabled→sunEnabled 等）
    const toPersistKey: Record<keyof SunConfigLike, SunUpdateKey> = {
      enabled: 'sunEnabled',
      azimuth: 'sunAzimuth',
      elevation: 'sunElevation',
      intensity: 'sunIntensity',
      color: 'sunColor',
    }

    const current = this.adapter?.getSunLightConfig() ?? null
    this.sunConfig.value = mergeSunConfig(current, patch, this.sunConfig.value)
    this.pushSunToEngine()

    for (const k of keys) this.pendingSunKeys.add(toPersistKey[k])
    this.debounceSceneId = this.options.getSceneId()
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => void this.flushPendingSun(), 300)
  }

  /** 防抖到期：把累计变更键持久化（捕获调度时的场景 id，防止跨场景写入） */
  private async flushPendingSun(): Promise<void> {
    this.debounceTimer = null
    const sceneId = this.debounceSceneId
    const keys = [...this.pendingSunKeys]
    this.pendingSunKeys.clear()
    this.debounceSceneId = null
    if (!sceneId || keys.length === 0) return
    // 场景守卫：调度后场景已切换则丢弃
    if (sceneId !== this.loadedSceneId && sceneId !== this.options.getSceneId()) return
    const params: UpdateLightingParams = {}
    const fields = toSunFields(this.sunConfig.value)
    for (const k of keys) params[k] = fields[k]
    if (Object.keys(params).length === 0) return
    try {
      await updateLighting(sceneId, params)
      this.options.onDirty()
    } catch (err) {
      console.warn('光照配置持久化失败:', err)
    }
  }

  /**
   * 上传/移除环境贴图：更新状态 → 引擎 → 立即持久化（不走防抖）。
   * 上传需要 File，移除传 null。
   */
  async setEnvMap(url: string | null, file?: File): Promise<void> {
    let finalUrl = url
    if (file) {
      const projectId = this.options.getProjectId()
      if (!projectId) throw new Error('请先加载项目')
      this.uploadingEnv.value = true
      try {
        const res = await uploadResource(projectId, file, 'envmap' as ResourceType)
        finalUrl = res.data.data.url
      } finally {
        this.uploadingEnv.value = false
      }
    }
    this.envMapUrl.value = finalUrl
    const adapter = this.adapter
    if (adapter) {
      try {
        await adapter.setEnvironmentMap(finalUrl)
      } catch (e) {
        console.warn('setEnvironmentMap failed:', e)
      }
    }
    const sceneId = this.options.getSceneId()
    if (!sceneId) return
    try {
      await updateLighting(sceneId, { envMapUrl: finalUrl })
      this.options.onDirty()
    } catch (err) {
      console.warn('环境贴图持久化失败:', err)
    }
  }

  // ==================== 内部 ====================

  private pushSunToEngine(): void {
    const adapter = this.adapter
    if (!adapter) return
    try {
      adapter.setSunLight(toSunConfig(this.sunFields()))
    } catch (e) {
      console.warn('setSunLight failed:', e)
    }
  }

  /** VM 状态 → 后端太阳光字段集 */
  private sunFields() {
    return {
      sunEnabled: this.sunConfig.value.enabled,
      sunAzimuth: this.sunConfig.value.azimuth,
      sunElevation: this.sunConfig.value.elevation,
      sunIntensity: this.sunConfig.value.intensity,
      sunColor: this.sunConfig.value.color,
    }
  }

  /** 丢弃未完成的防抖持久化（场景切换/销毁时） */
  private cancelPendingPersist(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.pendingSunKeys.clear()
    this.debounceSceneId = null
  }

  /** 已加载配置的场景 id（测试探针 + 场景守卫依据） */
  loadedSceneIdForTest(): string | null {
    return this.loadedSceneId
  }

  dispose(): void {
    this.cancelPendingPersist()
    this.stopSceneWatch?.()
    this.adapter = null
  }
}

// 保留 Ref 引用避免 tree-shake 报 unused（类型导入）
export type { Ref }
