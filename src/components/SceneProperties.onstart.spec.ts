import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import type { Scene } from '@/types'

const mockCurrentScene = ref<Scene | null>(null)
const mockUpdateScene = vi.fn().mockResolvedValue({ id: 's1', name: 'test' })
const mockMarkDirty = vi.fn()

vi.mock('@/stores/scene', () => ({
  useSceneStore: () =>
    reactive({
      currentScene: mockCurrentScene,
      updateScene: mockUpdateScene,
    }),
}))

vi.mock('@/stores/project', () => ({
  useProjectStore: () =>
    reactive({
      currentProject: ref({ id: 'p1', name: 'proj' }),
    }),
}))

vi.mock('@/stores/editor', () => ({
  useEditorStore: () =>
    reactive({
      setRightPanelSection: vi.fn(),
      markDirty: mockMarkDirty,
    }),
}))

import SceneProperties from '@/components/SceneProperties.vue'

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
    template: '<input type="range" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', Number($event.target.value))" @change="$emit(\'change\', Number($event.target.value))" />',
  },
  'el-select': {
    props: ['modelValue', 'size', 'clearable', 'placeholder'],
    emits: ['update:modelValue', 'change'],
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
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
    template: '<input type="number" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', Number($event.target.value))" @change="$emit(\'change\', Number($event.target.value))" />',
  },
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 's1',
    projectId: 'p1',
    name: '测试场景',
    title: '测试标题',
    previewUrl: '',
    thumbUrl: '',
    imageConfig: '',
    status: 'READY',
    initialView: { hfov: 120, pitch: 0, yaw: 0 } as any,
    sortOrder: 0,
    viewConfig: JSON.stringify({ onstart: 'loadscene(scene1);' }),
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Scene
}

describe('SceneProperties — onstart 脚本 (viewConfig)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateScene.mockClear()
    mockMarkDirty.mockClear()
    mockCurrentScene.value = makeScene()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 viewConfig.onstart 初始化脚本编辑区', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const onstartSection = wrapper.find('.onstart-section')
    expect(onstartSection.exists()).toBe(true)

    const textarea = onstartSection.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect(textarea.element.value).toBe('loadscene(scene1);')
  })

  it('修改 onstart 后触发 updateScene 携带新 viewConfig JSON', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const onstartSection = wrapper.find('.onstart-section')
    const textarea = onstartSection.find('textarea')
    await textarea.setValue('lookto(0,0,90);')
    await textarea.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateScene).toHaveBeenCalledTimes(1)
    const callArgs = mockUpdateScene.mock.calls[0][1]
    const viewConfig = JSON.parse(callArgs.viewConfig)
    expect(viewConfig.onstart).toBe('lookto(0,0,90);')
  })

  it('viewConfig 无 onstart 时脚本编辑区为空', async () => {
    mockCurrentScene.value = makeScene({
      viewConfig: JSON.stringify({ lat: 30.5 }),
    })
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const textarea = wrapper.find('.onstart-section textarea')
    expect(textarea.element.value).toBe('')
  })
})
