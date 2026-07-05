/**
 * 项目静态化导出工具
 *
 * 将编辑器中的项目/场景/热点数据转换为可独立部署的静态包：
 * - config.json : PanoViewV2 兼容的 SceneData[] 配置 + 漫游设置
 * - assets/     : 全景图瓦片、热点资源（重写为相对路径）
 *
 * Viewer 入口 (index.html + assets/*.js/*.css/worker) 由 vite.config.viewer.ts
 * 预构建到 public/static-viewer/，运行时由 staticPacker 读取并打入 zip。
 *
 * 本模块只负责纯数据转换；资源下载、Viewer 打包与 zip 生成见 staticPacker.ts。
 */
import type { Project, Scene, Hotspot, TourSettings } from '@/types'
import type { SceneData } from '@panoview'

export const ASSET_DIR = 'assets/'

// ─── 路径清洗 ────────────────────────────────────────────────

/**
 * 将资源 URL 转换为 zip 内的安全相对路径。
 * - 绝对路径 `/foo/bar.jpg` → `assets/foo/bar.jpg`
 * - 去掉查询串 `?v=1`
 * - 阻止路径遍历 `../`
 */
export function sanitizeAssetPath(url: string): string {
  // 去 query / hash
  let path = url.split('?')[0].split('#')[0]
  // 外链原样返回（但调用方应该在之前就跳过外链）
  if (/^https?:\/\//i.test(path)) return path
  // 前导斜杠去掉
  if (path.startsWith('/')) path = path.slice(1)
  // 阻止路径遍历：把所有 ../ 和 ..\\ 压平
  path = path.replace(/\.\.([/\\])/g, '_/$1')
  // 以 assets/ 为根
  return ASSET_DIR + path
}

// ─── 场景 ID → name 映射 ────────────────────────────────────

function buildSceneIdMap(scenes: Scene[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const s of scenes) m.set(s.id, s.name)
  return m
}

// ─── 热点转换（Editor Hotspot → PanoViewV2 Hotspot） ────────

function convertHotspot(h: Hotspot, sceneIdToName: Map<string, string>): SceneData['hotspots'][number] {
  // linkedscene 用目标场景的 name（PanoViewV2 按 name 切换）
  let linkedscene = ''
  if (h.linkedSceneId) {
    linkedscene = sceneIdToName.get(h.linkedSceneId) || h.linkedSceneId
  }
  // 场景跳转热点若没写 onclick，自动补 changescene 命令（与编辑器 PanoEngineAdapter.toPanoHotspot 对齐）
  const onclick = h.onclick || (linkedscene ? `changescene('${linkedscene}')` : undefined)
  // DOM 点样式需要带 px 单位的宽高，否则容器 0 尺寸会把子元素压成细条
  const STYLES_NEEDING_FIXED_SIZE = ['pulsing-dot', 'glow-orb', 'info-icon', 'navi-point']
  const resolvedStyle = h.style || (h.type === 'image' ? 'custom-image' : 'pulsing-dot')
  const needsFixedSize = STYLES_NEEDING_FIXED_SIZE.includes(resolvedStyle)
  const DEFAULT_DOT_SIZE = '18px'
  const resolveSize = (raw: string | number | undefined): string | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined
    if (needsFixedSize) return /\d(px|%)$/.test(String(raw)) ? String(raw) : `${raw}px`
    return String(raw)
  }

  return {
    name: h.name,
    style: resolvedStyle,
    ath: String(h.ath ?? 0),
    atv: String(h.atv ?? 0),
    linkedscene,
    tooltip: h.tooltip || h.name,
    onclick,
    on: onclick,
    events: h.events,
    url: h.url,
    width: resolveSize(h.width) ?? (needsFixedSize ? DEFAULT_DOT_SIZE : undefined),
    height: resolveSize(h.height) ?? (needsFixedSize ? DEFAULT_DOT_SIZE : undefined),
    scale: h.scale !== undefined ? String(h.scale) : undefined,
    rotate: h.rotate !== undefined ? String(h.rotate) : undefined,
    type: h.type,
    blendmode: h.blendmode,
    followzoom: h.followZoom !== undefined ? String(h.followZoom) : undefined,
    shader: h.shader,
    bgcolor: h.bgcolor,
    tolerance: h.tolerance,
    feather: h.feather,
    content: h.content,
    points: (h as any).points,
  }
}

