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
import { makeScene, makeVmMock } from '@/components/__testHelpers/sceneVmMock'

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

describe('SceneProperties — handleUpdate 防抖', () => {
  let vmMock: ReturnType<typeof makeVmMock>

  beforeEach(() => {
    vi.useFakeTimers()
    mockMarkDirty.mockClear()
    vmMock = makeVmMock(makeScene())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('连续多次 change 只触发一次 updateSceneView', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    await sliders[0].setValue(10)
    await sliders[0].trigger('change')
    await sliders[1].setValue(20)
    await sliders[1].trigger('change')
    await sliders[2].setValue(90)
    await sliders[2].trigger('change')

    // 防抖窗口内不应触发
    expect(vmMock.updateSceneView).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    await flushPromises()

    // 视角三个字段合并到一次 updateSceneView 调用
    expect(vmMock.updateSceneView).toHaveBeenCalledTimes(1)
  })

  it('防抖窗口内新调用会重置计时', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    await sliders[0].setValue(10)
    await sliders[0].trigger('change')

    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(vmMock.updateSceneView).not.toHaveBeenCalled()

    await sliders[1].setValue(20)
    await sliders[1].trigger('change')

    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(vmMock.updateSceneView).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    await flushPromises()
    expect(vmMock.updateSceneView).toHaveBeenCalledTimes(1)
  })
})
