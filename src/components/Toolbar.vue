<template>
  <div class="toolbar">
    <div class="tool-group">
      <div
        v-for="tool in tools"
        :key="tool.key"
        :class="['tool-btn', { active: vm.activeTool.value === tool.key }]"
        :title="tool.label"
        @click="handleToolClick(tool.key)"
      >
        <span class="tool-icon">{{ tool.icon }}</span>
      </div>
    </div>

    <!-- 热点类型选择 -->
    <div v-if="vm.activeTool.value === 'hotspot'" class="hotspot-type-group">
      <div class="tool-divider" />
      <div
        v-for="ht in hotspotTypes"
        :key="ht.key"
        :class="['tool-btn', 'hotspot-type-btn', { active: vm.hotspotType.value === ht.key }]"
        :title="ht.label"
        @click="vm.setHotspotType(ht.key)"
      >
        <span class="tool-icon">{{ ht.icon }}</span>
        <span class="hotspot-type-label">{{ ht.label }}</span>
      </div>
    </div>

    <div class="tool-divider" />
    <div class="tool-group">
      <div class="tool-btn" title="切换左面板" @click="vm.toggleLeftPanel">
        <span class="tool-icon">◧</span>
      </div>
      <div class="tool-btn" title="切换右面板" @click="vm.toggleRightPanel">
        <span class="tool-icon">◨</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type { EditorTool, HotspotToolType } from '@/types'

const props = defineProps<{
  vm: EditorViewModel
}>()

const tools: { key: EditorTool; icon: string; label: string }[] = [
  { key: 'select', icon: '⊹', label: '选择' },
  { key: 'hotspot', icon: '⊕', label: '添加热点' },
  { key: 'pan', icon: '✥', label: '平移' },
  { key: 'zoom', icon: '⊞', label: '缩放' },
]

const hotspotTypes: { key: HotspotToolType; icon: string; label: string }[] = [
  { key: 'info', icon: 'ℹ', label: '信息点' },
  { key: 'scene', icon: '⊕', label: '场景跳转' },
  { key: 'image', icon: '🖼', label: '图片' },
  { key: 'quad', icon: '▭', label: '矩形' },
  { key: 'model', icon: '⬡', label: '3D模型' },
]

function handleToolClick(tool: EditorTool) {
  props.vm.setActiveTool(tool)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.tool-group {
  display: flex;
  gap: 2px;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}

.tool-btn:hover {
  background: var(--bg-hover);
}

.tool-btn.active {
  background: var(--bg-active);
}

.tool-icon {
  font-size: 16px;
}

.tool-divider {
  width: 1px;
  height: 24px;
  background: var(--border-color);
}

.hotspot-type-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.hotspot-type-btn {
  width: auto;
  padding: 0 8px;
  gap: 4px;
}

.hotspot-type-label {
  font-size: 12px;
}
</style>
