import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import type { Hotspot } from '@/types'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'

/**
 * 复现 bug：编辑模式下模型热点无法正常拖动。
 *
 * 根因（EditorCanvas.handlePointerMove 非 quad 分支）：
 *   engine.moveHotspotTo(id, coords.ath, coords.atv)
 * 把"鼠标原始球坐标"直接传给引擎，绕过了 ViewModel 的 dragOffset 修正
 * （startDrag 记录"鼠标与热点中心的偏移"，updateDragToCoords 用 鼠标-偏移
 * 得到新中心）。点击模型边缘拖动时，第一次 move 模型就会跳到鼠标点，
 * 松手后 ViewModel 提交的修正坐标与引擎显示坐标不一致，产生回弹。
 *
 * 期望：引擎收到的坐标必须与 ViewModel 修正后的 hotspot.ath/atv 一致。
 */

// engine mock：收集 moveHotspotTo / setDraggingMode / raycast / 反投影调用
const engineMock = {
  getHitHotspot: vi.fn<(...args: unknown[]) => string | null>(() => null),
  getCoordsFromPoint: vi.fn(() => ({ ath: 0, atv: 0 })),
  moveHotspotTo: vi.fn(),
  updateQuadGeometry: vi.fn(),
  setDraggingMode: vi.fn(),
  isDraggingMode: vi.fn(() => false),
  disableControls: vi.fn(),
  enableControls: vi.fn(),
  syncHotspots: vi.fn(),
  highlightHotspot: vi.fn(),
  unhighlightHotspot: vi.fn(),
  dispose: vi.fn(),
}

vi.mock('@/components/PanoEngineViewer.vue', () => ({
  default: {
    name: 'PanoEngineViewer',
    props: ['sceneData', 'tilingStatus', 'tilingProgress', 'hotspots', 'isDragging', 'allSceneData', 'sceneId'],
    emits: ['engine-ready', 'scene-changed'],
    template: '<div class="pano-viewer-stub" />',
    mounted() {
      // 挂载即吐出 engine（模拟 onEngineReady 时序）
      ;(this as unknown as { $emit: (e: string, p?: unknown) => void }).$emit('engine-ready', engineMock)
    },
  },
}))

vi.mock('@/stores/editor', () => ({
  useEditorStore: () =>
    reactive({
      engineAdapter: ref(null),
      markDirty: vi.fn(),
      setRightPanelSection: vi.fn(),
      setEngineAdapter: vi.fn(),
    }),
}))

function makeModelHotspot(): Hotspot {
  return {
    id: 'm1',
    sceneId: 's1',
    name: '模型热点',
    type: 'model',
    ath: 10,
    atv: 5,
    url: '/models/default-cube.glb',
  } as Hotspot
}

function makeVm(hotspots: Hotspot[]) {
  const hotspotList = ref<Hotspot[]>(hotspots)
  const selectedHotspot = ref<Hotspot | null>(hotspots[0] ?? null)
  const draggingHotspotId = ref<string | null>(null)
  let dragOffset = { ath: 0, atv: 0 }

  const vm = {
    activeTool: ref('select'),
    hotspotType: ref('info'),
    setRightPanelSection: vi.fn(),
    addHotspot: vi.fn(),
    updateHotspot: vi.fn(async () => {}),
    sceneViewModel: {
      currentScene: ref({ id: 's1', projectId: 'p1', name: 'S', previewUrl: '', thumbUrl: '', imageConfig: '', status: '', initialView: {} as never, location: {}, onstart: '', sortOrder: 0, createdAt: '', updatedAt: '' }),
      currentEngineSceneData: ref({}),
      currentTilingStatus: ref('READY'),
      currentTilingProgress: ref(100),
      allEngineSceneData: ref([]),
      tilingStatusMap: new Map(),
    },
    hotspotViewModel: {
      hotspots: hotspotList,
      selectedHotspot,
      draggingHotspotId,
      isDragging: ref(false),
      selectHotspot: vi.fn((id: string) => {
        selectedHotspot.value = hotspotList.value.find((x) => x.id === id) ?? null
      }),
      // 真实偏移逻辑的简化镜像：center = 鼠标 - offset
      startDrag: vi.fn((id: string, mouseAth: number, mouseAtv: number) => {
        const h = hotspotList.value.find((x) => x.id === id)
        if (!h) return
        draggingHotspotId.value = id
        dragOffset = { ath: mouseAth - h.ath, atv: mouseAtv - h.atv }
      }),
      updateDragToCoords: vi.fn((ath: number, atv: number) => {
        const h = hotspotList.value.find((x) => x.id === draggingHotspotId.value)
        if (!h) return
        h.ath = ath - dragOffset.ath
        h.atv = atv - dragOffset.atv
      }),
      endDrag: vi.fn(() => {
        draggingHotspotId.value = null
      }),
      forceEndDrag: vi.fn(),
      setCameraLock: vi.fn(),
    },
  }
  return { vm: vm as unknown as EditorViewModel, raw: vm, hotspotList }
}

