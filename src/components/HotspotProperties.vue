<template>
  <div class="hotspot-properties">
    <!-- 热点列表 -->
    <div class="hotspot-list">
      <div
        v-for="hotspot in hotspots"
        :key="hotspot.id"
        :class="['list-item', { active: selectedHotspot?.id === hotspot.id }]"
        @click="handleSelect(hotspot.id)"
      >
        <span class="item-name">{{ hotspot.name }}</span>
        <span class="item-type">{{ typeLabels[hotspot.type] || hotspot.type }}</span>
        <el-button text size="small" class="item-delete" title="移除" @click.stop="handleDeleteById(hotspot.id)">×</el-button>
      </div>
      <div v-if="hotspots.length === 0" class="list-empty">当前场景暂无热点</div>
    </div>

    <!-- 一键清空 -->
    <div class="clear-row">
      <el-button
        type="danger"
        size="small"
        plain
        class="clear-all-btn"
        :loading="clearing"
        :disabled="hotspots.length === 0"
        @click="handleClearAll"
        >一键清空</el-button
      >
    </div>

    <!-- 属性表单 -->
    <template v-if="selectedHotspot">
      <!-- 基本信息 -->
      <div class="prop-card">
        <div class="card-title">基本信息</div>
        <div class="prop-field">
          <label>名称</label>
          <el-input v-model="form.name" size="small" />
        </div>
        <div class="prop-field">
          <label>类型</label>
          <el-input v-model="form.type" size="small" disabled />
        </div>
        <div class="prop-field">
          <label>ATH</label>
          <el-input-number v-model="form.ath" size="small" :step="1" :precision="2" controls-position="right" />
        </div>
        <div class="prop-field">
          <label>ATV</label>
          <el-input-number v-model="form.atv" size="small" :step="1" :precision="2" controls-position="right" />
        </div>
      </div>

      <!-- 尺寸变换 -->
      <div class="prop-card">
        <div class="card-title">尺寸变换</div>
        <div class="prop-field">
          <label>宽度</label>
          <el-input-number v-model="form.width" size="small" :min="0" :step="1" controls-position="right" />
        </div>
        <div class="prop-field">
          <label>高度</label>
          <el-input-number v-model="form.height" size="small" :min="0" :step="1" controls-position="right" />
        </div>
        <div class="prop-field">
          <label>缩放</label>
          <el-input-number v-model="form.scale" size="small" :min="0.001" :step="0.01" :precision="3" controls-position="right" />
        </div>
        <div class="prop-field">
          <label>旋转</label>
          <el-input-number v-model="form.rotate" size="small" :step="1" :precision="1" controls-position="right" />
        </div>
      </div>

      <!-- 顶点坐标（quad / video 共用 4 顶点几何） -->
      <template v-if="isQuadLike(form.type)">
        <div class="prop-card">
          <div class="card-title">顶点坐标</div>
          <div
            v-for="(label, idx) in quadPointLabels"
            :key="idx"
            class="prop-field quad-point-row"
          >
            <label>{{ label }}</label>
            <div class="quad-inputs">
              <el-input-number
                :model-value="quadPoints[idx]?.ath"
                size="small"
                :step="0.01"
                :precision="2"
                controls-position="right"
                placeholder="ATH"
                @update:model-value="(v: number) => updateQuadPoint(idx, 'ath', v)"
              />
              <el-input-number
                :model-value="quadPoints[idx]?.atv"
                size="small"
                :step="0.01"
                :precision="2"
                controls-position="right"
                placeholder="ATV"
                @update:model-value="(v: number) => updateQuadPoint(idx, 'atv', v)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- 外观样式 -->
      <div class="prop-card">
        <div class="card-title">外观样式</div>
        <template v-if="form.type === 'info'">
          <div class="prop-field">
            <label>样式</label>
            <el-select v-model="form.style" size="small">
              <el-option label="脉冲点" value="pulsing-dot" />
              <el-option label="悬浮箭头" value="floating-arrow" />
              <el-option label="波纹标记" value="ripple-marker" />
              <el-option label="旋转菱形" value="rotating-diamond" />
              <el-option label="瞄准镜" value="target-crosshair" />
              <el-option label="发光球" value="glow-orb" />
              <el-option label="信息图标" value="info-icon" />
              <el-option label="毛玻璃面板" value="glass-text" />
              <el-option label="双环旋转" value="double-ring" />
              <el-option label="地图大头针" value="map-pin" />
              <el-option label="导航指引" value="navi-point" />
              <el-option label="视频播放" value="video-play" />
              <el-option label="警告标识" value="warning-sign" />
              <el-option label="自定义图片" value="custom-image" />
              <el-option label="自定义视频" value="custom-video" />
              <el-option label="网页嵌入" value="custom-web" />
            </el-select>
          </div>
        </template>
        <div v-if="showUrl" class="prop-field">
          <label>URL</label>
          <el-input v-model="form.url" size="small" placeholder="资源URL" />
        </div>
        <template v-if="['image', 'quad'].includes(form.type)">
          <div class="prop-field">
            <label>贴图</label>
            <div class="image-actions">
              <el-button size="small" @click="triggerFilePicker">上传</el-button>
              <el-button size="small" @click="openAssetDialog">资源库</el-button>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="image-file-input"
                @change="handleFileSelected"
              />
            </div>
          </div>
          <div v-if="form.url" class="prop-field image-preview-row">
            <label>预览</label>
            <div class="image-preview">
              <img :src="form.url" :alt="form.name || '预览'" />
            </div>
          </div>
        </template>
        <template v-if="form.type === 'video'">
          <div class="prop-field">
            <label>视频</label>
            <div class="image-actions">
              <el-button size="small" @click="triggerVideoFilePicker">上传视频</el-button>
              <el-button
                size="small"
                @click="assetFilterType = 'video'; openAssetDialog()"
              >资源库</el-button>
              <input
                ref="videoFileInputRef"
                type="file"
                accept="video/*"
                class="image-file-input"
                @change="handleVideoFileSelected"
              />
            </div>
          </div>
          <div class="prop-field">
            <label>URL</label>
            <el-input v-model="form.url" size="small" placeholder="视频URL" />
          </div>
          <div v-if="form.url" class="prop-field image-preview-row">
            <label>预览</label>
            <div class="image-preview">
              <video
                :key="form.url"
                class="video-preview"
                :src="form.url"
                controls
                preload="metadata"
                playsinline
              />
            </div>
          </div>
        </template>
        <template v-if="isQuadLike(form.type)">
          <div class="prop-field">
            <label>混合模式</label>
            <el-select v-model="form.blendmode" size="small" clearable placeholder="默认">
              <el-option label="默认" value="normal" />
              <el-option label="正片叠底" value="multiply" />
              <el-option label="滤色" value="screen" />
              <el-option label="变暗" value="darken" />
              <el-option label="变亮" value="lighten" />
              <el-option label="叠加" value="add" />
            </el-select>
          </div>
        </template>
      </div>

      <!-- 内容设置 -->
      <template v-if="form.type === 'info'">
        <div class="prop-card">
          <div class="card-title">内容设置</div>
          <div class="prop-field">
            <label>标题</label>
            <el-input v-model="infoContent.title" size="small" placeholder="信息点标题" />
          </div>
          <div class="prop-field align-top">
            <label>描述</label>
            <el-input v-model="infoContent.description" type="textarea" :rows="2" size="small" placeholder="详细描述" />
          </div>
          <div class="prop-field">
            <label>图片URL</label>
            <el-input v-model="infoContent.imageUrl" size="small" placeholder="可选图片地址" />
          </div>
        </div>
      </template>

      <!-- 交互设置 -->
      <div class="prop-card">
        <div class="card-title">交互设置</div>
        <div class="prop-field">
          <label>动作</label>
          <el-select v-model="form.action" size="small" placeholder="选择动作">
            <el-option label="无动作" value="none" />
            <el-option label="跳转场景" value="scene" />
            <el-option label="打开链接" value="link" />
            <el-option label="执行脚本" value="script" />
          </el-select>
        </div>
        <div v-if="form.action === 'scene'" class="prop-field">
          <label>目标场景</label>
          <el-select v-model="form.linkedSceneId" size="small" placeholder="选择场景" clearable>
            <el-option v-for="scene in scenes" :key="scene.id" :label="scene.name" :value="scene.id" />
          </el-select>
        </div>
        <div v-if="form.action === 'link'" class="prop-field">
          <label>链接地址</label>
          <el-input v-model="form.url" size="small" placeholder="https://..." />
        </div>
        <div v-if="form.action === 'script'" class="prop-field align-top">
          <label>脚本代码</label>
          <el-input v-model="form.onclick" type="textarea" :rows="3" size="small" placeholder="javascript:..." />
        </div>
      </div>

      <div class="action-buttons">
        <el-button type="danger" size="small" @click="handleDelete">Delete</el-button>
      </div>
      <div class="export-row">
        <el-button size="small" class="export-btn" @click="handleExportXml">Export XML to Console</el-button>
      </div>
      <div class="coord-readout">ATH: {{ form.ath.toFixed(2) }}, ATV: {{ form.atv.toFixed(2) }}</div>
    </template>
    <div v-else class="no-selection">请从上方列表选择或添加一个热点</div>

    <!-- 资源库弹窗 -->
    <el-dialog v-model="showAssetDialog" title="选择资源" width="600px" :close-on-click-modal="true" destroy-on-close>
      <div class="asset-dialog-content">
        <div class="asset-filter-tabs">
          <button
            class="filter-tab"
            :class="{ active: assetFilterType === 'image' }"
            @click="assetFilterType = 'image'; openAssetDialog()"
          >
            标注资源
          </button>
          <button
            class="filter-tab"
            :class="{ active: assetFilterType === 'panorama' }"
            @click="assetFilterType = 'panorama'; openAssetDialog()"
          >
            全景图
          </button>
        </div>
        <div v-if="assetList.length === 0" class="asset-empty">暂无资源，请先上传</div>
        <ul v-else class="asset-list">
          <li
            v-for="resource in assetList"
            :key="resource.id"
            class="asset-item"
            @click="selectAsset(resource)"
          >
            <img
              class="asset-thumb"
              :src="resource.thumbUrl || resource.url"
              :alt="resource.name"
            />
            <div class="asset-meta">
              <div class="asset-name">{{ resource.name }}</div>
              <div class="asset-sub">{{ resource.type }} · {{ formatSize(resource.sizeBytes) }}</div>
            </div>
          </li>
        </ul>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { inject, reactive, ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type { HotspotType, HotspotToolType, Resource } from '@/types'
import { buildHotspotParams, buildHotspotXml } from '@/utils/hotspotFactory'
import { parsePoints, serializePoints, isQuadLike, isVideoUrl, type QuadPoint } from '@/utils/quadPoints'

const vm = inject<EditorViewModel>('editorViewModel')!

const hotspots = computed(() => vm.hotspotViewModel.hotspots.value)
const selectedHotspot = computed(() => vm.hotspotViewModel.selectedHotspot.value)
const scenes = computed(() => vm.sceneViewModel.scenes.value)

const clearing = ref(false)
const showAssetDialog = ref(false)
const assetFilterType = ref<'image' | 'panorama' | 'video'>('image')
const eventPlaceholder = '{"click":"func()"}'

// 资源库 / 上传相关状态
const fileInputRef = ref<HTMLInputElement | null>(null)
const videoFileInputRef = ref<HTMLInputElement | null>(null)
const assetList = computed(() => vm.assetViewModel.resources.value)
const currentProjectId = computed(() => vm.sceneViewModel.currentScene.value?.projectId || '')

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function triggerVideoFilePicker() {
  videoFileInputRef.value?.click()
}

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // 重置 input.value 以便重复选择同名文件
  input.value = ''
  if (!file) return
  // 图片/四边形热点：若用户误选视频文件则拦截（不写入 form.url）
  if (isImageLikeType(form.type) && isVideoUrl(file.name)) {
    ElMessage.error('图片/四边形热点不支持视频资源，请选择图片')
    return
  }
  const projectId = currentProjectId.value
  if (!projectId) {
    ElMessage.error('项目信息缺失，无法上传')
    return
  }
  // 上传前快照当前 resources 长度，上传后取最后一项作为新资源
  const before = assetList.value.length
  try {
    await vm.uploadResource(projectId, file, 'image')
    if (assetList.value.length > before) {
      const newResource = assetList.value[assetList.value.length - 1]
      form.url = newResource.url
    }
    ElMessage.success('上传成功')
  } catch (err) {
    ElMessage.error('上传失败，请重试')
  }
}

