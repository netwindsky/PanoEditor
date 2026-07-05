/**
 * 文本文件下载工具（浏览器端）
 *
 * 通过创建 Blob + 临时 <a> 标签触发下载，用完立即释放 URL 与 DOM。
 */

/**
 * 将文本内容作为文件下载到本地
 * @param content 文件文本内容
 * @param filename 文件名（含扩展名）
 * @param mime MIME 类型
 */
export function downloadTextFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 将 Blob 数据作为文件下载到本地
 * @param blob Blob 数据
 * @param filename 文件名（含扩展名）
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 导出 krpano XML 配置的便捷封装
 * @param xml XML 字符串
 * @param baseName 不含后缀的文件名（自动追加 .xml）
 */
export function downloadXml(xml: string, baseName: string): void {
  const safe = baseName || 'tour'
  downloadTextFile(xml, `${safe}.xml`, 'application/xml')
}
