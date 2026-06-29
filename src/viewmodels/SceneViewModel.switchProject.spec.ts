import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SceneViewModel } from './SceneViewModel'
import type { Scene, SceneService } from '@/models'

function makeScene(id: string, projectId: string, name: string): Scene {
  return { id, projectId, name, previewUrl: '', status: 'READY' } as Scene
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
    fetchTilingProgress: vi.fn(),
  } as unknown as SceneService
}

/**
 * 复现 bug：切换项目后，旧项目的 currentScene 残留，
 * loadScenes 中 `if (!this.currentScene.value && ...)` 条件不成立，
 * 新项目首场景不会被自动选中，画布仍显示旧场景。
 *
 * 期望：重新 loadScenes 加载另一个项目的场景后，
 * currentScene 应指向新项目的首个场景。
 */
describe('SceneViewModel.loadScenes 切换项目', () => {
  let service: SceneService
  let vm: SceneViewModel

  beforeEach(() => {
    service = makeService()
    vm = new SceneViewModel(service)
  })

  it('首次加载应自动选中首个场景', async () => {
    const a1 = makeScene('a1', 'pA', '场景A1')
    ;(service.fetchScenes as any).mockResolvedValue([a1, makeScene('a2', 'pA', '场景A2')])

    await vm.loadScenes('pA')

    expect(vm.scenes.value.map((s) => s.id)).toEqual(['a1', 'a2'])
    expect(vm.currentScene.value?.id).toBe('a1')
  })

  it('切换到另一个项目后应选中新项目的首场景（而非残留旧场景）', async () => {
    // 先加载项目 A，选中 a1
    ;(service.fetchScenes as any).mockResolvedValueOnce([
      makeScene('a1', 'pA', '场景A1'),
      makeScene('a2', 'pA', '场景A2'),
    ])
    await vm.loadScenes('pA')
    expect(vm.currentScene.value?.id).toBe('a1')

    // 切换到项目 B
    ;(service.fetchScenes as any).mockResolvedValueOnce([
      makeScene('b1', 'pB', '场景B1'),
      makeScene('b2', 'pB', '场景B2'),
    ])
    await vm.loadScenes('pB')

    expect(vm.scenes.value.map((s) => s.id)).toEqual(['b1', 'b2'])
    // 关键断言：当前场景应切到新项目首场景，而非残留的 a1
    expect(vm.currentScene.value?.id).toBe('b1')
  })

  it('切换到空场景项目后 currentScene 应被清空', async () => {
    ;(service.fetchScenes as any).mockResolvedValueOnce([makeScene('a1', 'pA', '场景A1')])
    await vm.loadScenes('pA')
    expect(vm.currentScene.value?.id).toBe('a1')

    ;(service.fetchScenes as any).mockResolvedValueOnce([])
    await vm.loadScenes('pEmpty')

    expect(vm.scenes.value).toEqual([])
    expect(vm.currentScene.value).toBeNull()
  })
})
