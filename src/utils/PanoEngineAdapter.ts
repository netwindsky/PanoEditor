/**
 * PanoEngine适配器
 * 扩展PanoViewV2标准库的PanoEngine，添加loadSceneConfig方法
 * 用于从后端JSON配置加载全景场景，而非XML文件
 */
import { PanoEngine } from '@panoview/core/PanoEngine'
import { SegmentedBox } from '@panoview/geometry/SegmentedBox'
import { PanoSplitter } from '@panoview/texture/PanoSplitter'
import { TileManager } from '@panoview/core/TileManager'
import type { TileConfig } from '@panoview/core/TileTypes'
import type { SceneData, Hotspot as PanoHotspot } from '@panoview/core/SceneParser'
import { Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3 } from 'three'
import type { Hotspot } from '@/types'

export class PanoEngineAdapter extends PanoEngine {
  private adapterTileManager: TileManager | null = null
  private adapterSegmentedBoxes: SegmentedBox[] = []

  /**
   * 从后端JSON配置加载全景场景
   * @param config 后端生成的场景配置（JSON对象或SceneData数组）
   */
  public loadSceneConfig(config: SceneData | SceneData[] | Record<string, any>): void {
    // 将后端JSON转换为SceneData格式
    let sceneData: SceneData

    if (Array.isArray(config)) {
      sceneData = config[0]
    } else if (config.scene && config.image) {
      sceneData = config as SceneData
    } else {
      // 后端生成的配置需要转换
      sceneData = this.convertToSceneData(config)
    }

    this.loadSceneInternal(sceneData)
  }

  /**
   * 将后端JSON配置转换为标准库SceneData格式
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
      preview: config.preview
        ? { url: config.preview.url }
        : undefined,
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

  /**
   * 内部加载场景方法，复用标准库的初始化逻辑
   */
  private async loadSceneInternal(sceneData: SceneData): Promise<void> {
    if (!sceneData?.image?.levels || sceneData.image.levels.length === 0) {
      console.warn('场景数据中缺少levels信息')
      return
    }

    // 清理旧场景
    this.cleanupScene()

    // 初始化相机视角
    if (sceneData.view) {
      this.initCameraView(sceneData.view)
    }

    // 加载预览图
    if (sceneData.preview?.url) {
      await this.initPreview(sceneData.preview.url)
    }

    // 排序levels从小到大
    const levels = [...sceneData.image.levels].sort(
      (a, b) => (parseInt(String(a.tiledimagewidth)) || 0) - (parseInt(String(b.tiledimagewidth)) || 0),
    )

    const totalLevels = levels.length

    // 创建瓦片管理器
    const scene = (this as any).scene as Scene
    this.adapterTileManager = new TileManager(scene, {
      workerManager: (this as any).workerManager,
    })

    // 设置层级分辨率
    const levelResolutions = levels.map((level: any) => parseInt(String(level.tiledimagewidth)))
    this.adapterTileManager.setLevelResolutions(levelResolutions)

    // 为每个level创建SegmentedBox
    levels.forEach((level: any, index: number) => {
      const levelWidth = parseInt(String(level.tiledimagewidth))
      const levelHeight = parseInt(String(level.tiledimageheight))
      if (!levelWidth || !levelHeight || !level.cube?.url) {
        console.warn(`第${index}级level数据不完整，已跳过`)
        return
      }

      const segmentedBox = new SegmentedBox()
      segmentedBox.setLevels(index)
      this.adapterSegmentedBoxes.push(segmentedBox)

      const tileConfig: TileConfig = {
        tiledimagewidth: levelWidth,
        tiledimageheight: levelHeight,
        urlTemplate: level.cube.url,
      }

      const boxGroup = segmentedBox.create(levelWidth, levelWidth, levelWidth)

      const levelMeshes: Mesh[] = []
      boxGroup.traverse((object) => {
        if (object instanceof Mesh) {
          object.material.depthTest = false
          object.material.depthWrite = false
          object.material.wireframe = false
          object.material.opacity = 0.0
          object.material.transparent = true
          object.material.polygonOffset = true
          object.material.polygonOffsetFactor = -index * 1.0
          object.material.polygonOffsetUnits = -index * 1.0
          object.renderOrder = -1
          object.userData.level = index
          object.updateMatrixWorld(true)
          levelMeshes.push(object)
        }
      })

      this.adapterTileManager!.addMeshes(levelMeshes)
      scene.add(boxGroup)
    })

    // 设置FOV范围
    if (sceneData.view?.fovmin && sceneData.view?.fovmax) {
      this.adapterTileManager.setFOVRange(
        parseInt(sceneData.view.fovmin),
        parseInt(sceneData.view.fovmax),
      )
    }
  }

