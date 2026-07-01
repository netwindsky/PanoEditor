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
  'el-button': {
    template: '<button v-bind="$attrs"><slot /></button>',
    inheritAttrs: false,
  },
}

describe('SceneProperties — title 字段', () => {
  let vmMock: ReturnType<typeof makeVmMock>

  beforeEach(() => {
    vi.useFakeTimers()
    mockMarkDirty.mockClear()
    vmMock = makeVmMock(makeScene({ title: '雪漠书院' }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 currentScene.title 初始化标题输入框', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    const titleInput = inputs[1]
    expect(titleInput.element.value).toBe('雪漠书院')
  })

  it('修改标题后调用 updateSceneMeta 携带 title', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    const titleInput = inputs[1]
    await titleInput.setValue('明伦堂')
    await titleInput.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(vmMock.updateSceneMeta).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ title: '明伦堂' }),
    )
    expect(mockMarkDirty).toHaveBeenCalled()
  })

  it('title 为空字符串时也能正常渲染和提交', async () => {
    vmMock = makeVmMock(makeScene({ title: '' }))
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    const titleInput = inputs[1]
    expect(titleInput.element.value).toBe('')
  })
})
