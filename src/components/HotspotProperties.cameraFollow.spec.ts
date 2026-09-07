import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { Hotspot } from '@/types'

/**
 * 需求：点击右侧面板"标注"列表里的标注时，除了选中该热点，
 * 还要驱动相机旋转到该热点朝向（把该热点摆到画面中央）。
 *
 * 坐标转换推导：
 *   PanoEngine.projectToScreen 把 (ath, atv) 放到方向向量
 *     D_hs = (-cos(atv)·sin(ath), -sin(atv),  cos(atv)·cos(ath))
 *   即 ath=0,atv=0 的热点在 +Z 方向。
 *
 *   PanoEngine.setCameraView 用 Euler(-vlookat, -hlookat, 0, 'YXZ') 转相机，
 *   把相机默认 forward=(0,0,-1) 变成
 *     D_cam = ( cos(v)·sin(h), -sin(v), -cos(v)·cos(h))     (h=hlookat, v=vlookat)
 *   即 hlookat=0,vlookat=0 时相机看 -Z。
 *
 *   令 D_cam = D_hs 解得：
 *     sin(v) = sin(atv), cos(v) = cos(atv)   →   vlookat = atv
 *     sin(h) = -sin(ath), cos(h) = -cos(ath) →   hlookat = ath + 180°
 *
 *   animateToView 的 { yaw, pitch } 就是 { hlookat, vlookat } 的透传，
 *   所以：**yaw = ath + 180, pitch = atv**。
 *
 * 期望值归一化到 (-180, 180]：
 *   ath=71.24  → 251.24 → -108.76
 *   ath=45     → 225    → -135
 *   ath=-170   → 10     →  10
 * pitch = atv（不取反）。
 */

// ===== Mock element-plus =====
vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))

// ===== Mock editor store =====
const animateToView = vi.fn()
const engineAdapter = { animateToView }
const useEditorStoreMock = vi.fn(() => ({ engineAdapter }))

vi.mock('@/stores/editor', () => ({
  useEditorStore: () => useEditorStoreMock(),
}))

import HotspotProperties from '@/components/HotspotProperties.vue'

