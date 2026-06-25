import { ref, onMounted, onUnmounted } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'

/**
 * 自动保存组合式函数（兼容层）
 * TODO: 迁移到 EditorViewModel
 */
export function useAutoSave(intervalMs = 30000) {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const timer = ref<ReturnType<typeof setInterval> | null>(null)

  async function save() {
    if (!projectStore.currentProject || !editorStore.isDirty) return
    editorStore.isSaving = true
    try {
      await projectStore.saveProject()
      editorStore.markSaved()
    } finally {
      editorStore.isSaving = false
    }
  }

  function start() {
    stop()
    timer.value = setInterval(save, intervalMs)
  }

  function stop() {
    if (timer.value) {
      clearInterval(timer.value)
      timer.value = null
    }
  }

  onMounted(start)
  onUnmounted(stop)

  return { save, start, stop }
}
