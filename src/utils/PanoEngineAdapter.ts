/**
 * PanoEngine 适配器
 *
 * 以"调用库"的方式封装 PanoViewV2 引擎：持有一个 PanoEngine 实例（组合，而非继承），
 * 仅通过 @panoview 顶层公共入口暴露的 API 驱动引擎，不再访问引擎私有成员。
 *
 * 职责（应用层逻辑，不属于通用引擎）：
 * - 将后端 JSON 配置转换为引擎标准的 SceneData 格式
 * - 将后端 Hotspot 数据转换为引擎标准的 Hotspot 格式
 * - DOM 层热点命中检测（与引擎 3D 射线命中组合）
 */
import { PanoEngine } from '@panoview'
import type { SceneData, Hotspot as PanoHotspot } from '@panoview'
import { perf } from '@/utils/performanceMonitor'
import { resizeImageDataUrl } from '@/utils/thumbnailGenerator'
import type { Hotspot } from '@/types'

export class PanoEngineAdapter {
  private engine: PanoEngine
  // 性能埋点：跨实例累计 syncHotspots 调用次数（全量重建次数），用于发现高频重建
  private static syncCallCount = 0
  // 拖动模式 flag（同步设置，绕过 Vue 响应式时序问题）。
  // 拖动期间 syncHotspotsIfChanged 据此跳过全量重建，避免每帧 delete+create 导致闪烁。
  private _isDragging = false

  constructor(container: HTMLElement) {
    // autoLoad:false —— 跳过引擎内置 XML demo，改用后端场景数据
    // enableStats:false / enablePostProcessing:false —— 编辑器环境不需要性能面板和后期处理
    const end = perf.stage('adapter-create-panoengine')
    this.engine = new PanoEngine(container, {
      autoLoad: false,
      enableStats: false,
      enablePostProcessing: false,
      maxPixelRatio: 2,
    })
    end()
  }

  /**
   * 从后端 JSON 配置加载全景场景。
   * @param config 后端生成的场景配置（JSON 对象或 SceneData 数组）
   */
  public async loadSceneConfig(config: SceneData | SceneData[] | Record<string, any>): Promise<void> {
    const end = perf.stage('adapter-load-scene-config')
    let sceneData: SceneData

    if (Array.isArray(config)) {
      sceneData = config[0]
    } else if (config.scene && config.image) {
      sceneData = config as SceneData
    } else {
      sceneData = this.convertToSceneData(config)
    }

    // 后端返回的瓦片 url 已是 /uploads/... 完整路径，关闭库默认的 '/src/assets/' 前缀
    this.engine.setBaseUrl('')
    // 通过库公共 API 注入场景数据，复用引擎原生加载流程。
    // manageHotspots:false —— 编辑器的热点与场景配置分离，由 syncHotspots 独立管理，
    // 引擎不得用场景内嵌的（空）热点数组覆盖编辑器已注入的热点（否则会在瓦片加载完成后清空热点）。
    await perf.measureAsync('adapter-engine-load-scenes', () =>
      this.engine.loadScenes([sceneData], { manageHotspots: false }),
    )
    end({
      hotspots: sceneData.hotspots?.length ?? 0,
      levels: sceneData.image?.levels?.length ?? 0,
    })
  }

  /**
   * 预加载所有场景到引擎，供后续无缝切换。
   * @param configs 所有场景的后端 JSON 配置数组
   */
  public async preloadScenes(configs: Record<string, any>[]): Promise<void> {
    const end = perf.stage('adapter-preload-scenes')
    const sceneDataList = configs.map((c) =>
      c.scene && c.image ? (c as SceneData) : this.convertToSceneData(c)
    )
    this.engine.setBaseUrl('')
    await perf.measureAsync('adapter-engine-load-scenes', () =>
      this.engine.loadScenes(sceneDataList, { manageHotspots: false }),
    )
    end({ sceneCount: sceneDataList.length })
  }

  /**
   * 切换场景（使用引擎原生过渡动画）。
   * 切换完成后需要调用方重新 syncHotspots 注入新热点。
   * @param sceneId 场景 ID（对应引擎 sceneList 中 scene.name）
   */
  public async switchScene(sceneId: string): Promise<void> {
    const end = perf.stage('adapter-switch-scene')
    await this.engine.changeScene(sceneId)
    end({ sceneId })
  }

