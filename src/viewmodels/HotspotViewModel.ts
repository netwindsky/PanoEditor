import { ref, computed } from 'vue'
import type { Hotspot, CreateHotspotParams, UpdateHotspotParams, HotspotService } from '@/models'
import { parsePoints, serializePoints, isQuadLike, centerOfPoints } from '@/utils/quadPoints'

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
 * 相机导航器接口：抽象「把相机动画到指定视角」的能力。
 * 由组件层用 PanoEngineAdapter 实现并注入，VM 不依赖具体渲染引擎。
 */
export interface CameraNavigator {
  animateToView(view: { yaw: number; pitch: number; duration?: number }): void
}

const NoopNavigator: CameraNavigator = {
  animateToView: () => {},
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

  /** 相机导航器（焦点跟随），默认空实现 */
  private cameraNavigator: CameraNavigator = NoopNavigator

  /** 四边形热点整体拖拽时记录的初始状态 */
  private quadDragInitialCenter: { ath: number; atv: number } | null = null
  private quadDragInitialPoints: string | null = null

  /**
   * 拖拽起点偏移：点击时鼠标球坐标与热点中心的差值。
   * 拖动过程中热点新中心 = 鼠标球坐标 - 偏移，保证点击点相对热点中心的位置
   * 在拖动全程不变，避免"第一次 move 热点跳到鼠标点"的跳变 bug。
   */
  private dragOffset: { ath: number; atv: number } | null = null

  constructor(private hotspotService: HotspotService) {}

  /** 注入相机锁定器（引擎异步就绪后由组件层调用） */
  setCameraLock(lock: CameraLock): void {
    this.cameraLock = lock
  }

  /** 注入相机导航器（引擎异步就绪后由组件层调用） */
  setCameraNavigator(navigator: CameraNavigator): void {
    this.cameraNavigator = navigator
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
  /**
   * 开始拖拽热点。
   * @param hotspotId 热点 ID
   * @param mouseAth  点击时鼠标的球坐标 ath（度）
   * @param mouseAtv  点击时鼠标的球坐标 atv（度）
   */
  startDrag(hotspotId: string, mouseAth: number, mouseAtv: number): void {
    this.draggingHotspotId.value = hotspotId

    const hotspot = this.hotspots.value.find((h) => h.id === hotspotId)
    if (hotspot) {
      // 记录点击时鼠标与热点中心的偏移，拖动时用鼠标减偏移得到新中心，
      // 保持点击点相对热点中心的位置不变，避免跳变。
      this.dragOffset = {
        ath: this.normalizeAth(mouseAth - hotspot.ath),
        atv: mouseAtv - hotspot.atv,
      }

      // 四边形热点：记录初始 center 和 points，用于整体拖拽时同步平移
      if (isQuadLike(hotspot.type) && hotspot.points) {
        this.quadDragInitialCenter = { ath: hotspot.ath, atv: hotspot.atv }
        this.quadDragInitialPoints = hotspot.points
      }
    }

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

    // 热点新中心 = 鼠标球坐标 - 点击时记录的偏移，
    // 保证点击点相对热点中心的位置在拖动全程不变，避免跳变。
    const newAth = this.dragOffset ? ath - this.dragOffset.ath : ath
    const newAtv = this.dragOffset ? atv - this.dragOffset.atv : atv
    this.setHotspotCoords(hotspot, newAth, newAtv)

    // 四边形热点整体拖拽：将 center 的位移 delta 同步应用到 4 个顶点
    if (isQuadLike(hotspot.type) && this.quadDragInitialCenter && this.quadDragInitialPoints) {
      const deltaAth = newAth - this.quadDragInitialCenter.ath
      const deltaAtv = newAtv - this.quadDragInitialCenter.atv
      const pts = parsePoints(this.quadDragInitialPoints)
      if (pts.length === 4) {
        pts.forEach((p) => {
          p.ath = this.normalizeAth(p.ath + deltaAth)
          p.atv = Math.max(-90, Math.min(90, p.atv + deltaAtv))
        })
        hotspot.points = serializePoints(pts)
      }
    }
  }

  private getDraggingHotspot(): Hotspot | undefined {
    return this.hotspots.value.find(
      (h) => h.id === this.draggingHotspotId.value
    )
  }

  private setHotspotCoords(hotspot: Hotspot, ath: number, atv: number): void {
    hotspot.ath = this.normalizeAth(ath)
    hotspot.atv = Math.max(-90, Math.min(90, atv))
  }

  private normalizeAth(ath: number): number {
    return ((ath + 180) % 360) - 180
  }

  endDrag(): void {
    if (this.draggingHotspotId.value) {
      // 拖拽结束，更新后端
      const hotspot = this.hotspots.value.find(
        (h) => h.id === this.draggingHotspotId.value
      )
      if (hotspot) {
        const params: UpdateHotspotParams = {
          ath: hotspot.ath,
          atv: hotspot.atv,
        }
        // 四边形热点：一并提交更新后的 points
        if (isQuadLike(hotspot.type) && hotspot.points) {
          params.points = hotspot.points
        }
        this.updateHotspot(hotspot.id, params)
      }
      this.draggingHotspotId.value = null
      this.quadDragInitialCenter = null
      this.quadDragInitialPoints = null
      this.dragOffset = null
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
      this.quadDragInitialCenter = null
      this.quadDragInitialPoints = null
      this.dragOffset = null
      this.cameraLock.unlock()
    }
  }

  // === 焦点跟随与顶点拖拽不变量（MVC：几何与换算归 VM，View 只调用） ===

  /**
   * 计算某热点「画面中央」对应的相机视角。
   *
   * 坐标基准：quad/video/web 以 points（四顶点）渲染，ath/atv 仅创建时写入、
   * 之后与 points 各自演化——有 points 的热点以 points 中心为准（与引擎
   * 渲染锚点一致）；其余类型用 ath/atv。
   *
   * 坐标推导（引擎放置公式 D_hs = (-cos(atv)·sin(ath), -sin(atv), cos(atv)·cos(ath))）：
   *   相机 forward 对准 D_hs 解得 vlookat = atv, hlookat = ath + 180°。
   */
  getFocusCoords(hotspotId: string): { yaw: number; pitch: number } | null {
    const hotspot = this.hotspots.value.find((h) => h.id === hotspotId)
    if (!hotspot) return null

    let targetAth = hotspot.ath
    let targetAtv = hotspot.atv
    if (isQuadLike(hotspot.type) && hotspot.points) {
      const center = centerOfPoints(parsePoints(hotspot.points))
      if (center) {
        targetAth = center.ath
        targetAtv = center.atv
      }
    }

    // yaw 归一化到 (-180, 180]
    const rawYaw = targetAth + 180
    const yaw = rawYaw > 180 ? rawYaw - 360 : rawYaw
    return { yaw, pitch: targetAtv }
  }

  /**
   * 选中热点并驱动相机把该热点摆到画面中央。
   * View 只调用此方法，不做任何坐标换算。
   */
  focusHotspot(hotspotId: string): void {
    this.selectHotspot(hotspotId)
    const view = this.getFocusCoords(hotspotId)
    if (view) {
      this.cameraNavigator.animateToView(view)
    }
  }

  /**
   * 顶点拖拽结束：维护不变量「quad-like 热点的 ath/atv = points 中心」，
   * 并把 points + 同步后的 ath/atv 一并提交后端。
   * 无选中热点、无 points 时安全返回。
   */
  endVertexDrag(): void {
    const hotspot = this.selectedHotspot.value
    if (!hotspot || !hotspot.points) return

    const center = centerOfPoints(parsePoints(hotspot.points))
    if (!center) return
    hotspot.ath = center.ath
    hotspot.atv = center.atv

    void this.updateHotspot(hotspot.id, {
      points: hotspot.points,
      ath: center.ath,
      atv: center.atv,
    })
  }
}
