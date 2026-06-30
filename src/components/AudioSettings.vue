<template>
  <div class="audio-settings">
    <!-- 背景音乐 -->
    <div class="prop-section">
      <div class="section-title">背景音乐</div>
      <div class="prop-row">
        <label>音乐文件</label>
        <el-input
          v-model="form.backgroundMusicUrl"
          data-testid="bg-music-url"
          size="small"
          placeholder="音频URL"
          @change="handleUpdate"
        />
      </div>
      <div class="prop-row">
        <label>音量</label>
        <el-slider
          v-model="form.backgroundMusicVolume"
          data-testid="bg-music-volume"
          :min="0"
          :max="100"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.backgroundMusicVolume }}%</span>
      </div>
      <div class="prop-row">
        <label>循环播放</label>
        <el-switch
          v-model="form.backgroundMusicLoop"
          data-testid="bg-music-loop"
          @change="handleUpdate"
        />
      </div>
    </div>

    <!-- 旁白 -->
    <div class="prop-section">
      <div class="section-title">旁白</div>
      <div class="prop-row">
        <label>旁白文件</label>
        <el-input
          v-model="form.narrationUrl"
          data-testid="narration-url"
          size="small"
          placeholder="音频URL"
          @change="handleUpdate"
        />
      </div>
      <div class="prop-row">
        <label>音量</label>
        <el-slider
          v-model="form.narrationVolume"
          data-testid="narration-volume"
          :min="0"
          :max="100"
          size="small"
          @change="handleUpdate"
        />
        <span class="prop-value">{{ form.narrationVolume }}%</span>
      </div>
      <div class="prop-row">
        <label>自动播放</label>
        <el-switch
          v-model="form.narrationAutoPlay"
          data-testid="narration-autoplay"
          @change="handleUpdate"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="prop-section">
      <el-button size="small" data-testid="reset-btn" @click="resetForm">重置</el-button>
      <el-button size="small" @click="editorStore.setRightPanelSection('scene')">返回场景属性</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, onBeforeUnmount } from 'vue'
import { useSceneStore } from '@/stores/scene'
import { useEditorStore } from '@/stores/editor'
import { getAudioSettings, updateAudioSettings } from '@/api/audio'
import type { UpdateAudioSettingsParams } from '@/types'

const sceneStore = useSceneStore()
const editorStore = useEditorStore()

const defaults = {
  backgroundMusicUrl: '',
  backgroundMusicVolume: 50,
  backgroundMusicLoop: true,
  narrationUrl: '',
  narrationVolume: 80,
  narrationAutoPlay: false,
}

const form = reactive({ ...defaults })

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleUpdate() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    doUpdate()
  }, 300)
}

async function doUpdate() {
  if (!sceneStore.currentScene) return
  const params: UpdateAudioSettingsParams = {
    backgroundMusicUrl: form.backgroundMusicUrl,
    backgroundMusicVolume: form.backgroundMusicVolume,
    backgroundMusicLoop: form.backgroundMusicLoop,
    narrationUrl: form.narrationUrl,
    narrationVolume: form.narrationVolume,
    narrationAutoPlay: form.narrationAutoPlay,
  }
  await updateAudioSettings(sceneStore.currentScene.id, params)
  editorStore.markDirty()
}

async function handleUpdate() {
  scheduleUpdate()
}

function resetForm() {
  Object.assign(form, defaults)
  handleUpdate()
}

watch(
  () => sceneStore.currentScene,
  async (scene) => {
    if (scene) {
      try {
        const res = await getAudioSettings(scene.id)
        const data = res.data.data
        if (data) {
          Object.assign(form, {
            backgroundMusicUrl: data.backgroundMusicUrl ?? defaults.backgroundMusicUrl,
            backgroundMusicVolume: data.backgroundMusicVolume ?? defaults.backgroundMusicVolume,
            backgroundMusicLoop: data.backgroundMusicLoop ?? defaults.backgroundMusicLoop,
            narrationUrl: data.narrationUrl ?? defaults.narrationUrl,
            narrationVolume: data.narrationVolume ?? defaults.narrationVolume,
            narrationAutoPlay: data.narrationAutoPlay ?? defaults.narrationAutoPlay,
          })
        } else {
          Object.assign(form, defaults)
        }
      } catch {
        Object.assign(form, defaults)
      }
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
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
