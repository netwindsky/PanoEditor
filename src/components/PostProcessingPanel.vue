<template>
  <div class="postprocessing-panel">
    <!-- 启用开关 -->
    <div class="prop-section">
      <div class="section-title">
        <span>后期处理</span>
        <el-switch
          v-model="form.enabled"
          data-testid="enabled-switch"
          size="small"
          @change="handleUpdate"
        />
      </div>
    </div>

    <!-- 预设选择 -->
    <div class="prop-section">
      <div class="section-title">预设风格</div>
      <div class="preset-grid" data-testid="preset-grid">
        <div
          v-for="p in presetOptions"
          :key="p.key"
          class="preset-card"
          :class="{ active: form.presetStyle === p.key }"
          data-testid="preset-card"
          @click="selectPreset(p.key)"
        >
          <span class="preset-name">{{ p.name }}</span>
        </div>
      </div>
    </div>

    <!-- LUT -->
    <div class="prop-section">
      <div class="section-title">
        <span>LUT 调色</span>
        <el-button
          size="small"
          text
          type="primary"
          data-testid="upload-lut-btn"
          @click="triggerLutUpload"
        >上传 LUT</el-button>
      </div>
      <input
        ref="lutFileInput"
        type="file"
        accept=".cube,.png"
        style="display:none"
        @change="onLutFileSelected"
      />
      <div class="prop-row">
        <label>选择LUT</label>
        <el-select
          v-model="form.lutResourceId"
          data-testid="lut-select"
          size="small"
          placeholder="无"
          clearable
          class="flex-1"
          @change="onLutChange"
        >
          <el-option
            v-for="lut in lutOptions"
            :key="lut.id"
            :label="lut.name"
            :value="lut.id"
          />
        </el-select>
      </div>
      <div v-if="form.lutResourceId" class="prop-row">
        <label>强度</label>
        <el-input-number
          v-model="form.lutIntensity"
          data-testid="lut-intensity-input"
          :min="0"
          :max="1"
          :step="0.05"
          :precision="2"
          :controls-position="'right'"
          size="small"
          class="num-input"
          @change="handleUpdate"
        />
        <el-button
          size="small"
          text
          type="danger"
          @click="removeLut"
        >移除</el-button>
      </div>
      <div v-if="uploadingLut" class="upload-hint">上传中…</div>
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
          class="flex-1"
          @change="handleUpdate"
        >
          <el-option label="无" value="none" />
          <el-option label="ACES" value="ACES" />
          <el-option label="Reinhard" value="Reinhard" />
          <el-option label="Linear" value="Linear" />
        </el-select>
      </div>
    </div>

    <!-- 基础调色（数值框） -->
    <div class="prop-section">
      <div class="section-title">基础调色</div>

      <div class="prop-row" v-for="field in numericFields" :key="field.key">
        <label>{{ field.label }}</label>
        <el-input-number
          :model-value="(form as any)[field.key]"
          :data-testid="`${field.key}-input`"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :precision="field.precision"
          :controls-position="'right'"
          size="small"
          class="num-input"
          @update:model-value="(val: number | null | undefined) => onNumericChange(field.key, val)"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ formatField(field.key) }}</span>
      </div>
    </div>

    <!-- Bloom 辉光 -->
    <div class="prop-section">
      <div class="section-title">Bloom 辉光</div>
      <div class="prop-row">
        <label>强度</label>
        <el-input-number
          v-model="form.bloomStrength"
          data-testid="bloom-strength-input"
          :min="0"
          :max="2"
          :step="0.05"
          :precision="2"
          :controls-position="'right'"
          size="small"
          class="num-input"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.bloomStrength.toFixed(2) }}</span>
      </div>
      <div class="prop-row">
        <label>阈值</label>
        <el-input-number
          v-model="form.bloomThreshold"
          data-testid="bloom-threshold-input"
          :min="0"
          :max="1"
          :step="0.05"
          :precision="2"
          :controls-position="'right'"
          size="small"
          class="num-input"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.bloomThreshold.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="prop-section actions">
      <el-button size="small" data-testid="reset-btn" @click="resetForm">重置</el-button>
      <el-button size="small" @click="editorStore.setRightPanelSection('scene')">返回场景属性</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, onBeforeUnmount, computed } from 'vue'
import { useSceneStore } from '@/stores/scene'
import { useEditorStore } from '@/stores/editor'
import { useProjectStore } from '@/stores/project'
import { ElMessage } from 'element-plus'
import { getPostProcessing, updatePostProcessing } from '@/api/postprocessing'
import { getLuts, uploadLut } from '@/api/lut'
import type { UpdatePostProcessingParams, LutResource } from '@/types'

const sceneStore = useSceneStore()
const editorStore = useEditorStore()
const projectStore = useProjectStore()

interface NumericField {
  key: keyof typeof form
  label: string
  min: number
  max: number
  step: number
  precision: number
  isInt?: boolean
}

