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
import { ref, shallowRef, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
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
// 引擎实例改为响应式（shallowRef：仅追踪实例引用替换，不深度代理 Three.js 内部对象）。
// 这样可以与 props.hotspots 一起用统一 watch 监听，消除"引擎就绪"与"数据就绪"的竞态。
const engineRef = shallowRef<PanoEngineAdapter | null>(null)
let isLoading = false  // 防止重复加载

// ===== 性能埋点：统计引擎创建/场景加载次数与耗时 =====
// 用于定位 1fps 问题：若 loadScene 被反复触发、引擎被多次 new，即为根因。
let perfEngineCreateCount = 0
let perfLoadSceneCount = 0
function perfMark(label: string, extra?: Record<string, unknown>) {
  // 统一前缀，便于在控制台过滤： 过滤关键字 [PERF]
  console.log(
    `[PERF][${performance.now().toFixed(1)}ms] ${label}`,
    { loadSceneCount: perfLoadSceneCount, engineCreateCount: perfEngineCreateCount, ...extra },
  )
}

// 用一个统一的watch同时监听sceneConfig和tilingStatus，避免两者同时变化时触发两次
watch(
  () => [props.sceneConfig, props.tilingStatus] as const,
  ([config, status], old) => {
    perfMark('watch[sceneConfig,tilingStatus] fired', {
      status,
      configChanged: old ? config !== old[0] : true,
      statusChanged: old ? status !== old[1] : true,
      isLoading,
    })
    if (config && status === 'READY' && !isLoading) {
      loadScene(config)
    }
  },
)

// 统一监听"引擎实例"与"热点数据"：无论谁后就绪，最后到达的一方都会触发本 watch，
// 在两者都就绪时同步热点，从根本上消除"引擎就绪/数据就绪"的竞态。
// immediate:true 保证引擎首次创建后立即同步一次当前热点（含空列表清场）。
watch(
  [engineRef, () => props.hotspots] as const,
  ([engine, newHotspots]) => {
    if (!engine || !newHotspots) return
    perfMark('watch[engine,hotspots] -> syncHotspots', { count: newHotspots.length })
    engine.syncHotspots(newHotspots)
  },
  { deep: true, immediate: true },
)

async function loadScene(configJson: string) {
  if (!container.value || isLoading) return
  isLoading = true
  perfLoadSceneCount++
  const t0 = performance.now()
  perfMark('loadScene START')

  // 销毁旧引擎
  if (engineRef.value) {
    engineRef.value.dispose()
    engineRef.value = null
    perfMark('loadScene: old engine disposed')
  }

  // 等待DOM更新完成
  await nextTick()

  try {
    const engine = new PanoEngineAdapter(container.value)
    perfEngineCreateCount++
    perfMark('loadScene: new PanoEngineAdapter created')
    const config = JSON.parse(configJson)
    engine.loadSceneConfig(config)
    perfMark('loadScene: loadSceneConfig done', { ms: (performance.now() - t0).toFixed(1) })
    // 引擎赋值给响应式 ref：触发统一 watch，在"引擎+数据均就绪"时同步热点（含空列表清场）。
    // 无需再在此手动 syncHotspots——交由统一 watch 处理，消除竞态与重复同步。
    engineRef.value = engine
    emit('engine-ready', engine)
    perfMark('loadScene END', { totalMs: (performance.now() - t0).toFixed(1) })
  } catch (e) {
    console.error('Failed to load scene config:', e)
  } finally {
    isLoading = false
  }
}

function getEngine(): PanoEngineAdapter | null {
  return engineRef.value
}

defineExpose({ getEngine })

onMounted(() => {
  perfMark('onMounted', { hasConfig: !!props.sceneConfig, status: props.tilingStatus })
  if (props.sceneConfig && props.tilingStatus === 'READY') {
    loadScene(props.sceneConfig)
  }
})

onBeforeUnmount(() => {
  perfMark('onBeforeUnmount -> dispose engine')
  if (engineRef.value) {
    engineRef.value.dispose()
    engineRef.value = null
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
