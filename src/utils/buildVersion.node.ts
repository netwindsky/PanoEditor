/**
 * buildVersion —— Node.js 便捷入口
 *
 * 封装真实 fs/child_process 调用，提供默认的 PanoViewV2 路径解析，
 * 供 vite.config 和 prebuild 脚本使用。
 *
 * 浏览器环境请直接使用 buildVersion.ts 中的纯函数，自行注入 IO。
 */
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validatePanoViewV2 as validatePanoViewV2WithIO,
  serializeVersionInfo,
  formatVersionBanner,
  type VersionInfo,
  type ValidateOptions,
  type ValidateResult,
} from './buildVersion'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** 默认 PanoViewV2 路径：相对于本文件（src/utils/）为 ../../PanoViewV2 → 项目根/PanoViewV2 */
export const DEFAULT_PANOVIEW_PATH = resolve(__dirname, '../../../PanoViewV2')

/**
 * 校验 PanoViewV2 并采集版本信息（Node.js 实现，使用真实 fs/git）。
 */
export function validatePanoViewV2(
  panoviewPath: string = DEFAULT_PANOVIEW_PATH,
  options: ValidateOptions = {},
): ValidateResult {
  return validatePanoViewV2WithIO(panoviewPath, { existsSync, execSync }, options)
}

/**
 * 校验并返回 VersionInfo；校验失败抛出错误。
 * 供 vite.config 中使用（构建失败自动中止）。
 */
export function getVersionInfoOrThrow(
  panoviewPath: string = DEFAULT_PANOVIEW_PATH,
  options: ValidateOptions = {},
): VersionInfo {
  const result = validatePanoViewV2(panoviewPath, options)
  if (!result.ok) {
    throw new Error(`[buildVersion] ${result.error}`)
  }
  return result.info
}

/**
 * 同步校验并输出版本信息 JSON 到控制台。
 * prebuild 脚本入口调用：失败则 process.exit(1)。
 */
export function runVersionCheck(options: ValidateOptions & { path?: string } = {}): VersionInfo {
  const panoviewPath = options.path || DEFAULT_PANOVIEW_PATH
  const result = validatePanoViewV2(panoviewPath, options)

  if (!result.ok) {
    console.error('\n❌ 版本校验失败:\n')
    console.error(`  ${result.error}\n`)
    process.exit(1)
  }

  console.log('\n' + formatVersionBanner(result.info) + '\n')
  return result.info
}

export { serializeVersionInfo, formatVersionBanner }
export type { VersionInfo, ValidateResult, ValidateOptions } from './buildVersion'
