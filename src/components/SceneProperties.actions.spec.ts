/**
 * SceneProperties 快捷操作按钮测试 — TDD RED
 *
 * 测试两个新按钮：
 * 1. 缩略图生成：从 previewUrl 中心裁切 16:9 生成缩略图
 * 2. 初始视角抓取：读引擎当前 yaw/pitch/hfov 写入表单
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import type { Scene } from '@/types'
import type { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'

// ===== Mock 依赖 =====

const mockCurrentScene = ref<Scene | null>(null)
const mockUpdateScene = vi.fn().mockResolvedValue({ id: 's1', name: 'test' })
const mockMarkDirty = vi.fn()
const mockEngineAdapter = ref<PanoEngineAdapter | null>(null)

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

// mock editor store with engineAdapter support
vi.mock('@/stores/editor', () => ({
  useEditorStore: () =>
    reactive({
      setRightPanelSection: vi.fn(),
      markDirty: mockMarkDirty,
      engineAdapter: mockEngineAdapter,
      setEngineAdapter: vi.fn(),
    }),
}))

// mock thumbnail generator
const mockGenerateThumbnail = vi.fn()
vi.mock('@/utils/thumbnailGenerator', () => ({
  generateThumbnailFromUrl: (...args: any[]) => mockGenerateThumbnail(...args),
}))

import SceneProperties from '@/components/SceneProperties.vue'

// ===== Stubs =====

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
  'el-input-number': {
    props: ['modelValue', 'size', 'min', 'max', 'step', 'controlsPosition'],
    emits: ['update:modelValue', 'change'],
    template: '<input type="number" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', Number($event.target.value))" @change="$emit(\'change\', Number($event.target.value))" />',
  },
  'el-progress': {
    props: ['percentage', 'strokeWidth'],
    template: '<div class="el-progress" />',
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
    initialView: { hfov: 100, pitch: 0, yaw: 0 } as any,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

// ===== Tests =====

describe('SceneProperties — 缩略图生成按钮', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockCurrentScene.value = makeScene({
      id: 's1',
      previewUrl: '/uploads/pano-1.jpg',
      thumbUrl: '',
    })
    mockUpdateScene.mockClear()
    mockMarkDirty.mockClear()
    mockGenerateThumbnail.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染"生成缩略图"按钮', () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    const buttons = wrapper.findAll('button')
    const hasGenerateThumbBtn = buttons.some(
      (b) => b.text().includes('生成缩略图'),
    )
    expect(hasGenerateThumbBtn).toBe(true)
  })

  it('有场景且有 previewUrl 时，点击按钮调 generateThumbnailFromUrl', async () => {
    mockGenerateThumbnail.mockResolvedValue('data:image/jpeg;base64,THUMB')
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const genBtn = wrapper.findAll('button').find((b) => b.text().includes('生成缩略图'))
    expect(genBtn).toBeTruthy()
    await genBtn!.trigger('click')
    await flushPromises()

    expect(mockGenerateThumbnail).toHaveBeenCalledWith('/uploads/pano-1.jpg')
    expect(mockUpdateScene).toHaveBeenCalled()
    // verify thumbUrl is updated
    const updateCall = mockUpdateScene.mock.calls[0]
    expect(updateCall[1].thumbUrl).toBe('data:image/jpeg;base64,THUMB')
  })

  it('无场景时按钮应禁用', () => {
    mockCurrentScene.value = null
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    const genBtn = wrapper.findAll('button').find((b) => b.text().includes('生成缩略图'))
    expect(genBtn?.attributes('disabled')).toBeDefined()
  })

  it('场景无 previewUrl 时生成应跳过', async () => {
    mockCurrentScene.value = makeScene({ id: 's1', previewUrl: '', thumbUrl: '' })
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const genBtn = wrapper.findAll('button').find((b) => b.text().includes('生成缩略图'))
    await genBtn!.trigger('click')
    await flushPromises()

    expect(mockGenerateThumbnail).not.toHaveBeenCalled()
    expect(mockUpdateScene).not.toHaveBeenCalled()
  })
})

describe('SceneProperties — 初始视角抓取按钮', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockCurrentScene.value = makeScene({
      id: 's1',
      initialView: { yaw: 0, pitch: 0, hfov: 100 },
    })
    mockUpdateScene.mockClear()
    mockMarkDirty.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染"记录当前视角"按钮', () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    const buttons = wrapper.findAll('button')
    const hasCaptureBtn = buttons.some((b) => b.text().includes('当前视角'))
    expect(hasCaptureBtn).toBe(true)
  })

  it('有引擎适配器时点击后调用 getCurrentView 并更新表单', async () => {
    // 模拟引擎适配器
    mockEngineAdapter.value = {
      getCurrentView: vi.fn().mockReturnValue({ yaw: 45, pitch: 30, hfov: 90 }),
    } as any

    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const captureBtn = wrapper.findAll('button').find((b) => b.text().includes('当前视角'))
    expect(captureBtn).toBeTruthy()
    await captureBtn!.trigger('click')
    await flushPromises()

    expect(mockEngineAdapter.value!.getCurrentView).toHaveBeenCalled()
    // 应触发 updateScene
    expect(mockUpdateScene).toHaveBeenCalled()
    // 验证 initialView 被更新
    const updateCall = mockUpdateScene.mock.calls[0]
    expect(updateCall[1].initialView).toEqual({
      yaw: 45,
      pitch: 30,
      hfov: 90,
      fovMin: 70,
      fovMax: 140,
      maxPixelZoom: 2.0,
      limitView: 'auto',
      fovType: 'MFOV',
    })
  })

  it('无引擎适配器时按钮应禁用', () => {
    mockEngineAdapter.value = null
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    const captureBtn = wrapper.findAll('button').find((b) => b.text().includes('当前视角'))
    expect(captureBtn?.attributes('disabled')).toBeDefined()
  })
})
