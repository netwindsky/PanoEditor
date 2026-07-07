import { defineConfig } from 'vite'
import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { execSync } from 'child_process'

/**
 * viewer 独立构建时同样采集版本信息（若 prebuild 未生成 version.json 则现场采集）。
 */
function resolveBuildVersion() {
  try {
    const generated = resolve(__dirname, 'src/generated/version.json')
    if (existsSync(generated)) {
      return JSON.parse(readFileSync(generated, 'utf-8'))
    }
  } catch { /* fallthrough */ }
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
 * static-viewer 独立构建配置。
 *
 * 构建产物输出到主应用 public/static-viewer/ 目录：
 *   public/static-viewer/index.html
 *   public/static-viewer/assets/main.js
 *   public/static-viewer/assets/main.css
 *   public/static-viewer/assets/textureLoader.worker-*.js
 *
 * 主应用 dev server 可直接访问 /static-viewer/index.html；
 * 生产构建时 public/ 会被原封不动 copy 到 dist/。
 * 运行时（staticPacker）通过 fetch 读取这些文件打入 zip。
 */
export default defineConfig({
  root: resolve(__dirname, 'static-viewer'),
  // 使用相对路径，确保静态包部署到任意子路径（如 /xmsy1/）时资源都能正确加载
  // 包括 Worker 脚本、JS/CSS 等所有静态资源
  base: './',
  // static viewer 不需要 Vue；不使用 public 目录
  publicDir: false,
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  // worker 文件名固定（不要 hash），方便运行时枚举打入 zip
  worker: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
      },
    },
  },
  resolve: {
    dedupe: ['three'],
    alias: [
      { find: '@panoview', replacement: resolve(__dirname, '../PanoViewV2/src/panoview') },
      { find: /^three$/, replacement: resolve(__dirname, 'node_modules/three') },
    ],
  },
  build: {
    outDir: resolve(__dirname, 'public/static-viewer'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'static-viewer/index.html'),
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    minify: 'esbuild',
    target: 'es2020',
  },
})
