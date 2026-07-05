import type { Project, Scene, Hotspot, TourSettings, OverlayLayer } from '@/types'

/**
 * imageConfig JSON 中单个 level 结构（后端切片流水线写入格式）
 * 与 PanoViewV2/SceneParser.ImageLevel 对齐
 */
interface ImageLevelConfig {
  tiledimagewidth?: number | string
  tiledimageheight?: number | string
  cube?: { url?: string }
}

/** imageConfig JSON 顶层结构 */
interface ImageConfigJson {
  type?: string
  multires?: boolean
  tilesize?: number | string
  levels?: ImageLevelConfig[]
  /** 简单立方体：直接 url */
  url?: string
  cube?: { url?: string }
}

const DEFAULT_SKIN_URL = 'skin/vtourskin.xml'

/**
 * 将编辑器数据序列化为 krpano XML 格式（对齐 vtour 模板）
 *
 * @param project 当前项目（用于 title）
 * @param scenes 场景列表（已按 sortOrder 排序也可，内部会再排一次）
 * @param settings 全局漫游配置
 * @param hotspots 所有场景的热点列表（按 sceneId 分组）
 * @param options 可选：skinUrl 覆盖默认皮肤路径
 * @returns krpano XML 字符串
 */
export function exportToKrpanoXml(
  project: Project,
  scenes: Scene[],
  settings: TourSettings | null,
  hotspots: Hotspot[] = [],
  options: { skinUrl?: string } = {},
): string {
  const lines: string[] = []
  const title = project.name || 'Virtual Tour'
  const skinUrl = options.skinUrl || DEFAULT_SKIN_URL

  // krpano 根标签（对齐参考：version="1.19" title="..."）
  lines.push(`<krpano version="1.19" title="${escapeXml(title)}">`)
  lines.push('')

  // skin include
  lines.push(`\t<include url="${escapeXml(skinUrl)}" />`)
  lines.push('')

  // skin_settings（参考里有很长一串属性；这里只写出编辑器可配置的关键字段，其它保持 krpano 默认）
  if (settings) {
    const tooltips = settings.tooltips ? 'true' : 'false'
    const skinAttrs = [
      `maps="false"`,
      `gyro="true"`,
      `webvr="true"`,
      `littleplanetintro="false"`,
      `title="true"`,
      `thumbs="${settings.thumbs ? 'true' : 'false'}"`,
      `tooltips="${tooltips}"`,
      `tooltips_buttons="${tooltips}"`,
      `tooltips_thumbs="${tooltips}"`,
      `tooltips_hotspots="${tooltips}"`,
      `deeplinking="false"`,
      `loadscene_flags="MERGE"`,
      settings.loadsceneBlend
        ? `loadscene_blend="${escapeXml(settings.loadsceneBlend)}"`
        : `loadscene_blend="OPENBLEND(0.5, 0.0, 0.75, 0.05, linear)"`,
      `controlbar="${settings.controlbar ? 'true' : 'false'}"`,
      `design_bgcolor="0x2D3E50"`,
      `design_bgalpha="0.8"`,
    ].join(' ')
    lines.push(`\t<skin_settings ${skinAttrs} />`)
    lines.push('')
  }

  // layers（覆盖层）
  const layers = (settings as (TourSettings & { layers?: OverlayLayer[] }) | null)?.layers
  if (layers && layers.length > 0) {
    for (const layer of layers) {
      const layerAttrs = [
        `name="${escapeXml(layer.name)}"`,
        layer.type ? `type="${escapeXml(layer.type)}"` : '',
        layer.url ? `url="${escapeXml(layer.url)}"` : '',
        layer.html != null ? `html="${escapeXml(layer.html)}"` : '',
        layer.css ? `css="${escapeXml(layer.css)}"` : '',
        layer.align ? `align="${escapeXml(layer.align)}"` : '',
        layer.x != null ? `x="${layer.x}"` : '',
        layer.y != null ? `y="${layer.y}"` : '',
        layer.width ? `width="${escapeXml(layer.width)}"` : '',
        layer.height ? `height="${escapeXml(layer.height)}"` : '',
        layer.scale != null ? `scale="${layer.scale}"` : '',
        `visible="${layer.visible ? 'true' : 'false'}"`,
        layer.background != null ? `background="${layer.background ? 'true' : 'false'}"` : '',
        layer.border != null ? `border="${layer.border ? 'true' : 'false'}"` : '',
        layer.enabled != null ? `enabled="${layer.enabled ? 'true' : 'false'}"` : '',
        layer.vcenter != null ? `vcenter="${layer.vcenter ? 'true' : 'false'}"` : '',
        layer.onclick ? `onclick="${escapeXml(layer.onclick)}"` : '',
      ].filter(Boolean).join(' ')
      lines.push(`\t<layer ${layerAttrs} />`)
    }
    if (layers.length > 0) lines.push('')
  }

  // startup action（含 autorun="onstart"，与参考一致）
  lines.push('\t<action name="startup" autorun="onstart">')
  lines.push('\t\tif(startscene === null OR !scene[get(startscene)], copy(startscene,scene[0].name); );')
  if (settings?.autoRotate) {
    lines.push('\t\tset(autorotate.enabled,true);')
    lines.push(`\t\tset(autorotate.speed,${settings.autoRotateSpeed});`)
  }
  if (settings?.loadsceneBlend) {
    lines.push(`\t\tloadscene(get(startscene), null, MERGE, ${settings.loadsceneBlend});`)
  } else {
    lines.push('\t\tloadscene(get(startscene), null, MERGE);')
  }
  lines.push('\t\tif(startactions !== null, startactions() );')
  lines.push('\t</action>')
  lines.push('')

  // 按 sortOrder 排序场景
  const sortedScenes = [...scenes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  // 按 sceneId 分组热点
  const hotspotsByScene = new Map<string, Hotspot[]>()
  for (const hs of hotspots) {
    const list = hotspotsByScene.get(hs.sceneId) || []
    list.push(hs)
    hotspotsByScene.set(hs.sceneId, list)
  }

  // scenes
  for (const scene of sortedScenes) {
    const location = scene.location ?? {}
    const { lat, lng, heading } = location

    const sceneAttrs = [
      `name="${escapeXml(scene.name)}"`,
      scene.title ? `title="${escapeXml(scene.title)}"` : '',
      scene.onstart ? `onstart="${escapeXml(scene.onstart)}"` : 'onstart=""',
      scene.thumbUrl ? `thumburl="${escapeXml(scene.thumbUrl)}"` : '',
      lat != null ? `lat="${lat}"` : 'lat=""',
      lng != null ? `lng="${lng}"` : 'lng=""',
      heading != null ? `heading="${heading}"` : 'heading=""',
    ].filter(Boolean).join(' ')

    lines.push(`\t<scene ${sceneAttrs}>`)
    lines.push('')

    // view
    const iv = scene.initialView
    const viewAttrs = [
      `hlookat="${formatNum(iv.yaw)}"`,
      `vlookat="${formatNum(iv.pitch)}"`,
      `fovtype="${iv.fovType}"`,
      `fov="${formatNum(iv.hfov)}"`,
      `maxpixelzoom="${formatNum(iv.maxPixelZoom)}"`,
      `fovmin="${formatNum(iv.fovMin)}"`,
      `fovmax="${formatNum(iv.fovMax)}"`,
      `limitview="${iv.limitView}"`,
    ].join(' ')
    lines.push(`\t\t<view ${viewAttrs} />`)

    // preview
    if (scene.previewUrl) {
      lines.push('')
      lines.push(`\t\t<preview url="${escapeXml(scene.previewUrl)}" />`)
    }

    // image（支持后端切片后的 multires JSON，也兼容简单字符串 cube url）
    const imageBlock = buildImageBlock(scene.imageConfig)
    if (imageBlock) {
      lines.push('')
      lines.push(...imageBlock.map((l) => `\t\t${l}`))
    }

    // hotspots
    const sceneHotspots = hotspotsByScene.get(scene.id) || []
    if (sceneHotspots.length > 0) {
      lines.push('')
      for (const hs of sceneHotspots) {
        const hsAttrs = [
          `name="${escapeXml(hs.name)}"`,
          hs.style ? `style="${escapeXml(hs.style)}"` : '',
          `ath="${formatNum(hs.ath)}"`,
          `atv="${formatNum(hs.atv)}"`,
          hs.url ? `url="${escapeXml(hs.url)}"` : '',
          attrIfNum('width', hs.width),
          attrIfNum('height', hs.height),
          attrIfNum('scale', hs.scale),
          attrIfNum('rotate', hs.rotate),
          hs.blendmode ? `blendmode="${escapeXml(hs.blendmode)}"` : '',
          hs.bgcolor ? `bgcolor="${escapeXml(hs.bgcolor)}"` : '',
          hs.linkedSceneId ? `linkedscene="${escapeXml(hs.linkedSceneId)}"` : '',
          hs.tooltip ? `tooltip="${escapeXml(hs.tooltip)}"` : '',
          hs.onclick ? `onclick="${escapeXml(hs.onclick)}"` : '',
          hs.shader ? `shader="${escapeXml(hs.shader)}"` : '',
          (hs as Hotspot & { events?: string }).events
            ? `events="${escapeXml((hs as Hotspot & { events?: string }).events!)}"`
            : '',
          attrIfBool('followzoom', hs.followZoom),
          attrIfBool('visible', hs.visible),
          hs.tolerance != null ? `tolerance="${hs.tolerance}"` : '',
          hs.feather != null ? `feather="${hs.feather}"` : '',
        ].filter(Boolean).join(' ')
        lines.push(`\t\t<hotspot ${hsAttrs} />`)
      }
    }

    lines.push('')
    lines.push('\t</scene>')
  }

  lines.push('</krpano>')
  return lines.join('\n')
}

// ============ 内部辅助 ============

function buildImageBlock(imageConfig: string): string[] | null {
  if (!imageConfig) return null

  // 尝试解析为 multires JSON
  const parsed = safeParseImageConfig(imageConfig)
  if (parsed && parsed.levels && Array.isArray(parsed.levels) && parsed.levels.length > 0) {
    const out: string[] = []
    const imgAttrs = [
      parsed.type ? `type="${escapeXml(String(parsed.type))}"` : 'type="CUBE"',
      parsed.multires ? 'multires="true"' : '',
      parsed.tilesize != null ? `tilesize="${parsed.tilesize}"` : 'tilesize="512"',
    ].filter(Boolean).join(' ')
    out.push(`<image ${imgAttrs}>`)
    // 按分辨率从大到小输出（l4→l1 约定），与参考 XML 一致
    const levels = [...parsed.levels].sort((a, b) => {
      const wa = Number(a.tiledimagewidth) || 0
      const wb = Number(b.tiledimagewidth) || 0
      return wb - wa
    })
    for (const lv of levels) {
      const w = lv.tiledimagewidth
      const h = lv.tiledimageheight ?? lv.tiledimagewidth
      const url = lv.cube?.url
      out.push(`\t<level tiledimagewidth="${w}" tiledimageheight="${h}">`)
      if (url) out.push(`\t\t<cube url="${escapeXml(String(url))}" />`)
      out.push('\t</level>')
    }
    out.push('</image>')
    return out
  }

  // 降级：直接作为 cube url
  return [
    '<image>',
    `\t<cube url="${escapeXml(imageConfig)}" />`,
    '</image>',
  ]
}

function safeParseImageConfig(raw: string): ImageConfigJson | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    return JSON.parse(trimmed) as ImageConfigJson
  } catch {
    return null
  }
}

function attrIfNum(name: string, value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return `${name}="${formatNum(value)}"`
}

function attrIfBool(name: string, value: boolean | undefined): string {
  if (value == null) return ''
  return `${name}="${value ? 'true' : 'false'}"`
}

function formatNum(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '0'
  // 保留 3 位小数，去掉尾随 0，与参考 XML 风格接近（209.605 / 120.000 / 0）
  if (Number.isInteger(v)) return String(v)
  return Number(v.toFixed(3)).toString()
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
