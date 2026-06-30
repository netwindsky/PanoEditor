<template>
  <div ref="container" class="pano-engine-viewer">
    <!-- 场景切换过渡遮罩：避免切换期间暴露瓦片加载断层 -->
    <div
      v-if="showTransitionOverlay"
      class="transition-overlay"
      :class="{ fading: isTransitionFading }"
    >
      <div class="transition-spinner" />
      <p>加载场景中...</p>
    </div>

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
import { ref, shallowRef, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'
import { perf } from '@/utils/performanceMonitor'
import type { Hotspot } from '@/types'

const props = defineProps<{
  sceneConfig: string | null
  tilingStatus: string
  tilingProgress: number
  hotspots: Hotspot[]
  allSceneConfigs?: string[]
  sceneId?: string | null
  isDragging?: boolean
}>()

const emit = defineEmits<{
  (e: 'engine-ready', engine: PanoEngineAdapter): void
}>()

const container = ref<HTMLElement>()
const engineRef = shallowRef<PanoEngineAdapter | null>(null)
let isLoading = false
let pendingSceneConfig: string | null = null
let lastHotspotsSnapshot = ''
let hasPreloaded = false

let perfEngineCreateCount = 0
let perfLoadSceneCount = 0

// ===== 场景切换过渡遮罩状态 =====
const showTransitionOverlay = ref(false)
const isTransitionFading = ref(false)
const TRANSITION_HOLD_MS = 600  // 遮罩保持时间，覆盖瓦片加载初期断层
const TRANSITION_FADE_MS = 400  // 淡出动画时间

function startTransitionOverlay() {
  showTransitionOverlay.value = true
  isTransitionFading.value = false
}

function endTransitionOverlay() {
  isTransitionFading.value = true
  setTimeout(() => {
    showTransitionOverlay.value = false
    isTransitionFading.value = false
  }, TRANSITION_FADE_MS)
}

// ===== 模式判断 =====
const usePreloadMode = computed(() => !!props.allSceneConfigs && props.allSceneConfigs.length > 0)

function syncHotspotsIfChanged(engine: PanoEngineAdapter, hotspots: Hotspot[]) {
  if (props.isDragging) return
  const snapshot = JSON.stringify(hotspots)
  if (snapshot === lastHotspotsSnapshot) return
  lastHotspotsSnapshot = snapshot
  perf.mark('viewer-sync-hotspots', { count: hotspots.length })
  engine.syncHotspots(hotspots)
}

watch(
  [engineRef, () => props.hotspots] as const,
  ([engine, newHotspots]) => {
    if (!engine || !newHotspots) return
    syncHotspotsIfChanged(engine, newHotspots)
  },
  { deep: true, immediate: true },
)

// ===== 预加载模式：首次传入 allSceneConfigs 时一次性加载所有场景 =====
watch(
  () => [props.allSceneConfigs, props.tilingStatus] as const,
  async ([configs, status]) => {
    if (!usePreloadMode.value || hasPreloaded) return
    if (!configs || status !== 'READY' || isLoading) return
    if (!container.value) return

    isLoading = true
    startTransitionOverlay()
    try {
      const endCreate = perf.stage('viewer-create-engine')
      const engine = new PanoEngineAdapter(container.value)
      perfEngineCreateCount++
      endCreate({ engineCount: perfEngineCreateCount })

      const parsedConfigs = configs.map((c) => JSON.parse(c))
      await perf.measureAsync('viewer-preload-scenes', () =>
        engine.preloadScenes(parsedConfigs),
      )

      engineRef.value = engine
      hasPreloaded = true
      syncHotspotsIfChanged(engine, props.hotspots)
      emit('engine-ready', engine)
    } catch (e) {
      console.error('Failed to preload scenes:', e)
    } finally {
      isLoading = false
      setTimeout(endTransitionOverlay, TRANSITION_HOLD_MS)
    }
  },
)

// ===== 预加载模式：sceneId 变化时切换场景 =====
watch(
  () => props.sceneId,
  async (newId, oldId) => {
    if (!usePreloadMode.value || !newId || newId === oldId) return
    const engine = engineRef.value
    if (!engine) return

    startTransitionOverlay()
    try {
      await perf.measureAsync('viewer-switch-scene', () => engine.switchScene(newId))
      syncHotspotsIfChanged(engine, props.hotspots)
    } catch (e) {
      console.warn('Switch scene failed, fallback to single-scene load:', e)
      if (props.sceneConfig) {
        await loadScene(props.sceneConfig)
        return
      }
    }
    // 给引擎一点时间加载初始瓦片后再淡出遮罩
    setTimeout(endTransitionOverlay, TRANSITION_HOLD_MS)
  },
)

// ===== 兼容模式：单 sceneConfig 加载 =====
watch(
  () => [props.sceneConfig, props.tilingStatus] as const,
  ([config, status], old) => {
    if (usePreloadMode.value) return
    perf.mark('viewer-watch-fired', {
      status,
      configChanged: old ? config !== old[0] : true,
      statusChanged: old ? status !== old[1] : true,
      isLoading,
    })
    if (config && status === 'READY') {
      loadScene(config)
    }
  },
)

async function loadScene(configJson: string) {
  if (!container.value) return
  if (isLoading) {
    pendingSceneConfig = configJson
    return
  }
  isLoading = true
  perfLoadSceneCount++
  const endLoad = perf.stage('viewer-load-scene', { loadCount: perfLoadSceneCount })

  await nextTick()

  try {
    let engine = engineRef.value
    const isNewEngine = !engine
    if (!engine) {
      const endCreate = perf.stage('viewer-create-engine')
      engine = new PanoEngineAdapter(container.value)
      perfEngineCreateCount++
      endCreate({ engineCount: perfEngineCreateCount })
    } else {
      perf.mark('viewer-reuse-engine')
    }

    const config = JSON.parse(configJson)
    await perf.measureAsync('viewer-load-scene-config', () => engine!.loadSceneConfig(config))

    if (isNewEngine) {
      engineRef.value = engine
    } else {
      syncHotspotsIfChanged(engine, props.hotspots)
    }
    emit('engine-ready', engine)
  } catch (e) {
    console.error('Failed to load scene config:', e)
  } finally {
    endLoad()
    isLoading = false
    if (pendingSceneConfig && pendingSceneConfig !== configJson) {
      const nextConfig = pendingSceneConfig
      pendingSceneConfig = null
      void loadScene(nextConfig)
    } else {
      pendingSceneConfig = null
    }
  }
}

function getEngine(): PanoEngineAdapter | null {
  return engineRef.value
}

defineExpose({ getEngine })

onMounted(() => {
  perf.mark('viewer-mounted', {
    hasConfig: !!props.sceneConfig,
    hasPreload: usePreloadMode.value,
    status: props.tilingStatus,
  })
  if (usePreloadMode.value) return
  if (props.sceneConfig && props.tilingStatus === 'READY') {
    loadScene(props.sceneConfig)
  }
})

onBeforeUnmount(() => {
  perf.mark('viewer-unmount')
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

/* 场景切换过渡遮罩 */
.transition-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1a1d27;
  z-index: 20;
  opacity: 1;
  transition: opacity 400ms ease-out;
}
.transition-overlay.fading {
  opacity: 0;
  pointer-events: none;
}
.transition-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #333;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.transition-overlay p {
  margin-top: 12px;
  color: #ccc;
  font-size: 14px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
