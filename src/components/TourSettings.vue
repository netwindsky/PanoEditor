<template>
  <div class="tour-settings">
    <!-- 自动旋转 -->
    <div class="prop-section">
      <div class="section-title">自动旋转</div>
      <div class="prop-row">
        <label>启用</label>
        <el-switch
          v-model="form.autoRotate"
          data-testid="auto-rotate-switch"
          @change="handleUpdate"
        />
      </div>
      <div class="prop-row">
        <label>旋转速度</label>
        <el-slider
          v-model="form.autoRotateSpeed"
          data-testid="auto-rotate-speed-slider"
          :min="0"
          :max="10"
          :step="0.1"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.autoRotateSpeed.toFixed(1) }}</span>
      </div>
    </div>

    <!-- 视角设置 -->
    <div class="prop-section">
      <div class="section-title">视角设置</div>
      <div class="prop-row">
        <label>默认FOV</label>
        <el-slider
          v-model="form.defaultFov"
          data-testid="default-fov-slider"
          :min="30"
          :max="170"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.defaultFov }}°</span>
      </div>
      <div class="prop-row">
        <label>最小FOV</label>
        <el-slider
          v-model="form.minFov"
          data-testid="min-fov-slider"
          :min="10"
          :max="90"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.minFov }}°</span>
      </div>
      <div class="prop-row">
        <label>最大FOV</label>
        <el-slider
          v-model="form.maxFov"
          data-testid="max-fov-slider"
          :min="90"
          :max="170"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.maxFov }}°</span>
      </div>
      <div class="prop-row">
        <label>罗盘</label>
        <el-switch
          v-model="form.enableCompass"
          data-testid="enable-compass-switch"
          @change="handleUpdate"
        />
      </div>
    </div>

    <!-- 皮肤设置 -->
    <div class="prop-section">
      <div class="section-title">皮肤设置</div>
      <div class="prop-row">
        <label>控制栏</label>
        <el-switch
          v-model="form.controlbar"
          data-testid="controlbar-switch"
          @change="handleUpdate"
        />
      </div>
      <div class="prop-row">
        <label>缩略图</label>
        <el-switch
          v-model="form.thumbs"
          data-testid="thumbs-switch"
          @change="handleUpdate"
        />
      </div>
      <div class="prop-row">
        <label>工具提示</label>
        <el-switch
          v-model="form.tooltips"
          data-testid="tooltips-switch"
          @change="handleUpdate"
        />
      </div>
    </div>

    <!-- 场景切换特效 -->
    <div class="prop-section">
      <div class="section-title">场景切换特效</div>
      <div class="prop-row">
        <label>切换特效</label>
        <el-select
          v-model="form.loadsceneBlend"
          data-testid="loadscene-blend-select"
          size="small"
          placeholder="选择切换特效"
          @change="handleUpdate"
        >
          <el-option label="无" value="OFF" />
          <el-option label="淡入淡出" value="BLEND(1, easeOutCubic)" />
          <el-option label="黑白过渡" value="BLEND(1, easeInOutCubic, simpleScale)" />
          <el-option label="缩放过渡" value="BLEND(2, easeInOutCubic)" />
          <el-option label="滑动" value="BLEND(1.5, easeOutQuad, scaledir)" />
        </el-select>
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
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { updateProject } from '@/api/project'
import type { TourSettings } from '@/types'

const projectStore = useProjectStore()
const editorStore = useEditorStore()

const defaults: TourSettings = {
  autoRotate: false,
  autoRotateSpeed: 1.0,
  defaultFov: 100,
  minFov: 50,
  maxFov: 150,
  enableCompass: false,
  controlbar: true,
  thumbs: true,
  tooltips: true,
  designStyle: 'flat',
  loadsceneBlend: 'BLEND(1, easeOutCubic)',
}

const form = reactive<TourSettings>({ ...defaults })

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleUpdate() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    doUpdate()
  }, 300)
}

async function doUpdate() {
  const project = projectStore.currentProject
  if (!project) return
  const settingsJson = JSON.stringify({ ...form })
  await updateProject(project.id, { settings: settingsJson })
  editorStore.markDirty()
}

async function handleUpdate() {
  scheduleUpdate()
}

function resetForm() {
  Object.assign(form, defaults)
  handleUpdate()
}

function loadFromSettings(settingsJson?: string) {
  if (settingsJson) {
    try {
      const parsed = JSON.parse(settingsJson) as Partial<TourSettings>
      Object.assign(form, defaults, parsed)
    } catch {
      Object.assign(form, defaults)
    }
  } else {
    Object.assign(form, defaults)
  }
}

watch(
  () => projectStore.currentProject,
  (project) => {
    if (project) {
      loadFromSettings(project.settings)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.tour-settings {
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
  min-width: 60px;
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
