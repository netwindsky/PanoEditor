/**
 * SceneViewModel — 派生属性 & 写入方法测试
 *
 * 关键约束：
 * - currentEngineSceneData: 从 scene.initialView（单一真相）派生引擎需要的 SceneData.view
 *   避免 imageConfig.view 的 0/0/90 默认值污染
 * - updateSceneView / updateSceneLocation / updateSceneMeta：
 *   走 service → 后端返回归一化后的 Scene → 覆盖 scenes 数组条目 + currentScene
 *   （消除 SceneProperties 直接 mutate 数组的反 MVVM 模式）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SceneViewModel } from './SceneViewModel'
import type { Scene, InitialView } from '@/types'
import { DEFAULT_INITIAL_VIEW } from '@/types'
import type { SceneService } from '@/models'

function makeInitialView(overrides: Partial<InitialView> = {}): InitialView {
  return { ...DEFAULT_INITIAL_VIEW, ...overrides }
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 's1',
    projectId: 'p1',
    name: '01',
    title: '',
    previewUrl: '',
    thumbUrl: '',
    imageConfig: JSON.stringify({
      image: {
        type: 'CUBE',
        multires: true,
        tilesize: '512',
        levels: [
          { tiledimagewidth: 512, tiledimageheight: 512, cube: { url: '/l0/%s.jpg' } },
        ],
      },
      // 后端切片写死的 view 默认值（切片流水线永远 0/0/90）
      view: { hlookat: '0', vlookat: '0', fov: '90', fovtype: 'MFOV' },
      preview: { url: '/preview.jpg' },
      thumb: { url: '/thumb.jpg' },
      scene: { name: '01', title: '01' },
    }),
    status: 'READY',
    initialView: makeInitialView(),
    location: {},
    onstart: '',
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function makeService(): SceneService {
  return {
    fetchScenes: vi.fn(),
    fetchScene: vi.fn(),
    createScene: vi.fn(),
    updateScene: vi.fn(),
    deleteScene: vi.fn(),
    uploadPanorama: vi.fn(),
    uploadPanoramas: vi.fn(),
    fetchTilingProgress: vi.fn(),
  } as unknown as SceneService
}

describe('SceneViewModel.currentEngineSceneData — 视角来自 initialView', () => {
  it('current scene 为 null 时返回 null', () => {
    const vm = new SceneViewModel(makeService())
    expect(vm.currentEngineSceneData.value).toBeNull()
  })

  it('imageConfig 为空字符串时返回 null（切片未完成）', () => {
    const vm = new SceneViewModel(makeService())
    vm.currentScene.value = makeScene({ imageConfig: '' })
    expect(vm.currentEngineSceneData.value).toBeNull()
  })

  it('imageConfig JSON 损坏时返回 null（防止引擎崩溃）', () => {
    const vm = new SceneViewModel(makeService())
    vm.currentScene.value = makeScene({ imageConfig: '{bad json' })
    expect(vm.currentEngineSceneData.value).toBeNull()
  })

  it('从 scene.initialView 派生 view（yaw→hlookat, pitch→vlookat, hfov→fov）', () => {
    const vm = new SceneViewModel(makeService())
    vm.currentScene.value = makeScene({
      initialView: makeInitialView({
        yaw: -155.17,
        pitch: -2.65,
        hfov: 74.25,
        fovMin: 70,
        fovMax: 140,
        maxPixelZoom: 2,
        limitView: 'auto',
        fovType: 'MFOV',
      }),
    })

    const sd = vm.currentEngineSceneData.value!
    expect(sd).toBeTruthy()
    expect(sd.view.hlookat).toBe('-155.17')
    expect(sd.view.vlookat).toBe('-2.65')
    expect(sd.view.fov).toBe('74.25')
    expect(sd.view.fovmin).toBe('70')
    expect(sd.view.fovmax).toBe('140')
    expect(sd.view.fovtype).toBe('MFOV')
    expect(sd.view.maxpixelzoom).toBe('2')
    expect(sd.view.limitview).toBe('auto')
  })

  it('scene.id 用作 SceneData.scene.name（供 engine changeScene 按 ID 查找）', () => {
    const vm = new SceneViewModel(makeService())
    vm.currentScene.value = makeScene({ id: 'roomA', name: '会议厅' })
    expect(vm.currentEngineSceneData.value!.scene.name).toBe('roomA')
  })

  it('imageConfig 内的 levels/preview 保留（用于瓦片加载）', () => {
    const vm = new SceneViewModel(makeService())
    vm.currentScene.value = makeScene()
    const sd = vm.currentEngineSceneData.value!
    expect(sd.image.levels).toHaveLength(1)
    expect(sd.image.levels[0].cube.url).toBe('/l0/%s.jpg')
    expect(sd.preview?.url).toBe('/preview.jpg')
  })

  it('回归 bug：即使 imageConfig.view = {0,0,90}，也用 scene.initialView 覆盖', () => {
    const vm = new SceneViewModel(makeService())
    // imageConfig.view 是切片写死的默认值，会被覆盖
    vm.currentScene.value = makeScene({
      initialView: makeInitialView({ yaw: 45, pitch: 30, hfov: 80 }),
    })
    const sd = vm.currentEngineSceneData.value!
    expect(sd.view.hlookat).toBe('45')  // 而不是 "0"
    expect(sd.view.vlookat).toBe('30')  // 而不是 "0"
    expect(sd.view.fov).toBe('80')      // 而不是 "90"
  })
})

describe('SceneViewModel.allEngineSceneData — 预加载列表', () => {
  it('只包含 imageConfig 非空的场景（切片就绪）', () => {
    const vm = new SceneViewModel(makeService())
    vm.scenes.value = [
      makeScene({ id: 'a', name: 'A' }),
      makeScene({ id: 'b', name: 'B', imageConfig: '' }),
      makeScene({ id: 'c', name: 'C' }),
    ]
    const list = vm.allEngineSceneData.value
    expect(list).toHaveLength(2)
    expect(list.map((s) => s.scene.name)).toEqual(['a', 'c'])
  })

  it('每个条目视角都来自各自 scene.initialView', () => {
    const vm = new SceneViewModel(makeService())
    vm.scenes.value = [
      makeScene({ id: 'a', name: 'A', initialView: makeInitialView({ yaw: 10 }) }),
      makeScene({ id: 'b', name: 'B', initialView: makeInitialView({ yaw: 20 }) }),
    ]
    const list = vm.allEngineSceneData.value
    expect(list[0].view.hlookat).toBe('10')
    expect(list[1].view.hlookat).toBe('20')
  })
})

describe('SceneViewModel.updateSceneView — 写入 + 状态同步', () => {
  let service: SceneService
  let vm: SceneViewModel

  beforeEach(() => {
    service = makeService()
    vm = new SceneViewModel(service)
    vm.scenes.value = [
      makeScene({ id: 's1', name: '01' }),
      makeScene({ id: 's2', name: '02' }),
    ]
    vm.currentScene.value = vm.scenes.value[0]
  })

  it('调 service.updateScene 时传入 { initialView }', async () => {
    const newIv = makeInitialView({ yaw: 45 })
    ;(service.updateScene as any).mockResolvedValue(makeScene({ id: 's1', initialView: newIv }))

    await vm.updateSceneView('s1', newIv)

    expect(service.updateScene).toHaveBeenCalledWith('s1', { initialView: newIv })
  })

  it('返回的新 Scene 替换 scenes 数组中的旧条目（新引用）', async () => {
    const oldRef = vm.scenes.value
    const updated = makeScene({ id: 's1', initialView: makeInitialView({ yaw: 99 }) })
    ;(service.updateScene as any).mockResolvedValue(updated)

    await vm.updateSceneView('s1', makeInitialView({ yaw: 99 }))

    // 触发响应式必须换新数组引用
    expect(vm.scenes.value).not.toBe(oldRef)
    // Vue ref 会把内层对象 proxy 化，故用 toStrictEqual 比对结构而非引用
    expect(vm.scenes.value[0]).toStrictEqual(updated)
    expect(vm.scenes.value[1].id).toBe('s2')
  })

  it('若被更新的是 currentScene，同步指向新对象（触发 currentEngineSceneData 重算）', async () => {
    const updated = makeScene({ id: 's1', initialView: makeInitialView({ yaw: 77 }) })
    ;(service.updateScene as any).mockResolvedValue(updated)

    await vm.updateSceneView('s1', makeInitialView({ yaw: 77 }))

    expect(vm.currentScene.value).toStrictEqual(updated)
    expect(vm.currentEngineSceneData.value!.view.hlookat).toBe('77')
  })

  it('若被更新的不是 currentScene，不改变 currentScene 引用', async () => {
    const currentRef = vm.currentScene.value
    ;(service.updateScene as any).mockResolvedValue(makeScene({ id: 's2', name: '02' }))

    await vm.updateSceneView('s2', makeInitialView({ yaw: 88 }))

    expect(vm.currentScene.value).toBe(currentRef)
  })
})

describe('SceneViewModel.updateSceneLocation — GPS + onstart', () => {
  let service: SceneService
  let vm: SceneViewModel

  beforeEach(() => {
    service = makeService()
    vm = new SceneViewModel(service)
    vm.scenes.value = [makeScene({ id: 's1' })]
    vm.currentScene.value = vm.scenes.value[0]
  })

  it('传 location + onstart → 一次 service.updateScene 调用', async () => {
    ;(service.updateScene as any).mockResolvedValue(
      makeScene({ id: 's1', location: { lat: 1, lng: 2, heading: 3 }, onstart: 'x();' }),
    )

    await vm.updateSceneLocation('s1', { lat: 1, lng: 2, heading: 3 }, 'x();')

    expect(service.updateScene).toHaveBeenCalledWith('s1', {
      location: { lat: 1, lng: 2, heading: 3 },
      onstart: 'x();',
    })
  })

  it('onstart 可选（不传时不发送）', async () => {
    ;(service.updateScene as any).mockResolvedValue(makeScene({ id: 's1' }))
    await vm.updateSceneLocation('s1', { lat: 1 })
    expect(service.updateScene).toHaveBeenCalledWith('s1', { location: { lat: 1 } })
  })
})

describe('SceneViewModel.updateSceneMeta — 名称/标题/缩略图', () => {
  let service: SceneService
  let vm: SceneViewModel

  beforeEach(() => {
    service = makeService()
    vm = new SceneViewModel(service)
    vm.scenes.value = [makeScene({ id: 's1' })]
    vm.currentScene.value = vm.scenes.value[0]
  })

  it('透传 name/title/thumbUrl 到 service', async () => {
    ;(service.updateScene as any).mockResolvedValue(makeScene({ id: 's1', name: 'new' }))
    await vm.updateSceneMeta('s1', { name: 'new', title: 't', thumbUrl: 'u' })
    expect(service.updateScene).toHaveBeenCalledWith('s1', { name: 'new', title: 't', thumbUrl: 'u' })
  })

  it('只传部分字段时不发送 undefined 字段', async () => {
    ;(service.updateScene as any).mockResolvedValue(makeScene({ id: 's1', name: 'new' }))
    await vm.updateSceneMeta('s1', { name: 'new' })
    expect(service.updateScene).toHaveBeenCalledWith('s1', { name: 'new' })
  })
})
