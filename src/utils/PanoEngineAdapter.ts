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
import TWEEN, { Tween } from '@tweenjs/tween.js'
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
  /** 当前正在运行的相机视角动画 Tween，用于连续调用时打断上一次 */
  private currentViewTween: Tween<{ yaw: number; pitch: number }> | null = null

  constructor(container: HTMLElement) {
    // autoLoad:false —— 跳过引擎内置 XML demo，改用后端场景数据
    // enableStats:false —— 编辑器环境不显示性能面板
    // 后期处理默认开启（用户在后期面板控制启用开关），以保证调整参数时画布实时预览。
    const end = perf.stage('adapter-create-panoengine')
    this.engine = new PanoEngine(container, {
      autoLoad: false,
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
    const resolvedStyle =
      hotspot.style ||
      (hotspot.type === 'image'
        ? 'custom-image'
        : hotspot.type === 'web'
          ? 'custom-web'
          : 'pulsing-dot')
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
   * 用补间动画平滑地把相机视角旋转到目标 yaw/pitch（krpano 惯例）。
   *
   * 典型用途：点击右侧标注列表项时把相机对准该标注（hotspot.ath/atv 就是
   * 目标 yaw/pitch）。
   *
   * yaw 采用最短路径归一化：例如从 170° 旋转到 -170° 走 +20°（终点 190）
   * 而不是 -340°，避免"绕地球一圈"的观感。
   *
   * 连续调用时会先停掉上一次未完成的 Tween，避免视角叠加/抖动。
   * duration <= 0 时同步直接切换视角。
   *
   * @param target.yaw       目标水平角（krpano 惯例，正 = 右转）
   * @param target.pitch     目标垂直角（krpano 惯例，正 = 俯视）
   * @param target.duration  动画时长（毫秒），默认 600。<= 0 时立即切换
   */
  public animateToView(target: { yaw: number; pitch: number; duration?: number }): void {
    const duration = target.duration ?? 600

    // 无动画：直接切换，避免测试/低端设备启动 tween 的额外开销
    if (duration <= 0) {
      this.engine.setCameraView({ hlookat: target.yaw, vlookat: target.pitch })
      return
    }

    // 打断上一次未完成的动画，防止两次调用互相拉扯
    if (this.currentViewTween) {
      this.currentViewTween.stop()
      this.currentViewTween = null
    }

    // 起点使用 krpano 惯例（getCurrentView 已完成引擎数学惯例 → krpano 惯例的翻转）
    const start = this.getCurrentView()

    // yaw 最短路径归一化：把终点搬到距起点最近的等价角
    const shortestYaw = this.shortestYawTarget(start.yaw, target.yaw)

    const tween = new Tween<{ yaw: number; pitch: number }>({
      yaw: start.yaw,
      pitch: start.pitch,
    })
      .to({ yaw: shortestYaw, pitch: target.pitch }, duration)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate((state) => {
        this.engine.setCameraView({ hlookat: state.yaw, vlookat: state.pitch })
      })
      .onComplete(() => {
        // 自然结束后清空引用，避免下一次调用 stop 已完成的 Tween
        if (this.currentViewTween === tween) {
          this.currentViewTween = null
        }
      })
      .start()

    this.currentViewTween = tween
  }

  /**
   * 计算 yaw 的最短路径目标：
   * 让 (target - start) 的差值落在 [-180, 180]（不含 -180）之间，
   * 从而 Tween 以直线插值走的就是球面上的最短弧。
   */
  private shortestYawTarget(startYaw: number, targetYaw: number): number {
    let diff = targetYaw - startYaw
    // 归一化到 (-180, 180]
    while (diff > 180) diff -= 360
    while (diff <= -180) diff += 360
    return startYaw + diff
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
   * 模型热点「面向中心」：姿态重置为 lookAt 球心 + rotate
   */
  public orientModelToCenter(hotspotId: string): void {
    this.engine.hotspotsManager.orientModelToCenter(hotspotId)
  }

  /**
   * 读取模型热点当前实际渲染状态，供属性面板回显。
   * 面板语义：relativeScale 为「相对默认尺寸的倍数」（1=默认，2=两倍大）；
   * rotateX/Y/Z 为三轴旋转角（度），单值旧数据映射到 Y 轴。
   * DB 的 scale 字段保持引擎绝对值（原始尺寸×绝对倍数），由本类双向换算。
   * @returns { relativeScale, rotateX, rotateY, rotateZ }；热点不存在或模型未加载完成时返回 null
   */
  public getModelRuntime(hotspotId: string): {
    relativeScale: number
    rotateX: number
    rotateY: number
    rotateZ: number
  } | null {
    const model = this.engine.hotspotsManager.modelHotspots.get(hotspotId)
    const obj = model?.getObject()
    if (!model || !obj) return null
    const rotateValues = typeof model.getRotateValues === 'function' ? model.getRotateValues() : []
    const base = typeof model.getBaseScale === 'function' ? model.getBaseScale() : 1
    const relative = base > 0 ? obj.scale.x / base : 1
    // 与引擎 applyRotateValuesTo 的轴向语义对齐：
    // [v] → 绕 Y 自转；[x,y] → X+Y；[x,y,z] → X+Y+Z
    const rotateX = rotateValues.length >= 2 ? rotateValues[0] : 0
    const rotateY = rotateValues.length >= 1 ? (rotateValues.length === 1 ? rotateValues[0] : rotateValues[1]) : 0
    const rotateZ = rotateValues.length >= 3 ? rotateValues[2] : 0
    return {
      relativeScale: relative,
      rotateX,
      rotateY,
      rotateZ,
    }
  }

  /**
   * 把面板的相对倍数（1=默认尺寸）应用到引擎，返回落库值（即相对倍数本身，
   * DB scale 列 decimal(10,2) 存储的语义就是相对倍数）。
   * 非法输入或热点不存在时返回 null（不应用）。
   */
  public setModelRelativeScale(hotspotId: string, relativeScale: number): number | null {
    const model = this.engine.hotspotsManager.modelHotspots.get(hotspotId)
    if (!model || !Number.isFinite(relativeScale) || relativeScale <= 0) return null
    if (typeof model.setRelativeScale !== 'function') return null
    model.setRelativeScale(relativeScale)
    return relativeScale
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
   * 设置 web 热点内 iframe 的 pointer-events（编辑器模式）。
   * editable=true 时 iframe 禁用 pointer-events，点击穿透到 hotspot div，
   * 使 canvas-viewport 的 handlePointerDown 能捕获选中/拖拽事件。
   */
  public setWebIframesEditable(editable: boolean): void {
    this.engine.hotspotsManager.setWebIframesEditable(editable)
  }

  // ==================== 后期处理 ====================

  /**
   * 应用完整的后期处理配置（从后端表单模型映射到引擎参数）。
   *
   * 字段映射约定（面板字段 → 引擎 BasicEffectParams）：
   *   exposure      → brightness = exposure - 1（exposure=1.0 表示无偏移）
   *   contrast      → contrast
   *   saturation    → saturation
   *   colorTemperature [-100,100] → temperature [-1,1]（÷100）
   * 其余引擎参数（sepia/hueRotate/vignette/grain/noiseAmount）由 preset 决定。
   *
   * @param config 后端持久化的后期配置（与 PostProcessing 形状兼容）
   */
  public applyPostConfig(config: {
    enabled: boolean
    presetStyle?: string
    exposure?: number
    contrast?: number
    saturation?: number
    colorTemperature?: number
    lutResourceId?: string | null
    lutIntensity?: number
    lutFileUrl?: string | null
  }): void {
    const pp = this.engine.getPostProcessing()
    if (!pp) return

    if (config.enabled) {
      pp.enable()
    } else {
      pp.disable()
      return
    }

    const presetStyle = config.presetStyle || 'original'
    const isBuiltinPreset =
      presetStyle !== 'custom' && presetStyle !== '' && pp.applyPreset(presetStyle)

    // 数值参数（exposure/contrast/saturation/colorTemperature）始终以表单值为准，
    // 覆盖 preset 的同名参数，保证 UI 所见即所得。
    const exposure = typeof config.exposure === 'number' ? config.exposure : 1.0
    const contrast = typeof config.contrast === 'number' ? config.contrast : 1.0
    const saturation = typeof config.saturation === 'number' ? config.saturation : 1.0
    const colorTemp = typeof config.colorTemperature === 'number' ? config.colorTemperature : 0

    // 读取当前 preset 的其它参数（sepia/vignette/grain 等），保证自定义数值修改时
    // 不会把 preset 的风格效果一并抹掉；如果是 custom 或 preset 不存在，则使用默认值。
    const base = isBuiltinPreset ? pp.getEffectParams() : {
      brightness: 0, contrast: 1, saturation: 1, hueRotate: 0, sepia: 0,
      temperature: 0, vignette: 0, grain: 0, noiseAmount: 0,
    }
    pp.setEffectParams({
      ...base,
      brightness: exposure - 1,
      contrast,
      saturation,
      temperature: colorTemp / 100,
    })

    // LUT
    if (config.lutResourceId && config.lutFileUrl) {
      void this.loadLutFromUrl(config.lutFileUrl)
    } else {
      pp.removeLut()
    }
    pp.setLutIntensity(typeof config.lutIntensity === 'number' ? config.lutIntensity : 1)
  }

  /**
   * 切换后期启用状态（不改动参数）。
   */
  public setPostEnabled(enabled: boolean): void {
    const pp = this.engine.getPostProcessing()
    if (!pp) return
    if (enabled) pp.enable()
    else pp.disable()
  }

  /**
   * 仅切换预设（保留当前数值覆盖，由面板在数值变化时再次调用 applyPostConfig 同步）。
   */
  public applyPostPreset(presetName: string): boolean {
    const pp = this.engine.getPostProcessing()
    if (!pp) return false
    return pp.applyPreset(presetName)
  }

  /**
   * 从 URL 下载 LUT 文件并加载到引擎。
   * 内部 fetch→Blob→File，复用引擎原生的 .cube / .png 解析逻辑。
   */
  public async loadLutFromUrl(url: string): Promise<boolean> {
    const pp = this.engine.getPostProcessing()
    if (!pp) return false
    try {
      const resp = await fetch(url, { credentials: 'include' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const name = url.split('/').pop() || 'lut'
      const file = new File([blob], name, { type: blob.type || 'application/octet-stream' })
      return await pp.loadLutFile(file)
    } catch (e) {
      console.error('Failed to load LUT from url:', url, e)
      return false
    }
  }

  public removeLut(): void {
    this.engine.getPostProcessing()?.removeLut()
  }

  public setLutIntensity(intensity: number): void {
    this.engine.getPostProcessing()?.setLutIntensity(intensity)
  }

  /**
   * 销毁引擎，释放资源
   */
  public dispose(): void {
    this.engine.dispose()
  }
}
