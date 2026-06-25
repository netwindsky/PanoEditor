<template>
  <div class="asset-library">
    <div class="prop-section">
      <div class="section-title">资源库</div>
      <div class="library-filter">
        <el-select v-model="filterType" size="small" placeholder="类型筛选" clearable style="width: 100%">
          <el-option label="全景图" value="panorama" />
          <el-option label="图片" value="image" />
          <el-option label="视频" value="video" />
          <el-option label="音频" value="audio" />
        </el-select>
      </div>
      <div class="library-grid">
        <div v-for="resource in resources" :key="resource.id" class="library-item" @click="handleSelect(resource)">
          <div class="library-thumb" :style="{ backgroundImage: `url(${resource.thumbUrl || resource.url})` }">
            <span class="library-badge">{{ resource.type }}</span>
          </div>
          <span class="library-name">{{ resource.name }}</span>
        </div>
        <div v-if="resources.length === 0" class="library-empty">
          暂无资源
        </div>
      </div>
    </div>
    <div class="prop-section">
      <el-button size="small" @click="editorStore.setRightPanelSection('scene')">返回场景属性</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useProjectStore } from '@/stores/project'
import { getResources } from '@/api/resource'
import type { Resource, ResourceType } from '@/types'

const editorStore = useEditorStore()
const projectStore = useProjectStore()
const filterType = ref<ResourceType | ''>('')
const resources = ref<Resource[]>([])

const projectId = computed(() => projectStore.currentProject?.id || '')

async function fetchResources() {
  if (!projectId.value) return
  const res = await getResources(projectId.value, filterType.value || undefined)
  resources.value = res.data.data.records
}

watch(filterType, fetchResources, { immediate: true })

function handleSelect(_resource: Resource) {
  // 资源选择应用到场景
}
</script>

<style scoped>
.asset-library {
  padding: 12px;
}

.prop-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.library-filter {
  margin-bottom: 10px;
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.library-item {
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: background 0.15s;
}

.library-item:hover {
  background: var(--bg-hover);
}

.library-thumb {
  width: 100%;
  aspect-ratio: 4/3;
  background-color: var(--bg-tertiary);
  background-size: cover;
  background-position: center;
  position: relative;
}

.library-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 10px;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 6px;
  border-radius: 3px;
}

.library-name {
  display: block;
  padding: 4px 6px;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-empty {
  grid-column: 1 / -1;
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
