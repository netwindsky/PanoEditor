import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import PostProcessingPanel from '@/components/PostProcessingPanel.vue'
import type { PostProcessing } from '@/types'

// --- Mock stores ---
const { mockSceneStore, mockEditorStore, mockProjectStore } = vi.hoisted(() => {
  const { reactive, shallowRef } = require('vue') as typeof import('vue')
  return {
    mockSceneStore: reactive({
      currentScene: { id: 'scene-1' } as { id: string } | null,
    }),
    mockEditorStore: reactive({
      markDirty: vi.fn(),
      setRightPanelSection: vi.fn(),
      engineAdapter: shallowRef<{ applyPostConfig: ReturnType<typeof vi.fn> } | null>(null),
    }),
    mockProjectStore: reactive({
      currentProject: { id: 'project-1' } as { id: string } | null,
    }),
  }
})

vi.mock('@/stores/scene', () => ({
  useSceneStore: () => mockSceneStore,
}))
vi.mock('@/stores/editor', () => ({
  useEditorStore: () => mockEditorStore,
}))
vi.mock('@/stores/project', () => ({
  useProjectStore: () => mockProjectStore,
}))

vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
  }
})

// --- Mock API ---
const mockGetPostProcessing = vi.fn()
const mockUpdatePostProcessing = vi.fn()
const mockGetLuts = vi.fn()
const mockUploadLut = vi.fn()

vi.mock('@/api/postprocessing', () => ({
  getPostProcessing: (...args: unknown[]) => mockGetPostProcessing(...args),
  updatePostProcessing: (...args: unknown[]) => mockUpdatePostProcessing(...args),
}))

vi.mock('@/api/lut', () => ({
  getLuts: (...args: unknown[]) => mockGetLuts(...args),
  uploadLut: (...args: unknown[]) => mockUploadLut(...args),
  getLut: vi.fn(),
  deleteLut: vi.fn(),
}))

