import { ref, computed } from 'vue'
import type { EditorTool, HotspotToolType, LeftPanelTab, RightPanelSection } from '@/types'
import type { CreateHotspotParams, UpdateHotspotParams, Project, TourSettings } from '@/types'
import { perf } from '@/utils/performanceMonitor'
import { SceneViewModel } from './SceneViewModel'
import { HotspotViewModel } from './HotspotViewModel'
import { AssetViewModel } from './AssetViewModel'
import type { ProjectService, SceneService, HotspotService, ResourceService } from '@/models'
import { exportToKrpanoXml } from '@/utils/xmlExport'
import { downloadXml } from '@/utils/downloadFile'

/**
 * 编辑器主控 ViewModel
 * 负责编辑器整体状态管理和跨领域协调
 */
export class EditorViewModel {
  // === UI 状态 ===
  activeTool = ref<EditorTool>('select')
  hotspotType = ref<HotspotToolType>('info')
  leftPanelVisible = ref(true)
  rightPanelVisible = ref(true)
  leftPanelTab = ref<LeftPanelTab>('scene')
  rightPanelSection = ref<RightPanelSection>('scene')
  zoom = ref(100)

  // === 编辑状态 ===
  isDirty = ref(false)
  isSaving = ref(false)
  lastSavedAt = ref<string>('')
  currentProject = ref<Project | null>(null)

  // === 子 ViewModel ===
  sceneViewModel: SceneViewModel
  hotspotViewModel: HotspotViewModel
  assetViewModel: AssetViewModel

  // === 服务引用（exportConfig 等跨场景操作需要） ===
  private hotspotService: HotspotService

  // === 计算属性 ===
  canSave = computed(() => this.isDirty.value && !this.isSaving.value)

  constructor(
    private projectService: ProjectService,
    sceneService: SceneService,
    hotspotService: HotspotService,
    resourceService: ResourceService
  ) {
    this.hotspotService = hotspotService
    this.sceneViewModel = new SceneViewModel(sceneService)
    this.hotspotViewModel = new HotspotViewModel(hotspotService)
    this.assetViewModel = new AssetViewModel(resourceService)
  }

  // === 项目加载 ===
  async loadProject(projectId: string): Promise<void> {
    const endStage = perf.stage('vm-load-project', { projectId })

    // 优化：项目数据和场景列表无依赖关系，改为并行加载
    const endParallel = perf.stage('vm-load-parallel')
    const [project] = await Promise.all([
      this.projectService.loadProject(projectId),
      this.sceneViewModel.loadScenes(projectId),
    ])
    this.currentProject.value = project
    endParallel({ sceneCount: this.sceneViewModel.scenes.value.length })

    if (this.sceneViewModel.currentScene.value) {
      const endHotspots = perf.stage('vm-load-hotspots')
      await this.hotspotViewModel.loadHotspots(
        this.sceneViewModel.currentScene.value.id
      )
      endHotspots({ hotspotCount: this.hotspotViewModel.hotspots.value.length })
    }

    this.isDirty.value = false
    endStage()
  }

  // === 场景切换 ===
  async switchScene(sceneId: string): Promise<void> {
    // 防重入：引擎内部切换后触发 sceneId 属性变化导致重复调用
    if (this.sceneViewModel.currentScene.value?.id === sceneId) return
    this.sceneViewModel.selectScene(sceneId)
    if (this.sceneViewModel.currentScene.value) {
      await this.hotspotViewModel.loadHotspots(
        this.sceneViewModel.currentScene.value.id
      )
    }
    this.rightPanelSection.value = 'scene'
  }

  // === 工具管理 ===
  setActiveTool(tool: EditorTool): void {
    this.activeTool.value = tool
    if (tool === 'hotspot' && !this.hotspotType.value) {
      this.hotspotType.value = 'info'
    }
  }

  setHotspotType(type: HotspotToolType): void {
    this.hotspotType.value = type
  }

  // === 面板管理 ===
  toggleLeftPanel(): void {
    this.leftPanelVisible.value = !this.leftPanelVisible.value
  }

