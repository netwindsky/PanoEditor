import { describe, it, expect } from 'vitest'
import {
  buildHotspotParams,
  buildHotspotXml,
  DEFAULT_IMAGE_HOTSPOT_URL,
  PLACEHOLDER_QUAD_URL,
} from './hotspotFactory'
import type { Hotspot } from '@/types'

describe('buildHotspotParams', () => {
  it('info 类型不含 url/points，但带默认 pulsing-dot 样式', () => {
    const p = buildHotspotParams('info', 10, 20)
    expect(p.type).toBe('info')
    expect(p.name).toBeTruthy()
    expect(p.ath).toBe(10)
    expect(p.atv).toBe(20)
    expect(p.url).toBeUndefined()
    expect(p.points).toBeUndefined()
    // 显式指定默认样式，避免依赖 adapter 隐式兜底，规范新建数据
    expect(p.style).toBe('pulsing-dot')
  })

  it('image 类型默认使用 custom-image 样式并给出可见尺寸，与 info 点标注区分开', () => {
    const p = buildHotspotParams('image', 0, 0)
    expect(p.type).toBe('image')
    expect(p.style).toBe('custom-image')
    expect(p.url).toBe(DEFAULT_IMAGE_HOTSPOT_URL)
    expect(p.width).toBeGreaterThan(0)
    expect(p.height).toBeGreaterThan(0)
    expect(p.points).toBeUndefined()
  })

  it('quad 类型同时带 points 与 url，避免 "missing points or url"', () => {
    const p = buildHotspotParams('quad', 0, 0)
    expect(p.type).toBe('quad')
    expect(p.url).toBe(PLACEHOLDER_QUAD_URL)
    expect(p.points).toBeTruthy()
    // points 必须是 8 个数字（4 个顶点）
    const nums = p.points!.trim().split(/\s+/).map(Number)
    expect(nums).toHaveLength(8)
    expect(nums.every((n) => !Number.isNaN(n))).toBe(true)
    expect(p.bgcolor).toBeTruthy()
  })

  it('quad 的 points 以传入的 ath/atv 为中心 ±5°', () => {
    const ath = 30
    const atv = -10
    const p = buildHotspotParams('quad', ath, atv)
    const [x1, y1, x2, y2, x3, y3, x4, y4] = p
      .points!.trim()
      .split(/\s+/)
      .map(Number)
    // 左上、右上、右下、左下
    expect(x1).toBe(ath - 5)
    expect(y1).toBe(atv - 5)
    expect(x2).toBe(ath + 5)
    expect(y2).toBe(atv - 5)
    expect(x3).toBe(ath + 5)
    expect(y3).toBe(atv + 5)
    expect(x4).toBe(ath - 5)
    expect(y4).toBe(atv + 5)
  })

  it('model 类型带非空 url', () => {
    const p = buildHotspotParams('model', 0, 0)
    expect(p.type).toBe('model')
    expect(p.url).toBeTruthy()
  })

  it('model 类型默认 url 是内置 glb 模型文件，而非图片占位 base64', () => {
    const p = buildHotspotParams('model', 0, 0)
    // 引擎 isModelUrl 要求 .glb/.gltf 后缀，GLTFLoader 才能加载
    expect(p.url).toMatch(/\.(glb|gltf)$/i)
    // 不能再用 quad 的 1x1 PNG 占位（GLTFLoader 无法加载图片，导致模型热点不可见）
    expect(p.url).not.toBe(PLACEHOLDER_QUAD_URL)
    expect(p.url.startsWith('data:')).toBe(false)
  })

  it('video 类型与 quad 一样包含 points 和占位 url，使引擎能创建 mesh 热点', () => {
    const p = buildHotspotParams('video', 0, 0)
    expect(p.type).toBe('video')
    expect(p.url).toBe(PLACEHOLDER_QUAD_URL)
    expect(p.points).toBeTruthy()
    const nums = p.points!.trim().split(/\s+/).map(Number)
    expect(nums).toHaveLength(8)
    expect(nums.every((n) => !Number.isNaN(n))).toBe(true)
    // 与 quad 的差异：无 bgcolor
    expect(p.bgcolor).toBeUndefined()
  })

  it('web 类型默认使用 DOM 版 custom-web 样式（4 点贴附），提供 url/width/height/points', () => {
    const ath = 30
    const atv = -10
    const p = buildHotspotParams('web', ath, atv)
    expect(p.type).toBe('web')
    // 关键：必须走 DOM custom-web（带 CSS matrix3d 4 点透视贴附），不是 custom-web-css3d（单点平面）
    expect(p.style).toBe('custom-web')
    // 需要 4 个顶点（8 个数字），createQuadHotspot 才能进入 WebHotspot 分支
    expect(p.points).toBeTruthy()
    const nums = p.points!.trim().split(/\s+/).map(Number)
    expect(nums).toHaveLength(8)
    expect(nums.every((n) => !Number.isNaN(n))).toBe(true)
    // url 默认给空白页，避免 iframe 真的加载外部站点
    expect(p.url).toBe('about:blank')
    // 宽度/高度必须是纯数字（不加 px），因为 DOM WebHotspot 的 baseWidth/baseHeight 走 parseFloat
    expect(typeof p.width).toBe('number')
    expect(typeof p.height).toBe('number')
    expect((p.width as number)!).toBeGreaterThan(0)
    expect((p.height as number)!).toBeGreaterThan(0)
    // 默认分辨率 16:9（640×360），符合视频/网页最常见比例
    expect(p.width / p.height).toBeCloseTo(16 / 9, 2)
    // 无 bgcolor（DOM web 不使用贴图）
    expect(p.bgcolor).toBeUndefined()
  })
})

describe('buildHotspotXml', () => {
  const makeHotspot = (overrides: Partial<Hotspot>): Hotspot => ({
    id: 'h1',
    sceneId: 's1',
    name: 'spot1',
    type: 'image',
    ath: 0,
    atv: 0,
    ...overrides,
  })

  it('空数组返回根标签包裹的字符串', () => {
    const xml = buildHotspotXml([])
    expect(xml).toContain('<krpano>')
    expect(xml).toContain('</krpano>')
  })

  it('单个热点生成一行 <hotspot/>，含 name/ath/atv', () => {
    const xml = buildHotspotXml([
      makeHotspot({ name: 'gif_spot1', ath: 12.345, atv: -6.7 }),
    ])
    expect(xml).toContain('<hotspot')
    expect(xml).toContain('name="gif_spot1"')
    // ath/atv 保留 2 位小数
    expect(xml).toContain('ath="12.35"')
    expect(xml).toContain('atv="-6.70"')
  })

  it('含 url 的热点在 XML 中输出 url 属性', () => {
    const xml = buildHotspotXml([
      makeHotspot({ name: 's', url: 'public/image/.gif' }),
    ])
    expect(xml).toContain('url="public/image/.gif"')
  })

  it('多个热点生成多行', () => {
    const xml = buildHotspotXml([
      makeHotspot({ id: 'a', name: 'a' }),
      makeHotspot({ id: 'b', name: 'b' }),
    ])
    const count = (xml.match(/<hotspot/g) || []).length
    expect(count).toBe(2)
  })
})
