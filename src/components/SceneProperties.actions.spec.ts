/**
 * SceneProperties 快捷操作按钮测试
 * - 缩略图生成：从当前全景视口截取 640×360
 * - 初始视角抓取：读引擎当前 yaw/pitch/hfov 写入表单并保存
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import type { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'

const mockMarkDirty = vi.fn()
const mockEngineAdapter = ref<PanoEngineAdapter | null>(null)

vi.mock('@/stores/project', () => ({
  useProjectStore: () => reactive({ currentProject: { id: 'p1', name: 'proj' } }),
}))

vi.mock('@/stores/editor', () => ({
  useEditorStore: () =>
    reactive({
      setRightPanelSection: vi.fn(),
      markDirty: mockMarkDirty,
      engineAdapter: mockEngineAdapter,
      setEngineAdapter: vi.fn(),
    }),
}))

const mockCaptureThumbnail = vi.fn()

import SceneProperties from '@/components/SceneProperties.vue'
import { makeScene, makeInitialView, makeVmMock } from '@/components/__testHelpers/sceneVmMock'

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
  'el-input-number': {
    props: ['modelValue', 'size', 'min', 'max', 'step', 'controlsPosition'],
    emits: ['update:modelValue', 'change'],
    template:
      '<input type="number" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', Number($event.target.value))" @change="$emit(\'change\', Number($event.target.value))" />',
  },
  'el-progress': {
    props: ['percentage', 'strokeWidth'],
    template: '<div class="el-progress" />',
  },
}

describe('SceneProperties — 缩略图生成按钮', () => {
  let vmMock: ReturnType<typeof makeVmMock>

  beforeEach(() => {
    vi.useFakeTimers()
    vmMock = makeVmMock(makeScene({ id: 's1', previewUrl: '/uploads/pano-1.jpg', thumbUrl: '' }))
    mockMarkDirty.mockClear()
    mockEngineAdapter.value = null
    mockCaptureThumbnail.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染"生成缩略图"按钮', () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.some((b) => b.text().includes('生成缩略图'))).toBe(true)
  })

  it('有引擎适配器时，点击按钮调用 adapter.captureThumbnail 并 updateSceneMeta', async () => {
    mockCaptureThumbnail.mockResolvedValue('data:image/jpeg;base64,THUMB')
    mockEngineAdapter.value = {
      captureThumbnail: mockCaptureThumbnail,
    } as any
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const genBtn = wrapper.findAll('button').find((b) => b.text().includes('生成缩略图'))
    expect(genBtn).toBeTruthy()
    await genBtn!.trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockCaptureThumbnail).toHaveBeenCalledWith(640, 360)
    expect(vmMock.updateSceneMeta).toHaveBeenCalled()
    const [, patch] = vmMock.updateSceneMeta.mock.calls[0]
    expect(patch.thumbUrl).toBe('data:image/jpeg;base64,THUMB')
  })

  it('无引擎适配器时按钮应禁用', () => {
    mockEngineAdapter.value = null
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    const genBtn = wrapper.findAll('button').find((b) => b.text().includes('生成缩略图'))
    expect(genBtn?.attributes('disabled')).toBeDefined()
  })

  it('无引擎适配器时生成应跳过', async () => {
    mockEngineAdapter.value = null
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const genBtn = wrapper.findAll('button').find((b) => b.text().includes('生成缩略图'))
    await genBtn!.trigger('click')
    await flushPromises()

    expect(mockCaptureThumbnail).not.toHaveBeenCalled()
    expect(vmMock.updateSceneMeta).not.toHaveBeenCalled()
  })
})

describe('SceneProperties — 初始视角抓取按钮', () => {
  let vmMock: ReturnType<typeof makeVmMock>

  beforeEach(() => {
    vi.useFakeTimers()
    vmMock = makeVmMock(makeScene({ id: 's1', initialView: makeInitialView({ yaw: 0, pitch: 0, hfov: 100 }) }))
    mockMarkDirty.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    mockEngineAdapter.value = null
  })

  it('渲染"记录当前视角"按钮', () => {
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.some((b) => b.text().includes('当前视角'))).toBe(true)
  })

  it('有引擎适配器时点击后调用 getCurrentView 并 updateSceneView 携带完整 InitialView', async () => {
    mockEngineAdapter.value = {
      getCurrentView: vi.fn().mockReturnValue({ yaw: 45, pitch: 30, hfov: 90 }),
    } as any

    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const captureBtn = wrapper.findAll('button').find((b) => b.text().includes('当前视角'))
    expect(captureBtn).toBeTruthy()
    await captureBtn!.trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect((mockEngineAdapter.value as any).getCurrentView).toHaveBeenCalled()
    expect(vmMock.updateSceneView).toHaveBeenCalled()
    const [, iv] = vmMock.updateSceneView.mock.calls[0]
    expect(iv).toEqual({
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
    const wrapper = mount(SceneProperties, {
      props: { vm: vmMock.vm as any },
      global: { stubs: globalStubs },
    })
    const captureBtn = wrapper.findAll('button').find((b) => b.text().includes('当前视角'))
    expect(captureBtn?.attributes('disabled')).toBeDefined()
  })
})
