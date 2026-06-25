<template>
  <aside class="right-panel">
    <div class="panel-header">
      <span class="panel-title">属性</span>
      <el-button text size="small" @click="vm.toggleRightPanel">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>
    <div class="panel-sections">
      <SceneProperties v-if="vm.rightPanelSection.value === 'scene'" />
      <HotspotProperties v-else-if="vm.rightPanelSection.value === 'hotspot'" />
      <AudioSettings v-else-if="vm.rightPanelSection.value === 'audio'" />
      <PostProcessingPanel v-else-if="vm.rightPanelSection.value === 'postprocessing'" />
      <AssetLibrary v-else-if="vm.rightPanelSection.value === 'asset'" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import SceneProperties from './SceneProperties.vue'
import HotspotProperties from './HotspotProperties.vue'
import AudioSettings from './AudioSettings.vue'
import PostProcessingPanel from './PostProcessingPanel.vue'
import AssetLibrary from './AssetLibrary.vue'

const props = defineProps<{
  vm: EditorViewModel
}>()
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
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-sections {
  flex: 1;
  overflow-y: auto;
}
</style>
