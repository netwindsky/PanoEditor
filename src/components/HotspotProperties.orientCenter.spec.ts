import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import HotspotProperties from '@/components/HotspotProperties.vue'
import type { Hotspot, Scene, Resource } from '@/types'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))

/** editor store mock：engineAdapter 可注入 */
const mockEngineAdapter = ref<Record<string, unknown> | null>(null)
const mockGetModelRuntime = vi.fn<(id: string) => { scale: number; rotate: number } | null>(() => null)
vi.mock('@/stores/editor', () => ({
  useEditorStore: () =>
    reactive({
      engineAdapter: mockEngineAdapter,
      markDirty: vi.fn(),
      setRightPanelSection: vi.fn(),
      setEngineAdapter: vi.fn(),
      getModelRuntime: (id: string) => mockGetModelRuntime.value(id),
    }),
}))

function createMockViewModel(type: 'model' | 'image' = 'model') {
  const hotspots = ref<Hotspot[]>([
    {
      id: 'm1',
      sceneId: 's1',
      name: '模型热点',
      type,
      ath: -150,
      atv: 10,
      url: '/models/default-cube.glb',
    },
  ])
  const selectedHotspot = ref<Hotspot | null>(hotspots.value[0])
  const scenes = ref<Scene[]>([
    { id: 's1', projectId: 'p1', name: '场景1', previewUrl: '', thumbUrl: '', imageConfig: '', status: '', initialView: { hfov: 120, pitch: 0, yaw: 0 }, sortOrder: 0, createdAt: '', updatedAt: '' },
  ])
  const resources = ref<Resource[]>([])

  const vm = {
    hotspotViewModel: {
      hotspots,
      selectedHotspot,
      selectHotspot: vi.fn(),
      deleteHotspot: vi.fn(),
      clearHotspots: vi.fn(),
      createHotspot: vi.fn(),
      updateHotspot: vi.fn(),
      previewHotspotStyle: vi.fn(),
      isDragging: ref(false),
    },
    sceneViewModel: {
      scenes,
      currentScene: ref(scenes.value[0]),
    },
    assetViewModel: {
      resources,
      loadResources: vi.fn(),
      uploadResource: vi.fn(),
    },
    currentProject: ref({ id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' }),
    addHotspot: vi.fn(),
    removeHotspot: vi.fn(),
    clearAllHotspots: vi.fn(),
    updateHotspot: vi.fn(),
    uploadResource: vi.fn(),
  }

  return { vm, hotspots, selectedHotspot }
}

const stubs = {
  'el-button': {
    template: '<button class="el-button" v-bind="$attrs"><slot /></button>',
    inheritAttrs: false,
  },
  'el-input': {
    template: '<input class="el-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'size', 'placeholder', 'type', 'rows', 'disabled'],
    emits: ['update:modelValue'],
  },
  'el-input-number': {
    template: '<input class="el-input-number" :value="modelValue" type="number" @input="$emit(\'update:modelValue\', parseFloat($event.target.value))" @change="$emit(\'change\', parseFloat($event.target.value))" />',
    props: ['modelValue', 'size', 'min', 'max', 'step', 'precision', 'controlsPosition', 'disabled'],
    emits: ['update:modelValue', 'change'],
  },
  'el-select': {
    template: '<select class="el-select" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
    props: ['modelValue', 'size', 'placeholder', 'clearable', 'disabled'],
    emits: ['update:modelValue', 'change'],
  },
  'el-option': { template: '<option :value="value">{{ label }}</option>', props: ['label', 'value'] },
  'el-dialog': { template: '<div class="el-dialog" v-if="modelValue"><slot /></div>', props: ['modelValue', 'title', 'width'] },
}

function mountComponent(vm: ReturnType<typeof createMockViewModel>['vm']) {
  return mount(HotspotProperties, {
    global: { provide: { editorViewModel: vm }, stubs },
  })
}

describe('HotspotProperties — 模型「面向中心」按钮', () => {
  beforeEach(() => {
    mockEngineAdapter.value = null
  })

  it('选中 model 热点时应显示「面向中心」按钮', async () => {
    const { vm } = createMockViewModel('model')
    const wrapper = mountComponent(vm)
    await flushPromises()

    const btn = wrapper.findAll('button').find((b) => b.text().includes('面向中心'))
    expect(btn).toBeDefined()
  })

  it('非 model 热点不显示「面向中心」按钮', async () => {
    const { vm } = createMockViewModel('image')
    const wrapper = mountComponent(vm)
    await flushPromises()

    const btn = wrapper.findAll('button').find((b) => b.text().includes('面向中心'))
    expect(btn).toBeUndefined()
  })

  it('点击按钮应调用 adapter.orientModelToCenter(热点id)', async () => {
    const { vm } = createMockViewModel('model')
    const orientModelToCenter = vi.fn()
    mockEngineAdapter.value = { orientModelToCenter }

    const wrapper = mountComponent(vm)
    await flushPromises()

    const btn = wrapper.findAll('button').find((b) => b.text().includes('面向中心'))
    expect(btn).toBeDefined()
    await btn!.trigger('click')
    await flushPromises()

    expect(orientModelToCenter).toHaveBeenCalledWith('m1')
  })

  it('引擎适配器缺失时点击不抛错', async () => {
    const { vm } = createMockViewModel('model')
    mockEngineAdapter.value = null

    const wrapper = mountComponent(vm)
    await flushPromises()

    const btn = wrapper.findAll('button').find((b) => b.text().includes('面向中心'))
    await expect(btn!.trigger('click')).resolves.toBeUndefined()
  })

  it('model 热点 scale/rotate 为空时，面板回填引擎实际值（相对倍数，回显不落库）', async () => {
    const { vm } = createMockViewModel('model')
    // 热点 scale/rotate 均为 undefined（DB NULL）
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale: vi.fn(),
    }
    mockGetModelRuntime.mockReturnValue({ relativeScale: 1.5, rotateX: 0, rotateY: 23, rotateZ: 0 })

    const wrapper = mountComponent(vm)
    await flushPromises()

    // 缩放输入框显示相对默认的倍数；旋转 Y 轴显示度数
    const fields = wrapper.findAll('.prop-field')
    const scaleField = fields.find((f) => f.find('label').text() === '缩放')
    const rotateField = fields.find((f) => f.find('label').text() === '旋转 Y')
    expect(Number((scaleField!.find('input').element as HTMLInputElement).value)).toBeCloseTo(1.5, 3)
    expect(Number((rotateField!.find('input').element as HTMLInputElement).value)).toBeCloseTo(23, 3)
    // 不应触发 updateHotspot（仅回显）
    expect(vm.updateHotspot).not.toHaveBeenCalled()
  })

  it('model 热点不渲染宽度/高度输入（引擎不消费，避免死控件）', async () => {
    const { vm } = createMockViewModel('model')
    vm.hotspotViewModel.hotspots.value[0].width = 100
    vm.hotspotViewModel.hotspots.value[0].height = 200
    mockEngineAdapter.value = { orientModelToCenter: vi.fn(), getModelRuntime: mockGetModelRuntime, setModelRelativeScale: vi.fn() }

    const wrapper = mountComponent(vm)
    await flushPromises()

    const fields = wrapper.findAll('.prop-field')
    expect(fields.find((f) => f.find('label').text() === '宽度')).toBeUndefined()
    expect(fields.find((f) => f.find('label').text() === '高度')).toBeUndefined()
  })

  it("model 热点旋转为 X/Y/Z 三轴输入（存 'x y z' 格式）", async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    vm.hotspotViewModel.hotspots.value[0].rotate = '10 90 30' as unknown as number
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale: vi.fn(),
    }
    mockGetModelRuntime.mockReturnValue({ relativeScale: 1, rotateX: 10, rotateY: 90, rotateZ: 30 })

    const wrapper = mountComponent(vm)
    await flushPromises()

    // 三个轴的输入框显示对应值
    const fields = wrapper.findAll('.prop-field')
    const rotX = fields.find((f) => f.find('label').text() === '旋转 X')
    const rotY = fields.find((f) => f.find('label').text() === '旋转 Y')
    const rotZ = fields.find((f) => f.find('label').text() === '旋转 Z')
    expect(rotX).toBeDefined()
    expect(rotY).toBeDefined()
    expect(rotZ).toBeDefined()
    expect(Number((rotX!.find('input').element as HTMLInputElement).value)).toBe(10)
    expect(Number((rotY!.find('input').element as HTMLInputElement).value)).toBe(90)
    expect(Number((rotZ!.find('input').element as HTMLInputElement).value)).toBe(30)

    // 修改 Y 轴 → 自动保存 rotate='10 45 30'
    await rotY!.find('input').setValue('45')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(vm.updateHotspot).toHaveBeenCalled()
    const [, updates] = vm.updateHotspot.mock.calls[0] as [string, Record<string, unknown>]
    expect(updates.rotate).toBe('10 45 30')
    vi.useRealTimers()
  })

  it('model 热点 rotate 为单值旧数据（number 45）时映射到 Y 轴显示', async () => {
    const { vm } = createMockViewModel('model')
    vm.hotspotViewModel.hotspots.value[0].rotate = 45
    mockEngineAdapter.value = { orientModelToCenter: vi.fn(), getModelRuntime: mockGetModelRuntime, setModelRelativeScale: vi.fn() }

    const wrapper = mountComponent(vm)
    await flushPromises()

    const fields = wrapper.findAll('.prop-field')
    const rotY = fields.find((f) => f.find('label').text() === '旋转 Y')
    expect(Number((rotY!.find('input').element as HTMLInputElement).value)).toBe(45)
  })

  it('保存时把面板相对倍数落库为 scale（setModelRelativeScale 返回值写入 updates）', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    // 热点 scale 为 NULL → 面板回填 relativeScale=1.5
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale: vi.fn().mockReturnValue(1.5), // 相对倍数原样落库
    }
    mockGetModelRuntime.mockReturnValue({ relativeScale: 1.5, rotateX: 0, rotateY: 0, rotateZ: 0 })

    const wrapper = mountComponent(vm)
    await flushPromises()

    // 触发一次修改（改名称）→ 防抖保存
    const nameField = wrapper.findAll('.prop-field').find((f) => f.find('label').text() === '名称')
    await nameField!.find('input').setValue('改名')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(vm.updateHotspot).toHaveBeenCalled()
    const [, updates] = vm.updateHotspot.mock.calls[0] as [string, Record<string, unknown>]
    // 落库值 = 相对倍数本身（DB decimal(10,2) 语义）
    expect(updates.scale).toBeCloseTo(1.5, 3)
    vi.useRealTimers()
  })
})
