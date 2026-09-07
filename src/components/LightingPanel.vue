<template>
  <div class="lighting-panel">
    <!-- 环境贴图 -->
    <div class="prop-section">
      <div class="section-title">
        <span>环境贴图（HDR）</span>
      </div>
      <el-upload
        class="env-upload"
        accept=".hdr"
        :show-file-list="false"
        :auto-upload="true"
        :http-request="handleEnvUpload"
      >
        <el-button size="small" data-testid="upload-env-btn" :loading="uploadingEnv">
          上传 .hdr 环境贴图
        </el-button>
      </el-upload>
      <div v-if="form.envMapUrl" class="env-current">
        <span class="env-name" data-testid="env-name" :title="form.envMapUrl">
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
    </div>

    <!-- 太阳光 -->
    <div class="prop-section">
      <div class="section-title">
        <span>太阳光</span>
        <el-switch
          v-model="form.sunEnabled"
          data-testid="sun-enabled-switch"
          size="small"
          @change="handleUpdate"
        />
      </div>

      <div class="prop-row">
        <label>颜色</label>
        <el-color-picker
          v-model="form.sunColor"
          data-testid="sun-color-picker"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.sunColor }}</span>
      </div>

      <div class="slider-row">
        <label>强度</label>
        <el-slider
          v-model="form.sunIntensity"
          data-testid="sun-intensity-slider"
          :min="0"
          :max="10"
          :step="0.1"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.sunIntensity.toFixed(1) }}</span>
      </div>

      <div class="slider-row">
        <label>方位角</label>
        <el-slider
          v-model="form.sunAzimuth"
          data-testid="sun-azimuth-slider"
          :min="0"
          :max="360"
          :step="1"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ Math.round(form.sunAzimuth) }}°</span>
      </div>

      <div class="slider-row">
        <label>仰角</label>
        <el-slider
          v-model="form.sunElevation"
          data-testid="sun-elevation-slider"
          :min="-90"
          :max="90"
          :step="1"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ Math.round(form.sunElevation) }}°</span>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="prop-section actions">
      <el-button size="small" @click="editorStore.setRightPanelSection('scene')">返回场景属性</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, onBeforeUnmount, computed } from 'vue'
import type { UploadRequestOptions } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useEditorStore } from '@/stores/editor'
import { getLighting, updateLighting, toSunConfig, envMapFileName } from '@/api/lighting'
import { uploadResource } from '@/api/resource'
import type { LightingConfig, UpdateLightingParams } from '@/types'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'

const props = defineProps<{ vm: EditorViewModel }>()
const editorStore = useEditorStore()

/**
 * 当前场景/项目来自 EditorViewModel —— 编辑器真实数据源。
 * 注意：pinia 的 scene/project store 在 ViewModel 架构迁移后运行时为空（生产代码从不赋值），
 * 不能作为数据源，否则上传/保存会因取不到 sceneId/projectId 而静默失败。
 */
const currentScene = computed(() => props.vm.sceneViewModel.currentScene.value)
const currentProjectId = computed(() => props.vm.currentProject.value?.id ?? null)

/** 表单默认值（仅在接口无数据/请求失败时使用，后端正常会返回默认配置） */
const defaults = {
  envMapUrl: null as string | null,
  sunEnabled: false,
  sunAzimuth: 180,
  sunElevation: 30,
  sunIntensity: 1,
  sunColor: '#ffffff',
}

const form = reactive({ ...defaults })

const uploadingEnv = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/** 当前环境贴图文件名（展示用，纯函数派生） */
const envFileName = computed(() => envMapFileName(form.envMapUrl))

/**
 * 将当前表单状态实时同步到引擎（不防抖），保证画布即时预览；
 * 后端持久化仍走 300ms 防抖。
 */
function syncSunToEngine(): void {
  const adapter = editorStore.engineAdapter
  if (!adapter) return
  try {
    adapter.setSunLight(toSunConfig(form))
  } catch (e) {
    console.warn('setSunLight failed:', e)
  }
}