async function handleVideoFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const projectId = currentProjectId.value
  if (!projectId) {
    ElMessage.error('项目信息缺失，无法上传')
    return
  }
  const before = assetList.value.length
  try {
    await vm.uploadResource(projectId, file, 'video')
    if (assetList.value.length > before) {
      const newResource = assetList.value[assetList.value.length - 1]
      form.url = newResource.url
    }
    ElMessage.success('上传成功')
  } catch (err) {
    ElMessage.error('上传失败，请重试')
  }
}

function openAssetDialog() {
  showAssetDialog.value = true
  const projectId = currentProjectId.value
  if (projectId) {
    void vm.assetViewModel.loadResources(projectId, assetFilterType.value)
  }
}

function selectAsset(resource: Resource) {
  // 图片/四边形热点拒绝视频资源；视频类型放行
  if (isImageLikeType(form.type) && isVideoUrl(resource.url)) {
    ElMessage.error('图片/四边形热点不支持视频资源，请选择图片')
    return
  }
  form.url = resource.url
  showAssetDialog.value = false
}

/** image/quad 是"图片"类热点（共用贴图 UI，但必须非视频） */
function isImageLikeType(type: HotspotType): boolean {
  return type === 'image' || type === 'quad'
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

const typeLabels: Record<string, string> = {
  info: '信息点',
  scene: '场景跳转',
  image: '图片热点',
  quad: '矩形热点',
  model: '3D模型热点',
  video: '视频热点',
}

interface InfoContent {
  title: string
  description: string
  imageUrl: string
}

const form = reactive({
  name: '',
  type: 'info' as HotspotType,
  tooltip: '',
  style: 'pulsing-dot',
  ath: 0,
  atv: 0,
  url: '',
  width: undefined as number | undefined,
  height: undefined as number | undefined,
  scale: undefined as number | undefined,
  rotate: undefined as number | undefined,
  blendmode: '',
  linkedSceneId: '',
  bgcolor: '',
  tolerance: undefined as number | undefined,
  feather: undefined as number | undefined,
  events: '',
  onclick: '',
  followZoom: false,
  content: '',
  action: 'none' as HotspotAction,
  points: '',
})

const quadPoints = computed<QuadPoint[]>({
  get() {
    return parsePoints(form.points)
  },
  set(pts: QuadPoint[]) {
    form.points = serializePoints(pts)
  },
})

const quadPointLabels = ['左上', '右上', '右下', '左下']

function updateQuadPoint(index: number, field: 'ath' | 'atv', value: number) {
  const pts = quadPoints.value
  if (pts.length === 4) {
    pts[index][field] = value
    quadPoints.value = [...pts]
  }
}

type HotspotAction = 'none' | 'scene' | 'link' | 'script'

const actionLabels: Record<HotspotAction, string> = {
  none: '无动作',
  scene: '跳转场景',
  link: '打开链接',
  script: '执行脚本',
}

const infoContent = reactive<InfoContent>({
  title: '',
  description: '',
  imageUrl: '',
})

const showUrl = computed(() => ['image', 'quad', 'model'].includes(form.type))

// 根据热点数据推断动作类型
function inferAction(hotspot: Hotspot): HotspotAction {
  if (hotspot.linkedSceneId) return 'scene'
  if (hotspot.url && !['image', 'quad', 'model', 'video'].includes(hotspot.type)) return 'link'
  if (hotspot.onclick) return 'script'
  if (hotspot.type === 'scene') return 'scene'
  return 'none'
}
let loadedHotspotId = ''
watch(
  () => selectedHotspot.value,
  (hotspot) => {
    if (!hotspot) {
      loadedHotspotId = ''
      return
    }
    const isSameHotspotRefresh = loadedHotspotId === hotspot.id
    const previousAction = form.action
    loadedHotspotId = hotspot.id
    form.name = hotspot.name
    form.type = hotspot.type || 'info'
    form.tooltip = hotspot.tooltip || ''
    form.style = hotspot.style || 'pulsing-dot'
    form.ath = hotspot.ath ?? 0
    form.atv = hotspot.atv ?? 0
    form.url = hotspot.url || ''
    form.width = hotspot.width
    form.height = hotspot.height
    form.scale = hotspot.scale
    form.rotate = hotspot.rotate
    form.blendmode = hotspot.blendmode || ''
    form.linkedSceneId = hotspot.linkedSceneId || ''
    form.bgcolor = hotspot.bgcolor || ''
    form.tolerance = hotspot.tolerance
    form.feather = hotspot.feather
    form.events = hotspot.events || ''
    form.onclick = hotspot.onclick || ''
    form.followZoom = hotspot.followZoom ?? false
    form.content = hotspot.content || ''
    form.action = isSameHotspotRefresh ? previousAction : inferAction(hotspot)
    form.points = hotspot.points || ''

    if (hotspot.content) {
      try {
        const parsed = JSON.parse(hotspot.content)
        infoContent.title = parsed.title || ''
        infoContent.description = parsed.description || ''
        infoContent.imageUrl = parsed.imageUrl || ''
      } catch {
        infoContent.title = hotspot.content
        infoContent.description = ''
        infoContent.imageUrl = ''
      }
    } else {
      infoContent.title = ''
      infoContent.description = ''
      infoContent.imageUrl = ''
    }
  },
  { immediate: true },
)

function handleSelect(hotspotId: string) {
  vm.hotspotViewModel.selectHotspot(hotspotId)
}

// 添加热点：用工厂补齐 quad/image/model 必需的默认值；
// EditorViewModel.addHotspot 内部会自动选中新热点
async function handleAdd(type: HotspotToolType) {
  await vm.addHotspot(buildHotspotParams(type, 0, 0))
}

// 自动保存（debounce）
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    if (!selectedHotspot.value) return
    if (vm.hotspotViewModel.isDragging.value) return
    doSave()
  }, 500)
}

