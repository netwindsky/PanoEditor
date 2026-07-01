import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

const mockMarkDirty = vi.fn()

vi.mock('@/stores/project', () => ({
  useProjectStore: () => reactive({ currentProject: { id: 'p1', name: 'proj' } }),
}))

vi.mock('@/stores/editor', () => ({
  useEditorStore: () =>
    reactive({
      setRightPanelSection: vi.fn(),
      markDirty: mockMarkDirty,
    }),
}))

import SceneProperties from '@/components/SceneProperties.vue'
import { makeScene, makeInitialView, makeVmMock } from '@/components/__testHelpers/sceneVmMock'

const globalStubs = {
  'el-input': {
    props: ['modelValue', 'size'],
    emits: ['update:modelValue', 'change'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\', $event.target.value)" />',
  },
  'el-slider': {
    props: ['modelValue', 'min', 'max', 'step', 'size'],
    emits: ['update:modelValue', 'change'],
    template:
      '<input type="range" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', Number($event.target.value))" @change="$emit(\'change\', Number($event.target.value))" />',
  },
  'el-select': {
    props: ['modelValue', 'size', 'clearable', 'placeholder'],
    emits: ['update:modelValue', 'change'],
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
  },
  'el-option': {
    props: ['label', 'value'],
    template: '<option :value="value">{{ label }}</option>',
  },
  'el-button': {
    template: '<button v-bind="$attrs"><slot /></button>',
    inheritAttrs: false,
  },
}

describe('SceneProperties — 视角模式枚举 (limitView/fovType)', () => {
  let vmMock: ReturnType<typeof makeVmMock>

  beforeEach(() => {
    vi.useFakeTimers()
    mockMarkDirty.mockClear()
    vmMock = makeVmMock(makeScene({ initialView: makeInitialView() }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function mountVm() {
    return mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
  }

  it('渲染时从 initialView 初始化 limitView 和 fovType', async () => {
    const wrapper = mountVm()
    await flushPromises()
    const selects = wrapper.findAll('select')
    expect(selects[0].element.value).toBe('auto')
    expect(selects[1].element.value).toBe('MFOV')
  })

  it('limitView 下拉框包含 auto/range/off 选项', async () => {
    const wrapper = mountVm()
    await flushPromises()
    const options = wrapper.findAll('select')[0].findAll('option').map((o) => o.element.value)
    expect(options).toContain('auto')
    expect(options).toContain('range')
    expect(options).toContain('off')
  })

  it('fovType 下拉框包含 MFOV/VFOV/DFOV/HFOV 选项', async () => {
    const wrapper = mountVm()
    await flushPromises()
    const options = wrapper.findAll('select')[1].findAll('option').map((o) => o.element.value)
    expect(options).toContain('MFOV')
    expect(options).toContain('VFOV')
    expect(options).toContain('DFOV')
    expect(options).toContain('HFOV')
  })

  it('修改 limitView 后调用 updateSceneView 携带新值', async () => {
    const wrapper = mountVm()
    await flushPromises()
    await wrapper.findAll('select')[0].setValue('range')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(vmMock.updateSceneView).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ limitView: 'range' }),
    )
    expect(mockMarkDirty).toHaveBeenCalled()
  })

  it('修改 fovType 后调用 updateSceneView 携带新值', async () => {
    const wrapper = mountVm()
    await flushPromises()
    await wrapper.findAll('select')[1].setValue('DFOV')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(vmMock.updateSceneView).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ fovType: 'DFOV' }),
    )
  })

  it('initialView 使用 DEFAULT_INITIAL_VIEW 时枚举默认为 auto/MFOV', async () => {
    vmMock = makeVmMock(makeScene({ initialView: makeInitialView() }))
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const selects = wrapper.findAll('select')
    expect(selects[0].element.value).toBe('auto')
    expect(selects[1].element.value).toBe('MFOV')
  })
})
