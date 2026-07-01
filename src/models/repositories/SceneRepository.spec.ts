/**
 * SceneRepository — 数据归一化（DTO ↔ Domain）测试
 *
 * 核心职责：
 * 1. sceneFromDto：把后端三处冗余的视角字段（initialView / viewConfig.initialView / imageConfig.view）
 *    按优先级归一化为单一 domain.Scene.initialView（保证非空、字段齐全）
 * 2. patchToDto：把 domain UpdateSceneParams fan-out 到后端 initialView + viewConfig 两个字符串字段
 *    （不再写入 imageConfig.view，因为后端 retiling 会将其重置）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SceneRepository } from './SceneRepository'
import type { SceneDto, UpdateSceneParams } from '@/types'
import { DEFAULT_INITIAL_VIEW } from '@/types'

// mock underlying axios wrappers
vi.mock('@/api/scene', () => ({
  getScenes: vi.fn(),
  getScene: vi.fn(),
  createScene: vi.fn(),
  updateScene: vi.fn(),
  deleteScene: vi.fn(),
  getTilingProgress: vi.fn(),
}))

import * as sceneApi from '@/api/scene'

/** 构造一个最小合法 DTO，可用 overrides 定制 */
function makeDto(overrides: Partial<SceneDto> = {}): SceneDto {
  return {
    id: 's1',
    projectId: 'p1',
    name: '01',
    title: null,
    description: null,
    previewUrl: '',
    thumbUrl: '',
    imageConfig: null,
    status: 'READY',
    initialView: null,
    viewConfig: null,
    sortOrder: 0,
    lat: null,
    lng: null,
    heading: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('SceneRepository.sceneFromDto — 视角三源归一化', () => {
  let repo: SceneRepository

  beforeEach(() => {
    repo = new SceneRepository()
    vi.clearAllMocks()
  })

  it('优先级 1：initialView JSON 字符串 → 解析为 InitialView 对象', async () => {
    const iv = {
      yaw: -155.17,
      pitch: -2.65,
      hfov: 74.25,
      fovMin: 70,
      fovMax: 140,
      maxPixelZoom: 2,
      limitView: 'auto',
      fovType: 'MFOV',
    }
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: { data: makeDto({ initialView: JSON.stringify(iv) }) },
    })

    const scene = await repo.fetchScene('p1', 's1')

    expect(scene.initialView).toEqual({
      yaw: -155.17,
      pitch: -2.65,
      hfov: 74.25,
      fovMin: 70,
      fovMax: 140,
      maxPixelZoom: 2,
      limitView: 'auto',
      fovType: 'MFOV',
    })
  })

  it('优先级 2：initialView 为 null 时 → 从 viewConfig.initialView 回退', async () => {
    const vc = { initialView: { yaw: 30, pitch: 10, hfov: 90, fovType: 'VFOV' } }
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: { data: makeDto({ initialView: null, viewConfig: JSON.stringify(vc) }) },
    })

    const scene = await repo.fetchScene('p1', 's1')

    expect(scene.initialView.yaw).toBe(30)
    expect(scene.initialView.pitch).toBe(10)
    expect(scene.initialView.hfov).toBe(90)
    expect(scene.initialView.fovType).toBe('VFOV')
    // 缺失字段应由默认值补齐
    expect(scene.initialView.fovMin).toBe(DEFAULT_INITIAL_VIEW.fovMin)
    expect(scene.initialView.fovMax).toBe(DEFAULT_INITIAL_VIEW.fovMax)
  })

  it('优先级 3：initialView 与 viewConfig 均无 → 从 imageConfig.view 回退（krpano 命名映射）', async () => {
    const imageConfig = {
      view: {
        hlookat: '45',
        vlookat: '-10',
        fov: '80',
        fovtype: 'HFOV',
        fovmin: '30',
        fovmax: '120',
        limitview: 'range',
        maxpixelzoom: '1.5',
      },
      image: { levels: [] },
    }
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: { data: makeDto({ imageConfig: JSON.stringify(imageConfig) }) },
    })

    const scene = await repo.fetchScene('p1', 's1')

    expect(scene.initialView.yaw).toBe(45)
    expect(scene.initialView.pitch).toBe(10)
    expect(scene.initialView.hfov).toBe(80)
    expect(scene.initialView.fovType).toBe('HFOV')
    expect(scene.initialView.fovMin).toBe(30)
    expect(scene.initialView.fovMax).toBe(120)
    expect(scene.initialView.limitView).toBe('range')
    expect(scene.initialView.maxPixelZoom).toBe(1.5)
  })

  it('优先级 4：三源全空 → 使用 DEFAULT_INITIAL_VIEW', async () => {
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: { data: makeDto() },
    })

    const scene = await repo.fetchScene('p1', 's1')

    expect(scene.initialView).toEqual(DEFAULT_INITIAL_VIEW)
  })

  it('initialView JSON 损坏 → 回退到 viewConfig 而非抛异常', async () => {
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: {
        data: makeDto({
          initialView: '{invalid json',
          viewConfig: JSON.stringify({ initialView: { yaw: 5, pitch: 5, hfov: 100 } }),
        }),
      },
    })

    const scene = await repo.fetchScene('p1', 's1')
    expect(scene.initialView.yaw).toBe(5)
  })

  it('location 从顶层 lat/lng/heading 抽取', async () => {
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: { data: makeDto({ lat: 12.34, lng: 56.78, heading: 90 }) },
    })

    const scene = await repo.fetchScene('p1', 's1')
    expect(scene.location).toEqual({ lat: 12.34, lng: 56.78, heading: 90 })
  })

  it('location 顶层空 → 从 viewConfig 中回退读取', async () => {
    const vc = { lat: 1.1, lng: 2.2, heading: 45 }
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: { data: makeDto({ viewConfig: JSON.stringify(vc) }) },
    })

    const scene = await repo.fetchScene('p1', 's1')
    expect(scene.location.lat).toBe(1.1)
    expect(scene.location.lng).toBe(2.2)
    expect(scene.location.heading).toBe(45)
  })

  it('onstart 从 viewConfig 抽取；无则空字符串', async () => {
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: {
        data: makeDto({ viewConfig: JSON.stringify({ onstart: 'loadscene(s1);' }) }),
      },
    })

    const s1 = await repo.fetchScene('p1', 's1')
    expect(s1.onstart).toBe('loadscene(s1);')

    ;(sceneApi.getScene as any).mockResolvedValue({
      data: { data: makeDto() },
    })
    const s2 = await repo.fetchScene('p1', 's1')
    expect(s2.onstart).toBe('')
  })

  it('title 保留原字符串；null 归一化为空串（domain 保证非空）', async () => {
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: { data: makeDto({ title: null }) },
    })
    const s = await repo.fetchScene('p1', 's1')
    expect(s.title).toBe('')
  })

  it('imageConfig 保留原始 JSON 字符串（供瓦片加载）；null 归一化为空串', async () => {
    ;(sceneApi.getScene as any).mockResolvedValue({
      data: { data: makeDto({ imageConfig: '{"foo":1}' }) },
    })
    const s = await repo.fetchScene('p1', 's1')
    expect(s.imageConfig).toBe('{"foo":1}')
  })

  it('fetchScenes 返回数组 → 每个元素都被归一化', async () => {
    const iv = { yaw: 1, pitch: 2, hfov: 80 }
    ;(sceneApi.getScenes as any).mockResolvedValue({
      data: {
        data: [
          makeDto({ id: 'a', initialView: JSON.stringify(iv) }),
          makeDto({ id: 'b' }),
        ],
      },
    })

    const list = await repo.fetchScenes('p1')
    expect(list).toHaveLength(2)
    expect(list[0].initialView.yaw).toBe(1)
    expect(list[1].initialView).toEqual(DEFAULT_INITIAL_VIEW)
  })
})

