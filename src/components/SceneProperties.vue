<template>
  <div class="scene-properties">
    <div class="prop-section">
      <div class="section-title">场景属性</div>
      <div class="prop-row">
        <label>名称</label>
        <el-input v-model="form.name" size="small" @change="handleUpdate" />
      </div>
      <div class="prop-row">
        <label>标题</label>
        <el-input v-model="form.title" size="small" @change="handleUpdate" />
      </div>
    </div>
    <div class="prop-section">
      <div class="section-title">缩略图</div>
      <div class="thumb-preview">
        <img v-if="form.thumbUrl" :src="form.thumbUrl" alt="缩略图" />
        <div v-else class="thumb-placeholder">无缩略图</div>
      </div>
      <div class="prop-row">
        <label>缩略图 URL</label>
        <el-input v-model="form.thumbUrl" size="small" @change="handleUpdate" />
      </div>
      <div class="prop-row">
        <el-button
          size="small"
          :disabled="!editorStore.engineAdapter"
          @click="handleGenerateThumbnail"
        >
          生成缩略图
        </el-button>
      </div>
    </div>
    <div class="prop-section">
      <div class="section-title">初始视角</div>
      <div class="prop-row">
        <label>水平视角 (Yaw)</label>
        <el-slider v-model="form.yaw" :min="-180" :max="180" :step="1" size="small" @input="handlePreviewView" @change="handleUpdate" />
        <span class="prop-value">{{ form.yaw }}°</span>
      </div>
      <div class="prop-row">
        <label>垂直视角 (Pitch)</label>
        <el-slider v-model="form.pitch" :min="-90" :max="90" :step="1" size="small" @input="handlePreviewView" @change="handleUpdate" />
        <span class="prop-value">{{ form.pitch }}°</span>
      </div>
      <div class="prop-row">
        <label>视场角 (HFOV)</label>
        <el-slider v-model="form.hfov" :min="30" :max="150" :step="1" size="small" @input="handlePreviewView" @change="handleUpdate" />
        <span class="prop-value">{{ form.hfov }}°</span>
      </div>
      <div class="prop-row">
        <label>最小视场角</label>
        <el-slider v-model="form.fovMin" :min="10" :max="90" :step="1" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.fovMin }}°</span>
      </div>
      <div class="prop-row">
        <label>最大视场角</label>
        <el-slider v-model="form.fovMax" :min="90" :max="170" :step="1" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.fovMax }}°</span>
      </div>
      <div class="prop-row">
        <label>最大像素缩放</label>
        <el-slider v-model="form.maxPixelZoom" :min="1" :max="4" :step="0.1" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.maxPixelZoom }}x</span>
      </div>
      <div class="prop-row">
        <el-button
          size="small"
          :disabled="!editorStore.engineAdapter"
          @click="handleCaptureView"
        >
          记录当前视角
        </el-button>
      </div>
    </div>
    <div class="prop-section">
      <div class="section-title">视角限制</div>
      <div class="prop-row">
        <label>限制模式</label>
        <el-select v-model="form.limitView" size="small" @change="handleUpdate">
          <el-option label="自动" value="auto" />
          <el-option label="范围限制" value="range" />
          <el-option label="关闭" value="off" />
        </el-select>
      </div>
      <div class="prop-row">
        <label>视场角类型</label>
        <el-select v-model="form.fovType" size="small" @change="handleUpdate">
          <el-option label="MFOV" value="MFOV" />
          <el-option label="VFOV" value="VFOV" />
          <el-option label="DFOV" value="DFOV" />
          <el-option label="HFOV" value="HFOV" />
        </el-select>
      </div>
    </div>
    <div class="prop-section gps-section">
      <div class="section-title">GPS 坐标</div>
      <div class="prop-row">
        <label>纬度 (Lat)</label>
        <el-input-number v-model="form.lat" :step="0.0001" size="small" controls-position="right" @change="handleUpdate" />
      </div>
      <div class="prop-row">
        <label>经度 (Lng)</label>
        <el-input-number v-model="form.lng" :step="0.0001" size="small" controls-position="right" @change="handleUpdate" />
      </div>
      <div class="prop-row">
        <label>朝向 (Heading)</label>
        <el-input-number v-model="form.heading" :step="0.1" :min="0" :max="360" size="small" controls-position="right" @change="handleUpdate" />
      </div>
    </div>
    <div class="prop-section onstart-section">
      <div class="section-title">启动脚本 (onstart)</div>
      <el-input
        v-model="form.onstart"
        type="textarea"
        :rows="3"
        size="small"
        placeholder="如：loadscene(scene1);"
        @change="handleUpdate"
      />
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
import { computed, reactive, watch, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type { LimitViewMode, FovType, InitialView, SceneLocation, ResourceType } from '@/types'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import { uploadResource } from '@/api/resource'

const props = defineProps<{
  vm: EditorViewModel
}>()

const currentScene = computed(() => props.vm.sceneViewModel.currentScene.value)

const editorStore = useEditorStore()

const form = reactive({
  name: '',
  title: '',
  thumbUrl: '',
  yaw: 0,
  pitch: 0,
  hfov: 100,
  fovMin: 70,
  fovMax: 140,
  maxPixelZoom: 2.0,
  limitView: 'auto' as LimitViewMode,
  fovType: 'MFOV' as FovType,
  lat: null as number | null,
  lng: null as number | null,
  heading: null as number | null,
  onstart: '',
})

watch(
  () => props.vm.sceneViewModel.currentScene.value,
  (scene) => {
    if (!scene) return
    // Repository 已把 initialView / location / onstart 归一化，直读即可
    const iv = scene.initialView
    form.name = scene.name
    form.title = scene.title ?? ''
    form.thumbUrl = scene.thumbUrl ?? ''
    form.yaw = iv.yaw
    form.pitch = iv.pitch
    form.hfov = iv.hfov
    form.fovMin = iv.fovMin
    form.fovMax = iv.fovMax
    form.maxPixelZoom = iv.maxPixelZoom
    form.limitView = iv.limitView
    form.fovType = iv.fovType
    form.lat = scene.location.lat ?? null
    form.lng = scene.location.lng ?? null
    form.heading = scene.location.heading ?? null
    form.onstart = scene.onstart ?? ''
  },
  { immediate: true },
)

async function doUpdate() {
  const scene = props.vm.sceneViewModel.currentScene.value
  if (!scene) return

  const iv = scene.initialView
  const nextView: InitialView = {
    yaw: form.yaw,
    pitch: form.pitch,
    hfov: form.hfov,
    fovMin: form.fovMin,
    fovMax: form.fovMax,
    maxPixelZoom: form.maxPixelZoom,
    limitView: form.limitView,
    fovType: form.fovType,
  }
  const location: SceneLocation = {}
  if (form.lat !== null) location.lat = form.lat
  if (form.lng !== null) location.lng = form.lng
  if (form.heading !== null) location.heading = form.heading

  const viewChanged =
    nextView.yaw !== iv.yaw ||
    nextView.pitch !== iv.pitch ||
    nextView.hfov !== iv.hfov ||
    nextView.fovMin !== iv.fovMin ||
    nextView.fovMax !== iv.fovMax ||
    nextView.maxPixelZoom !== iv.maxPixelZoom ||
    nextView.limitView !== iv.limitView ||
    nextView.fovType !== iv.fovType

  const locationChanged =
    (location.lat ?? null) !== (scene.location.lat ?? null) ||
    (location.lng ?? null) !== (scene.location.lng ?? null) ||
    (location.heading ?? null) !== (scene.location.heading ?? null) ||
    form.onstart !== (scene.onstart ?? '')

  const metaChanged =
    form.name !== scene.name ||
    form.title !== (scene.title ?? '') ||
    form.thumbUrl !== (scene.thumbUrl ?? '')

  const vm = props.vm.sceneViewModel
  if (metaChanged) {
    await vm.updateSceneMeta(scene.id, {
      name: form.name,
      title: form.title,
      thumbUrl: form.thumbUrl,
    })
  }
  if (viewChanged) {
    await vm.updateSceneView(scene.id, nextView)
  }
  if (locationChanged) {
    await vm.updateSceneLocation(scene.id, location, form.onstart)
  }
  if (metaChanged || viewChanged || locationChanged) {
    editorStore.markDirty()
  }
}

// 防抖：连续操作合并为一次 API 调用
let debounceTimer: ReturnType<typeof setTimeout> | null = null
function handleUpdate() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void doUpdate()
  }, 300)
}

