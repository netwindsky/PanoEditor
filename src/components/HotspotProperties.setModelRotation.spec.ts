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
const mockGetModelRuntime = vi.fn<() => { scale: number; rotate: number } | null>(() => null)
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
      panelRefreshVersion: ref(0),
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

describe('HotspotProperties — 保存时实时应用旋转 (setModelRotation)', () => {
  beforeEach(() => {
    mockEngineAdapter.value = null
    mockGetModelRuntime.mockReset()
    mockGetModelRuntime.mockReturnValue(null)
  })

  it('修改旋转 Y 轴后防抖保存应调用 adapter.setModelRotation(id, x, y, z)', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    vm.hotspotViewModel.hotspots.value[0].rotate = '0 45 0' as unknown as number

    const setModelRotation = vi.fn()
    const setModelRelativeScale = vi.fn()
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale,
      setModelRotation,
    }
    mockGetModelRuntime.mockReturnValue({ relativeScale: 1, rotateX: 0, rotateY: 45, rotateZ: 0 })

    const wrapper = mountComponent(vm)
    await flushPromises()

    const fields = wrapper.findAll('.prop-field')
    const rotY = fields.find((f) => f.find('label').text() === '旋转 Y')
    expect(rotY).toBeDefined()

    // 修改 Y 轴旋转
    await rotY!.find('input').setValue('90')
    vi.advanceTimersByTime(600)
    await flushPromises()

    // doSave 应调用 setModelRotation
    expect(setModelRotation).toHaveBeenCalledWith('m1', 0, 90, 0)
    vi.useRealTimers()
  })

  it('修改旋转 X/Z 轴后保存应传递正确的三轴值', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    vm.hotspotViewModel.hotspots.value[0].rotate = '10 20 30' as unknown as number

    const setModelRotation = vi.fn()
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale: vi.fn(),
      setModelRotation,
    }
    mockGetModelRuntime.mockReturnValue({ relativeScale: 1, rotateX: 10, rotateY: 20, rotateZ: 30 })

    const wrapper = mountComponent(vm)
    await flushPromises()

    const fields = wrapper.findAll('.prop-field')
    const rotX = fields.find((f) => f.find('label').text() === '旋转 X')
    const rotZ = fields.find((f) => f.find('label').text() === '旋转 Z')

    // 修改 X=15, Z=35
    await rotX!.find('input').setValue('15')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(setModelRotation).toHaveBeenCalledWith('m1', 15, 20, 30)

    setModelRotation.mockClear()

    await rotZ!.find('input').setValue('35')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(setModelRotation).toHaveBeenCalledWith('m1', 15, 20, 35)
    vi.useRealTimers()
  })

  it('rotate 为空且未修改时不应冗余调用 setModelRotation（避免拖拽后回正吸附）', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    // rotate 未设置（undefined），引擎运行时同为 0/0/0
    const setModelRotation = vi.fn()
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale: vi.fn(),
      setModelRotation,
    }
    mockGetModelRuntime.mockReturnValue({ relativeScale: 1, rotateX: 0, rotateY: 0, rotateZ: 0 })

    const wrapper = mountComponent(vm)
    await flushPromises()

    // 触发一次修改（改名称）→ 防抖保存；rotate 未变化，不应重新应用旋转
    const nameField = wrapper.findAll('.prop-field').find((f) => f.find('label').text() === '名称')
    await nameField!.find('input').setValue('改名')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(vm.updateHotspot).toHaveBeenCalled()
    expect(setModelRotation).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('rotate 为空时修改旋转 Y 应映射为 x=0, y=输入值, z=0', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    // rotate 未设置（undefined）→ 默认全零
    const setModelRotation = vi.fn()
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale: vi.fn(),
      setModelRotation,
    }
    mockGetModelRuntime.mockReturnValue(null)

    const wrapper = mountComponent(vm)
    await flushPromises()

    // 修改 Y 轴 → 空值默认映射 x=0, z=0
    const fields = wrapper.findAll('.prop-field')
    const rotY = fields.find((f) => f.find('label').text() === '旋转 Y')
    await rotY!.find('input').setValue('45')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(setModelRotation).toHaveBeenCalledWith('m1', 0, 45, 0)
    vi.useRealTimers()
  })

  it('rotate 为旧格式单值数字时映射到 Y 轴（修改 X 后验证三轴）', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    vm.hotspotViewModel.hotspots.value[0].rotate = 45 as unknown as string

    const setModelRotation = vi.fn()
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale: vi.fn(),
      setModelRotation,
    }
    mockGetModelRuntime.mockReturnValue({ relativeScale: 1, rotateX: 0, rotateY: 45, rotateZ: 0 })

    const wrapper = mountComponent(vm)
    await flushPromises()

    // 修改 X=15 → 单值 45 应保留在 Y 轴：x=15, y=45, z=0
    const fields = wrapper.findAll('.prop-field')
    const rotX = fields.find((f) => f.find('label').text() === '旋转 X')
    await rotX!.find('input').setValue('15')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(setModelRotation).toHaveBeenCalledWith('m1', 15, 45, 0)
    vi.useRealTimers()
  })

  it('拖拽松手后仅 ath/atv 变化（rotate 未变）不应重新调用 setModelRotation', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    // 已点过「面向中心」：rotate 落库为 '0 0 0'
    vm.hotspotViewModel.hotspots.value[0].rotate = '0 0 0' as unknown as number

    const setModelRotation = vi.fn()
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale: vi.fn(),
      setModelRotation,
    }
    mockGetModelRuntime.mockReturnValue({ relativeScale: 1, rotateX: 0, rotateY: 0, rotateZ: 0 })

    const wrapper = mountComponent(vm)
    await flushPromises()

    // 模拟拖拽松手：仅 ATH 变化触发表单 watch → 防抖保存
    const athField = wrapper.findAll('.prop-field').find((f) => f.find('label').text() === 'ATH')
    await athField!.find('input').setValue('-120')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(vm.updateHotspot).toHaveBeenCalled()
    // setRotateValues 内部先 lookAt 重新定基线；rotate 未变时重复调用会把模型拽回面向中心
    expect(setModelRotation).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('面向中心后修改旋转偏差应实时应用（变更触发不受跳过逻辑影响）', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    vm.hotspotViewModel.hotspots.value[0].rotate = '0 0 0' as unknown as number

    const setModelRotation = vi.fn()
    mockEngineAdapter.value = {
      orientModelToCenter: vi.fn(),
      getModelRuntime: mockGetModelRuntime,
      setModelRelativeScale: vi.fn(),
      setModelRotation,
    }
    mockGetModelRuntime.mockReturnValue({ relativeScale: 1, rotateX: 0, rotateY: 0, rotateZ: 0 })

    const wrapper = mountComponent(vm)
    await flushPromises()

    // 用户显式输入偏差 Y=30 → 必须应用
    const fields = wrapper.findAll('.prop-field')
    const rotY = fields.find((f) => f.find('label').text() === '旋转 Y')
    await rotY!.find('input').setValue('30')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(setModelRotation).toHaveBeenCalledWith('m1', 0, 30, 0)
    vi.useRealTimers()
  })

  it('非 model 热点不应调用 setModelRotation', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('image')

    const setModelRotation = vi.fn()
    mockEngineAdapter.value = {
      setModelRelativeScale: vi.fn(),
      setModelRotation,
    }

    const wrapper = mountComponent(vm)
    await flushPromises()

    // 触发一次修改（改名称）→ 防抖保存
    const nameField = wrapper.findAll('.prop-field').find((f) => f.find('label').text() === '名称')
    await nameField!.find('input').setValue('改名')
    vi.advanceTimersByTime(600)
    await flushPromises()

    expect(setModelRotation).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('engineAdapter 为 null 时不抛错', async () => {
    vi.useFakeTimers()
    const { vm } = createMockViewModel('model')
    mockEngineAdapter.value = null

    const wrapper = mountComponent(vm)
    await flushPromises()

    const nameField = wrapper.findAll('.prop-field').find((f) => f.find('label').text() === '名称')
    await nameField!.find('input').setValue('改名')
    vi.advanceTimersByTime(600)
    await flushPromises()

    // 不应抛错，updateHotspot 仍应被调用
    expect(vm.updateHotspot).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
