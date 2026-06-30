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
    initialView: { hfov: 120, pitch: 0, yaw: 0, fovMin: 70, fovMax: 140, maxPixelZoom: 2.0 },
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Scene
}

describe('SceneProperties — 视角限制 (fovMin/fovMax/maxPixelZoom)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateScene.mockClear()
    mockMarkDirty.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 initialView 初始化 fovMin/fovMax/maxPixelZoom', async () => {
    mockCurrentScene.value = makeScene()
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    // slider 顺序: yaw, pitch, hfov, fovMin, fovMax, maxPixelZoom
    const fovMinSlider = sliders[3]
    const fovMaxSlider = sliders[4]
    const maxPixelZoomSlider = sliders[5]

    expect(Number(fovMinSlider.element.value)).toBe(70)
    expect(Number(fovMaxSlider.element.value)).toBe(140)
    expect(Number(maxPixelZoomSlider.element.value)).toBe(2.0)
  })

  it('修改 fovMin 后触发 updateScene 携带新值', async () => {
    mockCurrentScene.value = makeScene()
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    const fovMinSlider = sliders[3]
    await fovMinSlider.setValue(50)
    await fovMinSlider.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateScene).toHaveBeenCalledWith('s1', expect.objectContaining({
      initialView: expect.objectContaining({
        fovMin: 50,
      }),
    }))
    expect(mockMarkDirty).toHaveBeenCalled()
  })

  it('修改 fovMax 后触发 updateScene 携带新值', async () => {
    mockCurrentScene.value = makeScene()
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    const fovMaxSlider = sliders[4]
    await fovMaxSlider.setValue(150)
    await fovMaxSlider.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateScene).toHaveBeenCalledWith('s1', expect.objectContaining({
      initialView: expect.objectContaining({
        fovMax: 150,
      }),
    }))
  })

  it('修改 maxPixelZoom 后触发 updateScene 携带新值', async () => {
    mockCurrentScene.value = makeScene()
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    const maxPixelZoomSlider = sliders[5]
    await maxPixelZoomSlider.setValue(3.5)
    await maxPixelZoomSlider.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateScene).toHaveBeenCalledWith('s1', expect.objectContaining({
      initialView: expect.objectContaining({
        maxPixelZoom: 3.5,
      }),
    }))
  })

  it('initialView 无视角限制字段时使用默认值', async () => {
    mockCurrentScene.value = makeScene({
      initialView: { hfov: 120, pitch: 0, yaw: 0 } as any,
    })
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    const fovMinSlider = sliders[3]
    const fovMaxSlider = sliders[4]
    const maxPixelZoomSlider = sliders[5]

    // 默认值: fovMin=70, fovMax=140, maxPixelZoom=2.0
    expect(Number(fovMinSlider.element.value)).toBe(70)
    expect(Number(fovMaxSlider.element.value)).toBe(140)
    expect(Number(maxPixelZoomSlider.element.value)).toBe(2.0)
  })
})