/**
 * 滑块拖动时实时预览相机视角（不触发 API 保存）。
 * @input 事件在拖动过程中持续触发，实现即时反馈。
 */
function handlePreviewView() {
  const adapter = editorStore.engineAdapter
  if (!adapter) return
  adapter.setCameraView({
    yaw: form.yaw,
    pitch: form.pitch,
    hfov: form.hfov,
    fovtype: form.fovType,
  })
}

/**
 * 从当前全景视口截取 640×360 缩略图并保存。
 * 将 canvas dataUrl 转为 File 上传到服务器，用返回的 URL 作为 thumbUrl，
 * 避免 dataUrl 过长超出数据库 VARCHAR(500) 限制。
 */
async function handleGenerateThumbnail() {
  const adapter = editorStore.engineAdapter
  const scene = props.vm.sceneViewModel.currentScene.value
  if (!adapter || !scene) return
  try {
    const dataUrl = await adapter.captureThumbnail(640, 360)

    // dataUrl → Blob → File
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], `thumb_${scene.id}.jpg`, { type: 'image/jpeg' })

    // 上传到服务器
    const response = await uploadResource(scene.projectId, file, 'image' as ResourceType)
    const serverUrl = response.data.data.url

    form.thumbUrl = serverUrl
    void doUpdate()
  } catch (e) {
    console.error('[SceneProperties] 缩略图生成失败:', e)
  }
}

/**
 * 从引擎抓取当前视角并写入表单。
 */
function handleCaptureView() {
  const adapter = editorStore.engineAdapter
  if (!adapter) return
  const view = adapter.getCurrentView()
  form.yaw = view.yaw
  form.pitch = view.pitch
  form.hfov = view.hfov
  void doUpdate()
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.scene-properties {
  padding: 12px;
}

.thumb-preview {
  width: 100%;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-tertiary, #f5f5f5);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.thumb-preview img {
  width: 100%;
  display: block;
}

.thumb-placeholder {
  color: var(--text-muted, #999);
  font-size: 12px;
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
