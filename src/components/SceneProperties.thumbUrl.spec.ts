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
}

describe('SceneProperties — 缩略图管理 (thumbUrl)', () => {
  let vmMock: ReturnType<typeof makeVmMock>

  beforeEach(() => {
    vi.useFakeTimers()
    mockMarkDirty.mockClear()
    vmMock = makeVmMock(makeScene({ thumbUrl: '/uploads/thumb.jpg' }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 currentScene.thumbUrl 初始化缩略图预览和输入框', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const thumbPreview = wrapper.find('.thumb-preview img')
    expect(thumbPreview.exists()).toBe(true)
    expect(thumbPreview.attributes('src')).toBe('/uploads/thumb.jpg')

    const inputs = wrapper.findAll('input[type="text"], input:not([type])')
    const thumbInput = inputs[2]
    expect(thumbInput.element.value).toBe('/uploads/thumb.jpg')
  })

  it('修改 thumbUrl 后调用 updateSceneMeta 携带 thumbUrl', async () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const inputs = wrapper.findAll('input[type="text"], input:not([type])')
    const thumbInput = inputs[2]
    await thumbInput.setValue('/uploads/new-thumb.jpg')
    await thumbInput.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(vmMock.updateSceneMeta).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ thumbUrl: '/uploads/new-thumb.jpg' }),
    )
    expect(mockMarkDirty).toHaveBeenCalled()
  })

  it('thumbUrl 为空时显示占位符', async () => {
    vmMock = makeVmMock(makeScene({ thumbUrl: '' }))
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const thumbPreview = wrapper.find('.thumb-preview')
    expect(thumbPreview.exists()).toBe(true)
    const img = thumbPreview.find('img')
    expect(img.exists() === false || img.attributes('src') === '').toBe(true)
  })
})