  /**
   * 初始化预览图
   */
  private async initPreview(previewUrl: string): Promise<void> {
    const scene = (this as any).scene as Scene
    const segmentedBox = new SegmentedBox()
    segmentedBox.setLevels(999)
    const boxGroup = segmentedBox.create(512, 512, 512)
    this.adapterSegmentedBoxes.push(segmentedBox)
    boxGroup.scale.set(2, 2, 2)
    scene.add(boxGroup)

    const splitter = new PanoSplitter()
    const textures = await splitter.splitPanorama(previewUrl)
    const meshes = this.getMeshesByLevel(999)

    Object.entries(textures).forEach(([faceName, texture]) => {
      const mesh = meshes.find((m) => m.userData.name.includes(faceName))
      if (mesh) {
        texture.colorSpace = 'srgb'
        mesh.material.map = texture
        mesh.material.opacity = 1
        mesh.material.transparent = false
        mesh.material.needsUpdate = true
      }
    })
  }

  /**
   * 初始化相机视角
   */
  private initCameraView(view: any): void {
    const camera = (this as any).camera as PerspectiveCamera
    if (view.hlookat) {
      const hlookat = parseFloat(String(view.hlookat))
      const vlookat = parseFloat(String(view.vlookat))
      const fov = parseFloat(String(view.fov))

      // 将hlookat/vlookat转换为相机旋转
      const yaw = (hlookat * Math.PI) / 180
      const pitch = (vlookat * Math.PI) / 180
      camera.rotation.set(pitch, yaw, 0, 'YXZ')
      if (fov) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
    }
  }

