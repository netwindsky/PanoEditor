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
import type { Hotspot } from '@/types'

export class PanoEngineAdapter {
  private engine: PanoEngine
  // 性能埋点：跨实例累计 syncHotspots 调用次数（全量重建次数），用于发现高频重建
  private static syncCallCount = 0

  constructor(container: HTMLElement) {
    // autoLoad:false —— 跳过引擎内置 XML demo，改用后端场景数据
    this.engine = new PanoEngine(container, { autoLoad: false })
    console.log('[PERF][adapter] new PanoEngine instance created')
  }

  /**
   * 从后端 JSON 配置加载全景场景。
   * @param config 后端生成的场景配置（JSON 对象或 SceneData 数组）
   */
  public async loadSceneConfig(config: SceneData | SceneData[] | Record<string, any>): Promise<void> {
    const __t0 = performance.now()
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
    await this.engine.loadScenes([sceneData], { manageHotspots: false })
    console.log(`[PERF][adapter] loadSceneConfig done in ${(performance.now() - __t0).toFixed(1)}ms`, {
      hotspots: sceneData.hotspots?.length ?? 0,
      levels: sceneData.image?.levels?.length ?? 0,
    })
  }

  /**
   * 将后端 JSON 配置转换为标准库 SceneData 格式
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

    return {
      name: hotspot.id,
      style: resolvedStyle,
      ath: String(hotspot.ath),
      atv: String(hotspot.atv),
      linkedscene: hotspot.linkedSceneId || '',
      tooltip: hotspot.tooltip || hotspot.name,
      onclick: hotspot.onclick || '',
      events: hotspot.events || '',
      on: hotspot.onclick || '',
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
    }
  }

  /**
   * 同步后端热点列表到 3D 场景
   */
  public syncHotspots(hotspots: Hotspot[]): void {
    const __t0 = performance.now()
    PanoEngineAdapter.syncCallCount++
    this.engine.hotspotsManager.clearHotspots()
    const panoHotspots = hotspots.map((h) => this.toPanoHotspot(h))
    this.engine.hotspotsManager.createHotspots(panoHotspots)
    this.engine.hotspotsManager.fadeIn(500)
    console.log(
      `[PERF][adapter] syncHotspots #${PanoEngineAdapter.syncCallCount} (full rebuild) ` +
        `count=${hotspots.length} in ${(performance.now() - __t0).toFixed(1)}ms`,
    )
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
