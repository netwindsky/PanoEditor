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
    initialView: {
      hfov: 120, pitch: 0, yaw: 0,
      fovMin: 70, fovMax: 140, maxPixelZoom: 2.0,
      limitView: 'auto', fovType: 'MFOV',
    } as any,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Scene
}

describe('SceneProperties — 视角模式枚举 (limitView/fovType)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateScene.mockClear()
    mockMarkDirty.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 initialView 初始化 limitView 和 fovType', async () => {
    mockCurrentScene.value = makeScene()
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const selects = wrapper.findAll('select')
    // 第一个 select = limitView, 第二个 select = fovType
    const limitViewSelect = selects[0]
    const fovTypeSelect = selects[1]

    expect(limitViewSelect.element.value).toBe('auto')
    expect(fovTypeSelect.element.value).toBe('MFOV')
  })

  it('limitView 下拉框包含 auto/range/off 选项', async () => {
    mockCurrentScene.value = makeScene()
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const selects = wrapper.findAll('select')
    const limitViewSelect = selects[0]
    const options = limitViewSelect.findAll('option')
    const optionValues = options.map((o) => o.element.value)

    expect(optionValues).toContain('auto')
    expect(optionValues).toContain('range')
    expect(optionValues).toContain('off')
  })

  it('fovType 下拉框包含 MFOV/VFOV/DFOV/HFOV 选项', async () => {
    mockCurrentScene.value = makeScene()
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const selects = wrapper.findAll('select')
    const fovTypeSelect = selects[1]
    const options = fovTypeSelect.findAll('option')
    const optionValues = options.map((o) => o.element.value)

    expect(optionValues).toContain('MFOV')
    expect(optionValues).toContain('VFOV')
    expect(optionValues).toContain('DFOV')
    expect(optionValues).toContain('HFOV')
  })

  it('修改 limitView 后触发 updateScene 携带新值', async () => {
    mockCurrentScene.value = makeScene()
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const selects = wrapper.findAll('select')
    const limitViewSelect = selects[0]
    await limitViewSelect.setValue('range')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateScene).toHaveBeenCalledWith('s1', expect.objectContaining({
      initialView: expect.objectContaining({
        limitView: 'range',
      }),
    }))
    expect(mockMarkDirty).toHaveBeenCalled()
  })

  it('修改 fovType 后触发 updateScene 携带新值', async () => {
    mockCurrentScene.value = makeScene()
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const selects = wrapper.findAll('select')
    const fovTypeSelect = selects[1]
    await fovTypeSelect.setValue('DFOV')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateScene).toHaveBeenCalledWith('s1', expect.objectContaining({
      initialView: expect.objectContaining({
        fovType: 'DFOV',
      }),
    }))
  })

  it('initialView 无枚举字段时使用默认值 auto/MFOV', async () => {
    mockCurrentScene.value = makeScene({
      initialView: { hfov: 120, pitch: 0, yaw: 0 } as any,
    })
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const selects = wrapper.findAll('select')
    expect(selects[0].element.value).toBe('auto')
    expect(selects[1].element.value).toBe('MFOV')
  })
})
