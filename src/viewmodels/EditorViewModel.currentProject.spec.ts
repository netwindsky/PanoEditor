import { describe, it, expect, vi } from 'vitest'
import { EditorViewModel } from './EditorViewModel'
import type {
  ProjectService,
  SceneService,
  HotspotService,
  ResourceService,
} from '@/models'
import type { Project } from '@/types'

/**
 * 复现 bug：StatusBar 始终显示“未打开项目”，因为 EditorViewModel
 * 加载项目后丢弃了返回的 Project，未保留任何 currentProject 状态。
 * 期望：loadProject 成功后，vm.currentProject 应保存已加载的项目。
 */

const fakeProject: Project = {
  id: 'p-1',
  name: '我的全景项目',
} as Project

function makeViewModel(): EditorViewModel {
  const projectService = {
    loadProject: vi.fn().mockResolvedValue(fakeProject),
  } as unknown as ProjectService
  const sceneService = {} as SceneService
  const hotspotService = {} as HotspotService
  const resourceService = {} as ResourceService

  const vm = new EditorViewModel(
    projectService,
    sceneService,
    hotspotService,
    resourceService,
  )
  // 屏蔽子 ViewModel 的副作用，仅验证项目状态保存
  vm.sceneViewModel.loadScenes = vi.fn().mockResolvedValue(undefined)
  return vm
}

describe('EditorViewModel 当前项目状态', () => {
  it('初始时 currentProject 应为 null', () => {
    const vm = makeViewModel()
    expect(vm.currentProject.value).toBeNull()
  })

  it('loadProject 成功后应保存已加载的项目', async () => {
    const vm = makeViewModel()
    await vm.loadProject('p-1')
    expect(vm.currentProject.value).toEqual(fakeProject)
  })
})
