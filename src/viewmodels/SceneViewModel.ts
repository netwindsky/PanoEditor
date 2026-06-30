import { ref, reactive, computed } from 'vue'
import type { Scene, SceneService, TileProgress } from '@/models'

export interface TilingStatus {
  status: string
  progress: number
}

/**
 * 场景 ViewModel
 * 负责场景管理的所有业务逻辑和状态
 */
export class SceneViewModel {
  // === 状态 ===
  scenes = ref<Scene[]>([])
  currentScene = ref<Scene | null>(null)
  uploading = ref(false)
  uploadProgress = ref(0)
  uploadError = ref<string>('')
  // 批量上传状态
  batchUploading = ref(false)
  batchUploadTotal = ref(0)
  batchUploadCurrent = ref(0)
  batchUploadFailed = ref<{ fileName: string; error: string }[]>([])
  tilingStatusMap = reactive(new Map<string, TilingStatus>())
  private pollingTimers = new Map<string, ReturnType<typeof setInterval>>()

  // === 计算属性 ===
  hasScenes = computed(() => this.scenes.value.length > 0)
  currentSceneConfig = computed(() => this.currentScene.value?.imageConfig ?? null)
  isUploading = computed(() => this.uploading.value || this.batchUploading.value)
  currentUploadProgress = computed(() => this.uploadProgress.value)

  // 当前场景的切片状态，归一化为 PanoEngineViewer 期望的 PROCESSING / READY / FAILED。
  // 优先采用实时轮询(tilingStatusMap)，否则回退到持久化的 Scene.status。
  currentTilingStatus = computed<string>(() => {
    const scene = this.currentScene.value
    if (!scene) return ''
    const polling = this.tilingStatusMap.get(scene.id)
    return polling ? SceneViewModel.normalizeTilingStatus(polling.status) : scene.status
  })

  // 当前场景的切片进度(0-100)。轮询优先，已就绪场景返回 100。
  currentTilingProgress = computed<number>(() => {
    const scene = this.currentScene.value
    if (!scene) return 0
    const polling = this.tilingStatusMap.get(scene.id)
    if (polling && polling.progress != null) return polling.progress
    if (scene.status === 'READY') return 100
    return 0
  })

  // 切片状态归一化：后端轮询用 COMPLETED/PENDING，组件只认 READY/PROCESSING/FAILED
  private static normalizeTilingStatus(raw: string): string {
    const map: Record<string, string> = {
      COMPLETED: 'READY',
      PENDING: 'PROCESSING',
      PROCESSING: 'PROCESSING',
      FAILED: 'FAILED',
      READY: 'READY',
    }
    return map[raw] ?? raw
  }

  constructor(private sceneService: SceneService) {}

  // === 场景加载 ===
  async loadScenes(projectId: string): Promise<void> {
    this.scenes.value = await this.sceneService.fetchScenes(projectId)
    if (!this.currentScene.value && this.hasScenes.value) {
      this.currentScene.value = this.scenes.value[0]
    }
  }

  selectScene(sceneId: string): void {
    const scene = this.scenes.value.find((s) => s.id === sceneId)
    if (scene) {
      this.currentScene.value = scene
    }
  }

  // === 场景创建 ===
  async uploadPanorama(projectId: string, file: File): Promise<void> {
    console.log('[SceneViewModel] Starting upload...')
    this.uploading.value = true
    this.uploadProgress.value = 0
    this.uploadError.value = ''

    try {
      const { scene } = await this.sceneService.uploadPanorama(
        projectId,
        file,
        (progress) => {
          console.log('[SceneViewModel] Upload progress:', progress)
          this.uploadProgress.value = progress
        }
      )

      console.log('[SceneViewModel] Upload complete, scene:', scene.id)
      this.scenes.value.push(scene)
      this.startTilingPolling(scene.id, projectId)
      
      // 保持进度条显示一段时间让用户看到 100%
      await new Promise(resolve => setTimeout(resolve, 800))
    } catch (error: any) {
      console.error('[SceneViewModel] Upload failed:', error)
      this.uploadError.value = error.message || '上传失败'
      throw error
    } finally {
      console.log('[SceneViewModel] Resetting upload state')
      this.uploading.value = false
      this.uploadProgress.value = 0
    }
  }

