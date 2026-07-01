/**
 * SceneProperties 系列测试共用的 EditorViewModel mock
 *
 * 组件已从 useSceneStore 迁移到 props.vm.sceneViewModel，写入路径拆成
 * updateSceneView / updateSceneLocation / updateSceneMeta 三个方法。
 * 本 helper 提供最小可用的 fake ViewModel + Scene 工厂。
 */
import { ref } from 'vue'
import { vi } from 'vitest'
import type { Scene, InitialView, SceneLocation } from '@/types'
import { DEFAULT_INITIAL_VIEW } from '@/types'

export function makeInitialView(overrides: Partial<InitialView> = {}): InitialView {
  return { ...DEFAULT_INITIAL_VIEW, ...overrides }
}

export function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 's1',
    projectId: 'p1',
    name: '测试场景',
    title: '测试标题',
    previewUrl: '',
    thumbUrl: '',
    imageConfig: '',
    status: 'READY',
    initialView: makeInitialView(),
    location: {} as SceneLocation,
    onstart: '',
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

export interface SceneVmMock {
  currentScene: ReturnType<typeof ref<Scene | null>>
  scenes: ReturnType<typeof ref<Scene[]>>
  currentTilingStatus: ReturnType<typeof ref<string>>
  currentTilingProgress: ReturnType<typeof ref<number>>
  updateSceneView: ReturnType<typeof vi.fn>
  updateSceneLocation: ReturnType<typeof vi.fn>
  updateSceneMeta: ReturnType<typeof vi.fn>
}

/**
 * 构建一个只含 `sceneViewModel` 子结构的 fake ViewModel，可直接作为
 * SceneProperties 的 `vm` prop 使用。
 */
export function makeVmMock(initial: Scene | null = null): { vm: { sceneViewModel: SceneVmMock } } & SceneVmMock {
  const currentScene = ref<Scene | null>(initial)
  const scenes = ref<Scene[]>(initial ? [initial] : [])
  const currentTilingStatus = ref('READY')
  const currentTilingProgress = ref(0)
  const updateSceneView = vi.fn().mockImplementation(async (_id: string, iv: InitialView) => {
    if (currentScene.value) currentScene.value = { ...currentScene.value, initialView: iv }
    return currentScene.value
  })
  const updateSceneLocation = vi.fn().mockImplementation(
    async (_id: string, location: SceneLocation, onstart?: string) => {
      if (currentScene.value) {
        currentScene.value = {
          ...currentScene.value,
          location,
          ...(onstart !== undefined ? { onstart } : {}),
        }
      }
      return currentScene.value
    },
  )
  const updateSceneMeta = vi.fn().mockImplementation(async (_id: string, patch: any) => {
    if (currentScene.value) currentScene.value = { ...currentScene.value, ...patch }
    return currentScene.value
  })

  const sceneViewModel: SceneVmMock = {
    currentScene,
    scenes,
    currentTilingStatus,
    currentTilingProgress,
    updateSceneView,
    updateSceneLocation,
    updateSceneMeta,
  }

  return {
    vm: { sceneViewModel },
    ...sceneViewModel,
  }
}
