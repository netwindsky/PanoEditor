import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Scene } from '@/types'
import * as sceneApi from '@/api/scene'

/**
 * 场景 Store（兼容层）
 * TODO: 迁移到 SceneViewModel
 */
export const useSceneStore = defineStore('scene', () => {
  const scenes = ref<Scene[]>([])
  const currentScene = ref<Scene | null>(null)
  const loading = ref(false)

  async function fetchScenes(projectId: string) {
    loading.value = true
    try {
      const res = await sceneApi.getScenes(projectId)
      scenes.value = res.data.data
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
    scenes.value.push(res.data.data)
    return res.data.data
  }

  async function updateScene(sceneId: string, params: Record<string, unknown>) {
    const res = await sceneApi.updateScene(sceneId, params)
    const updated = res.data.data
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
