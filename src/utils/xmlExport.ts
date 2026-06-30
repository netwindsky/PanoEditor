import type { Project, Scene, Hotspot, TourSettings, SceneViewConfig, OverlayLayer } from '@/types'

/**
 * 将编辑器数据序列化为 krpano XML 格式
 *
 * @param project 当前项目
 * @param scenes 场景列表
 * @param settings 全局漫游配置
 * @param hotspots 所有场景的热点列表（按 sceneId 分组）
 * @returns krpano XML 字符串
 */
export function exportToKrpanoXml(
  project: Project,
  scenes: Scene[],
  settings: TourSettings | null,
  hotspots: Hotspot[] = [],
): string {
  const lines: string[] = []

  // krpano 根标签
  lines.push('<krpano version="1.20">')

  // skin_settings
  if (settings) {
    const skinAttrs = [
      `controlbar="${settings.controlbar ? 'true' : 'false'}"`,
      `thumbs="${settings.thumbs ? 'true' : 'false'}"`,
      `tooltips="${settings.tooltips ? 'true' : 'false'}"`,
      `design="${escapeXml(settings.designStyle || 'flat')}"`,
    ].join(' ')
    lines.push(`  <skin_settings ${skinAttrs} />`)
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
      lines.push(`  <layer ${layerAttrs} />`)
    }
  }

  // startup action
  lines.push('  <action name="startup">')
  if (settings?.autoRotate) {
    lines.push(`    set(autorotate.enabled,true);`)
    lines.push(`    set(autorotate.speed,${settings.autoRotateSpeed});`)
  }
  if (settings?.loadsceneBlend) {
    lines.push(`    loadscene(get(scene[0].name), null, MERGE, ${settings.loadsceneBlend});`)
  } else {
    lines.push(`    loadscene(get(scene[0].name), null, MERGE);`)
  }
  lines.push('  </action>')

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
    // 解析 viewConfig 获取 GPS 坐标
    let lat: number | undefined
    let lng: number | undefined
    let heading: number | undefined
    let onstart: string | undefined

    if (scene.viewConfig) {
      try {
        const vc = JSON.parse(scene.viewConfig) as SceneViewConfig
        lat = vc.lat
        lng = vc.lng
        heading = vc.heading
        onstart = vc.onstart
      } catch {
        // ignore parse error
      }
    }

    // 回退到 scene 直接字段
    lat = lat ?? scene.lat
    lng = lng ?? scene.lng
    heading = heading ?? scene.heading

    const sceneAttrs = [
      `name="${escapeXml(scene.name)}"`,
      scene.title ? `title="${escapeXml(scene.title)}"` : '',
      scene.thumbUrl ? `thumburl="${escapeXml(scene.thumbUrl)}"` : '',
      lat != null ? `lat="${lat}"` : '',
      lng != null ? `lng="${lng}"` : '',
      heading != null ? `heading="${heading}"` : '',
      onstart ? `onstart="${escapeXml(onstart)}"` : '',
    ].filter(Boolean).join(' ')

    lines.push(`  <scene ${sceneAttrs}>`)

    // view
    const iv = scene.initialView
    const viewAttrs = [
      `hlookat="${iv.yaw}"`,
      `vlookat="${iv.pitch}"`,
      `fov="${iv.hfov}"`,
      iv.fovMin != null ? `fovmin="${iv.fovMin}"` : '',
      iv.fovMax != null ? `fovmax="${iv.fovMax}"` : '',
      iv.maxPixelZoom != null ? `maxpixelzoom="${iv.maxPixelZoom}"` : '',
      iv.limitView ? `limitview="${iv.limitView}"` : '',
      iv.fovType ? `fovtype="${iv.fovType}"` : '',
    ].filter(Boolean).join(' ')
    lines.push(`    <view ${viewAttrs} />`)

    // preview
    if (scene.previewUrl) {
      lines.push(`    <preview url="${escapeXml(scene.previewUrl)}" />`)
    }

    // image (tileset config)
    if (scene.imageConfig) {
      lines.push(`    <image>`)
      lines.push(`      <cube url="${escapeXml(scene.imageConfig)}" />`)
      lines.push(`    </image>`)
    }

    // hotspots
    const sceneHotspots = hotspotsByScene.get(scene.id) || []
    for (const hs of sceneHotspots) {
      const hsAttrs = [
        `name="${escapeXml(hs.name)}"`,
        hs.style ? `style="${escapeXml(hs.style)}"` : '',
        `ath="${hs.ath}"`,
        `atv="${hs.atv}"`,
        hs.url ? `url="${escapeXml(hs.url)}"` : '',
        hs.linkedSceneId ? `linkedscene="${escapeXml(hs.linkedSceneId)}"` : '',
        hs.tooltip ? `tooltip="${escapeXml(hs.tooltip)}"` : '',
        hs.onclick ? `onclick="${escapeXml(hs.onclick)}"` : '',
        hs.shader ? `shader="${escapeXml(hs.shader)}"` : '',
        (hs as Hotspot & { events?: string }).events ? `events="${escapeXml((hs as Hotspot & { events?: string }).events!)}"` : '',
      ].filter(Boolean).join(' ')
      lines.push(`    <hotspot ${hsAttrs} />`)
    }

    lines.push(`  </scene>`)
  }

  lines.push('</krpano>')
  return lines.join('\n')
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
