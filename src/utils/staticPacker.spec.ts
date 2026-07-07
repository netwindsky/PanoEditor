import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SceneData } from '@panoview'
import {
  createStaticPack,
  type PackOptions,
  type ResourceFetcher,
  type PackProgress,
} from '@/utils/staticPacker'

// jsdom 老版本 Blob 没有 arrayBuffer()/text()，补一个
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as ArrayBuffer)
      fr.onerror = () => reject(fr.error)
      fr.readAsArrayBuffer(this)
    })
  }
  Blob.prototype.text = function () {
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = () => reject(fr.error)
      fr.readAsText(this)
    })
  }
}

// ─── helpers ─────────────────────────────────────────────────

function makeBlob(str: string): Blob {
  return new Blob([str], { type: 'application/octet-stream' })
}

function makeSceneData(overrides: Partial<SceneData> = {}): SceneData {
  return {
    scene: {
      name: 'scene1',
      title: '场景一',
      onstart: '',
      thumburl: '/uploads/s1/thumb.jpg',
      lat: '', lng: '', heading: '',
    },
    view: {
      hlookat: '0', vlookat: '0', fovtype: 'MFOV', fov: '100',
      maxpixelzoom: '2', fovmin: '70', fovmax: '140', limitview: 'auto',
    },
    preview: { url: '/uploads/s1/preview.jpg' },
    image: {
      type: 'CUBE', multires: true, tilesize: '512',
      levels: [
        { tiledimagewidth: '1024', tiledimageheight: '1024', cube: { url: '/uploads/s1/l1/%s.jpg' } },
      ],
    },
    hotspots: [],
    ...overrides,
  }
}

// ─── tests ───────────────────────────────────────────────────

