import { useProjectStore } from '@/stores/project'
import { useSceneStore } from '@/stores/scene'
import { useEditorStore } from '@/stores/editor'
import { useHotspotStore } from '@/stores/hotspot'
import type { CreateHotspotParams } from '@/types'

/**
 * 编辑器组合式函数（兼容层）
 * TODO: 迁移到 EditorViewModel
 */
export function useEditor() {
  const projectStore = useProjectStore()
  const sceneStore = useSceneStore()
  const editorStore = useEditorStore()
  const hotspotStore = useHotspotStore()

  async function loadProject(projectId: string) {
    await projectStore.fetchProject(projectId)
    await sceneStore.fetchScenes(projectId)
    if (sceneStore.currentScene) {
      await hotspotStore.fetchHotspots(sceneStore.currentScene.id)
    }
  }

  async function switchScene(sceneId: string) {
    await sceneStore.selectScene(sceneId)
    if (sceneStore.currentScene) {
      await hotspotStore.fetchHotspots(sceneStore.currentScene.id)
    }
    editorStore.setRightPanelSection('scene')
  }

  async function addHotspot(params: CreateHotspotParams) {
    if (!sceneStore.currentScene) return
    const hotspot = await hotspotStore.createHotspot(sceneStore.currentScene.id, params)
    editorStore.markDirty()
    return hotspot
  }

  async function removeHotspot(hotspotId: string) {
    await hotspotStore.deleteHotspot(hotspotId)
    editorStore.markDirty()
  }

  return {
    projectStore, sceneStore, editorStore, hotspotStore,
    loadProject, switchScene, addHotspot, removeHotspot,
  }
}
