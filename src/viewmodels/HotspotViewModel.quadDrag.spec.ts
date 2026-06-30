import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HotspotViewModel } from './HotspotViewModel'
import type { Hotspot, HotspotService } from '@/models'

function makeQuadLikeHotspot(
  id: string,
  type: 'quad' | 'video' = 'quad',
  ath = 0,
  atv = 0,
  points = '0 0 10 0 10 10 0 10',
): Hotspot {
  return {
    id,
    sceneId: 's1',
    name: `${type === 'video' ? '视频' : '四边形'}-${id}`,
    type,
    ath,
    atv,
    points,
  } as Hotspot
}

function makeQuadHotspot(
  id: string,
  ath = 0,
  atv = 0,
  points = '0 0 10 0 10 10 0 10',
): Hotspot {
  return makeQuadLikeHotspot(id, 'quad', ath, atv, points)
}

function makeService(): HotspotService {
  return {
    fetchHotspots: vi.fn(),
    createHotspot: vi.fn(),
    updateHotspot: vi.fn().mockImplementation((id, params) =>
      Promise.resolve(makeQuadLikeHotspot(id, 'quad', params.ath ?? 0, params.atv ?? 0, params.points)),
    ),
    deleteHotspot: vi.fn().mockResolvedValue(undefined),
  } as unknown as HotspotService
}

