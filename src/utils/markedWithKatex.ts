import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'

let configured = false

/** 与豆包等一致：支持 $...$ / $$...$$，且 $ 两侧可无空格（如 二进制$R=2$） */
export function ensureMarkedKatex(): void {
  if (configured) return
  marked.use(
    markedKatex({
      throwOnError: false,
      nonStandard: true,
      output: 'html',
    }),
  )
  configured = true
}

export function parseMarkedHtml(md: string): string {
  ensureMarkedKatex()
  const raw = marked.parse(md, { async: false })
  return typeof raw === 'string' ? raw : ''
}