  toggleRightPanel(): void {
    this.rightPanelVisible.value = !this.rightPanelVisible.value
  }

  setLeftPanelTab(tab: LeftPanelTab): void {
    this.leftPanelTab.value = tab
  }

  setRightPanelSection(section: RightPanelSection): void {
    this.rightPanelSection.value = section
    this.rightPanelVisible.value = true
  }

  setZoom(value: number): void {
    this.zoom.value = Math.max(25, Math.min(200, value))
  }

  // === 保存逻辑 ===
  markDirty(): void {
    this.isDirty.value = true
  }

  async save(): Promise<void> {
    if (!this.isDirty.value || this.isSaving.value) return
    this.isSaving.value = true
    try {
      // TODO: 实现具体的保存逻辑
      this.isDirty.value = false
      this.lastSavedAt.value = new Date().toLocaleTimeString('zh-CN')
    } finally {
      this.isSaving.value = false
    }
  }

  // === 配置导出 ===
  /**
   * 导出当前项目为 krpano XML 配置文件并触发浏览器下载。
   *
   * - 汇总所有场景、所有场景的热点（通过 hotspotService 逐场景拉取最新数据）
   * - 解析 Project.settings（JSON 字符串）为 TourSettings
   * - 调用 exportToKrpanoXml 生成 XML，然后通过 downloadXml 下载
   */
  async exportConfig(): Promise<void> {
    const project = this.currentProject.value
    if (!project) {
      throw new Error('当前没有打开的项目，无法导出配置')
    }
    const scenes = this.sceneViewModel.scenes.value

    // 并行拉取所有场景的热点（不污染 hotspotViewModel 当前场景的列表）
    const hotspotLists = await Promise.all(
      scenes.map((s) => this.hotspotService.fetchHotspots(s.id)),
    )
    const hotspots = hotspotLists.flat()

    // settings 解析（容错）
    let settings: TourSettings | null = null
    if (project.settings) {
      try {
        settings = JSON.parse(project.settings) as TourSettings
      } catch {
        settings = null
      }
    }

    const xml = exportToKrpanoXml(project, scenes, settings, hotspots)
    const baseName = sanitizeFilename(project.name || 'tour')
    downloadXml(xml, baseName)
  }

  // === 热点操作 ===
  async addHotspot(params: CreateHotspotParams): Promise<void> {
    if (!this.sceneViewModel.currentScene.value) return
    const hotspot = await this.hotspotViewModel.createHotspot(
      this.sceneViewModel.currentScene.value.id,
      params
    )
    // 新建后立即选中并切到属性面板，方便直接编辑样式
    this.hotspotViewModel.selectHotspot(hotspot.id)
    this.setRightPanelSection('hotspot')
    // 退出“添加”模式，回到选择/编辑状态，
    // 避免再次点击场景时又创建一个新热点（用户希望添加后直接编辑属性）
    this.setActiveTool('select')
    this.markDirty()
  }

  async removeHotspot(hotspotId: string): Promise<void> {
    await this.hotspotViewModel.deleteHotspot(hotspotId)
    this.markDirty()
  }

  /** 一键清空当前场景的所有热点 */
  async clearAllHotspots(): Promise<void> {
    await this.hotspotViewModel.clearHotspots()
    this.markDirty()
  }

  async updateHotspot(hotspotId: string, params: UpdateHotspotParams): Promise<void> {
    await this.hotspotViewModel.updateHotspot(hotspotId, params)
    this.markDirty()
  }

  // === 资源操作 ===
  async uploadResource(projectId: string, file: File, type: 'panorama' | 'image' | 'video' | 'audio'): Promise<void> {
    await this.assetViewModel.uploadResource(projectId, file, type)
    this.markDirty()
  }

  // === 清理 ===
  dispose(): void {
    this.sceneViewModel.dispose()
  }
}

/** 替换 Windows/Linux/macOS 文件名非法字符为下划线 */
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'tour'
}
