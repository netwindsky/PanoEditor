import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Object3D, Vector3 } from 'three'
import { PanoEngineAdapter } from './PanoEngineAdapter'

/**
 * TDD：模型热点尺寸变换面板数值回显与保存换算。
 *
 * 语义：面板显示/输入均为「相对默认尺寸的倍数」（1=默认，2=两倍大）；
 * DB 的 scale 字段保持引擎绝对值（原始尺寸×绝对倍数），由 adapter 换算。
 *
 * - getModelRuntime(id)：读引擎 getRelativeScale/getRotateValues，返回相对倍数
 * - setModelRelativeScale(id, relative)：换算回绝对 scale 并应用到引擎+返回落库值
 */

function makeAdapterWithModel(baseScale: number, absoluteScale: number, rotateValues: number[] = []): PanoEngineAdapter {
  const adapter = Object.create(PanoEngineAdapter.prototype) as PanoEngineAdapter
  const container = new Object3D()
  container.scale.set(absoluteScale, absoluteScale, absoluteScale)
  const fakeModel = {
    getName: () => 'm1',
    getObject: () => container,
    getRotateValues: () => rotateValues,
    getBaseScale: () => baseScale,
    setRelativeScale: vi.fn((s: number) => {
      container.scale.setScalar(baseScale * s)
    }),
    dispose: vi.fn(),
  }
  ;(adapter as unknown as { engine: { hotspotsManager: { modelHotspots: Map<string, unknown> } } }).engine = {
    hotspotsManager: {
      modelHotspots: new Map([['m1', fakeModel]]),
    },
  }
  return adapter
}

describe('PanoEngineAdapter.getModelRuntime — 相对倍数回显', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('autoScale 场景：relativeScale=1（默认大小），三轴旋转默认 0', () => {
    const adapter = makeAdapterWithModel(0.001, 0.001)
    const rt = adapter.getModelRuntime('m1')
    expect(rt).toEqual({ relativeScale: 1, rotateX: 0, rotateY: 0, rotateZ: 0 })
  })

  it('absolute=base×3 → relativeScale=3（默认的三倍大）', () => {
    const adapter = makeAdapterWithModel(0.001, 0.003)
    const rt = adapter.getModelRuntime('m1')
    expect(rt!.relativeScale).toBeCloseTo(3, 5)
  })

  it('rotate 有用户设置值时返回三轴分量（单值旧数据 → Y 轴）', () => {
    const adapter = makeAdapterWithModel(0.001, 0.001, [23])
    const rt = adapter.getModelRuntime('m1')
    expect(rt!.rotateY).toBe(23)
    expect(rt!.rotateX).toBe(0)
    expect(rt!.rotateZ).toBe(0)
  })

  it('模型不存在时返回 null', () => {
    const adapter = makeAdapterWithModel(1, 1)
    expect(adapter.getModelRuntime('nope')).toBeNull()
  })

  it('模型未加载完成（object=null）时返回 null', () => {
    const adapter = Object.create(PanoEngineAdapter.prototype) as PanoEngineAdapter
    const fakeModel = { getName: () => 'm2', getObject: () => null, getRotateValues: () => [], getBaseScale: () => 1 }
    ;(adapter as unknown as { engine: { hotspotsManager: { modelHotspots: Map<string, unknown> } } }).engine = {
      hotspotsManager: { modelHotspots: new Map([['m2', fakeModel]]) },
    }
    expect(adapter.getModelRuntime('m2')).toBeNull()
  })
})

describe('PanoEngineAdapter.setModelRelativeScale — 相对倍数落库换算', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('setModelRelativeScale(2) 调用引擎 setRelativeScale 并返回相对值（落库即相对倍数）', () => {
    const adapter = makeAdapterWithModel(0.001, 0.001)
    const saved = adapter.setModelRelativeScale('m1', 2)
    expect(saved).toBe(2)
    // 引擎对象 scale 已同步为 base×2
    const mgr = (adapter as unknown as { engine: { hotspotsManager: { modelHotspots: Map<string, { getObject(): Object3D; getBaseScale(): number }> } } }).engine.hotspotsManager
    const model = mgr.modelHotspots.get('m1')!
    expect(model.getObject().scale.x).toBeCloseTo(model.getBaseScale() * 2, 10)
  })

  it('relative 非法（<=0/NaN）时返回 null', () => {
    const adapter = makeAdapterWithModel(0.001, 0.001)
    expect(adapter.setModelRelativeScale('m1', 0)).toBeNull()
    expect(adapter.setModelRelativeScale('m1', NaN)).toBeNull()
  })

  it('模型不存在时返回 null', () => {
    const adapter = makeAdapterWithModel(0.001, 0.001)
    expect(adapter.setModelRelativeScale('nope', 2)).toBeNull()
  })
})