// ─── imageConfig 解析 ───────────────────────────────────────

interface ParsedImage {
  type: string
  multires: boolean
  tilesize: string
  levels: Array<{
    tiledimagewidth: string
    tiledimageheight: string
    cube: { url: string }
  }>
}

interface ParsedSceneConfig {
  image: ParsedImage
  /** 后端切片生成的 thumburl（来自 SceneData.scene.thumburl / thumb.url），优先于 Scene.thumbUrl */
  thumbUrl?: string
  /** 后端切片生成的 preview url（来自 preview.url），优先于 Scene.previewUrl */
  previewUrl?: string
}

/**
 * 解析 scene.imageConfig JSON。
 *
 * 兼容两种格式：
 * 1. 直接 image 配置（编辑器早期/test 用）：{type, multires, tilesize, levels:[...]}
 * 2. 后端 TileServiceImpl.generateConfigJson 产出的完整 SceneData：
 *    {scene:{thumburl}, thumb:{url}, preview:{url}, image:{type,multires,tilesize,levels:[...]}, hotspots:[]}
 */
function parseImageConfig(imageConfig: string | undefined): ParsedSceneConfig {
  const empty: ParsedSceneConfig = {
    image: { type: 'CUBE', multires: false, tilesize: '0', levels: [] },
  }
  if (!imageConfig) return empty
  try {
    const cfg = JSON.parse(imageConfig)
    // 后端 SceneData 格式，image 在 cfg.image 下
    const imgSrc = cfg.image ?? cfg
    const image: ParsedImage = {
      type: imgSrc.type || 'CUBE',
      multires: !!imgSrc.multires,
      tilesize: String(imgSrc.tilesize ?? '0'),
      levels: Array.isArray(imgSrc.levels)
        ? imgSrc.levels.map((lv: any) => ({
            tiledimagewidth: String(lv.tiledimagewidth ?? ''),
            tiledimageheight: String(lv.tiledimageheight ?? ''),
            cube: { url: lv.cube?.url ?? lv.url ?? '' },
          }))
        : imgSrc.url
          ? [{ tiledimagewidth: '0', tiledimageheight: '0', cube: { url: imgSrc.url } }]
          : imgSrc.cube?.url
            ? [{ tiledimagewidth: '0', tiledimageheight: '0', cube: { url: imgSrc.cube.url } }]
            : [],
    }
    return {
      image,
      thumbUrl: cfg.scene?.thumburl || cfg.thumb?.url || undefined,
      previewUrl: cfg.preview?.url || undefined,
    }
  } catch {
    return empty
  }
}

// ─── buildSceneDataList ──────────────────────────────────────

/**
 * 将编辑器的 Project/Scene/Hotspot 模型转换为 PanoViewV2 SceneData[] 数组。
 * URL 仍保留原始值（后续根据打包策略决定是否重写 / 下载）。
 */
