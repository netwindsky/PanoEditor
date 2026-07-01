import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 测试 PanoEngineAdapter.animateToView：
 * 用 TWEEN 平滑地把相机视角从当前位置动画到目标 yaw/pitch。
 *
 * 用于"点击标注列表项 → 相机旋转朝向该标注"。
 */

// ===== 模拟 @panoview =====
const setCameraView = vi.fn()
const getCenterCoords = vi.fn()
const getCameraFov = vi.fn()

vi.mock('@panoview', () => ({
  PanoEngine: vi.fn(() => ({
    setBaseUrl: vi.fn(),
    loadScenes: vi.fn(),
    setCameraView,
    getCenterCoords,
    getCameraFov,
    hotspotsManager: {
      clearHotspots: vi.fn(),
      createHotspots: vi.fn(),
      fadeIn: vi.fn(),
    },
    dispose: vi.fn(),
  })),
}))

// ===== 模拟 @tweenjs/tween.js =====
// 记录每个 Tween 实例的 to()/onUpdate()/start()/stop() 调用与参数，
// 让测试能够手动触发 onUpdate 回调并断言旧 tween 被停止。
interface FakeTween {
  _startState: Record<string, number>
  _endState: Record<string, number> | null
  _duration: number
  _onUpdateCb: ((state: Record<string, number>) => void) | null
  _onCompleteCb: (() => void) | null
  to: ReturnType<typeof vi.fn>
  easing: ReturnType<typeof vi.fn>
  onUpdate: ReturnType<typeof vi.fn>
  onComplete: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  /** 手动触发一次 onUpdate，用当前 _endState 或指定状态 */
  fireUpdate: (state?: Record<string, number>) => void
  /** 手动触发 onComplete */
  fireComplete: () => void
}

const tweenInstances: FakeTween[] = []

function createFakeTween(startState: Record<string, number>): FakeTween {
  const inst: FakeTween = {
    _startState: startState,
    _endState: null,
    _duration: 0,
    _onUpdateCb: null,
    _onCompleteCb: null,
    to: vi.fn(function (this: FakeTween, end: Record<string, number>, dur: number) {
      this._endState = end
      this._duration = dur
      return this
    }),
    easing: vi.fn().mockReturnThis(),
    onUpdate: vi.fn(function (this: FakeTween, cb: (state: Record<string, number>) => void) {
      this._onUpdateCb = cb
      return this
    }),
    onComplete: vi.fn(function (this: FakeTween, cb: () => void) {
      this._onCompleteCb = cb
      return this
    }),
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    fireUpdate(state?: Record<string, number>) {
      this._onUpdateCb?.(state ?? this._endState ?? this._startState)
    },
    fireComplete() {
      this._onCompleteCb?.()
    },
  }
  // 让链式方法的 this 指回 inst
  inst.to = inst.to.bind(inst) as unknown as typeof inst.to
  inst.onUpdate = inst.onUpdate.bind(inst) as unknown as typeof inst.onUpdate
  inst.onComplete = inst.onComplete.bind(inst) as unknown as typeof inst.onComplete
  return inst
}

vi.mock('@tweenjs/tween.js', () => {
  const TweenCtor = vi.fn((startState: Record<string, number>) => {
    const inst = createFakeTween({ ...startState })
    tweenInstances.push(inst)
    return inst
  })
  return {
    default: {
      Easing: {
        Quadratic: { Out: 'quad-out', InOut: 'quad-inout' },
      },
      update: vi.fn(),
    },
    Tween: TweenCtor,
    // 部分包同时导出 Easing 命名空间
    Easing: {
      Quadratic: { Out: 'quad-out', InOut: 'quad-inout' },
    },
  }
})

import { PanoEngineAdapter } from './PanoEngineAdapter'

function lastTween(): FakeTween {
  return tweenInstances[tweenInstances.length - 1]
}

