/**
 * 静态包打包器（IO 层）
 *
 * 职责：
 * 1. 调用 staticExport 纯函数完成数据转换与 URL 重写
 * 2. 并发下载所有内部资源（通过注入的 fetcher）
 * 3. 抓取预构建的 PanoViewV2 viewer（public/static-viewer/ 下的 index.html + assets/*）
 * 4. 用 JSZip 打包为 ZIP Blob
 * 5. 进度回调
 *
 * 资源下载使用有界并发（默认 6），避免一次发几十张图把浏览器连接池打满。
 * 单资源下载失败时写入一个占位 Blob（含错误信息），不阻断整体打包，
 * 让用户拿到尽可能完整的包（缺失资源在 Viewer 里会控制台报错但不会白屏）。
 */
import JSZip from 'jszip'
import type { SceneData } from '@panoview'
import type { TourSettings } from '@/types'
import {
  buildSceneDataList,
  rewriteSceneDataUrls,
  generateConfigJson,
  sanitizeAssetPath,
  expandTileUrl,
  isInternalAssetUrl,
  ASSET_DIR,
} from '@/utils/staticExport'
import type { Project, Scene, Hotspot } from '@/types'

/**
 * Viewer 产物 URL 前缀：基于 Vite 的 base 配置拼接，支持编辑器部署到子路径。
 * - dev server: BASE_URL = '/' → '/static-viewer/'
 * - 部署到子路径（如 VITE_BASE=/editor/）：'/editor/static-viewer/'
 * - BASE_URL 若以 './' 结尾（相对 base 模式），同样可工作
 */
