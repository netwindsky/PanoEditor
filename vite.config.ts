import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@panoview': resolve(__dirname, '../PanoViewV2/src/panoview'),
    },
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