describe('PanoEngineAdapter.animateToView', () => {
  let adapter: PanoEngineAdapter

  beforeEach(() => {
    setCameraView.mockReset()
    getCenterCoords.mockReset()
    getCameraFov.mockReset()
    tweenInstances.length = 0
    adapter = new PanoEngineAdapter(document.createElement('div'))
  })

  it('起点 state 应来自 getCurrentView（krpano 惯例，yaw = -ath, pitch = -atv）', () => {
    // 引擎内部数学惯例返回 ath=45, atv=30（左转、仰视）
    getCenterCoords.mockReturnValue({ ath: 45, atv: 30 })
    getCameraFov.mockReturnValue(90)

    adapter.animateToView({ yaw: 0, pitch: 0 })

    const t = lastTween()
    // 起点应转成 krpano 惯例：yaw = -45, pitch = -30
    expect(t._startState).toEqual({ yaw: -45, pitch: -30 })
  })

  it('终点应使用调用方传入的 yaw/pitch 原值（同为 krpano 惯例）', () => {
    getCenterCoords.mockReturnValue({ ath: 0, atv: 0 })

    adapter.animateToView({ yaw: 90, pitch: -15 })

    const t = lastTween()
    expect(t._endState).toEqual({ yaw: 90, pitch: -15 })
  })

  it('yaw 采用最短路径：从 170 到 -170 应走 +20°（终点 190）而非 -340°', () => {
    getCenterCoords.mockReturnValue({ ath: -170, atv: 0 }) // yaw=170
    adapter.animateToView({ yaw: -170, pitch: 0 })

    const t = lastTween()
    // 170 → 190 相当于顺时针 20°，等价于 -170
    expect(t._endState?.yaw).toBe(190)
  })

  it('yaw 从 -170 到 170 应走 -20°（终点 -190）', () => {
    getCenterCoords.mockReturnValue({ ath: 170, atv: 0 }) // yaw=-170
    adapter.animateToView({ yaw: 170, pitch: 0 })

    const t = lastTween()
    expect(t._endState?.yaw).toBe(-190)
  })

  it('yaw 差在 180° 内时不改变终点', () => {
    getCenterCoords.mockReturnValue({ ath: 0, atv: 0 }) // yaw=0
    adapter.animateToView({ yaw: 45, pitch: 0 })

    const t = lastTween()
    expect(t._endState?.yaw).toBe(45)
  })

  it('未指定 duration 时使用默认时长（> 0）', () => {
    getCenterCoords.mockReturnValue({ ath: 0, atv: 0 })
    adapter.animateToView({ yaw: 30, pitch: 10 })

    const t = lastTween()
    expect(t._duration).toBeGreaterThan(0)
  })

  it('显式指定 duration 时使用传入值', () => {
    getCenterCoords.mockReturnValue({ ath: 0, atv: 0 })
    adapter.animateToView({ yaw: 30, pitch: 10, duration: 1234 })

    const t = lastTween()
    expect(t._duration).toBe(1234)
  })

  it('必须调用 .start() 启动动画', () => {
    getCenterCoords.mockReturnValue({ ath: 0, atv: 0 })
    adapter.animateToView({ yaw: 30, pitch: 10 })

    expect(lastTween().start).toHaveBeenCalledTimes(1)
  })

  it('onUpdate 回调应把中间态 yaw/pitch 传给 engine.setCameraView（hlookat/vlookat）', () => {
    getCenterCoords.mockReturnValue({ ath: 0, atv: 0 })
    adapter.animateToView({ yaw: 60, pitch: 20 })

    const t = lastTween()
    // 手动触发中间态
    t.fireUpdate({ yaw: 30, pitch: 10 })

    expect(setCameraView).toHaveBeenCalledWith(
      expect.objectContaining({ hlookat: 30, vlookat: 10 }),
    )
  })

  it('连续调用 animateToView 时应先停止上一次的动画（避免叠加）', () => {
    getCenterCoords.mockReturnValue({ ath: 0, atv: 0 })

    adapter.animateToView({ yaw: 30, pitch: 0 })
    const first = lastTween()
    expect(first.stop).not.toHaveBeenCalled()

    // 再次调用
    getCenterCoords.mockReturnValue({ ath: -15, atv: 0 })
    adapter.animateToView({ yaw: 60, pitch: 0 })

    expect(first.stop).toHaveBeenCalledTimes(1)
    // 第二个 tween 是新的实例
    expect(lastTween()).not.toBe(first)
  })

  it('duration <= 0 时直接 setCameraView 目标视角，不构造 tween', () => {
    getCenterCoords.mockReturnValue({ ath: 0, atv: 0 })
    adapter.animateToView({ yaw: 45, pitch: 10, duration: 0 })

    expect(tweenInstances.length).toBe(0)
    expect(setCameraView).toHaveBeenCalledWith(
      expect.objectContaining({ hlookat: 45, vlookat: 10 }),
    )
  })

  it('onComplete 后再次调用不会 stop 已结束的 tween', () => {
    getCenterCoords.mockReturnValue({ ath: 0, atv: 0 })
    adapter.animateToView({ yaw: 30, pitch: 0 })
    const first = lastTween()

    // 动画自然结束
    first.fireComplete()

    getCenterCoords.mockReturnValue({ ath: -30, atv: 0 })
    adapter.animateToView({ yaw: 60, pitch: 0 })

    expect(first.stop).not.toHaveBeenCalled()
  })
})
