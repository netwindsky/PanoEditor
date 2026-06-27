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
import { ref, computed, onBeforeUnmount } from 'vue'
import PanoEngineViewer from '@/components/PanoEngineViewer.vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'
import type { HotspotToolType } from '@/types'
import { buildHotspotParams } from '@/utils/hotspotFactory'

const props = defineProps<{
  vm: EditorViewModel
}>()

const vm = props.vm
const panoViewerRef = ref<InstanceType<typeof PanoEngineViewer>>()
let engine: PanoEngineAdapter | null = null

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
  if (vm.hotspotViewModel.isDragging.value) {
    const id = vm.hotspotViewModel.draggingHotspotId.value
    vm.hotspotViewModel.updateDrag(e.movementX, e.movementY)
    // 增量移动单个热点，避免全量销毁/重建所有热点（拖拽期间每帧触发会导致严重卡顿）
    if (engine && id) {
      const sensitivity = 0.1
      const deltaAth = e.movementX * sensitivity
      const deltaAtv = -e.movementY * sensitivity
      engine.moveHotspot(id, deltaAth, deltaAtv)
    }
  }
}

function handlePointerUp() {
  if (vm.hotspotViewModel.isDragging.value) {
    vm.hotspotViewModel.endDrag()
  }
}

// 健壮性：指针取消（pointercancel）或移出窗口（pointerleave）时强制结束拖拽，
// 避免全景旋转被永久锁死（forceEndDrag 只解锁不提交后端）。
function handlePointerCancel() {
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
