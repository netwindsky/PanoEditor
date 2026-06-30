import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import HotspotProperties from '@/components/HotspotProperties.vue'
import type { Hotspot, Scene, Resource } from '@/types'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))

function createMockViewModel(eventsValue?: string) {
  const hotspots = ref<Hotspot[]>([
    {
      id: 'h1',
      sceneId: 's1',
      name: '测试热点',
      type: 'image',
      ath: 45,
      atv: 10,
      url: 'https://example.com/image.jpg',
      events: eventsValue,
    },
  ])
  const selectedHotspot = ref<Hotspot | null>(hotspots.value[0])
  const scenes = ref<Scene[]>([
    { id: 's1', projectId: 'p1', name: '场景1', previewUrl: '', thumbUrl: '', imageConfig: '', status: '', initialView: { hfov: 120, pitch: 0, yaw: 0 }, sortOrder: 0, createdAt: '', updatedAt: '' },
  ])
  const resources = ref<Resource[]>([])

  const vm = {
    hotspotViewModel: {
      hotspots,
      selectedHotspot,
      selectHotspot: vi.fn((id: string) => {
        selectedHotspot.value = hotspots.value.find(h => h.id === id) || null
      }),
      deleteHotspot: vi.fn(),
      clearHotspots: vi.fn(),
      createHotspot: vi.fn(),
      updateHotspot: vi.fn(),
      previewHotspotStyle: vi.fn(),
      isDragging: ref(false),
    },
    sceneViewModel: { scenes, currentScene: ref(scenes.value[0]) },
    assetViewModel: { resources, loadResources: vi.fn(), uploadResource: vi.fn() },
    currentProject: ref({ id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' }),
    addHotspot: vi.fn(),
    removeHotspot: vi.fn(),
    clearAllHotspots: vi.fn(),
    updateHotspot: vi.fn(async (hotspotId: string, params: Record<string, unknown>) => {
      const index = hotspots.value.findIndex((h) => h.id === hotspotId)
      if (index !== -1) {
        hotspots.value[index] = { ...hotspots.value[index], ...params } as Hotspot
        if (selectedHotspot.value?.id === hotspotId) {
          selectedHotspot.value = hotspots.value[index]
        }
      }
    }),
    uploadResource: vi.fn(),
  }
  return { vm, hotspots, selectedHotspot }
}

const stubs = {
  'el-button': { template: '<button v-bind="$attrs"><slot /></button>', inheritAttrs: false },
  'el-input': {
    template: '<input v-if="type !== \'textarea\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><textarea v-else :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\', $event.target.value)"></textarea>',
    props: ['modelValue', 'size', 'placeholder', 'type', 'rows', 'disabled'],
    emits: ['update:modelValue', 'change'],
  },
  'el-input-number': {
    template: '<input :value="modelValue" type="number" @input="$emit(\'update:modelValue\', parseFloat($event.target.value))" />',
    props: ['modelValue', 'size', 'step', 'precision', 'min', 'disabled', 'controlsPosition', 'placeholder'],
    emits: ['update:modelValue'],
  },
  'el-select': {
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot /></select>',
    props: ['modelValue', 'size', 'placeholder', 'clearable', 'disabled'],
    emits: ['update:modelValue', 'change'],
  },
  'el-option': { template: '<option :value="value"><slot /></option>', props: ['label', 'value'] },
  'el-icon': { template: '<span><slot /></span>' },
  'el-dialog': { template: '<div v-if="modelValue"><slot /></div>', props: ['modelValue', 'title', 'width'] },
  'el-alert': { template: '<div class="el-alert" />', props: ['title', 'type', 'closable'] },
}

function mountComponent(vm: any) {
  return mount(HotspotProperties, { global: { provide: { editorViewModel: vm }, stubs } })
}

describe('HotspotProperties — events JSON 编辑', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('渲染时从 hotspot.events 初始化 events textarea', async () => {
    const { vm } = createMockViewModel('{"click":"myFunc()"}')
    const wrapper = mountComponent(vm)
    await flushPromises()

    const eventsSection = wrapper.find('[data-testid="events-section"]')
    expect(eventsSection.exists()).toBe(true)

    const textarea = eventsSection.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect(textarea.element.value).toBe('{"click":"myFunc()"}')
  })

  it('修改 events 后触发 updateHotspot 携带 events', async () => {
    const { vm } = createMockViewModel('')
    const wrapper = mountComponent(vm)
    await flushPromises()

    const textarea = wrapper.find('[data-testid="events-section"] textarea')
    await textarea.setValue('{"hover":"showTip()"}')
    await textarea.trigger('change')

    vi.advanceTimersByTime(500)
    await flushPromises()

    expect(vm.updateHotspot).toHaveBeenCalled()
    const lastCall = vm.updateHotspot.mock.calls[vm.updateHotspot.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('events', '{"hover":"showTip()"}')
  })

  it('输入无效 JSON 时显示错误提示', async () => {
    const { vm } = createMockViewModel('')
    const wrapper = mountComponent(vm)
    await flushPromises()

    const textarea = wrapper.find('[data-testid="events-section"] textarea')
    await textarea.setValue('invalid json')
    await textarea.trigger('change')

    // 应显示 JSON 格式错误提示
    const errorHint = wrapper.find('[data-testid="events-error"]')
    expect(errorHint.exists()).toBe(true)
  })

  it('输入有效 JSON 时不显示错误提示', async () => {
    const { vm } = createMockViewModel('')
    const wrapper = mountComponent(vm)
    await flushPromises()

    const textarea = wrapper.find('[data-testid="events-section"] textarea')
    await textarea.setValue('{"click":"func()"}')
    await textarea.trigger('change')

    const errorHint = wrapper.find('[data-testid="events-error"]')
    expect(errorHint.exists()).toBe(false)
  })

  it('events 为空时不显示错误提示', async () => {
    const { vm } = createMockViewModel('')
    const wrapper = mountComponent(vm)
    await flushPromises()

    const errorHint = wrapper.find('[data-testid="events-error"]')
    expect(errorHint.exists()).toBe(false)
  })
})
