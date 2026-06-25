<template>
  <div class="postprocessing-panel">
    <div class="prop-section">
      <div class="section-title">后期处理</div>
      <div class="prop-row">
        <label>亮度</label>
        <el-slider v-model="form.brightness" :min="-100" :max="100" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.brightness }}</span>
      </div>
      <div class="prop-row">
        <label>对比度</label>
        <el-slider v-model="form.contrast" :min="-100" :max="100" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.contrast }}</span>
      </div>
      <div class="prop-row">
        <label>饱和度</label>
        <el-slider v-model="form.saturation" :min="-100" :max="100" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.saturation }}</span>
      </div>
      <div class="prop-row">
        <label>色相</label>
        <el-slider v-model="form.hue" :min="-180" :max="180" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.hue }}°</span>
      </div>
    </div>
    <div class="prop-section">
      <div class="section-title">效果</div>
      <div class="prop-row">
        <label>暗角</label>
        <el-slider v-model="form.vignette" :min="0" :max="100" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.vignette }}%</span>
      </div>
      <div class="prop-row">
        <label>模糊</label>
        <el-slider v-model="form.blur" :min="0" :max="20" :step="0.5" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.blur }}px</span>
      </div>
      <div class="prop-row">
        <label>灰度</label>
        <el-slider v-model="form.grayscale" :min="0" :max="100" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.grayscale }}%</span>
      </div>
      <div class="prop-row">
        <label>棕褐色</label>
        <el-slider v-model="form.sepia" :min="0" :max="100" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.sepia }}%</span>
      </div>
    </div>
    <div class="prop-section">
      <el-button size="small" @click="resetForm">重置</el-button>
      <el-button size="small" @click="editorStore.setRightPanelSection('scene')">返回场景属性</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useSceneStore } from '@/stores/scene'
import { useEditorStore } from '@/stores/editor'
import { getPostProcessing, updatePostProcessing } from '@/api/postprocessing'

const sceneStore = useSceneStore()
const editorStore = useEditorStore()

const defaults = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  vignette: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
}

const form = reactive({ ...defaults })

watch(
  () => sceneStore.currentScene,
  async (scene) => {
    if (scene) {
      try {
        const res = await getPostProcessing(scene.id)
        const data = res.data.data
        Object.assign(form, {
          brightness: data.brightness,
          contrast: data.contrast,
          saturation: data.saturation,
          hue: data.hue,
          vignette: data.vignette,
          blur: data.blur,
          grayscale: data.grayscale,
          sepia: data.sepia,
        })
      } catch {
        Object.assign(form, defaults)
      }
    }
  },
  { immediate: true },
)

async function handleUpdate() {
  if (!sceneStore.currentScene) return
  await updatePostProcessing(sceneStore.currentScene.id, { ...form })
  editorStore.markDirty()
}

function resetForm() {
  Object.assign(form, defaults)
  handleUpdate()
}
</script>

<style scoped>
.postprocessing-panel {
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
  min-width: 50px;
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
</style>
