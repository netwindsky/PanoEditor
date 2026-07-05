import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadTextFile } from '@/utils/downloadFile'

describe('downloadTextFile — 文件下载工具', () => {
  const createObjectURLSpy = vi.fn(() => 'blob:mock-url')
  const revokeObjectURLSpy = vi.fn()
  let anchorClickSpy: ReturnType<typeof vi.spyOn>
  let appendChildSpy: ReturnType<typeof vi.spyOn>
  let removeChildSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubGlobal('Blob', class {
      constructor(public parts: BlobPart[], public opts: BlobPropertyBag = {}) {}
    })
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    })
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => ({ click: vi.fn() } as any))
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => undefined as any)
    // 拦截 <a>.click()
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    createObjectURLSpy.mockClear()
    revokeObjectURLSpy.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
    anchorClickSpy.mockRestore()
  })

  it('创建 Blob 并通过临时 <a> 触发下载', () => {
    downloadTextFile('<krpano/>', 'tour.xml', 'application/xml')

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    // 创建了一个 Blob
    const blobArg = createObjectURLSpy.mock.calls[0][0]
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.opts.type).toBe('application/xml')

    // 追加了一个 a 标签并触发 click
    expect(appendChildSpy).toHaveBeenCalledTimes(1)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    const a = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(a.download).toBe('tour.xml')
    expect(a.href).toBe('blob:mock-url')

    // 清理
    expect(removeChildSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('downloadXml 作为 downloadTextFile 的便捷封装，type=application/xml、.xml 后缀', () => {
    // 动态导入避免测试耦合
    return import('@/utils/downloadFile').then(({ downloadXml }) => {
      downloadXml('<krpano/>', 'myTour')
      const a = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement
      expect(a.download).toBe('myTour.xml')
      const blobArg = createObjectURLSpy.mock.calls[0][0]
      expect(blobArg.opts.type).toBe('application/xml')
    })
  })
})
