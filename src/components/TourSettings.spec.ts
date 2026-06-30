import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import TourSettings from '@/components/TourSettings.vue'

// --- Mock stores (hoisted reactive objects) ---
const { mockProjectStore, mockEditorStore } = vi.hoisted(() => {
  const { reactive } = require('vue') as typeof import('vue')
  return {
    mockProjectStore: reactive({
      currentProject: { id: 'p1', name: 'proj', settings: '' } as { id: string; name: string; settings?: string } | null,
    }),
    mockEditorStore: reactive({
      markDirty: vi.fn(),
      setRightPanelSection: vi.fn(),
    }),
  }
})

vi.mock('@/stores/project', () => ({
  useProjectStore: () => mockProjectStore,
}))
vi.mock('@/stores/editor', () => ({
  useEditorStore: () => mockEditorStore,
}))

// --- Mock API ---
const mockUpdateProject = vi.fn()
vi.mock('@/api/project', () => ({
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
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

let wrapper: ReturnType<typeof mount> | null = null

function mountTourSettings() {
  wrapper = mount(TourSettings, { global: { stubs } })
  return wrapper
}

function makeSettingsJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    autoRotate: false,
    autoRotateSpeed: 1.0,
    defaultFov: 100,
    minFov: 50,
    maxFov: 150,
    enableCompass: false,
    controlbar: true,
    thumbs: true,
    tooltips: true,
    designStyle: 'flat',
    loadsceneBlend: 'BLEND(1, easeOutCubic)',
    ...overrides,
  })
}

describe('TourSettings — 全局漫游配置', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: '' }
    mockUpdateProject.mockResolvedValue({ data: { data: {} } })
  })
  afterEach(() => {
    if (wrapper) { wrapper.unmount(); wrapper = null }
    vi.useRealTimers()
  })

  it('挂载时从 project.settings JSON 加载配置', async () => {
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: makeSettingsJson({ autoRotate: true, autoRotateSpeed: 2.5 }) }
    const w = mountTourSettings()
    await flushPromises()

    const autoRotateSwitch = w.find('[data-testid="auto-rotate-switch"]')
    expect(autoRotateSwitch.exists()).toBe(true)
    expect((autoRotateSwitch.element as HTMLInputElement).checked).toBe(true)

    const speedSlider = w.find('[data-testid="auto-rotate-speed-slider"]')
    expect(speedSlider.exists()).toBe(true)
    expect(speedSlider.attributes('value')).toBe('2.5')
  })

  it('settings 为空时使用默认值', async () => {
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: '' }
    const w = mountTourSettings()
    await flushPromises()

    const speedSlider = w.find('[data-testid="auto-rotate-speed-slider"]')
    expect(speedSlider.attributes('value')).toBe('1')
  })

  it('修改 autoRotate 触发 updateProject 序列化 settings JSON', async () => {
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: '' }
    const w = mountTourSettings()
    await flushPromises()

    const autoRotateSwitch = w.find('[data-testid="auto-rotate-switch"]')
    await autoRotateSwitch.setValue(true)
    await autoRotateSwitch.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateProject).toHaveBeenCalled()
    const lastCall = mockUpdateProject.mock.calls[mockUpdateProject.mock.calls.length - 1]
    expect(lastCall[0]).toBe('p1')
    expect(lastCall[1]).toHaveProperty('settings')
    const settings = JSON.parse(lastCall[1].settings)
    expect(settings.autoRotate).toBe(true)
  })

  it('渲染 controlbar/thumbs/tooltips 开关', async () => {
    const w = mountTourSettings()
    await flushPromises()

    expect(w.find('[data-testid="controlbar-switch"]').exists()).toBe(true)
    expect(w.find('[data-testid="thumbs-switch"]').exists()).toBe(true)
    expect(w.find('[data-testid="tooltips-switch"]').exists()).toBe(true)
  })

  it('渲染 loadsceneBlend 选择器', async () => {
    const w = mountTourSettings()
    await flushPromises()

    const blendSelect = w.find('[data-testid="loadscene-blend-select"]')
    expect(blendSelect.exists()).toBe(true)
  })

  it('修改 loadsceneBlend 触发 updateProject', async () => {
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: '' }
    const w = mountTourSettings()
    await flushPromises()

    const blendSelect = w.find('[data-testid="loadscene-blend-select"]')
    await blendSelect.setValue('BLEND(2, easeInOutCubic)')
    await blendSelect.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateProject).toHaveBeenCalled()
    const lastCall = mockUpdateProject.mock.calls[mockUpdateProject.mock.calls.length - 1]
    const settings = JSON.parse(lastCall[1].settings)
    expect(settings.loadsceneBlend).toBe('BLEND(2, easeInOutCubic)')
  })

  it('渲染 defaultFov/minFov/maxFov 滑块', async () => {
    const w = mountTourSettings()
    await flushPromises()

    expect(w.find('[data-testid="default-fov-slider"]').exists()).toBe(true)
    expect(w.find('[data-testid="min-fov-slider"]').exists()).toBe(true)
    expect(w.find('[data-testid="max-fov-slider"]').exists()).toBe(true)
  })

  it('重置按钮恢复默认值并触发更新', async () => {
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: makeSettingsJson({ autoRotate: true }) }
    const w = mountTourSettings()
    await flushPromises()

    const resetBtn = w.find('[data-testid="reset-btn"]')
    expect(resetBtn.exists()).toBe(true)
    await resetBtn.trigger('click')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateProject).toHaveBeenCalled()
  })

  it('无当前项目时不调用API', async () => {
    mockProjectStore.currentProject = null
    const w = mountTourSettings()
    await flushPromises()

    expect(mockUpdateProject).not.toHaveBeenCalled()
  })
})
