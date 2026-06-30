import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssetViewModel } from '@/viewmodels/AssetViewModel'
import type { ResourceService } from '@/models'

function makeService(): ResourceService {
  return {
    fetchResources: vi.fn().mockResolvedValue([]),
    uploadResource: vi.fn().mockResolvedValue({} as any),
    deleteResource: vi.fn().mockResolvedValue(undefined),
  } as unknown as ResourceService
}

describe('AssetViewModel 资源类型筛选', () => {
  let service: ResourceService
  let vm: AssetViewModel

  beforeEach(() => {
    service = makeService()
    vm = new AssetViewModel(service)
  })

  it('loadResources 不传 type 时应加载全部资源', async () => {
    await vm.loadResources('p1')
    expect(service.fetchResources).toHaveBeenCalledWith('p1', undefined)
  })

  it('loadResources 传 image 时应加载标注资源', async () => {
    await vm.loadResources('p1', 'image')
    expect(service.fetchResources).toHaveBeenCalledWith('p1', 'image')
  })

  it('uploadResource 应传递 type 参数给 service', async () => {
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
    await vm.uploadResource('p1', file, 'image')
    expect(service.uploadResource).toHaveBeenCalledWith('p1', file, 'image', expect.any(Function))
  })
})
