import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
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
