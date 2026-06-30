/**
 * 统一性能监控器
 * 
 * 设计原则：
 * 1. 使用 Performance API (mark/measure) 实现浏览器级时间线记录
 * 2. 同时输出结构化 console.log 便于开发时快速查看
 * 3. 单例模式，全局唯一时间线
 * 4. 支持嵌套阶段，自动计算耗时
 * 
 * 使用方式：
 *   perf.mark('stage-start', 'stageName')   // 标记开始
 *   perf.mark('stage-end', 'stageName')     // 标记结束，自动输出耗时
 *   perf.measure('stageName')               // 手动测量并输出
 *   perf.timeline()                         // 打印完整时间线
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private marks: Map<string, number> = new Map()
  private stages: { name: string; start: number; end?: number; duration?: number; meta?: Record<string, unknown> }[] = []
  private enabled = true

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * 标记一个时间点
   * @param label 标记名称（建议用 kebab-case，如 'editor-mount-start'）
   * @param meta 附加元数据（如 projectId、sceneCount 等）
   */
  mark(label: string, meta?: Record<string, unknown>): void {
    if (!this.enabled) return
    const now = performance.now()
    this.marks.set(label, now)

    // 同时写入 Performance API，便于 Chrome DevTools 查看
    try {
      performance.mark(`pano-${label}`)
    } catch {
      // ignore duplicate mark
    }

    const prefix = `[PERF] ${now.toFixed(1)}ms`
    if (meta && Object.keys(meta).length > 0) {
      console.log(`${prefix} → ${label}`, meta)
    } else {
      console.log(`${prefix} → ${label}`)
    }
  }

  /**
   * 标记一个阶段的结束，自动计算耗时
   * @param label 标记名称（应与对应的 start 一致，或自动匹配 '-start'/'-end' 后缀）
   * @param meta 附加元数据
   */
  markEnd(label: string, meta?: Record<string, unknown>): void {
    if (!this.enabled) return
    const now = performance.now()
    const startLabel = label.endsWith('-end') ? label.replace('-end', '-start') : `${label}-start`
    const startTime = this.marks.get(startLabel)

    const duration = startTime !== undefined ? now - startTime : undefined

    // 同时写入 Performance API
    try {
      const startMark = `pano-${startLabel}`
      const endMark = `pano-${label.endsWith('-end') ? label : `${label}-end`}`
      performance.mark(endMark)
      if (startTime !== undefined) {
        performance.measure(`pano-${label.replace('-end', '')}`, startMark, endMark)
      }
    } catch {
      // ignore
    }

    const prefix = `[PERF] ${now.toFixed(1)}ms`
    if (duration !== undefined) {
      const logObj = { duration: `${duration.toFixed(1)}ms`, ...meta }
      console.log(`${prefix} ✓ ${label} (${duration.toFixed(1)}ms)`, Object.keys(logObj).length > 1 ? logObj : '')
    } else {
      console.log(`${prefix} ✓ ${label} (no start mark)`, meta)
    }
  }

  /**
   * 快捷方法：同时记录开始和返回一个结束回调
   * @param stageName 阶段名称
   * @param meta 附加元数据
   * @returns 调用以结束阶段
   */
  stage(stageName: string, meta?: Record<string, unknown>): () => void {
    this.mark(`${stageName}-start`, meta)
    return (endMeta?: Record<string, unknown>) => {
      this.markEnd(`${stageName}-end`, endMeta)
    }
  }

  /**
   * 异步阶段的快捷方法
   * @param stageName 阶段名称
   * @param fn 异步函数
   * @returns 原函数返回值
   */
  async measureAsync<T>(stageName: string, fn: () => Promise<T>): Promise<T> {
    const end = this.stage(stageName)
    try {
      const result = await fn()
      end()
      return result
    } catch (e) {
      end({ error: true })
      throw e
    }
  }

  /**
   * 同步阶段的快捷方法
   */
  measureSync<T>(stageName: string, fn: () => T): T {
    const end = this.stage(stageName)
    try {
      const result = fn()
      end()
      return result
    } catch (e) {
      end({ error: true })
      throw e
    }
  }

  /**
   * 打印完整时间线（所有已完成的阶段，按耗时降序）
   */
  timeline(): void {
    const entries = performance.getEntriesByType('measure')
      .filter((e) => e.name.startsWith('pano-'))
      .map((e) => ({
        name: e.name.replace('pano-', ''),
        duration: e.duration,
      }))
      .sort((a, b) => b.duration - a.duration)

    console.table(entries)
    console.log(`[PERF] Total measures: ${entries.length}`)
  }

  /**
   * 清理所有 marks 和 measures（进场完成后调用）
   */
  clear(): void {
    this.marks.clear()
    try {
      performance.clearMarks()
      performance.clearMeasures()
    } catch {
      // ignore
    }
  }

  setEnabled(value: boolean): void {
    this.enabled = value
  }
}

export const perf = PerformanceMonitor.getInstance()

// 开发环境便捷访问：在浏览器控制台直接输入 perf.timeline() 查看完整时间线
if (typeof window !== 'undefined') {
  ;(window as any).__perf = perf
}
