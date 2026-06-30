import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import LayerOverlayPanel from '@/components/LayerOverlayPanel.vue'
import type { OverlayLayer } from '@/types'

// --- Mock stores ---
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
  'el-button': { template: '<button v-bind="$attrs"><slot /></button>', inheritAttrs: false },
  'el-input': {
    template: '<input v-if="type !== \'textarea\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\', $event.target.value)" /><textarea v-else :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\', $event.target.value)"></textarea>',
    props: ['modelValue', 'size', 'placeholder', 'type', 'rows', 'disabled'],
    emits: ['update:modelValue', 'change'],
  },
  'el-input-number': {
    template: '<input :value="modelValue" type="number" @input="$emit(\'update:modelValue\', parseFloat($event.target.value))" />',
    props: ['modelValue', 'size', 'step', 'precision', 'min', 'disabled'],
    emits: ['update:modelValue'],
  },
  'el-select': {
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
    props: ['modelValue', 'size', 'placeholder', 'clearable'],
    emits: ['update:modelValue', 'change'],
  },
  'el-option': { template: '<option :value="value"><slot /></option>', props: ['label', 'value'] },
  'el-switch': {
    template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked); $emit(\'change\', $event.target.checked)" />',
    props: ['modelValue'],
    emits: ['update:modelValue', 'change'],
  },
  'el-icon': { template: '<span><slot /></span>' },
}

let wrapper: ReturnType<typeof mount> | null = null

function mountPanel() {
  wrapper = mount(LayerOverlayPanel, { global: { stubs } })
  return wrapper
}

function makeLayer(overrides: Partial<OverlayLayer> = {}): OverlayLayer {
  return {
    id: 'l1',
    name: 'infotext',
    type: 'text',
    html: '欢迎文字',
    css: 'color:#FFFFFF; font-size:14px;',
    align: 'left',
    x: 10,
    visible: true,
    ...overrides,
  }
}

function makeSettingsJson(layers: OverlayLayer[] = []): string {
  const tour = { autoRotate: false, autoRotateSpeed: 1, defaultFov: 100, minFov: 50, maxFov: 150, enableCompass: false, controlbar: true, thumbs: true, tooltips: true, designStyle: 'flat', loadsceneBlend: '' }
  return JSON.stringify({ ...tour, layers })
}

describe('LayerOverlayPanel — krpano 覆盖层编辑', () => {
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

  it('从 project.settings JSON 加载 layers 数组', async () => {
    const layers = [makeLayer({ name: 'title', html: '标题' })]
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: makeSettingsJson(layers) }
    const w = mountPanel()
    await flushPromises()

    const items = w.findAll('[data-testid="layer-item"]')
    expect(items.length).toBe(1)
    expect(items[0].text()).toContain('title')
  })

  it('点击"添加文字层"按钮新增 text 类型 layer', async () => {
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: '' }
    const w = mountPanel()
    await flushPromises()

    const addBtn = w.find('[data-testid="add-text-layer"]')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateProject).toHaveBeenCalled()
    const lastCall = mockUpdateProject.mock.calls[mockUpdateProject.mock.calls.length - 1]
    const settings = JSON.parse(lastCall[1].settings)
    expect(settings.layers.length).toBe(1)
    expect(settings.layers[0].type).toBe('text')
  })

  it('点击"添加按钮层"按钮新增 button 类型 layer', async () => {
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: '' }
    const w = mountPanel()
    await flushPromises()

    const addBtn = w.find('[data-testid="add-button-layer"]')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateProject).toHaveBeenCalled()
    const lastCall = mockUpdateProject.mock.calls[mockUpdateProject.mock.calls.length - 1]
    const settings = JSON.parse(lastCall[1].settings)
    expect(settings.layers.length).toBe(1)
    expect(settings.layers[0].type).toBe('button')
  })

  it('选中 layer 后显示属性编辑区', async () => {
    const layers = [makeLayer({ name: 'infotext' })]
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: makeSettingsJson(layers) }
    const w = mountPanel()
    await flushPromises()

    const item = w.find('[data-testid="layer-item"]')
    await item.trigger('click')

    const propsSection = w.find('[data-testid="layer-props"]')
    expect(propsSection.exists()).toBe(true)
  })

  it('修改 layer name 触发 updateProject', async () => {
    const layers = [makeLayer({ name: 'infotext' })]
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: makeSettingsJson(layers) }
    const w = mountPanel()
    await flushPromises()

    // 选中 layer
    await w.find('[data-testid="layer-item"]').trigger('click')

    // 修改 name
    const nameInput = w.find('[data-testid="layer-name-input"]')
    expect(nameInput.exists()).toBe(true)
    await nameInput.setValue('newname')
    await nameInput.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateProject).toHaveBeenCalled()
    const lastCall = mockUpdateProject.mock.calls[mockUpdateProject.mock.calls.length - 1]
    const settings = JSON.parse(lastCall[1].settings)
    expect(settings.layers[0].name).toBe('newname')
  })

  it('修改 layer html 触发 updateProject', async () => {
    const layers = [makeLayer({ type: 'text', html: '旧文字' })]
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: makeSettingsJson(layers) }
    const w = mountPanel()
    await flushPromises()

    await w.find('[data-testid="layer-item"]').trigger('click')

    const htmlInput = w.find('[data-testid="layer-html-input"]')
    expect(htmlInput.exists()).toBe(true)
    await htmlInput.setValue('新文字')
    await htmlInput.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateProject).toHaveBeenCalled()
    const lastCall = mockUpdateProject.mock.calls[mockUpdateProject.mock.calls.length - 1]
    const settings = JSON.parse(lastCall[1].settings)
    expect(settings.layers[0].html).toBe('新文字')
  })

  it('切换 visible 触发 updateProject', async () => {
    const layers = [makeLayer({ visible: true })]
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: makeSettingsJson(layers) }
    const w = mountPanel()
    await flushPromises()

    await w.find('[data-testid="layer-item"]').trigger('click')

    const visibleSwitch = w.find('[data-testid="layer-visible-switch"]')
    expect(visibleSwitch.exists()).toBe(true)
    await visibleSwitch.setValue(false)
    await visibleSwitch.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateProject).toHaveBeenCalled()
    const lastCall = mockUpdateProject.mock.calls[mockUpdateProject.mock.calls.length - 1]
    const settings = JSON.parse(lastCall[1].settings)
    expect(settings.layers[0].visible).toBe(false)
  })

  it('删除 layer 触发 updateProject', async () => {
    const layers = [makeLayer({ name: 'todelete' })]
    mockProjectStore.currentProject = { id: 'p1', name: 'proj', settings: makeSettingsJson(layers) }
    const w = mountPanel()
    await flushPromises()

    const deleteBtn = w.find('[data-testid="layer-delete"]')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateProject).toHaveBeenCalled()
    const lastCall = mockUpdateProject.mock.calls[mockUpdateProject.mock.calls.length - 1]
    const settings = JSON.parse(lastCall[1].settings)
    expect(settings.layers.length).toBe(0)
  })

  it('无当前项目时不调用API', async () => {
    mockProjectStore.currentProject = null
    const w = mountPanel()
    await flushPromises()

    expect(mockUpdateProject).not.toHaveBeenCalled()
  })
})
