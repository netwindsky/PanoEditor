import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { perf, PerformanceMonitor } from './performanceMonitor'

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    perf.clear()
    perf.setEnabled(true)
  })

  afterEach(() => {
    perf.clear()
  })

  it('should be a singleton', () => {
    const instance1 = PerformanceMonitor.getInstance()
    const instance2 = PerformanceMonitor.getInstance()
    expect(instance1).toBe(instance2)
    expect(perf).toBe(instance1)
  })

  it('should mark and measure a stage', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    perf.mark('test-start')
    perf.markEnd('test-end')
    expect(consoleSpy).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('should return end callback from stage()', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const end = perf.stage('test-stage')
    expect(typeof end).toBe('function')
    end({ extra: 'data' })
    expect(consoleSpy).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('should measure async operations', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await perf.measureAsync('async-op', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return 42
    })
    expect(result).toBe(42)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should measure sync operations', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = perf.measureSync('sync-op', () => 42)
    expect(result).toBe(42)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should not log when disabled', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    perf.setEnabled(false)
    perf.mark('disabled-test')
    expect(consoleSpy).not.toHaveBeenCalled()
    perf.setEnabled(true)
    consoleSpy.mockRestore()
  })

  it('should expose perf on window for dev convenience', () => {
    expect((window as any).__perf).toBe(perf)
  })
})
