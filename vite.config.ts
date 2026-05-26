import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // 开发时前端请求 /api/ai → 本地 server（密钥在 server/.env）
      '/api/ai': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, '/v1'),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'jazz-midi': fileURLToPath(new URL('./src/utils/jazz-midi-stub.ts', import.meta.url)),
    },
  },
})
