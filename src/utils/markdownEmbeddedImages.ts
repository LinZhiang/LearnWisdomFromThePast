/** 编辑区占位：内嵌图片用短引用，避免 base64 占满左侧文本框 */
export const EMBED_REF_PREFIX = ':embed:'

const EMBEDDED_DATA_IMAGE_RE = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+)\)/gi
const EMBED_REF_RE = /!\[([^\]]*)\]\(\s*:embed:(\d+)\s*\)/gi
const LOOSE_DATA_LINE_RE = /(?:^|[\r\n]+)\s*data:image\/[a-z0-9+.-]+;base64,[a-z0-9+/=\s]+(?=[\r\n]|$)/gi
const AFTER_EMBED_LOOSE_RE =
  /(\]\(:embed:\d+\))[\s\r\n]*data:image\/[^;]+;base64,[a-z0-9+/=\s]+/gi
const PAREN_DATA_ORPHAN_RE =
  /(?:^|[\r\n]+)\s*\(data:image\/[^;]+;base64,[a-z0-9+/=\s]+\)(?=[\r\n]|$)/gi

const LOOSE_DATA_CAPTURE_RE =
  /(?:^|[\r\n]+)\s*(data:image\/[a-z0-9+.-]+;base64,[a-z0-9+/=\s]+)(?=[\r\n]|$)/gi

/** 将单独成行的 data URL 转为标准 Markdown 图片，避免「多媒体」区被误删 */
export function convertLooseDataImageLinesToMarkdown(text: string): string {
  return text.replace(LOOSE_DATA_CAPTURE_RE, (_, url: string) => {
    const u = url.trim()
    return u ? `\n\n![图片](${u})\n` : ''
  })
}

/** 去掉误粘贴到 :embed 标记后的裸 base64、单独成行 data URL 等脏数据 */
export function stripLooseDataImagePayloads(text: string): string {
  let out = text
    .replace(AFTER_EMBED_LOOSE_RE, '$1')
    .replace(LOOSE_DATA_LINE_RE, '\n')
    .replace(PAREN_DATA_ORPHAN_RE, '\n')
  return out.replace(/\n{3,}/g, '\n\n')
}

export function collapseEmbeddedImages(
  markdown: string,
  previousEmbeds: string[] = [],
): { text: string; embeds: string[] } {
  const source =
    previousEmbeds.length > 0
      ? expandEmbeddedImages(markdown, previousEmbeds)
      : markdown
  const embeds: string[] = []
  const normalized = convertLooseDataImageLinesToMarkdown(source)
  let text = normalized.replace(EMBEDDED_DATA_IMAGE_RE, (_, alt: string, url: string) => {
    const idx = embeds.length
    embeds.push(url)
    const safeAlt = (alt ?? '').trim() || '图片'
    return `![${safeAlt}](${EMBED_REF_PREFIX}${idx})`
  })
  text = stripLooseDataImagePayloads(text)
  return { text, embeds }
}

export function expandEmbeddedImages(text: string, embeds: string[]): string {
  return text.replace(EMBED_REF_RE, (_, alt: string, idxStr: string) => {
    const idx = Number(idxStr)
    const url = embeds[idx]
    if (!url) return `![${alt}](${EMBED_REF_PREFIX}${idxStr})`
    const safeAlt = (alt ?? '').trim() || '图片'
    return `![${safeAlt}](${url})`
  })
}

export function buildEmbedRefLine(index: number, alt = '图片'): string {
  const safeAlt = alt.replace(/[\[\]()]/g, ' ').trim() || '图片'
  return `![${safeAlt}](${EMBED_REF_PREFIX}${index})`
}

export function listEmbedRefsInText(text: string): Array<{ index: number; alt: string }> {
  const out: Array<{ index: number; alt: string }> = []
  const re = new RegExp(EMBED_REF_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ index: Number(m[2]), alt: (m[1] ?? '').trim() || '图片' })
  }
  return out
}

export function sameEmbedStore(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((url, i) => url === b[i])
}

/** 折叠/规范化后尽量保持光标在对应语义位置 */
export function mapCursorAfterTextChange(
  oldText: string,
  newText: string,
  cursor: number,
): number {
  if (oldText === newText) return Math.min(Math.max(0, cursor), newText.length)
  const pos = Math.max(0, Math.min(cursor, oldText.length))
  const prefix = oldText.slice(0, pos)
  if (newText.startsWith(prefix)) return prefix.length
  const line = (prefix.match(/\n/g)?.length ?? 0)
  const col = pos - (oldText.lastIndexOf('\n', pos - 1) + 1)
  const newLines = newText.split('\n')
  let at = 0
  for (let i = 0; i < line && i < newLines.length; i++) {
    at += newLines[i].length + 1
  }
  if (line < newLines.length) {
    return Math.min(at + col, newText.length)
  }
  return newText.length
}

/** 保存前检测：仍存在未解析的 :embed:N 占位（内嵌图数据已丢失） */
export function markdownHasUnresolvedEmbedRefs(md: string): boolean {
  return /!\[[^\]]*\]\(\s*:embed:\d+\s*\)/i.test(md)
}

export function formatEmbedChipLabel(index: number, alt: string, dataUrl: string): string {
  const mime = dataUrl.match(/^data:(image\/[^;]+)/i)?.[1]?.replace('image/', '') ?? '图片'
  const approxKb = Math.max(1, Math.round((dataUrl.length * 3) / 4 / 1024))
  const name = (alt || '图片').trim()
  return `图${index + 1} ${name}（${mime}，约 ${approxKb} KB）`
}
