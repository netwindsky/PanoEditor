import type { HotspotType } from '@/types'

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

/**
 * 是否为"四边形几何"类热点（quad 图片 或 video 视频）。
 * 两者共用 4 顶点 points 与控制点编辑逻辑，仅渲染器不同。
 */
export function isQuadLike(type: HotspotType | string | undefined): boolean {
  return type === 'quad' || type === 'video'
}

/** 判断 url 是否指向视频资源（容忍 query 串），用于阻止图片热点误选视频。 */
export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url.trim())
}
