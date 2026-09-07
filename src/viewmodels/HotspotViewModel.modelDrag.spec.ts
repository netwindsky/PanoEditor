import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HotspotViewModel } from './HotspotViewModel'
import type { Hotspot, HotspotService } from '@/models'

function makeHotspot(overrides: Partial<Hotspot>): Hotspot {
  return {
    id: 'm1',
    sceneId: 's1',
    name: '模型热点',
    type: 'model',
    ath: 10,
    atv: 5,
    url: '/models/default-cube.glb',
    ...overrides,
  } as Hotspot
}

function makeService(): HotspotService {
  return {
    fetchHotspots: vi.fn(),
    createHotspot: vi.fn(),
    updateHotspot: vi.fn().mockImplementation((id, params) =>
      Promise.resolve({ ...makeHotspot({}), ...params }),
    ),
    deleteHotspot: vi.fn().mockResolvedValue(undefined),
  } as unknown as HotspotService
}

/**
 * 模型热点拖动（编辑模式）：
 * ViewModel 层拖拽逻辑类型无关，但需回归验证 model 类型：
 * 1. 拖动更新 ath/atv 并尊重点击偏移（不跳变）
 * 2. endDrag 提交 ath/atv 到后端，且不携带 points（model 无四边形顶点）
 */
describe('HotspotViewModel — model 热点拖动', () => {
  let service: HotspotService
  let vm: HotspotViewModel

  beforeEach(() => {
    service = makeService()
    vm = new HotspotViewModel(service)
    vm.hotspots.value = [makeHotspot({})]
  })

  it('startDrag 记录偏移后，updateDragToCoords 应用偏移（点击模型边缘拖动不跳变）', () => {
    // 热点中心 (10, 5)，点击点 (12, 8) → offset (2, 3)
    vm.startDrag('m1', 12, 8)

    // 鼠标移到 (22, 18) → 热点中心应为 (20, 15)，而非跳到鼠标点 (22, 18)
    vm.updateDragToCoords(22, 18)

    const h = vm.hotspots.value.find((x) => x.id === 'm1')!
    expect(h.ath).toBeCloseTo(20, 6)
    expect(h.atv).toBeCloseTo(15, 6)
  })

  it('endDrag 提交 ath/atv 且不携带 points/width/height 等无关字段', async () => {
    vm.startDrag('m1', 10, 5)
    vm.updateDragToCoords(30, -10)
    vm.endDrag()

    expect(service.updateHotspot).toHaveBeenCalledTimes(1)
    const [, params] = vi.mocked(service.updateHotspot).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(params.ath).toBeCloseTo(30, 6)
    expect(params.atv).toBeCloseTo(-10, 6)
    expect(params).not.toHaveProperty('points')
  })

  it('atv 越界时被钳制在 [-90, 90]，ath 归一化到 (-180, 180]', () => {
    vm.startDrag('m1', 10, 5)
    vm.updateDragToCoords(200, 120)

    const h = vm.hotspots.value.find((x) => x.id === 'm1')!
    // offset ath=0（10-10）、atv=0 → newAth=200 归一化 → -160，newAtv 钳制 90
    expect(h.ath).toBe(-160)
    expect(h.atv).toBe(90)
  })
})
