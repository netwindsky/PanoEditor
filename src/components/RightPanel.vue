<template>
  <aside class="right-panel">
    <div class="panel-header">
      <div class="panel-tabs">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          :class="['panel-tab', { active: vm.rightPanelSection.value === tab.key }]"
          @click="vm.setRightPanelSection(tab.key)"
        >
          <el-icon :size="14">
            <component :is="tab.icon" />
          </el-icon>
          <span>{{ tab.label }}</span>
        </div>
      </div>
      <el-button text size="small" class="close-btn" @click="vm.toggleRightPanel">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>
    <div class="panel-sections">
      <SceneProperties v-if="vm.rightPanelSection.value === 'scene'" :vm="vm" />
      <HotspotProperties v-else-if="vm.rightPanelSection.value === 'hotspot'" />
      <AudioSettings v-else-if="vm.rightPanelSection.value === 'audio'" />
      <PostProcessingPanel v-else-if="vm.rightPanelSection.value === 'postprocessing'" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { Close, Collection, InfoFilled, Headset, MagicStick } from '@element-plus/icons-vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import SceneProperties from './SceneProperties.vue'
import HotspotProperties from './HotspotProperties.vue'
import AudioSettings from './AudioSettings.vue'
import PostProcessingPanel from './PostProcessingPanel.vue'

defineProps<{
  vm: EditorViewModel
}>()

interface TabItem {
  key: 'scene' | 'hotspot' | 'audio' | 'postprocessing'
  label: string
  icon: Component
}

const tabs: TabItem[] = [
  { key: 'scene', label: '场景', icon: Collection },
  { key: 'hotspot', label: '标注', icon: InfoFilled },
  { key: 'audio', label: '音频', icon: Headset },
  { key: 'postprocessing', label: '后期', icon: MagicStick },
]
</script>

<style scoped>
.right-panel {
  width: var(--panel-right-width);
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.panel-tabs {
  display: flex;
  flex: 1;
  min-width: 0;
}

.panel-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  padding: 10px 4px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}

.panel-tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.panel-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.close-btn {
  flex-shrink: 0;
  margin-right: 4px;
}

.panel-sections {
  flex: 1;
  overflow-y: auto;
}
</style>
