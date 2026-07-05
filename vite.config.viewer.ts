import { defineConfig } from 'vite'
import { resolve } from 'path'

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
  // static viewer 不需要 Vue；不使用 public 目录
  publicDir: false,
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
