import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Scene, UpdateSceneParams } from '@/types'
import * as sceneApi from '@/api/scene'

/**
 * 场景 Store（兼容层）
 *
 * @deprecated 请使用 `SceneViewModel`（通过 `EditorViewModel.sceneViewModel`
 * 或 provide/inject 获取）。此 Store 保留仅供尚未迁移的旧代码使用，
 * 新代码不应再引入。计划在下一次 sweep 中删除。
 *
 * 迁移指引：
 *  - `sceneStore.updateScene(id, patch)` → `vm.sceneViewModel.updateScene*`
 *  - `sceneStore.scenes` → `vm.sceneViewModel.scenes`
 */
export const useSceneStore = defineStore('scene', () => {
  const scenes = ref<Scene[]>([])
  const currentScene = ref<Scene | null>(null)
  const loading = ref(false)

  /**
   * 将后端返回的 JSON 字符串 initialView 反序列化为对象；null 保持 null
   */
  function normalizeScene(raw: Scene): Scene {
    if (typeof raw.initialView === 'string') {
      try {
        raw.initialView = JSON.parse(raw.initialView)
      } catch {
        (raw as any).initialView = null
      }
    }
    return raw
  }

  /**
   * 将 initialView 对象序列化为 JSON 字符串（发送后端用）
   */
  function serializeParams(params: UpdateSceneParams): Record<string, unknown> {
    const out: Record<string, unknown> = { ...params }
    if (params.initialView && typeof params.initialView !== 'string') {
      out.initialView = JSON.stringify(params.initialView)
    }
    return out
  }

  async function fetchScenes(projectId: string) {
    loading.value = true
    try {
      const res = await sceneApi.getScenes(projectId)
      scenes.value = (res.data.data ?? []).map(normalizeScene)
      if (!currentScene.value && scenes.value.length > 0) {
        currentScene.value = scenes.value[0]
      }
    } finally {
      loading.value = false
    }
  }

  async function selectScene(sceneId: string) {
    const scene = scenes.value.find((s) => s.id === sceneId)
    if (scene) {
      currentScene.value = scene
    }
  }

  async function createScene(projectId: string, name: string, panoramaUrl: string) {
    const res = await sceneApi.createScene(projectId, { name, previewUrl: panoramaUrl })
    const created = normalizeScene(res.data.data)
    scenes.value.push(created)
    return created
  }

  async function updateScene(sceneId: string, params: UpdateSceneParams) {
    const serialized = serializeParams(params)
    const res = await sceneApi.updateScene(sceneId, serialized as any)
    const updated = normalizeScene(res.data.data)
    const index = scenes.value.findIndex((s) => s.id === sceneId)
    if (index !== -1) {
      scenes.value[index] = updated
    }
    if (currentScene.value?.id === sceneId) {
      currentScene.value = updated
    }
    return updated
  }

  async function deleteScene(sceneId: string) {
    await sceneApi.deleteScene(sceneId)
    scenes.value = scenes.value.filter((s) => s.id !== sceneId)
    if (currentScene.value?.id === sceneId) {
      currentScene.value = scenes.value[0] || null
    }
  }

  function clearScenes() {
    scenes.value = []
    currentScene.value = null
  }

  return { scenes, currentScene, loading, fetchScenes, selectScene, createScene, updateScene, deleteScene, clearScenes }
})