  /**
   * 清理当前场景
   */
  private cleanupScene(): void {
    const scene = (this as any).scene as Scene

    if (this.adapterTileManager) {
      this.adapterTileManager.dispose()
      this.adapterTileManager = null
    }

    this.adapterSegmentedBoxes = []

    // 清理热点
    this.hotspotsManager.clearHotspots()

    // 移除场景中的3D对象（保留相机和光源等）
    const toRemove: any[] = []
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        toRemove.push(object)
      }
    })
    toRemove.forEach((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach((mat: MeshBasicMaterial) => {
          if (mat.map) mat.map.dispose()
          mat.dispose()
        })
      }
      scene.remove(obj)
    })
  }

  // ==================== 热点管理方法 ====================

  /**
   * 将后端Hotspot数据转换为PanoViewV2标准库的Hotspot格式
   */
  private toPanoHotspot(hotspot: Hotspot): PanoHotspot {
    return {
      name: hotspot.id,
      style: hotspot.style || 'pulsing-dot',
      ath: String(hotspot.ath),
      atv: String(hotspot.atv),
      linkedscene: hotspot.linkedSceneId || '',
      tooltip: hotspot.tooltip || hotspot.name,
      onclick: hotspot.onclick || '',
      events: hotspot.events || '',
      on: hotspot.onclick || '',
      type: hotspot.type,
      url: hotspot.url || '',
      width: hotspot.width ? String(hotspot.width) : undefined,
      height: hotspot.height ? String(hotspot.height) : undefined,
      scale: hotspot.scale ? String(hotspot.scale) : undefined,
      rotate: hotspot.rotate ? String(hotspot.rotate) : undefined,
      blendmode: hotspot.blendmode || '',
      points: hotspot.points,
      bgcolor: hotspot.bgcolor,
      tolerance: hotspot.tolerance,
      feather: hotspot.feather,
      followzoom: hotspot.followZoom ? '1' : undefined,
    }
  }

  /**
   * 同步后端热点列表到3D场景
   */
  public syncHotspots(hotspots: Hotspot[]): void {
    this.hotspotsManager.clearHotspots()
    const panoHotspots = hotspots.map((h) => this.toPanoHotspot(h))
    this.hotspotsManager.createHotspots(panoHotspots)
    this.hotspotsManager.fadeIn(500)
  }

  /**
   * 添加单个热点到3D场景
   */
  public addHotspotToScene(hotspot: Hotspot): void {
    const panoHotspot = this.toPanoHotspot(hotspot)
    this.hotspotsManager.createHotspot(panoHotspot)
  }

  /**
   * 从3D场景移除热点
   */
  public removeHotspotFromScene(hotspotId: string): void {
    this.hotspotsManager.removeHotspot(hotspotId)
  }

  /**
   * 更新3D场景中的热点数据
   */
  public updateHotspotInScene(hotspot: Hotspot): void {
    const panoHotspot = this.toPanoHotspot(hotspot)
    this.hotspotsManager.updateHotspotData(hotspot.id, panoHotspot)
  }

  /**
   * 获取点击位置对应的ath/atv球坐标
   * 用于点击canvas添加热点时获取3D球坐标
   */
  public getCoordsFromPoint(clientX: number, clientY: number): { ath: number; atv: number } {
    const camera = (this as any).camera as PerspectiveCamera
    const rect = this.container.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new Raycaster()
    raycaster.setFromCamera(new Vector2(x, y), camera)
    const dir = raycaster.ray.direction.clone().normalize()
    const ath = Math.atan2(-dir.x, dir.z) * (180 / Math.PI)
    const atv = -Math.asin(dir.y) * (180 / Math.PI)
    return { ath, atv }
  }

  /**
   * 获取相机中心方向对应的ath/atv坐标
   */
  public getCenterCoords(): { ath: number; atv: number } {
    const camera = (this as any).camera as PerspectiveCamera
    const direction = new Vector3()
    camera.getWorldDirection(direction)
    const ath = Math.atan2(-direction.x, direction.z) * (180 / Math.PI)
    const atv = Math.asin(direction.y) * (180 / Math.PI)
    return { ath, atv }
  }

  /**
   * 增量移动热点
   * @param hotspotId 热点ID（即PanoViewV2中的name）
   * @param deltaAth 水平增量（度）
   * @param deltaAtv 垂直增量（度）
   */
  public moveHotspot(hotspotId: string, deltaAth: number, deltaAtv: number): void {
    this.hotspotsManager.moveHotspot(hotspotId, deltaAth, deltaAtv)
  }

  /**
   * 通过raycast或DOM查找点击位置命中的热点
   * @param clientX 鼠标X坐标
   * @param clientY 鼠标Y坐标
   * @returns 命中的热点ID（name），未命中返回null
   */
  public getHitHotspot(clientX: number, clientY: number): string | null {
    // 1. 先通过raycast检测3D热点（mesh/model类型）
    const rayHit = this.getRaycastHit(clientX, clientY)
    if (rayHit) return rayHit

    // 2. 再通过DOM查找data-hotspot-name属性
    const domHit = this.getDomHitHotspot(clientX, clientY)
    if (domHit) return domHit

    return null
  }

  /**
   * 通过raycast检测3D热点
   */
  private getRaycastHit(clientX: number, clientY: number): string | null {
    const camera = (this as any).camera as PerspectiveCamera
    const rect = this.container.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new Raycaster()
    raycaster.setFromCamera(new Vector2(x, y), camera)

    const targets = this.hotspotsManager.getRaycastTargets()
    if (targets.length === 0) return null

    const intersections = raycaster.intersectObjects(targets, true)
    for (const hit of intersections) {
      let current: Object3D | null = hit.object
      while (current) {
        const hotspotName = current.userData?.hotspotName || current.userData?.name
        if (hotspotName) return String(hotspotName)
        current = current.parent
      }
    }
    return null
  }

  /**
   * 通过DOM查找命中的热点元素
   */
  private getDomHitHotspot(clientX: number, clientY: number): string | null {
    const elements = document.elementsFromPoint(clientX, clientY)
    for (const el of elements) {
      const hotspotName = (el as HTMLElement).dataset?.hotspotName
        || (el.closest('[data-hotspot-name]') as HTMLElement)?.dataset?.hotspotName
      if (hotspotName) return hotspotName
    }
    return null
  }

  /**
   * 高亮选中热点
   * @param hotspotId 热点ID
   */
  public highlightHotspot(hotspotId: string): void {
    // DOM热点：添加选中样式
    const allHotspots = this.hotspotsManager.getAllHotspots()
    const hotspotData = allHotspots.get(hotspotId)
    if (hotspotData?.element) {
      hotspotData.element.style.outline = '2px solid #3b82f6'
      hotspotData.element.style.outlineOffset = '2px'
      hotspotData.element.style.zIndex = '100'
    }
    // Mesh热点：修改材质
    const meshHotspots = (this.hotspotsManager as any).meshHotspots as Map<string, Mesh>
    const mesh = meshHotspots?.get(hotspotId)
    if (mesh && mesh.material) {
      const mat = mesh.material as MeshBasicMaterial
      mat.wireframe = true
      mat.opacity = 0.8
      mat.transparent = true
      mat.needsUpdate = true
    }
  }

  /**
   * 取消高亮热点
   * @param hotspotId 热点ID
   */
  public unhighlightHotspot(hotspotId: string): void {
    const allHotspots = this.hotspotsManager.getAllHotspots()
    const hotspotData = allHotspots.get(hotspotId)
    if (hotspotData?.element) {
      hotspotData.element.style.outline = ''
      hotspotData.element.style.outlineOffset = ''
      hotspotData.element.style.zIndex = ''
    }
    const meshHotspots = (this.hotspotsManager as any).meshHotspots as Map<string, Mesh>
    const mesh = meshHotspots?.get(hotspotId)
    if (mesh && mesh.material) {
      const mat = mesh.material as MeshBasicMaterial
      mat.wireframe = false
      mat.opacity = 1
      mat.transparent = false
      mat.needsUpdate = true
    }
  }

  /**
   * 禁用全景控制器（拖拽热点时使用）
   */
  public disableControls(): void {
    super.disableControls()
  }

  /**
   * 启用全景控制器
   */
  public enableControls(): void {
    super.enableControls()
  }

  public override dispose(): void {
    this.cleanupScene()
    super.dispose()
  }
}
