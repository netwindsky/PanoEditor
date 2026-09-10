<template>
  <div class="lighting-panel">
    <!-- 环境贴图 -->
    <div class="prop-section">
      <div class="section-title">
        <span>环境贴图（HDR）</span>
        <el-switch
          :model-value="envEnabled"
          data-testid="env-enabled-switch"
          size="small"
          @update:model-value="onEnvEnabled"
        />
      </div>
      <template v-if="envEnabled">
        <el-upload
          class="env-upload"
          accept=".hdr"
          :show-file-list="false"
          :auto-upload="true"
          :http-request="handleEnvUpload"
        >
          <el-button size="small" data-testid="upload-env-btn" :loading="lightingVm.uploadingEnv.value">
            上传 .hdr 环境贴图
          </el-button>
        </el-upload>
        <div v-if="lightingVm.envMapUrl.value" class="env-current">
          <span class="env-name" data-testid="env-name" :title="lightingVm.envMapUrl.value">
            {{ envFileName }}
          </span>
          <el-button
            size="small"
            text
            type="danger"
            data-testid="remove-env-btn"
            @click="removeEnvMap"
          >移除</el-button>
        </div>
        <div v-else class="env-hint">未设置，使用默认室内环境光</div>
      </template>
      <div v-else class="env-hint">环境照明已关闭</div>
    </div>

    <!-- 太阳光 -->
    <div class="prop-section">
      <div class="section-title">
        <span>太阳光</span>
        <el-switch
          :model-value="sun.enabled"
          data-testid="sun-enabled-switch"
          size="small"
          @update:model-value="onSunEnabled"
        />
      </div>

      <div class="prop-row">
        <label>颜色</label>
        <el-color-picker
          :model-value="sun.color"
          data-testid="sun-color-picker"
          size="small"
          @update:model-value="onSunColor"
        />
        <span class="prop-value">{{ sun.color }}</span>
      </div>

      <!-- 太阳光颜色预设：点击即应用 -->
      <div class="sun-presets">
        <div
          v-for="preset in SUN_COLOR_PRESETS"
          :key="preset.color"
          class="sun-preset-chip"
          :class="{ active: isCurrentSunColor(preset.color) }"
          :style="{ backgroundColor: preset.color }"
          :title="`${preset.label} ${preset.color}`"
          :data-testid="`sun-preset-${preset.color}`"
          @click="onSunColor(preset.color)"
        />
      </div>

      <div class="slider-row">
        <label>强度</label>
        <el-slider
          :model-value="sun.intensity"
          data-testid="sun-intensity-slider"
          :min="0"
          :max="10"
          :step="0.1"
          @update:model-value="onSunIntensity"
        />
        <span class="prop-value">{{ sun.intensity.toFixed(1) }}</span>
      </div>

      <div class="slider-row">
        <label>方位角</label>
        <el-slider
          :model-value="sun.azimuth"
          data-testid="sun-azimuth-slider"
          :min="0"
          :max="360"
          :step="1"
          @update:model-value="onSunAzimuth"
        />
        <span class="prop-value">{{ Math.round(sun.azimuth) }}°</span>
      </div>

      <div class="slider-row">
        <label>仰角</label>
        <el-slider
          :model-value="sun.elevation"
          data-testid="sun-elevation-slider"
          :min="-90"
          :max="90"
          :step="1"
          @update:model-value="onSunElevation"
        />
        <span class="prop-value">{{ Math.round(sun.elevation) }}°</span>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="prop-section actions">
      <el-button size="small" @click="editorStore.setRightPanelSection('scene')">返回场景属性</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { UploadRequestOptions } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useEditorStore } from '@/stores/editor'
import { envMapFileName } from '@/api/lighting'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type { LightingViewModel } from '@/viewmodels/LightingViewModel'

/**
 * 光照面板（MVC 的 V）：不持有任何状态，只读 LightingViewModel 状态、只调其方法。
 * - 滑块/开关/颜色实时反映 VM 状态（画布 gizmo 拖拽时自动跟随）；
 * - 用户交互 → 调 VM 方法（合并状态 → 引擎预览 → 防抖持久化）。
 */
const props = defineProps<{ vm: EditorViewModel }>()
const editorStore = useEditorStore()

const lightingVm: LightingViewModel = props.vm.lightingViewModel

/** 当前太阳光状态快照（VM 状态变化时自动重渲染） */
const sun = computed(() => lightingVm.sunConfig.value)
const envFileName = computed(() => envMapFileName(lightingVm.envMapUrl.value))
const envEnabled = computed(() => lightingVm.envEnabled.value)

/** 太阳光颜色预设（按一天中的时段） */
const SUN_COLOR_PRESETS = [
  { label: '清晨', color: '#ffc4b8' },
  { label: '早晨', color: '#ffd9a0' },
  { label: '正午', color: '#ffffff' },
  { label: '午后', color: '#fff2d9' },
  { label: '黄昏', color: '#ff8c42' },
  { label: '日落', color: '#ff6b35' },
  { label: '夜晚', color: '#6a8cff' },
  { label: '阴天', color: '#c8d0dc' },
] as const

/** 当前太阳光颜色（小写归一，用于预设高亮匹配） */
const currentColor = computed(() => sun.value.color.toLowerCase())

function isCurrentSunColor(color: string): boolean {
  return currentColor.value === color.toLowerCase()
}

function onSunEnabled(v: boolean | string | number) {
  lightingVm.setSunFields({ enabled: Boolean(v) })
}
function onEnvEnabled(v: boolean | string | number) {
  void lightingVm.setEnvEnabled(Boolean(v))
}
function onSunColor(v: string | null) {
  if (v) lightingVm.setSunFields({ color: v })
}
function onSunIntensity(v: number | string) {
  lightingVm.setSunFields({ intensity: Number(v) })
}
function onSunAzimuth(v: number | string) {
  lightingVm.setSunFields({ azimuth: Number(v) })
}
function onSunElevation(v: number | string) {
  lightingVm.setSunFields({ elevation: Number(v) })
}

/** el-upload 自定义上传：交给 VM（上传资源 → 状态 → 引擎 → 立即持久化） */
async function handleEnvUpload(options: UploadRequestOptions): Promise<void> {
  try {
    await lightingVm.setEnvMap(lightingVm.envMapUrl.value, options.file)
    ElMessage.success('环境贴图上传成功')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '未知错误'
    ElMessage.error('环境贴图上传失败：' + msg)
  }
}

/** 移除环境贴图：恢复默认 RoomEnvironment 并持久化 */
function removeEnvMap() {
  void lightingVm.setEnvMap(null)
}
</script>

<style scoped>
.lighting-panel {
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

.prop-row label,
.slider-row label {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 50px;
  flex-shrink: 0;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.slider-row :deep(.el-slider) {
  flex: 1;
}

.prop-value {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 42px;
  text-align: right;
}

.sun-presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  /* 与颜色选择器对齐：label 宽 50px + 行内 gap 8px */
  margin: 2px 0 10px 58px;
}

.sun-preset-chip {
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
  cursor: pointer;
  transition: transform 0.12s ease;
}

.sun-preset-chip:hover {
  transform: scale(1.15);
}

.sun-preset-chip.active {
  border: 2px solid var(--accent);
}

.env-upload {
  margin-bottom: 8px;
}

.env-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.env-name {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.env-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.prop-section.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
