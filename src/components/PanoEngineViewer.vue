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
import type { SceneData } from '@panoview'

const props = defineProps<{
  /** 引擎直吃的 SceneData（视角来自 ViewModel 派生，非从 JSON string 解析） */
  sceneData: SceneData | null
  tilingStatus: string
  tilingProgress: number
  hotspots: Hotspot[]
  /** 预加载模式：一次性把所有已就绪场景注入引擎，供无缝切换 */
  allSceneData?: SceneData[]
  sceneId?: string | null
  isDragging?: boolean
}>()

const emit = defineEmits<{
  (e: 'engine-ready', engine: PanoEngineAdapter): void
}>()

const container = ref<HTMLElement>()
const engineRef = shallowRef<PanoEngineAdapter | null>(null)
let isLoading = false
let pendingSceneData: SceneData | null = null
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
const usePreloadMode = computed(() => !!props.allSceneData && props.allSceneData.length > 0)

function syncHotspotsIfChanged(engine: PanoEngineAdapter, hotspots: Hotspot[]) {
  // 同步检查拖动 flag（绕过 Vue 响应式 prop 时序问题）。
  // 拖动期间跳过全量重建，避免每帧 delete+create 导致闪烁。
  if (engine.isDraggingMode()) return
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

/**
 * 预加载所有已就绪场景到引擎，并激活当前场景。
 * 提取为独立函数，供 watch 和 onMounted 复用（onMounted 时数据已就绪但 watch 不会自动触发）。
 */
async function startPreload(): Promise<void> {
  if (!usePreloadMode.value || hasPreloaded) return
  if (!props.allSceneData || props.tilingStatus !== 'READY' || isLoading) return
  if (!container.value) return

  isLoading = true
  startTransitionOverlay()
  try {
    const endCreate = perf.stage('viewer-create-engine')
    const engine = new PanoEngineAdapter(container.value)
    perfEngineCreateCount++
    endCreate({ engineCount: perfEngineCreateCount })

    await perf.measureAsync('viewer-preload-scenes', () =>
      engine.preloadScenes(props.allSceneData as unknown as Record<string, any>[]),
    )

    engineRef.value = engine
    hasPreloaded = true
    syncHotspotsIfChanged(engine, props.hotspots)
    emit('engine-ready', engine)

    // 预加载完成后立即激活当前场景（sceneId watch 不会在初始挂载时触发）
    if (props.sceneId) {
      await perf.measureAsync('viewer-switch-scene', () => engine.switchScene(props.sceneId!))
      syncHotspotsIfChanged(engine, props.hotspots)
      setTimeout(endTransitionOverlay, TRANSITION_HOLD_MS)
    }
  } catch (e) {
    console.error('Failed to preload scenes:', e)
  } finally {
    isLoading = false
  }
}

// ===== 预加载模式：allSceneData / tilingStatus 变化时触发预加载 =====
watch(
  () => [props.allSceneData, props.tilingStatus] as const,
  async () => {
    await startPreload()
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
      if (props.sceneData) {
        await loadScene(props.sceneData)
        return
      }
    }
    // 给引擎一点时间加载初始瓦片后再淡出遮罩
    setTimeout(endTransitionOverlay, TRANSITION_HOLD_MS)
  },
)

// ===== 预加载模式：视角变化时实时更新相机（不重新加载场景） =====
// 滑块拖动时 sceneData 的 view 字段变化，但 sceneId 不变，只需更新相机朝向和 FOV
let lastViewSnapshot = ''
watch(
  () => props.sceneData,
  (newData) => {
    if (!usePreloadMode.value || !hasPreloaded || !newData?.view) return
    const engine = engineRef.value
    if (!engine) return

    // 构建 view 快照，避免重复调用 setCameraView
    const viewSnapshot = JSON.stringify(newData.view)
    if (viewSnapshot === lastViewSnapshot) return
    lastViewSnapshot = viewSnapshot

    // 仅当 scene ID 与当前引擎加载的场景一致时，才更新相机（避免干扰场景切换）
    const currentSceneId = props.sceneId
    if (currentSceneId && newData.scene.name !== currentSceneId) return

    engine.setCameraView({
      yaw: Number(newData.view.hlookat) || 0,
      pitch: Number(newData.view.vlookat) || 0,
      hfov: Number(newData.view.fov) || 100,
      fovtype: newData.view.fovtype,
    })
  },
)

// ===== 兼容模式：单 sceneData 加载 =====
watch(
  () => [props.sceneData, props.tilingStatus] as const,
  ([data, status], old) => {
    if (usePreloadMode.value) return
    perf.mark('viewer-watch-fired', {
      status,
      configChanged: old ? data !== old[0] : true,
      statusChanged: old ? status !== old[1] : true,
      isLoading,
    })
    if (data && status === 'READY') {
      loadScene(data)
    }
  },
)

async function loadScene(sceneData: SceneData) {
  if (!container.value) return
  if (isLoading) {
    pendingSceneData = sceneData
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

    await perf.measureAsync('viewer-load-scene-config', () => engine!.loadSceneConfig(sceneData))

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
    if (pendingSceneData && pendingSceneData !== sceneData) {
      const next = pendingSceneData
      pendingSceneData = null
      void loadScene(next)
    } else {
      pendingSceneData = null
    }
  }
}

function getEngine(): PanoEngineAdapter | null {
  return engineRef.value
}

defineExpose({ getEngine })

onMounted(() => {
  perf.mark('viewer-mounted', {
    hasConfig: !!props.sceneData,
    hasPreload: usePreloadMode.value,
    status: props.tilingStatus,
  })
  if (usePreloadMode.value) {
    // 初始挂载时若数据已就绪，主动触发预加载。
    // 此时数据不会再有"变更"来驱动 watch 回调，需要 onMounted 兜底。
    if (!hasPreloaded && props.allSceneData?.length && props.tilingStatus === 'READY') {
      void startPreload()
    }
    return
  }
  if (props.sceneData && props.tilingStatus === 'READY') {
    loadScene(props.sceneData)
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