  /**
   * 将后端 JSON 配置转换为标准库 SceneData 格式
   *
   * @deprecated 已由 `SceneViewModel.buildEngineSceneData` 取代（走域模型
   * `Scene.initialView` 作为视角单一真相）。保留仅供 `loadSceneConfig` 兼容
   * 直接吃 raw imageConfig JSON 的旧调用路径。新代码应把 domain `Scene`
   * 转成 `SceneData` 后再传入引擎，不要依赖此 helper 读取 view。
   */
  private convertToSceneData(config: Record<string, any>): SceneData {
    return {
      scene: {
        name: config.scene?.name || 'default',
        title: config.scene?.title || '',
        onstart: '',
        thumburl: '',
        lat: '',
        lng: '',
        heading: '',
      },
      view: {
        hlookat: String(config.view?.hlookat ?? '0'),
        vlookat: String(config.view?.vlookat ?? '0'),
        fovtype: config.view?.fovtype || 'MFOV',
        fov: String(config.view?.fov ?? '90'),
        maxpixelzoom: '2.0',
        fovmin: String(config.view?.fovmin ?? '30'),
        fovmax: String(config.view?.fovmax ?? '120'),
        limitview: 'auto',
      },
      preview: config.preview ? { url: config.preview.url } : undefined,
      image: {
        type: config.image?.type || 'CUBE',
        multires: config.image?.multires ?? true,
        tilesize: String(config.image?.tilesize ?? '512'),
        levels: (config.image?.levels || []).map((level: any) => ({
          tiledimagewidth: String(level.tiledimagewidth),
          tiledimageheight: String(level.tiledimageheight),
          cube: { url: level.cube?.url || '' },
        })),
      },
      hotspots: config.hotspots || [],
    }
  }

  // ==================== 热点管理方法 ====================

  /**
   * 将后端 Hotspot 数据转换为 PanoViewV2 标准库的 Hotspot 格式
   */
  private toPanoHotspot(hotspot: Hotspot): PanoHotspot {
    const resolvedStyle = hotspot.style || (hotspot.type === 'image' ? 'custom-image' : 'pulsing-dot')
    // pulsing-dot 等“0 宽容器 + 子元素”预设：.hotspot 基类是 display:flex，
    // 容器宽 0 会把内部圆点子元素挤压成 4px 宽的“竖白条”。
    // 引擎 applyStyle 中 data.width 优先于预设宽度，故在调用层给这类 DOM 点
    // 样式的容器补一个固定 px 尺寸即可避免压扁。注意必须带 px 单位，纯数字字符串 CSS 无效。
    // 仅对 DOM 点样式生效；image/quad/model 等 mesh 热点的 width 用于 3D 几何，保持原样不加 px。
    const STYLES_NEEDING_FIXED_SIZE = ['pulsing-dot', 'glow-orb', 'info-icon', 'navi-point']
    const needsFixedSize = STYLES_NEEDING_FIXED_SIZE.includes(resolvedStyle)
    const DEFAULT_DOT_SIZE = '18px'

    const resolvedWidth = needsFixedSize
      ? hotspot.width
        ? `${hotspot.width}px`
        : DEFAULT_DOT_SIZE
      : hotspot.width
        ? String(hotspot.width)
        : undefined
    const resolvedHeight = needsFixedSize
      ? hotspot.height
        ? `${hotspot.height}px`
        : DEFAULT_DOT_SIZE
      : hotspot.height
        ? String(hotspot.height)
        : undefined

    // 当设置了跳转场景但没有自定义脚本时，自动生成 changescene 命令
    const linkedscene = hotspot.linkedSceneId || ''
    const onclick = hotspot.onclick || (linkedscene ? `changescene('${linkedscene}')` : '')

    return {
      name: hotspot.id,
      style: resolvedStyle,
      ath: String(hotspot.ath),
      atv: String(hotspot.atv),
      linkedscene,
      tooltip: hotspot.tooltip || hotspot.name,
      onclick,
      events: hotspot.events || '',
      on: onclick,
      type: hotspot.type,
      url: hotspot.url || '',
      width: resolvedWidth,
      height: resolvedHeight,
      scale: hotspot.scale ? String(hotspot.scale) : undefined,
      rotate: hotspot.rotate ? String(hotspot.rotate) : undefined,
      blendmode: hotspot.blendmode || '',
      points: hotspot.points,
      bgcolor: hotspot.bgcolor,
      tolerance: hotspot.tolerance,
      feather: hotspot.feather,
      followzoom: hotspot.followZoom ? '1' : undefined,
      content: hotspot.content || '',
      shader: hotspot.shader || undefined,
    }
  }

