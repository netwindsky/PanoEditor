/**
 * buildVersion 单元测试
 *
 * 测试策略：以 mock fs/path 的方式测试纯函数逻辑，不依赖真实文件系统。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validatePanoViewV2,
  computeVersionHash,
  formatVersionBanner,
  type VersionInfo,
} from '@/utils/buildVersion'

// ─── fixtures ────────────────────────────────────────────────

const makeVersionInfo = (overrides: Partial<VersionInfo> = {}): VersionInfo => ({
  editorCommit: 'abcdef1234567890',
  panoviewCommit: '123456abcdef7890',
  panoviewPath: '/abs/path/to/PanoViewV2',
  panoviewExists: true,
  panoviewIsGitRepo: true,
  panoviewDirty: false,
  buildTime: '2025-01-01T00:00:00.000Z',
  ...overrides,
})

// ─── validatePanoViewV2 ─────────────────────────────────────

describe('validatePanoViewV2', () => {
  it('当 PanoViewV2 目录存在且是 git 仓库时返回 ok=true', () => {
    const existsSync = vi.fn(() => true)
    const execSync = vi.fn((cmd: string) => {
      if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true\n'
      if (cmd.includes('rev-parse HEAD')) return 'abc123def456\n'
      if (cmd.includes('status --porcelain')) return ''
      return ''
    })

    const result = validatePanoViewV2('/proj/PanoViewV2', { existsSync, execSync })
    expect(result.ok).toBe(true)
    expect(result.info.panoviewExists).toBe(true)
    expect(result.info.panoviewIsGitRepo).toBe(true)
    expect(result.info.panoviewCommit).toBe('abc123def456')
    expect(result.info.panoviewDirty).toBe(false)
  })

  it('当 PanoViewV2 目录不存在时返回 ok=false 并给出明确错误', () => {
    const existsSync = vi.fn(() => false)
    const execSync = vi.fn()

    const result = validatePanoViewV2('/notexist/PanoViewV2', { existsSync, execSync })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('PanoViewV2')
    expect(result.error).toContain('不存在')
    expect(execSync).not.toHaveBeenCalled()
  })

  it('当 PanoViewV2 目录存在但不是 git 仓库时返回 ok=false', () => {
    const existsSync = vi.fn(() => true)
    const execSync = vi.fn(() => {
      throw new Error('not a git repository')
    })

    const result = validatePanoViewV2('/proj/PanoViewV2', { existsSync, execSync })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/git/i)
  })

  it('当 PanoViewV2 有未提交修改时标记 panoviewDirty=true', () => {
    const existsSync = vi.fn(() => true)
    const execSync = vi.fn((cmd: string) => {
      if (cmd.includes('is-inside-work-tree')) return 'true\n'
      if (cmd.includes('rev-parse HEAD')) return 'abc123\n'
      if (cmd.includes('status --porcelain')) return ' M src/panoview/core/PanoEngine.ts\n'
      return ''
    })

    const result = validatePanoViewV2('/proj/PanoViewV2', { existsSync, execSync })
    expect(result.ok).toBe(true)
    expect(result.info.panoviewDirty).toBe(true)
  })

  it('支持 strict 模式：dirty 时返回 ok=false', () => {
    const existsSync = vi.fn(() => true)
    const execSync = vi.fn((cmd: string) => {
      if (cmd.includes('is-inside-work-tree')) return 'true\n'
      if (cmd.includes('rev-parse HEAD')) return 'abc123\n'
      if (cmd.includes('status --porcelain')) return ' M file.ts\n'
      return ''
    })

    const result = validatePanoViewV2('/proj/PanoViewV2', { existsSync, execSync, strict: true })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('未提交')
  })
})

// ─── computeVersionHash ─────────────────────────────────────

describe('computeVersionHash', () => {
  it('返回短 hash（8 位十六进制）', () => {
    const info = makeVersionInfo({
      editorCommit: 'abcdef1234567890',
      panoviewCommit: '123456abcdef7890',
    })
    const hash = computeVersionHash(info)
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('相同输入产生相同 hash（确定性）', () => {
    const info = makeVersionInfo()
    expect(computeVersionHash(info)).toBe(computeVersionHash(info))
  })

  it('不同 panoviewCommit 产生不同 hash', () => {
    const a = makeVersionInfo({ panoviewCommit: 'aaaaaaaaaaaaaaaa' })
    const b = makeVersionInfo({ panoviewCommit: 'bbbbbbbbbbbbbbbb' })
    expect(computeVersionHash(a)).not.toBe(computeVersionHash(b))
  })

  it('不同 editorCommit 产生不同 hash', () => {
    const a = makeVersionInfo({ editorCommit: 'aaaaaaaaaaaaaaaa' })
    const b = makeVersionInfo({ editorCommit: 'bbbbbbbbbbbbbbbb' })
    expect(computeVersionHash(a)).not.toBe(computeVersionHash(b))
  })

  it('panoviewDirty 标志影响 hash（dirty 构建与 clean 构建不同）', () => {
    const clean = makeVersionInfo({ panoviewDirty: false })
    const dirty = makeVersionInfo({ panoviewDirty: true })
    expect(computeVersionHash(clean)).not.toBe(computeVersionHash(dirty))
  })
})

// ─── formatVersionBanner ────────────────────────────────────

describe('formatVersionBanner', () => {
  it('包含编辑器和 PanoViewV2 的 commit 短哈希', () => {
    const info = makeVersionInfo({
      editorCommit: 'abcdef1234567890abcdef1234567890abcdef12',
      panoviewCommit: '123456abcdef7890123456abcdef7890123456ab',
    })
    const banner = formatVersionBanner(info)
    expect(banner).toContain('abcdef12')
    expect(banner).toContain('123456ab')
  })

  it('dirty 时显示警告标记', () => {
    const dirty = formatVersionBanner(makeVersionInfo({ panoviewDirty: true }))
    expect(dirty).toMatch(/dirty|未提交|modified/i)
  })

  it('clean 时不显示警告', () => {
    const clean = formatVersionBanner(makeVersionInfo({ panoviewDirty: false }))
    expect(clean).not.toMatch(/dirty|未提交|modified/i)
  })
})
