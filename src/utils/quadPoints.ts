/** quad 四边形的单个顶点（球坐标，单位：度） */
export interface QuadPoint {
  ath: number
  atv: number
}

/** 分隔符：空格 / 逗号 / 竖线（与引擎 split(/[\s,|]+/) 对齐） */
const SEPARATOR = /[\s,|]+/

/**
 * 把引擎的 points 字符串 "ath1 atv1 ath2 atv2 ath3 atv3 ath4 atv4"
 * 解析为 4 个顶点。顺序：左上、右上、右下、左下。
 *
 * 容错：空/无效/数字不足 8 个 → 返回空数组（交由上层兜底，不抛错）。
 */
export function parsePoints(points: string | undefined | null): QuadPoint[] {
  if (!points) return []
  const nums = points
    .trim()
    .split(SEPARATOR)
    .map(Number)
  if (nums.length < 8 || nums.some((n) => Number.isNaN(n))) return []
  return [
    { ath: nums[0], atv: nums[1] },
    { ath: nums[2], atv: nums[3] },
    { ath: nums[4], atv: nums[5] },
    { ath: nums[6], atv: nums[7] },
  ]
}

/**
 * 把 4 个顶点序列化回引擎的空格分隔字符串。
 * 与 parsePoints 互为逆运算。
 */
export function serializePoints(pts: QuadPoint[]): string {
  return pts.flatMap((p) => [p.ath, p.atv]).join(' ')
}
