import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SceneService } from './SceneService'
import type { ISceneRepository } from '../repositories/SceneRepository'
import type { IResourceRepository } from '../repositories/ResourceRepository'
import type { Scene, Resource } from '@/types'

function makeResource(name: string, url: string): Resource {
  return {
    id: 'res-' + name,
    projectId: 'p1',
    name,
    type: 'panorama',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    url,
    thumbUrl: '',
  } as Resource
}

function makeScene(id: string, name: string): Scene {
  return { id, projectId: 'p1', name, previewUrl: '', status: 'PENDING' } as Scene
}

function makeFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' })
}

describe('SceneService.uploadPanoramas', () => {
  let sceneRepo: ISceneRepository
  let resourceRepo: IResourceRepository
  let service: SceneService

  beforeEach(() => {
    sceneRepo = {
      fetchScenes: vi.fn(),
      fetchScene: vi.fn(),
      createScene: vi.fn(),
      updateScene: vi.fn(),
      deleteScene: vi.fn(),
      fetchTilingProgress: vi.fn(),
    } as unknown as ISceneRepository

    resourceRepo = {
      fetchResources: vi.fn(),
      uploadResource: vi.fn(),
      batchUploadResources: vi.fn(),
      deleteResource: vi.fn(),
    } as unknown as IResourceRepository

    service = new SceneService(sceneRepo, resourceRepo)
  })

  it('批量上传成功的每个资源各创建一个场景', async () => {
    const r1 = makeResource('a.jpg', '/uploads/a.jpg')
    const r2 = makeResource('b.jpg', '/uploads/b.jpg')
    ;(resourceRepo.batchUploadResources as any).mockResolvedValue({
      succeeded: [r1, r2],
      failed: [],
    })
    ;(sceneRepo.createScene as any)
      .mockResolvedValueOnce(makeScene('s1', 'a'))
      .mockResolvedValueOnce(makeScene('s2', 'b'))

    const files = [makeFile('a.jpg'), makeFile('b.jpg')]
    const result = await service.uploadPanoramas('p1', files)

    expect(resourceRepo.batchUploadResources).toHaveBeenCalledWith(
      'p1',
      files,
      'panorama',
    )
    expect(sceneRepo.createScene).toHaveBeenCalledTimes(2)
    // 场景名取文件名去扩展名
    expect(sceneRepo.createScene).toHaveBeenCalledWith('p1', { name: 'a', previewUrl: '/uploads/a.jpg' })
    expect(sceneRepo.createScene).toHaveBeenCalledWith('p1', { name: 'b', previewUrl: '/uploads/b.jpg' })
    expect(result.scenes).toHaveLength(2)
    expect(result.failed).toHaveLength(0)
  })

  it('部分上传失败：成功项建场景，失败项透传', async () => {
    const r1 = makeResource('a.jpg', '/uploads/a.jpg')
    ;(resourceRepo.batchUploadResources as any).mockResolvedValue({
      succeeded: [r1],
      failed: [{ fileName: 'b.jpg', error: '磁盘写入失败' }],
    })
    ;(sceneRepo.createScene as any).mockResolvedValue(makeScene('s1', 'a'))

    const result = await service.uploadPanoramas('p1', [makeFile('a.jpg'), makeFile('b.jpg')])

    expect(sceneRepo.createScene).toHaveBeenCalledTimes(1)
    expect(result.scenes).toHaveLength(1)
    expect(result.failed).toEqual([{ fileName: 'b.jpg', error: '磁盘写入失败' }])
  })

  it('全部失败：不创建场景，失败项全部透传', async () => {
    ;(resourceRepo.batchUploadResources as any).mockResolvedValue({
      succeeded: [],
      failed: [
        { fileName: 'a.jpg', error: 'err1' },
        { fileName: 'b.jpg', error: 'err2' },
      ],
    })

    const result = await service.uploadPanoramas('p1', [makeFile('a.jpg'), makeFile('b.jpg')])

    expect(sceneRepo.createScene).not.toHaveBeenCalled()
    expect(result.scenes).toHaveLength(0)
    expect(result.failed).toHaveLength(2)
  })
})
