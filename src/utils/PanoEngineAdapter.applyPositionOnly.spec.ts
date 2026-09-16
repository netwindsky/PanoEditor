import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PanoEngineAdapter } from './PanoEngineAdapter'

/**
 * TDD：applyPositionOnly — 增量位置同步（ath/atv/points 变化时跳过全量重建）。
 *
 * 路由规则（与 isMeshQuad 一致）：
 * - quad/video → updateQuadGeometry（mesh 几何体顶点更新）
 * - model/web/info/image/scene/css3d → moveHotspotTo（DOM 或单点重投影）
 */

function makeAdapter(
  mockUpdateQuadGeometry = vi.fn(),
  mockUpdateHotspotPosition = vi.fn(),
): PanoEngineAdapter {
  const adapter = Object.create(PanoEngineAdapter.prototype) as PanoEngineAdapter
  ;(adapter as unknown as { engine: { hotspotsManager: { updateQuadGeometry: ReturnType<typeof vi.fn>; updateHotspotPosition: ReturnType<typeof vi.fn> } } }).engine = {
    hotspotsManager: {
      updateQuadGeometry: mockUpdateQuadGeometry,
      updateHotspotPosition: mockUpdateHotspotPosition,
    },
  }
  return adapter
}

describe('PanoEngineAdapter.applyPositionOnly — 增量位置同步', () => {
  let updateQuad: ReturnType<typeof vi.fn>
  let updatePos: ReturnType<typeof vi.fn>
  let adapter: PanoEngineAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    updateQuad = vi.fn()
    updatePos = vi.fn()
    adapter = makeAdapter(updateQuad, updatePos)
  })

  it('quad 热点 → updateQuadGeometry（mesh 几何体顶点更新）', () => {
    adapter.applyPositionOnly({ id: 'q1', type: 'quad', ath: 10, atv: 20, points: '1 2 3 4 5 6 7 8' } as never)

    expect(updateQuad).toHaveBeenCalledWith('q1', '1 2 3 4 5 6 7 8')
    expect(updatePos).not.toHaveBeenCalled()
  })

  it('video 热点 → updateQuadGeometry', () => {
    adapter.applyPositionOnly({ id: 'v1', type: 'video', ath: 30, atv: 40, points: '9 10 11 12 13 14 15 16' } as never)

    expect(updateQuad).toHaveBeenCalledWith('v1', '9 10 11 12 13 14 15 16')
    expect(updatePos).not.toHaveBeenCalled()
  })

  it('model 热点 → moveHotspotTo（不触发 lookAt）', () => {
    adapter.applyPositionOnly({ id: 'm1', type: 'model', ath: 50, atv: -30 } as never)

    expect(updatePos).toHaveBeenCalledWith('m1', 50, -30)
    expect(updateQuad).not.toHaveBeenCalled()
  })

  it('web 热点 → moveHotspotTo', () => {
    adapter.applyPositionOnly({ id: 'w1', type: 'web', ath: 15, atv: 25 } as never)

    expect(updatePos).toHaveBeenCalledWith('w1', 15, 25)
    expect(updateQuad).not.toHaveBeenCalled()
  })

  it('info 热点 → moveHotspotTo', () => {
    adapter.applyPositionOnly({ id: 'i1', type: 'info', ath: -10, atv: 5 } as never)

    expect(updatePos).toHaveBeenCalledWith('i1', -10, 5)
    expect(updateQuad).not.toHaveBeenCalled()
  })

  it('scene 热点 → moveHotspotTo', () => {
    adapter.applyPositionOnly({ id: 's1', type: 'scene', ath: 0, atv: 0 } as never)

    expect(updatePos).toHaveBeenCalledWith('s1', 0, 0)
    expect(updateQuad).not.toHaveBeenCalled()
  })

  it('image 热点 → moveHotspotTo', () => {
    adapter.applyPositionOnly({ id: 'img1', type: 'image', ath: 80, atv: -15 } as never)

    expect(updatePos).toHaveBeenCalledWith('img1', 80, -15)
    expect(updateQuad).not.toHaveBeenCalled()
  })

  it('quad 有 points 时正确透传', () => {
    const points = '10 20 30 40 50 60 70 80'
    adapter.applyPositionOnly({ id: 'q2', type: 'quad', ath: 10, atv: 20, points } as never)

    expect(updateQuad).toHaveBeenCalledWith('q2', points)
  })

  it('model 无 points 时只传 ath/atv', () => {
    adapter.applyPositionOnly({ id: 'm2', type: 'model', ath: 45, atv: -10 } as never)

    expect(updatePos).toHaveBeenCalledWith('m2', 45, -10)
  })
})
