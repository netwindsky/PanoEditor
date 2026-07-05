import { describe, it, expect } from 'vitest'
import type { Project, Scene, Hotspot, TourSettings } from '@/types'
import {
  buildSceneDataList,
  collectResourceUrls,
  rewriteSceneDataUrls,
  generateConfigJson,
  sanitizeAssetPath,
  ASSET_DIR,
} from '@/utils/staticExport'

// ─── fixtures ────────────────────────────────────────────────

const project: Project = {
  id: 'p1',
  name: '我的全景项目',
  description: '一个测试项目',
  coverUrl: '/cover.jpg',
  sceneCount: 2,
  settings: JSON.stringify({
    autoRotate: true,
    autoRotateSpeed: 1.0,
    defaultFov: 100,
    minFov: 70,
    maxFov: 140,
    enableCompass: false,
    controlbar: true,
    thumbs: true,
    tooltips: true,
    designStyle: 'flat',
    loadsceneBlend: 'BLEND(1)',
  } as TourSettings),
  createdAt: '2025-01-01',
  updatedAt: '2025-01-02',
}

const scene1: Scene = {
  id: 's1',
  projectId: 'p1',
  name: 'scene1',
  title: '场景一',
  previewUrl: '/uploads/s1/preview.jpg',
  thumbUrl: '/uploads/s1/thumb.jpg',
  imageConfig: JSON.stringify({
    type: 'CUBE',
    multires: true,
    tilesize: '512',
    levels: [
      { tiledimagewidth: 1024, tiledimageheight: 1024, cube: { url: '/uploads/s1/l1/%s.jpg' } },
      { tiledimagewidth: 2048, tiledimageheight: 2048, cube: { url: '/uploads/s1/l2/%s.jpg' } },
    ],
  }),
  status: 'READY',
  initialView: { yaw: 0, pitch: 0, hfov: 100, fovMin: 70, fovMax: 140, maxPixelZoom: 2, limitView: 'auto', fovType: 'MFOV' },
  location: {},
  onstart: '',
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
}

const scene2: Scene = {
  ...scene1,
  id: 's2',
  name: 'scene2',
  title: '场景二',
  previewUrl: '/uploads/s2/preview.jpg',
  thumbUrl: '/uploads/s2/thumb.jpg',
  imageConfig: JSON.stringify({
    type: 'CUBE',
    multires: true,
    tilesize: '512',
    levels: [
      { tiledimagewidth: 1024, tiledimageheight: 1024, cube: { url: '/uploads/s2/l1/%s.jpg' } },
    ],
  }),
  sortOrder: 1,
}

const hs1: Hotspot = {
  id: 'h1', sceneId: 's1', name: 'info1', type: 'info', ath: 10, atv: 20,
  url: '/uploads/hotspots/info.png', tooltip: '提示文字',
}

const hs2: Hotspot = {
  id: 'h2', sceneId: 's1', name: 'link1', type: 'scene', ath: 30, atv: -5,
  linkedSceneId: 's2', url: '/uploads/hotspots/arrow.png',
}

const hs3: Hotspot = {
  id: 'h3', sceneId: 's2', name: 'img1', type: 'image', ath: 0, atv: 0,
  url: '/uploads/hotspots/popup.jpg', width: 300, height: 200,
}

// ─── sanitizeAssetPath ───────────────────────────────────────

describe('sanitizeAssetPath', () => {
  it('将绝对 URL 路径转为 assets/ 下的安全相对路径', () => {
    expect(sanitizeAssetPath('/uploads/s1/l1/f.jpg'))
      .toBe('assets/uploads/s1/l1/f.jpg')
  })

  it('保留查询字符串的去除处理（不应出现在 zip 路径中）', () => {
    expect(sanitizeAssetPath('/uploads/img.png?v=123'))
      .toBe('assets/uploads/img.png')
  })

  it('去除前导 ../ 等路径遍历字符', () => {
    const result = sanitizeAssetPath('/../../../etc/passwd')
    expect(result).not.toContain('..')
    expect(result.startsWith('assets/')).toBe(true)
  })
})

// ─── buildSceneDataList ──────────────────────────────────────

