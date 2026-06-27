<template>
  <div class="toolbar">
    <!-- 左侧基础工具组 -->
    <div class="tool-group">
      <button
        v-for="tool in tools"
        :key="tool.key"
        class="tool-btn"
        :class="{ active: vm.activeTool.value === tool.key }"
        :title="tool.label"
        @click="handleToolClick(tool.key)"
      >
        <el-icon :size="16">
          <component :is="tool.icon" />
        </el-icon>
      </button>
    </div>

    <!-- 热点类型选择 - Segmented Control 风格 -->
    <div v-if="vm.activeTool.value === 'hotspot'" class="hotspot-segment">
      <div class="segment-divider" />
      <div class="segment-container">
        <button
          v-for="ht in hotspotTypes"
          :key="ht.key"
          class="segment-item"
          :class="{ active: vm.hotspotType.value === ht.key }"
          :title="ht.label"
          @click="vm.setHotspotType(ht.key)"
        >
          <el-icon :size="14">
            <component :is="ht.icon" />
          </el-icon>
          <span class="segment-label">{{ ht.label }}</span>
        </button>
      </div>
    </div>

    <!-- 右侧面板切换组 -->
    <div class="panel-group">
      <div class="group-divider" />
      <button class="tool-btn" title="切换左面板" @click="vm.toggleLeftPanel">
        <el-icon :size="16">
          <DArrowLeft />
        </el-icon>
      </button>
      <button class="tool-btn" title="切换右面板" @click="vm.toggleRightPanel">
        <el-icon :size="16">
          <DArrowRight />
        </el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type { EditorTool, HotspotToolType } from '@/types'
import {
  Pointer,
  Aim,
  Rank,
  ZoomIn,
  InfoFilled,
  Picture,
  Crop,
  Box,
  DArrowLeft,
  DArrowRight,
} from '@element-plus/icons-vue'

const props = defineProps<{
  vm: EditorViewModel
}>()

const tools: { key: EditorTool; icon: Component; label: string }[] = [
  { key: 'select', icon: Pointer, label: '选择' },
  { key: 'hotspot', icon: Aim, label: '添加热点' },
  { key: 'pan', icon: Rank, label: '平移' },
  { key: 'zoom', icon: ZoomIn, label: '缩放' },
]

const hotspotTypes: { key: HotspotToolType; icon: Component; label: string }[] = [
  { key: 'info', icon: InfoFilled, label: '信息点' },
  { key: 'image', icon: Picture, label: '图片' },
  { key: 'quad', icon: Crop, label: '四边形' },
  { key: 'model', icon: Box, label: '3D模型' },
]

function handleToolClick(tool: EditorTool) {
  props.vm.setActiveTool(tool)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  height: var(--toolbar-height);
  padding: 0 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  gap: 0;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  padding: 0;
}

.tool-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tool-btn.active {
  background: var(--accent-light);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.3);
}

/* 热点类型 Segmented Control */
.hotspot-segment {
  display: flex;
  align-items: center;
  margin-left: 4px;
}

.segment-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin-right: 12px;
}

.segment-container {
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: 3px;
  gap: 2px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
}

.segment-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 56px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.1s ease;
  padding: 0 8px;
}

.segment-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.segment-item.active {
  background: var(--bg-active);
  color: var(--accent);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}

.segment-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

/* 面板切换组 */
.panel-group {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.group-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 10px;
}
</style>