/** 环境贴图变化时立即下发引擎（异步加载，不阻塞防抖保存） */
function syncEnvToEngine(): void {
  const adapter = editorStore.engineAdapter
  if (!adapter) return
  void adapter.setEnvironmentMap(form.envMapUrl).catch((e) => {
    console.warn('setEnvironmentMap failed:', e)
  })
}

function scheduleUpdate() {
  syncSunToEngine()
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void doUpdate()
  }, 300)
}

async function doUpdate() {
  const scene = currentScene.value
  if (!scene) return
  const params: UpdateLightingParams = {
    envMapUrl: form.envMapUrl,
    sunEnabled: form.sunEnabled,
    sunAzimuth: form.sunAzimuth,
    sunElevation: form.sunElevation,
    sunIntensity: form.sunIntensity,
    sunColor: form.sunColor,
  }
  await updateLighting(scene.id, params)
  editorStore.markDirty()
}

function handleUpdate() {
  scheduleUpdate()
}

/** el-upload 自定义上传：复用资源上传接口，type=envmap */
async function handleEnvUpload(options: UploadRequestOptions): Promise<void> {
  const projectId = currentProjectId.value
  if (!projectId) {
    ElMessage.warning('请先加载项目')
    return
  }
  const file = options.file
  uploadingEnv.value = true
  try {
    const res = await uploadResource(projectId, file, 'envmap')
    const url = res.data.data.url
    form.envMapUrl = url
    syncEnvToEngine()
    ElMessage.success('环境贴图上传成功')
    // 环境贴图地址需立即持久化（不走防抖，避免上传后短时间内切场景丢失）
    await doUpdate()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '未知错误'
    ElMessage.error('环境贴图上传失败：' + msg)
  } finally {
    uploadingEnv.value = false
  }
}

/** 移除环境贴图：恢复默认 RoomEnvironment 并持久化 */
function removeEnvMap() {
  form.envMapUrl = null
  syncEnvToEngine()
  void doUpdate()
}

/** 后端配置 → 表单 */
function applyLightingToForm(data: LightingConfig): void {
  form.envMapUrl = data.envMapUrl ?? null
  form.sunEnabled = data.sunEnabled ?? defaults.sunEnabled
  form.sunAzimuth = data.sunAzimuth ?? defaults.sunAzimuth
  form.sunElevation = data.sunElevation ?? defaults.sunElevation
  form.sunIntensity = data.sunIntensity ?? defaults.sunIntensity
  form.sunColor = data.sunColor || defaults.sunColor
}

// 切换场景：拉取该场景的光照配置，填充表单
watch(
  currentScene,
  async (scene) => {
    if (!scene) {
      Object.assign(form, defaults)
      return
    }
    try {
      const res = await getLighting(scene.id)
      if (res.data.data) {
        applyLightingToForm(res.data.data)
      } else {
        Object.assign(form, defaults)
      }
    } catch {
      Object.assign(form, defaults)
    }
  },
  { immediate: true },
)

// 画布太阳 gizmo 拖拽持久化后（或其他面板外部途径修改光照），重新拉取配置回填表单，
// 避免面板滑块保留旧方位角/仰角，后续调节时用旧值覆盖 gizmo 的拖拽结果
watch(
  () => editorStore.sunLightingTick,
  async () => {
    const scene = currentScene.value
    if (!scene) return
    try {
      const res = await getLighting(scene.id)
      if (res.data.data) {
        applyLightingToForm(res.data.data)
      }
    } catch {
      // 拉取失败时保留表单当前值，不打断用户操作
    }
  },
)

// 说明：引擎在场景加载/切换时的初始光照由 PanoEngineViewer.applySceneLighting 单一负责
// （从后端拉取并应用）。本面板只在用户交互（滑块/开关/上传/移除）时通过 sync*ToEngine
// 做即时预览，不在引擎就绪时反向推送表单——否则会在表单尚未从后端回填（仍为默认值）时
// 覆盖 applySceneLighting 已应用的正确配置，造成竞态。

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
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
