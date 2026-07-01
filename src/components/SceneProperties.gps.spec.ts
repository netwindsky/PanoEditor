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
    props: ['modelValue', 'size', 'type', 'rows'],
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
  'el-input-number': {
    props: ['modelValue', 'size', 'min', 'max', 'step', 'controlsPosition'],
    emits: ['update:modelValue', 'change'],
    template:
      '<input type="number" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', $event.target.value === \'\' ? null : Number($event.target.value))" @change="$emit(\'change\', $event.target.value === \'\' ? null : Number($event.target.value))" />',
  },
}

describe('SceneProperties — GPS 坐标 (scene.location)', () => {
  let vmMock: ReturnType<typeof makeVmMock>

  beforeEach(() => {
    vi.useFakeTimers()
    mockMarkDirty.mockClear()
    vmMock = makeVmMock(makeScene({ location: { lat: 30.5, lng: 114.3, heading: 45.0 } }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 scene.location 初始化 lat/lng/heading 输入框', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const gpsSection = wrapper.find('.gps-section')
    expect(gpsSection.exists()).toBe(true)

    const numberInputs = gpsSection.findAll('input[type="number"]')
    expect(numberInputs).toHaveLength(3)
    expect(Number(numberInputs[0].element.value)).toBe(30.5)
    expect(Number(numberInputs[1].element.value)).toBe(114.3)
    expect(Number(numberInputs[2].element.value)).toBe(45.0)
  })

  it('修改 lat 后调用 updateSceneLocation 携带完整 location', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const gpsSection = wrapper.find('.gps-section')
    const latInput = gpsSection.findAll('input[type="number"]')[0]
    await latInput.setValue('31.2')
    await latInput.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(vmMock.updateSceneLocation).toHaveBeenCalledTimes(1)
    const [id, location] = vmMock.updateSceneLocation.mock.calls[0]
    expect(id).toBe('s1')
    expect(location.lat).toBe(31.2)
    expect(location.lng).toBe(114.3)
    expect(location.heading).toBe(45.0)
  })

  it('scene.location 为空时输入框显示空值', async () => {
    vmMock = makeVmMock(makeScene({ location: {} }))
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const gpsSection = wrapper.find('.gps-section')
    const numberInputs = gpsSection.findAll('input[type="number"]')
    expect(numberInputs[0].element.value).toBe('')
    expect(numberInputs[1].element.value).toBe('')
    expect(numberInputs[2].element.value).toBe('')
  })
})
