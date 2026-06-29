import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

/**
 * 复现 bug：选择项目后场景列表不刷新。
 * 根因：EditorView 仅在 onMounted 调用一次 vm.loadProject，
 * 而选择项目走 router.push(/editor/:id) 在同一路由组件间跳转，
 * 组件实例被复用、不重新挂载，onMounted 不再触发 → loadProject 不再调用。
 *
 * 期望：projectId 路由参数变化时应重新调用 vm.loadProject。
 */

// 可变的路由参数，测试中直接修改以模拟 router.push 切换项目
const routeParams = reactive<{ projectId?: string }>({})
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeParams }),
  useRouter: () => ({ push: vi.fn() }),
}))

// 捕获 loadProject / dispose 调用，避免真实 ViewModel + 网络请求
const loadProjectMock = vi.fn().mockResolvedValue(undefined)
const disposeMock = vi.fn()
vi.mock('@/viewmodels/EditorViewModel', () => ({
  EditorViewModel: class {
    leftPanelVisible = { value: false }
    rightPanelVisible = { value: false }
    isSaving = { value: false }
    loadProject = loadProjectMock
    dispose = disposeMock
  },
}))

// 所有 service / repository mock 成空类，避免副作用
vi.mock('@/models/repositories/ProjectRepository', () => ({ ProjectRepository: class {} }))
vi.mock('@/models/repositories/SceneRepository', () => ({ SceneRepository: class {} }))
vi.mock('@/models/repositories/HotspotRepository', () => ({ HotspotRepository: class {} }))
vi.mock('@/models/repositories/ResourceRepository', () => ({ ResourceRepository: class {} }))
vi.mock('@/models/services/ProjectService', () => ({ ProjectService: class {} }))
vi.mock('@/models/services/SceneService', () => ({ SceneService: class {} }))
vi.mock('@/models/services/HotspotService', () => ({ HotspotService: class {} }))
vi.mock('@/models/services/ResourceService', () => ({ ResourceService: class {} }))

import EditorView from './EditorView.vue'

const globalStubs = {
  TopNav: true,
  LeftPanel: true,
  Toolbar: true,
  EditorCanvas: true,
  RightPanel: true,
  TimelineBar: true,
  StatusBar: true,
  ProjectModal: true,
}

describe('EditorView 切换项目重新加载', () => {
  beforeEach(() => {
    loadProjectMock.mockClear()
    disposeMock.mockClear()
    delete routeParams.projectId
  })

  it('带初始 projectId 挂载时应加载该项目', async () => {
    routeParams.projectId = 'p-1'
    mount(EditorView, { global: { stubs: globalStubs } })
    await flushPromises()

    expect(loadProjectMock).toHaveBeenCalledWith('p-1')
  })

  it('projectId 路由参数变化时应重新调用 loadProject', async () => {
    // 初始无项目挂载（不会触发 loadProject）
    mount(EditorView, { global: { stubs: globalStubs } })
    await flushPromises()
    expect(loadProjectMock).not.toHaveBeenCalled()

    // 模拟选择项目：路由参数变化
    routeParams.projectId = 'p-2'
    await flushPromises()

    expect(loadProjectMock).toHaveBeenCalledWith('p-2')
  })

  it('从项目 A 切换到项目 B 时应重新加载 B', async () => {
    routeParams.projectId = 'a'
    mount(EditorView, { global: { stubs: globalStubs } })
    await flushPromises()
    expect(loadProjectMock).toHaveBeenCalledWith('a')

    routeParams.projectId = 'b'
    await flushPromises()
    expect(loadProjectMock).toHaveBeenCalledWith('b')
  })
})