// ===== ViewModel mock =====
function createMockViewModel() {
  const hotspots = ref<Hotspot[]>([
    { id: 'h1', sceneId: 's1', name: '热点1', type: 'info', ath: 71.24, atv: -19.49 } as Hotspot,
    { id: 'h2', sceneId: 's1', name: '热点2', type: 'image', ath: 45, atv: 10, url: 'x' } as Hotspot,
    { id: 'h3', sceneId: 's1', name: '热点3', type: 'scene', ath: -170, atv: 5, linkedSceneId: 's2' } as Hotspot,
  ])
  const selectedHotspot = ref<Hotspot | null>(hotspots.value[0])
  const scenes = ref([
    { id: 's1', projectId: 'p1', name: '场景1', previewUrl: '', thumbUrl: '', imageConfig: '', status: '', initialView: { hfov: 120, pitch: 0, yaw: 0 }, order: 0, createdAt: '', updatedAt: '' },
  ])

  const vm = {
    hotspotViewModel: {
      hotspots,
      selectedHotspot,
      selectHotspot: vi.fn((id: string) => {
        selectedHotspot.value = hotspots.value.find((h) => h.id === id) || null
      }),
      // MVC：View 只调用 focusHotspot，坐标换算在 VM（真实实现见 HotspotViewModel.focus.spec）
      focusHotspot: vi.fn((id: string) => {
        selectedHotspot.value = hotspots.value.find((h) => h.id === id) || null
      }),
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
      resources: ref([]),
      loadResources: vi.fn(),
      uploadResource: vi.fn(),
    },
    currentProject: ref({ id: 'p1', name: 'p', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' }),
    addHotspot: vi.fn(),
    removeHotspot: vi.fn(),
    clearAllHotspots: vi.fn(),
    updateHotspot: vi.fn(),
    uploadResource: vi.fn(),
  }
  return { vm, hotspots }
}

const stubs = {
  'el-button': {
    template: '<button class="el-button" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
  'el-input': { template: '<input class="el-input" />' },
  'el-input-number': { template: '<input class="el-input-number" />' },
  'el-select': { template: '<div class="el-select"><slot /></div>' },
  'el-option': { template: '<div class="el-option"><slot /></div>' },
  'el-icon': { template: '<span class="el-icon"><slot /></span>' },
  'el-dialog': { template: '<div class="el-dialog"><slot /></div>' },
}

function mountComponent(vm: ReturnType<typeof createMockViewModel>['vm']) {
  return mount(HotspotProperties, {
    global: {
      provide: { editorViewModel: vm },
      stubs,
    },
  })
}

describe('HotspotProperties 相机跟随选中', () => {
  beforeEach(() => {
    animateToView.mockReset()
    // 默认恢复：engineAdapter 存在
    useEditorStoreMock.mockReturnValue({ engineAdapter })
  })

  it('点击列表项应调用 focusHotspot（MVC：选中+相机跟随契约归 VM）', async () => {
    const { vm } = createMockViewModel()
    const wrapper = mountComponent(vm)

    const items = wrapper.findAll('.list-item')
    // h2: ath=45, atv=10 -> yaw=45+180=225 -> 归一化 -135, pitch=10（换算在 VM spec 覆盖）
    await items[1].trigger('click')

    expect(vm.hotspotViewModel.focusHotspot).toHaveBeenCalledTimes(1)
    expect(vm.hotspotViewModel.focusHotspot).toHaveBeenCalledWith('h2')
  })

  it('点击列表项在选中之外仍会触发相机跟随（focusHotspot 内部包含两者）', async () => {
    const { vm } = createMockViewModel()
    const wrapper = mountComponent(vm)

    const items = wrapper.findAll('.list-item')
    // h3: ath=-170, atv=5
    await items[2].trigger('click')

    expect(vm.hotspotViewModel.focusHotspot).toHaveBeenCalledWith('h3')
  })

  it('已经选中同一热点时再次点击也应触发相机动画（用户希望"重新聚焦"）', async () => {
    const { vm } = createMockViewModel()
    const wrapper = mountComponent(vm)

    const items = wrapper.findAll('.list-item')
    // h1 是初始选中项
    await items[0].trigger('click')

    expect(vm.hotspotViewModel.focusHotspot).toHaveBeenCalledWith('h1')
  })

  it('engineAdapter 尚未就绪（null）时 focusHotspot 不抛错（坐标换算在 VM，与 adapter 无关）', async () => {
    useEditorStoreMock.mockReturnValue({ engineAdapter: null })

    const { vm } = createMockViewModel()
    const wrapper = mountComponent(vm)

    const items = wrapper.findAll('.list-item')
    await items[1].trigger('click')

    // focusHotspot 仍应触发（View 契约不因 adapter 缺失而改变）
    expect(vm.hotspotViewModel.focusHotspot).toHaveBeenCalledWith('h2')
    // animateToView 不应触发（VM 的 navigator 为空实现时安全降级）
    expect(animateToView).not.toHaveBeenCalled()
  })

  it('web 热点（带 points）点击同样走 focusHotspot（points 中心换算在 VM 内）', async () => {
    const { vm } = createMockViewModel()
    const webHotspot: Hotspot = {
      id: 'w1',
      sceneId: 's1',
      name: '网页热点',
      type: 'web',
      ath: -148.61,
      atv: -3.34, // 旧 ath/atv（与 points 中心脱节 70°+，正是线上 bug 现场）
      points: '-80 -10 -70 -10 -70 10 -80 10', // 中心 ≈ (-75, 0)
    } as unknown as Hotspot
    vm.hotspotViewModel.hotspots.value.push(webHotspot)
    const wrapper = mountComponent(vm)

    const items = wrapper.findAll('.list-item')
    await items[items.length - 1].trigger('click')

    expect(vm.hotspotViewModel.focusHotspot).toHaveBeenCalledWith('w1')
  })

  it('quad 热点带 points 时同样走 focusHotspot', async () => {
    const { vm } = createMockViewModel()
    const quadHotspot: Hotspot = {
      id: 'q1',
      sceneId: 's1',
      name: '矩形热点',
      type: 'quad',
      ath: 10,
      atv: 5,
      points: '40 -10 50 -10 50 10 40 10', // 中心 (45, 0)
    } as unknown as Hotspot
    vm.hotspotViewModel.hotspots.value.push(quadHotspot)
    const wrapper = mountComponent(vm)

    const items = wrapper.findAll('.list-item')
    await items[items.length - 1].trigger('click')

    expect(vm.hotspotViewModel.focusHotspot).toHaveBeenCalledWith('q1')
  })
})
