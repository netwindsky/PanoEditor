import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HotspotViewModel } from './HotspotViewModel'
import type { Hotspot, HotspotService } from '@/models'

function makeHotspot(id: string, ath = 0, atv = 0): Hotspot {
  return {
    id,
    sceneId: 's1',
    name: `热点-${id}`,
    type: 'info',
    ath,
    atv,
  } as Hotspot
}

function makeService(): HotspotService {
  return {
    fetchHotspots: vi.fn(),
    createHotspot: vi.fn(),
    updateHotspot: vi.fn().mockImplementation((id, params) =>
      Promise.resolve(makeHotspot(id, params.ath, params.atv)),
    ),
    deleteHotspot: vi.fn().mockResolvedValue(undefined),
  } as unknown as HotspotService
}

/**
 * 方案 B：拖拽热点改为“绝对定位”。
 * 拖拽时由组件层用引擎反投影(getCoordsFromPoint)拿到鼠标当前对应的
 * 绝对 ath/atv，调用 updateDragToCoords 直接写入热点坐标——
 * 不再用 movementX/Y × 固定灵敏度的像素增量（那会导致上下颠倒、左右不跟手）。
 */
describe('HotspotViewModel.updateDragToCoords 绝对定位', () => {
  let service: HotspotService
  let vm: HotspotViewModel

  beforeEach(() => {
    service = makeService()
    vm = new HotspotViewModel(service)
    vm.hotspots.value = [makeHotspot('a', 0, 0)]
    // 传入与热点中心相同的鼠标坐标 → offset = 0，保持原有"绝对定位"测试语义
    vm.startDrag('a', 0, 0)
  })

  it('应把拖拽中热点的 ath/atv 直接设为传入的绝对坐标', () => {
    vm.updateDragToCoords(45, -30)
    const h = vm.hotspots.value.find((x) => x.id === 'a')!
    expect(h.ath).toBe(45)
    expect(h.atv).toBe(-30)
  })

  it('atv 应被约束在 [-90, 90]', () => {
    vm.updateDragToCoords(0, 120)
    expect(vm.hotspots.value[0].atv).toBe(90)
    vm.updateDragToCoords(0, -120)
    expect(vm.hotspots.value[0].atv).toBe(-90)
  })

  it('ath 应被归一化到 (-180, 180]', () => {
    vm.updateDragToCoords(190, 0)
    expect(vm.hotspots.value[0].ath).toBeGreaterThan(-180)
    expect(vm.hotspots.value[0].ath).toBeLessThanOrEqual(180)
    expect(vm.hotspots.value[0].ath).toBeCloseTo(-170, 5)
  })

  it('未处于拖拽状态时调用不应改变坐标', () => {
    vm.endDrag()
    vm.updateDragToCoords(99, 99)
    // endDrag 已提交并清空拖拽，再次调用不应再修改热点
    const h = vm.hotspots.value.find((x) => x.id === 'a')!
    expect(h.ath).toBe(0)
    expect(h.atv).toBe(0)
  })

  it('endDrag 后应以最终绝对坐标提交后端', () => {
    vm.updateDragToCoords(60, -20)
    vm.endDrag()
    expect(service.updateHotspot).toHaveBeenCalledWith('a', { ath: 60, atv: -20 })
  })
})
