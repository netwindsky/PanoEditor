import { ref, computed } from 'vue'
import type { Hotspot, CreateHotspotParams, UpdateHotspotParams, HotspotService } from '@/models'

/**
 * 热点 ViewModel
 * 负责热点管理的所有业务逻辑和状态
 */
export class HotspotViewModel {
  hotspots = ref<Hotspot[]>([])
  selectedHotspot = ref<Hotspot | null>(null)
  draggingHotspotId = ref<string | null>(null)

  isDragging = computed(() => this.draggingHotspotId.value !== null)

  constructor(private hotspotService: HotspotService) {}

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
  }

  updateDrag(deltaX: number, deltaY: number): void {
    if (!this.draggingHotspotId.value) return

    const hotspot = this.hotspots.value.find(
      (h) => h.id === this.draggingHotspotId.value
    )
    if (!hotspot) return

    // 像素差转换为球坐标差
    const sensitivity = 0.1
    hotspot.ath += deltaX * sensitivity
    hotspot.atv -= deltaY * sensitivity

    // 限制范围
    hotspot.ath = ((hotspot.ath + 180) % 360) - 180
    hotspot.atv = Math.max(-90, Math.min(90, hotspot.atv))
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
    }
  }
}
