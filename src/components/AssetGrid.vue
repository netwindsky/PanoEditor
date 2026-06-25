<template>
  <div class="asset-grid">
    <div class="grid-header">
      <span class="grid-title">资源库</span>
      <el-button text size="small" @click="handleUpload" :loading="vm.uploading.value">
        <el-icon v-if="!vm.uploading.value"><Upload /></el-icon>
      </el-button>
    </div>
    <div class="grid-filter">
      <el-select v-model="vm.filterType.value" size="small" placeholder="资源类型" clearable style="width: 100%">
        <el-option label="全景图" value="panorama" />
        <el-option label="图片" value="image" />
        <el-option label="视频" value="video" />
        <el-option label="音频" value="audio" />
      </el-select>
    </div>
    <!-- 上传进度条 -->
    <div v-if="vm.uploading.value" class="upload-progress">
      <el-progress :percentage="vm.uploadProgress.value" :stroke-width="4" :show-text="true" />
      <span class="upload-label">上传中 {{ vm.uploadProgress.value }}%</span>
    </div>
    <div class="grid-content">
      <div v-for="resource in vm.resources.value" :key="resource.id" class="asset-item" @click="handleSelect(resource)">
        <div class="asset-thumb" :style="{ backgroundImage: 'url(' + (resource.thumbUrl || resource.url) + ')' }">
          <span class="asset-type-badge">{{ resource.type }}</span>
        </div>
        <span class="asset-name">{{ resource.name }}</span>
      </div>
      <div v-if="vm.resources.value.length === 0 && !vm.uploading.value" class="grid-empty">
        暂无资源，点击上传
      </div>
    </div>
    <input
      ref="fileInput"
      type="file"
      style="display: none"
      accept="image/*,video/*,audio/*"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { AssetViewModel } from '@/viewmodels/AssetViewModel'
import type { Resource } from '@/types'

const props = defineProps<{
  vm: AssetViewModel
  projectId?: string
}>()

const fileInput = ref<HTMLInputElement>()

watch(() => props.vm.filterType.value, () => {
  props.vm.loadResources(props.projectId, props.vm.filterType.value || undefined)
}, { immediate: true })

function handleUpload() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !props.projectId) return

  const type = guessResourceType(file.type)

  try {
    await props.vm.uploadResource(props.projectId, file, type)
    ElMessage.success(`${file.name} 上传成功`)
  } catch (e) {
    console.error('上传资源失败', e)
    ElMessage.error(`${file.name} 上传失败`)
  } finally {
    target.value = ''
  }
}

function guessResourceType(mimeType: string): 'panorama' | 'image' | 'video' | 'audio' {
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'image'
}

function handleSelect(_resource: Resource) {
  // 资源选择逻辑
}
</script>

<style scoped>
.asset-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.grid-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.grid-filter {
  padding: 8px 12px;
}

.grid-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  align-content: start;
}

.asset-item {
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: background 0.15s;
}

.asset-item:hover {
  background: var(--bg-hover);
}

.asset-thumb {
  width: 100%;
  aspect-ratio: 4/3;
  background-color: var(--bg-tertiary);
  background-size: cover;
  background-position: center;
  position: relative;
}

.asset-type-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 10px;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 6px;
  border-radius: 3px;
}

.asset-name {
  display: block;
  padding: 4px 6px;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-empty {
  grid-column: 1 / -1;
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.upload-progress {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.upload-label {
  display: block;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
</style>
