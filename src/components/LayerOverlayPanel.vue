<template>
  <div class="layer-overlay-panel">
    <div class="prop-section">
      <div class="section-title">覆盖层</div>
      <div class="add-buttons">
        <el-button size="small" data-testid="add-text-layer" @click="addLayer('text')">+ 文字层</el-button>
        <el-button size="small" data-testid="add-button-layer" @click="addLayer('button')">+ 按钮层</el-button>
        <el-button size="small" data-testid="add-image-layer" @click="addLayer('image')">+ 图片层</el-button>
      </div>
    </div>

    <!-- Layer 列表 -->
    <div class="prop-section">
      <div class="layer-list">
        <div
          v-for="layer in layers"
          :key="layer.id"
          :class="['layer-item', { active: selectedLayerId === layer.id }]"
          data-testid="layer-item"
          @click="selectLayer(layer.id)"
        >
          <span class="layer-type-icon">{{ getTypeIcon(layer.type) }}</span>
          <span class="layer-name">{{ layer.name }}</span>
          <el-switch
            v-model="layer.visible"
            size="small"
            data-testid="layer-visible-switch"
            @change="handleUpdate"
            @click.stop
          />
          <el-button
            text
            size="small"
            data-testid="layer-delete"
            class="layer-delete-btn"
            @click.stop="deleteLayer(layer.id)"
          >×</el-button>
        </div>
        <div v-if="layers.length === 0" class="layer-empty">
          暂无覆盖层，点击上方按钮添加
        </div>
      </div>
    </div>

    <!-- 选中 Layer 的属性编辑 -->
    <div v-if="selectedLayer" class="prop-section" data-testid="layer-props">
      <div class="section-title">属性编辑</div>
      <div class="prop-row">
        <label>名称</label>
        <el-input v-model="selectedLayer.name" size="small" data-testid="layer-name-input" @change="handleUpdate" />
      </div>

      <template v-if="selectedLayer.type === 'text' || selectedLayer.type === 'button'">
        <div class="prop-row align-top">
          <label>内容</label>
          <el-input
            v-model="selectedLayer.html"
            type="textarea"
            :rows="3"
            size="small"
            data-testid="layer-html-input"
            @change="handleUpdate"
          />
        </div>
        <div class="prop-row align-top">
          <label>CSS</label>
          <el-input
            v-model="selectedLayer.css"
            type="textarea"
            :rows="2"
            size="small"
            data-testid="layer-css-input"
            @change="handleUpdate"
          />
        </div>
      </template>

      <template v-if="selectedLayer.type === 'image' || selectedLayer.type === 'button'">
        <div class="prop-row">
          <label>图片URL</label>
          <el-input v-model="selectedLayer.url" size="small" data-testid="layer-url-input" @change="handleUpdate" />
        </div>
      </template>

      <div class="prop-row">
        <label>对齐</label>
        <el-select v-model="selectedLayer.align" size="small" data-testid="layer-align-select" @change="handleUpdate">
          <el-option label="左上" value="lefttop" />
          <el-option label="上" value="top" />
          <el-option label="右上" value="righttop" />
          <el-option label="左" value="left" />
          <el-option label="居中" value="center" />
          <el-option label="右" value="right" />
          <el-option label="左下" value="leftbottom" />
          <el-option label="下" value="bottom" />
          <el-option label="右下" value="rightbottom" />
        </el-select>
      </div>

      <div class="prop-row">
        <label>X 偏移</label>
        <el-input-number v-model="selectedLayer.x" size="small" :step="1" data-testid="layer-x-input" @change="handleUpdate" />
      </div>
      <div class="prop-row">
        <label>Y 偏移</label>
        <el-input-number v-model="selectedLayer.y" size="small" :step="1" data-testid="layer-y-input" @change="handleUpdate" />
      </div>
      <div class="prop-row">
        <label>缩放</label>
        <el-input-number v-model="selectedLayer.scale" size="small" :step="0.1" :min="0" data-testid="layer-scale-input" @change="handleUpdate" />
      </div>

      <div class="prop-row align-top">
        <label>点击事件</label>
        <el-input
          v-model="selectedLayer.onclick"
          type="textarea"
          :rows="2"
          size="small"
          data-testid="layer-onclick-input"
          @change="handleUpdate"
        />
      </div>
    </div>

    <!-- 返回按钮 -->
    <div class="prop-section">
      <el-button size="small" @click="editorStore.setRightPanelSection('tour')">返回漫游设置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useEditorStore } from '@/stores/editor'