describe('buildSceneDataList', () => {
  it('返回 PanoViewV2 SceneData[] 格式，每个场景对应一个', () => {
    const list = buildSceneDataList(project, [scene1, scene2], [hs1, hs2, hs3])
    expect(list).toHaveLength(2)
    expect(list[0].scene.name).toBe('scene1')
    expect(list[1].scene.name).toBe('scene2')
  })

  it('正确解析 imageConfig JSON 为 image 配置', () => {
    const list = buildSceneDataList(project, [scene1], [])
    const img = list[0].image
    expect(img.type).toBe('CUBE')
    expect(img.multires).toBe(true)
    expect(img.tilesize).toBe('512')
    expect(img.levels).toHaveLength(2)
    expect(img.levels[0].cube.url).toBe('/uploads/s1/l1/%s.jpg')
  })

  it('将场景热点按 sceneId 分组挂到对应 SceneData.hotspots', () => {
    const list = buildSceneDataList(project, [scene1, scene2], [hs1, hs2, hs3])
    expect(list[0].hotspots).toHaveLength(2)
    expect(list[1].hotspots).toHaveLength(1)
    expect(list[0].hotspots.map(h => h.name)).toContain('info1')
    expect(list[0].hotspots.map(h => h.name)).toContain('link1')
    expect(list[1].hotspots[0].name).toBe('img1')
  })

  it('scene 跳转热点的 linkedscene 字段填入目标场景 name（非 id）', () => {
    const list = buildSceneDataList(project, [scene1, scene2], [hs2])
    const link = list[0].hotspots.find(h => h.name === 'link1')
    expect(link?.linkedscene).toBe('scene2')
  })

  it('imageConfig 为非法 JSON 时优雅降级为简单 cubemap 占位', () => {
    const bad = { ...scene1, imageConfig: 'not json' }
    const list = buildSceneDataList(project, [bad], [])
    expect(list[0].image).toBeDefined()
    expect(list[0].image.levels.length).toBeGreaterThanOrEqual(0)
  })

  it('view 字段映射 initialView（yaw→hlookat, pitch→vlookat, hfov→fov）', () => {
    const list = buildSceneDataList(project, [scene1], [])
    const v = list[0].view
    expect(v.hlookat).toBe('0')
    expect(v.vlookat).toBe('0')
    expect(v.fov).toBe('100')
    expect(v.fovmin).toBe('70')
    expect(v.fovmax).toBe('140')
  })

  it('thumburl 与 preview 字段正确设置', () => {
    const list = buildSceneDataList(project, [scene1], [])
    expect(list[0].scene.thumburl).toBe('/uploads/s1/thumb.jpg')
    expect(list[0].preview?.url).toBe('/uploads/s1/preview.jpg')
  })

  it('按 sortOrder 排序输出', () => {
    const reversed = [{ ...scene1, sortOrder: 2 }, { ...scene2, sortOrder: 1 }]
    const list = buildSceneDataList(project, reversed, [])
    expect(list.map(s => s.scene.name)).toEqual(['scene2', 'scene1'])
  })

  it('后端 SceneData 格式（imageConfig 含完整 SceneData 包装）能正确解析 levels 并优先使用内部 thumburl/preview', () => {
    // 模拟后端 TileServiceImpl.generateConfigJson 产出的完整 SceneData JSON
    const sceneId = '0c2b0dd01c53fd274b2e827a6bb3ad0a'
    const backendSceneDataImageConfig = JSON.stringify({
      view: { fov: '90', fovmax: '120', fovmin: '30', fovtype: 'MFOV', hlookat: '0', vlookat: '0' },
      image: {
        type: 'CUBE', multires: true, tilesize: 512,
        levels: [
          { tiledimagewidth: 512, tiledimageheight: 512, cube: { url: `/uploads/tiles/${sceneId}/%s/l0/%0v/l0_%s_%0v_%0h.jpg` } },
          { tiledimagewidth: 1024, tiledimageheight: 1024, cube: { url: `/uploads/tiles/${sceneId}/%s/l1/%0v/l1_%s_%0v_%0h.jpg` } },
          { tiledimagewidth: 2048, tiledimageheight: 2048, cube: { url: `/uploads/tiles/${sceneId}/%s/l2/%0v/l2_%s_%0v_%0h.jpg` } },
          { tiledimagewidth: 4096, tiledimageheight: 4096, cube: { url: `/uploads/tiles/${sceneId}/%s/l3/%0v/l3_%s_%0v_%0h.jpg` } },
        ],
      },
      scene: { name: '01', title: '01', thumburl: `/uploads/tiles/${sceneId}/thumb.jpg` },
      thumb: { url: `/uploads/tiles/${sceneId}/thumb.jpg` },
      preview: { url: `/uploads/tiles/${sceneId}/preview.jpg` },
      hotspots: [],
    })

    const sceneWithBackendCfg: Scene = {
      ...scene1,
      id: sceneId,
      name: '01',
      // Scene 表上存的是上传时的原图，不是切片后的
      thumbUrl: `/uploads/projects/projid/original_thumb.jpg`,
      previewUrl: `/uploads/projects/projid/original_preview.jpg`,
      imageConfig: backendSceneDataImageConfig,
    }

    const list = buildSceneDataList(project, [sceneWithBackendCfg], [])
    const sd = list[0]

    // image.levels 应该正确解析出 4 个 level
    expect(sd.image.multires).toBe(true)
    expect(sd.image.tilesize).toBe('512')
    expect(sd.image.levels).toHaveLength(4)
    expect(sd.image.levels[3].cube.url).toContain('l3')
    expect(sd.image.levels[0].cube.url).toContain('%0v')
    expect(sd.image.levels[0].tiledimagewidth).toBe('512')

    // thumburl/preview 必须来自 imageConfig（切片后的），而不是 Scene 上的原图路径
    expect(sd.scene.thumburl).toBe(`/uploads/tiles/${sceneId}/thumb.jpg`)
    expect(sd.preview?.url).toBe(`/uploads/tiles/${sceneId}/preview.jpg`)
  })
})

