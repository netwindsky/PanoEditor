import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { execSync } from 'child_process'

/**
 * 在构建/开发启动时采集版本信息，通过 define 注入为 import.meta.env.* 常量。
 * - 优先读取 prebuild 脚本生成的 src/generated/version.json
 * - 若不存在（如直接运行 vite dev / vitest），现场通过 git 命令采集
 */
function resolveBuildVersion() {
  try {
    const generated = resolve(__dirname, 'src/generated/version.json')
    if (existsSync(generated)) {
      return JSON.parse(readFileSync(generated, 'utf-8'))
    }
  } catch { /* fallthrough */ }

  // 兜底：现场采集（开发模式/测试环境）
  const safeExec = (cmd: string, cwd?: string) => {
    try { return String(execSync(cmd, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })).trim() } catch { return '' }
  }
  const pvDir = resolve(__dirname, '../PanoViewV2')
  const pvExists = existsSync(pvDir)
  const pvGit = pvExists && safeExec('git rev-parse --is-inside-work-tree', pvDir) === 'true'
  const pvCommit = pvGit ? safeExec('git rev-parse HEAD', pvDir).substring(0, 12) : 'unknown'
  const pvDirty = pvGit ? safeExec('git status --porcelain', pvDir).length > 0 : false
  const edCommit = (safeExec('git rev-parse HEAD') || 'unknown').substring(0, 12)
  const fnv1a32 = (s: string) => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
    return (h >>> 0).toString(16).padStart(8, '0')
  }
  return {
    editorCommit: edCommit,
    panoviewCommit: pvCommit,
    panoviewExists: pvExists,
    panoviewIsGitRepo: pvGit,
    panoviewDirty: pvDirty,
    buildTime: new Date().toISOString(),
    versionHash: fnv1a32(`${edCommit}|${pvCommit}|${pvDirty ? 'dirty' : 'clean'}`),
  }
}

const buildVersion = resolveBuildVersion()

/**
 * 部署 base 路径。
 * - 默认 '/'（部署在域名根）
 * - 通过环境变量 VITE_BASE_URL 指定子路径（如 '/pano-editor/'），命令行示例：
 *     VITE_BASE_URL=/editor/ npm run build
 * - 设置为 './' 可使用相对路径（资源不依赖固定部署路径，但 vue-router history 模式需服务端配置）
 */
const BASE_URL = process.env.VITE_BASE_URL || '/'

export default defineConfig({
  // base 必须以 / 开头、以 / 结尾；'./' 是 vite 支持的特殊值（相对路径）
  base: BASE_URL === './' ? './' : (BASE_URL.startsWith('/') ? BASE_URL : '/' + BASE_URL).replace(/\/$/, '') + '/',
  plugins: [vue()],
  resolve: {
    // 强制全项目只使用一份 three 实例，避免 PanoViewV2 源码引用时解析到其自身 node_modules
    // 导致的 "Multiple instances of Three.js" 警告与 instanceof 跨实例失效问题
    dedupe: ['three'],
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      { find: '@panoview', replacement: resolve(__dirname, '../PanoViewV2/src/panoview') },
      // 仅精确匹配裸 `three` 入口，强制单实例；
      // 不可用目录别名替换 `three/addons/*` 子路径，否则会绕过 package.json 的 exports
      // 映射（addons -> examples/jsm），导致 stats.module.js 等文件 ENOENT。
      { find: /^three$/, replacement: resolve(__dirname, 'node_modules/three') },
    ],
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  server: {
    port: 5002,
    proxy: {
      '/api': {
        target: 'http://localhost:15088',
        changeOrigin: true,
        timeout: 300000, // 5分钟，上传大文件需要更长超时
      },
      '/uploads': {
        target: 'http://localhost:15088',
        changeOrigin: true,
        timeout: 300000,
      },
    },
  },
})
