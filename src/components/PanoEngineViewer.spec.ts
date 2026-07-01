import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { Hotspot } from '@/types'
import type { SceneData } from '@panoview'

// 收集所有被创建的 PanoEngineAdapter mock 实例，用于断言引擎最终收到的 syncHotspots 调用
const createdEngines: Array<{
  syncHotspots: ReturnType<typeof vi.fn>
  loadSceneConfig: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}> = []
let nextLoadScenePromise: Promise<void> | null = null

vi.mock('@/utils/PanoEngineAdapter', () => {
  class PanoEngineAdapterMock {
    syncHotspots = vi.fn()
    loadSceneConfig = vi.fn(() => nextLoadScenePromise ?? Promise.resolve())
    dispose = vi.fn()
    isDraggingMode = vi.fn(() => false)
    setDraggingMode = vi.fn()
    preloadScenes = vi.fn(() => Promise.resolve())
    switchScene = vi.fn(() => Promise.resolve())
    constructor(_container: HTMLElement) {
      createdEngines.push(this as never)
    }
  }
  return { PanoEngineAdapter: PanoEngineAdapterMock }
})

// 在 mock 之后再导入被测组件，确保组件拿到的是 mock 版 Adapter
import PanoEngineViewer from './PanoEngineViewer.vue'

function makeHotspot(id: string): Hotspot {
  return { id, sceneId: 's1', name: 'hs-' + id, type: 'info', ath: 0, atv: 0 } as Hotspot
}

function makeSceneData(name = 's1'): SceneData {
  return {
    scene: { name, title: name, onstart: '', thumburl: '', lat: '', lng: '', heading: '' },
    view: {
      hlookat: '0', vlookat: '0', fov: '90',
      fovtype: 'MFOV', fovmin: '70', fovmax: '140',
      maxpixelzoom: '2', limitview: 'auto',
    },
    image: { type: 'CUBE', multires: true, tilesize: '512', levels: [] },
    hotspots: [],
  } as unknown as SceneData
}

const VALID_SCENE = makeSceneData('s1')

function latestEngine() {
  return createdEngines[createdEngines.length - 1]
}

function lastSyncIds(engine: { syncHotspots: ReturnType<typeof vi.fn> }): string[] {
  const calls = engine.syncHotspots.mock.calls
  if (calls.length === 0) return []
  const arg = calls[calls.length - 1][0] as Hotspot[]
  return (arg ?? []).map((h) => h.id)
}

