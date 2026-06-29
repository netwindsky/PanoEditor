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