import { updateProject } from '@/api/project'
import type { OverlayLayer, LayerType, TourSettings } from '@/types'

const projectStore = useProjectStore()
const editorStore = useEditorStore()

const layers = ref<OverlayLayer[]>([])
const selectedLayerId = ref<string | null>(null)

const selectedLayer = computed(() => {
  if (!selectedLayerId.value) return null
  return layers.value.find((l) => l.id === selectedLayerId.value) || null
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

/** 从 project.settings JSON 加载 layers + tour settings */
function loadFromSettings(settingsJson?: string) {
  if (!settingsJson) {
    layers.value = []
    return
  }
  try {
    const parsed = JSON.parse(settingsJson) as Partial<TourSettings & { layers?: OverlayLayer[] }>
    layers.value = parsed.layers || []
  } catch {
    layers.value = []
  }
}

/** 序列化 layers + 保留原有 tour settings 到 project.settings JSON */
function serializeSettings(): string {
  const current = projectStore.currentProject?.settings
  let tourSettings: Partial<TourSettings> = {}
  if (current) {
    try {
      tourSettings = JSON.parse(current) as Partial<TourSettings>
    } catch {
      // ignore
    }
  }
  return JSON.stringify({ ...tourSettings, layers: layers.value })
}

function scheduleUpdate() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    doUpdate()
  }, 300)
}

async function doUpdate() {
  if (!projectStore.currentProject) return
  const settings = serializeSettings()
  await updateProject(projectStore.currentProject.id, { settings })
  editorStore.markDirty()
}

function handleUpdate() {
  scheduleUpdate()
}

function selectLayer(id: string) {
  selectedLayerId.value = id
}

function addLayer(type: LayerType) {
  const id = `layer_${Date.now()}`
  const layer: OverlayLayer = {
    id,
    name: `${type}_${layers.value.length + 1}`,
    type,
    visible: true,
    align: 'lefttop',
    x: 0,
    y: 0,
    scale: 1,
  }
  if (type === 'text') {
    layer.html = ''
    layer.css = 'color:#FFFFFF; font-size:14px;'
  }
  if (type === 'button') {
    layer.html = '按钮'
    layer.url = ''
  }
  if (type === 'image') {
    layer.url = ''
  }
  layers.value.push(layer)
  selectedLayerId.value = id
  handleUpdate()
}

function deleteLayer(id: string) {
  const idx = layers.value.findIndex((l) => l.id === id)
  if (idx !== -1) {
    layers.value.splice(idx, 1)
    if (selectedLayerId.value === id) {
      selectedLayerId.value = layers.value[0]?.id || null
    }
    handleUpdate()
  }
}

function getTypeIcon(type: LayerType): string {
  const icons: Record<LayerType, string> = {
    text: 'T',
    image: '🖼',
    button: '▢',
    container: '⬚',
  }
  return icons[type] || '◻'
}

watch(
  () => projectStore.currentProject?.settings,
  (settings) => {
    loadFromSettings(settings)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.layer-overlay-panel {
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

.add-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.layer-item:hover {
  background: var(--bg-hover);
}

.layer-item.active {
  background: var(--accent-light);
}

.layer-type-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.layer-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-delete-btn {
  color: var(--text-muted);
  font-size: 14px;
  padding: 2px;
  flex-shrink: 0;
}

.layer-empty {
  padding: 20px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.prop-row.align-top {
  align-items: flex-start;
}

.prop-row label {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 60px;
  flex-shrink: 0;
}

.prop-row .el-input,
.prop-row .el-select,
.prop-row .el-input-number {
  flex: 1;
}
</style>