const numericFields: NumericField[] = [
  { key: 'exposure', label: '曝光', min: 0, max: 3, step: 0.05, precision: 2 },
  { key: 'contrast', label: '对比度', min: 0, max: 2, step: 0.05, precision: 2 },
  { key: 'saturation', label: '饱和度', min: 0, max: 2, step: 0.05, precision: 2 },
  { key: 'colorTemperature', label: '色温', min: -100, max: 100, step: 1, precision: 0, isInt: true },
]

const defaults = {
  presetStyle: 'original',
  lutResourceId: '',
  lutIntensity: 1,
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

/**
 * 内置预设清单，与 PanoViewV2/TestView 保持一致（共 12 个）。
 * 参数含义（引擎 BasicEffectParams）：
 *   brightness [-1,1] → 面板 exposure 基数 1.0
 *   contrast [0,2]    → 面板 contrast
 *   saturation [0,2]  → 面板 saturation
 *   temperature [-1,1]→ 面板 colorTemperature（映射到 [-100,100]）
 */
interface BuiltinPreset {
  key: string
  name: string
  brightness: number
  contrast: number
  saturation: number
  temperature: number
}

const BUILTIN_PRESETS: BuiltinPreset[] = [
  { key: 'original',     name: '原始',     brightness:  0.00, contrast: 1.0, saturation: 1.0, temperature:  0.0 },
  { key: 'vivid',        name: '鲜艳',     brightness:  0.05, contrast: 1.3, saturation: 1.5, temperature:  0.0 },
  { key: 'warm',         name: '暖色调',   brightness:  0.02, contrast: 1.1, saturation: 1.1, temperature:  0.5 },
  { key: 'cool',         name: '冷色调',   brightness:  0.00, contrast: 1.1, saturation: 0.9, temperature: -0.5 },
  { key: 'cinematic',    name: '电影感',   brightness: -0.05, contrast: 1.4, saturation: 0.85, temperature: 0.1 },
  { key: 'vintage',      name: '复古',     brightness:  0.03, contrast: 0.9, saturation: 0.7, temperature:  0.2 },
  { key: 'noir',         name: '黑白',     brightness:  0.00, contrast: 1.3, saturation: 0.0, temperature:  0.0 },
  { key: 'sepia',        name: '棕褐色',   brightness:  0.02, contrast: 1.05, saturation: 0.0, temperature: 0.15 },
  { key: 'dramatic',     name: '戏剧',     brightness: -0.08, contrast: 1.6, saturation: 1.2, temperature: 0.0 },
  { key: 'dreamy',       name: '梦幻',     brightness:  0.10, contrast: 0.85, saturation: 0.8, temperature: 0.2 },
  { key: 'crossProcess', name: '交叉冲洗', brightness:  0.02, contrast: 1.2, saturation: 1.3, temperature:  0.3 },
  { key: 'fade',         name: '褪色',     brightness:  0.08, contrast: 0.8, saturation: 0.5, temperature:  0.1 },
]

/** 预设按钮列表（按 UI 4×3 网格排序，与 TestView 一致） */
const presetOptions = computed(() => BUILTIN_PRESETS)

const lutOptions = ref<LutResource[]>([])
const uploadingLut = ref(false)
const lutFileInput = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let applyingPreset = false

/** 当前选中的 LUT 资源（包含 fileUrl，用于下发给引擎） */
const selectedLut = computed<LutResource | undefined>(() => {
  if (!form.lutResourceId) return undefined
  return lutOptions.value.find((l) => l.id === form.lutResourceId)
})

/**
 * 将当前表单状态实时同步到引擎（不经过防抖），
 * 以保证编辑参数时画布即时反馈；后端保存仍走 300ms 防抖。
 */
function syncToEngine(): void {
  const adapter = editorStore.engineAdapter
  if (!adapter || typeof adapter.applyPostConfig !== 'function') return
  // 切场景后 engineAdapter 可能还是旧场景的 adapter，但 PostProcessingManager 是 per-engine 的，
  // applyPostConfig 对当前激活场景的后处理生效，此处直接调用即可。
  try {
    adapter.applyPostConfig({
      enabled: form.enabled,
      presetStyle: form.presetStyle,
      exposure: form.exposure,
      contrast: form.contrast,
      saturation: form.saturation,
      colorTemperature: form.colorTemperature,
      lutResourceId: form.lutResourceId || null,
      lutFileUrl: selectedLut.value?.fileUrl || null,
      lutIntensity: form.lutIntensity,
    })
  } catch (e) {
    console.warn('syncToEngine failed:', e)
  }
}

function scheduleUpdate() {
  // 任何改动都立即同步到引擎（实时预览）
  syncToEngine()
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    doUpdate()
  }, 300)
}

