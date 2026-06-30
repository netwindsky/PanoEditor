<template>
  <div class="postprocessing-panel">
    <!-- 启用开关 -->
    <div class="prop-section">
      <div class="section-title">
        后期处理
        <el-switch
          v-model="form.enabled"
          data-testid="enabled-switch"
          size="small"
          @change="handleUpdate"
        />
      </div>
    </div>

    <!-- 基础调色 -->
    <div class="prop-section">
      <div class="section-title">基础调色</div>
      <div class="prop-row">
        <label>曝光</label>
        <el-slider
          v-model="form.exposure"
          data-testid="exposure-slider"
          :min="0"
          :max="3"
          :step="0.05"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.exposure.toFixed(2) }}</span>
      </div>
      <div class="prop-row">
        <label>对比度</label>
        <el-slider
          v-model="form.contrast"
          data-testid="contrast-slider"
          :min="0"
          :max="2"
          :step="0.05"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.contrast.toFixed(2) }}</span>
      </div>
      <div class="prop-row">
        <label>饱和度</label>
        <el-slider
          v-model="form.saturation"
          data-testid="saturation-slider"
          :min="0"
          :max="2"
          :step="0.05"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.saturation.toFixed(2) }}</span>
      </div>
      <div class="prop-row">
        <label>色温</label>
        <el-slider
          v-model="form.colorTemperature"
          data-testid="color-temperature-slider"
          :min="-100"
          :max="100"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.colorTemperature }}</span>
      </div>
    </div>

    <!-- 色调映射 -->
    <div class="prop-section">
      <div class="section-title">色调映射</div>
      <div class="prop-row">
        <label>模式</label>
        <el-select
          v-model="form.toneMapping"
          data-testid="tone-mapping-select"
          size="small"
          placeholder="选择色调映射"
          @change="handleUpdate"
        >
          <el-option label="无" value="none" />
          <el-option label="ACES" value="ACES" />
          <el-option label="Reinhard" value="Reinhard" />
          <el-option label="Linear" value="Linear" />
        </el-select>
      </div>
    </div>

    <!-- Bloom 辉光 -->
    <div class="prop-section">
      <div class="section-title">Bloom 辉光</div>
      <div class="prop-row">
        <label>强度</label>
        <el-slider
          v-model="form.bloomStrength"
          data-testid="bloom-strength-slider"
          :min="0"
          :max="2"
          :step="0.05"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.bloomStrength.toFixed(2) }}</span>
      </div>
      <div class="prop-row">
        <label>阈值</label>
        <el-slider
          v-model="form.bloomThreshold"
          data-testid="bloom-threshold-slider"
          :min="0"
          :max="1"
          :step="0.05"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.bloomThreshold.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="prop-section">
      <el-button size="small" data-testid="reset-btn" @click="resetForm">重置</el-button>
      <el-button size="small" @click="editorStore.setRightPanelSection('scene')">返回场景属性</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, onBeforeUnmount } from 'vue'
import { useSceneStore } from '@/stores/scene'
import { useEditorStore } from '@/stores/editor'
import { getPostProcessing, updatePostProcessing } from '@/api/postprocessing'
import type { UpdatePostProcessingParams } from '@/types'

const sceneStore = useSceneStore()
const editorStore = useEditorStore()

const defaults = {
  presetStyle: 'original',
  lutResourceId: '',
  toneMapping: 'none',
  exposure: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  colorTemperature: 0,
  bloomStrength: 0,
  bloomThreshold: 0.8,
  enabled: true,
}

const form = reactive({ ...defaults })

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleUpdate() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    doUpdate()
  }, 300)
}

async function doUpdate() {
  if (!sceneStore.currentScene) return
  const params: UpdatePostProcessingParams = {
    presetStyle: form.presetStyle,
    lutResourceId: form.lutResourceId || undefined,
    toneMapping: form.toneMapping,
    exposure: form.exposure,
    contrast: form.contrast,
    saturation: form.saturation,
    colorTemperature: form.colorTemperature,
    bloomStrength: form.bloomStrength,
    bloomThreshold: form.bloomThreshold,
    enabled: form.enabled,
  }
  await updatePostProcessing(sceneStore.currentScene.id, params)
  editorStore.markDirty()
}

async function handleUpdate() {
  scheduleUpdate()
}

function resetForm() {
  Object.assign(form, defaults)
  handleUpdate()
}

watch(
  () => sceneStore.currentScene,
  async (scene) => {
    if (scene) {
      try {
        const res = await getPostProcessing(scene.id)
        const data = res.data.data
        if (data) {
          Object.assign(form, {
            presetStyle: data.presetStyle || defaults.presetStyle,
            lutResourceId: data.lutResourceId || defaults.lutResourceId,
            toneMapping: data.toneMapping || defaults.toneMapping,
            exposure: data.exposure ?? defaults.exposure,
            contrast: data.contrast ?? defaults.contrast,
            saturation: data.saturation ?? defaults.saturation,
            colorTemperature: data.colorTemperature ?? defaults.colorTemperature,
            bloomStrength: data.bloomStrength ?? defaults.bloomStrength,
            bloomThreshold: data.bloomThreshold ?? defaults.bloomThreshold,
            enabled: data.enabled ?? defaults.enabled,
          })
        } else {
          Object.assign(form, defaults)
        }
      } catch {
        Object.assign(form, defaults)
      }
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
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
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.prop-row .el-select {
  flex: 1;
}

.prop-value {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 40px;
  text-align: right;
}
</style>