// --- Stubs ---
const stubs = {
  'el-input-number': {
    template:
      '<input type="number" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', $event.target.value === \'\' ? null : parseFloat($event.target.value))" @change="$emit(\'change\', $event.target.value === \'\' ? null : parseFloat($event.target.value))" />',
    props: ['modelValue', 'min', 'max', 'step', 'precision', 'size', 'controlsPosition'],
    emits: ['update:modelValue', 'change'],
  },
  'el-select': {
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
    props: ['modelValue', 'size', 'placeholder', 'clearable'],
    emits: ['update:modelValue', 'change'],
  },
  'el-option': { template: '<option :value="value"><slot /></option>', props: ['label', 'value'] },
  'el-button': { template: '<button v-bind="$attrs"><slot /></button>', inheritAttrs: false },
  'el-switch': {
    template:
      '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked); $emit(\'change\', $event.target.checked)" />',
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
    lutIntensity: 1,
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

describe('PostProcessingPanel — 重构后：预设 + 数值框 + LUT', () => {
  let mockApplyPostConfig: ReturnType<typeof vi.fn>
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockSceneStore.currentScene = { id: 'scene-1' }
    mockProjectStore.currentProject = { id: 'project-1' }
    mockApplyPostConfig = vi.fn()
    mockEditorStore.engineAdapter = { applyPostConfig: mockApplyPostConfig } as any
    mockGetPostProcessing.mockResolvedValue({ data: { data: makeConfig() } })
    mockUpdatePostProcessing.mockResolvedValue({ data: { data: makeConfig() } })
    mockGetLuts.mockResolvedValue({ data: { data: [] } })
    mockUploadLut.mockResolvedValue({
      data: { data: { id: 'lut-1', name: 'test.cube', fileUrl: '/uploads/test.cube' } },
    })
  })
  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    mockEditorStore.engineAdapter = null
    vi.useRealTimers()
  })

  it('从API加载正确字段并初始化表单', async () => {
    const config = makeConfig({ exposure: 1.5, bloomStrength: 0.3, toneMapping: 'ACES' })
    mockGetPostProcessing.mockResolvedValue({ data: { data: config } })
    const wrapper = mountPanel()
    await flushPromises()

    expect(mockGetPostProcessing).toHaveBeenCalledWith('scene-1')
    const exposureInput = wrapper.find('[data-testid="exposure-input"]')
    expect(exposureInput.exists()).toBe(true)
    expect(exposureInput.attributes('value')).toBe('1.5')
    const bloomInput = wrapper.find('[data-testid="bloom-strength-input"]')
    expect(bloomInput.exists()).toBe(true)
    expect(bloomInput.attributes('value')).toBe('0.3')
  })

  it('修改 exposure 数值框触发 updatePostProcessing', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const exposureInput = wrapper.find('[data-testid="exposure-input"]')
    await exposureInput.setValue('1.8')
    await exposureInput.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdatePostProcessing).toHaveBeenCalled()
    const lastCall = mockUpdatePostProcessing.mock.calls[mockUpdatePostProcessing.mock.calls.length - 1]
    expect(lastCall[0]).toBe('scene-1')
    expect(lastCall[1]).toHaveProperty('exposure')
  })

  it('渲染 bloomStrength 和 bloomThreshold 数值输入框（而非滑块）', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="bloom-strength-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bloom-threshold-input"]').exists()).toBe(true)
    // 旧 slider testid 不再存在
    expect(wrapper.find('[data-testid="bloom-strength-slider"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="bloom-threshold-slider"]').exists()).toBe(false)
  })

  it('修改 bloomStrength 触发 updatePostProcessing', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const bloomInput = wrapper.find('[data-testid="bloom-strength-input"]')
    await bloomInput.setValue('0.5')
    await bloomInput.trigger('change')
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

    expect(wrapper.find('[data-testid="enabled-switch"]').exists()).toBe(true)
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

  it('渲染 contrast/saturation/colorTemperature 数值输入框', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="contrast-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="saturation-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="colorTemperature-input"]').exists()).toBe(true)
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

  // --- 新增：预设与 LUT 区块 ---

  it('渲染预设卡片网格（12个，与TestView对齐，无自定义卡片）', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const cards = wrapper.findAll('[data-testid="preset-card"]')
    // 12 个预设：原始/鲜艳/暖色调/冷色调/电影感/复古/黑白/棕褐色/戏剧/梦幻/交叉冲洗/褪色
    expect(cards.length).toBe(12)
    const labels = cards.map((c) => c.text())
    expect(labels).toContain('原始')
    expect(labels).toContain('鲜艳')
    expect(labels).toContain('电影感')
    expect(labels).toContain('交叉冲洗')
    expect(labels).toContain('褪色')
    expect(labels).not.toContain('自定义')
  })

  it('渲染 LUT 选择器与上传按钮', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="lut-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="upload-lut-btn"]').exists()).toBe(true)
  })

  it('选择预设后应用预设参数并切换 presetStyle', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const cards = wrapper.findAll('[data-testid="preset-card"]')
    const vividCard = cards.find((c) => c.text().includes('鲜艳'))
    expect(vividCard).toBeTruthy()
    await vividCard!.trigger('click')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdatePostProcessing).toHaveBeenCalled()
    const lastCall = mockUpdatePostProcessing.mock.calls[mockUpdatePostProcessing.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('presetStyle', 'vivid')
    // vivid: brightness=0.05 → exposure≈1.05, contrast=1.3, saturation=1.5, temperature=0→colorTemp=0
    expect(lastCall[1].exposure).toBeCloseTo(1.05, 2)
    expect(lastCall[1].contrast).toBe(1.3)
    expect(lastCall[1].saturation).toBe(1.5)
    expect(lastCall[1].colorTemperature).toBe(0)
  })

  it('选择暖色调预设后色温映射为+50', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const cards = wrapper.findAll('[data-testid="preset-card"]')
    const warmCard = cards.find((c) => c.text().includes('暖色调'))
    await warmCard!.trigger('click')
    vi.advanceTimersByTime(300)
    await flushPromises()

    const lastCall = mockUpdatePostProcessing.mock.calls[mockUpdatePostProcessing.mock.calls.length - 1]
    // warm: temperature=0.5 → colorTemperature≈50
    expect(lastCall[1]).toHaveProperty('presetStyle', 'warm')
    expect(lastCall[1].colorTemperature).toBe(50)
  })

  it('选择 LUT 后显示强度输入框并触发保存', async () => {
    mockGetLuts.mockResolvedValue({
      data: { data: [{ id: 'lut-1', name: 'cinematic.cube', fileUrl: '/x.cube' }] },
    })
    const wrapper = mountPanel()
    await flushPromises()

    const lutSelect = wrapper.find('[data-testid="lut-select"]')
    await lutSelect.setValue('lut-1')
    await lutSelect.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.find('[data-testid="lut-intensity-input"]').exists()).toBe(true)
    const lastCall = mockUpdatePostProcessing.mock.calls[mockUpdatePostProcessing.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('lutResourceId', 'lut-1')
  })

  it('手动修改数值参数后预设自动切换为 custom（取消所有卡片高亮）', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    // 先选 vivid
    const cards = wrapper.findAll('[data-testid="preset-card"]')
    const vividCard = cards.find((c) => c.text().includes('鲜艳'))
    await vividCard!.trigger('click')
    vi.advanceTimersByTime(300)
    await flushPromises()
    mockUpdatePostProcessing.mockClear()

    // 再手动改 exposure
    const exposureInput = wrapper.find('[data-testid="exposure-input"]')
    await exposureInput.setValue('2.5')
    await exposureInput.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    const lastCall = mockUpdatePostProcessing.mock.calls[mockUpdatePostProcessing.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('presetStyle', 'custom')
  })

  it('选择预设时同步调用 adapter.applyPostConfig 推动引擎实时预览', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    mockApplyPostConfig.mockClear()

    const cards = wrapper.findAll('[data-testid="preset-card"]')
    const vividCard = cards.find((c) => c.text().includes('鲜艳'))
    await vividCard!.trigger('click')
    await flushPromises()

    // scheduleUpdate 内同步调用 syncToEngine → applyPostConfig（不走防抖）
    expect(mockApplyPostConfig).toHaveBeenCalled()
    const callArg = mockApplyPostConfig.mock.calls[0][0]
    expect(callArg).toHaveProperty('presetStyle', 'vivid')
    expect(callArg).toHaveProperty('enabled', true)
  })

  it('切换 enabled 开关时同步调用 adapter.applyPostConfig', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    mockApplyPostConfig.mockClear()

    const enabledSwitch = wrapper.find('[data-testid="enabled-switch"]')
    await enabledSwitch.setValue(false)
    await enabledSwitch.trigger('change')
    await flushPromises()

    expect(mockApplyPostConfig).toHaveBeenCalled()
    const callArg = mockApplyPostConfig.mock.calls[0][0]
    expect(callArg).toHaveProperty('enabled', false)
  })
})
