const EMBED_LINE_RE = /!\[[^\]]*\]\(\s*:embed:(\d+)\s*\)/i

export type MarkdownScrollMaps = {
  lineCount: number
  sourceLineHeight: number
  sourcePaddingTop: number
  previewBlockCount: number
  mappingValid: boolean
}

export function splitMarkdownLines(md: string): string[] {
  if (!md) return ['']
  const normalized = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return normalized.split('\n')
}

export function parseEmbedIndexOnLine(line: string): number | null {
  const m = line.match(EMBED_LINE_RE)
  if (!m) return null
  const idx = Number(m[1])
  return Number.isFinite(idx) ? idx : null
}

/** @deprecated */
export function injectMarkdownLineAnchors(md: string): string {
  const lines = splitMarkdownLines(md)
  return lines
    .map(
      (line, i) =>
        `<span data-md-line="${i}" class="md-sync-anchor" aria-hidden="true"></span>\n${line}`,
    )
    .join('\n\n')
}

export function readLineHeightPx(el: HTMLElement): number {
  const style = getComputedStyle(el)
  const lh = parseFloat(style.lineHeight)
  if (Number.isFinite(lh) && lh > 0) return lh
  const fs = parseFloat(style.fontSize) || 14
  return fs * 1.55
}

/** 元素顶部在滚动容器内容坐标系中的 Y（px） */
export function contentTopInScroller(scroller: HTMLElement, el: HTMLElement): number {
  const scrollerRect = scroller.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  return elRect.top - scrollerRect.top + scroller.scrollTop
}

export function findPreviewLineBlock(
  previewRoot: HTMLElement,
  line: number,
): HTMLElement | null {
  const prose =
    (previewRoot.querySelector('.markdown-prose-preview') as HTMLElement | null) ??
    previewRoot
  const block = prose.querySelector(`.md-sync-line[data-md-line="${line}"]`)
  return block instanceof HTMLElement ? block : null
}

function countPreviewBlocks(previewRoot: HTMLElement): number {
  const prose =
    (previewRoot.querySelector('.markdown-prose-preview') as HTMLElement | null) ??
    previewRoot
  return prose.querySelectorAll('.md-sync-line[data-md-line]').length
}

function computeSourceMetrics(sourceRoot: HTMLElement) {
  const style = getComputedStyle(sourceRoot)
  const paddingTop = parseFloat(style.paddingTop) || 0
  const lineHeight = readLineHeightPx(sourceRoot)
  return { paddingTop, lineHeight: Math.max(1, lineHeight) }
}

/** 左侧 scrollTop → 行号 + 行内比例（要求 textarea 为 white-space: pre，一行源码一行显示） */
export function lineFractionAtSourceScroll(
  maps: MarkdownScrollMaps,
  scrollTop: number,
  sourceMaxScroll: number,
): { line: number; frac: number } {
  const h = maps.sourceLineHeight
  if (h <= 0 || maps.lineCount <= 0) return { line: 0, frac: 0 }
  if (scrollTop >= sourceMaxScroll - 1) {
    return { line: maps.lineCount - 1, frac: 1 }
  }
  const rel = Math.max(0, scrollTop - maps.sourcePaddingTop)
  const t = rel / h
  const line = Math.min(maps.lineCount - 1, Math.max(0, Math.floor(t)))
  const frac = Math.min(1, Math.max(0, t - line))
  return { line, frac }
}

/** 右侧：根据当前 scrollTop 反查落在哪一行块内 */
export function lineFractionAtPreviewScroll(
  previewRoot: HTMLElement,
  scrollTop: number,
  previewMaxScroll: number,
  lineCount: number,
): { line: number; frac: number } {
  if (lineCount <= 0) return { line: 0, frac: 0 }
  if (scrollTop >= previewMaxScroll - 1) {
    return { line: lineCount - 1, frac: 1 }
  }

  const prose =
    (previewRoot.querySelector('.markdown-prose-preview') as HTMLElement | null) ??
    previewRoot
  const blocks = prose.querySelectorAll<HTMLElement>('.md-sync-line[data-md-line]')

  let line = 0
  let frac = 0
  for (const block of blocks) {
    const attr = block.getAttribute('data-md-line')
    if (attr == null) continue
    const i = Number(attr)
    if (!Number.isFinite(i) || i < 0 || i >= lineCount) continue
    const top = contentTopInScroller(previewRoot, block)
    const h = Math.max(block.offsetHeight, 1)
    if (top <= scrollTop + 2) {
      line = i
      frac = Math.min(1, Math.max(0, (scrollTop - top) / h))
    }
  }
  return { line, frac }
}

export function buildMarkdownScrollMaps(
  sourceText: string,
  previewMarkdown: string,
  sourceRoot: HTMLElement | null,
  previewRoot: HTMLElement | null,
): MarkdownScrollMaps | null {
  if (!previewRoot || !sourceRoot) return null

  const lineCount = splitMarkdownLines(sourceText).length
  const previewLineCount = splitMarkdownLines(previewMarkdown).length
  const previewBlockCount = countPreviewBlocks(previewRoot)
  const sourceMetrics = computeSourceMetrics(sourceRoot)

  const mappingValid =
    lineCount > 0 &&
    previewLineCount === lineCount &&
    previewBlockCount >= Math.max(1, Math.floor(lineCount * 0.7))

  return {
    lineCount,
    sourceLineHeight: sourceMetrics.lineHeight,
    sourcePaddingTop: sourceMetrics.paddingTop,
    previewBlockCount,
    mappingValid,
  }
}

export function scrollPreviewToMatchSource(
  maps: MarkdownScrollMaps,
  sourceScrollTop: number,
  sourceEl: HTMLElement,
  previewEl: HTMLElement,
): void {
  const sourceMax = Math.max(0, sourceEl.scrollHeight - sourceEl.clientHeight)
  const { line, frac } = lineFractionAtSourceScroll(maps, sourceScrollTop, sourceMax)

  const block = findPreviewLineBlock(previewEl, line)
  if (!block) {
    ratioScroll(sourceEl, previewEl)
    return
  }

  const top = contentTopInScroller(previewEl, block)
  const h = Math.max(block.offsetHeight, 1)
  const target = top + frac * h
  const max = Math.max(0, previewEl.scrollHeight - previewEl.clientHeight)
  previewEl.scrollTop = Math.min(max, Math.max(0, target))
}

export function scrollSourceToMatchPreview(
  maps: MarkdownScrollMaps,
  previewScrollTop: number,
  sourceEl: HTMLElement,
  previewEl: HTMLElement,
): void {
  const previewMax = Math.max(0, previewEl.scrollHeight - previewEl.clientHeight)
  const { line, frac } = lineFractionAtPreviewScroll(
    previewEl,
    previewScrollTop,
    previewMax,
    maps.lineCount,
  )

  const target = maps.sourcePaddingTop + (line + frac) * maps.sourceLineHeight
  const max = Math.max(0, sourceEl.scrollHeight - sourceEl.clientHeight)
  sourceEl.scrollTop = Math.min(max, Math.max(0, target))
}

export function ratioScroll(from: HTMLElement, to: HTMLElement): void {
  const fromMax = from.scrollHeight - from.clientHeight
  const toMax = to.scrollHeight - to.clientHeight
  if (fromMax <= 0) {
    to.scrollTop = 0
    return
  }
  const ratio = from.scrollTop / fromMax
  to.scrollTop = ratio * Math.max(0, toMax)
}