async function doUpdate() {
  if (!sceneStore.currentScene) return
  const params: UpdatePostProcessingParams = {
    presetStyle: form.presetStyle,
    lutResourceId: form.lutResourceId || null,
    lutIntensity: form.lutIntensity,
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

/** 数字输入变化时的处理：整数类型做取整 */
function onNumericChange(key: string, val: number | null | undefined) {
  const field = numericFields.find((f) => f.key === key)
  if (!field) return
  const safe = val ?? defaults[key as keyof typeof defaults]
  ;(form as any)[key] = field.isInt ? Math.round(safe) : safe
}

function formatField(key: string): string {
  const field = numericFields.find((f) => f.key === key)
  if (!field) return ''
  const v = (form as any)[key]
  if (field.isInt) return String(Math.round(v))
  return Number(v).toFixed(field.precision)
}

function resetForm() {
  Object.assign(form, defaults)
  syncToEngine()
  handleUpdate()
}

/** 将引擎 preset 的参数映射到表单字段 */
function applyPresetToForm(preset: BuiltinPreset) {
  // exposure 基于 1.0，加 brightness 偏移（限制在 0–3）
  form.exposure = Math.max(0, Math.min(3, 1 + preset.brightness))
  form.contrast = preset.contrast
  form.saturation = preset.saturation
  // temperature [-1,1] -> colorTemperature [-100,100]
  form.colorTemperature = Math.round(preset.temperature * 100)
}

/** 选择预设：填充表单参数，立即保存 */
function selectPreset(key: string) {
  applyingPreset = true
  form.presetStyle = key
  if (key === 'original') {
    Object.assign(form, {
      exposure: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      colorTemperature: 0,
      bloomStrength: 0,
      bloomThreshold: 0.8,
      toneMapping: 'none',
    })
  } else {
    const preset = BUILTIN_PRESETS.find((p) => p.key === key)
    if (preset) {
      applyPresetToForm(preset)
    }
  }
  Promise.resolve().then(() => {
    applyingPreset = false
  })
  handleUpdate()
}

/** 参数被手动修改时 → 将 presetStyle 置为 'custom'（与 TestView 行为一致，卡片全部取消高亮） */
function markCustomIfPresetModified() {
  if (form.presetStyle !== 'custom') {
    form.presetStyle = 'custom'
  }
}

/** LUT 选择改变 */
function onLutChange() {
  if (!form.lutResourceId) {
    form.lutIntensity = 1
  }
  handleUpdate()
}

function removeLut() {
  form.lutResourceId = ''
  form.lutIntensity = 1
  handleUpdate()
}

function triggerLutUpload() {
  lutFileInput.value?.click()
}

async function onLutFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''
  const projectId = projectStore.currentProject?.id
  if (!projectId) {
    ElMessage.warning('请先加载项目')
    return
  }
  uploadingLut.value = true
  try {
    const res = await uploadLut(projectId, file, file.name)
    const newLut = res.data.data
    lutOptions.value = [newLut, ...lutOptions.value]
    form.lutResourceId = newLut.id
    form.lutIntensity = 1
    ElMessage.success('LUT 上传成功')
    handleUpdate()
  } catch (err: any) {
    ElMessage.error('LUT 上传失败：' + (err?.message || '未知错误'))
  } finally {
    uploadingLut.value = false
  }
}

// 监听数值字段手动修改 → 标记为 custom（取消所有预设卡片高亮）
watch(
  () => [form.exposure, form.contrast, form.saturation, form.colorTemperature, form.bloomStrength, form.bloomThreshold, form.toneMapping],
  () => {
    if (applyingPreset) return
    markCustomIfPresetModified()
  },
)

async function fetchLuts() {
  const projectId = projectStore.currentProject?.id
  if (!projectId) {
    lutOptions.value = []
    return
  }
  try {
    const res = await getLuts(projectId)
    lutOptions.value = Array.isArray(res.data.data) ? res.data.data : []
  } catch {
    lutOptions.value = []
  }
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
            lutIntensity: (data as any).lutIntensity ?? defaults.lutIntensity,
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

watch(
  () => projectStore.currentProject?.id,
  () => {
    fetchLuts()
  },
  { immediate: true },
)

// 引擎就绪后/切换场景时，把当前表单状态推送到引擎，保证画布与面板一致。
watch(
  () => [sceneStore.currentScene?.id, editorStore.engineAdapter],
  () => {
    if (!sceneStore.currentScene || !editorStore.engineAdapter) return
    // 等 DOM/表单数据刷新后再同步，避免用到上一个场景的残留值
    Promise.resolve().then(() => syncToEngine())
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

.flex-1 {
  flex: 1;
}

.num-input {
  flex: 1;
  width: 0;
}

.num-input :deep(.el-input-number) {
  width: 100%;
}

.prop-value {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 42px;
  text-align: right;
}

/* 预设卡片网格 */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.preset-card {
  padding: 8px 4px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  background: var(--bg-secondary, transparent);
}

.preset-card:hover {
  border-color: var(--el-color-primary-light-5, #79bbff);
  color: var(--text-primary);
}

.preset-card.active {
  border-color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);
  font-weight: 600;
}

.preset-name {
  display: block;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.actions {
  display: flex;
  gap: 8px;
}
</style>
