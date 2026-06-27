import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HotspotViewModel } from './HotspotViewModel'
import type { Hotspot, HotspotService } from '@/models'

/** 构造一个最小可用的热点对象 */
function makeHotspot(id: string): Hotspot {
  return {
    id,
    sceneId: 's1',
    name: `热点-${id}`,
    type: 'info',
    ath: 0,
    atv: 0,
  } as Hotspot
}

/** 构造 HotspotService 的 mock */
function makeService(): HotspotService {
  return {
    fetchHotspots: vi.fn(),
    createHotspot: vi.fn(),
    updateHotspot: vi.fn(),
    deleteHotspot: vi.fn().mockResolvedValue(undefined),
  } as unknown as HotspotService
}

describe('HotspotViewModel.clearHotspots', () => {
  let service: HotspotService
  let vm: HotspotViewModel

  beforeEach(() => {
    service = makeService()
    vm = new HotspotViewModel(service)
    vm.hotspots.value = [makeHotspot('a'), makeHotspot('b'), makeHotspot('c')]
  })

  it('对每个热点调用 service.deleteHotspot', async () => {
    await vm.clearHotspots()
    expect(service.deleteHotspot).toHaveBeenCalledTimes(3)
    expect(service.deleteHotspot).toHaveBeenCalledWith('a')
    expect(service.deleteHotspot).toHaveBeenCalledWith('b')
    expect(service.deleteHotspot).toHaveBeenCalledWith('c')
  })

  it('清空后本地 hotspots 列表为空', async () => {
    await vm.clearHotspots()
    expect(vm.hotspots.value).toHaveLength(0)
  })

  it('清空后选中热点被重置为 null', async () => {
    vm.selectedHotspot.value = vm.hotspots.value[0]
    await vm.clearHotspots()
    expect(vm.selectedHotspot.value).toBeNull()
  })

  it('空列表时不调用 deleteHotspot，且不报错', async () => {
    vm.hotspots.value = []
    await vm.clearHotspots()
    expect(service.deleteHotspot).not.toHaveBeenCalled()
    expect(vm.hotspots.value).toHaveLength(0)
  })
})