function resolveViewerBase(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${base}/static-viewer/`
}

export type PackPhase = 'collect' | 'download' | 'pack' | 'done'

export interface PackProgress {
  phase: PackPhase
  /** 0-100 */
  percent: number
  /** 当前阶段已完成数 / 总数（可选） */
  completed?: number
  total?: number
  /** 当前正在处理的 URL（download 阶段） */
  currentUrl?: string
}

/** 资源获取函数（默认浏览器端用 fetch，测试时可注入假实现） */
export type ResourceFetcher = (url: string) => Promise<Blob>

export interface PackOptions {
  title: string
  /** 编辑器原始场景列表（未重写 URL） */
  scenes: SceneData[]
  tourSettings: TourSettings | null
  /** 资源获取器。默认：使用同源 fetch（适合 vite dev 代理 / 生产同源部署） */
  fetcher?: ResourceFetcher
  /** 并发下载上限，默认 6 */
  concurrency?: number
  onProgress?: (p: PackProgress) => void
}

/**
 * 浏览器默认 fetcher：使用 fetch + 返回 Blob。
 * URL 以 / 开头时直接请求（依赖 dev server proxy 或同源部署），
 * 完整 URL 也直接 fetch（CORS 需对方允许）。
 */
export const defaultFetcher: ResourceFetcher = async (url: string): Promise<Blob> => {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return await res.blob()
}

function emit(onProgress: PackOptions['onProgress'], p: PackProgress) {
  onProgress?.(p)
}

/**
 * 带并发上限的异步池：执行 tasks，最多 concurrency 个同时运行。
 * 每完成一个调用 onItemDone。
 */
async function pool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onItemDone?: (idx: number, result: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  let done = 0

  return new Promise<R[]>((resolve) => {
    const startNext = () => {
      if (next >= items.length) {
        if (done === items.length) resolve(results)
        return
      }
      const idx = next++
      const item = items[idx]
      worker(item, idx).then((r) => {
        results[idx] = r
        done++
        onItemDone?.(idx, r)
        startNext()
      }, () => {
        done++
        onItemDone?.(idx, undefined as unknown as R)
        startNext()
      })
    }
    for (let i = 0; i < Math.min(concurrency, items.length); i++) startNext()
  })
}

/**
 * 创建静态包。
 * 返回 ZIP Blob，可通过 downloadTextFile 等现有工具触发浏览器下载。
 */
export async function createStaticPack(opts: PackOptions): Promise<Blob> {
  const {
    title,
    scenes: rawSceneData,
    tourSettings,
    fetcher = defaultFetcher,
    concurrency = 6,
    onProgress,
  } = opts

  // ─── 1. 收集资源 ──────────────────────────────────────
  emit(onProgress, { phase: 'collect', percent: 0 })

  // 枚举所有待下载 URL + 对应 zipPath
  // 关键：krpano multires 模板包含 %s/%0v/%0h，需要结合 level 的 tiledimagewidth 展开为所有 (face,v,h) 实际文件
  const downloadJobs: { url: string; zipPath: string }[] = []

  const resolveUrlToZip = (url: string): string => {
    if (url.includes('%')) {
      // 模板路径：对每个占位符位置做 sanitize，保留占位符
      // 占位符只出现在路径段中（不在文件名危险位置），直接 sanitize 整段再还原占位符
      // 简化处理：把占位符替换为唯一 marker，sanitize 后还原
      const MARKER = `__PLACEHOLDER_${Date.now()}__`
      const marked = url.replace(/%s|%0v|%0h/g, MARKER)
      return sanitizeAssetPath(marked).replace(new RegExp(MARKER, 'g'), (m, off, str) => {
        // 根据上下文确定原始占位符——这里我们不能直接知道，但 sanitizeAssetPath 不会改 ASCII 字符
        // 所以用一个 marker 会冲突；换策略：逐段 sanitize
        return m
      })
    }
    return sanitizeAssetPath(url)
  }

  // 上面的 MARKER 策略不够鲁棒，改用逐段 sanitize：按 / 分割，对每段单独 sanitize
  const sanitizePreservingPlaceholders = (url: string): string => {
    // 外链原样返回
    if (/^https?:\/\//i.test(url)) return url
    const parts = url.split('/')
    const sanitized = parts.map((seg) => {
      if (seg === '') return seg
      // 去掉查询串
      const clean = seg.split('?')[0].split('#')[0]
      // 阻止路径遍历
      return clean.replace(/\.\./g, '__')
    })
    // 拼回，确保以 assets/ 开头
    let joined = sanitized.join('/')
    if (joined.startsWith('/')) joined = joined.slice(1)
    if (joined.startsWith(ASSET_DIR)) return joined
    return ASSET_DIR + joined
  }

  /** 将带占位符的模板映射为 zip 路径（保留 %s/%0v/%0h 占位符，供后续 face/v/h 替换） */
  const tplToZipTpl = (tpl: string): string => sanitizePreservingPlaceholders(tpl)

  const addJob = (url: string, zipPath: string) => {
    // 去重：同 url 不重复下载
    if (!downloadJobs.some((j) => j.url === url)) {
      downloadJobs.push({ url, zipPath })
    }
  }

  for (const sd of rawSceneData) {
    // thumb
    if (isInternalAssetUrl(sd.scene.thumburl)) addJob(sd.scene.thumburl, sanitizeAssetPath(sd.scene.thumburl))
    // preview
    if (sd.preview && isInternalAssetUrl(sd.preview.url)) addJob(sd.preview.url, sanitizeAssetPath(sd.preview.url))
    // tiles：每个 level 根据 faceSize 展开
    for (const lv of sd.image.levels) {
      const tpl = lv.cube.url
      if (!isInternalAssetUrl(tpl)) continue
      const faceSize = parseInt(lv.tiledimagewidth || '0', 10) || 512
      const zipTpl = tplToZipTpl(tpl)
      const expanded = expandTileUrl(tpl, faceSize)
      const zipExpanded = expandTileUrl(zipTpl, faceSize)
      for (let i = 0; i < expanded.length; i++) {
        addJob(expanded[i], zipExpanded[i])
      }
    }
    // hotspots
    for (const h of sd.hotspots) {
      if (h.url && isInternalAssetUrl(h.url)) addJob(h.url, sanitizeAssetPath(h.url))
    }
  }

  emit(onProgress, { phase: 'collect', percent: 100, completed: downloadJobs.length, total: downloadJobs.length })

  // ─── 2. 并发下载 ──────────────────────────────────────
  const zip = new JSZip()
  const total = downloadJobs.length
  let completed = 0

  await pool(
    downloadJobs,
    async (job) => {
      try {
        const blob = await fetcher(job.url)
        zip.file(job.zipPath, blob)
      } catch (err) {
        // 占位：写入错误说明的极小文件，保证 zip 结构完整
        const msg = `Failed to download ${job.url}: ${err instanceof Error ? err.message : String(err)}`
        zip.file(job.zipPath, new Blob([msg], { type: 'text/plain' }))
      }
    },
    concurrency,
    (_idx) => {
      completed++
      emit(onProgress, {
        phase: 'download',
        percent: Math.round((completed / total) * 90) + 5, // 5%-95%
        completed,
        total,
      })
    },
  )

  // ─── 3. 重写 URL + 写入 config.json ──────────────────
  emit(onProgress, { phase: 'pack', percent: 95 })
  const rewritten = rewriteSceneDataUrls(rawSceneData)
  const configJson = generateConfigJson(rewritten, tourSettings, title)
  zip.file('config.json', configJson)
  emit(onProgress, { phase: 'pack', percent: 96 })

  // ─── 4. 抓取预构建 viewer 产物并写入 zip ─────────────
  // viewer 由 vite.config.viewer.ts 预构建到 public/static-viewer/，
  // 产物文件名固定（无 hash），包括：
  //   index.html
  //   assets/index.js
  //   assets/index.css
  //   assets/textureLoader.worker.js
  // 通过解析 index.html 中 <script>/<link> 引用得到 js/css 列表，再固定加上 worker。
  const viewerBase = resolveViewerBase()
  const viewerHtmlUrl = viewerBase + 'index.html'
  let viewerHtml = ''
  try {
    const htmlBlob = await fetcher(viewerHtmlUrl)
    viewerHtml = await htmlBlob.text()
  } catch (err) {
    throw new Error(
      `Viewer 资源未构建（${viewerHtmlUrl}）。请先运行 npm run build:viewer。原始错误：${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }

  // 从 HTML 中解析出所有 <script src> 与 <link href> 资源路径
  const assetRefs = new Set<string>()
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/g
  const linkRe = /<link[^>]+href=["']([^"']+)["']/g
  for (const re of [scriptRe, linkRe]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(viewerHtml)) !== null) {
      const src = m[1]
      if (src && !/^https?:\/\//i.test(src) && !src.startsWith('data:')) {
        // 转换 ./assets/xxx -> assets/xxx，写成 zip 相对路径
        const normalized = src.replace(/^\.\//, '')
        assetRefs.add(normalized)
      }
    }
  }
  // 加上 worker 文件（不被 index.html 直接引用，由 index.js 运行时 new Worker 加载）
  assetRefs.add('assets/textureLoader.worker.js')

  // 下载 viewer 资源，写入 zip 对应路径
  for (const relPath of assetRefs) {
    const url = viewerBase + relPath
    try {
      const blob = await fetcher(url)
      zip.file(relPath, blob)
    } catch (err) {
      // viewer 资源缺失是硬错误，直接抛——缺了就完全跑不起来
      throw new Error(
        `Viewer 资源缺失：${url}（${err instanceof Error ? err.message : String(err)}）`,
      )
    }
  }

  // 替换标题占位符后写入 zip 根的 index.html
  const finalHtml = viewerHtml.replace(/__PROJECT_TITLE__/g, title)
  zip.file('index.html', finalHtml)

  // 写入 version.json（包含 PanoViewV2 commit hash，方便部署后排查版本问题）
  // __BUILD_VERSION__ 由 vite define 注入为字面量对象
  try {
    // @ts-ignore — 由 vite define 注入，TypeScript 静态分析看不到
    const versionInfo = __BUILD_VERSION__
    if (versionInfo) {
      zip.file('version.json', JSON.stringify(versionInfo, null, 2))
    }
  } catch {
    // 版本信息写入失败不影响打包
  }

  emit(onProgress, { phase: 'pack', percent: 99 })

  const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    emit(onProgress, {
      phase: 'pack',
      percent: 95 + Math.round(meta.percent * 0.05),
    })
  })

  emit(onProgress, { phase: 'done', percent: 100 })
  return blob
}

/**
 * 便捷入口：从编辑器原始 Project/Scene/Hotspot 模型直接构建 ZIP。
 */
export async function buildProjectZip(
  project: Project,
  scenes: Scene[],
  hotspots: Hotspot[],
  opts: Omit<PackOptions, 'title' | 'scenes' | 'tourSettings'> = {},
): Promise<Blob> {
  const sceneData = buildSceneDataList(project, scenes, hotspots)
  let tourSettings: TourSettings | null = null
  if (project.settings) {
    try { tourSettings = JSON.parse(project.settings) as TourSettings } catch { tourSettings = null }
  }
  return createStaticPack({
    title: project.name,
    scenes: sceneData,
    tourSettings,
    ...opts,
  })
}
