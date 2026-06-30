<template>
  <div class="editor-canvas" ref="canvasContainer">
    <div
      class="canvas-viewport"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @pointerleave="handlePointerCancel"
    >
      <div v-if="!vm.sceneViewModel.currentScene.value" class="canvas-empty">
        <p>请选择一个场景开始编辑</p>
      </div>
      <div v-else class="canvas-content">
        <PanoEngineViewer
          ref="panoViewerRef"
          :scene-config="vm.sceneViewModel.currentSceneConfig.value"
          :tiling-status="vm.sceneViewModel.currentTilingStatus.value"
          :tiling-progress="vm.sceneViewModel.currentTilingProgress.value"
          :hotspots="vm.hotspotViewModel.hotspots.value"
          class="pano-preview-wrap"
          @engine-ready="onEngineReady"
        />
        <div
          v-if="vm.activeTool.value === 'hotspot' && isSceneReady"
          class="hotspot-cursor-hint"
        >
          点击全景画面添加{{ hotspotTypeLabel }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch, nextTick } from 'vue'
import PanoEngineViewer from '@/components/PanoEngineViewer.vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'
import type { HotspotToolType } from '@/types'
import { buildHotspotParams } from '@/utils/hotspotFactory'
import { parsePoints, serializePoints } from '@/utils/quadPoints'

const props = defineProps<{
  vm: EditorViewModel
}>()

const vm = props.vm
const panoViewerRef = ref<InstanceType<typeof PanoEngineViewer>>()
const canvasContainer = ref<HTMLElement>()
let engine: PanoEngineAdapter | null = null

// ===== 矩形热点控制点 =====
const HANDLE_SIZE = 12
const quadHandles = ref<HTMLElement[]>([])
const isDraggingHandle = ref(false)
const selectedPointIndex = ref<number | null>(null)
let rafId: number | null = null

// 场景就绪状态
const isSceneReady = computed(() => {
  const scene = vm.sceneViewModel.currentScene.value
  if (!scene) return false
  const tiling = vm.sceneViewModel.tilingStatusMap.get(scene.id)
  return !tiling || tiling.status === 'COMPLETED'
})

// 热点类型标签
const hotspotTypeLabels: Record<HotspotToolType, string> = {
  info: '信息点',
  scene: '场景跳转',
  image: '图片热点',
  quad: '矩形热点',
  model: '3D模型热点',
}

const hotspotTypeLabel = computed(() =>
  hotspotTypeLabels[vm.hotspotType.value] || '热点'
)

// ===== 矩形热点控制点逻辑 =====

watch(
  () => vm.hotspotViewModel.selectedHotspot.value,
  (hotspot) => {
    clearQuadHandles()
    if (hotspot && hotspot.type === 'quad' && hotspot.points) {
      void nextTick(() => createQuadHandles(hotspot))
    }
  }
)

function createQuadHandles(hotspot: { points: string }) {
  const container = panoViewerRef.value?.$el as HTMLElement | undefined
  if (!container) return

  const pts = parsePoints(hotspot.points)
  if (pts.length !== 4) return

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  for (let i = 0; i < 4; i++) {
    const handle = document.createElement('div')
    handle.className = 'quad-handle'
    handle.dataset.index = String(i + 1)
    handle.style.position = 'absolute'
    handle.style.width = `${HANDLE_SIZE}px`
    handle.style.height = `${HANDLE_SIZE}px`
    handle.style.background = colors[i]
    handle.style.border = '2px solid #fff'
    handle.style.borderRadius = '50%'
    handle.style.cursor = 'move'
    handle.style.pointerEvents = 'auto'
    handle.style.zIndex = '100'
    handle.style.display = 'flex'
    handle.style.alignItems = 'center'
    handle.style.justifyContent = 'center'
    handle.style.fontSize = '10px'
    handle.style.fontWeight = 'bold'
    handle.style.color = '#fff'
    handle.innerHTML = `<span>${i + 1}</span>`

    handle.addEventListener('pointerdown', (e) => onHandlePointerDown(e, i))
    container.appendChild(handle)
    quadHandles.value.push(handle)
  }

  startUpdateLoop()
}

function clearQuadHandles() {
  stopUpdateLoop()
  quadHandles.value.forEach((h) => h.remove())
  quadHandles.value = []
  isDraggingHandle.value = false
  selectedPointIndex.value = null
}

function startUpdateLoop() {
  if (rafId) return
  const loop = () => {
    updateQuadHandles()
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)
}

function stopUpdateLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function updateQuadHandles() {
  const hotspot = vm.hotspotViewModel.selectedHotspot.value
  if (!hotspot || hotspot.type !== 'quad' || !engine) return

  const pts = parsePoints(hotspot.points)
  if (pts.length !== 4 || quadHandles.value.length !== 4) return

  const container = panoViewerRef.value?.$el as HTMLElement | undefined
  if (!container) return
  const rect = container.getBoundingClientRect()

  pts.forEach((p, i) => {
    const handle = quadHandles.value[i]
    const screen = engine!.projectToScreen(p.ath, p.atv)

    const isOnScreen =
      screen.visible &&
      screen.x >= -20 &&
      screen.x <= rect.width + 20 &&
      screen.y >= -20 &&
      screen.y <= rect.height + 20

    if (isOnScreen) {
      handle.style.display = 'flex'
      handle.style.left = `${screen.x}px`
      handle.style.top = `${screen.y}px`
    } else {
      handle.style.display = 'none'
    }
  })
}

