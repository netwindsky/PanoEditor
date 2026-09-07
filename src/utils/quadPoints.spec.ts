import { describe, it, expect } from 'vitest'
import { parsePoints, serializePoints, centerOfPoints, type QuadPoint } from './quadPoints'

/**
 * quad 四边形 points 字段：引擎格式为 8 个数字的字符串
 * "ath1 atv1 ath2 atv2 ath3 atv3 ath4 atv4"
 * 顶点顺序：左上、右上、右下、左下。
 * 分隔符兼容：空格 / 逗号 / 竖线（与引擎 split(/[\s,|]+/) 对齐）。
 * 属性面板需把它解析成 4 个 {ath,atv} 供坐标编辑器使用，再序列化回写。
 */
describe('parsePoints', () => {
  it('解析空格分隔的 8 数字字符串为 4 个顶点', () => {
    const pts = parsePoints('10 20 30 40 50 60 70 80')
    expect(pts).toEqual([
      { ath: 10, atv: 20 },
      { ath: 30, atv: 40 },
      { ath: 50, atv: 60 },
      { ath: 70, atv: 80 },
    ])
  })

  it('兼容逗号与竖线分隔', () => {
    expect(parsePoints('1,2,3,4,5,6,7,8')).toHaveLength(4)
    expect(parsePoints('1|2|3|4|5|6|7|8')).toHaveLength(4)
    expect(parsePoints('1, 2 |3,4 5|6  7 8')[3]).toEqual({ ath: 7, atv: 8 })
  })

  it('空/无效输入返回空数组而非抛错', () => {
    expect(parsePoints('')).toEqual([])
    expect(parsePoints(undefined)).toEqual([])
    expect(parsePoints('not numbers')).toEqual([])
  })

  it('数字不足 8 个时返回空数组（数据非法，交给上层兜底）', () => {
    expect(parsePoints('1 2 3 4')).toEqual([])
  })
})

describe('serializePoints', () => {
  it('4 个顶点序列化为空格分隔的 8 数字字符串', () => {
    const pts: QuadPoint[] = [
      { ath: 10, atv: 20 },
      { ath: 30, atv: 40 },
      { ath: 50, atv: 60 },
      { ath: 70, atv: 80 },
    ]
    expect(serializePoints(pts)).toBe('10 20 30 40 50 60 70 80')
  })

  it('保留小数（坐标可能非整数）', () => {
    const pts: QuadPoint[] = [
      { ath: 10.5, atv: -20.25 },
      { ath: 30, atv: 40 },
      { ath: 50, atv: 60 },
      { ath: 70, atv: 80 },
    ]
    expect(serializePoints(pts)).toBe('10.5 -20.25 30 40 50 60 70 80')
  })

  it('parse 与 serialize 互为逆运算（round-trip）', () => {
    const original = '5 -5 15 -5 15 5 5 5'
    expect(serializePoints(parsePoints(original))).toBe(original)
  })
})

describe('centerOfPoints', () => {
  it('返回 4 顶点的中心（向量平均后转回球面角）', () => {
    const c = centerOfPoints(parsePoints('10 -10 20 -10 20 10 10 10'))
    expect(c!.ath).toBeCloseTo(15, 5)
    expect(c!.atv).toBeCloseTo(0, 5)
  })

  it('points 为空/无效时返回 null', () => {
    expect(centerOfPoints(parsePoints(''))).toBeNull()
    expect(centerOfPoints([])).toBeNull()
  })

  it('跨 ±180° 边界时取最短弧路径的中心（避免 -170 与 170 平均成 0）', () => {
    const c = centerOfPoints(parsePoints('170 -10 -170 -10 -170 10 170 10'))
    // 顶点横跨 ±180°，中心应接近 180（即 ±180 方向），而非 0
    expect(Math.abs(c!.ath)).toBeGreaterThan(170)
    expect(c!.atv).toBeCloseTo(0, 6)
  })

  it('顶点整体位于画面上方（atv 全负）时中心 atv 必须为负（与放置公式 y=-sin(atv) 反算一致）', () => {
    // 4 顶点 atv 在 -20 ~ -10 之间（引擎约定 atv 负=画面上方）
    const c = centerOfPoints(parsePoints('0 -20 10 -20 10 -10 0 -10'))
    expect(c!.ath).toBeCloseTo(5, 0)
    // 中心在上方 → atv 必须为负；若反算符号错误会得到 +15 左右
    expect(c!.atv).toBeLessThan(0)
    expect(c!.atv).toBeCloseTo(-15, 0)
  })

  it('顶点整体位于画面下方（atv 全正）时中心 atv 必须为正', () => {
    const c = centerOfPoints(parsePoints('0 10 10 10 10 20 0 20'))
    expect(c!.atv).toBeGreaterThan(0)
    expect(c!.atv).toBeCloseTo(15, 0)
  })
})
