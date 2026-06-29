import type { CreateHotspotParams, Hotspot, HotspotToolType } from '@/types'

/**
 * quad 占位贴图：1x1 半透明蓝色 PNG。
 * 用于新建 quad / image / model 时填充必需的 url 字段，
 * 避免 PanoViewV2 引擎抛出 "Quad hotspot missing points or url" 并拒绝创建。
 * 用户后续可在属性面板替换为真实图片。
 */
export const PLACEHOLDER_QUAD_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export const DEFAULT_IMAGE_HOTSPOT_URL = '/assets/images/image.jpg'

/** 各类型热点的默认名称 */
const DEFAULT_NAMES: Record<HotspotToolType, string> = {
  info: '信息点',
  scene: '场景跳转',
  image: '图片热点',
  quad: '矩形热点',
  model: '模型热点',
}

/**
 * 构造新建热点的参数（含各类型必需的默认值）。
 *
 * - quad：必须同时带 points（4 顶点 8 数字）与 url，否则引擎拒绝创建
 * - image / model：必须带非空 url（引擎 `if (!data.url) return` 校验）
 * - info / scene：仅基础字段
 */
export function buildHotspotParams(
  type: HotspotToolType,
  ath: number,
  atv: number,
): CreateHotspotParams {
  const base: CreateHotspotParams = {
    name: DEFAULT_NAMES[type] || '热点',
    type,
    ath,
    atv,
  }

  if (type === 'quad') {
    const d = 5 // 默认半边长（度）
    const points = [
      ath - d, atv - d, // 左上
      ath + d, atv - d, // 右上
      ath + d, atv + d, // 右下
      ath - d, atv + d, // 左下
    ].join(' ')
    return { ...base, points, url: PLACEHOLDER_QUAD_URL, bgcolor: '#3b82f6' }
  }

  if (type === 'image') {
    // image 是 DOM 图片热点：必须显式使用 custom-image，并提供可见尺寸，
    // 否则 adapter 会把无 style 的热点兜底成 pulsing-dot，表现得像信息点。
    return { ...base, style: 'custom-image', url: DEFAULT_IMAGE_HOTSPOT_URL, width: 120, height: 80 }
  }

  if (type === 'model') {
    // model 需要非空 url 才能被引擎渲染
    return { ...base, url: PLACEHOLDER_QUAD_URL }
  }

  if (type === 'info') {
    // info 显式指定默认样式，规范新建数据。
    // 注意：pulsing-dot 容器尺寸为 0，渲染由 adapter 补 px 尺寸兜底（防 flex 压扁）。
    return { ...base, style: 'pulsing-dot' }
  }

  return base
}

/** 转义 XML 属性值中的特殊字符 */
function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 格式化球坐标为 2 位小数字符串 */
function fmt(n: number): string {
  return n.toFixed(2)
}

/**
 * 将热点列表导出为 krpano 风格的 XML 字符串（用于 Export XML to Console）。
 * 仅输出有值的字段，保持简洁。
 */
export function buildHotspotXml(hotspots: Hotspot[]): string {
  const lines = hotspots.map((h) => {
    const attrs: string[] = [
      `name="${escapeXmlAttr(h.name)}"`,
      `type="${h.type}"`,
      `ath="${fmt(h.ath)}"`,
      `atv="${fmt(h.atv)}"`,
    ]
    if (h.style) attrs.push(`style="${escapeXmlAttr(h.style)}"`)
    if (h.url) attrs.push(`url="${escapeXmlAttr(h.url)}"`)
    if (h.points) attrs.push(`points="${escapeXmlAttr(h.points)}"`)
    if (h.blendmode) attrs.push(`blendmode="${escapeXmlAttr(h.blendmode)}"`)
    if (h.scale != null) attrs.push(`scale="${h.scale}"`)
    if (h.rotate != null) attrs.push(`rotate="${h.rotate}"`)
    if (h.linkedSceneId) attrs.push(`linkedscene="${escapeXmlAttr(h.linkedSceneId)}"`)
    if (h.onclick) attrs.push(`onclick="${escapeXmlAttr(h.onclick)}"`)
    return `  <hotspot ${attrs.join(' ')} />`
  })
  return `<krpano>\n${lines.join('\n')}\n</krpano>`
}
