/** 将富文本 HTML 转为供 DeepSeek 使用的结构化纯文本（保留标题层级与媒体标注） */

function walkNode(node: Node, parts: string[], counters: { image: number; video: number }): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent ?? '').replace(/\s+/g, ' ')
    if (t.trim()) parts.push(t.trim())
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  if (tag === 'img') {
    counters.image += 1
    const alt = el.getAttribute('alt')?.trim()
    parts.push(`\n[附图${counters.image}${alt ? `：${alt}` : ''}]\n`)
    return
  }

  if (tag === 'iframe' || tag === 'video' || tag === 'audio') {
    counters.video += 1
    const src =
      el.getAttribute('src')?.trim() ||
      el.querySelector('source')?.getAttribute('src')?.trim() ||
      '嵌入媒体'
    parts.push(`\n[视频/音频${counters.video}：${src}]\n`)
    return
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]) || 1
    const title = (el.textContent ?? '').trim()
    if (title) parts.push(`\n${'#'.repeat(level)} ${title}\n`)
    return
  }

  if (tag === 'br') {
    parts.push('\n')
    return
  }

  if (tag === 'a') {
    const href = el.getAttribute('href')?.trim() ?? ''
    const text = (el.textContent ?? '').trim() || href
    if (/youtube|youtu\.be|bilibili|\.mp4|\.webm|video|v\.qq/i.test(href)) {
      counters.video += 1
      parts.push(`\n[视频${counters.video}：${href || text}]\n`)
    } else {
      parts.push(href && href !== text ? `${text}（${href}）` : text)
    }
    return
  }

  if (tag === 'li') {
    parts.push('\n- ')
    for (const child of el.childNodes) walkNode(child, parts, counters)
    return
  }

  const blockTags = ['p', 'div', 'blockquote', 'pre', 'ul', 'ol', 'table', 'tr', 'td', 'th']
  if (blockTags.includes(tag)) {
    for (const child of el.childNodes) walkNode(child, parts, counters)
    parts.push('\n')
    return
  }

  for (const child of el.childNodes) walkNode(child, parts, counters)
}

export function richHtmlToAiMaterial(html: string): string {
  if (!html?.trim()) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const parts: string[] = []
  const counters = { image: 0, video: 0 }
  for (const child of doc.body.childNodes) {
    walkNode(child, parts, counters)
  }
  return parts
    .join(' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
