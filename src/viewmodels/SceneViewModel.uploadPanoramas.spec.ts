import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SceneViewModel } from './SceneViewModel'
import type { Scene, SceneService } from '@/models'

function makeScene(id: string, name: string): Scene {
  return { id, projectId: 'p1', name, previewUrl: '', status: 'PENDING' } as Scene
}

function makeFile(name: string): File {
  return new File([new Uint8Array([1])], name, { type: 'image/jpeg' })
}

function makeService(): SceneService {
  return {
    fetchScenes: vi.fn(),
    fetchScene: vi.fn(),
    createScene: vi.fn(),
    updateScene: vi.fn(),
    deleteScene: vi.fn(),
    uploadPanorama: vi.fn(),
    uploadPanoramas: vi.fn(),
    fetchTilingProgress: vi.fn().mockResolvedValue({ status: 'PENDING', percentage: 0 }),
  } as unknown as SceneService
}

describe('SceneViewModel.uploadPanoramas', () => {
  let service: SceneService
  let vm: SceneViewModel

  beforeEach(() => {
    vi.useFakeTimers()
    service = makeService()
    vm = new SceneViewModel(service)
  })

  afterEach(() => {
    vm.dispose()
    vi.useRealTimers()
  })

  it('成功创建的场景全部加入 scenes 列表', async () => {
    const s1 = makeScene('s1', 'a')
    const s2 = makeScene('s2', 'b')
    ;(service.uploadPanoramas as any).mockResolvedValue({ scenes: [s1, s2], failed: [] })

    const promise = vm.uploadPanoramas('p1', [makeFile('a.jpg'), makeFile('b.jpg')])
    await vi.advanceTimersByTimeAsync(800)
    const result = await promise

    expect(service.uploadPanoramas).toHaveBeenCalledTimes(1)
    expect(vm.scenes.value.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(result.scenes).toHaveLength(2)
    expect(result.failed).toHaveLength(0)
  })

  it('部分失败：成功场景入列表，失败项透传到返回值', async () => {
    const s1 = makeScene('s1', 'a')
    ;(service.uploadPanoramas as any).mockResolvedValue({
      scenes: [s1],
      failed: [{ fileName: 'b.jpg', error: '磁盘写入失败' }],
    })

    const promise = vm.uploadPanoramas('p1', [makeFile('a.jpg'), makeFile('b.jpg')])
    await vi.advanceTimersByTimeAsync(800)
    const result = await promise

    expect(vm.scenes.value).toHaveLength(1)
    expect(result.failed).toEqual([{ fileName: 'b.jpg', error: '磁盘写入失败' }])
  })

  it('上传结束后 uploading 状态被重置为 false', async () => {
    ;(service.uploadPanoramas as any).mockResolvedValue({ scenes: [makeScene('s1', 'a')], failed: [] })

    const promise = vm.uploadPanoramas('p1', [makeFile('a.jpg')])
    await vi.advanceTimersByTimeAsync(800)
    await promise

    expect(vm.uploading.value).toBe(false)
    expect(vm.uploadProgress.value).toBe(0)
  })

  it('上传抛错时记录 uploadError 并向上抛出', async () => {
    ;(service.uploadPanoramas as any).mockRejectedValue(new Error('网络错误'))

    const promise = vm.uploadPanoramas('p1', [makeFile('a.jpg')])
    await expect(promise).rejects.toThrow('网络错误')
    expect(vm.uploadError.value).toBe('网络错误')
    expect(vm.uploading.value).toBe(false)
  })
})
