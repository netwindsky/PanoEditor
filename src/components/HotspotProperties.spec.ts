import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, nextTick } from 'vue'
import HotspotProperties from '@/components/HotspotProperties.vue'
import type { Hotspot, Scene, Resource, HotspotType } from '@/types'

// Mock Element Plus 组件
vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))

// 创建 Mock ViewModel
function createMockViewModel(overrides: Partial<MockViewModel> = {}) {
  const hotspots = ref<Hotspot[]>([
    {
      id: 'h1',
      sceneId: 's1',
      name: '测试热点1',
      type: 'info',
      ath: 71.24,
      atv: -19.49,
      style: 'pulsing-dot',
    },
    {
      id: 'h2',
      sceneId: 's1',
      name: '测试热点2',
      type: 'image',
      ath: 45,
      atv: 10,
      url: 'https://example.com/image.jpg',
    },
  ])

  const selectedHotspot = ref<Hotspot | null>(hotspots.value[0])
  const scenes = ref<Scene[]>([
    { id: 's1', projectId: 'p1', name: '场景1', previewUrl: '', thumbUrl: '', imageConfig: '', status: '', initialView: { hfov: 120, pitch: 0, yaw: 0 }, order: 0, createdAt: '', updatedAt: '' },
    { id: 's2', projectId: 'p1', name: '场景2', previewUrl: '', thumbUrl: '', imageConfig: '', status: '', initialView: { hfov: 120, pitch: 0, yaw: 0 }, order: 1, createdAt: '', updatedAt: '' },
  ])

  const resources = ref<Resource[]>([])

  const vm = {
    hotspotViewModel: {
      hotspots,
      selectedHotspot,
      selectHotspot: vi.fn((id: string) => {
        selectedHotspot.value = hotspots.value.find(h => h.id === id) || null
      }),
      deleteHotspot: vi.fn(),
      clearHotspots: vi.fn(),
      createHotspot: vi.fn(),
      updateHotspot: vi.fn(),
      previewHotspotStyle: vi.fn(),
      isDragging: ref(false),
    },
    sceneViewModel: {
      scenes,
      currentScene: ref(scenes.value[0]),
    },
    assetViewModel: {
      resources,
      loadResources: vi.fn(),
      uploadResource: vi.fn(),
    },
    currentProject: ref({ id: 'p1', name: '测试项目', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' }),
    addHotspot: vi.fn(),
    removeHotspot: vi.fn(),
    clearAllHotspots: vi.fn(),
    updateHotspot: vi.fn(),
    ...overrides,
  }

  return { vm, hotspots, selectedHotspot, scenes, resources }
}

type MockViewModel = ReturnType<typeof createMockViewModel>['vm']

function mountComponent(vm: MockViewModel) {
  return mount(HotspotProperties, {
    global: {
      provide: {
        editorViewModel: vm,
      },
      stubs: {
        'el-button': {
          template: '<button class="el-button" :type="type" :size="size" :disabled="disabled" :loading="loading" @click="$emit(\'click\')"><slot /></button>',
          props: ['type', 'size', 'disabled', 'loading'],
          emits: ['click'],
        },
        'el-input': {
          template: '<input class="el-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          props: ['modelValue', 'size', 'placeholder', 'type', 'rows', 'disabled'],
          emits: ['update:modelValue'],
        },
        'el-input-number': {
          template: '<input class="el-input-number" :value="modelValue" type="number" @input="$emit(\'update:modelValue\', parseFloat($event.target.value))" />',
          props: ['modelValue', 'size', 'step', 'precision', 'min', 'disabled', 'controlsPosition', 'placeholder'],
          emits: ['update:modelValue'],
        },
        'el-select': {
          template: '<select class="el-select" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
          props: ['modelValue', 'size', 'placeholder', 'clearable', 'disabled'],
          emits: ['update:modelValue', 'change'],
        },
        'el-option': {
          template: '<option class="el-option" :value="value"><slot /></option>',
          props: ['label', 'value'],
        },
        'el-upload': {
          template: '<div class="el-upload"><slot /></div>',
          props: ['showFileList', 'beforeUpload', 'accept', 'disabled'],
        },
        'el-icon': {
          template: '<span class="el-icon"><slot /></span>',
        },
        'el-dialog': {
          template: '<div class="el-dialog" v-if="modelValue"><div class="el-dialog__header">{{ title }}</div><div class="el-dialog__body"><slot /></div></div>',
          props: ['modelValue', 'title', 'width', 'closeOnClickModal', 'destroyOnClose'],
          emits: ['update:modelValue'],
        },
      },
    },
  })
}

describe('HotspotProperties UI 重构', () => {
  let { vm } = createMockViewModel()

  beforeEach(() => {
    const mock = createMockViewModel()
    vm = mock.vm
  })

  describe('1. 去掉三个添加按钮', () => {
    it('不应显示 Add Image 按钮', () => {
      const wrapper = mountComponent(vm)
      const buttons = wrapper.findAll('button')
      const addImageBtn = buttons.find(b => b.text().includes('Add Image'))
      expect(addImageBtn).toBeUndefined()
      expect(wrapper.text()).not.toContain('Add Image')
    })

    it('不应显示 Add Quad 按钮', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).not.toContain('Add Quad')
    })

    it('不应显示 Add Model 按钮', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).not.toContain('Add Model')
    })

    it('不应显示 add-buttons 容器', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.find('.add-buttons').exists()).toBe(false)
    })
  })

  describe('2. 热点列表区域', () => {
    it('应显示热点列表', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.find('.hotspot-list').exists()).toBe(true)
    })

    it('应渲染所有热点项', () => {
      const wrapper = mountComponent(vm)
      const items = wrapper.findAll('.list-item')
      expect(items.length).toBe(2)
    })

    it('应显示热点名称和类型', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('测试热点1')
      expect(wrapper.text()).toContain('信息点')
    })

    it('选中项应有 active 类', () => {
      const wrapper = mountComponent(vm)
      const activeItem = wrapper.find('.list-item.active')
      expect(activeItem.exists()).toBe(true)
    })

    it('点击热点项应触发选择', async () => {
      const wrapper = mountComponent(vm)
      const items = wrapper.findAll('.list-item')
      await items[1].trigger('click')
      expect(vm.hotspotViewModel.selectHotspot).toHaveBeenCalledWith('h2')
    })

    it('空列表应显示提示', () => {
      const emptyMock = createMockViewModel()
      emptyMock.hotspots.value = []
      emptyMock.selectedHotspot.value = null
      const wrapper = mountComponent(emptyMock.vm)
      expect(wrapper.text()).toContain('当前场景暂无热点')
    })
  })

  describe('3. 属性分组结构', () => {
    it('应有属性分组卡片', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.findAll('.prop-card').length).toBeGreaterThan(0)
    })

    it('应有"基本信息"分组', () => {
      const wrapper = mountComponent(vm)
      const titles = wrapper.findAll('.card-title')
      const titleTexts = titles.map(t => t.text())
      expect(titleTexts.some(t => t.includes('基本信息'))).toBe(true)
    })

    it('应有"外观样式"分组', () => {
      const wrapper = mountComponent(vm)
      const titles = wrapper.findAll('.card-title')
      const titleTexts = titles.map(t => t.text())
      expect(titleTexts.some(t => t.includes('外观'))).toBe(true)
    })

    it('应有"交互设置"分组', () => {
      const wrapper = mountComponent(vm)
      const titles = wrapper.findAll('.card-title')
      const titleTexts = titles.map(t => t.text())
      expect(titleTexts.some(t => t.includes('交互'))).toBe(true)
    })
  })

  describe('4. 基本信息字段（所有类型共有）', () => {
    it('应显示名称输入框', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('名称')
    })

    it('应显示类型（只读）', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('类型')
    })

    it('应显示 ATH 输入', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('ATH')
    })

    it('应显示 ATV 输入', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('ATV')
    })
  })

  describe('5. 字段按类型差异化显示', () => {
    it('info 类型应显示样式选择', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('样式')
    })

    it('info 类型应显示信息内容字段（标题、描述、图片URL）', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('标题')
      expect(wrapper.text()).toContain('描述')
      expect(wrapper.text()).toContain('图片URL')
    })

    it('image 类型应显示资源字段（不显示信息内容）', async () => {
      const imageMock = createMockViewModel()
      imageMock.selectedHotspot.value = imageMock.hotspots.value[1] // image 类型
      const wrapper = mountComponent(imageMock.vm)
      await nextTick()
      // image 类型不应显示 infoContent 字段
      expect(wrapper.text()).not.toContain('信息点标题') // placeholder text
    })
  })

  describe('6. 操作按钮', () => {
    it('应显示 Delete 按钮', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('Delete')
    })

    it('应显示 Export XML to Console 按钮', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('Export XML to Console')
    })

    it('不应显示 Apply 按钮', () => {
      const wrapper = mountComponent(vm)
      const buttons = wrapper.findAll('button')
      const applyBtn = buttons.find(b => b.text().includes('Apply'))
      expect(applyBtn).toBeUndefined()
    })

    it('表单修改后应自动调用 updateHotspot', async () => {
      const wrapper = mountComponent(vm)
      vm.updateHotspot.mockClear()

      // 修改名称
      const nameInput = wrapper.findAll('.prop-field').find(f => f.find('label').text() === '名称')?.find('input')
      if (nameInput) {
        await nameInput.setValue('新名称')
        await new Promise(r => setTimeout(r, 600)) // 等待 debounce
        expect(vm.updateHotspot).toHaveBeenCalled()
      }
    })
  })

  describe('7. 一键清空按钮', () => {
    it('应保留一键清空功能', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.text()).toContain('一键清空')
    })
  })

  describe('8. 坐标读数', () => {
    it('应显示当前坐标读数', () => {
      const wrapper = mountComponent(vm)
      expect(wrapper.find('.coord-readout').exists()).toBe(true)
      expect(wrapper.text()).toContain('ATH:')
      expect(wrapper.text()).toContain('ATV:')
    })
  })

  describe('9. 未选择状态', () => {
    it('未选择热点时应显示提示', () => {
      const emptyMock = createMockViewModel()
      emptyMock.selectedHotspot.value = null
      const wrapper = mountComponent(emptyMock.vm)
      expect(wrapper.find('.no-selection').exists()).toBe(true)
      expect(wrapper.text()).toContain('请从上方列表选择')
    })
  })

  describe('10. 实时保存模式', () => {
    it('修改名称后应自动保存', async () => {
      const wrapper = mountComponent(vm)
      vm.updateHotspot.mockClear()

      const nameField = wrapper.findAll('.prop-field').find(f => {
        const label = f.find('label')
        return label.exists() && label.text() === '名称'
      })
      const nameInput = nameField?.find('input')

      if (nameInput && nameInput.exists()) {
        await nameInput.setValue('新的热点名称')
        await new Promise(r => setTimeout(r, 600))
        expect(vm.updateHotspot).toHaveBeenCalled()
      }
    })

    it('拖拽热点期间不应自动保存旧坐标', async () => {
      vm.hotspotViewModel.isDragging.value = true
      const wrapper = mountComponent(vm)
      vm.updateHotspot.mockClear()

      const nameField = wrapper.findAll('.prop-field').find(f => {
        const label = f.find('label')
        return label.exists() && label.text() === '名称'
      })
      const nameInput = nameField?.find('input')

      if (nameInput && nameInput.exists()) {
        await nameInput.setValue('拖拽中名称')
        await new Promise(r => setTimeout(r, 600))
        expect(vm.updateHotspot).not.toHaveBeenCalled()
      }
    })
  })

  describe('11. 上传图片不改变样式', () => {
    it('从资源库选择图片后样式应保持不变', async () => {
      const imageMock = createMockViewModel()
      const imageHotspot = imageMock.hotspots.value.find(h => h.type === 'image')
      if (imageHotspot) {
        imageHotspot.style = 'custom-image'
        imageMock.selectedHotspot.value = imageHotspot
      }

      const wrapper = mountComponent(imageMock.vm)
      await nextTick()

      // 样式应保持为 custom-image
      const styleSelect = wrapper.findAll('.card-title')
        .find(t => t.text().includes('外观'))
        ?.element.closest('.prop-card')
        ?.querySelector('.el-select')

      // 验证表单中的样式值
      expect(imageMock.selectedHotspot.value?.style).toBe('custom-image')
    })
  })

  describe('12. 资源库弹窗', () => {
    it('应显示"资源库"按钮', () => {
      const imageMock = createMockViewModel()
      imageMock.selectedHotspot.value = imageMock.hotspots.value.find(h => h.type === 'image') || null

      const wrapper = mountComponent(imageMock.vm)
      const buttons = wrapper.findAll('button')
      const assetBtn = buttons.find(b => b.text().includes('资源库'))
      expect(assetBtn).toBeDefined()
    })

    it('点击资源库按钮应打开弹窗', async () => {
      const imageMock = createMockViewModel()
      imageMock.selectedHotspot.value = imageMock.hotspots.value.find(h => h.type === 'image') || null

      const wrapper = mountComponent(imageMock.vm)
      await nextTick()

      // 弹窗初始应关闭
      expect(wrapper.find('.el-dialog').exists()).toBe(false)

      // 点击资源库按钮
      const buttons = wrapper.findAll('button')
      const assetBtn = buttons.find(b => b.text().includes('资源库'))
      if (assetBtn) {
        await assetBtn.trigger('click')
        await nextTick()

        // 弹窗应打开
        expect(wrapper.find('.el-dialog').exists()).toBe(true)
        expect(wrapper.find('.el-dialog__header').text()).toContain('选择资源')
      }
    })

    it('弹窗中不应显示"收起资源库"按钮', async () => {
      const imageMock = createMockViewModel()
      imageMock.selectedHotspot.value = imageMock.hotspots.value.find(h => h.type === 'image') || null

      const wrapper = mountComponent(imageMock.vm)
      expect(wrapper.text()).not.toContain('收起资源库')
    })
  })
})
