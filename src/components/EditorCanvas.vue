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
          :is-dragging="vm.hotspotViewModel.isDragging.value"
          :all-scene-configs="allSceneConfigs.value"
          :scene-id="vm.sceneViewModel.currentScene.value?.id || null"
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
import { parsePoints, serializePoints, isQuadLike } from '@/utils/quadPoints'

const props = defineProps<{
  vm: EditorViewModel
}>()

const vm = props.vm
const panoViewerRef = ref<InstanceType<typeof PanoEngineViewer>>()
const canvasContainer = ref<HTMLElement>()
let engine: PanoEngineAdapter | null = null

// 所有已就绪场景的 imageConfig，用于预加载到引擎实现无缝切换
const allSceneConfigs = computed(() =>
  vm.sceneViewModel.scenes.value
    .filter((s) => s.imageConfig)
    .map((s) => s.imageConfig),
)

// ===== 矩形热点控制点 =====
const HANDLE_SIZE = 12
const quadHandles = ref<HTMLElement[]>([])
const quadLinesSvg = ref<SVGSVGElement | null>(null)
const quadLines = ref<SVGPathElement[]>([])
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
  video: '视频热点',
}

const hotspotTypeLabel = computed(() =>
  hotspotTypeLabels[vm.hotspotType.value] || '热点'
)

// ===== 矩形热点控制点逻辑 =====

watch(
  () => vm.hotspotViewModel.selectedHotspot.value,
  (hotspot) => {
    clearQuadHandles()
    if (hotspot && isQuadLike(hotspot.type) && hotspot.points) {
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
    handle.style.transform = 'translate(-50%, -50%)'
    handle.style.boxShadow = '0 0 6px rgba(0,0,0,0.6)'
    handle.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)'
    handle.innerHTML = `<span>${i + 1}</span>`

    handle.addEventListener('pointerenter', () => {
      handle.style.transform = 'translate(-50%, -50%) scale(1.3)'
      handle.style.boxShadow = '0 0 12px rgba(0,0,0,0.8)'
    })
    handle.addEventListener('pointerleave', () => {
      handle.style.transform = 'translate(-50%, -50%)'
      handle.style.boxShadow = '0 0 6px rgba(0,0,0,0.6)'
    })

    handle.addEventListener('pointerdown', (e) => onHandlePointerDown(e, i))
    container.appendChild(handle)
    quadHandles.value.push(handle)
  }

  createQuadLines(container)
  startUpdateLoop()
}

function createQuadLines(container: HTMLElement) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.classList.add('quad-lines-svg')
  svg.style.position = 'absolute'
  svg.style.inset = '0'
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.pointerEvents = 'none'
  svg.style.zIndex = '99'
  svg.style.overflow = 'visible'

  const lines: SVGPathElement[] = []
  for (let i = 0; i < 4; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('stroke', 'rgba(255, 255, 255, 0.55)')
    path.setAttribute('stroke-width', '1.5')
    path.setAttribute('stroke-dasharray', '5 4')
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke-linecap', 'round')
    svg.appendChild(path)
    lines.push(path)
  }

  container.appendChild(svg)
  quadLinesSvg.value = svg
  quadLines.value = lines
}

function clearQuadHandles() {
  stopUpdateLoop()
  quadHandles.value.forEach((h) => h.remove())
  quadHandles.value = []
  quadLinesSvg.value?.remove()
  quadLinesSvg.value = null
  quadLines.value = []
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
  if (!hotspot || !isQuadLike(hotspot.type) || !engine) return

  const pts = parsePoints(hotspot.points)
  if (pts.length !== 4 || quadHandles.value.length !== 4) return

  const container = panoViewerRef.value?.$el as HTMLElement | undefined
  if (!container) return
  const rect = container.getBoundingClientRect()

  const screenCoords: { x: number; y: number; visible: boolean }[] = []

  pts.forEach((p, i) => {
    const handle = quadHandles.value[i]
    const screen = engine!.projectToScreen(p.ath, p.atv)

    const isOnScreen =
      screen.visible &&
      screen.x >= -20 &&
      screen.x <= rect.width + 20 &&
      screen.y >= -20 &&
      screen.y <= rect.height + 20

    screenCoords.push({ x: screen.x, y: screen.y, visible: isOnScreen })

    if (isOnScreen) {
      handle.style.display = 'flex'
      handle.style.left = `${screen.x}px`
      handle.style.top = `${screen.y}px`
    } else {
      handle.style.display = 'none'
    }
  })

  updateQuadLines(screenCoords)
}

