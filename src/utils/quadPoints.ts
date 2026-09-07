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
 * 是否为"四边形几何"类热点（quad 贴图 / video 视频 / web 网页）。
 * 三者共用 4 顶点 points 与控制点编辑逻辑，仅渲染器不同：
 * - quad: 贴图 mesh
 * - video: 视频 mesh
 * - web: CSS3D iframe（引擎以 4 点中心为锚点放置）
 */
export function isQuadLike(type: HotspotType | string | undefined): boolean {
  return type === 'quad' || type === 'video' || type === 'web'
}

/** 判断 url 是否指向视频资源（容忍 query 串），用于阻止图片热点误选视频。 */
export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url.trim())
}

/**
 * 计算 4 顶点的中心（球面坐标）。
 *
 * ath 不能直接算术平均：顶点横跨 ±180° 边界时（如 -170 与 170），
 * 算术平均会得到错误的 0°。改用单位向量平均后再转回球面角：
 * x = -cos(atv)·sin(ath), y = -sin(atv), z = cos(atv)·cos(ath)，
 * 与引擎放置公式一致（HotspotManager.projectToScreen）。
 *
 * 反解注意符号：由 y = -sin(atv) 得 sin(atv) = -y，故 atv = asin(-y)；
 * 由 x = -cos(atv)·sin(ath)、z = cos(atv)·cos(ath) 得 ath = atan2(-x, z)。
 *
 * @returns 中心 { ath, atv }（ath 归一化到 (-180, 180]）；顶点为空返回 null
 */
export function centerOfPoints(points: QuadPoint[]): { ath: number; atv: number } | null {
  if (!points || points.length === 0) return null
  let sumX = 0
  let sumY = 0
  let sumZ = 0
  for (const p of points) {
    const radAth = (p.ath * Math.PI) / 180
    const radAtv = (p.atv * Math.PI) / 180
    sumX += -Math.cos(radAtv) * Math.sin(radAth)
    sumY += -Math.sin(radAtv)
    sumZ += Math.cos(radAtv) * Math.cos(radAth)
  }
  const n = points.length
  const x = sumX / n
  const y = sumY / n
  const z = sumZ / n
  // y = -sin(atv) → atv = asin(-y)（负号不可省，否则中心俯仰方向与实际相反）
  const atv = Math.asin(Math.max(-1, Math.min(1, -y))) * (180 / Math.PI)
  const ath = Math.atan2(-x, z) * (180 / Math.PI)
  return { ath, atv }
}
