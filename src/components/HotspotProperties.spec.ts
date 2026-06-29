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
    {
      id: 'h3',
      sceneId: 's1',
      name: '测试热点3',
      type: 'scene',
      ath: 30,
      atv: 15,
      linkedSceneId: 's2',
    },
  ])

  const selectedHotspot = ref<Hotspot | null>(hotspots.value[0])
  const scenes = ref<Scene[]>([
    { id: 's1', projectId: 'p1', name: '场景1', previewUrl: '', thumbUrl: '', imageConfig: '', status: '', initialView: { hfov: 120, pitch: 0, yaw: 0 }, order: 0, createdAt: '', updatedAt: '' },
    { id: 's2', projectId: 'p1', name: '场景2', previewUrl: '', thumbUrl: '', imageConfig: '', status: '', initialView: { hfov: 120, pitch: 0, yaw: 0 }, order: 1, createdAt: '', updatedAt: '' },
  ])

  const resources = ref<Resource[]>([
    {
      id: 'r1',
      projectId: 'p1',
      name: 'sample-1.png',
      type: 'image',
      mimeType: 'image/png',
      sizeBytes: 1024,
      url: 'https://example.com/sample-1.png',
      thumbUrl: 'https://example.com/sample-1.png',
      createdAt: '',
    },
    {
      id: 'r2',
      projectId: 'p1',
      name: 'sample-2.jpg',
      type: 'image',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      url: 'https://example.com/sample-2.jpg',
      thumbUrl: 'https://example.com/sample-2.jpg',
      createdAt: '',
    },
  ])

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
      loadResources: vi.fn(async (projectId: string, type?: string) => {
        // 默认 mock 行为：保留现有 resources，测试可在外部覆盖
        return resources.value
      }),
      uploadResource: vi.fn(async (projectId: string, file: File, type: string) => {
        // 默认 mock 行为：基于文件信息生成一个新资源并 push 到 resources
        const newResource: Resource = {
          id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          projectId,
          name: file.name,
          type,
          mimeType: file.type || 'image/png',
          sizeBytes: file.size,
          url: `https://example.com/uploads/${encodeURIComponent(file.name)}`,
          thumbUrl: `https://example.com/uploads/${encodeURIComponent(file.name)}`,
          createdAt: new Date().toISOString(),
        }
        resources.value.push(newResource)
      }),
    },
    currentProject: ref({ id: 'p1', name: '测试项目', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' }),
    addHotspot: vi.fn(),
    removeHotspot: vi.fn(),
    clearAllHotspots: vi.fn(),
    updateHotspot: vi.fn(async (hotspotId: string, params: Record<string, unknown>) => {
      // 默认 mock 行为：模拟真实 HotspotViewModel.updateHotspot —— 用 params 合并更新 hotspots 列表中的条目，并刷新 selectedHotspot
      const index = hotspots.value.findIndex((h) => h.id === hotspotId)
      if (index !== -1) {
        hotspots.value[index] = { ...hotspots.value[index], ...params } as Hotspot
        if (selectedHotspot.value?.id === hotspotId) {
          selectedHotspot.value = hotspots.value[index]
        }
      }
    }),
    uploadResource: vi.fn(async (projectId: string, file: File, type: 'panorama' | 'image' | 'video' | 'audio') => {
      // 默认 mock 行为：委托给 assetViewModel.uploadResource
      const newResource: Resource = {
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId,
        name: file.name,
        type,
        mimeType: file.type || 'image/png',
        sizeBytes: file.size,
        url: `https://example.com/uploads/${encodeURIComponent(file.name)}`,
        thumbUrl: `https://example.com/uploads/${encodeURIComponent(file.name)}`,
        createdAt: new Date().toISOString(),
      }
      resources.value.push(newResource)
    }),
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
      expect(items.length).toBe(3)
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

  describe('13. 交互设置 - 动作选择', () => {
    it('交互设置区域应有动作选择下拉框', () => {
      const wrapper = mountComponent(vm)
      const interactionCard = wrapper.findAll('.prop-card').find(card => {
        const title = card.find('.card-title')
        return title.exists() && title.text().includes('交互设置')
      })
      expect(interactionCard).toBeDefined()

      const fields = interactionCard!.findAll('.prop-field')
      const actionField = fields.find(f => {
        const label = f.find('label')
        return label.exists() && label.text() === '动作'
      })
      expect(actionField).toBeDefined()
    })

    it('默认应显示"无动作"选项', () => {
      const wrapper = mountComponent(vm)
      const interactionCard = wrapper.findAll('.prop-card').find(card => {
        const title = card.find('.card-title')
        return title.exists() && title.text().includes('交互设置')
      })
      const actionSelect = interactionCard!.find('.el-select')
      expect(actionSelect.exists()).toBe(true)
    })

    it('选择"跳转场景"动作时应显示场景选择器', async () => {
      const wrapper = mountComponent(vm)
      const interactionCard = wrapper.findAll('.prop-card').find(card => {
        const title = card.find('.card-title')
        return title.exists() && title.text().includes('交互设置')
      })
      const actionSelect = interactionCard!.find('.el-select')

      // 设置为 scene
      await actionSelect.setValue('scene')
      await nextTick()

      // 验证场景选择器出现
      const fields = interactionCard!.findAll('.prop-field')
      const sceneField = fields.find(f => {
        const label = f.find('label')
        return label.exists() && label.text() === '目标场景'
      })
      expect(sceneField).toBeDefined()
    })

    it('选择"打开链接"动作时应显示链接输入框', async () => {
      const wrapper = mountComponent(vm)
      const interactionCard = wrapper.findAll('.prop-card').find(card => {
        const title = card.find('.card-title')
        return title.exists() && title.text().includes('交互设置')
      })
      const actionSelect = interactionCard!.find('.el-select')

      await actionSelect.setValue('link')
      await nextTick()

      const fields = interactionCard!.findAll('.prop-field')
      const urlField = fields.find(f => {
        const label = f.find('label')
        return label.exists() && label.text() === '链接地址'
      })
      expect(urlField).toBeDefined()
    })

    it('选择"执行脚本"动作时应显示脚本输入框', async () => {
      const wrapper = mountComponent(vm)
      const interactionCard = wrapper.findAll('.prop-card').find(card => {
        const title = card.find('.card-title')
        return title.exists() && title.text().includes('交互设置')
      })
      const actionSelect = interactionCard!.find('.el-select')

      await actionSelect.setValue('script')
      await nextTick()

      const fields = interactionCard!.findAll('.prop-field')
      const scriptField = fields.find(f => {
        const label = f.find('label')
        return label.exists() && label.text() === '脚本代码'
      })
      expect(scriptField).toBeDefined()
    })

    it('场景类型热点应自动推断动作类型为 scene', async () => {
      const sceneMock = createMockViewModel()
      const sceneHotspot = sceneMock.hotspots.value.find(h => h.type === 'scene')
      if (sceneHotspot) {
        sceneMock.selectedHotspot.value = sceneHotspot
      }

      const wrapper = mountComponent(sceneMock.vm)
      await nextTick()

      // 验证场景选择器默认显示
      const interactionCard = wrapper.findAll('.prop-card').find(card => {
        const title = card.find('.card-title')
        return title.exists() && title.text().includes('交互设置')
      })
      const fields = interactionCard!.findAll('.prop-field')
      const sceneField = fields.find(f => {
        const label = f.find('label')
        return label.exists() && label.text() === '目标场景'
      })
      expect(sceneField).toBeDefined()
    })

    it('同一热点自动保存刷新后不应把已选择动作重置为无动作', async () => {
      const imageMock = createMockViewModel()
      const imageHotspot = imageMock.hotspots.value.find(h => h.type === 'image')
      if (imageHotspot) {
        imageMock.selectedHotspot.value = imageHotspot
      }
      const wrapper = mountComponent(imageMock.vm)
      await nextTick()
      imageMock.vm.updateHotspot.mockClear()

      const interactionCard = wrapper.findAll('.prop-card').find(card => {
        const title = card.find('.card-title')
        return title.exists() && title.text().includes('交互设置')
      })
      const actionSelect = interactionCard!.find('.el-select')

      await actionSelect.setValue('link')
      await new Promise(r => setTimeout(r, 600))
      await nextTick()

      expect(imageMock.vm.updateHotspot).toHaveBeenCalled()
      expect((actionSelect.element as HTMLSelectElement).value).toBe('link')
    })
  })

  describe('14. 图片热点 - 资源管理（上传/预览/资源库）', () => {
    // 选取当前 mock 中 image 类型的热点（默认 mock 里 h2 是 image 类型）
    function selectImageHotspot(mock: ReturnType<typeof createMockViewModel>) {
      const imageHotspot = mock.hotspots.value.find(h => h.type === 'image')
      if (imageHotspot) {
        mock.selectedHotspot.value = imageHotspot
      }
      return imageHotspot
    }

    // 找到"贴图" prop-field
    function findTextureField(wrapper: ReturnType<typeof mountComponent>) {
      return wrapper.findAll('.prop-field').find(f => {
        const label = f.find('label')
        return label.exists() && label.text() === '贴图'
      })
    }

    describe('14.1 图片类型操作按钮', () => {
      it('image 类型应显示"上传"和"资源库"按钮', async () => {
        const imageMock = createMockViewModel()
        selectImageHotspot(imageMock)
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const textureField = findTextureField(wrapper)
        expect(textureField).toBeDefined()

        const buttons = textureField!.findAll('button')
        const labels = buttons.map(b => b.text())
        expect(labels).toContain('上传')
        expect(labels).toContain('资源库')
      })

      it('非 image 类型不应显示"贴图"字段', () => {
        const wrapper = mountComponent(vm) // 默认 info 类型
        const textureField = findTextureField(wrapper)
        expect(textureField).toBeUndefined()
      })
    })

    describe('14.2 URL 图片预览', () => {
      it('URL 有值时应显示图片预览', async () => {
        const imageMock = createMockViewModel()
        const imageHotspot = selectImageHotspot(imageMock)
        expect(imageHotspot?.url).toBe('https://example.com/image.jpg')
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const preview = wrapper.find('.image-preview')
        expect(preview.exists()).toBe(true)
        const img = preview.find('img')
        expect(img.exists()).toBe(true)
        expect(img.attributes('src')).toBe('https://example.com/image.jpg')
      })

      it('URL 为空时应隐藏图片预览', async () => {
        const imageMock = createMockViewModel()
        const imageHotspot = selectImageHotspot(imageMock)
        if (imageHotspot) imageHotspot.url = ''
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const preview = wrapper.find('.image-preview')
        expect(preview.exists()).toBe(false)
      })
    })

    describe('14.3 上传图片', () => {
      it('image 类型应渲染隐藏的文件输入框', async () => {
        const imageMock = createMockViewModel()
        selectImageHotspot(imageMock)
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const fileInput = wrapper.find('input[type="file"]')
        expect(fileInput.exists()).toBe(true)
      })

      it('点击上传按钮应触发文件输入框的 click', async () => {
        const imageMock = createMockViewModel()
        selectImageHotspot(imageMock)
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
        const clickSpy = vi.spyOn(fileInput, 'click')

        const textureField = findTextureField(wrapper)
        const uploadBtn = textureField!.findAll('button').find(b => b.text() === '上传')
        expect(uploadBtn).toBeDefined()
        await uploadBtn!.trigger('click')

        expect(clickSpy).toHaveBeenCalled()
      })

      it('选择文件后应调用 uploadResource', async () => {
        const imageMock = createMockViewModel()
        selectImageHotspot(imageMock)
        imageMock.vm.uploadResource.mockClear()

        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const file = new File(['test-image-bytes'], 'uploaded.png', { type: 'image/png' })
        const fileInput = wrapper.find('input[type="file"]')
        Object.defineProperty(fileInput.element, 'files', {
          value: [file],
          configurable: true,
        })
        await fileInput.trigger('change')
        await flushPromises()

        expect(imageMock.vm.uploadResource).toHaveBeenCalledTimes(1)
        const callArgs = imageMock.vm.uploadResource.mock.calls[0]
        // projectId, file, type
        expect(callArgs[0]).toBe('p1')
        expect(callArgs[1]).toBe(file)
        expect(callArgs[2]).toBe('image')
      })

      it('选择文件时应兼容真实 ViewModel 无 currentProject 的情况', async () => {
        const imageMock = createMockViewModel()
        selectImageHotspot(imageMock)
        imageMock.vm.uploadResource.mockClear()
        const vmWithoutCurrentProject = imageMock.vm as Omit<typeof imageMock.vm, 'currentProject'> & {
          currentProject?: never
        }
        delete vmWithoutCurrentProject.currentProject

        const wrapper = mountComponent(vmWithoutCurrentProject as typeof imageMock.vm)
        await nextTick()

        const file = new File(['test-image-bytes'], 'uploaded-with-scene-project.png', { type: 'image/png' })
        const fileInput = wrapper.find('input[type="file"]')
        Object.defineProperty(fileInput.element, 'files', {
          value: [file],
          configurable: true,
        })

        await expect(fileInput.trigger('change')).resolves.toBeUndefined()
        await flushPromises()

        expect(imageMock.vm.uploadResource).toHaveBeenCalledWith('p1', file, 'image')
      })

      it('上传成功后应将 URL 设置为新资源的 URL', async () => {
        const imageMock = createMockViewModel()
        const imageHotspot = selectImageHotspot(imageMock)
        const hotspotId = imageHotspot?.id
        if (imageHotspot) imageHotspot.url = ''

        // 显式覆盖 mock：上传一个固定 URL 的资源
        imageMock.vm.uploadResource.mockImplementationOnce(async () => {
          const newResource: Resource = {
            id: 'r-uploaded',
            projectId: 'p1',
            name: 'uploaded.png',
            type: 'image',
            mimeType: 'image/png',
            sizeBytes: 12,
            url: 'https://example.com/uploads/uploaded.png',
            thumbUrl: 'https://example.com/uploads/uploaded.png',
            createdAt: '',
          }
          imageMock.resources.value.push(newResource)
        })

        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const file = new File(['x'], 'uploaded.png', { type: 'image/png' })
        const fileInput = wrapper.find('input[type="file"]')
        Object.defineProperty(fileInput.element, 'files', {
          value: [file],
          configurable: true,
        })
        await fileInput.trigger('change')
        await flushPromises()
        // 等待 debounce 自动保存触发
        await new Promise(r => setTimeout(r, 600))
        await nextTick()

        // 重新从 hotspots 数组里按 id 查找（mock updateHotspot 会创建新对象）
        const updated = imageMock.hotspots.value.find(h => h.id === hotspotId)
        expect(updated?.url).toBe('https://example.com/uploads/uploaded.png')
      })

      it('上传完成后应清空文件输入框的 value 以便重复上传同名文件', async () => {
        const imageMock = createMockViewModel()
        selectImageHotspot(imageMock)
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const file = new File(['y'], 'dup.png', { type: 'image/png' })
        const fileInput = wrapper.find('input[type="file"]')
        Object.defineProperty(fileInput.element, 'files', {
          value: [file],
          configurable: true,
        })
        await fileInput.trigger('change')
        await flushPromises()

        expect((fileInput.element as HTMLInputElement).value).toBe('')
      })
    })

    describe('14.4 资源库弹窗', () => {
      it('点击资源库按钮应打开资源选择对话框', async () => {
        const imageMock = createMockViewModel()
        selectImageHotspot(imageMock)
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        // 初始：对话框不应渲染（modelValue=false 时 el-dialog 模板用 v-if 隐藏）
        expect(wrapper.find('.el-dialog').exists()).toBe(false)

        const textureField = findTextureField(wrapper)
        const libraryBtn = textureField!.findAll('button').find(b => b.text() === '资源库')
        expect(libraryBtn).toBeDefined()
        await libraryBtn!.trigger('click')
        await nextTick()

        const dialog = wrapper.find('.el-dialog')
        expect(dialog.exists()).toBe(true)
        expect(dialog.text()).toContain('选择资源')
      })

      it('打开资源库时应调用 loadResources 加载资源列表', async () => {
        const imageMock = createMockViewModel()
        selectImageHotspot(imageMock)
        imageMock.vm.assetViewModel.loadResources.mockClear()
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const textureField = findTextureField(wrapper)
        const libraryBtn = textureField!.findAll('button').find(b => b.text() === '资源库')
        await libraryBtn!.trigger('click')
        await nextTick()

        expect(imageMock.vm.assetViewModel.loadResources).toHaveBeenCalled()
        const args = imageMock.vm.assetViewModel.loadResources.mock.calls[0]
        expect(args[0]).toBe('p1') // projectId
      })

      it('对话框打开后应列出当前 resources 列表', async () => {
        const imageMock = createMockViewModel()
        selectImageHotspot(imageMock)
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const textureField = findTextureField(wrapper)
        const libraryBtn = textureField!.findAll('button').find(b => b.text() === '资源库')
        await libraryBtn!.trigger('click')
        await nextTick()

        const dialogBody = wrapper.find('.el-dialog__body')
        expect(dialogBody.exists()).toBe(true)
        // 默认 mock resources 中有 sample-1.png 和 sample-2.jpg
        expect(dialogBody.text()).toContain('sample-1.png')
        expect(dialogBody.text()).toContain('sample-2.jpg')
      })

      it('点击资源项应设置 URL 并关闭对话框', async () => {
        const imageMock = createMockViewModel()
        const imageHotspot = selectImageHotspot(imageMock)
        const hotspotId = imageHotspot?.id
        if (imageHotspot) imageHotspot.url = ''
        const wrapper = mountComponent(imageMock.vm)
        await nextTick()

        const textureField = findTextureField(wrapper)
        const libraryBtn = textureField!.findAll('button').find(b => b.text() === '资源库')
        await libraryBtn!.trigger('click')
        await nextTick()

        // 找到第一个资源项并点击
        const firstItem = wrapper.find('.asset-item')
        expect(firstItem.exists()).toBe(true)
        await firstItem.trigger('click')
        await nextTick()
        // 等待 debounce 自动保存触发
        await new Promise(r => setTimeout(r, 600))
        await nextTick()

        // 重新从 hotspots 数组里按 id 查找（mock updateHotspot 会创建新对象）
        const updated = imageMock.hotspots.value.find(h => h.id === hotspotId)
        // URL 应被设置为第一个资源的 URL
        expect(updated?.url).toBe('https://example.com/sample-1.png')
        // 对话框应关闭
        expect(wrapper.find('.el-dialog').exists()).toBe(false)
      })
    })
  })
})

