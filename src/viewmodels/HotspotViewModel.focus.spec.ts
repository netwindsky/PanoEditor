import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HotspotViewModel } from './HotspotViewModel'
import type { Hotspot, HotspotService } from '@/models'

/**
 * TDD：相机跟随逻辑归位 ViewModel（MVC：View 不做坐标换算）。
 *
 * 背景：此前「点击标注列表 → 相机转向热点」的几何计算写在
 * HotspotProperties.vue（View 层）：points 中心、yaw+180 归一化全部
 * 在组件里。数据真相分裂两处（ath/atv 与 points 各自演化）导致
 * 相机转向旧位置的 bug 也源于此。
 *
 * 正确架构：VM 暴露 focusHotspot(id)——选中 + 计算聚焦坐标 + 通过注入的
 * CameraNavigator 驱动相机；View 只调用，不感知换算。
 * 聚焦坐标语义：quad/video/web 用 points 中心（与引擎渲染锚点一致），
 * 其余类型用 ath/atv。
 */

function makeService(): HotspotService {
  return {
    fetchHotspots: vi.fn(),
    createHotspot: vi.fn(),
    updateHotspot: vi.fn().mockImplementation((id, params) => Promise.resolve({ id, ...params } as Hotspot)),
    deleteHotspot: vi.fn().mockResolvedValue(undefined),
  } as unknown as HotspotService
}

function makeNavigator() {
  return { animateToView: vi.fn() }
}

describe('HotspotViewModel.focusHotspot — 相机跟随（VM 层）', () => {
  let vm: HotspotViewModel
  let navigator: ReturnType<typeof makeNavigator>

  beforeEach(() => {
    vm = new HotspotViewModel(makeService())
    navigator = makeNavigator()
    vm.setCameraNavigator(navigator)
  })

  it('info 热点：yaw = ath + 180（归一化 (-180,180]），pitch = atv', () => {
    vm.hotspots.value = [
      { id: 'h1', sceneId: 's1', name: 'a', type: 'info', ath: 71.24, atv: -19.49 } as Hotspot,
    ]
    vm.focusHotspot('h1')

    // 71.24 + 180 = 251.24 → -108.76
    expect(vm.selectedHotspot.value?.id).toBe('h1')
    expect(navigator.animateToView).toHaveBeenCalledWith({
      yaw: expect.closeTo(-108.76, 5),
      pitch: -19.49,
    })
  })

  it('ath=-170 → yaw=10（归一化边界）', () => {
    vm.hotspots.value = [
      { id: 'h3', sceneId: 's1', name: 'c', type: 'info', ath: -170, atv: 5 } as Hotspot,
    ]
    vm.focusHotspot('h3')
    expect(navigator.animateToView).toHaveBeenCalledWith({ yaw: 10, pitch: 5 })
  })

  it('web 热点（带 points）：以 points 中心为聚焦目标，而非脱节的 ath/atv', () => {
    vm.hotspots.value = [
      {
        id: 'w1',
        sceneId: 's1',
        name: '网页热点',
        type: 'web',
        ath: -148.61, // 旧值（脱节 70°+ 的线上 bug 现场）
        atv: -3.34,
        points: '-80 -10 -70 -10 -70 10 -80 10', // 中心 (-75, 0)
      } as Hotspot,
    ]
    vm.focusHotspot('w1')

    expect(navigator.animateToView).toHaveBeenCalledWith({
      yaw: expect.closeTo(105, 5), // -75 + 180 = 105
      pitch: expect.closeTo(0, 5),
    })
  })

  it('quad 热点带 points 时同样以 points 中心为目标', () => {
    vm.hotspots.value = [
      {
        id: 'q1',
        sceneId: 's1',
        name: '矩形',
        type: 'quad',
        ath: 10,
        atv: 5,
        points: '40 -10 50 -10 50 10 40 10', // 中心 (45, 0)
      } as Hotspot,
    ]
    vm.focusHotspot('q1')
    expect(navigator.animateToView).toHaveBeenCalledWith({
      yaw: expect.closeTo(-135, 5), // 45 + 180 = 225 → -135
      pitch: expect.closeTo(0, 5),
    })
  })

  it('getFocusCoords：未知热点返回 null；未注入 navigator 时 focusHotspot 只选中不崩溃', () => {
    vm.hotspots.value = [
      { id: 'h1', sceneId: 's1', name: 'a', type: 'info', ath: 10, atv: 20 } as Hotspot,
    ]
    expect(vm.getFocusCoords('nope')).toBeNull()

    const bare = new HotspotViewModel(makeService())
    bare.hotspots.value = [...vm.hotspots.value]
    bare.focusHotspot('h1')
    expect(bare.selectedHotspot.value?.id).toBe('h1')
  })
})

describe('HotspotViewModel.endVertexDrag — 顶点拖拽不变量（VM 层）', () => {
  let vm: HotspotViewModel
  let service: HotspotService

  beforeEach(() => {
    service = makeService()
    vm = new HotspotViewModel(service)
  })

  it('endVertexDrag 将 ath/atv 同步为 points 中心并一并提交', () => {
    vm.hotspots.value = [
      {
        id: 'w1',
        sceneId: 's1',
        name: '网页热点',
        type: 'web',
        ath: -148.61, // 脱节旧值
        atv: -3.34,
        points: '-80 -10 -70 -10 -70 10 -80 10',
      } as Hotspot,
    ]
    vm.selectHotspot('w1')

    vm.endVertexDrag()

    // 模型不变量：ath/atv = points 中心
    expect(vm.hotspots.value[0].ath).toBeCloseTo(-75, 5)
    expect(vm.hotspots.value[0].atv).toBeCloseTo(0, 5)
    // 提交包含 points + 同步后的 ath/atv
    expect(service.updateHotspot).toHaveBeenCalledWith(
      'w1',
      expect.objectContaining({
        points: '-80 -10 -70 -10 -70 10 -80 10',
        ath: expect.closeTo(-75, 5),
        atv: expect.closeTo(0, 5),
      }),
    )
  })

  it('无选中/无 points 时 endVertexDrag 安全返回', () => {
    expect(() => vm.endVertexDrag()).not.toThrow()
    vm.hotspots.value = [
      { id: 'i1', sceneId: 's1', name: 'a', type: 'info', ath: 0, atv: 0 } as Hotspot,
    ]
    vm.selectHotspot('i1')
    expect(() => vm.endVertexDrag()).not.toThrow()
    expect(service.updateHotspot).not.toHaveBeenCalled()
  })
})
