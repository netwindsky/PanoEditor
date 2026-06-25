<template>
  <div class="scene-list">
    <div class="list-header">
      <span class="list-title">场景列表</span>
      <el-button text size="small" @click="handleAdd" :loading="vm.uploading.value">
        <el-icon v-if="!vm.uploading.value"><Plus /></el-icon>
      </el-button>
    </div>

    <!-- 上传进度条 -->
    <div v-if="vm.uploading.value" class="upload-progress">
      <el-progress 
        :percentage="vm.uploadProgress.value" 
        :stroke-width="4" 
        :show-text="true"
        status="success"
      />
      <span class="upload-label">上传中 {{ vm.uploadProgress.value }}%</span>
    </div>
    
    <!-- 上传错误提示 -->
    <div v-if="vm.uploadError.value" class="upload-error">
      <el-alert :title="vm.uploadError.value" type="error" :closable="false" />
    </div>

    <div class="list-content">
      <div
        v-for="scene in vm.scenes.value"
        :key="scene.id"
        :class="['scene-item', { active: vm.currentScene.value?.id === scene.id }]"
        @click="vm.selectScene(scene.id)"
      >
        <div
          class="scene-thumb"
          :style="{ backgroundImage: 'url(' + (scene.thumbUrl || scene.previewUrl) + ')' }"
        />
        <div class="scene-info">
          <span class="scene-name">{{ scene.name }}</span>
          <span class="scene-meta">
            <template v-if="getTilingStatus(scene.id)?.status === 'PROCESSING'">
              <span class="tiling-status processing">
                切片中 {{ getTilingStatus(scene.id)?.progress }}%
              </span>
            </template>
            <template v-else-if="getTilingStatus(scene.id)?.status === 'PENDING'">
              <span class="tiling-status pending">等待处理</span>
            </template>
            <template v-else-if="getTilingStatus(scene.id)?.status === 'FAILED'">
              <span class="tiling-status failed">处理失败</span>
            </template>
            <template v-else>
              {{ scene.hotspotCount || 0 }} 个热点
            </template>
          </span>
        </div>
        <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, scene.id)">
          <el-button text size="small" class="scene-more" @click.stop>...</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="rename">重命名</el-dropdown-item>
              <el-dropdown-item command="delete" style="color: var(--danger)">删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div v-if="vm.scenes.value.length === 0 && !vm.uploading.value" class="list-empty">
        暂无场景，点击 + 上传全景图创建
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      style="display: none"
      accept="image/*"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { SceneViewModel } from '@/viewmodels/SceneViewModel'

const props = defineProps<{
  viewModel: SceneViewModel
  projectId?: string
}>()

const vm = props.viewModel
const fileInput = ref<HTMLInputElement>()

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
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    target.value = ''
    return
  }

  if (!props.projectId) {
    ElMessage.error('未选择项目')
    target.value = ''
    return
  }

  try {
    console.log('[SceneList] Starting upload for file:', file.name)
    await vm.uploadPanorama(props.projectId, file)
    ElMessage.success('上传成功')
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