  // === 批量场景创建 ===
  async uploadPanoramas(projectId: string, files: File[]): Promise<void> {
    console.log('[SceneViewModel] Starting batch upload...')
    this.batchUploading.value = true
    this.batchUploadTotal.value = files.length
    this.batchUploadCurrent.value = 0
    this.batchUploadFailed.value = []
    this.uploadError.value = ''

    try {
      const { scenes, failed } = await this.sceneService.uploadPanoramas(projectId, files)

      console.log('[SceneViewModel] Batch upload complete, scenes:', scenes.length, 'failed:', failed.length)
      this.scenes.value.push(...scenes)

      // 为每个成功的场景启动切片轮询
      for (const scene of scenes) {
        this.startTilingPolling(scene.id, projectId)
      }

      this.batchUploadFailed.value = failed
      this.batchUploadCurrent.value = scenes.length

      if (failed.length > 0) {
        throw new Error(`${failed.length} 个文件上传失败`)
      }
    } catch (error: any) {
      console.error('[SceneViewModel] Batch upload failed:', error)
      this.uploadError.value = error.message || '批量上传失败'
      throw error
    } finally {
      console.log('[SceneViewModel] Resetting batch upload state')
      this.batchUploading.value = false
    }
  }

  // === 场景删除 ===
  async deleteScene(sceneId: string): Promise<void> {
    this.stopTilingPolling(sceneId)
    this.tilingStatusMap.delete(sceneId)
    await this.sceneService.deleteScene(sceneId)

    this.scenes.value = this.scenes.value.filter((s) => s.id !== sceneId)

    if (this.currentScene.value?.id === sceneId) {
      this.currentScene.value = this.scenes.value[0] || null
    }
  }

  // === 场景排序 ===
  async reorderScenes(newOrder: { id: string; sortOrder: number }[]): Promise<void> {
    // 1. 更新本地 scenes 顺序
    const orderMap = new Map(newOrder.map((n) => [n.id, n.sortOrder]))
    const sorted = [...this.scenes.value].sort(
      (a, b) => (orderMap.get(a.id) ?? a.sortOrder) - (orderMap.get(b.id) ?? b.sortOrder),
    )
    this.scenes.value = sorted

    // 2. 持久化到后端
    for (const item of newOrder) {
      await this.sceneService.updateScene(item.id, { sortOrder: item.sortOrder })
    }
  }

  // === 切片进度轮询 ===
  private startTilingPolling(sceneId: string, projectId: string): void {
    console.log('[SceneViewModel] Starting tiling polling for:', sceneId)
    this.tilingStatusMap.set(sceneId, { status: 'PENDING', progress: 0 })

    const timer = setInterval(async () => {
      try {
        const progress = await this.sceneService.fetchTilingProgress(sceneId)
        console.log('[SceneViewModel] Tiling progress:', progress.status, progress.percentage)
        this.tilingStatusMap.set(sceneId, {
          status: progress.status,
          progress: progress.percentage,
        })

        if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
          console.log('[SceneViewModel] Tiling finished:', progress.status)
          this.stopTilingPolling(sceneId)

          // 切片完成后必须刷新场景：创建时 imageConfig 为空，切片完成后端才写入瓦片配置与 READY 状态
          if (progress.status === 'COMPLETED') {
            await this.refreshScene(projectId, sceneId)
          }
        }
      } catch (error) {
        console.error('[SceneViewModel] Tiling poll error:', error)
      }
    }, 3000)

    this.pollingTimers.set(sceneId, timer)
  }

  /**
   * 重新拉取单个场景，刷新其持久化状态(READY)与最新 imageConfig。
   * 同时更新 scenes 列表条目；若是当前场景，重新指向新对象以触发 PanoEngineViewer 加载。
   */
  private async refreshScene(projectId: string, sceneId: string): Promise<void> {
    try {
      const updated = await this.sceneService.fetchScene(projectId, sceneId)
      if (!updated) return

      const idx = this.scenes.value.findIndex((s) => s.id === sceneId)
      if (idx !== -1) {
        this.scenes.value = [
          ...this.scenes.value.slice(0, idx),
          updated,
          ...this.scenes.value.slice(idx + 1),
        ]
      }

      if (this.currentScene.value?.id === sceneId) {
        this.currentScene.value = updated
      }
    } catch (error) {
      console.error('[SceneViewModel] Refresh scene after tiling failed:', error)
    }
  }

  private stopTilingPolling(sceneId: string): void {
    const timer = this.pollingTimers.get(sceneId)
    if (timer) {
      clearInterval(timer)
      this.pollingTimers.delete(sceneId)
    }
  }

  // === 清理 ===
  dispose(): void {
    this.pollingTimers.forEach((timer) => clearInterval(timer))
    this.pollingTimers.clear()
  }
}
