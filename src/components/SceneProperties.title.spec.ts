import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import type { Scene } from '@/types'

// Mock Pinia stores — 用 reactive 包裹使 ref 自动 unwrap（模拟 Pinia store 行为）
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

// Stub Element Plus 组件
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
    initialView: { hfov: 120, pitch: 0, yaw: 0 },
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Scene
}

describe('SceneProperties — title 字段', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateScene.mockClear()
    mockMarkDirty.mockClear()
    mockCurrentScene.value = makeScene({ title: '雪漠书院' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 currentScene.title 初始化标题输入框', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    // 第一个 input 是名称，第二个是标题
    const titleInput = inputs[1]
    expect(titleInput.element.value).toBe('雪漠书院')
  })

  it('修改标题后触发 updateScene 携带 title', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    const titleInput = inputs[1]
    await titleInput.setValue('明伦堂')

    // 触发 change（SceneProperties 用 @change）
    await titleInput.trigger('change')

    // 推进防抖定时器
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateScene).toHaveBeenCalledWith('s1', expect.objectContaining({
      title: '明伦堂',
    }))
    expect(mockMarkDirty).toHaveBeenCalled()
  })

  it('title 为空字符串时也能正常渲染和提交', async () => {
    mockCurrentScene.value = makeScene({ title: '' })
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    const titleInput = inputs[1]
    expect(titleInput.element.value).toBe('')
  })
})
