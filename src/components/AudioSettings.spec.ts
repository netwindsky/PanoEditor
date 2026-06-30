import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import AudioSettingsComp from '@/components/AudioSettings.vue'
import type { AudioSettings } from '@/types'

// --- Mock stores (hoisted reactive to avoid cross-test leak) ---
const { mockSceneStore, mockEditorStore } = vi.hoisted(() => {
  const { reactive } = require('vue') as typeof import('vue')
  return {
    mockSceneStore: reactive({
      currentScene: { id: 'scene-1' } as { id: string } | null,
    }),
    mockEditorStore: reactive({
      markDirty: vi.fn(),
      setRightPanelSection: vi.fn(),
    }),
  }
})

vi.mock('@/stores/scene', () => ({
  useSceneStore: () => mockSceneStore,
}))
vi.mock('@/stores/editor', () => ({
  useEditorStore: () => mockEditorStore,
}))

// --- Mock API ---
const mockGetAudioSettings = vi.fn()
const mockUpdateAudioSettings = vi.fn()

vi.mock('@/api/audio', () => ({
  getAudioSettings: (...args: unknown[]) => mockGetAudioSettings(...args),
  updateAudioSettings: (...args: unknown[]) => mockUpdateAudioSettings(...args),
}))

// --- Stubs ---
const stubs = {
  'el-input': {
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\')" />',
    props: ['modelValue', 'size', 'placeholder'],
    emits: ['update:modelValue', 'change'],
  },
  'el-slider': {
    template: '<input type="range" :value="modelValue" @input="$emit(\'update:modelValue\', parseFloat($event.target.value))" @change="$emit(\'change\')" />',
    props: ['modelValue', 'min', 'max', 'step', 'size'],
    emits: ['update:modelValue', 'change'],
  },
  'el-switch': {
    template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked); $emit(\'change\', $event.target.checked)" />',
    props: ['modelValue'],
    emits: ['update:modelValue', 'change'],
  },
  'el-button': { template: '<button v-bind="$attrs"><slot /></button>', inheritAttrs: false },
  'el-icon': { template: '<span><slot /></span>' },
}

function makeAudioSettings(overrides: Partial<AudioSettings> = {}): AudioSettings {
  return {
    sceneId: 'scene-1',
    backgroundMusicUrl: '',
    backgroundMusicVolume: 50,
    backgroundMusicLoop: true,
    narrationUrl: '',
    narrationVolume: 80,
    narrationAutoPlay: false,
    ...overrides,
  }
}

let wrapper: ReturnType<typeof mount> | null = null

function mountComponent() {
  wrapper = mount(AudioSettingsComp, { global: { stubs } })
  return wrapper
}

describe('AudioSettings — API 持久化集成', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockSceneStore.currentScene = { id: 'scene-1' }
    mockGetAudioSettings.mockResolvedValue({ data: { data: makeAudioSettings() } })
    mockUpdateAudioSettings.mockResolvedValue({ data: { data: makeAudioSettings() } })
  })
  afterEach(() => {
    if (wrapper) { wrapper.unmount(); wrapper = null }
    vi.useRealTimers()
  })

  it('挂载时调用 getAudioSettings 加载当前场景音频配置', async () => {
    mountComponent()
    await flushPromises()

    expect(mockGetAudioSettings).toHaveBeenCalledWith('scene-1')
  })

  it('从API响应初始化表单字段', async () => {
    const config = makeAudioSettings({
      backgroundMusicUrl: 'https://example.com/music.mp3',
      backgroundMusicVolume: 75,
      backgroundMusicLoop: false,
      narrationUrl: 'https://example.com/narration.mp3',
      narrationVolume: 90,
      narrationAutoPlay: true,
    })
    mockGetAudioSettings.mockResolvedValue({ data: { data: config } })

    const w = mountComponent()
    await flushPromises()

    const bgUrlInput = w.find('[data-testid="bg-music-url"]')
    expect(bgUrlInput.attributes('value') || (bgUrlInput.element as HTMLInputElement).value).toBe('https://example.com/music.mp3')

    const bgVolSlider = w.find('[data-testid="bg-music-volume"]')
    expect(bgVolSlider.attributes('value') || (bgVolSlider.element as HTMLInputElement).value).toBe('75')
  })

  it('修改背景音乐URL触发 updateAudioSettings', async () => {
    const w = mountComponent()
    await flushPromises()

    const bgUrlInput = w.find('[data-testid="bg-music-url"]')
    await bgUrlInput.setValue('https://example.com/new.mp3')
    await bgUrlInput.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateAudioSettings).toHaveBeenCalled()
    const lastCall = mockUpdateAudioSettings.mock.calls[mockUpdateAudioSettings.mock.calls.length - 1]
    expect(lastCall[0]).toBe('scene-1')
    expect(lastCall[1]).toHaveProperty('backgroundMusicUrl', 'https://example.com/new.mp3')
  })

  it('修改音量触发 updateAudioSettings', async () => {
    const w = mountComponent()
    await flushPromises()

    const bgVolSlider = w.find('[data-testid="bg-music-volume"]')
    await bgVolSlider.setValue(60)
    await bgVolSlider.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateAudioSettings).toHaveBeenCalled()
    const lastCall = mockUpdateAudioSettings.mock.calls[mockUpdateAudioSettings.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('backgroundMusicVolume', 60)
  })

  it('切换循环播放触发 updateAudioSettings', async () => {
    const w = mountComponent()
    await flushPromises()

    const loopSwitch = w.find('[data-testid="bg-music-loop"]')
    await loopSwitch.setValue(false)
    await loopSwitch.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateAudioSettings).toHaveBeenCalled()
    const lastCall = mockUpdateAudioSettings.mock.calls[mockUpdateAudioSettings.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('backgroundMusicLoop', false)
  })

  it('修改旁白URL触发 updateAudioSettings', async () => {
    const w = mountComponent()
    await flushPromises()

    const narrationInput = w.find('[data-testid="narration-url"]')
    await narrationInput.setValue('https://example.com/voice.mp3')
    await narrationInput.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateAudioSettings).toHaveBeenCalled()
    const lastCall = mockUpdateAudioSettings.mock.calls[mockUpdateAudioSettings.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('narrationUrl', 'https://example.com/voice.mp3')
  })

  it('切换旁白自动播放触发 updateAudioSettings', async () => {
    const w = mountComponent()
    await flushPromises()

    const autoPlaySwitch = w.find('[data-testid="narration-autoplay"]')
    await autoPlaySwitch.setValue(true)
    await autoPlaySwitch.trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mockUpdateAudioSettings).toHaveBeenCalled()
    const lastCall = mockUpdateAudioSettings.mock.calls[mockUpdateAudioSettings.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('narrationAutoPlay', true)
  })

  it('无当前场景时不调用API', async () => {
    mockSceneStore.currentScene = null
    mountComponent()
    await flushPromises()

    expect(mockGetAudioSettings).not.toHaveBeenCalled()
  })

  it('API加载失败时使用默认值', async () => {
    mockGetAudioSettings.mockRejectedValue(new Error('404'))
    const w = mountComponent()
    await flushPromises()

    const bgVolSlider = w.find('[data-testid="bg-music-volume"]')
    const val = bgVolSlider.attributes('value') || (bgVolSlider.element as HTMLInputElement).value
    expect(val).toBe('50') // 默认值
  })
})
