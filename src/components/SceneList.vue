<template>
  <div class="scene-list">
    <div class="list-header">
      <span class="list-title">场景列表</span>
      <el-button text size="small" @click="handleAdd" :loading="vm.isUploading.value">
        <el-icon v-if="!vm.isUploading.value"><Plus /></el-icon>
      </el-button>
    </div>

    <!-- 单文件上传进度条 -->
    <div v-if="vm.uploading.value" class="upload-progress">
      <el-progress 
        :percentage="vm.uploadProgress.value" 
        :stroke-width="4" 
        :show-text="true"
        status="success"
      />
      <span class="upload-label">上传中 {{ vm.uploadProgress.value }}%</span>
    </div>

    <!-- 批量上传进度 -->
    <div v-if="vm.batchUploading.value" class="upload-progress">
      <el-progress 
        :percentage="Math.round((vm.batchUploadCurrent.value / vm.batchUploadTotal.value) * 100)" 
        :stroke-width="4" 
        :show-text="true"
        status="success"
      />
      <span class="upload-label">上传中 {{ vm.batchUploadCurrent.value }} / {{ vm.batchUploadTotal.value }}</span>
    </div>
    
    <!-- 上传错误提示 -->
    <div v-if="vm.uploadError.value" class="upload-error">
      <el-alert :title="vm.uploadError.value" type="error" :closable="false" />
    </div>

    <div class="list-content">
      <draggable
        v-model="localScenes"
        item-key="id"
        :animation="200"
        handle=".scene-item"
        @end="handleDragEnd"
      >
        <template #item="{ element }">
          <div
            :class="['scene-item', { active: vm.currentScene.value?.id === element.id }]"
            @click="emit('select', element.id)"
          >
            <div
              class="scene-thumb"
              :style="{ backgroundImage: 'url(' + (element.thumbUrl || element.previewUrl) + ')' }"
            />
            <div class="scene-info">
              <span class="scene-name">{{ element.name }}</span>
              <span class="scene-meta">
                <template v-if="getTilingStatus(element.id)?.status === 'PROCESSING'">
                  <span class="tiling-status processing">
                    切片中 {{ getTilingStatus(element.id)?.progress }}%
                  </span>
                </template>
                <template v-else-if="getTilingStatus(element.id)?.status === 'PENDING'">
                  <span class="tiling-status pending">等待处理</span>
                </template>
                <template v-else-if="getTilingStatus(element.id)?.status === 'FAILED'">
                  <span class="tiling-status failed">处理失败</span>
                </template>
                <template v-else>
                  {{ element.hotspotCount || 0 }} 个热点
                </template>
              </span>
            </div>
            <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, element.id)">
              <el-button text size="small" class="scene-more" @click.stop>...</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">重命名</el-dropdown-item>
                  <el-dropdown-item command="delete" style="color: var(--danger)">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </draggable>

      <div v-if="localScenes.length === 0 && !vm.isUploading.value" class="list-empty">
        暂无场景，点击 + 上传全景图创建
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      multiple
      style="display: none"
      accept="image/*"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { SceneViewModel } from '@/viewmodels/SceneViewModel'
import type { Scene } from '@/types'

const props = defineProps<{
  viewModel: SceneViewModel
  projectId?: string
}>()

const emit = defineEmits<{
  (e: 'select', sceneId: string): void
}>()

const vm = props.viewModel
const fileInput = ref<HTMLInputElement>()

// 本地排序列表，与 viewModel.scenes 同步
const localScenes = ref<Scene[]>([...vm.scenes.value])

watch(
  () => vm.scenes.value,
  (newScenes) => {
    localScenes.value = [...newScenes]
  },
  { immediate: true },
)

function handleDragEnd() {
  const reordered = localScenes.value.map((s, i) => ({ id: s.id, sortOrder: i }))
  vm.reorderScenes(reordered)
}

function getTilingStatus(sceneId: string) {
  return vm.tilingStatusMap.get(sceneId)
}

function handleAdd() {
  fileInput.value?.click()
}

function handleCommand(command: string, sceneId: string) {
  if (command === 'delete') {
    vm.deleteScene(sceneId)
  } else if (command === 'rename') {
    // TODO: 显示重命名对话框
  }
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  if (files.length === 0) return

  // 过滤非图片文件
  const imageFiles = files.filter((file) => file.type.startsWith('image/'))
  const nonImageCount = files.length - imageFiles.length
  if (nonImageCount > 0) {
    ElMessage.warning(`已过滤 ${nonImageCount} 个非图片文件`)
  }

  if (imageFiles.length === 0) {
    target.value = ''
    return
  }

  if (!props.projectId) {
    ElMessage.error('未选择项目')
    target.value = ''
    return
  }

  try {
    if (imageFiles.length === 1) {
      // 单文件上传，使用原有逻辑
      console.log('[SceneList] Starting upload for file:', imageFiles[0].name)
      await vm.uploadPanorama(props.projectId, imageFiles[0])
      ElMessage.success('上传成功')
    } else {
      // 批量上传
      console.log('[SceneList] Starting batch upload for', imageFiles.length, 'files')
      await vm.uploadPanoramas(props.projectId, imageFiles)
      const failedCount = vm.batchUploadFailed.value.length
      if (failedCount > 0) {
        ElMessage.warning(`${imageFiles.length - failedCount} 个文件上传成功，${failedCount} 个失败`)
      } else {
        ElMessage.success(`${imageFiles.length} 个文件上传成功`)
      }
    }
  } catch (error: any) {
    console.error('[SceneList] Upload failed:', error)
    ElMessage.error(vm.uploadError.value || '上传失败')
  } finally {
    target.value = ''
  }
}
</script>

<style scoped>
.scene-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.list-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.list-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.scene-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.scene-item:hover {
  background: var(--bg-hover);
}

.scene-item.active {
  background: var(--bg-active);
}

.scene-thumb {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}

.scene-info {
  flex: 1;
  min-width: 0;
}

.scene-name {
  display: block;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scene-meta {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
}

.tiling-status {
  font-size: 11px;
}

.tiling-status.processing {
  color: var(--warning);
}

.tiling-status.pending {
  color: var(--info);
}

.tiling-status.failed {
  color: var(--danger);
}

.scene-more {
  flex-shrink: 0;
}

.list-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.upload-progress {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.upload-label {
  display: block;
  text-align: center;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.upload-error {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}
</style>