describe('SceneRepository.updateScene — patchToDto fan-out', () => {
  let repo: SceneRepository

  beforeEach(() => {
    repo = new SceneRepository()
    vi.clearAllMocks()
    // update 返回同样的 DTO 结构以走归一化路径
    ;(sceneApi.updateScene as any).mockResolvedValue({
      data: { data: { id: 's1', projectId: 'p1', name: 'x', title: null, previewUrl: '', thumbUrl: '', imageConfig: null, status: 'READY', initialView: null, viewConfig: null, sortOrder: 0, lat: null, lng: null, heading: null, createdAt: '', updatedAt: '' } as SceneDto },
    })
  })

  it('传入 initialView → 发送到后端时同时写入 initialView (JSON string) 与 viewConfig (JSON string 内含 initialView)', async () => {
    const iv = {
      yaw: -155.17, pitch: -2.65, hfov: 74.25,
      fovMin: 70, fovMax: 140, maxPixelZoom: 2,
      limitView: 'auto', fovType: 'MFOV',
    } as const

    const params: UpdateSceneParams = { initialView: { ...iv } }
    await repo.updateScene('s1', params)

    const sentBody = (sceneApi.updateScene as any).mock.calls[0][1]

    expect(typeof sentBody.initialView).toBe('string')
    expect(JSON.parse(sentBody.initialView)).toEqual(iv)

    expect(typeof sentBody.viewConfig).toBe('string')
    const vc = JSON.parse(sentBody.viewConfig)
    expect(vc.initialView).toEqual(iv)
  })

  it('传入 location → 序列化到 viewConfig JSON 内 + 顶层 lat/lng/heading（双写兼容）', async () => {
    const params: UpdateSceneParams = {
      location: { lat: 1.1, lng: 2.2, heading: 45 },
    }
    await repo.updateScene('s1', params)

    const sentBody = (sceneApi.updateScene as any).mock.calls[0][1]

    expect(sentBody.lat).toBe(1.1)
    expect(sentBody.lng).toBe(2.2)
    expect(sentBody.heading).toBe(45)

    const vc = JSON.parse(sentBody.viewConfig)
    expect(vc.lat).toBe(1.1)
    expect(vc.lng).toBe(2.2)
    expect(vc.heading).toBe(45)
  })

  it('同时传 initialView + location + onstart → 单个 viewConfig JSON 合并所有字段', async () => {
    const iv = { yaw: 10, pitch: 20, hfov: 80, fovMin: 70, fovMax: 140, maxPixelZoom: 2, limitView: 'auto', fovType: 'MFOV' } as const
    const params: UpdateSceneParams = {
      initialView: { ...iv },
      location: { lat: 1.1, lng: 2.2 },
      onstart: 'action(x);',
    }
    await repo.updateScene('s1', params)

    const sentBody = (sceneApi.updateScene as any).mock.calls[0][1]
    const vc = JSON.parse(sentBody.viewConfig)

    expect(vc.initialView).toEqual(iv)
    expect(vc.lat).toBe(1.1)
    expect(vc.lng).toBe(2.2)
    expect(vc.onstart).toBe('action(x);')
  })

  it('只传 name/title/thumbUrl → 不写 viewConfig 也不写 initialView', async () => {
    await repo.updateScene('s1', { name: 'new', title: 't', thumbUrl: 'u' })

    const sentBody = (sceneApi.updateScene as any).mock.calls[0][1]
    expect(sentBody.name).toBe('new')
    expect(sentBody.title).toBe('t')
    expect(sentBody.thumbUrl).toBe('u')
    expect(sentBody.initialView).toBeUndefined()
    expect(sentBody.viewConfig).toBeUndefined()
  })

  it('传空 location 对象 → viewConfig 存在但只有非空字段', async () => {
    await repo.updateScene('s1', { location: { lat: 1.1 } })
    const sentBody = (sceneApi.updateScene as any).mock.calls[0][1]
    const vc = JSON.parse(sentBody.viewConfig)
    expect(vc.lat).toBe(1.1)
    expect(vc.lng).toBeUndefined()
    expect(vc.heading).toBeUndefined()
  })
})

describe('SceneRepository.createScene — 兼容 CreateSceneParams', () => {
  let repo: SceneRepository

  beforeEach(() => {
    repo = new SceneRepository()
    vi.clearAllMocks()
    ;(sceneApi.createScene as any).mockResolvedValue({
      data: {
        data: {
          id: 's1', projectId: 'p1', name: 'new', title: null,
          previewUrl: '/x.jpg', thumbUrl: '', imageConfig: null, status: 'PENDING',
          initialView: null, viewConfig: null, sortOrder: 0,
          lat: null, lng: null, heading: null, createdAt: '', updatedAt: '',
        } as SceneDto,
      },
    })
  })

  it('createScene 返回的 DTO 也走 sceneFromDto 归一化', async () => {
    const scene = await repo.createScene('p1', { name: 'new', previewUrl: '/x.jpg' })
    expect(scene.initialView).toEqual(DEFAULT_INITIAL_VIEW)
    expect(scene.location).toEqual({})
    expect(scene.onstart).toBe('')
  })
})