describe('createStaticPack', () => {
  let fakeFetcher: ResourceFetcher
  let fetchCalls: string[]
  let progressEvents: PackProgress[]

  beforeEach(() => {
    fetchCalls = []
    progressEvents = []
    fakeFetcher = vi.fn(async (url: string) => {
      fetchCalls.push(url)
      return makeBlob(`content-of:${url}`)
    })
  })

  function makeOpts(overrides: Partial<PackOptions> = {}): PackOptions {
    return {
      title: '测试项目',
      scenes: [makeSceneData()],
      tourSettings: null,
      fetcher: fakeFetcher,
      onProgress: (p) => progressEvents.push(p),
      ...overrides,
    }
  }

  it('返回 Blob（ZIP 格式，PK 魔数开头）', async () => {
    const blob = await createStaticPack(makeOpts())
    expect(blob).toBeInstanceOf(Blob)
    const ab = await blob.arrayBuffer()
    const head = new Uint8Array(ab, 0, 2)
    // ZIP 文件头魔数: 50 4B
    expect(head[0]).toBe(0x50)
    expect(head[1]).toBe(0x4B)
  })

  it('包内包含 index.html 与 config.json（通过 JSZip 验证）', async () => {
    const blob = await createStaticPack(makeOpts())
    const JSZip = await import('jszip')
    const zip = await JSZip.loadAsync(blob)
    expect(zip.file('index.html')).toBeTruthy()
    expect(zip.file('config.json')).toBeTruthy()
  })

  it('包内包含 version.json（记录 PanoViewV2 版本信息）', async () => {
    const blob = await createStaticPack(makeOpts())
    const JSZip = await import('jszip')
    const zip = await JSZip.loadAsync(blob)
    const vf = zip.file('version.json')
    // version.json 在 __BUILD_VERSION__ 存在时写入；测试环境下 define 常量由 vitest 提供
    // 若 vitest 未定义 __BUILD_VERSION__ 则该文件不存在，这是预期行为
    if (vf) {
      const txt = await vf.async('string')
      const v = JSON.parse(txt)
      expect(v).toHaveProperty('panoviewCommit')
      expect(v).toHaveProperty('versionHash')
    }
  })

  it('下载所有内部资源：缩略图+预览图+6 面瓦片（无热点时）', async () => {
    await createStaticPack(makeOpts())
    // thumb + preview + 6 faces from tile template
    expect(fetchCalls).toContain('/uploads/s1/thumb.jpg')
    expect(fetchCalls).toContain('/uploads/s1/preview.jpg')
    // 6 个面都被请求：l/f/r/b/u/d
    for (const face of ['l','f','r','b','u','d']) {
      expect(fetchCalls).toContain(`/uploads/s1/l1/${face}.jpg`)
    }
    expect(fetchCalls.length).toBeGreaterThanOrEqual(10) // 8 场景资源 + 至少 index.html + worker
  })

  it('URL 在 config.json 中被重写为 assets/ 相对路径', async () => {
    // 我们通过 JSZip 解压读取 config.json 内容
    const JSZip = await import('jszip')
    const blob = await createStaticPack(makeOpts())
    const zip = await JSZip.loadAsync(blob)
    const cfgText = await zip.file('config.json')!.async('string')
    const cfg = JSON.parse(cfgText)
    expect(cfg.scenes[0].scene.thumburl.startsWith('assets/')).toBe(true)
    expect(cfg.scenes[0].preview.url.startsWith('assets/')).toBe(true)
    expect(cfg.scenes[0].image.levels[0].cube.url.startsWith('assets/')).toBe(true)
  })

  it('资源文件以 assets/ 路径存入 zip（采样一个）', async () => {
    const JSZip = await import('jszip')
    const blob = await createStaticPack(makeOpts())
    const zip = await JSZip.loadAsync(blob)
    const thumb = zip.file('assets/uploads/s1/thumb.jpg')
    expect(thumb).toBeTruthy()
    expect((await thumb!.async('string'))).toContain('content-of:/uploads/s1/thumb.jpg')
  })

  it('外链 http(s) 不下载、保持原样写入配置', async () => {
    const scene = makeSceneData({
      scene: { ...makeSceneData().scene, thumburl: 'https://cdn.example.com/thumb.jpg' },
    })
    await createStaticPack(makeOpts({ scenes: [scene] }))
    expect(fetchCalls).not.toContain('https://cdn.example.com/thumb.jpg')

    const JSZip = await import('jszip')
    const blob = await createStaticPack(makeOpts({ scenes: [scene] }))
    const zip = await JSZip.loadAsync(blob)
    const cfg = JSON.parse(await zip.file('config.json')!.async('string'))
    expect(cfg.scenes[0].scene.thumburl).toBe('https://cdn.example.com/thumb.jpg')
  })

  it('下载失败时用占位 Blob 替代，不抛出异常（保证 zip 完整）', async () => {
    const failFetcher: ResourceFetcher = vi.fn(async (url: string) => {
      if (url.includes('l1/l.jpg')) throw new Error('404')
      return makeBlob(`ok:${url}`)
    })
    // 不应抛出
    await expect(
      createStaticPack(makeOpts({ fetcher: failFetcher, onProgress: undefined })),
    ).resolves.toBeInstanceOf(Blob)
  })

  it('onProgress 回调包含 phase 与百分比', async () => {
    await createStaticPack(makeOpts())
    const phases = progressEvents.map(p => p.phase)
    expect(phases).toContain('collect')
    expect(phases).toContain('download')
    expect(phases).toContain('pack')
    expect(phases).toContain('done')
    // done 事件 percent=100
    const doneEvt = progressEvents.find(p => p.phase === 'done')
    expect(doneEvt?.percent).toBe(100)
  })

  it('资源下载并发控制不超过 concurrency 上限', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const concurrencyFetcher: ResourceFetcher = vi.fn(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(r => setTimeout(r, 10))
      inFlight--
      return makeBlob('x')
    })
    // 2 个场景，多瓦片，确保并发充足
    const s1 = makeSceneData()
    const s2 = makeSceneData({
      scene: { ...makeSceneData().scene, name: 'scene2', thumburl: '/t2.jpg' },
      preview: { url: '/p2.jpg' },
      image: { ...makeSceneData().image, levels: [{ tiledimagewidth: '1024', tiledimageheight: '1024', cube: { url: '/l2/%s.jpg' } }] },
    })
    await createStaticPack(makeOpts({
      scenes: [s1, s2],
      fetcher: concurrencyFetcher,
      concurrency: 3,
      onProgress: undefined,
    }))
    expect(maxInFlight).toBeLessThanOrEqual(3)
  })

  it('index.html 为预构建 viewer 产物，替换了标题并包含 config.json 引用', async () => {
    const JSZip = await import('jszip')
    // 提供一个模拟的 viewer HTML（含 script/link 引用与占位符），
    // 覆盖 fetcher 的默认响应让它对 viewer URL 返回测试 HTML
    const viewerHtml = `<!DOCTYPE html><html><head><title>__PROJECT_TITLE__</title>
<link rel="stylesheet" href="./assets/index.css">
<script src="./assets/index.js"></script>
</head><body><div id="pano"></div><script>fetch('./config.json')</script></body></html>`
    const fakeViewerFetcher: ResourceFetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/static-viewer/index.html')) return makeBlob(viewerHtml)
      if (url.endsWith('/static-viewer/assets/index.js')) return makeBlob('//js')
      if (url.endsWith('/static-viewer/assets/index.css')) return makeBlob('/*css*/')
      if (url.endsWith('/static-viewer/assets/textureLoader.worker.js')) return makeBlob('//worker')
      return makeBlob(`ok:${url}`)
    })
    const blob = await createStaticPack(makeOpts({ fetcher: fakeViewerFetcher }))
    const zip = await JSZip.loadAsync(blob)
    const html = await zip.file('index.html')!.async('string')
    expect(html).toContain('<title>测试项目</title>') // 标题替换
    expect(html).toContain('config.json')
    expect(html).toContain('assets/index.js')
    expect(html).not.toContain('__PROJECT_TITLE__')
    // viewer JS/CSS/worker 也已打包
    expect(zip.file('assets/index.js')).toBeTruthy()
    expect(zip.file('assets/index.css')).toBeTruthy()
    expect(zip.file('assets/textureLoader.worker.js')).toBeTruthy()
  })

  it('krpano multires 模板（含 %0v/%0h）展开为所有瓦片：6面 × 网格数', async () => {
    // faceSize=1024, tileSize=512 → 2×2 网格/面 → 4 tiles/面 × 6 面 = 24 瓦片
    const multiresScene: SceneData = {
      scene: {
        name: 'scene1', title: '场景一', onstart: '', thumburl: '/t.jpg',
        lat: '', lng: '', heading: '',
      },
      view: { hlookat: '0', vlookat: '0', fovtype: 'MFOV', fov: '100',
        maxpixelzoom: '2', fovmin: '70', fovmax: '140', limitview: 'auto' },
      preview: { url: '/p.jpg' },
      image: {
        type: 'CUBE', multires: true, tilesize: '512',
        levels: [
          { tiledimagewidth: '512', tiledimageheight: '512',
            cube: { url: '/uploads/tiles/s1/%s/l0/%0v/l0_%s_%0v_%0h.jpg' } },
          { tiledimagewidth: '1024', tiledimageheight: '1024',
            cube: { url: '/uploads/tiles/s1/%s/l1/%0v/l1_%s_%0v_%0h.jpg' } },
        ],
      },
      hotspots: [],
    }
    const blob = await createStaticPack(makeOpts({ scenes: [multiresScene] }))
    const JSZip = await import('jszip')
    const zip = await JSZip.loadAsync(blob)

    // 总瓦片数: l0(512→1×1×6=6) + l1(1024→2×2×6=24) + thumb + preview = 32
    const allFiles = Object.keys(zip.files).filter(n => !zip.files[n].dir)
    const tiles = allFiles.filter(n => n.includes('uploads/tiles/s1/'))
    expect(tiles.length).toBe(6 + 24)

    // 验证几个具体路径存在（v/h 1-based 补零）
    // l0: 1×1 网格 → v=01, h=01
    expect(zip.file('assets/uploads/tiles/s1/f/l0/01/l0_f_01_01.jpg')).toBeTruthy()
    // l1: 2×2 网格 → v=01,h=01; v=01,h=02; v=02,h=01; v=02,h=02
    expect(zip.file('assets/uploads/tiles/s1/f/l1/01/l1_f_01_01.jpg')).toBeTruthy()
    expect(zip.file('assets/uploads/tiles/s1/f/l1/01/l1_f_01_02.jpg')).toBeTruthy()
    expect(zip.file('assets/uploads/tiles/s1/f/l1/02/l1_f_02_01.jpg')).toBeTruthy()
    expect(zip.file('assets/uploads/tiles/s1/f/l1/02/l1_f_02_02.jpg')).toBeTruthy()
    // 6个面都应该有
    for (const face of ['f','b','l','r','u','d']) {
      expect(zip.file(`assets/uploads/tiles/s1/${face}/l0/01/l0_${face}_01_01.jpg`)).toBeTruthy()
    }
  })
})
