<template>
  <div class="editor-layout">
    <TopNav :vm="vm" v-model="showProjectModal" />
    <div class="editor-body">
      <LeftPanel v-if="vm.leftPanelVisible.value" :vm="vm" :projectId="projectId || ''" />
      <div class="editor-center">
        <Toolbar :vm="vm" />
        <EditorCanvas :vm="vm" />
        <TimelineBar :vm="vm" />
      </div>
      <RightPanel v-if="vm.rightPanelVisible.value" :vm="vm" />
    </div>
    <StatusBar :vm="vm" />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import { EditorViewModel } from '@/viewmodels/EditorViewModel'
import { ProjectRepository } from '@/models/repositories/ProjectRepository'
import { SceneRepository } from '@/models/repositories/SceneRepository'
import { HotspotRepository } from '@/models/repositories/HotspotRepository'
import { ResourceRepository } from '@/models/repositories/ResourceRepository'
import { ProjectService } from '@/models/services/ProjectService'
import { SceneService } from '@/models/services/SceneService'
import { HotspotService } from '@/models/services/HotspotService'
import { ResourceService } from '@/models/services/ResourceService'
import TopNav from '@/components/TopNav.vue'
import LeftPanel from '@/components/LeftPanel.vue'
import Toolbar from '@/components/Toolbar.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import RightPanel from '@/components/RightPanel.vue'
import TimelineBar from '@/components/TimelineBar.vue'
import StatusBar from '@/components/StatusBar.vue'

const route = useRoute()
const showProjectModal = ref(false)

// 创建 ViewModel 实例
const projectRepo = new ProjectRepository()
const sceneRepo = new SceneRepository()
const hotspotRepo = new HotspotRepository()
const resourceRepo = new ResourceRepository()

const projectService = new ProjectService(projectRepo)
const sceneService = new SceneService(sceneRepo, resourceRepo)
const hotspotService = new HotspotService(hotspotRepo)
const resourceService = new ResourceService(resourceRepo)

const vm = new EditorViewModel(
  projectService,
  sceneService,
  hotspotService,
  resourceService
)

// 提供 ViewModel 给子组件
provide('editorViewModel', vm)

const projectId = computed(() => route.params.projectId as string)

onMounted(async () => {
  if (projectId.value) {
    await vm.loadProject(projectId.value)
  } else {
    showProjectModal.value = true
  }
})

onBeforeUnmount(() => {
  vm.dispose()
})
</script>

<style scoped>
.editor-layout {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
</style>