async function mountCanvas(vm: EditorViewModel) {
  const { default: EditorCanvas } = await import('./EditorCanvas.vue')
  // 注意：PanoEngineViewer 已被 vi.mock 替换为 emit engine-ready 的轻量组件，
  // 不能再在 stubs 里覆盖（否则 engine-ready 永远不触发，engine 为 null）。
  const wrapper = mount(EditorCanvas, {
    props: { vm },
  })
  await flushPromises()
  return wrapper
}

describe('EditorCanvas — model 热点拖动', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    engineMock.getHitHotspot.mockReturnValue(null)
    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 0, atv: 0 })
  })

  it('点击命中模型后进入拖动，move 时引擎收到 ViewModel 修正后坐标（非鼠标原始坐标）', async () => {
    const { vm } = makeVm([makeModelHotspot()])
    const wrapper = await mountCanvas(vm)

    // 点击命中模型：raycast 返回 m1，点击点 (12, 8)，热点中心 (10, 5) → offset (2, 3)
    engineMock.getHitHotspot.mockReturnValue('m1')
    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 12, atv: 8 })
    await wrapper.find('.canvas-viewport').trigger('pointerdown', { clientX: 400, clientY: 300 })
    // 真实 VM.startDrag 被调用后 isDragging 才为 true；mock 里手动置位
    vm.hotspotViewModel.isDragging.value = true

    // 鼠标移到 (22, 18)：VM 修正后中心应为 (20, 15)，引擎应收到 (20, 15) 而非 (22, 18)
    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 22, atv: 18 })
    await wrapper.find('.canvas-viewport').trigger('pointermove', { clientX: 500, clientY: 350 })
    await flushPromises()

    expect(engineMock.moveHotspotTo).toHaveBeenCalled()
    const [, ath, atv] = engineMock.moveHotspotTo.mock.calls[0]
    expect(ath).toBeCloseTo(20, 6)
    expect(atv).toBeCloseTo(15, 6)
  })

  it('拖动期间引擎 syncHotspots 全量重建不被触发（isDragging 守卫）', async () => {
    const { vm, hotspotList } = makeVm([makeModelHotspot()])
    const wrapper = await mountCanvas(vm)
    // 挂载时 onEngineReady 会合法地做一次初始全量同步，清掉后再断言拖动期间不再触发
    engineMock.syncHotspots.mockClear()

    engineMock.getHitHotspot.mockReturnValue('m1')
    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 12, atv: 8 })
    await wrapper.find('.canvas-viewport').trigger('pointerdown', { clientX: 400, clientY: 300 })
    vm.hotspotViewModel.isDragging.value = true

    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 22, atv: 18 })
    await wrapper.find('.canvas-viewport').trigger('pointermove', { clientX: 500, clientY: 350 })
    await flushPromises()

    // 拖动修改了热点坐标，但引擎全量重建不应被触发（避免闪烁）
    expect(engineMock.syncHotspots).not.toHaveBeenCalled()
    // 且拖动标志已置位（阻止 PanoEngineViewer 内部 watcher 重建）
    expect(engineMock.setDraggingMode).toHaveBeenCalledWith(true)
    expect(hotspotList.value[0].ath).toBeCloseTo(20, 6)
  })

  it('松手后 endDrag 解除拖动标志并解锁相机', async () => {
    const { vm } = makeVm([makeModelHotspot()])
    const wrapper = await mountCanvas(vm)

    engineMock.getHitHotspot.mockReturnValue('m1')
    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 12, atv: 8 })
    await wrapper.find('.canvas-viewport').trigger('pointerdown', { clientX: 400, clientY: 300 })
    vm.hotspotViewModel.isDragging.value = true

    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 22, atv: 18 })
    await wrapper.find('.canvas-viewport').trigger('pointermove', { clientX: 500, clientY: 350 })

    await wrapper.find('.canvas-viewport').trigger('pointerup')
    await flushPromises()

    // endDrag 的坐标提交由 HotspotViewModel（真实实现）负责，已在 VM spec 覆盖；
    // 此处验证组件层的拖动收尾：endDrag 调用 + 引擎拖动标志解除
    expect(vm.hotspotViewModel.endDrag).toHaveBeenCalled()
    expect(engineMock.setDraggingMode).toHaveBeenCalledWith(false)
    expect(engineMock.moveHotspotTo).toHaveBeenLastCalledWith('m1', expect.any(Number), expect.any(Number))
  })

  it('点击命中热点后应调用 highlightHotspot 显示选中包围盒', async () => {
    const { vm } = makeVm([makeModelHotspot()])
    const wrapper = await mountCanvas(vm)
    engineMock.highlightHotspot.mockClear()
    engineMock.unhighlightHotspot.mockClear()

    engineMock.getHitHotspot.mockReturnValue('m1')
    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 12, atv: 8 })
    await wrapper.find('.canvas-viewport').trigger('pointerdown', { clientX: 400, clientY: 300 })
    await flushPromises()

    expect(engineMock.highlightHotspot).toHaveBeenCalledWith('m1')
  })

  it('点击空白处取消选中时应调用 unhighlightHotspot', async () => {
    const { vm } = makeVm([makeModelHotspot()])
    const wrapper = await mountCanvas(vm)

    // 先选中
    engineMock.getHitHotspot.mockReturnValue('m1')
    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 12, atv: 8 })
    await wrapper.find('.canvas-viewport').trigger('pointerdown', { clientX: 400, clientY: 300 })
    await flushPromises()
    engineMock.unhighlightHotspot.mockClear()

    // 再点空白（未命中）
    engineMock.getHitHotspot.mockReturnValue(null)
    await wrapper.find('.canvas-viewport').trigger('pointerdown', { clientX: 100, clientY: 100 })
    await flushPromises()

    expect(engineMock.unhighlightHotspot).toHaveBeenCalledWith('m1')
  })

  it('选中切换时应先 unhighlight 旧热点再 highlight 新热点', async () => {
    const second: Hotspot = { ...makeModelHotspot(), id: 'm2', name: '模型2' } as Hotspot
    const { vm } = makeVm([makeModelHotspot(), second])
    const wrapper = await mountCanvas(vm)

    // 选中 m1
    engineMock.getHitHotspot.mockReturnValue('m1')
    engineMock.getCoordsFromPoint.mockReturnValue({ ath: 12, atv: 8 })
    await wrapper.find('.canvas-viewport').trigger('pointerdown', { clientX: 400, clientY: 300 })
    await flushPromises()
    engineMock.unhighlightHotspot.mockClear()
    engineMock.highlightHotspot.mockClear()

    // 切换选中 m2
    engineMock.getHitHotspot.mockReturnValue('m2')
    await wrapper.find('.canvas-viewport').trigger('pointerdown', { clientX: 400, clientY: 300 })
    await flushPromises()

    expect(engineMock.unhighlightHotspot).toHaveBeenCalledWith('m1')
    expect(engineMock.highlightHotspot).toHaveBeenCalledWith('m2')
  })
})
