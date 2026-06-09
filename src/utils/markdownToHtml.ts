import { injectMarkdownLineAnchors, splitMarkdownLines } from '@/utils/markdownSplitScrollSync'
import { sanitizeMarkdownHtml } from '@/utils/markdownSanitize'
import { parseMarkedHtml } from '@/utils/markedWithKatex'

function parseLineMarkdown(line: string): string {
  if (!line.trim()) {
    return '<span class="md-sync-empty-line" aria-hidden="true">\u200b</span>'
  }
  return sanitizeMarkdownHtml(parseMarkedHtml(line))
}

/**
 * 按源码行逐行渲染预览（每行一个 data-md-line 容器）。
 * 与左侧 textarea 行号一一对应，大图行在预览侧占真实像素高度，供滚动联动测量。
 */
export function markdownToSafeHtmlPerLine(md: string): string {
  const t = md ?? ''
  if (!t.trim()) return ''
  const lines = splitMarkdownLines(t)
  return lines
    .map(
      (line, i) =>
        `<div class="md-sync-line" data-md-line="${i}">${parseLineMarkdown(line)}</div>`,
    )
    .join('')
}

/** 将 Markdown 转为可安全插入 v-html 的 HTML（含 LaTeX / KaTeX） */
export function markdownToSafeHtml(md: string): string {
  const t = (md ?? '').trim()
  if (!t) return ''
  return sanitizeMarkdownHtml(parseMarkedHtml(t))
}

/** @deprecated 请用 markdownToSafeHtmlPerLine */
export function markdownToSafeHtmlFromAnchoredMarkdown(md: string): string {
  const t = md ?? ''
  if (!t.trim()) return ''
  return sanitizeMarkdownHtml(parseMarkedHtml(t))
}

/** @deprecated */
export function markdownToSafeHtmlWithLineAnchors(md: string): string {
  const t = md ?? ''
  if (!t.trim()) return ''
  return markdownToSafeHtmlFromAnchoredMarkdown(injectMarkdownLineAnchors(t))
}
