import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import PostProcessingPanel from '@/components/PostProcessingPanel.vue'
import type { PostProcessing } from '@/types'

// --- Mock stores (hoisted reactive objects to avoid cross-test leak) ---
const { mockSceneStore, mockEditorStore } = vi.hoisted(() => {
  const { reactive } = require('vue') as typeof import('vue')
  return {
    mockSceneStore: reactive({
      currentScene: { id: 'scene-1' } as { id: string } | null,
    }),
    mockEditorStore: reactive({
      markDirty: vi.fn(),
      setRightPanelSection: vi.fn(),
    }),
  }
})

vi.mock('@/stores/scene', () => ({
  useSceneStore: () => mockSceneStore,
}))
vi.mock('@/stores/editor', () => ({
  useEditorStore: () => mockEditorStore,
}))

// --- Mock API ---
const mockGetPostProcessing = vi.fn()
const mockUpdatePostProcessing = vi.fn()
const mockGetPresets = vi.fn()

vi.mock('@/api/postprocessing', () => ({
  getPostProcessing: (...args: unknown[]) => mockGetPostProcessing(...args),
  updatePostProcessing: (...args: unknown[]) => mockUpdatePostProcessing(...args),
  getPresets: (...args: unknown[]) => mockGetPresets(...args),
}))

// --- Stubs ---
const stubs = {
  'el-slider': {
    template: '<input type="range" :value="modelValue" @input="$emit(\'update:modelValue\', parseFloat($event.target.value))" @change="$emit(\'change\')" />',
    props: ['modelValue', 'min', 'max', 'step', 'size'],
    emits: ['update:modelValue', 'change'],
  },
  'el-select': {
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
    props: ['modelValue', 'size', 'placeholder', 'clearable'],
    emits: ['update:modelValue', 'change'],
  },
  'el-option': { template: '<option :value="value"><slot /></option>', props: ['label', 'value'] },
  'el-button': { template: '<button v-bind="$attrs"><slot /></button>', inheritAttrs: false },
  'el-switch': {
    template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked); $emit(\'change\', $event.target.checked)" />',
    props: ['modelValue'],
    emits: ['update:modelValue', 'change'],
  },
  'el-icon': { template: '<span><slot /></span>' },
}

function makeConfig(overrides: Partial<PostProcessing> = {}): PostProcessing {
  return {
    id: 'pp-1',
    sceneId: 'scene-1',
    presetStyle: 'original',
    lutResourceId: '',
    toneMapping: 'none',
    exposure: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    colorTemperature: 0,
    bloomStrength: 0,
    bloomThreshold: 0.8,
    enabled: true,
    ...overrides,
  }
}

let wrapper: ReturnType<typeof mount> | null = null

function mountPanel() {
  wrapper = mount(PostProcessingPanel, { global: { stubs } })
  return wrapper
}

describe('PostProcessingPanel — 重写匹配API契约', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockSceneStore.currentScene = { id: 'scene-1' }
    mockGetPostProcessing.mockResolvedValue({ data: { data: makeConfig() } })
    mockUpdatePostProcessing.mockResolvedValue({ data: { data: makeConfig() } })
    mockGetPresets.mockResolvedValue({ data: { data: [] } })
  })
  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    vi.useRealTimers()
  })

  it('从API加载正确字段并初始化表单', async () => {
    const config = makeConfig({ exposure: 1.5, bloomStrength: 0.3, toneMapping: 'ACES' })
    mockGetPostProcessing.mockResolvedValue({ data: { data: config } })
    const wrapper = mountPanel()
    await flushPromises()

    expect(mockGetPostProcessing).toHaveBeenCalledWith('scene-1')
    // exposure 滑块
    const exposureSlider = wrapper.find('[data-testid="exposure-slider"]')
    expect(exposureSlider.exists()).toBe(true)
    expect(exposureSlider.attributes('value')).toBe('1.5')
    // bloomStrength 滑块
    const bloomSlider = wrapper.find('[data-testid="bloom-strength-slider"]')
    expect(bloomSlider.exists()).toBe(true)
    expect(bloomSlider.attributes('value')).toBe('0.3')
  })

  it('修改 exposure 触发 updatePostProcessing 携带正确字段', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const exposureSlider = wrapper.find('[data-testid="exposure-slider"]')
    await exposureSlider.setValue(1.8)
    await exposureSlider.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdatePostProcessing).toHaveBeenCalled()
    const lastCall = mockUpdatePostProcessing.mock.calls[mockUpdatePostProcessing.mock.calls.length - 1]
    expect(lastCall[0]).toBe('scene-1')
    expect(lastCall[1]).toHaveProperty('exposure')
  })

  it('渲染 bloomStrength 和 bloomThreshold 滑块', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="bloom-strength-slider"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bloom-threshold-slider"]').exists()).toBe(true)
  })

  it('修改 bloomStrength 触发 updatePostProcessing', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const bloomSlider = wrapper.find('[data-testid="bloom-strength-slider"]')
    await bloomSlider.setValue(0.5)
    await bloomSlider.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdatePostProcessing).toHaveBeenCalled()
    const lastCall = mockUpdatePostProcessing.mock.calls[mockUpdatePostProcessing.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('bloomStrength')
  })

  it('渲染 toneMapping 选择器', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const tmSelect = wrapper.find('[data-testid="tone-mapping-select"]')
    expect(tmSelect.exists()).toBe(true)
  })

  it('修改 toneMapping 触发 updatePostProcessing', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const tmSelect = wrapper.find('[data-testid="tone-mapping-select"]')
    await tmSelect.setValue('ACES')
    await tmSelect.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdatePostProcessing).toHaveBeenCalled()
    const lastCall = mockUpdatePostProcessing.mock.calls[mockUpdatePostProcessing.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('toneMapping', 'ACES')
  })

  it('渲染 enabled 开关', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const enabledSwitch = wrapper.find('[data-testid="enabled-switch"]')
    expect(enabledSwitch.exists()).toBe(true)
  })

  it('切换 enabled 触发 updatePostProcessing', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const enabledSwitch = wrapper.find('[data-testid="enabled-switch"]')
    await enabledSwitch.setValue(false)
    await enabledSwitch.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdatePostProcessing).toHaveBeenCalled()
    const lastCall = mockUpdatePostProcessing.mock.calls[mockUpdatePostProcessing.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('enabled', false)
  })

  it('渲染 contrast/saturation/colorTemperature 滑块（API正确字段）', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="contrast-slider"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="saturation-slider"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="color-temperature-slider"]').exists()).toBe(true)
  })

  it('不渲染已废弃的 brightness/hue/blur/grayscale/sepia 字段', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="brightness-slider"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="hue-slider"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="blur-slider"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="grayscale-slider"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sepia-slider"]').exists()).toBe(false)
  })

  it('重置按钮恢复默认值并触发更新', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const resetBtn = wrapper.find('[data-testid="reset-btn"]')
    expect(resetBtn.exists()).toBe(true)
    await resetBtn.trigger('click')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdatePostProcessing).toHaveBeenCalled()
  })

  it('无当前场景时不调用API', async () => {
    mockSceneStore.currentScene = null
    const wrapper = mountPanel()
    await flushPromises()

    expect(mockGetPostProcessing).not.toHaveBeenCalled()
  })
})
