<template>
  <aside class="left-panel">
    <div class="panel-tabs">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        :class="['panel-tab', { active: vm.leftPanelTab.value === tab.key }]"
        @click="vm.setLeftPanelTab(tab.key)"
      >
        {{ tab.label }}
      </div>
    </div>
    <div class="panel-content">
      <SceneList v-if="vm.leftPanelTab.value === 'scene'" :viewModel="vm.sceneViewModel" :projectId="projectId" />
      <AssetGrid v-else-if="vm.leftPanelTab.value === 'asset'" :vm="vm.assetViewModel" :projectId="projectId" />
      <LayerPanel v-else-if="vm.leftPanelTab.value === 'layer'" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import SceneList from './SceneList.vue'
import AssetGrid from './AssetGrid.vue'
import LayerPanel from './LayerPanel.vue'

const props = defineProps<{
  vm: EditorViewModel
  projectId?: string
}>()

const tabs = [
  { key: 'scene' as const, label: '场景' },
  { key: 'asset' as const, label: '资源' },
  { key: 'layer' as const, label: '图层' },
]
</script>

<style scoped>
.left-panel {
  width: var(--panel-left-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.panel-tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.panel-tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.panel-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}
</style>