  /**
   * 同步后端热点列表到 3D 场景
   */
  public syncHotspots(hotspots: Hotspot[]): void {
    const end = perf.stage('adapter-sync-hotspots')
    PanoEngineAdapter.syncCallCount++
    this.engine.hotspotsManager.clearHotspots()
    const panoHotspots = hotspots.map((h) => this.toPanoHotspot(h))
    this.engine.hotspotsManager.createHotspots(panoHotspots)
    this.engine.hotspotsManager.fadeIn(500)
    end({ count: hotspots.length, totalCalls: PanoEngineAdapter.syncCallCount })
  }

  /**
   * 添加单个热点到 3D 场景
   */
  public addHotspotToScene(hotspot: Hotspot): void {
    const panoHotspot = this.toPanoHotspot(hotspot)
    this.engine.hotspotsManager.createHotspot(panoHotspot)
  }

  /**
   * 从 3D 场景移除热点
   */
  public removeHotspotFromScene(hotspotId: string): void {
    this.engine.hotspotsManager.removeHotspot(hotspotId)
  }

  /**
   * 更新 3D 场景中的热点数据
   */
  public updateHotspotInScene(hotspot: Hotspot): void {
    const panoHotspot = this.toPanoHotspot(hotspot)
    this.engine.hotspotsManager.updateHotspotData(hotspot.id, panoHotspot)
  }

  /**
   * 轻量级更新 quad/video 热点的 4 顶点几何体。
   *
   * 拖动 quad/video 热点时调用本方法而非 updateHotspotInScene，
   * 避免每帧销毁+重建 video 元素/纹理导致资源暴涨卡顿。
   * 仅更新现有 mesh 的 BufferGeometry position 属性。
   */
  public updateQuadGeometry(hotspotId: string, points: string): void {
    this.engine.hotspotsManager.updateQuadGeometry(hotspotId, points)
  }

  /**
   * 设置/查询拖动模式 flag。
   * 同步设置，绕过 Vue 响应式 prop 时序问题。
   * PanoEngineViewer.syncHotspotsIfChanged 据此跳过全量重建。
   */
  public setDraggingMode(flag: boolean): void {
    this._isDragging = flag
  }

  public isDraggingMode(): boolean {
    return this._isDragging
  }

  // ==================== 拖动模式 flag ====================
  //
  // 用于 syncHotspotsIfChanged 的同步守卫，绕过 Vue props 响应式时序问题。
  // 拖动开始时由 EditorCanvas 直接设为 true，结束时设为 false。
  // 这样 PanoEngineViewer 的 deep watch 触发时，可以同步读取 flag
  // 避免 pre-flush watcher 在 prop 更新前运行导致误触发 syncHotspots。
  private _isDragging = false

  setDraggingMode(flag: boolean): void {
    this._isDragging = flag
  }

  isDraggingMode(): boolean {
    return this._isDragging
  }

  /**
   * 获取点击位置对应的 ath/atv 球坐标
   */
  public getCoordsFromPoint(clientX: number, clientY: number): { ath: number; atv: number } {
    return this.engine.getCoordsFromScreenPoint(clientX, clientY)
  }

  /**
   * 将球面 ath/atv 坐标投影到屏幕坐标。
   * 用于编辑器在全景画面上叠加控制点等临时标记。
   */
  public projectToScreen(ath: number, atv: number): { x: number; y: number; visible: boolean } {
    return this.engine.projectToScreen(ath, atv)
  }

  /**
   * 获取相机中心方向对应的 ath/atv 坐标
   */
  public getCenterCoords(): { ath: number; atv: number } {
    return this.engine.getCenterCoords()
  }

