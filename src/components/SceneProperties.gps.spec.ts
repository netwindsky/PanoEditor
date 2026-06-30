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
    viewConfig: JSON.stringify({ lat: 30.5, lng: 114.3, heading: 45.0 }),
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Scene
}

describe('SceneProperties — GPS 坐标 (viewConfig)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUpdateScene.mockClear()
    mockMarkDirty.mockClear()
    mockCurrentScene.value = makeScene()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染时从 viewConfig 解析 lat/lng/heading 初始化输入框', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    // 找到 GPS 分区的 number inputs
    const gpsSection = wrapper.find('.gps-section')
    expect(gpsSection.exists()).toBe(true)

    const numberInputs = gpsSection.findAll('input[type="number"]')
    expect(numberInputs).toHaveLength(3)
    expect(Number(numberInputs[0].element.value)).toBe(30.5)  // lat
    expect(Number(numberInputs[1].element.value)).toBe(114.3) // lng
    expect(Number(numberInputs[2].element.value)).toBe(45.0)  // heading
  })

  it('修改 lat 后触发 updateScene 携带新 viewConfig JSON', async () => {
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const gpsSection = wrapper.find('.gps-section')
    const latInput = gpsSection.findAll('input[type="number"]')[0]
    await latInput.setValue('31.2')
    await latInput.trigger('change')

    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateScene).toHaveBeenCalledTimes(1)
    const callArgs = mockUpdateScene.mock.calls[0][1]
    const viewConfig = JSON.parse(callArgs.viewConfig)
    expect(viewConfig.lat).toBe(31.2)
    expect(viewConfig.lng).toBe(114.3) // 保持原值
    expect(viewConfig.heading).toBe(45.0) // 保持原值
  })

  it('viewConfig 为空时输入框显示空值', async () => {
    mockCurrentScene.value = makeScene({ viewConfig: '' })
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const gpsSection = wrapper.find('.gps-section')
    const numberInputs = gpsSection.findAll('input[type="number"]')
    expect(numberInputs[0].element.value).toBe('')
    expect(numberInputs[1].element.value).toBe('')
    expect(numberInputs[2].element.value).toBe('')
  })

  it('viewConfig JSON 无效时输入框显示空值', async () => {
    mockCurrentScene.value = makeScene({ viewConfig: 'invalid json' })
    const wrapper = mount(SceneProperties, { global: { stubs: globalStubs } })
    await flushPromises()

    const gpsSection = wrapper.find('.gps-section')
    const numberInputs = gpsSection.findAll('input[type="number"]')
    expect(numberInputs[0].element.value).toBe('')
  })
})
