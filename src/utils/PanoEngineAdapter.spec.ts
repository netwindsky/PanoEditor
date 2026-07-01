import { describe, it, expect, vi, beforeEach } from 'vitest'

const loadScenes = vi.fn()
const setBaseUrl = vi.fn()
const getCenterCoords = vi.fn()
const getCameraFov = vi.fn()

vi.mock('@panoview', () => ({
  PanoEngine: vi.fn(() => ({
    setBaseUrl,
    loadScenes,
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

import { PanoEngineAdapter } from './PanoEngineAdapter'

describe('PanoEngineAdapter.loadSceneConfig', () => {
  beforeEach(() => {
    loadScenes.mockReset()
    setBaseUrl.mockReset()
    getCenterCoords.mockReset()
    getCameraFov.mockReset()
  })

  it('应返回并等待 engine.loadScenes 的 Promise，保证调用方能等待真实场景初始化', async () => {
    let resolved = false
    let resolveLoad!: () => void
    loadScenes.mockReturnValue(new Promise<void>((resolve) => {
      resolveLoad = resolve
    }))

    const adapter = new PanoEngineAdapter(document.createElement('div'))
    const result = adapter.loadSceneConfig({
      scene: { name: 's1' },
      image: { type: 'CUBE', levels: [] },
    })

    expect(result).toBeInstanceOf(Promise)
    result.then(() => {
      resolved = true
    })
    await Promise.resolve()
    expect(resolved).toBe(false)

    resolveLoad()
    await result

    expect(resolved).toBe(true)
    expect(setBaseUrl).toHaveBeenCalledWith('')
    expect(loadScenes).toHaveBeenCalledWith(
      [{ scene: { name: 's1' }, image: { type: 'CUBE', levels: [] } }],
      { manageHotspots: false },
    )
  })
})

describe('PanoEngineAdapter.getCurrentView', () => {
  let adapter: PanoEngineAdapter

  beforeEach(() => {
    getCenterCoords.mockReset()
    getCameraFov.mockReset()
    adapter = new PanoEngineAdapter(document.createElement('div'))
  })

  it('应将引擎内部数学惯例转换为 krpano 惯例（正 ath → 负 yaw，正 atv → 负 pitch）', () => {
    getCenterCoords.mockReturnValue({ ath: 45, atv: 30 })
    getCameraFov.mockReturnValue(90)

    const view = adapter.getCurrentView()

    expect(view).toEqual({ yaw: -45, pitch: -30, hfov: 90 })
    expect(getCenterCoords).toHaveBeenCalledTimes(1)
    expect(getCameraFov).toHaveBeenCalledTimes(1)
  })

  it('负角度也应正确翻转', () => {
    getCenterCoords.mockReturnValue({ ath: -120, atv: -45 })
    getCameraFov.mockReturnValue(60)

    const view = adapter.getCurrentView()

    expect(view).toEqual({ yaw: 120, pitch: 45, hfov: 60 })
  })
})

describe('PanoEngineAdapter.syncHotspots', () => {
  let adapter: PanoEngineAdapter

  beforeEach(() => {
    adapter = new PanoEngineAdapter(document.createElement('div'))
  })

  it('应将 shader 字段传递给引擎热点创建', () => {
    const hotspots = [
      {
        id: 'quad1',
        sceneId: 's1',
        name: '四边形热点',
        type: 'quad' as const,
        ath: 45,
        atv: 10,
        url: 'https://example.com/image.jpg',
        shader: 'grayscale',
        points: '10 20 30 40 50 60 70 80',
      },
    ]

    adapter.syncHotspots(hotspots)

    // 验证 createHotspots 被调用，且 shader 字段被传递
    const createHotspotsMock = vi.mocked(
      (adapter as any).engine.hotspotsManager.createHotspots,
    )
    expect(createHotspotsMock).toHaveBeenCalledTimes(1)

    const panoHotspots = createHotspotsMock.mock.calls[0][0]
    expect(panoHotspots).toHaveLength(1)
    expect(panoHotspots[0]).toHaveProperty('shader', 'grayscale')
  })

  it('未设置 shader 时不传递 shader 字段', () => {
    const hotspots = [
      {
        id: 'quad2',
        sceneId: 's1',
        name: '无着色器热点',
        type: 'quad' as const,
        ath: 0,
        atv: 0,
        url: 'https://example.com/image.jpg',
        points: '10 20 30 40 50 60 70 80',
      },
    ]

    adapter.syncHotspots(hotspots)

    const createHotspotsMock = vi.mocked(
      (adapter as any).engine.hotspotsManager.createHotspots,
    )
    const panoHotspots = createHotspotsMock.mock.calls[0][0]
    expect(panoHotspots[0].shader).toBeUndefined()
  })
})
