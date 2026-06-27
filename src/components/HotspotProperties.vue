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

    <!-- 添加按钮 -->
    <div class="add-buttons">
      <el-button type="primary" size="small" @click="handleAdd('image')">Add Image</el-button>
      <el-button size="small" @click="handleAdd('quad')">Add Quad</el-button>
      <el-button size="small" @click="handleAdd('model')">Add Model</el-button>
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
      <div class="props-title">Properties</div>
      <div class="prop-row">
        <label>Name</label>
        <el-input v-model="form.name" size="small" />
      </div>
      <div class="prop-row">
        <label>Type</label>
        <el-select v-model="form.type" size="small">
          <el-option label="信息点" value="info" />
          <el-option label="场景跳转" value="scene" />
          <el-option label="图片 (Image)" value="image" />
          <el-option label="矩形 (Quad)" value="quad" />
          <el-option label="3D模型 (Model)" value="model" />
          <el-option label="视频 (Video)" value="video" />
        </el-select>
      </div>
      <div class="prop-row">
        <label>Style</label>
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
      <div class="prop-row">
        <label>Blend Mode</label>
        <el-select v-model="form.blendmode" size="small" clearable>
          <el-option label="正常 (Normal)" value="" />
          <el-option label="叠加 (Add)" value="add" />
          <el-option label="屏幕 (Screen)" value="screen" />
          <el-option label="正片叠底 (Multiply)" value="multiply" />
        </el-select>
      </div>
      <div class="prop-row">
        <label>ATH (H)</label>
        <el-input-number v-model="form.ath" size="small" :step="1" :precision="2" controls-position="right" />
      </div>
      <div class="prop-row">
        <label>ATV (V)</label>
        <el-input-number v-model="form.atv" size="small" :step="1" :precision="2" controls-position="right" />
      </div>
      <div v-if="showUrl" class="prop-row">
        <label>URL</label>
        <el-input v-model="form.url" size="small" placeholder="资源URL" />
      </div>
      <div class="prop-row">
        <label>Scale</label>
        <el-input-number v-model="form.scale" size="small" :min="0.001" :step="0.01" :precision="3" controls-position="right" />
      </div>
      <div class="prop-row">
        <label>Rotation</label>
        <el-input-number v-model="form.rotate" size="small" :step="1" :precision="1" controls-position="right" />
      </div>
      <div class="prop-row align-top">
        <label>Event(On)</label>
        <el-input v-model="form.events" type="textarea" :rows="3" size="small" :placeholder="eventPlaceholder" />
      </div>
      <div v-if="form.type === 'scene'" class="prop-row">
        <label>LinkedScene</label>
        <el-select v-model="form.linkedSceneId" size="small" placeholder="选择场景" clearable>
          <el-option v-for="scene in scenes" :key="scene.id" :label="scene.name" :value="scene.id" />
        </el-select>
      </div>
      <template v-if="form.type === 'info'">
        <div class="prop-row">
          <label>标题</label>
          <el-input v-model="infoContent.title" size="small" placeholder="信息点标题" />
        </div>
        <div class="prop-row align-top">
          <label>描述</label>
          <el-input v-model="infoContent.description" type="textarea" :rows="2" size="small" placeholder="详细描述" />
        </div>
        <div class="prop-row">
          <label>图片URL</label>
          <el-input v-model="infoContent.imageUrl" size="small" placeholder="可选图片地址" />
        </div>
      </template>
      <div class="action-buttons">
        <el-button type="primary" size="small" :loading="applying" @click="handleApply">Apply</el-button>
        <el-button type="danger" size="small" @click="handleDelete">Delete</el-button>
      </div>
      <div class="export-row">
        <el-button size="small" class="export-btn" @click="handleExportXml">Export XML to Console</el-button>
      </div>
      <div class="coord-readout">ATH: {{ form.ath.toFixed(2) }}, ATV: {{ form.atv.toFixed(2) }}</div>
    </template>
    <div v-else class="no-selection">请从上方列表选择或添加一个热点</div>
  </div>
</template>

<script setup lang="ts">
import { inject, reactive, ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type { HotspotType, HotspotToolType } from '@/types'
import { buildHotspotParams, buildHotspotXml } from '@/utils/hotspotFactory'

const vm = inject<EditorViewModel>('editorViewModel')!

const hotspots = computed(() => vm.hotspotViewModel.hotspots.value)
const selectedHotspot = computed(() => vm.hotspotViewModel.selectedHotspot.value)
const scenes = computed(() => vm.sceneViewModel.scenes.value)

const applying = ref(false)
const clearing = ref(false)
const eventPlaceholder = '{"click":"func()"}'

const typeLabels: Record<string, string> = {
  info: '信息点',
  scene: '场景跳转',
  image: 'Image',
  quad: 'Quad',
  model: 'Model',
  video: 'Video',
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
})

const infoContent = reactive<InfoContent>({
  title: '',
  description: '',
  imageUrl: '',
})

const showUrl = computed(() => ['image', 'quad', 'model', 'video'].includes(form.type))

// 选中热点变化 -> 同步到本地草稿（不自动提交，等待 Apply）
watch(
  () => selectedHotspot.value,
  (hotspot) => {
    if (!hotspot) return
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

// 显式提交：点 Apply 才写回后端
async function handleApply() {
  if (!selectedHotspot.value) return
  applying.value = true
  try {
    let contentJson = ''
    if (infoContent.title || infoContent.description || infoContent.imageUrl) {
      contentJson = JSON.stringify({
        title: infoContent.title,
        description: infoContent.description,
        imageUrl: infoContent.imageUrl,
      })
    }
    await vm.updateHotspot(selectedHotspot.value.id, {
      name: form.name,
      type: form.type,
      tooltip: form.tooltip,
      style: form.style,
      ath: form.ath,
      atv: form.atv,
      url: form.url || undefined,
      width: form.width,
      height: form.height,
      scale: form.scale,
      rotate: form.rotate,
      blendmode: form.blendmode || undefined,
      linkedSceneId: form.linkedSceneId || undefined,
      bgcolor: form.bgcolor || undefined,
      tolerance: form.tolerance,
      feather: form.feather,
      events: form.events || undefined,
      onclick: form.onclick || undefined,
      followZoom: form.followZoom,
      content: contentJson || undefined,
    })
  } finally {
    applying.value = false
  }
}

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
</style>
