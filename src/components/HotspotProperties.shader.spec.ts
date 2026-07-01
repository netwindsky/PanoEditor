import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import HotspotProperties from '@/components/HotspotProperties.vue'
import type { Hotspot, Scene, Resource } from '@/types'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))

function createMockViewModel() {
  const hotspots = ref<Hotspot[]>([
    {
      id: 'h1',
      sceneId: 's1',
      name: '图片热点',
      type: 'image',
      ath: 45,
      atv: 10,
      url: 'https://example.com/image.jpg',
      shader: 'grayscale',
    },
  ])
  const selectedHotspot = ref<Hotspot | null>(hotspots.value[0])
  const scenes = ref<Scene[]>([
    { id: 's1', projectId: 'p1', name: '场景1', previewUrl: '', thumbUrl: '', imageConfig: '', status: '', initialView: { hfov: 120, pitch: 0, yaw: 0 }, sortOrder: 0, createdAt: '', updatedAt: '' },
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
    currentProject: ref({ id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' }),
    addHotspot: vi.fn(),
    removeHotspot: vi.fn(),
    clearAllHotspots: vi.fn(),
    updateHotspot: vi.fn(async (hotspotId: string, params: Record<string, unknown>) => {
      const index = hotspots.value.findIndex((h) => h.id === hotspotId)
      if (index !== -1) {
        hotspots.value[index] = { ...hotspots.value[index], ...params } as Hotspot
        if (selectedHotspot.value?.id === hotspotId) {
          selectedHotspot.value = hotspots.value[index]
        }
      }
    }),
    uploadResource: vi.fn(),
  }

  return { vm, hotspots, selectedHotspot }
}

const stubs = {
  'el-button': {
    template: '<button class="el-button" v-bind="$attrs"><slot /></button>',
    inheritAttrs: false,
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
  'el-icon': { template: '<span><slot /></span>' },
  'el-dialog': {
    template: '<div class="el-dialog" v-if="modelValue"><slot /></div>',
    props: ['modelValue', 'title', 'width'],
  },
  'el-alert': { template: '<div class="el-alert" />', props: ['title', 'type', 'closable'] },
}

function mountComponent(vm: any) {
  return mount(HotspotProperties, {
    global: { provide: { editorViewModel: vm }, stubs },
  })
}

describe('HotspotProperties — shader 选择器', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 hotspot.shader 初始化 shader 选择器', async () => {
    const { vm } = createMockViewModel()
    const wrapper = mountComponent(vm)
    await flushPromises()

    // 找到 shader 选择器（在"外观样式"卡片中，data-testid="shader-select"）
    const shaderSelect = wrapper.find('[data-testid="shader-select"]')
    expect(shaderSelect.exists()).toBe(true)
    expect(shaderSelect.element.value).toBe('grayscale')
  })

  it('shader 下拉框包含无/灰度/反色/棕褐色等选项', async () => {
    const { vm } = createMockViewModel()
    const wrapper = mountComponent(vm)
    await flushPromises()

    const shaderSelect = wrapper.find('[data-testid="shader-select"]')
    const options = shaderSelect.findAll('option')
    const optionValues = options.map((o) => o.element.value)

    expect(optionValues).toContain('')            // 无
    expect(optionValues).toContain('grayscale')   // 灰度
    expect(optionValues).toContain('invert')      // 反色
    expect(optionValues).toContain('sepia')       // 棕褐色
    expect(optionValues).toContain('blur')        // 模糊
  })

  it('修改 shader 后触发 updateHotspot 携带 shader', async () => {
    const { vm } = createMockViewModel()
    const wrapper = mountComponent(vm)
    await flushPromises()

    const shaderSelect = wrapper.find('[data-testid="shader-select"]')
    await shaderSelect.setValue('sepia')

    // 推进防抖（HotspotProperties 用 500ms 防抖）
    vi.advanceTimersByTime(500)
    await flushPromises()

    expect(vm.updateHotspot).toHaveBeenCalled()
    const lastCall = vm.updateHotspot.mock.calls[vm.updateHotspot.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('shader', 'sepia')
  })

  it('hotspot 无 shader 时选择器默认为空', async () => {
    const { vm, hotspots } = createMockViewModel()
    hotspots.value[0].shader = undefined
    const wrapper = mountComponent(vm)
    await flushPromises()

    const shaderSelect = wrapper.find('[data-testid="shader-select"]')
    expect(shaderSelect.element.value).toBe('')
  })

  it('清空 shader（选"无"）后触发 updateHotspot 携带 shader=""', async () => {
    const { vm } = createMockViewModel()
    const wrapper = mountComponent(vm)
    await flushPromises()

    // 当前 shader 为 'grayscale'
    const shaderSelect = wrapper.find('[data-testid="shader-select"]')
    expect(shaderSelect.element.value).toBe('grayscale')

    // 选"无"（value=""）
    await shaderSelect.setValue('')

    // 推进防抖
    vi.advanceTimersByTime(500)
    await flushPromises()

    // 验证 updateHotspot 收到了 shader: ""（而不是 undefined）
    expect(vm.updateHotspot).toHaveBeenCalled()
    const lastCall = vm.updateHotspot.mock.calls[vm.updateHotspot.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('shader', '')
    // 重点验证: '' 没有被 || undefined 吞掉
    expect(lastCall[1].shader).toBe('')
  })
})
