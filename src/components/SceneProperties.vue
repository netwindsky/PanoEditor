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
          :disabled="!currentScene"
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
import { useSceneStore } from '@/stores/scene'
import { useEditorStore } from '@/stores/editor'
import type { LimitViewMode, FovType, SceneViewConfig } from '@/types'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import { generateThumbnailFromUrl } from '@/utils/thumbnailGenerator'

const props = defineProps<{
  vm: EditorViewModel
}>()

const currentScene = computed(() => props.vm.sceneViewModel.currentScene.value)

const sceneStore = useSceneStore()
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
    if (scene) {
      // 优先使用 scene.initialView，若无（后端 API 不返回该字段）则从 viewConfig JSON 回退读取
      let iv = scene.initialView
      if (!iv && scene.viewConfig) {
        try {
          const vc: SceneViewConfig = JSON.parse(scene.viewConfig)
          if (vc.initialView) iv = vc.initialView as any
        } catch {
          // viewConfig 解析失败时忽略
        }
      }
      form.name = scene.name
      form.title = scene.title ?? ''
      form.thumbUrl = scene.thumbUrl ?? ''
      form.yaw = iv?.yaw ?? 0
      form.pitch = iv?.pitch ?? 0
      form.hfov = iv?.hfov ?? 100
      form.fovMin = iv?.fovMin ?? 70
      form.fovMax = iv?.fovMax ?? 140
      form.maxPixelZoom = iv?.maxPixelZoom ?? 2.0
      form.limitView = iv?.limitView ?? 'auto'
      form.fovType = iv?.fovType ?? 'MFOV'

      // 解析 viewConfig JSON 获取 GPS 坐标
      let viewConfig: SceneViewConfig = {}
      try {
        viewConfig = scene.viewConfig ? JSON.parse(scene.viewConfig) : {}
      } catch {
        viewConfig = {}
      }
      form.lat = viewConfig.lat ?? null
      form.lng = viewConfig.lng ?? null
      form.heading = viewConfig.heading ?? null
      form.onstart = viewConfig.onstart ?? ''
    }
  },
  { immediate: true },
)

async function doUpdate() {
  const scene = props.vm.sceneViewModel.currentScene.value
  if (!scene) return

  // 序列化 GPS 坐标到 viewConfig JSON
  const viewConfig: SceneViewConfig = {}
  if (form.lat !== null) viewConfig.lat = form.lat
  if (form.lng !== null) viewConfig.lng = form.lng
  if (form.heading !== null) viewConfig.heading = form.heading
  if (form.onstart) viewConfig.onstart = form.onstart
  // 后端无独立 initialView 字段，写入 viewConfig JSON 确保持久化
  viewConfig.initialView = {
    yaw: form.yaw,
    pitch: form.pitch,
    hfov: form.hfov,
    fovMin: form.fovMin,
    fovMax: form.fovMax,
    maxPixelZoom: form.maxPixelZoom,
    limitView: form.limitView,
    fovType: form.fovType,
  }

  const updated = await sceneStore.updateScene(scene.id, {
    name: form.name,
    title: form.title,
    thumbUrl: form.thumbUrl,
    initialView: {
      yaw: form.yaw,
      pitch: form.pitch,
      hfov: form.hfov,
      fovMin: form.fovMin,
      fovMax: form.fovMax,
      maxPixelZoom: form.maxPixelZoom,
      limitView: form.limitView,
      fovType: form.fovType,
    },
    viewConfig: JSON.stringify(viewConfig),
  })
  // 同步 ViewModel 场景数据
  if (updated) {
    const vmScenes = props.vm.sceneViewModel.scenes.value
    const idx = vmScenes.findIndex((s) => s.id === scene.id)
    if (idx !== -1) {
      const updatedScenes = [...vmScenes]
      updatedScenes[idx] = updated
      props.vm.sceneViewModel.scenes.value = updatedScenes
    }
    if (props.vm.sceneViewModel.currentScene.value?.id === scene.id) {
      props.vm.sceneViewModel.currentScene.value = updated
    }
  }
  editorStore.markDirty()
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
 * 从全景原图中心裁切 16:9 生成缩略图并保存。
 */
async function handleGenerateThumbnail() {
  const scene = props.vm.sceneViewModel.currentScene.value
  if (!scene || !scene.previewUrl) return
  try {
    const dataUrl = await generateThumbnailFromUrl(scene.previewUrl)
    form.thumbUrl = dataUrl
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
  height: 80px;
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
  height: 100%;
  object-fit: cover;
}

.thumb-preview {
  width: 100%;
  height: 80px;
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
  height: 100%;
  object-fit: cover;
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
