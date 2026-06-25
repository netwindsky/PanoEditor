<template>
  <div class="timeline-bar">
    <div class="timeline-info">
      <span class="scene-indicator">
        {{ currentSceneIndex + 1 }} / {{ vm.sceneViewModel.scenes.value.length }}
      </span>
      <span class="scene-name">{{ vm.sceneViewModel.currentScene.value?.name || '未选择场景' }}</span>
    </div>
    <div class="timeline-track">
      <div
        v-for="(scene, index) in vm.sceneViewModel.scenes.value"
        :key="scene.id"
        :class="['timeline-thumb', { active: vm.sceneViewModel.currentScene.value?.id === scene.id }]"
        @click="handleSceneClick(scene.id)"
      >
        <div class="thumb-image" :style="{ backgroundImage: 'url(' + (scene.thumbUrl || scene.previewUrl) + ')' }">
          <span class="thumb-index">{{ index + 1 }}</span>
        </div>
        <span class="thumb-name">{{ scene.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'

const props = defineProps<{
  vm: EditorViewModel
}>()

const currentSceneIndex = computed(() => {
  const scenes = props.vm.sceneViewModel.scenes.value
  const currentId = props.vm.sceneViewModel.currentScene.value?.id
  return scenes.findIndex((s) => s.id === currentId)
})

function handleSceneClick(sceneId: string) {
  props.vm.switchScene(sceneId)
}
</script>

<style scoped>
.timeline-bar {
  height: 80px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.timeline-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 11px;
  color: var(--text-muted);
}

.scene-indicator {
  font-weight: 600;
}

.timeline-track {
  display: flex;
  gap: 8px;
  padding: 0 12px 8px;
  overflow-x: auto;
}

.timeline-thumb {
  flex-shrink: 0;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.timeline-thumb:hover {
  opacity: 1;
}

.timeline-thumb.active {
  opacity: 1;
}

.thumb-image {
  width: 64px;
  height: 40px;
  border-radius: 4px;
  background-size: cover;
  background-position: center;
  position: relative;
}

.thumb-index {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.6);
  padding: 0 4px;
  border-radius: 2px;
}

.thumb-name {
  display: block;
  font-size: 10px;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 2px;
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
