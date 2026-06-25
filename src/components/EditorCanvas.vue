<template>
  <div class="editor-canvas" ref="canvasContainer">
    <div
      class="canvas-viewport"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
    >
      <div v-if="!vm.sceneViewModel.currentScene.value" class="canvas-empty">
        <p>请选择一个场景开始编辑</p>
      </div>
      <div v-else class="canvas-content">
        <PanoEngineViewer
          ref="panoViewerRef"
          :scene-config="vm.sceneViewModel.currentSceneConfig.value"
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
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import PanoEngineViewer from '@/components/PanoEngineViewer.vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'
import type { HotspotToolType } from '@/types'

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
    const coords = engine.getSphericalCoords(e.clientX, e.clientY)
    vm.addHotspot({
      name: '新热点',
      type: vm.hotspotType.value,
      ath: coords.ath,
      atv: coords.atv,
    })
  } else if (vm.activeTool.value === 'select' && engine) {
    const hotspot = engine.getHotspotAt(e.clientX, e.clientY)
    if (hotspot) {
      vm.hotspotViewModel.selectHotspot(hotspot.id)
      vm.hotspotViewModel.startDrag(hotspot.id)
    }
  }
}

function handlePointerMove(e: PointerEvent) {
  if (vm.hotspotViewModel.isDragging.value) {
    vm.hotspotViewModel.updateDrag(e.movementX, e.movementY)
    if (engine) {
      engine.syncHotspots(vm.hotspotViewModel.hotspots.value)
    }
  }
}

function handlePointerUp() {
  if (vm.hotspotViewModel.isDragging.value) {
    vm.hotspotViewModel.endDrag()
  }
}

function onEngineReady(adapter: PanoEngineAdapter) {
  engine = adapter
  if (vm.hotspotViewModel.hotspots.value.length > 0) {
    engine.syncHotspots(vm.hotspotViewModel.hotspots.value)
  }
}

// 监听热点变化，同步到引擎
watch(
  () => vm.hotspotViewModel.hotspots.value,
  (newHotspots) => {
    if (engine && newHotspots) {
      engine.syncHotspots(newHotspots)
    }
  },
  { deep: true }
)

onBeforeUnmount(() => {
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
