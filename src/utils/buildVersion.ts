/**
 * 构建版本信息 —— 纯函数模块（可在浏览器/Node 环境运行，无 Node.js 原生依赖）
 *
 * 所有 IO（文件系统、git 命令）通过参数注入，方便单元测试。
 * Node.js 便捷入口见 buildVersion.node.ts。
 */

export interface VersionInfo {
  /** 编辑器自身的 git commit short hash */
  editorCommit: string
  /** PanoViewV2 的 git commit short hash */
  panoviewCommit: string
  /** PanoViewV2 解析到的绝对路径 */
  panoviewPath: string
  /** PanoViewV2 目录是否存在 */
  panoviewExists: boolean
  /** PanoViewV2 目录是否是 git 仓库 */
  panoviewIsGitRepo: boolean
  /** PanoViewV2 是否有未提交的修改 */
  panoviewDirty: boolean
  /** ISO 8601 构建时间 */
  buildTime: string
}

export interface ValidateOptions {
  /**
   * 严格模式：当 PanoViewV2 有未提交修改时视为校验失败。
   * 默认 false（允许构建，但会在版本信息中标记 dirty）。
   */
  strict?: boolean
}

/** 文件系统/子进程 IO 接口（测试可注入 mock 实现） */
export interface FsIO {
  existsSync: (path: string) => boolean
  execSync: (cmd: string, opts?: { cwd?: string }) => Buffer | string
}

export interface ValidateResult {
  ok: boolean
  info: VersionInfo
  error?: string
}

/**
 * 基于注入的 IO 校验 PanoViewV2 目录并采集版本信息。
 * 纯函数：不直接调用 Node.js API，浏览器可复用。
 *
 * @param panoviewPath PanoViewV2 目录路径
 * @param io 文件系统/子进程 IO 实现 + 可选的 strict 选项（strict 可放在 io 内或作为第 3 参传入）
 * @param options 校验选项（可选）
 */
export function validatePanoViewV2(
  panoviewPath: string,
  io: FsIO & ValidateOptions,
  options: ValidateOptions = {},
): ValidateResult {
  const { strict = false } = { ...options, ...io }

  const info: VersionInfo = {
    editorCommit: '',
    panoviewCommit: '',
    panoviewPath,
    panoviewExists: false,
    panoviewIsGitRepo: false,
    panoviewDirty: false,
    buildTime: new Date().toISOString(),
  }

  const safeExecIn = (cmd: string, cwd?: string): string | null => {
    try {
      return String(io.execSync(cmd, { cwd })).trim()
    } catch {
      return null
    }
  }

  // 1. 目录存在性检查
  if (!io.existsSync(panoviewPath)) {
    return {
      ok: false,
      info,
      error: `PanoViewV2 目录不存在：${panoviewPath}。请检查 ../PanoViewV2 是否正确拉取。`,
    }
  }
  info.panoviewExists = true

  // 2. 检查 PanoViewV2 是否 git 仓库
  const isGitRepo = safeExecIn('git rev-parse --is-inside-work-tree', panoviewPath)
  if (!isGitRepo) {
    return {
      ok: false,
      info,
      error: `PanoViewV2 目录不是 git 仓库：${panoviewPath}。无法确定版本。`,
    }
  }
  info.panoviewIsGitRepo = true

  // 3. 采集 PanoViewV2 commit hash
  const pvCommit = safeExecIn('git rev-parse HEAD', panoviewPath)
  if (!pvCommit) {
    return {
      ok: false,
      info,
      error: `PanoViewV2 无法获取 git commit hash。`,
    }
  }
  info.panoviewCommit = pvCommit.substring(0, 12)

  // 4. dirty 状态
  const dirtyStatus = safeExecIn('git status --porcelain', panoviewPath)
  info.panoviewDirty = !!(dirtyStatus && dirtyStatus.length > 0)

  // 5. 编辑器自身 commit（在默认 cwd 执行）
  const edCommit = safeExecIn('git rev-parse HEAD')
  info.editorCommit = edCommit ? edCommit.substring(0, 12) : 'unknown'

  // 6. strict 模式下 dirty 视为失败
  if (strict && info.panoviewDirty) {
    return {
      ok: false,
      info,
      error: `PanoViewV2 存在未提交的修改（dirty working tree）。严格模式禁止用脏版本构建生产包。请先 commit 或 stash 修改。`,
    }
  }

  return { ok: true, info }
}

/**
 * 计算确定性版本 hash（基于 editor commit + panoview commit + dirty 标志）。
 * 使用 FNV-1a 32 位哈希，不依赖 Node crypto API，浏览器可运行。
 * 返回 8 位十六进制字符串。
 */
export function computeVersionHash(info: VersionInfo): string {
  const input = `${info.editorCommit}|${info.panoviewCommit}|${info.panoviewDirty ? 'dirty' : 'clean'}`
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * 格式化版本信息为可读字符串（用于控制台 banner 和 ZIP 注释）。
 */
export function formatVersionBanner(info: VersionInfo): string {
  const hash = computeVersionHash(info)
  const dirtyMark = info.panoviewDirty ? ' ⚠️ DIRTY（有未提交修改）' : ' ✓ clean'
  return [
    `PanoEditor Build`,
    `  版本 hash : ${hash}`,
    `  Editor   : ${info.editorCommit}`,
    `  PanoView : ${info.panoviewCommit}${dirtyMark}`,
    `  构建时间 : ${info.buildTime}`,
  ].join('\n')
}

/**
 * 将 VersionInfo 序列化为 JSON（写入 generated/version.json 给 Vite 使用）。
 */
export function serializeVersionInfo(info: VersionInfo): string {
  return JSON.stringify(
    {
      ...info,
      versionHash: computeVersionHash(info),
    },
    null,
    2,
  )
}