describe('HotspotViewModel 四边形热点整体拖拽', () => {
  let service: HotspotService
  let vm: HotspotViewModel

  beforeEach(() => {
    service = makeService()
    vm = new HotspotViewModel(service)
  })

  it('开始拖拽四边形热点时应记录初始 points', () => {
    const h = makeQuadHotspot('q1', 5, 5, '10 20 30 20 30 40 10 40')
    vm.hotspots.value = [h]
    vm.selectHotspot('q1')
    vm.startDrag('q1', 5, 5)

    // 拖拽开始后，内部应记录初始 points
    expect(vm.hotspots.value[0].points).toBe('10 20 30 20 30 40 10 40')
  })

  it('拖拽四边形时，center 和 4 个顶点应同步平移相同 delta', () => {
    const h = makeQuadHotspot('q1', 0, 0, '0 0 10 0 10 10 0 10')
    vm.hotspots.value = [h]
    vm.selectHotspot('q1')
    vm.startDrag('q1', 0, 0)

    // 先拖到 (5, 5) —— 此时 delta = (5, 5)
    vm.updateDragToCoords(5, 5)

    // center 更新
    expect(vm.hotspots.value[0].ath).toBe(5)
    expect(vm.hotspots.value[0].atv).toBe(5)

    // 4 个顶点同步平移 (5, 5)
    expect(vm.hotspots.value[0].points).toBe('5 5 15 5 15 15 5 15')

    // 继续拖到 (8, 3) —— 从初始 (0,0) 的总 delta = (8, 3)
    vm.updateDragToCoords(8, 3)
    expect(vm.hotspots.value[0].ath).toBe(8)
    expect(vm.hotspots.value[0].atv).toBe(3)
    expect(vm.hotspots.value[0].points).toBe('8 3 18 3 18 13 8 13')
  })

  it('拖拽四边形跨越 ath 边界时应正确归一化', () => {
    const h = makeQuadHotspot('q1', 170, 0, '170 0 180 0 180 10 170 10')
    vm.hotspots.value = [h]
    vm.selectHotspot('q1')
    vm.startDrag('q1', 170, 0)

    // 向右拖到 190°（越过 +180 边界，应归一化为 -170）
    vm.updateDragToCoords(190, 0)
    expect(vm.hotspots.value[0].ath).toBeCloseTo(-170, 5)
    // 顶点也应同步归一化：170+20=190→-170, 180+20=200→-160
    const pts = vm.hotspots.value[0].points!.split(/\s+/).map(Number)
    expect(pts[0]).toBeCloseTo(-170, 5) // 第一个顶点 ath
    expect(pts[2]).toBeCloseTo(-160, 5) // 第二个顶点 ath
  })

  it('endDrag 后应同时提交 center 和 points 到后端', () => {
    const h = makeQuadHotspot('q1', 0, 0, '0 0 10 0 10 10 0 10')
    vm.hotspots.value = [h]
    vm.selectHotspot('q1')
    vm.startDrag('q1', 0, 0)

    vm.updateDragToCoords(5, 5)
    vm.endDrag()

    expect(service.updateHotspot).toHaveBeenCalledWith('q1', {
      ath: 5,
      atv: 5,
      points: '5 5 15 5 15 15 5 15',
    })
  })

  it('拖拽视频热点时，center 和 4 个顶点应像 quad 一样同步平移', () => {
    const h = makeQuadLikeHotspot('v1', 'video', 0, 0, '0 0 10 0 10 10 0 10')
    vm.hotspots.value = [h]
    vm.selectHotspot('v1')
    vm.startDrag('v1', 0, 0)

    vm.updateDragToCoords(5, 5)

    expect(vm.hotspots.value[0].ath).toBe(5)
    expect(vm.hotspots.value[0].atv).toBe(5)
    expect(vm.hotspots.value[0].points).toBe('5 5 15 5 15 15 5 15')
  })

  it('视频热点 endDrag 后应同时提交 center 和 points 到后端', () => {
    const h = makeQuadLikeHotspot('v1', 'video', 0, 0, '0 0 10 0 10 10 0 10')
    vm.hotspots.value = [h]
    vm.selectHotspot('v1')
    vm.startDrag('v1', 0, 0)

    vm.updateDragToCoords(5, 5)
    vm.endDrag()

    expect(service.updateHotspot).toHaveBeenCalledWith('v1', {
      ath: 5,
      atv: 5,
      points: '5 5 15 5 15 15 5 15',
    })
  })

  it('非四边形热点拖拽不应修改 points', () => {
    const infoH = {
      id: 'i1',
      sceneId: 's1',
      name: '信息点',
      type: 'info',
      ath: 10,
      atv: 20,
    } as Hotspot
    vm.hotspots.value = [infoH]
    vm.selectHotspot('i1')
    vm.startDrag('i1', 10, 20)

    vm.updateDragToCoords(15, 25)
    expect(vm.hotspots.value[0].ath).toBe(15)
    expect(vm.hotspots.value[0].atv).toBe(25)
    expect(vm.hotspots.value[0].points).toBeUndefined()
  })

  it('点击偏移在拖动全程保持不变（不跳变）', () => {
    // 热点中心在 (0, 0)，鼠标点击在 (3, 2) → offset = (3, 2)
    const h = makeQuadHotspot('q1', 0, 0, '0 0 10 0 10 10 0 10')
    vm.hotspots.value = [h]
    vm.selectHotspot('q1')
    vm.startDrag('q1', 3, 2)

    // 鼠标移动到 (8, 7) → 热点中心 = 鼠标 - offset = (5, 5)
    vm.updateDragToCoords(8, 7)
    expect(vm.hotspots.value[0].ath).toBe(5)
    expect(vm.hotspots.value[0].atv).toBe(5)

    // 鼠标继续移动到 (13, 12) → 热点中心 = (10, 10)
    vm.updateDragToCoords(13, 12)
    expect(vm.hotspots.value[0].ath).toBe(10)
    expect(vm.hotspots.value[0].atv).toBe(10)

    // 关键：整个拖动过程中，鼠标与热点中心的差值始终 = offset = (3, 2)
    // 即点击点相对热点中心的位置不变，不会跳变
  })

  it('非零初始中心 + 非零偏移时拖动正确', () => {
    // 热点中心在 (20, 10)，鼠标点击在 (25, 12) → offset = (5, 2)
    const h = makeQuadHotspot('q1', 20, 10, '20 10 30 10 30 20 20 20')
    vm.hotspots.value = [h]
    vm.selectHotspot('q1')
    vm.startDrag('q1', 25, 12)

    // 鼠标移动到 (30, 17) → 热点中心 = (30-5, 17-2) = (25, 15)
    vm.updateDragToCoords(30, 17)
    expect(vm.hotspots.value[0].ath).toBe(25)
    expect(vm.hotspots.value[0].atv).toBe(15)

    // 4 顶点同步平移 delta = (25-20, 15-10) = (5, 5)
    expect(vm.hotspots.value[0].points).toBe('25 15 35 15 35 25 25 25')
  })
})