function updateQuadLines(screenCoords: { x: number; y: number; visible: boolean }[]) {
  const lines = quadLines.value
  if (lines.length !== 4) return

  for (let i = 0; i < 4; i++) {
    const start = screenCoords[i]
    const end = screenCoords[(i + 1) % 4]
    const line = lines[i]

    if (start.visible && end.visible) {
      line.setAttribute('d', `M ${start.x} ${start.y} L ${end.x} ${end.y}`)
      line.style.display = 'block'
    } else {
      line.style.display = 'none'
    }
  }
}

function onHandlePointerDown(e: PointerEvent, index: number) {
  e.stopPropagation()
  e.preventDefault()
  isDraggingHandle.value = true
  selectedPointIndex.value = index
  const viewport = canvasContainer.value?.querySelector('.canvas-viewport') as HTMLElement | null
  viewport?.setPointerCapture(e.pointerId)
  engine?.disableControls()
  // 同步设置拖动 flag，阻止 syncHotspots 全量重建
  engine?.setDraggingMode(true)
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
      // 传入点击时鼠标的球坐标，供 ViewModel 记录鼠标与热点中心的偏移，
      // 拖动时用鼠标减偏移得到新中心，避免首次 move 跳变。
      const coords = engine.getCoordsFromPoint(e.clientX, e.clientY)
      vm.hotspotViewModel.startDrag(hotspotId, coords.ath, coords.atv)
      // 同步设置拖动 flag，阻止 syncHotspots 全量重建
      engine.setDraggingMode(true)
      // 同步设置拖动 flag，阻止 syncHotspots 全量重建
      engine.setDraggingMode(true)
      // 同步设置拖动 flag，阻止 syncHotspots 全量重建
      engine.setDraggingMode(true)
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
      // 轻量级更新：只刷新 mesh 顶点，不销毁+重建 video/texture
      engine.updateQuadGeometry(hotspot.id, hotspot.points)
    }
    return
  }

  if (vm.hotspotViewModel.isDragging.value && engine) {
    const id = vm.hotspotViewModel.draggingHotspotId.value
    if (!id) return

    const coords = engine.getCoordsFromPoint(e.clientX, e.clientY)
    vm.hotspotViewModel.updateDragToCoords(coords.ath, coords.atv)

    const hotspot = vm.hotspotViewModel.hotspots.value.find((h) => h.id === id)
    if (hotspot && isQuadLike(hotspot.type)) {
      // 四边形/视频热点：轻量级更新顶点几何体，避免重建 video 元素导致卡顿
      engine.updateQuadGeometry(hotspot.id, hotspot.points)
    } else {
      engine.moveHotspotTo(id, coords.ath, coords.atv)
    }
  }
}

function handlePointerUp() {
  // 优先处理控制点拖拽结束
  if (isDraggingHandle.value && selectedPointIndex.value !== null) {
    isDraggingHandle.value = false
    selectedPointIndex.value = null
    engine?.enableControls()
    // 解除拖动 flag，恢复 syncHotspots 正常工作
    engine?.setDraggingMode(false)

    // 保存到后端
    const hotspot = vm.hotspotViewModel.selectedHotspot.value
    if (hotspot) {
      vm.updateHotspot(hotspot.id, { points: hotspot.points })
    }
    return
  }

  if (vm.hotspotViewModel.isDragging.value) {
    vm.hotspotViewModel.endDrag()
    // 解除拖动 flag，恢复 syncHotspots 正常工作
    engine?.setDraggingMode(false)
  }
}

// 健壮性：指针取消（pointercancel）或移出窗口（pointerleave）时强制结束拖拽，
// 避免全景旋转被永久锁死（forceEndDrag 只解锁不提交后端）。
function handlePointerCancel() {
  if (isDraggingHandle.value) {
    isDraggingHandle.value = false
    selectedPointIndex.value = null
    engine?.enableControls()
    engine?.setDraggingMode(false)
    return
  }

  if (vm.hotspotViewModel.isDragging.value) {
    vm.hotspotViewModel.forceEndDrag()
    engine?.setDraggingMode(false)
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

</style>

<style>
/* 非 scoped：控制点与虚线是运行时动态创建的，不受 Vue scoped style 约束 */
.quad-handle {
  transform: translate(-50%, -50%);
  user-select: none;
  transition: transform 0.1s ease, box-shadow 0.15s ease;
}

.quad-handle:hover {
  transform: translate(-50%, -50%) scale(1.3);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.8) !important;
}

.quad-handle span {
  pointer-events: none;
}

.quad-lines-svg path {
  animation: dashFlow 0.8s linear infinite;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
}

@keyframes dashFlow {
  to {
    stroke-dashoffset: -9;
  }
}
</style>
