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
    thumbUrl: '/uploads/thumb.jpg',
    imageConfig: '',
    status: 'READY',
    initialView: { hfov: 120, pitch: 0, yaw: 0 } as any,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Scene
}

describe('SceneProperties — 缩略图管理 (thumbUrl)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateScene.mockClear()
    mockMarkDirty.mockClear()
    mockCurrentScene.value = makeScene()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 currentScene.thumbUrl 初始化缩略图预览和输入框', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    // 找到缩略图预览 img
    const thumbPreview = wrapper.find('.thumb-preview img')
    expect(thumbPreview.exists()).toBe(true)
    expect(thumbPreview.attributes('src')).toBe('/uploads/thumb.jpg')

    // 找到 thumbUrl 输入框（第3个 input：name, title, thumbUrl）
    const inputs = wrapper.findAll('input[type="text"], input:not([type])')
    const thumbInput = inputs[2]
    expect(thumbInput.element.value).toBe('/uploads/thumb.jpg')
  })

  it('修改 thumbUrl 后触发 updateScene 携带 thumbUrl', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const inputs = wrapper.findAll('input[type="text"], input:not([type])')
    const thumbInput = inputs[2]
    await thumbInput.setValue('/uploads/new-thumb.jpg')
    await thumbInput.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateScene).toHaveBeenCalledWith('s1', expect.objectContaining({
      thumbUrl: '/uploads/new-thumb.jpg',
    }))
    expect(mockMarkDirty).toHaveBeenCalled()
  })

  it('thumbUrl 为空时显示占位符', async () => {
    mockCurrentScene.value = makeScene({ thumbUrl: '' })
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const thumbPreview = wrapper.find('.thumb-preview')
    expect(thumbPreview.exists()).toBe(true)
    // 没有 img 或 img src 为空
    const img = thumbPreview.find('img')
    expect(img.exists() === false || img.attributes('src') === '').toBe(true)
  })
})
