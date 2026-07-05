import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorViewModel } from './EditorViewModel'
import type {
  ProjectService,
  SceneService,
  HotspotService,
  ResourceService,
} from '@/models'
import type { Project, Scene, Hotspot, TourSettings } from '@/types'

/**
 * EditorViewModel.exportConfig 行为：
 * 1. 读取 currentProject（为空时抛出或静默返回）
 * 2. 从 sceneViewModel.scenes 取全部场景、按 sceneId 汇总全部热点
 * 3. 解析 project.settings 为 TourSettings（解析失败降级 null）
 * 4. 调用 exportToKrpanoXml 生成 XML
 * 5. 调用 downloadXml 触发浏览器下载，文件名采用 project.name（去除非法字符）
 */

const fakeProject: Project = {
  id: 'p-1',
  name: '我的全景项目',
  settings: JSON.stringify({
    autoRotate: false,
    autoRotateSpeed: 1,
    defaultFov: 100,
    minFov: 50,
    maxFov: 150,
    enableCompass: false,
    controlbar: true,
    thumbs: true,
    tooltips: true,
    designStyle: 'flat',
    loadsceneBlend: '',
  } as TourSettings),
} as Project

const scene1: Scene = {
  id: 's1',
  projectId: 'p-1',
  name: 'scene1',
  title: '场景一',
  previewUrl: '/p/s1.jpg',
  thumbUrl: '/t/s1.jpg',
  imageConfig: '',
  status: 'READY',
  initialView: { yaw: 0, pitch: 0, hfov: 100, fovMin: 70, fovMax: 140, maxPixelZoom: 2, limitView: 'auto', fovType: 'MFOV' },
  location: {},
  onstart: '',
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
}
const scene2: Scene = { ...scene1, id: 's2', name: 'scene2', title: '场景二', sortOrder: 1 }

const hs1: Hotspot = { id: 'h1', sceneId: 's1', name: 'spot1', type: 'info', ath: 10, atv: 20 }
const hs2: Hotspot = { id: 'h2', sceneId: 's2', name: 'spot2', type: 'scene', ath: 30, atv: -5, linkedSceneId: 's1' }

// mock xmlExport 与 downloadFile，避免真实文件下载与断言 XML 内容细节
vi.mock('@/utils/xmlExport', () => ({
  exportToKrpanoXml: vi.fn(() => '<krpano/>'),
}))
vi.mock('@/utils/downloadFile', () => ({
  downloadXml: vi.fn(),
}))

describe('EditorViewModel.exportConfig', () => {
  let projectService: ProjectService
  let sceneService: SceneService
  let hotspotService: HotspotService
  let resourceService: ResourceService
  let vm: EditorViewModel

  beforeEach(async () => {
    vi.clearAllMocks()
    projectService = {
      loadProject: vi.fn().mockResolvedValue(fakeProject),
    } as unknown as ProjectService
    sceneService = {} as SceneService
    hotspotService = {
      // exportConfig 需要跨全部场景加载热点
      fetchHotspots: vi.fn((sceneId: string) => {
        if (sceneId === 's1') return Promise.resolve([hs1])
        if (sceneId === 's2') return Promise.resolve([hs2])
        return Promise.resolve([])
      }),
    } as unknown as HotspotService
    resourceService = {} as ResourceService

    vm = new EditorViewModel(projectService, sceneService, hotspotService, resourceService)
    vm.sceneViewModel.loadScenes = vi.fn().mockResolvedValue(undefined)
    // 预置两个场景
    vm.sceneViewModel.scenes.value = [scene1, scene2]
    vm.currentProject.value = fakeProject
  })

  it('无 currentProject 时抛出提示性错误', async () => {
    vm.currentProject.value = null
    await expect(vm.exportConfig()).rejects.toThrow(/项目/)
  })

  it('为每个场景调用 hotspotService.fetchHotspots 汇总全部热点', async () => {
    await vm.exportConfig()
    expect(hotspotService.fetchHotspots).toHaveBeenCalledTimes(2)
    expect(hotspotService.fetchHotspots).toHaveBeenCalledWith('s1')
    expect(hotspotService.fetchHotspots).toHaveBeenCalledWith('s2')
  })

  it('解析 project.settings JSON 作为 TourSettings 传给导出函数', async () => {
    const { exportToKrpanoXml } = await import('@/utils/xmlExport')
    await vm.exportConfig()
    expect(exportToKrpanoXml).toHaveBeenCalledTimes(1)
    const [_proj, scenes, settings, hotspots] = (exportToKrpanoXml as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(_proj).toStrictEqual(fakeProject)
    expect(scenes).toEqual([scene1, scene2])
    expect(settings).toMatchObject({ controlbar: true, thumbs: true })
    expect(hotspots).toEqual(expect.arrayContaining([hs1, hs2]))
  })

  it('project.settings 解析失败时降级 null 不崩溃', async () => {
    vm.currentProject.value = { ...fakeProject, settings: '{invalid json' } as Project
    const { exportToKrpanoXml } = await import('@/utils/xmlExport')
    await expect(vm.exportConfig()).resolves.toBeUndefined()
    expect(exportToKrpanoXml).toHaveBeenCalledTimes(1)
    const settingsArg = (exportToKrpanoXml as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2]
    expect(settingsArg).toBeNull()
  })

  it('调用 downloadXml 下载，文件名使用 project.name 清洗后的 .xml', async () => {
    const { downloadXml } = await import('@/utils/downloadFile')
    await vm.exportConfig()
    expect(downloadXml).toHaveBeenCalledWith('<krpano/>', '我的全景项目')
  })

  it('project.name 含文件系统非法字符时被替换为下划线（. 合法保留）', async () => {
    vm.currentProject.value = { ...fakeProject, name: 'a/b\\c:d*?"<>|.xml' } as Project
    const { downloadXml } = await import('@/utils/downloadFile')
    await vm.exportConfig()
    expect(downloadXml).toHaveBeenCalledWith('<krpano/>', 'a_b_c_d______.xml')
  })
})
