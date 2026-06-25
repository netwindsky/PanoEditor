<template>
  <div ref="container" class="pano-engine-viewer">
    <div v-if="tilingStatus === 'PROCESSING'" class="tiling-overlay">
      <div class="tiling-progress">
        <el-progress :percentage="tilingProgress" :stroke-width="8" />
        <p>正在处理全景图... {{ tilingProgress }}%</p>
      </div>
    </div>
    <div v-if="tilingStatus === 'FAILED'" class="tiling-overlay">
      <div class="tiling-progress">
        <p class="tiling-error">全景图处理失败</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'
import type { Hotspot } from '@/types'

const props = defineProps<{
  sceneConfig: string | null  // JSON 格式的场景配置
  tilingStatus: string       // PROCESSING, READY, FAILED
  tilingProgress: number     // 0-100
  hotspots: Hotspot[]        // 当前场景的热点列表
}>()

const emit = defineEmits<{
  (e: 'engine-ready', engine: PanoEngineAdapter): void
}>()

const container = ref<HTMLElement>()
let engine: PanoEngineAdapter | null = null
let isLoading = false  // 防止重复加载

// 用一个统一的watch同时监听sceneConfig和tilingStatus，避免两者同时变化时触发两次
watch(
  () => [props.sceneConfig, props.tilingStatus] as const,
  ([config, status]) => {
    if (config && status === 'READY' && !isLoading) {
      loadScene(config)
    }
  },
)

// 监听热点列表变化，同步到3D场景
watch(
  () => props.hotspots,
  (newHotspots) => {
    if (engine && newHotspots) {
      engine.syncHotspots(newHotspots)
    }
  },
  { deep: true },
)

async function loadScene(configJson: string) {
  if (!container.value || isLoading) return
  isLoading = true

  // 销毁旧引擎
  if (engine) {
    engine.dispose()
    engine = null
  }

  // 等待DOM更新完成
  await nextTick()

  try {
    engine = new PanoEngineAdapter(container.value)
    const config = JSON.parse(configJson)
    engine.loadSceneConfig(config)
    // 场景加载后同步热点
    if (props.hotspots && props.hotspots.length > 0) {
      engine.syncHotspots(props.hotspots)
    }
    emit('engine-ready', engine)
  } catch (e) {
    console.error('Failed to load scene config:', e)
  } finally {
    isLoading = false
  }
}

function getEngine(): PanoEngineAdapter | null {
  return engine
}

defineExpose({ getEngine })

onMounted(() => {
  if (props.sceneConfig && props.tilingStatus === 'READY') {
    loadScene(props.sceneConfig)
  }
})

onBeforeUnmount(() => {
  if (engine) {
    engine.dispose()
    engine = null
  }
})
</script>

<style scoped>
.pano-engine-viewer {
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: #1a1d27;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  cursor: grab;
}
.pano-engine-viewer:active {
  cursor: grabbing;
}
.tiling-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 29, 39, 0.9);
  z-index: 10;
}
.tiling-progress {
  text-align: center;
  color: #ccc;
  font-size: 14px;
  min-width: 200px;
}
.tiling-progress p {
  margin-top: 12px;
}
.tiling-error {
  color: #f56c6c;
}
</style>
