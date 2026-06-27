import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HotspotViewModel } from './HotspotViewModel'
import type { CameraLock } from './HotspotViewModel'
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
    updateHotspot: vi.fn().mockResolvedValue(makeHotspot('a')),
    deleteHotspot: vi.fn().mockResolvedValue(undefined),
  } as unknown as HotspotService
}

/** 构造 CameraLock 的 mock */
function makeCameraLock(): CameraLock {
  return {
    lock: vi.fn(),
    unlock: vi.fn(),
  }
}

describe('HotspotViewModel 拖拽时锁定全景旋转', () => {
  let service: HotspotService
  let vm: HotspotViewModel
  let cameraLock: CameraLock

  beforeEach(() => {
    service = makeService()
    vm = new HotspotViewModel(service)
    cameraLock = makeCameraLock()
    vm.setCameraLock(cameraLock)
    vm.hotspots.value = [makeHotspot('a')]
  })

  it('startDrag 时锁定全景旋转', () => {
    vm.startDrag('a')
    expect(cameraLock.lock).toHaveBeenCalledTimes(1)
    expect(cameraLock.unlock).not.toHaveBeenCalled()
  })

  it('endDrag 时解锁全景旋转', () => {
    vm.startDrag('a')
    vm.endDrag()
    expect(cameraLock.unlock).toHaveBeenCalledTimes(1)
  })

  it('endDrag 在未拖拽时不解锁(防御性检查)', () => {
    vm.endDrag()
    expect(cameraLock.unlock).not.toHaveBeenCalled()
  })

  it('forceEndDrag 在拖拽中时解锁并清空拖拽状态', () => {
    vm.startDrag('a')
    vm.forceEndDrag()
    expect(cameraLock.unlock).toHaveBeenCalledTimes(1)
    expect(vm.draggingHotspotId.value).toBeNull()
    expect(vm.isDragging.value).toBe(false)
  })

  it('forceEndDrag 在未拖拽时不解锁(避免无意义调用)', () => {
    vm.forceEndDrag()
    expect(cameraLock.unlock).not.toHaveBeenCalled()
  })

  it('forceEndDrag 不向后端提交更新(异常恢复不应误写)', () => {
    vm.startDrag('a')
    vm.forceEndDrag()
    expect(service.updateHotspot).not.toHaveBeenCalled()
  })

  it('未注入 CameraLock 时 startDrag/endDrag 不报错', () => {
    const vm2 = new HotspotViewModel(service)
    vm2.hotspots.value = [makeHotspot('a')]
    expect(() => {
      vm2.startDrag('a')
      vm2.endDrag()
    }).not.toThrow()
  })
})
