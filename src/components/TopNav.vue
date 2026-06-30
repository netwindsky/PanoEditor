<template>
  <header class="top-nav">
    <div class="nav-left">
      <div class="logo">
        <span class="logo-icon">◎</span>
        <span class="logo-text">PanoEditor</span>
      </div>
      <nav class="nav-links">
        <a href="#" class="nav-link">查看器</a>
        <a href="#" class="nav-link active">编辑器</a>
        <a href="#" class="nav-link">后台管理</a>
      </nav>
    </div>
    <div class="nav-right">
      <el-button size="small" @click="showProjectModal = true">
        <el-icon><FolderOpened /></el-icon>
        项目
      </el-button>
      <el-button size="small" type="primary" :loading="vm.isSaving.value" @click="handleSave">
        <el-icon><DocumentChecked /></el-icon>
        保存
      </el-button>
      <el-button size="small" @click="handlePreview">
        <el-icon><View /></el-icon>
        预览
      </el-button>
      <el-button size="small" type="success" @click="handlePublish">
        <el-icon><Upload /></el-icon>
        发布
      </el-button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { FolderOpened, DocumentChecked, View, Upload } from '@element-plus/icons-vue'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'

const props = defineProps<{
  vm: EditorViewModel
}>()

const showProjectModal = defineModel<boolean>({ default: false })

async function handleSave() {
  await props.vm.save()
}

function handlePreview() {
  const projectId = props.vm.sceneViewModel.currentScene.value?.projectId
  if (!projectId) {
    console.warn('预览失败：未获取到项目ID')
    return
  }
  // 开发环境查看器在 5001 端口，生产环境使用同域名相对路径
  const viewerBase = import.meta.env.DEV ? 'http://localhost:5001' : ''
  window.open(`${viewerBase}/${projectId}`, '_blank')
}

async function handlePublish() {
  // TODO: 实现发布
}
</script>

<style scoped>
.top-nav {
  height: var(--navbar-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 20px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.nav-links {
  display: flex;
  gap: 16px;
}

.nav-link {
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
}

.nav-link.active {
  color: var(--accent);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
