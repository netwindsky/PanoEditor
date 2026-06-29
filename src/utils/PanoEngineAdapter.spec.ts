import { describe, it, expect, vi, beforeEach } from 'vitest'

const loadScenes = vi.fn()
const setBaseUrl = vi.fn()

vi.mock('@panoview', () => ({
  PanoEngine: vi.fn(() => ({
    setBaseUrl,
    loadScenes,
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
