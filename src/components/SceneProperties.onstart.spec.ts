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
    template: `
      <textarea v-if="type === 'textarea'" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" @change="$emit('change', $event.target.value)"></textarea>
      <input v-else :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" @change="$emit('change', $event.target.value)" />
    `,
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
      '<input type="number" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', Number($event.target.value))" @change="$emit(\'change\', Number($event.target.value))" />',
  },
}

describe('SceneProperties — onstart 脚本 (scene.onstart)', () => {
  let vmMock: ReturnType<typeof makeVmMock>

  beforeEach(() => {
    vi.useFakeTimers()
    mockMarkDirty.mockClear()
    vmMock = makeVmMock(makeScene({ onstart: 'loadscene(scene1);' }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 scene.onstart 初始化脚本编辑区', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const onstartSection = wrapper.find('.onstart-section')
    expect(onstartSection.exists()).toBe(true)

    const textarea = onstartSection.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect(textarea.element.value).toBe('loadscene(scene1);')
  })

  it('修改 onstart 后调用 updateSceneLocation 携带新 onstart', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const onstartSection = wrapper.find('.onstart-section')
    const textarea = onstartSection.find('textarea')
    await textarea.setValue('lookto(0,0,90);')
    await textarea.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(vmMock.updateSceneLocation).toHaveBeenCalledTimes(1)
    const [, , onstart] = vmMock.updateSceneLocation.mock.calls[0]
    expect(onstart).toBe('lookto(0,0,90);')
  })

  it('scene 无 onstart 时脚本编辑区为空', async () => {
    vmMock = makeVmMock(makeScene({ onstart: '' }))
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const textarea = wrapper.find('.onstart-section textarea')
    expect(textarea.element.value).toBe('')
  })
})
