/**
 * 缩略图生成器
 *
 * 从全景原图 URL 加载图片，按 16:9 比例从中心裁切，缩放到目标宽度（默认 1280px）。
 * 用于场景列表/项目封面的缩略图自动生成。
 */

const OUTPUT_WIDTH = 1280
const OUTPUT_HEIGHT = 720 // 1280 * 9 / 16
const TARGET_RATIO = 16 / 9
const JPEG_QUALITY = 0.85

export interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * 从源图尺寸计算 16:9 中心裁切矩形。
 * 横向超宽（如 2:1 全景）→ 按高度铺满，水平居中裁掉两侧。
 * 横向偏窄（如 4:3）→ 按宽度铺满，垂直居中裁掉上下。
 */
export function computeCenterCropRect(srcWidth: number, srcHeight: number): CropRect {
  const srcRatio = srcWidth / srcHeight
  if (srcRatio >= TARGET_RATIO) {
    // 横向超宽：按高度铺满
    const sh = srcHeight
    const sw = sh * TARGET_RATIO
    const sx = (srcWidth - sw) / 2
    return { sx, sy: 0, sw, sh }
  } else {
    // 纵向偏高：按宽度铺满
    const sw = srcWidth
    const sh = sw / TARGET_RATIO
    const sy = (srcHeight - sh) / 2
    return { sx: 0, sy, sw, sh }
  }
}

/**
 * 加载图片到 HTMLImageElement，跨域开启以便 canvas 导出。
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`缩略图加载失败: ${url}`))
    img.src = url
  })
}

/**
 * 从 URL 生成缩略图 dataURL。
 * @param url 全景原图 URL
 * @returns Promise<dataURL>（image/jpeg, quality=0.85）
 */
export async function generateThumbnailFromUrl(url: string): Promise<string> {
  const img = await loadImage(url)
  const srcWidth = img.naturalWidth || (img as any).width || 0
  const srcHeight = img.naturalHeight || (img as any).height || 0

  if (!srcWidth || !srcHeight) {
    throw new Error('缩略图源图尺寸无效')
  }

  const { sx, sy, sw, sh } = computeCenterCropRect(srcWidth, srcHeight)

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_WIDTH
  canvas.height = OUTPUT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法获取 canvas 2d context')

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
