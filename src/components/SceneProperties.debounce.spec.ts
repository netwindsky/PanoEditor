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
    props: ['modelValue', 'size'],
    emits: ['update:modelValue', 'change'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\', $event.target.value)" />',
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
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Scene
}

describe('SceneProperties — handleUpdate 防抖', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateScene.mockClear()
    mockMarkDirty.mockClear()
    mockCurrentScene.value = makeScene()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('连续多次 change 只触发一次 updateScene', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    // 连续修改 3 个滑块
    const sliders = wrapper.findAll('input[type="range"]')
    await sliders[0].setValue(10)  // yaw
    await sliders[0].trigger('change')
    await sliders[1].setValue(20)  // pitch
    await sliders[1].trigger('change')
    await sliders[2].setValue(90)  // hfov
    await sliders[2].trigger('change')

    // 防抖窗口内不应触发
    expect(mockUpdateScene).not.toHaveBeenCalled()

    // 推进防抖时间
    vi.advanceTimersByTime(300)
    await flushPromises()

    // 只触发一次
    expect(mockUpdateScene).toHaveBeenCalledTimes(1)
  })

  it('防抖窗口内新调用会重置计时', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    await sliders[0].setValue(10)
    await sliders[0].trigger('change')

    // 推进 200ms（未到 300ms）
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(mockUpdateScene).not.toHaveBeenCalled()

    // 再次触发 change，重置计时
    await sliders[1].setValue(20)
    await sliders[1].trigger('change')

    // 再推进 200ms（总共 400ms，但重置后只过了 200ms）
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(mockUpdateScene).not.toHaveBeenCalled()

    // 推进到 300ms 后触发
    vi.advanceTimersByTime(100)
    await flushPromises()
    expect(mockUpdateScene).toHaveBeenCalledTimes(1)
  })
})
