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
import { makeScene, makeInitialView, makeVmMock } from '@/components/__testHelpers/sceneVmMock'

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

describe('SceneProperties — 视角限制 (fovMin/fovMax/maxPixelZoom)', () => {
  let vmMock: ReturnType<typeof makeVmMock>

  beforeEach(() => {
    vi.useFakeTimers()
    mockMarkDirty.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 initialView 初始化 fovMin/fovMax/maxPixelZoom', async () => {
    vmMock = makeVmMock(
      makeScene({
        initialView: makeInitialView({ fovMin: 70, fovMax: 140, maxPixelZoom: 2.0 }),
      }),
    )
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    expect(Number(sliders[3].element.value)).toBe(70)
    expect(Number(sliders[4].element.value)).toBe(140)
    expect(Number(sliders[5].element.value)).toBe(2.0)
  })

  it('修改 fovMin 后调用 updateSceneView 携带新值', async () => {
    vmMock = makeVmMock(makeScene())
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    await sliders[3].setValue(50)
    await sliders[3].trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(vmMock.updateSceneView).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ fovMin: 50 }),
    )
    expect(mockMarkDirty).toHaveBeenCalled()
  })

  it('修改 fovMax 后调用 updateSceneView 携带新值', async () => {
    vmMock = makeVmMock(makeScene())
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    await sliders[4].setValue(150)
    await sliders[4].trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(vmMock.updateSceneView).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ fovMax: 150 }),
    )
  })

  it('修改 maxPixelZoom 后调用 updateSceneView 携带新值', async () => {
    vmMock = makeVmMock(makeScene())
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    await sliders[5].setValue(3.5)
    await sliders[5].trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(vmMock.updateSceneView).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ maxPixelZoom: 3.5 }),
    )
  })

  it('initialView 使用 DEFAULT_INITIAL_VIEW 默认值时正确渲染', async () => {
    vmMock = makeVmMock(makeScene({ initialView: makeInitialView() }))
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const sliders = wrapper.findAll('input[type="range"]')
    expect(Number(sliders[3].element.value)).toBe(70)
    expect(Number(sliders[4].element.value)).toBe(140)
    expect(Number(sliders[5].element.value)).toBe(2.0)
  })
})
