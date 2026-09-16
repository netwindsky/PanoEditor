import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PanoEngineAdapter } from './PanoEngineAdapter'

function makeAdapter(mockSetModelRotation = vi.fn()): PanoEngineAdapter {
  const adapter = Object.create(PanoEngineAdapter.prototype) as PanoEngineAdapter
  ;(adapter as unknown as { engine: { hotspotsManager: { setModelRotation: ReturnType<typeof vi.fn> } } }).engine = {
    hotspotsManager: {
      setModelRotation: mockSetModelRotation,
    },
  }
  return adapter
}

describe('PanoEngineAdapter.setModelRotation', () => {
  let mockFn: ReturnType<typeof vi.fn>
  let adapter: PanoEngineAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    mockFn = vi.fn()
    adapter = makeAdapter(mockFn)
  })

  it('透传三轴值到引擎 setModelRotation', () => {
    adapter.setModelRotation('m1', 45, 0, 90)
    expect(mockFn).toHaveBeenCalledWith('m1', [45, 0, 90])
  })

  it('零值透传正确', () => {
    adapter.setModelRotation('m2', 0, 0, 0)
    expect(mockFn).toHaveBeenCalledWith('m2', [0, 0, 0])
  })

  it('负值透传正确', () => {
    adapter.setModelRotation('m3', -30, 45.5, -60)
    expect(mockFn).toHaveBeenCalledWith('m3', [-30, 45.5, -60])
  })
})
