<template>
  <footer class="status-bar">
    <div class="status-left">
      <span class="status-item">{{ projectName }}</span>
      <span class="status-divider">|</span>
      <span class="status-item">场景: {{ sceneCount }}</span>
      <span class="status-divider">|</span>
      <span class="status-item">热点: {{ hotspotCount }}</span>
    </div>
    <div class="status-right">
      <span v-if="vm.isDirty.value" class="status-item status-unsaved">未保存</span>
      <span v-else-if="vm.lastSavedAt.value" class="status-item">已保存 {{ vm.lastSavedAt.value }}</span>
      <span class="status-divider">|</span>
      <span class="status-item zoom-control">
        <button class="zoom-btn" @click="vm.setZoom(vm.zoom.value - 10)">−</button>
        <span>{{ vm.zoom.value }}%</span>
        <button class="zoom-btn" @click="vm.setZoom(vm.zoom.value + 10)">+</button>
      </span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'

const props = defineProps<{
  vm: EditorViewModel
}>()

const projectName = computed(() => '未打开项目')
const sceneCount = computed(() => props.vm.sceneViewModel.scenes.value.length)
const hotspotCount = computed(() => props.vm.hotspotViewModel.hotspots.value.length)
</script>

<style scoped>
.status-bar {
  height: var(--statusbar-height);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.status-left, .status-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-item {
  padding: 0 4px;
}

.status-divider {
  color: var(--border-color);
}

.status-unsaved {
  color: var(--warning);
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoom-btn {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  width: 18px;
  height: 18px;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.zoom-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
