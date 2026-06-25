<template>
  <div class="audio-settings">
    <div class="prop-section">
      <div class="section-title">背景音乐</div>
      <div class="prop-row">
        <label>音乐文件</label>
        <el-input v-model="form.backgroundMusicUrl" size="small" placeholder="音频URL" @change="handleUpdate" />
      </div>
      <div class="prop-row">
        <label>音量</label>
        <el-slider v-model="form.backgroundMusicVolume" :min="0" :max="100" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.backgroundMusicVolume }}%</span>
      </div>
      <div class="prop-row">
        <label>循环播放</label>
        <el-switch v-model="form.backgroundMusicLoop" size="small" @change="handleUpdate" />
      </div>
    </div>
    <div class="prop-section">
      <div class="section-title">旁白</div>
      <div class="prop-row">
        <label>旁白文件</label>
        <el-input v-model="form.narrationUrl" size="small" placeholder="音频URL" @change="handleUpdate" />
      </div>
      <div class="prop-row">
        <label>音量</label>
        <el-slider v-model="form.narrationVolume" :min="0" :max="100" size="small" @change="handleUpdate" />
        <span class="prop-value">{{ form.narrationVolume }}%</span>
      </div>
      <div class="prop-row">
        <label>自动播放</label>
        <el-switch v-model="form.narrationAutoPlay" size="small" @change="handleUpdate" />
      </div>
    </div>
    <div class="prop-section">
      <el-button size="small" @click="editorStore.setRightPanelSection('scene')">返回场景属性</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useSceneStore } from '@/stores/scene'
import { useEditorStore } from '@/stores/editor'

const sceneStore = useSceneStore()
const editorStore = useEditorStore()

const form = reactive({
  backgroundMusicUrl: '',
  backgroundMusicVolume: 50,
  backgroundMusicLoop: true,
  narrationUrl: '',
  narrationVolume: 80,
  narrationAutoPlay: false,
})

watch(
  () => sceneStore.currentScene,
  () => {
    // 后端不支持音频设置 API，使用本地默认值
    form.backgroundMusicUrl = ''
    form.backgroundMusicVolume = 50
    form.backgroundMusicLoop = true
    form.narrationUrl = ''
    form.narrationVolume = 80
    form.narrationAutoPlay = false
  },
  { immediate: true },
)

function handleUpdate() {
  // 后端不支持音频设置 API，仅更新本地状态
  editorStore.markDirty()
}
</script>

<style scoped>
.audio-settings {
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

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.prop-row label {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 60px;
  flex-shrink: 0;
}

.prop-row .el-input {
  flex: 1;
}

.prop-row .el-slider {
  flex: 1;
}

.prop-value {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 40px;
  text-align: right;
}
</style>