describe('PanoEngineViewer 热点同步竞态', () => {
  beforeEach(() => {
    createdEngines.length = 0
    nextLoadScenePromise = null
  })

  it('数据后到：引擎就绪后再填充 hotspots，引擎应收到最新热点', async () => {
    const wrapper = mount(PanoEngineViewer, {
      props: {
        sceneData: VALID_SCENE,
        tilingStatus: 'READY',
        tilingProgress: 100,
        hotspots: [] as Hotspot[],
      },
    })
    await flushPromises()

    const engine = latestEngine()
    expect(engine).toBeTruthy()

    await wrapper.setProps({ hotspots: [makeHotspot('a'), makeHotspot('b')] })
    await flushPromises()

    expect(lastSyncIds(engine)).toEqual(['a', 'b'])
  })

  it('引擎后到：数据先就绪，引擎创建后必须立即收到当前热点', async () => {
    const wrapper = mount(PanoEngineViewer, {
      props: {
        sceneData: null,
        tilingStatus: 'PROCESSING',
        tilingProgress: 0,
        hotspots: [makeHotspot('x')] as Hotspot[],
      },
    })
    await flushPromises()
    expect(createdEngines.length).toBe(0)

    await wrapper.setProps({ sceneData: VALID_SCENE, tilingStatus: 'READY' })
    await flushPromises()

    const engine = latestEngine()
    expect(engine).toBeTruthy()
    expect(lastSyncIds(engine)).toEqual(['x'])
  })

  it('初始空热点：引擎创建后即使外部热点为空，也必须收到 syncHotspots([]) 以清除 config 内嵌残留', async () => {
    mount(PanoEngineViewer, {
      props: {
        sceneData: VALID_SCENE,
        tilingStatus: 'READY',
        tilingProgress: 100,
        hotspots: [] as Hotspot[],
      },
    })
    await flushPromises()
    const engine = latestEngine()
    expect(engine).toBeTruthy()

    expect(engine.syncHotspots).toHaveBeenCalled()
    expect(lastSyncIds(engine)).toEqual([])
  })

  it('清空热点：hotspots 变为空数组时，引擎应收到空列表以清除残留热点', async () => {
    const wrapper = mount(PanoEngineViewer, {
      props: {
        sceneData: VALID_SCENE,
        tilingStatus: 'READY',
        tilingProgress: 100,
        hotspots: [makeHotspot('a')] as Hotspot[],
      },
    })
    await flushPromises()
    const engine = latestEngine()

    await wrapper.setProps({ hotspots: [] as Hotspot[] })
    await flushPromises()

    expect(lastSyncIds(engine)).toEqual([])
  })

  it('切换场景配置时应复用同一个引擎实例，不应 dispose 后重建', async () => {
    const wrapper = mount(PanoEngineViewer, {
      props: {
        sceneData: VALID_SCENE,
        tilingStatus: 'READY',
        tilingProgress: 100,
        hotspots: [] as Hotspot[],
      },
    })
    await flushPromises()

    const engine = latestEngine()
    expect(createdEngines.length).toBe(1)

    const nextScene = makeSceneData('s2')
    await wrapper.setProps({ sceneData: nextScene })
    await flushPromises()

    expect(createdEngines.length).toBe(1)
    expect(engine.dispose).not.toHaveBeenCalled()
    expect(engine.loadSceneConfig).toHaveBeenCalledTimes(2)
    expect(engine.loadSceneConfig).toHaveBeenLastCalledWith(nextScene)
  })

  it('应等待 loadSceneConfig 完成后才发送 engine-ready 并同步热点', async () => {
    let resolveLoad!: () => void
    nextLoadScenePromise = new Promise<void>((resolve) => {
      resolveLoad = resolve
    })
    const engineReady = vi.fn()

    mount(PanoEngineViewer, {
      props: {
        sceneData: VALID_SCENE,
        tilingStatus: 'READY',
        tilingProgress: 100,
        hotspots: [makeHotspot('awaited')] as Hotspot[],
      },
      attrs: {
        onEngineReady: engineReady,
      },
    })
    await flushPromises()

    const engine = latestEngine()
    expect(engine.loadSceneConfig).toHaveBeenCalled()
    expect(engineReady).not.toHaveBeenCalled()
    expect(engine.syncHotspots).not.toHaveBeenCalled()

    resolveLoad()
    await flushPromises()

    expect(engineReady).toHaveBeenCalledWith(engine)
    expect(lastSyncIds(engine)).toEqual(['awaited'])
  })

  it('加载中切换场景配置时应记住最新配置，首个加载完成后立即加载新场景，避免残留旧图', async () => {
    let resolveLoad!: () => void
    nextLoadScenePromise = new Promise<void>((resolve) => {
      resolveLoad = resolve
    })

    const wrapper = mount(PanoEngineViewer, {
      props: {
        sceneData: VALID_SCENE,
        tilingStatus: 'READY',
        tilingProgress: 100,
        hotspots: [] as Hotspot[],
      },
    })
    await flushPromises()

    const engine = latestEngine()
    expect(engine.loadSceneConfig).toHaveBeenCalledTimes(1)

    const nextScene = makeSceneData('s2')
    await wrapper.setProps({ sceneData: nextScene })
    await flushPromises()

    expect(engine.loadSceneConfig).toHaveBeenCalledTimes(1)

    resolveLoad()
    await flushPromises()
    await flushPromises()

    expect(engine.loadSceneConfig).toHaveBeenCalledTimes(2)
    expect(engine.loadSceneConfig).toHaveBeenLastCalledWith(nextScene)
  })

  it('相同热点快照重复传入时不应重复全量同步', async () => {
    const hotspot = makeHotspot('same')
    const wrapper = mount(PanoEngineViewer, {
      props: {
        sceneData: VALID_SCENE,
        tilingStatus: 'READY',
        tilingProgress: 100,
        hotspots: [hotspot] as Hotspot[],
      },
    })
    await flushPromises()

    const engine = latestEngine()
    const callsAfterInitialSync = engine.syncHotspots.mock.calls.length

    await wrapper.setProps({ hotspots: [{ ...hotspot }] as Hotspot[] })
    await flushPromises()

    expect(engine.syncHotspots).toHaveBeenCalledTimes(callsAfterInitialSync)
  })
})