export function buildSceneDataList(
  _project: Project,
  scenes: Scene[],
  hotspots: Hotspot[],
): SceneData[] {
  const sorted = [...scenes].sort((a, b) => a.sortOrder - b.sortOrder)
  const sceneIdToName = buildSceneIdMap(sorted)

  // 按 sceneId 预分组热点
  const hotspotsByScene = new Map<string, Hotspot[]>()
  for (const h of hotspots) {
    const arr = hotspotsByScene.get(h.sceneId) ?? []
    arr.push(h)
    hotspotsByScene.set(h.sceneId, arr)
  }

  return sorted.map((s) => {
    const parsed = parseImageConfig(s.imageConfig)
    const img = parsed.image
    const sceneHotspots = (hotspotsByScene.get(s.id) ?? []).map((h) =>
      convertHotspot(h, sceneIdToName),
    )

    // thumb/preview 优先使用 imageConfig 中后端切片生成的路径（如 /uploads/tiles/{id}/thumb.jpg）
    // 回退到 Scene 自身的 thumbUrl/previewUrl
    const thumburl = parsed.thumbUrl || s.thumbUrl || ''
    const previewUrl = parsed.previewUrl || s.previewUrl || ''

    return {
      scene: {
        name: s.name,
        title: s.title || s.name,
        onstart: s.onstart || '',
        thumburl,
        lat: s.location.lat !== undefined ? String(s.location.lat) : '',
        lng: s.location.lng !== undefined ? String(s.location.lng) : '',
        heading: s.location.heading !== undefined ? String(s.location.heading) : '',
      },
      view: {
        hlookat: String(s.initialView.yaw ?? 0),
        vlookat: String(s.initialView.pitch ?? 0),
        fovtype: s.initialView.fovType ?? 'MFOV',
        fov: String(s.initialView.hfov ?? 100),
        maxpixelzoom: String(s.initialView.maxPixelZoom ?? 2.0),
        fovmin: String(s.initialView.fovMin ?? 70),
        fovmax: String(s.initialView.fovMax ?? 140),
        limitview: s.initialView.limitView ?? 'auto',
      },
      preview: previewUrl ? { url: previewUrl } : undefined,
      image: img,
      hotspots: sceneHotspots,
    } satisfies SceneData
  })
}

// ─── collectResourceUrls ────────────────────────────────────

/** 立方体 6 个面的简写代码（与后端 TileServiceImpl.FACE_NAMES / krpano 一致：f/b/l/r/u/d） */
const CUBE_FACES = ['f', 'b', 'l', 'r', 'u', 'd']
const TILE_SIZE = 512

/** 判断 URL 模板是否为 krpano 多分辨率立方体格式（含 %0v / %0h 行列占位符） */
function isMultiresTemplate(tpl: string): boolean {
  return tpl.includes('%0v') || tpl.includes('%0h')
}

/**
 * 将瓦片 URL 模板展开为实际需要下载的文件 URL 列表。
 *
 * 支持两种模板：
 * 1. **整面模板**（仅含 `%s`，如 `/uploads/s1/l1/%s.jpg`）→ 展开为 6 个面。
 * 2. **krpano 多分辨率模板**（含 `%s`/`%0v`/`%0h`，如
 *    `/uploads/tiles/{id}/%s/l{lv}/%0v/l{lv}_%s_%0v_%0h.jpg`）→
 *    根据每个 level 的 `tiledimagewidth/height` 按 TILE_SIZE=512 计算行列网格，
 *    展开为所有瓦片（v/h 均为 1-based、2 位补零，与后端命名一致）。
 *
 * 不带任何 `%s` 占位符的 URL 按单文件原样返回。
 */
export function expandTileUrl(tpl: string, faceSize?: number): string[] {
  if (!tpl.includes('%s')) return [tpl]

  // krpano multires 模板：枚举所有 (face, v, h) 组合
  if (isMultiresTemplate(tpl)) {
    const size = faceSize ?? TILE_SIZE
    const tilesPerSide = Math.max(1, Math.ceil(size / TILE_SIZE))
    const urls: string[] = []
    for (const face of CUBE_FACES) {
      for (let vi = 0; vi < tilesPerSide; vi++) {
        for (let hi = 0; hi < tilesPerSide; hi++) {
          const v = String(vi + 1).padStart(2, '0')
          const h = String(hi + 1).padStart(2, '0')
          urls.push(
            tpl
              .replace(/%0v/g, v)
              .replace(/%0h/g, h)
              .replace(/%s/g, face),
          )
        }
      }
    }
    return urls
  }

  // 整面模板：只有 %s
  return CUBE_FACES.map((face) => tpl.replace(/%s/g, face))
}