function doSave() {
  if (!selectedHotspot.value) return
  let contentJson = ''
  if (infoContent.title || infoContent.description || infoContent.imageUrl) {
    contentJson = JSON.stringify({
      title: infoContent.title,
      description: infoContent.description,
      imageUrl: infoContent.imageUrl,
    })
  }

  // 根据动作类型清理不相关字段
  const updates: Record<string, unknown> = {
    name: form.name,
    type: form.type,
    tooltip: form.tooltip,
    style: form.style,
    ath: form.ath,
    atv: form.atv,
    width: form.width,
    height: form.height,
    scale: form.scale,
    rotate: form.rotate,
    blendmode: form.blendmode || undefined,
    bgcolor: form.bgcolor || undefined,
    tolerance: form.tolerance,
    feather: form.feather,
    events: form.events || undefined,
    followZoom: form.followZoom,
    content: contentJson || undefined,
    points: form.points || undefined,
  }

  if (form.action === 'scene') {
    updates.linkedSceneId = form.linkedSceneId || undefined
    updates.url = undefined
    updates.onclick = undefined
  } else if (form.action === 'link') {
    updates.url = form.url || undefined
    updates.linkedSceneId = undefined
    updates.onclick = undefined
  } else if (form.action === 'script') {
    updates.onclick = form.onclick || undefined
    updates.linkedSceneId = undefined
    updates.url = undefined
  } else {
    updates.linkedSceneId = undefined
    updates.url = undefined
    updates.onclick = undefined
  }

  // 媒体类型热点的 url 不受动作影响
  if (['image', 'quad', 'model', 'video'].includes(form.type)) {
    updates.url = form.url || undefined
  }

  vm.updateHotspot(selectedHotspot.value.id, updates)
}

