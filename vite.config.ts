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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('element-plus')) return 'element-plus'
          if (id.includes('echarts')) return 'echarts-radar'
          if (id.includes('tesseract.js')) return 'tesseract'
          if (id.includes('mammoth')) return 'mammoth'
          if (id.includes('markmap')) return 'markmap'
          if (id.includes('@vueup/vue-quill') || id.includes('/quill/')) return 'quill'
          if (id.includes('jzz')) return 'jzz'
          if (id.includes('katex')) return 'katex'
        },
      },
    },
  },
})
