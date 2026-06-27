<template>
  <div class="hotspot-properties">
    <template v-if="hotspotStore.selectedHotspot">
      <!-- 基础属性 -->
      <div class="prop-section">
        <div class="section-title">基础</div>
        <div class="prop-row">
          <label>名称</label>
          <el-input v-model="form.name" size="small" @change="handleUpdate" />
        </div>
        <div class="prop-row">
          <label>类型</label>
          <el-select v-model="form.type" size="small" @change="handleUpdate">
            <el-option label="信息点" value="info" />
            <el-option label="场景跳转" value="scene" />
            <el-option label="图片" value="image" />
            <el-option label="矩形" value="quad" />
            <el-option label="3D模型" value="model" />
            <el-option label="视频" value="video" />
          </el-select>
        </div>
        <div class="prop-row">
          <label>提示文本</label>
          <el-input v-model="form.tooltip" size="small" @change="handleUpdate" />
        </div>
      </div>

      <!-- 样式选择 -->
      <div class="prop-section">
        <div class="section-title">样式</div>
        <div class="prop-row">
          <label>预设样式</label>
          <el-select v-model="form.style" size="small" @change="handleUpdate">
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
      </div>

      <!-- 位置 -->
      <div class="prop-section">
        <div class="section-title">位置 (球坐标)</div>
        <div class="prop-row">
          <label>Ath (水平)</label>
          <el-input-number v-model="form.ath" size="small" :step="1" :precision="2" @change="handleUpdate" />
        </div>
        <div class="prop-row">
          <label>Atv (垂直)</label>
          <el-input-number v-model="form.atv" size="small" :step="1" :precision="2" @change="handleUpdate" />
        </div>
      </div>

      <!-- 媒体 -->
      <div v-if="showMediaSection" class="prop-section">
        <div class="section-title">媒体</div>
        <div class="prop-row">
          <label>URL</label>
          <el-input v-model="form.url" size="small" placeholder="资源URL" @change="handleUpdate" />
        </div>
        <div v-if="form.type === 'image' || form.type === 'quad' || form.type === 'model'" class="prop-row">
          <label>宽度</label>
          <el-input-number v-model="form.width" size="small" :min="1" :step="1" @change="handleUpdate" />
        </div>
        <div v-if="form.type === 'image' || form.type === 'quad'" class="prop-row">
          <label>高度</label>
          <el-input-number v-model="form.height" size="small" :min="1" :step="1" @change="handleUpdate" />
        </div>
      </div>

      <!-- 变换 -->
      <div class="prop-section">
        <div class="section-title">变换</div>
        <div class="prop-row">
          <label>缩放</label>
          <el-input-number v-model="form.scale" size="small" :min="0.001" :step="0.01" :precision="3" @change="handleUpdate" />
        </div>
        <div class="prop-row">
          <label>旋转</label>
          <el-input-number v-model="form.rotate" size="small" :step="1" :precision="1" @change="handleUpdate" />
        </div>
        <div class="prop-row">
          <label>混合模式</label>
          <el-select v-model="form.blendmode" size="small" clearable @change="handleUpdate">
            <el-option label="正常" value="" />
            <el-option label="叠加" value="add" />
            <el-option label="屏幕" value="screen" />
            <el-option label="正片叠底" value="multiply" />
          </el-select>
        </div>
      </div>

      <!-- 信息点内容 -->
      <div v-if="form.type === 'info'" class="prop-section">
        <div class="section-title">信息卡片</div>
        <div class="prop-row">
          <label>标题</label>
          <el-input v-model="infoContent.title" size="small" placeholder="信息点标题" @change="handleUpdate" />
        </div>
        <div class="prop-row">
          <label>描述</label>
          <el-input
            v-model="infoContent.description"
            type="textarea"
            :rows="3"
            size="small"
            placeholder="详细描述内容"
            @change="handleUpdate"
          />
        </div>
        <div class="prop-row">
          <label>图片URL</label>
          <el-input v-model="infoContent.imageUrl" size="small" placeholder="可选的图片地址" @change="handleUpdate" />
        </div>
      </div>

      <!-- 链接 -->
      <div v-if="form.type === 'scene'" class="prop-section">
        <div class="section-title">跳转设置</div>
        <div class="prop-row">
          <label>目标场景</label>
          <el-select v-model="form.linkedSceneId" size="small" placeholder="选择场景" clearable @change="handleUpdate">
            <el-option
              v-for="scene in sceneStore.scenes"
              :key="scene.id"
              :label="scene.name"
              :value="scene.id"
            />
          </el-select>
        </div>
      </div>

      <!-- 高级 -->
      <div class="prop-section">
        <div class="section-title">高级</div>
        <div v-if="form.type === 'image' || form.type === 'quad' || form.type === 'video'" class="prop-row">
          <label>背景色</label>
          <el-input v-model="form.bgcolor" size="small" placeholder="#RRGGBB" @change="handleUpdate" />
        </div>
        <div v-if="form.type === 'image' || form.type === 'quad'" class="prop-row">
          <label>容差</label>
          <el-input-number v-model="form.tolerance" size="small" :min="0" :max="255" :step="1" @change="handleUpdate" />
        </div>
        <div v-if="form.type === 'image' || form.type === 'quad'" class="prop-row">
          <label>羽化</label>
          <el-input-number v-model="form.feather" size="small" :min="0" :max="100" :step="1" @change="handleUpdate" />
        </div>
        <div class="prop-row">
          <label>事件</label>
          <el-input v-model="form.events" size="small" placeholder='JSON格式: {"click":"func()"}' @change="handleUpdate" />
        </div>
        <div class="prop-row">
          <label>点击事件</label>
          <el-input v-model="form.onclick" size="small" placeholder="点击回调函数" @change="handleUpdate" />
        </div>
        <div class="prop-row">
          <label>跟随缩放</label>
          <el-switch v-model="form.followZoom" size="small" @change="handleUpdate" />
        </div>
      </div>

      <!-- 删除 -->
      <div class="prop-section">
        <el-button type="danger" size="small" @click="handleDelete">删除热点</el-button>
      </div>
    </template>
    <div v-else class="no-selection">
      请选择一个热点查看属性
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useHotspotStore } from '@/stores/hotspot'
import { useSceneStore } from '@/stores/scene'
import { useEditorStore } from '@/stores/editor'
import { useEditor } from '@/composables/useEditor'
import type { HotspotType } from '@/types'