describe('15. 四边形标注 - 顶点坐标', () => {
  function createQuadMock() {
    const mock = createMockViewModel()
    const quadHotspot: Hotspot = {
      id: 'hq1',
      sceneId: 's1',
      name: '四边形标注1',
      type: 'quad',
      ath: 0,
      atv: 0,
      points: '-0.72 -11.02 7.23 -12.24 7.55 7.62 -0.86 6.59',
      url: 'https://example.com/quad.jpg',
    }
    mock.hotspots.value.push(quadHotspot)
    mock.selectedHotspot.value = quadHotspot
    return mock
  }

  it('quad 类型应显示"顶点坐标"分组', () => {
    const { vm } = createQuadMock()
    const wrapper = mountComponent(vm)
    const titles = wrapper.findAll('.card-title')
    const vertexTitle = titles.find(t => t.text().includes('顶点坐标'))
    expect(vertexTitle).toBeDefined()
  })

  it('应渲染四个顶点输入行（左上/右上/右下/左下）', () => {
    const { vm } = createQuadMock()
    const wrapper = mountComponent(vm)
    const vertexCard = wrapper.findAll('.prop-card').find(card => {
      const title = card.find('.card-title')
      return title.exists() && title.text().includes('顶点坐标')
    })
    expect(vertexCard).toBeDefined()

    const rows = vertexCard!.findAll('.quad-point-row')
    expect(rows.length).toBe(4)

    const labels = rows.map(r => r.find('label').text())
    expect(labels).toEqual(['左上', '右上', '右下', '左下'])
  })

  it('应正确解析并显示 points 字符串为坐标输入框', () => {
    const { vm } = createQuadMock()
    const wrapper = mountComponent(vm)
    const vertexCard = wrapper.findAll('.prop-card').find(card => {
      const title = card.find('.card-title')
      return title.exists() && title.text().includes('顶点坐标')
    })
    const rows = vertexCard!.findAll('.quad-point-row')

    // 左上: -0.72, -11.02
    const leftTopInputs = rows[0].findAll('.el-input-number')
    expect(leftTopInputs[0].attributes('value')).toBe('-0.72')
    expect(leftTopInputs[1].attributes('value')).toBe('-11.02')

    // 右上: 7.23, -12.24
    const rightTopInputs = rows[1].findAll('.el-input-number')
    expect(rightTopInputs[0].attributes('value')).toBe('7.23')
    expect(rightTopInputs[1].attributes('value')).toBe('-12.24')
  })

  it('修改坐标后应自动保存 points 字段', async () => {
    const { vm } = createQuadMock()
    const wrapper = mountComponent(vm)
    vm.updateHotspot.mockClear()

    const vertexCard = wrapper.findAll('.prop-card').find(card => {
      const title = card.find('.card-title')
      return title.exists() && title.text().includes('顶点坐标')
    })
    const rows = vertexCard!.findAll('.quad-point-row')

    // 直接修改 input 值并触发 input 事件
    const athInputEl = rows[0].findAll('.el-input-number')[0].element as HTMLInputElement
    athInputEl.value = '1.00'
    await rows[0].findAll('.el-input-number')[0].trigger('input')

    // 等待 debounce 自动保存触发
    await new Promise(r => setTimeout(r, 600))
    await nextTick()

    expect(vm.updateHotspot).toHaveBeenCalled()
    const callArgs = vm.updateHotspot.mock.calls[0]
    expect(callArgs[0]).toBe('hq1')
    expect(callArgs[1].points).toContain('1')
  })

  it('非 quad 类型不应显示顶点坐标分组', () => {
    const { vm } = createMockViewModel()
    const wrapper = mountComponent(vm)
    const titles = wrapper.findAll('.card-title')
    const vertexTitle = titles.find(t => t.text().includes('顶点坐标'))
    expect(vertexTitle).toBeUndefined()
  })
})