  /**
   * 获取相机当前视角的快照（水平角、垂直角、视场角）。
   * 用于"初始视角抓取"功能：将当前引擎视角写入场景初始视角字段。
   */
  public getCurrentView(): { yaw: number; pitch: number; hfov: number } {
    const { ath, atv } = this.engine.getCenterCoords()
    const hfov = this.engine.getCameraFov()
    // 引擎内部 getCenterCoords() 使用数学惯例（atan2/asin），
    //   ath > 0 = 左转（atan2(-x, z)），atv > 0 = 仰视（asin(y)）
    // 但 initCameraView 遵循 krpano 惯例：
    //   hlookat > 0 = 右转，vlookat > 0 = 俯视
    // 此处进行惯例转换，确保初始视角的保存/回读不产生符号翻转。
    return { yaw: -ath, pitch: -atv, hfov }
  }

  /**
   * 实时更新相机视角（不重新加载场景）。
   * 用于编辑器滑块拖动时即时反馈：只更新相机朝向和 FOV，不触碰瓦片/几何体。
   * @param viewData 视角数据（yaw/pitch 对应 hlookat/vlookat，hfov 为视场角）
   */
  public setCameraView(viewData: { yaw?: number; pitch?: number; hfov?: number; fovtype?: string }): void {
    this.engine.setCameraView({
      hlookat: viewData.yaw,
      vlookat: viewData.pitch,
      fov: viewData.hfov,
      fovtype: viewData.fovtype,
    })
  }

  /**
   * 从当前全景视口截取缩略图。
   * 强制渲染一帧，从 WebGL canvas 截取当前视角画面并缩放到目标尺寸。
   * @param width  目标宽度（默认 640）
   * @param height 目标高度（默认 360）
   */
  public async captureThumbnail(
    width: number = 640,
    height: number = 360,
  ): Promise<string> {
    const fullImage = this.engine.captureView()
    return resizeImageDataUrl(fullImage, width, height)
  }

  /**
   * 增量移动热点
   */
  public moveHotspot(hotspotId: string, deltaAth: number, deltaAtv: number): void {
    this.engine.hotspotsManager.moveHotspot(hotspotId, deltaAth, deltaAtv)
  }

  /**
   * 将热点移动到绝对球坐标
   */
  public moveHotspotTo(hotspotId: string, ath: number, atv: number): void {
    this.engine.hotspotsManager.updateHotspotPosition(hotspotId, ath, atv)
  }

  /**
   * 通过 3D 射线或 DOM 查找点击位置命中的热点
   * @returns 命中的热点 ID（name），未命中返回 null
   */
  public getHitHotspot(clientX: number, clientY: number): string | null {
    // 1. 先通过引擎的 3D 射线检测命中（mesh/model 类型）
    const rayHit = this.engine.getHotspotByRaycast(clientX, clientY)
    if (rayHit) return rayHit

    // 2. 再通过 DOM 查找 data-hotspot-name 属性
    return this.getDomHitHotspot(clientX, clientY)
  }

  /**
   * 通过 DOM 查找命中的热点元素（应用层逻辑）
   */
  private getDomHitHotspot(clientX: number, clientY: number): string | null {
    const elements = document.elementsFromPoint(clientX, clientY)
    for (const el of elements) {
      const hotspotName =
        (el as HTMLElement).dataset?.hotspotName ||
        (el.closest('[data-hotspot-name]') as HTMLElement)?.dataset?.hotspotName
      if (hotspotName) return hotspotName
    }
    return null
  }

  /**
   * 高亮选中热点
   */
  public highlightHotspot(hotspotId: string): void {
    this.engine.hotspotsManager.highlightHotspot(hotspotId)
  }

  /**
   * 取消高亮热点
   */
  public unhighlightHotspot(hotspotId: string): void {
    this.engine.hotspotsManager.unhighlightHotspot(hotspotId)
  }

  /**
   * 禁用全景控制器（拖拽热点时使用）
   */
  public disableControls(): void {
    this.engine.disableControls()
  }

  /**
   * 启用全景控制器
   */
  public enableControls(): void {
    this.engine.enableControls()
  }

  /**
   * 销毁引擎，释放资源
   */
  public dispose(): void {
    this.engine.dispose()
  }
}