const hotspotStore = useHotspotStore()
const sceneStore = useSceneStore()
const editorStore = useEditorStore()
const { removeHotspot } = useEditor()

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

// 是否显示媒体区域
const showMediaSection = computed(() => {
  return ['image', 'quad', 'model', 'video'].includes(form.type)
})

watch(
  () => hotspotStore.selectedHotspot,
  (hotspot) => {
    if (hotspot) {
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

      // 解析 content JSON 到 infoContent
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
    }
  },
  { immediate: true },
)

async function handleUpdate() {
  if (!hotspotStore.selectedHotspot) return

  // 将 infoContent 序列化为 JSON 字符串
  let contentJson = ''
  if (infoContent.title || infoContent.description || infoContent.imageUrl) {
    contentJson = JSON.stringify({
      title: infoContent.title,
      description: infoContent.description,
      imageUrl: infoContent.imageUrl,
    })
  }

  await hotspotStore.updateHotspot(hotspotStore.selectedHotspot.id, {
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
  editorStore.markDirty()
}

function handleDelete() {
  if (!hotspotStore.selectedHotspot) return
  removeHotspot(hotspotStore.selectedHotspot.id)
}
</script>

<style scoped>
.hotspot-properties {
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
  min-width: 80px;
  flex-shrink: 0;
}

.prop-row .el-input,
.prop-row .el-select,
.prop-row .el-input-number {
  flex: 1;
}

.no-selection {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