function onHandlePointerDown(e: PointerEvent, index: number) {
  e.stopPropagation()
  e.preventDefault()
  isDraggingHandle.value = true
  selectedPointIndex.value = index
  const viewport = canvasContainer.value?.querySelector('.canvas-viewport') as HTMLElement | null
  viewport?.setPointerCapture(e.pointerId)
  engine?.disableControls()
}

// 指针事件处理
function handlePointerDown(e: PointerEvent) {
  if (vm.activeTool.value === 'hotspot' && engine) {
    const coords = engine.getCoordsFromPoint(e.clientX, e.clientY)
    vm.addHotspot(buildHotspotParams(vm.hotspotType.value, coords.ath, coords.atv))
  } else if (vm.activeTool.value === 'select' && engine) {
    const hotspotId = engine.getHitHotspot(e.clientX, e.clientY)
    if (hotspotId) {
      vm.hotspotViewModel.selectHotspot(hotspotId)
      vm.setRightPanelSection('hotspot')
      vm.hotspotViewModel.startDrag(hotspotId)
    }
  }
}

// 构建新热点参数：复用 @/utils/hotspotFactory.buildHotspotParams，
// quad/image/model 会自动补齐引擎所需的 points/url 默认值，避免创建即报错。

function handlePointerMove(e: PointerEvent) {
  // 优先处理控制点拖拽
  if (isDraggingHandle.value && selectedPointIndex.value !== null && engine) {
    const hotspot = vm.hotspotViewModel.selectedHotspot.value
    if (!hotspot || !hotspot.points) return

    const coords = engine.getCoordsFromPoint(e.clientX, e.clientY)
    const pts = parsePoints(hotspot.points)
    if (pts.length === 4) {
      pts[selectedPointIndex.value].ath = coords.ath
      pts[selectedPointIndex.value].atv = coords.atv
      hotspot.points = serializePoints(pts)
      // 实时同步到引擎，避免触发 PanoEngineViewer 的 watch 全量重建
      engine.updateHotspotInScene(hotspot)
    }
    return
  }

  if (vm.hotspotViewModel.isDragging.value && engine) {
    const id = vm.hotspotViewModel.draggingHotspotId.value
    if (!id) return

    const coords = engine.getCoordsFromPoint(e.clientX, e.clientY)
    vm.hotspotViewModel.updateDragToCoords(coords.ath, coords.atv)
    engine.moveHotspotTo(id, coords.ath, coords.atv)
  }
}

function handlePointerUp() {
  // 优先处理控制点拖拽结束
  if (isDraggingHandle.value && selectedPointIndex.value !== null) {
    isDraggingHandle.value = false
    selectedPointIndex.value = null
    engine?.enableControls()

    // 保存到后端
    const hotspot = vm.hotspotViewModel.selectedHotspot.value
    if (hotspot) {
      vm.updateHotspot(hotspot.id, { points: hotspot.points })
    }
    return
  }

  if (vm.hotspotViewModel.isDragging.value) {
    vm.hotspotViewModel.endDrag()
  }
}

// 健壮性：指针取消（pointercancel）或移出窗口（pointerleave）时强制结束拖拽，
// 避免全景旋转被永久锁死（forceEndDrag 只解锁不提交后端）。
function handlePointerCancel() {
  if (isDraggingHandle.value) {
    isDraggingHandle.value = false
    selectedPointIndex.value = null
    engine?.enableControls()
    return
  }

  if (vm.hotspotViewModel.isDragging.value) {
    vm.hotspotViewModel.forceEndDrag()
  }
}

function onEngineReady(adapter: PanoEngineAdapter) {
  engine = adapter
  // 注入相机锁定器：拖拽热点时锁定全景旋转，结束时解锁
  vm.hotspotViewModel.setCameraLock({
    lock: () => engine?.disableControls(),
    unlock: () => engine?.enableControls(),
  })
  // 引擎首次就绪时做一次全量同步，把已有热点绘制到场景
  if (vm.hotspotViewModel.hotspots.value.length > 0) {
    engine.syncHotspots(vm.hotspotViewModel.hotspots.value)
  }
}

// 注意：热点增删的引擎同步统一由 PanoEngineViewer 内部的 watch 负责，
// 此处不再重复 watch + syncHotspots，避免每次热点变化触发两次全量重建。

onBeforeUnmount(() => {
  clearQuadHandles()
  // 卸载时若仍在拖拽，强制解锁，避免遗留锁定状态
  if (vm.hotspotViewModel.isDragging.value) {
    vm.hotspotViewModel.forceEndDrag()
  }
  if (engine) {
    engine.dispose()
    engine = null
  }
})
</script>

<style scoped>
.editor-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--bg-tertiary);
}

.canvas-viewport {
  width: 100%;
  height: 100%;
  position: relative;
}

.canvas-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
}

.canvas-content {
  width: 100%;
  height: 100%;
}

.pano-preview-wrap {
  width: 100%;
  height: 100%;
}

.hotspot-cursor-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  z-index: 10;
}

.quad-handle {
  transform: translate(-50%, -50%);
  user-select: none;
  transition: transform 0.1s ease, box-shadow 0.15s ease;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
}

.quad-handle:hover {
  transform: translate(-50%, -50%) scale(1.3);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.8);
}

.quad-handle span {
  pointer-events: none;
}
</style>
