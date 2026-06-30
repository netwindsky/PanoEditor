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

  it('应合并 getCenterCoords 和 getCameraFov 返回 yaw/pitch/hfov', () => {
    getCenterCoords.mockReturnValue({ ath: 45, atv: 30 })
    getCameraFov.mockReturnValue(90)

    const view = adapter.getCurrentView()

    expect(view).toEqual({ yaw: 45, pitch: 30, hfov: 90 })
    expect(getCenterCoords).toHaveBeenCalledTimes(1)
    expect(getCameraFov).toHaveBeenCalledTimes(1)
  })

  it('负角度也应该正确传递', () => {
    getCenterCoords.mockReturnValue({ ath: -120, atv: -45 })
    getCameraFov.mockReturnValue(60)

    const view = adapter.getCurrentView()

    expect(view).toEqual({ yaw: -120, pitch: -45, hfov: 60 })
  })
})
