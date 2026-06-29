import { describe, it, expect } from 'vitest'
import { getVisibleFields, type HotspotField } from './hotspotFields'
import type { HotspotType } from '@/types'

/**
 * 字段可见性契约：不同热点类型在属性面板显示不同字段。
 * 这是本次重构的核心——修复“所有类型字段都长一样”的不合理 UI。
 */
describe('getVisibleFields', () => {
  // 所有类型共有的基础字段
  const COMMON: HotspotField[] = ['name', 'coords', 'action']

  function has(type: HotspotType, field: HotspotField): boolean {
    return getVisibleFields(type).includes(field)
  }

  it('所有类型都包含基础字段 name / coords / action', () => {
    const types: HotspotType[] = ['info', 'scene', 'image', 'quad', 'model']
    for (const t of types) {
      for (const f of COMMON) {
        expect(getVisibleFields(t)).toContain(f)
      }
    }
  })

  it('info 信息点：有 style 与 infoContent，无 url/scale/rotate/points/blendmode', () => {
    expect(has('info', 'style')).toBe(true)
    expect(has('info', 'infoContent')).toBe(true)
    expect(has('info', 'url')).toBe(false)
    expect(has('info', 'scale')).toBe(false)
    expect(has('info', 'rotate')).toBe(false)
    expect(has('info', 'points')).toBe(false)
    expect(has('info', 'blendmode')).toBe(false)
  })

  it('scene 场景跳转：有 style，无图片/几何字段（跳转目标由 action 选择框承载）', () => {
    expect(has('scene', 'style')).toBe(true)
    expect(has('scene', 'url')).toBe(false)
    expect(has('scene', 'points')).toBe(false)
    expect(has('scene', 'infoContent')).toBe(false)
  })

  it('image 图片：有 url(资源)/width/height/scale/rotate/blendmode，无 style/points/infoContent', () => {
    expect(has('image', 'url')).toBe(true)
    expect(has('image', 'width')).toBe(true)
    expect(has('image', 'height')).toBe(true)
    expect(has('image', 'scale')).toBe(true)
    expect(has('image', 'rotate')).toBe(true)
    expect(has('image', 'blendmode')).toBe(true)
    expect(has('image', 'style')).toBe(false)
    expect(has('image', 'points')).toBe(false)
    expect(has('image', 'infoContent')).toBe(false)
  })

  it('quad 四边形：有 url(贴图)/points(4顶点)/blendmode，无 bgcolor(用户明确去掉)/scale/style', () => {
    expect(has('quad', 'url')).toBe(true)
    expect(has('quad', 'points')).toBe(true)
    expect(has('quad', 'blendmode')).toBe(true)
    expect(has('quad', 'bgcolor')).toBe(false) // 用户微调：quad 不要背景色
    expect(has('quad', 'scale')).toBe(false)
    expect(has('quad', 'style')).toBe(false)
  })

  it('model 模型：有 url(模型文件)/scale/rotate，无 style/points/width/height/blendmode', () => {
    expect(has('model', 'url')).toBe(true)
    expect(has('model', 'scale')).toBe(true)
    expect(has('model', 'rotate')).toBe(true)
    expect(has('model', 'style')).toBe(false)
    expect(has('model', 'points')).toBe(false)
    expect(has('model', 'width')).toBe(false)
    expect(has('model', 'height')).toBe(false)
    expect(has('model', 'blendmode')).toBe(false)
  })

  it('未知类型回退到仅基础字段，不抛错', () => {
    const fields = getVisibleFields('unknown' as HotspotType)
    expect(fields).toEqual(expect.arrayContaining(COMMON))
  })
})
