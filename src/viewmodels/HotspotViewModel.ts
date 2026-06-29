import { ref, computed } from 'vue'
import type { Hotspot, CreateHotspotParams, UpdateHotspotParams, HotspotService } from '@/models'

/**
 * 相机锁定器接口
 * 抽象"锁定/解锁全景旋转"的能力，使 ViewModel 不直接依赖具体渲染引擎。
 * 由组件层用 PanoEngineAdapter 实现并通过 setCameraLock 注入。
 */
export interface CameraLock {
  lock(): void
  unlock(): void
}

/** 默认空实现：未注入相机锁定器时安全降级，不抛错 */
const NoopCameraLock: CameraLock = {
  lock: () => {},
  unlock: () => {},
}

/**
 * 热点 ViewModel
 * 负责热点管理的所有业务逻辑和状态
 */
export class HotspotViewModel {
  hotspots = ref<Hotspot[]>([])
  selectedHotspot = ref<Hotspot | null>(null)
  draggingHotspotId = ref<string | null>(null)

  isDragging = computed(() => this.draggingHotspotId.value !== null)

  /** 相机锁定器，默认空实现，由组件层在引擎就绪后注入 */
  private cameraLock: CameraLock = NoopCameraLock

  constructor(private hotspotService: HotspotService) {}

  /** 注入相机锁定器（引擎异步就绪后由组件层调用） */
  setCameraLock(lock: CameraLock): void {
    this.cameraLock = lock
  }


  async loadHotspots(sceneId: string): Promise<void> {
    this.hotspots.value = await this.hotspotService.fetchHotspots(sceneId)
  }

  async createHotspot(sceneId: string, params: CreateHotspotParams): Promise<Hotspot> {
    const hotspot = await this.hotspotService.createHotspot(sceneId, params)
    this.hotspots.value.push(hotspot)
    return hotspot
  }

  async updateHotspot(hotspotId: string, params: UpdateHotspotParams): Promise<void> {
    const updated = await this.hotspotService.updateHotspot(hotspotId, params)
    const index = this.hotspots.value.findIndex((h) => h.id === hotspotId)
    if (index !== -1) {
      this.hotspots.value[index] = updated
    }
    if (this.selectedHotspot.value?.id === hotspotId) {
      this.selectedHotspot.value = updated
    }
  }

  async deleteHotspot(hotspotId: string): Promise<void> {
    await this.hotspotService.deleteHotspot(hotspotId)
    this.hotspots.value = this.hotspots.value.filter((h) => h.id !== hotspotId)
    if (this.selectedHotspot.value?.id === hotspotId) {
      this.selectedHotspot.value = null
    }
  }

  /**
   * 一键清空当前已加载的所有热点。
   * 并发删除每个热点后清空本地列表与选中状态。
   */
  async clearHotspots(): Promise<void> {
    const ids = this.hotspots.value.map((h) => h.id)
    await Promise.all(ids.map((id) => this.hotspotService.deleteHotspot(id)))
    this.hotspots.value = []
    this.selectedHotspot.value = null
  }

  selectHotspot(hotspotId: string | null): void {
    if (!hotspotId) {
      this.selectedHotspot.value = null
      return
    }
    this.selectedHotspot.value =
      this.hotspots.value.find((h) => h.id === hotspotId) || null
  }

  // === 拖拽逻辑 ===
  startDrag(hotspotId: string): void {
    this.draggingHotspotId.value = hotspotId
    // 拖拽热点时锁定全景旋转，避免热点与背景一起移动导致对不准位置
    this.cameraLock.lock()
  }

  updateDrag(deltaX: number, deltaY: number): void {
    if (!this.draggingHotspotId.value) return

    const hotspot = this.getDraggingHotspot()
    if (!hotspot) return

    // 像素差转换为球坐标差
    const sensitivity = 0.1
    this.setHotspotCoords(hotspot, hotspot.ath + deltaX * sensitivity, hotspot.atv - deltaY * sensitivity)
  }

  updateDragToCoords(ath: number, atv: number): void {
    if (!this.draggingHotspotId.value) return

    const hotspot = this.getDraggingHotspot()
    if (!hotspot) return

    this.setHotspotCoords(hotspot, ath, atv)
  }

  private getDraggingHotspot(): Hotspot | undefined {
    return this.hotspots.value.find(
      (h) => h.id === this.draggingHotspotId.value
    )
  }

  private setHotspotCoords(hotspot: Hotspot, ath: number, atv: number): void {
    hotspot.ath = ((ath + 180) % 360) - 180
    hotspot.atv = Math.max(-90, Math.min(90, atv))
  }

  endDrag(): void {
    if (this.draggingHotspotId.value) {
      // 拖拽结束，更新后端
      const hotspot = this.hotspots.value.find(
        (h) => h.id === this.draggingHotspotId.value
      )
      if (hotspot) {
        this.updateHotspot(hotspot.id, {
          ath: hotspot.ath,
          atv: hotspot.atv,
        })
      }
      this.draggingHotspotId.value = null
      // 拖拽结束，解锁全景旋转
      this.cameraLock.unlock()
    }
  }

  /**
   * 强制结束拖拽（用于异常恢复：pointercancel、指针移出窗口、组件卸载等）。
   * 仅解锁全景并清空拖拽状态，不向后端提交更新，避免异常场景误写坐标。
   */
  forceEndDrag(): void {
    if (this.draggingHotspotId.value) {
      this.draggingHotspotId.value = null
      this.cameraLock.unlock()
    }
  }
}
