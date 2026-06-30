/**
 * 缩略图生成器测试 - TDD RED
 *
 * 规格：
 * - 从全景图 URL 加载图片
 * - 16:9 比例从中心裁切
 * - 输出宽度固定 1280px (高度 720px)
 * - 返回 dataURL（PNG 或 JPEG）
 *
 * jsdom 无完整 canvas API，使用 mock 验证调用契约。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateThumbnailFromUrl, computeCenterCropRect } from './thumbnailGenerator'

describe('computeCenterCropRect — 16:9 中心裁切计算', () => {
  it('源图横向更宽（横向超 16:9）时按高度铺满，水平居中', () => {
    // 4000x2000 = 2:1，比 16:9 宽 → 高 2000 不变，宽 = 2000 * 16/9 ≈ 3555.55
    const rect = computeCenterCropRect(4000, 2000)
    expect(rect.sh).toBe(2000)
    expect(rect.sw).toBeCloseTo((2000 * 16) / 9, 0)
    expect(rect.sx).toBeCloseTo((4000 - rect.sw) / 2, 0)
    expect(rect.sy).toBe(0)
  })

  it('源图纵向更高（横向低于 16:9）时按宽度铺满，垂直居中', () => {
    // 1600x1200 = 4:3，比 16:9 高 → 宽 1600 不变，高 = 1600 * 9/16 = 900
    const rect = computeCenterCropRect(1600, 1200)
    expect(rect.sw).toBe(1600)
    expect(rect.sh).toBe(900)
    expect(rect.sx).toBe(0)
    expect(rect.sy).toBeCloseTo((1200 - 900) / 2, 0)
  })

  it('全景图 2:1（4096x2048）按高度铺满，水平居中', () => {
    const rect = computeCenterCropRect(4096, 2048)
    expect(rect.sh).toBe(2048)
    expect(rect.sw).toBeCloseTo((2048 * 16) / 9, 0)
    expect(rect.sy).toBe(0)
    expect(rect.sx).toBeGreaterThan(0)
  })

  it('源图正好 16:9 时不裁切', () => {
    const rect = computeCenterCropRect(1920, 1080)
    expect(rect.sw).toBe(1920)
    expect(rect.sh).toBe(1080)
    expect(rect.sx).toBe(0)
    expect(rect.sy).toBe(0)
  })
})

describe('generateThumbnailFromUrl — 加载图片并生成缩略图', () => {
  let originalImage: typeof Image
  let originalCreateElement: typeof document.createElement
  let mockCtx: { drawImage: ReturnType<typeof vi.fn> }
  let mockCanvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn>; toDataURL: ReturnType<typeof vi.fn> }
  let loadedSrc: string

  beforeEach(() => {
    originalImage = globalThis.Image
    originalCreateElement = document.createElement

    mockCtx = { drawImage: vi.fn() }
    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,FAKE'),
    }

    // Mock Image：set src 后异步触发 onload
    class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin: string = ''
      naturalWidth = 4096
      naturalHeight = 2048
      private _src = ''
      set src(value: string) {
        this._src = value
        loadedSrc = value
        // 同步触发以简化测试时序
        queueMicrotask(() => this.onload?.())
      }
      get src() {
        return this._src
      }
    }
    ;(globalThis as any).Image = MockImage as any

    document.createElement = ((tag: string) => {
      if (tag === 'canvas') return mockCanvas as any
      return originalCreateElement.call(document, tag)
    }) as typeof document.createElement
  })

  afterEach(() => {
    ;(globalThis as any).Image = originalImage
    document.createElement = originalCreateElement
  })

  it('设置 canvas 输出尺寸为 1280x720', async () => {
    await generateThumbnailFromUrl('/uploads/test.jpg')
    expect(mockCanvas.width).toBe(1280)
    expect(mockCanvas.height).toBe(720)
  })

  it('调用 drawImage 时使用中心裁切的源矩形', async () => {
    await generateThumbnailFromUrl('/uploads/test.jpg')
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1)
    const args = mockCtx.drawImage.mock.calls[0]
    // drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = args
    // 4096x2048 是 2:1，中心裁切 16:9
    const expectedSw = (2048 * 16) / 9
    expect(sw).toBeCloseTo(expectedSw, 0)
    expect(sh).toBe(2048)
    expect(sx).toBeCloseTo((4096 - expectedSw) / 2, 0)
    expect(sy).toBe(0)
    expect(dx).toBe(0)
    expect(dy).toBe(0)
    expect(dw).toBe(1280)
    expect(dh).toBe(720)
  })

  it('返回 toDataURL 的结果作为 dataURL', async () => {
    const result = await generateThumbnailFromUrl('/uploads/test.jpg')
    expect(result).toBe('data:image/jpeg;base64,FAKE')
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', expect.any(Number))
  })

  it('正确加载传入的 URL', async () => {
    await generateThumbnailFromUrl('/uploads/pano-123.jpg')
    expect(loadedSrc).toBe('/uploads/pano-123.jpg')
  })

  it('图片加载失败时 reject', async () => {
    class FailImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin = ''
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    ;(globalThis as any).Image = FailImage as any
    await expect(generateThumbnailFromUrl('/bad.jpg')).rejects.toThrow()
  })
})
