import { describe, it, expect, vi } from 'vitest'
import { ResourceService } from './ResourceService'
import type { IResourceRepository } from '../repositories/ResourceRepository'
import type { Resource } from '@/types'

function makeResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'r1',
    projectId: 'p1',
    name: 'test',
    type: 'image',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    url: '/uploads/test.jpg',
    thumbUrl: '',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeRepo(): IResourceRepository {
  return {
    fetchResources: vi.fn(),
    uploadResource: vi.fn(),
    batchUploadResources: vi.fn(),
    deleteResource: vi.fn(),
  }
}

describe('ResourceService.fetchResources', () => {
  it('不传 type 时自动过滤掉非标注资源（panorama/document/other）和空 URL 资源', async () => {
    const repo = makeRepo()
    const service = new ResourceService(repo)

    const resources: Resource[] = [
      makeResource({ id: '1', name: '图片1', type: 'image' }),
      makeResource({ id: '2', name: '全景图1', type: 'panorama' }),
      makeResource({ id: '3', name: '视频1', type: 'video' }),
      makeResource({ id: '4', name: '全景图2', type: 'panorama' }),
      makeResource({ id: '5', name: '音频1', type: 'audio' }),
      makeResource({ id: '6', name: '文档1', type: 'document' }),
      makeResource({ id: '7', name: '空URL', type: 'image', url: '' }),
      makeResource({ id: '8', name: '未知类型', type: 'other' }),
    ]
    vi.mocked(repo.fetchResources).mockResolvedValue(resources)

    const result = await service.fetchResources('p1')

    // 应只保留有 URL 的 image/video/audio 标注资源
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.id)).toEqual(['1', '3', '5'])
  })

  it('不传 type 时保留 model 类型资源（模型热点需从资源库选择模型文件）', async () => {
    const repo = makeRepo()
    const service = new ResourceService(repo)

    const resources: Resource[] = [
      makeResource({ id: '1', name: '椅子模型', type: 'model' }),
      makeResource({ id: '2', name: '文档1', type: 'document' }),
    ]
    vi.mocked(repo.fetchResources).mockResolvedValue(resources)

    const result = await service.fetchResources('p1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('指定 type 时（如图片），不过滤全景图（因为 API 已按 type 查询）', async () => {
    const repo = makeRepo()
    const service = new ResourceService(repo)

    const resources: Resource[] = [
      makeResource({ id: '1', name: '图片1', type: 'image' }),
      makeResource({ id: '2', name: '图片2', type: 'image' }),
    ]
    vi.mocked(repo.fetchResources).mockResolvedValue(resources)

    const result = await service.fetchResources('p1', 'image')

    expect(result).toHaveLength(2)
    expect(result.every((r) => r.type === 'image')).toBe(true)
    expect(repo.fetchResources).toHaveBeenCalledWith('p1', 'image')
  })

  it('当全部资源都不是全景图时，返回全部', async () => {
    const repo = makeRepo()
    const service = new ResourceService(repo)

    const resources: Resource[] = [
      makeResource({ id: '1', type: 'image' }),
      makeResource({ id: '2', type: 'video' }),
    ]
    vi.mocked(repo.fetchResources).mockResolvedValue(resources)

    const result = await service.fetchResources('p1')

    expect(result).toHaveLength(2)
  })

  it('资源列表为空时返回空数组', async () => {
    const repo = makeRepo()
    const service = new ResourceService(repo)
    vi.mocked(repo.fetchResources).mockResolvedValue([])

    const result = await service.fetchResources('p1')

    expect(result).toEqual([])
  })
})
