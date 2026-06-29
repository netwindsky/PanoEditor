import { describe, it, expect } from 'vitest'
import { parsePoints, serializePoints, type QuadPoint } from './quadPoints'

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
