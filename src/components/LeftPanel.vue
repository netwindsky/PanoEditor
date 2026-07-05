<template>
  <aside class="left-panel">
    <div class="panel-content">
      <SceneList :viewModel="vm.sceneViewModel" :projectId="projectId" @select="(id: string) => vm.switchScene(id)" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import SceneList from './SceneList.vue'

defineProps<{
  vm: EditorViewModel
  projectId?: string
}>()
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

.panel-content {
  flex: 1;
  overflow-y: auto;
}
</style>
