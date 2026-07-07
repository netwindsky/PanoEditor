#!/usr/bin/env node
/**
 * prebuild 版本校验脚本
 *
 * 在 vite build 之前运行：
 * 1. 校验 ../PanoViewV2 目录存在且是 git 仓库
 * 2. 采集两个仓库的 commit hash 和 dirty 状态
 * 3. 生成 src/generated/version.json 供 Vite define 注入到前端运行时
 * 4. 打印版本 banner
 *
 * 选项：
 *   --strict    严格模式：PanoViewV2 有未提交修改时中止构建
 *   --path <p>  指定 PanoViewV2 路径（默认 ../PanoViewV2）
 *
 * 用法（package.json）:
 *   "prebuild": "node scripts/check-panoview-version.mjs",
 *   "build:prod": "node scripts/check-panoview-version.mjs --strict && vite build"
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM 下的 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')

// 解析命令行参数
const args = process.argv.slice(2)
const strict = args.includes('--strict')
const pathIdx = args.indexOf('--path')
const panoviewPath = pathIdx >= 0 ? args[pathIdx + 1] : resolve(projectRoot, '../PanoViewV2')

// 动态导入 ESM 模块（buildVersion.node.ts 通过 vite-node/tsx 运行会有 TS 问题，
// 这里我们直接 import 已构建的 JS，或通过 tsx 运行。简单起见：
// 使用 createRequire 加载编译后的版本，但 prebuild 阶段不能依赖已编译代码。
// 直接内联读取 git 信息，保持脚本零依赖。
//
// 为保持逻辑单一来源（buildVersion.ts），我们使用动态 import 加载 TS 文件。
// Vite 内部用 esbuild/tsx 能力可处理；这里我们使用更兼容的方式：
// 直接 import 纯函数模块（.ts 文件），Node 需要 loader；为了零配置，
// 我们在本脚本里自己实现简化版的版本校验，依赖 buildVersion.ts 的纯函数通过 jiti 或 tsx 加载。
// 但若不想引入 jiti 依赖，就从 JS 重新构建一份逻辑。
//
// 考虑到项目已有 vite/vitest，使用 tsx 最简洁，但它需要是 devDependency。
// 为避免新增依赖，直接从 TypeScript 源码同步纯函数的逻辑到本 .mjs 脚本
// （逻辑简单，只有文件检查+git命令，与 buildVersion.ts 保持一致即可）。

// ─── 内联版本校验逻辑（零依赖，与 buildVersion.ts 保持同步） ───
import { execSync } from 'node:child_process'

function safeExec(cmd, cwd) {
  try {
    return String(execSync(cmd, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })).trim()
  } catch {
    return null
  }
}

function fnv1a32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function collectVersion(panoviewDir, editorDir) {
  const info = {
    editorCommit: 'unknown',
    panoviewCommit: 'unknown',
    panoviewPath: panoviewDir,
    panoviewExists: existsSync(panoviewDir),
    panoviewIsGitRepo: false,
    panoviewDirty: false,
    buildTime: new Date().toISOString(),
  }

  if (!info.panoviewExists) {
    return { ok: false, info, error: `PanoViewV2 目录不存在：${panoviewDir}` }
  }

  const pvGit = safeExec('git rev-parse --is-inside-work-tree', panoviewDir)
  if (!pvGit) {
    return { ok: false, info, error: `PanoViewV2 目录不是 git 仓库：${panoviewDir}` }
  }
  info.panoviewIsGitRepo = true

  const pvHead = safeExec('git rev-parse HEAD', panoviewDir)
  if (!pvHead) {
    return { ok: false, info, error: `PanoViewV2 无法获取 git commit hash` }
  }
  info.panoviewCommit = pvHead.substring(0, 12)

  const pvStatus = safeExec('git status --porcelain', panoviewDir)
  info.panoviewDirty = !!(pvStatus && pvStatus.length > 0)

  const edHead = safeExec('git rev-parse HEAD', editorDir)
  if (edHead) info.editorCommit = edHead.substring(0, 12)

  if (strict && info.panoviewDirty) {
    return {
      ok: false,
      info,
      error: `PanoViewV2 存在未提交的修改（dirty working tree）。--strict 模式禁止用脏版本构建生产包。请先 commit 或 stash 修改。`,
    }
  }

  return { ok: true, info }
}

function formatBanner(info) {
  const hash = fnv1a32(`${info.editorCommit}|${info.panoviewCommit}|${info.panoviewDirty ? 'dirty' : 'clean'}`)
  const dirtyMark = info.panoviewDirty ? ' ⚠️ DIRTY（有未提交修改）' : ' ✓ clean'
  return [
    'PanoEditor Build',
    `  版本 hash : ${hash}`,
    `  Editor   : ${info.editorCommit}`,
    `  PanoView : ${info.panoviewCommit}${dirtyMark}`,
    `  构建时间 : ${info.buildTime}`,
  ].join('\n')
}

// ─── 主逻辑 ───
console.log(`\n🔍 检查 PanoViewV2 版本（路径：${panoviewPath}）...`)

const result = collectVersion(panoviewPath, projectRoot)

if (!result.ok) {
  console.error('\n❌ 版本校验失败:\n')
  console.error(`  ${result.error}\n`)
  process.exit(1)
}

const info = result.info
info.versionHash = fnv1a32(`${info.editorCommit}|${info.panoviewCommit}|${info.panoviewDirty ? 'dirty' : 'clean'}`)

console.log('\n' + formatBanner(info))

// 输出版本 JSON 到 generated/ 目录
const generatedDir = resolve(projectRoot, 'src/generated')
if (!existsSync(generatedDir)) {
  mkdirSync(generatedDir, { recursive: true })
}
const versionJsonPath = resolve(generatedDir, 'version.json')
writeFileSync(versionJsonPath, JSON.stringify(info, null, 2) + '\n', 'utf-8')
console.log(`\n✓ 版本信息已写入：${versionJsonPath}\n`)
