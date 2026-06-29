import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Toolbar from './Toolbar.vue'
import RightPanel from './RightPanel.vue'
import { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type {
  ProjectService,
  SceneService,
  HotspotService,
  ResourceService,
} from '@/models'

/**
 * 复现 bug：模板里 @click="vm.toggleXxx" 直接传方法引用，
 * 点击触发时 this 丢失，调用 this.xxx.value 抛错，导致面板切换按钮点了没反应。
 */

// 构造最小可用的 EditorViewModel（service 全部用空对象，本测试只触达 UI 状态方法）
function makeViewModel(): EditorViewModel {
  const noopService = {} as unknown
  return new EditorViewModel(
    noopService as ProjectService,
    noopService as SceneService,
    noopService as HotspotService,
    noopService as ResourceService,
  )
}

// 让 el-icon / 图标组件等渲染为占位，避免引入完整 ElementPlus
const globalStubs = {
  'el-icon': { template: '<i><slot /></i>' },
  'el-button': {
    template: '<button v-bind="$attrs"><slot /></button>',
    inheritAttrs: false,
  },
}

describe('Toolbar 面板切换按钮（this 绑定回归）', () => {
  let vm: EditorViewModel

  beforeEach(() => {
    vm = makeViewModel()
  })

  it('点击“切换左面板”应翻转 leftPanelVisible', async () => {
    const wrapper = mount(Toolbar, {
      props: { vm },
      global: { stubs: globalStubs },
    })
    expect(vm.leftPanelVisible.value).toBe(true)

    const leftBtn = wrapper.find('button[title="切换左面板"]')
    expect(leftBtn.exists()).toBe(true)
    await leftBtn.trigger('click')

    expect(vm.leftPanelVisible.value).toBe(false)
  })

  it('点击“切换右面板”应翻转 rightPanelVisible', async () => {
    const wrapper = mount(Toolbar, {
      props: { vm },
      global: { stubs: globalStubs },
    })
    expect(vm.rightPanelVisible.value).toBe(true)

    const rightBtn = wrapper.find('button[title="切换右面板"]')
    expect(rightBtn.exists()).toBe(true)
    await rightBtn.trigger('click')

    expect(vm.rightPanelVisible.value).toBe(false)
  })
})

describe('RightPanel 关闭按钮（this 绑定回归）', () => {
  it('点击关闭按钮应翻转 rightPanelVisible 为 false', async () => {
    const vm = makeViewModel()
    const wrapper = mount(RightPanel, {
      props: { vm },
      global: {
        stubs: {
          ...globalStubs,
          // 屏蔽依赖 Pinia store 的属性子面板，仅测试关闭按钮的 this 绑定
          SceneProperties: true,
          HotspotProperties: true,
          AudioSettings: true,
          PostProcessingPanel: true,
          AssetLibrary: true,
        },
      },
    })
    expect(vm.rightPanelVisible.value).toBe(true)

    await wrapper.find('button').trigger('click')

    expect(vm.rightPanelVisible.value).toBe(false)
  })
})
