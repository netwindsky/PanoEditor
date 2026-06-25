<template>
  <el-dialog
    v-model="visible"
    title="选择项目"
    width="600px"
    :close-on-click-modal="false"
    class="project-modal"
  >
    <div class="modal-toolbar">
      <el-input v-model="searchQuery" placeholder="搜索项目" size="small" clearable style="width: 200px" />
      <el-button type="primary" size="small" @click="handleCreate">新建项目</el-button>
    </div>
    <div class="project-list">
      <div
        v-for="project in filteredProjects"
        :key="project.id"
        class="project-card"
        @click="handleSelect(project.id)"
      >
        <div class="project-cover" :style="{ backgroundImage: `url(${project.coverUrl})` }" />
        <div class="project-info">
          <span class="project-name">{{ project.name }}</span>
          <span class="project-meta">{{ project.sceneCount }} 个场景 · {{ formatDate(project.updatedAt) }}</span>
        </div>
      </div>
      <div v-if="filteredProjects.length === 0" class="list-empty">
        暂无项目
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import * as projectApi from '@/api/project'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const router = useRouter()
const projectStore = useProjectStore()
const searchQuery = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const filteredProjects = computed(() => {
  if (!searchQuery.value) return projectStore.projects
  const q = searchQuery.value.toLowerCase()
  return projectStore.projects.filter((p) => p.name.toLowerCase().includes(q))
})

watch(visible, async (val) => {
  if (val) {
    await projectStore.fetchProjects()
  }
})

function handleSelect(projectId: string) {
  visible.value = false
  router.push(`/editor/${projectId}`)
}

async function handleCreate() {
  const res = await projectApi.createProject({ name: '新项目' })
  const project = res.data.data
  visible.value = false
  router.push(`/editor/${project.id}`)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.modal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.project-list {
  max-height: 400px;
  overflow-y: auto;
}

.project-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid var(--border-color);
  margin-bottom: 8px;
}

.project-card:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}

.project-cover {
  width: 80px;
  height: 50px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-tertiary);
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  display: block;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 4px;
}

.project-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.list-empty {
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