// 监听表单变化自动保存
watch(
  () => ({
    name: form.name,
    type: form.type,
    tooltip: form.tooltip,
    style: form.style,
    ath: form.ath,
    atv: form.atv,
    url: form.url,
    width: form.width,
    height: form.height,
    scale: form.scale,
    rotate: form.rotate,
    blendmode: form.blendmode,
    linkedSceneId: form.linkedSceneId,
    bgcolor: form.bgcolor,
    tolerance: form.tolerance,
    feather: form.feather,
    events: form.events,
    onclick: form.onclick,
    followZoom: form.followZoom,
    action: form.action,
    points: form.points,
  }),
  () => scheduleAutoSave(),
  { deep: true },
)

watch(
  () => ({ title: infoContent.title, description: infoContent.description, imageUrl: infoContent.imageUrl }),
  () => scheduleAutoSave(),
  { deep: true },
)

function handleDelete() {
  if (!selectedHotspot.value) return
  vm.removeHotspot(selectedHotspot.value.id)
}

function handleDeleteById(hotspotId: string) {
  vm.removeHotspot(hotspotId)
}

// 一键清空当前场景所有热点（二次确认）
async function handleClearAll() {
  const count = hotspots.value.length
  if (count === 0) return
  try {
    await ElMessageBox.confirm(
      `确定要清空当前场景的全部 ${count} 个标注点吗？此操作不可撤销。`,
      '清空确认',
      { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' },
    )
  } catch {
    // 用户取消
    return
  }
  clearing.value = true
  try {
    await vm.clearAllHotspots()
    ElMessage.success('已清空当前场景的全部标注点')
  } catch {
    ElMessage.error('清空失败，请重试')
  } finally {
    clearing.value = false
  }
}

// 导出当前场景所有热点为 XML 到控制台
function handleExportXml() {
  const xml = buildHotspotXml(hotspots.value)
  // eslint-disable-next-line no-console
  console.log(xml)
}
</script>

<style scoped>
.hotspot-properties {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 热点列表 */
.hotspot-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary, #1e1e1e);
}

.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:hover {
  background: var(--bg-hover);
}

.list-item.active {
  background: var(--accent, #409eff);
  color: #fff;
}

.item-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-type {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.list-item.active .item-type {
  color: rgba(255, 255, 255, 0.8);
}

.item-delete {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
}

.list-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}

/* 添加按钮 */
.add-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 顶点坐标行：使用 Grid 精确控制 3 列（label + ath + atv），防止窄面板溢出 */
.quad-point-row {
  display: grid;
  grid-template-columns: 40px 1fr 1fr;
  gap: 6px;
  align-items: center;
}

.quad-point-row label {
  min-width: auto;
  text-align: left;
  font-size: 11px;
}

.quad-point-row .quad-inputs {
  display: contents;
}

.quad-point-row .quad-inputs .el-input-number {
  min-width: 0;
  width: auto !important;
}

/* 属性区标题 */
.props-title {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 6px 0;
  letter-spacing: 1px;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.prop-row.align-top {
  align-items: flex-start;
}

.prop-row label {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 84px;
  flex-shrink: 0;
  text-align: right;
}

.prop-row .el-input,
.prop-row .el-select,
.prop-row .el-input-number {
  flex: 1;
}

/* Apply / Delete */
.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.action-buttons .el-button {
  flex: 1;
}

/* Export XML */
.export-row {
  margin-top: 4px;
}

.export-btn {
  width: 100%;
}

/* 底部实时坐标 */
.coord-readout {
  text-align: right;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.no-selection {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}

/* 一键清空 */
.clear-row {
  display: flex;
  justify-content: center;
}

/* 属性分组卡片 */
.prop-card {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 10px;
  background: var(--bg-primary, #1e1e1e);
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.prop-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.prop-field.align-top {
  align-items: flex-start;
}

.prop-field label {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 64px;
  flex-shrink: 0;
  text-align: right;
}

.prop-field .el-input,
.prop-field .el-select,
.prop-field .el-input-number {
  flex: 1;
}

.image-actions {
  flex: 1;
  display: flex;
  gap: 6px;
  align-items: center;
}

.image-file-input {
  display: none;
}

.image-preview-row {
  align-items: flex-start;
}

.image-preview {
  flex: 1;
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 4px;
  padding: 6px;
  background: var(--bg-primary, #1e1e1e);
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview img {
  max-width: 100%;
  max-height: 160px;
  object-fit: contain;
  display: block;
}

.video-preview {
  max-width: 100%;
  max-height: 160px;
  object-fit: contain;
  display: block;
  background: #000;
}

.asset-dialog-content {
  padding: 12px;
}

.asset-filter-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.filter-tab {
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-tab:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.filter-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.asset-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

.asset-item {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 4px;
  background: var(--bg-primary, #1e1e1e);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s;
}

.asset-item:hover {
  border-color: var(--accent, #409eff);
  transform: translateY(-1px);
}

.asset-thumb {
  width: 100%;
  height: 90px;
  object-fit: cover;
  background: #000;
  display: block;
}

.asset-meta {
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.asset-name {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-sub {
  font-size: 11px;
  color: var(--text-secondary, #999);
}

.asset-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary, #999);
  font-size: 13px;
}
</style>
