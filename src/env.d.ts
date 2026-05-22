/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * AI 代理 OpenAI 兼容根路径，须以 `/v1` 结尾、无尾部斜杠。
   * 生产必填；开发可不填（走 Vite `/api/ai` → 本机 server）。
   * 说明见 docs/ENV-说明.md
   */
  readonly VITE_AI_API_BASE?: string
}
