<template>
  <div class="layer-panel">
    <div class="panel-header">
      <span class="panel-title">热点图层</span>
      <span class="panel-count">{{ hotspots.length }}</span>
    </div>
    <div class="layer-list">
      <div
        v-for="hotspot in hotspots"
        :key="hotspot.id"
        :class="['layer-item', { active: selectedHotspotId === hotspot.id }]"
        @click="handleSelect(hotspot.id)"
      >
        <span class="layer-icon" :title="getHotspotTypeLabel(hotspot.type)">{{ getHotspotIcon(hotspot.type) }}</span>
        <span class="layer-name">{{ hotspot.name }}</span>
        <span class="layer-style-badge" :title="hotspot.style">{{ getStyleShortLabel(hotspot.style) }}</span>
        <el-button text size="small" class="layer-delete" @click.stop="handleDelete(hotspot.id)">×</el-button>
      </div>
      <div v-if="hotspots.length === 0" class="layer-empty">
        当前场景暂无热点
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'

const vm = inject<EditorViewModel>('editorViewModel')!

const hotspots = computed(() => vm.hotspotViewModel.hotspots.value)
const selectedHotspotId = computed(() => vm.hotspotViewModel.selectedHotspot.value?.id ?? null)

// 热点类型图标映射
const typeIcons: Record<string, string> = {
  info: 'ℹ',
  scene: '⊕',
  image: '🖼',
  quad: '▭',
  model: '⬡',
  video: '▶',
}

// 热点类型标签映射
const typeLabels: Record<string, string> = {
  info: '信息点',
  scene: '场景跳转',
  image: '图片',
  quad: '矩形',
  model: '3D模型',
  video: '视频',
}

// 样式短标签映射
const styleShortLabels: Record<string, string> = {
  'pulsing-dot': '脉冲',
  'floating-arrow': '箭头',
  'ripple-marker': '波纹',
  'rotating-diamond': '菱形',
  'target-crosshair': '瞄准',
  'glow-orb': '发光',
  'info-icon': '信息',
  'glass-text': '毛玻璃',
  'double-ring': '双环',
  'map-pin': '大头针',
  'navi-point': '导航',
  'video-play': '播放',
  'warning-sign': '警告',
  'custom-image': '图片',
  'custom-video': '视频',
  'custom-web': '网页',
}

function getHotspotIcon(type: string): string {
  return typeIcons[type] || '⊕'
}

function getHotspotTypeLabel(type: string): string {
  return typeLabels[type] || type
}

function getStyleShortLabel(style?: string): string {
  if (!style) return ''
  return styleShortLabels[style] || style.slice(0, 4)
}

function handleSelect(hotspotId: string) {
  vm.hotspotViewModel.selectHotspot(hotspotId)
  vm.setRightPanelSection('hotspot')
}

function handleDelete(hotspotId: string) {
  vm.removeHotspot(hotspotId)
}
</script>

<style scoped>
.layer-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 8px;
}

.layer-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.layer-item:hover {
  background: var(--bg-hover);
}

.layer-item.active {
  background: var(--accent-light);
}

.layer-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.layer-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-style-badge {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  max-width: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-delete {
  color: var(--text-muted);
  font-size: 14px;
  padding: 2px;
  flex-shrink: 0;
}

.layer-empty {
  padding: 20px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
