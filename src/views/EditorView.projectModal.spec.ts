import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

/**
 * 复现 bug：点击 TopNav 的“项目”按钮无反应、且无项目时提示“未选择项目”。
 * 根因：EditorView 维护了 showProjectModal 状态（无 projectId 时置 true，
 * 点击按钮也置 true），但从未导入/渲染 ProjectModal 组件，
 * 这个布尔值无人消费 → 选择项目的弹窗永远不出现。
 *
 * 期望：
 *  1) EditorView 应渲染 ProjectModal 组件；
 *  2) 直接进入 /editor（无 projectId）时，弹窗应自动打开（modelValue=true）。
 */

// mock vue-router：无 projectId 路由参数
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

import EditorView from './EditorView.vue'

// 用带 modelValue 的轻量 stub 替换 ProjectModal，便于断言其打开状态；
// 其余子组件全部 stub 成占位，避免引入完整依赖。
const projectModalStub = {
  name: 'ProjectModal',
  props: ['modelValue'],
  template: '<div class="project-modal-stub" />',
}

const globalStubs = {
  TopNav: true,
  LeftPanel: true,
  Toolbar: true,
  EditorCanvas: true,
  RightPanel: true,
  TimelineBar: true,
  StatusBar: true,
  ProjectModal: projectModalStub,
}

describe('EditorView 项目选择弹窗', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应渲染 ProjectModal 组件', async () => {
    const wrapper = mount(EditorView, {
      global: { stubs: globalStubs },
    })
    await flushPromises()

    expect(wrapper.find('.project-modal-stub').exists()).toBe(true)
  })

  it('无 projectId 进入时应自动打开项目弹窗（modelValue=true）', async () => {
    const wrapper = mount(EditorView, {
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const modal = wrapper.findComponent({ name: 'ProjectModal' })
    expect(modal.exists()).toBe(true)
    expect(modal.props('modelValue')).toBe(true)
  })
})
