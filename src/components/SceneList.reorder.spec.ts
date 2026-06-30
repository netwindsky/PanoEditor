import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import type { Scene } from '@/types'

// draggable stub：渲染列表，暴露 @update:modelValue 和 @end 事件
const draggableStub = {
  name: 'draggable',
  props: ['modelValue', 'itemKey'],
  emits: ['update:modelValue', 'end'],
  template: `
    <div class="drag-area" data-testid="drag-area">
      <div
        v-for="(item, index) in modelValue"
        :key="item[itemKey]"
        :data-id="item[itemKey]"
        :data-index="index"
        class="drag-item"
      >
        <slot :item="item" :index="index" />
      </div>
    </div>
  `,
}

const globalStubs = {
  draggable: draggableStub,
  'el-button': {
    template: '<button v-bind="$attrs"><slot /></button>',
    inheritAttrs: false,
  },
  'el-icon': { template: '<span><slot /></span>' },
  'el-dropdown': {
    template: '<div class="dropdown"><slot /><slot name="dropdown" /></div>',
  },
  'el-dropdown-menu': { template: '<div class="dropdown-menu"><slot /></div>' },
  'el-dropdown-item': {
    props: ['command'],
    template: '<div class="dropdown-item"><slot /></div>',
  },
  'el-progress': { template: '<div class="progress" />', props: ['percentage', 'strokeWidth', 'showText', 'status'] },
  'el-alert': { template: '<div class="alert" />', props: ['title', 'type', 'closable'] },
  Plus: { template: '<span>+</span>' },
}

function makeScene(id: string, name: string, sortOrder: number): Scene {
  return {
    id,
    projectId: 'p1',
    name,
    title: name,
    previewUrl: '',
    thumbUrl: '',
    imageConfig: '',
    status: 'READY',
    initialView: { hfov: 100, pitch: 0, yaw: 0 },
    sortOrder,
    createdAt: '',
    updatedAt: '',
  } as Scene
}

function makeViewModel(scenes: Scene[]) {
  const scenesRef = ref(scenes)
  return {
    scenes: scenesRef,
    currentScene: ref<Scene | null>(scenes[0] ?? null),
    isUploading: ref(false),
    uploading: ref(false),
    uploadProgress: ref(0),
    batchUploading: ref(false),
    batchUploadCurrent: ref(0),
    batchUploadTotal: ref(0),
    batchUploadFailed: ref([]),
    uploadError: ref(''),
    tilingStatusMap: new Map(),
    deleteScene: vi.fn(),
    uploadPanorama: vi.fn(),
    uploadPanoramas: vi.fn(),
    reorderScenes: vi.fn().mockResolvedValue(undefined),
  }
}

import SceneList from '@/components/SceneList.vue'

describe('SceneList — 拖拽排序', () => {
  it('渲染所有场景', async () => {
    const vm = makeViewModel([
      makeScene('s1', '场景A', 0),
      makeScene('s2', '场景B', 1),
      makeScene('s3', '场景C', 2),
    ])
    const wrapper = mount(SceneList, {
      props: { viewModel: vm as any, projectId: 'p1' },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    const items = wrapper.findAll('.drag-item')
    expect(items).toHaveLength(3)
    expect(items[0].attributes('data-id')).toBe('s1')
    expect(items[1].attributes('data-id')).toBe('s2')
    expect(items[2].attributes('data-id')).toBe('s3')
  })

  it('拖拽后调用 reorderScenes 传递新顺序', async () => {
    const scenes = [
      makeScene('s1', '场景A', 0),
      makeScene('s2', '场景B', 1),
      makeScene('s3', '场景C', 2),
    ]
    const vm = makeViewModel(scenes)
    const wrapper = mount(SceneList, {
      props: { viewModel: vm as any, projectId: 'p1' },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    // 模拟拖拽：将 s1 从位置 0 移到位置 2 → 新顺序 [B, C, A]
    const newOrder = [scenes[1], scenes[2], scenes[0]]
    const dragArea = wrapper.findComponent({ name: 'draggable' })
    await dragArea.vm.$emit('update:modelValue', newOrder)
    await dragArea.vm.$emit('end', { oldIndex: 0, newIndex: 2 })
    await flushPromises()

    expect(vm.reorderScenes).toHaveBeenCalledTimes(1)
    const callArgs = vm.reorderScenes.mock.calls[0][0]
    expect(callArgs).toEqual([
      { id: 's2', sortOrder: 0 },
      { id: 's3', sortOrder: 1 },
      { id: 's1', sortOrder: 2 },
    ])
  })

  it('拖拽后更新本地列表顺序', async () => {
    const scenes = [
      makeScene('s1', '场景A', 0),
      makeScene('s2', '场景B', 1),
      makeScene('s3', '场景C', 2),
    ]
    const vm = makeViewModel(scenes)
    const wrapper = mount(SceneList, {
      props: { viewModel: vm as any, projectId: 'p1' },
      global: { stubs: globalStubs },
    })
    await flushPromises()

    // 模拟拖拽：s3 从位置 2 移到位置 0 → 新顺序 [C, A, B]
    const newOrder = [scenes[2], scenes[0], scenes[1]]
    const dragArea = wrapper.findComponent({ name: 'draggable' })
    await dragArea.vm.$emit('update:modelValue', newOrder)
    await dragArea.vm.$emit('end', { oldIndex: 2, newIndex: 0 })
    await flushPromises()

    // 本地列表应反映新顺序
    const items = wrapper.findAll('.drag-item')
    expect(items[0].attributes('data-id')).toBe('s3')
    expect(items[1].attributes('data-id')).toBe('s1')
    expect(items[2].attributes('data-id')).toBe('s2')
  })
})
