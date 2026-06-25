<template>
  <div class="scene-properties">
    <div class="prop-section">
      <div class="section-title">场景属性</div>
      <div class="prop-row">
        <label>名称</label>
        <el-input v-model="form.name" size="small" @change="handleUpdate" />
      </div>
    </div>
    <div class="prop-section">
      <div class="section-title">初始视角</div>
      <div class="prop-row">
        <label>水平视角 (Yaw)</label>
        <el-slider v-model="form.yaw" :min="-180" :max="180" :step="1" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.yaw }}°</span>
      </div>
      <div class="prop-row">
        <label>垂直视角 (Pitch)</label>
        <el-slider v-model="form.pitch" :min="-90" :max="90" :step="1" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.pitch }}°</span>
      </div>
      <div class="prop-row">
        <label>视场角 (HFOV)</label>
        <el-slider v-model="form.hfov" :min="30" :max="150" :step="1" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.hfov }}°</span>
      </div>
    </div>
    <div class="prop-section">
      <div class="section-title">快捷操作</div>
      <div class="prop-actions">
        <el-button size="small" @click="editorStore.setRightPanelSection('audio')">音频设置</el-button>
        <el-button size="small" @click="editorStore.setRightPanelSection('postprocessing')">后期处理</el-button>
        <el-button size="small" @click="editorStore.setRightPanelSection('asset')">资源库</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useSceneStore } from '@/stores/scene'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'

const sceneStore = useSceneStore()
const projectStore = useProjectStore()
const editorStore = useEditorStore()

const form = reactive({
  name: '',
  yaw: 0,
  pitch: 0,
  hfov: 100,
})

watch(
  () => sceneStore.currentScene,
  (scene) => {
    if (scene) {
      form.name = scene.name
      form.yaw = scene.initialView?.yaw ?? 0
      form.pitch = scene.initialView?.pitch ?? 0
      form.hfov = scene.initialView?.hfov ?? 100
    }
  },
  { immediate: true },
)

async function handleUpdate() {
  if (!sceneStore.currentScene || !projectStore.currentProject) return
  await sceneStore.updateScene(sceneStore.currentScene.id, {
    name: form.name,
    initialView: { yaw: form.yaw, pitch: form.pitch, hfov: form.hfov },
  })
  editorStore.markDirty()
}
</script>

<style scoped>
.scene-properties {
  padding: 12px;
}

.prop-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.prop-row label {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 80px;
  flex-shrink: 0;
}

.prop-row .el-slider {
  flex: 1;
}

.prop-value {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 40px;
  text-align: right;
}

.prop-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