// ─── collectResourceUrls ─────────────────────────────────────

describe('collectResourceUrls', () => {
  it('收集所有瓦片 URL、预览图、缩略图、热点 URL', () => {
    const list = buildSceneDataList(project, [scene1, scene2], [hs1, hs2, hs3])
    const urls = collectResourceUrls(list)

    // 瓦片（每 level 1 条模板）
    expect(urls).toContain('/uploads/s1/l1/%s.jpg')
    expect(urls).toContain('/uploads/s1/l2/%s.jpg')
    expect(urls).toContain('/uploads/s2/l1/%s.jpg')
    // 预览 & 缩略图
    expect(urls).toContain('/uploads/s1/preview.jpg')
    expect(urls).toContain('/uploads/s1/thumb.jpg')
    expect(urls).toContain('/uploads/s2/preview.jpg')
    expect(urls).toContain('/uploads/s2/thumb.jpg')
    // 热点
    expect(urls).toContain('/uploads/hotspots/info.png')
    expect(urls).toContain('/uploads/hotspots/arrow.png')
    expect(urls).toContain('/uploads/hotspots/popup.jpg')
  })

  it('去重', () => {
    const dupScene = {
      ...scene1,
      previewUrl: '/same.jpg',
      thumbUrl: '/same.jpg',
    }
    const list = buildSceneDataList(project, [dupScene], [])
    const urls = collectResourceUrls(list)
    const sameCount = urls.filter(u => u === '/same.jpg').length
    expect(sameCount).toBe(1)
  })

  it('过滤空 url 与外链 http(s)（外链不打包，保持原样引用）', () => {
    const scene = {
      ...scene1,
      thumbUrl: 'https://cdn.example.com/thumb.jpg',
      previewUrl: '',
    }
    const hotspot: Hotspot = { ...hs1, url: 'http://other.com/a.png' }
    const list = buildSceneDataList(project, [scene], [hotspot])
    const urls = collectResourceUrls(list)
    expect(urls).not.toContain('')
    // 外链不出现在待下载列表
    expect(urls).not.toContain('https://cdn.example.com/thumb.jpg')
    expect(urls).not.toContain('http://other.com/a.png')
  })

  it('瓦片模板 URL 包含 %s 占位符时保留原样（后续下载会展开为 6 面）', () => {
    const list = buildSceneDataList(project, [scene1], [])
    const urls = collectResourceUrls(list)
    const tile = urls.find(u => u.includes('%s'))
    expect(tile).toBeDefined()
  })
})

// ─── rewriteSceneDataUrls ────────────────────────────────────

describe('rewriteSceneDataUrls', () => {
  it('将所有内部 URL 重写为 assets/ 相对路径', () => {
    const list = buildSceneDataList(project, [scene1, scene2], [hs1, hs2, hs3])
    const rewritten = rewriteSceneDataUrls(list)

    rewritten.forEach(sd => {
      // thumburl
      expect(sd.scene.thumburl.startsWith(ASSET_DIR)).toBe(true)
      // preview
      if (sd.preview) expect(sd.preview.url.startsWith(ASSET_DIR)).toBe(true)
      // tiles
      sd.image.levels.forEach(l => {
        expect(l.cube.url.startsWith(ASSET_DIR)).toBe(true)
      })
      // hotspots
      sd.hotspots.forEach(h => {
        if (h.url) expect(h.url.startsWith(ASSET_DIR)).toBe(true)
      })
    })
  })

  it('外链 http(s) URL 保持不变', () => {
    const scene = {
      ...scene1,
      thumbUrl: 'https://cdn.example.com/thumb.jpg',
    }
    const list = buildSceneDataList(project, [scene], [])
    const rewritten = rewriteSceneDataUrls(list)
    expect(rewritten[0].scene.thumburl).toBe('https://cdn.example.com/thumb.jpg')
  })
})

// ─── generateConfigJson ──────────────────────────────────────

describe('generateConfigJson', () => {
  it('生成合法 JSON，含 scenes 数组与 tourSettings', () => {
    const list = buildSceneDataList(project, [scene1], [hs1])
    const json = generateConfigJson(list, JSON.parse(project.settings || '{}'))
    const parsed = JSON.parse(json)
    expect(parsed.scenes).toHaveLength(1)
    expect(parsed.tourSettings).toBeDefined()
    expect(parsed.tourSettings.autoRotate).toBe(true)
  })

  it('首场景为第一个 scene name', () => {
    const list = buildSceneDataList(project, [scene1, scene2], [])
    const json = generateConfigJson(list, null)
    const parsed = JSON.parse(json)
    expect(parsed.firstScene).toBe('scene1')
  })
})