/** 判断 URL 是否为需要下载打包的内部资源（非 http(s) 外链、非 data:、非空） */
export function isInternalAssetUrl(url: string | undefined): boolean {
  if (!url) return false
  if (/^(https?:)?\/\//i.test(url)) return false
  if (url.startsWith('data:')) return false
  if (url.startsWith('blob:')) return false
  return true
}

/**
 * 从 SceneData 列表中收集所有需要下载/打包的内部资源 URL（去重）。
 *
 * 注意：返回的列表中**瓦片模板 URL 以原始 %s 形式**保留（调用方可据此同时
 * 得到模板与展开后的 6 个面 URL）；预览图、缩略图、热点图片按原样收录。
 * 外链 http(s) / data: / blob: 不纳入（保持原样引用）。
 */
export function collectResourceUrls(sceneDataList: SceneData[]): string[] {
  const set = new Set<string>()

  for (const sd of sceneDataList) {
    // thumb
    if (isInternalAssetUrl(sd.scene.thumburl)) set.add(sd.scene.thumburl)
    // preview
    if (sd.preview && isInternalAssetUrl(sd.preview.url)) set.add(sd.preview.url)
    // tiles：收集模板 URL（%s 保留），实际下载时再展开为 6 个面
    for (const lv of sd.image.levels) {
      const tpl = lv.cube.url
      if (isInternalAssetUrl(tpl)) set.add(tpl)
    }
    // hotspots
    for (const h of sd.hotspots) {
      if (h.url && isInternalAssetUrl(h.url)) set.add(h.url)
    }
  }

  return [...set]
}

// ─── rewriteSceneDataUrls ───────────────────────────────────

function rewriteUrl(url: string | undefined): string {
  if (!url) return ''
  if (!isInternalAssetUrl(url)) return url
  // 模板 URL（%s）：对前缀做 sanitize，保留 %s 在末尾
  if (url.includes('%s')) {
    const prefix = url.substring(0, url.indexOf('%s'))
    const suffix = url.substring(url.indexOf('%s') + 2)
    const facePlaceholder = `__FACE__${Date.now()}__`
    // sanitize 处理 prefix，然后把占位符换回 %s
    const sanitized = sanitizeAssetPath(prefix + facePlaceholder + suffix)
    return sanitized.replace(facePlaceholder, '%s')
  }
  return sanitizeAssetPath(url)
}

/**
 * 将 SceneData 中所有内部 URL 重写为 assets/ 下的相对路径，
 * 外链保持不变。返回新数组（不修改输入）。
 */
export function rewriteSceneDataUrls(sceneDataList: SceneData[]): SceneData[] {
  return sceneDataList.map((sd) => ({
    ...sd,
    scene: { ...sd.scene, thumburl: rewriteUrl(sd.scene.thumburl) },
    preview: sd.preview ? { url: rewriteUrl(sd.preview.url) } : undefined,
    image: {
      ...sd.image,
      levels: sd.image.levels.map((lv) => ({
        ...lv,
        cube: { url: rewriteUrl(lv.cube.url) },
      })),
    },
    hotspots: sd.hotspots.map((h) => ({ ...h, url: h.url ? rewriteUrl(h.url) : h.url })),
  }))
}

// ─── generateConfigJson ─────────────────────────────────────

export interface StaticTourConfig {
  title: string
  firstScene: string
  tourSettings: TourSettings | null
  scenes: SceneData[]
}

export function generateConfigJson(
  sceneDataList: SceneData[],
  tourSettings: TourSettings | null,
  title = 'Virtual Tour',
): string {
  const cfg: StaticTourConfig = {
    title,
    firstScene: sceneDataList[0]?.scene.name ?? '',
    tourSettings,
    scenes: sceneDataList,
  }
  return JSON.stringify(cfg, null, 2)
}
