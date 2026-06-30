import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { EditorTool, HotspotToolType, LeftPanelTab, RightPanelSection } from '@/types'
import type { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'

/**
 * 编辑器 UI Store（兼容层）
 * TODO: 迁移到 EditorViewModel
 */
export const useEditorStore = defineStore('editor', () => {
  const activeTool = ref<EditorTool>('select')
  const hotspotType = ref<HotspotToolType>('info')
  const leftPanelTab = ref<LeftPanelTab>('scene')
  const leftPanelVisible = ref(true)
  const rightPanelVisible = ref(true)
  const rightPanelSection = ref<RightPanelSection>('scene')
  const zoom = ref(100)
  const isDirty = ref(false)
  const lastSavedAt = ref<string>('')
  const isSaving = ref(false)

  /** 引擎适配器引用，由 EditorCanvas 在引擎就绪时注入 */
  const engineAdapter = shallowRef<PanoEngineAdapter | null>(null)

  function setActiveTool(tool: EditorTool) {
    activeTool.value = tool
  }

  function setHotspotType(type: HotspotToolType) {
    hotspotType.value = type
  }

  function setLeftPanelTab(tab: LeftPanelTab) {
    leftPanelTab.value = tab
  }

  function toggleLeftPanel() {
    leftPanelVisible.value = !leftPanelVisible.value
  }

  function toggleRightPanel() {
    rightPanelVisible.value = !rightPanelVisible.value
  }

  function setRightPanelSection(section: RightPanelSection) {
    rightPanelSection.value = section
    rightPanelVisible.value = true
  }

  function setEngineAdapter(adapter: PanoEngineAdapter | null) {
    engineAdapter.value = adapter
  }

  function setZoom(value: number) {
    zoom.value = Math.max(25, Math.min(200, value))
  }

  function markDirty() {
    isDirty.value = true
  }

  function markSaved() {
    isDirty.value = false
    lastSavedAt.value = new Date().toLocaleTimeString('zh-CN')
  }

  return {
    activeTool, hotspotType, leftPanelTab, leftPanelVisible, rightPanelVisible,
    rightPanelSection, zoom, isDirty, lastSavedAt, isSaving, engineAdapter,
    setActiveTool, setHotspotType, setLeftPanelTab, toggleLeftPanel, toggleRightPanel,
    setRightPanelSection, setEngineAdapter, setZoom, markDirty, markSaved,
  }
})
