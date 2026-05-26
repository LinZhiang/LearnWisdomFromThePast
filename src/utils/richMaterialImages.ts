/** 从资料整理富文本 HTML 中提取图片并压缩，供视觉模型 OCR */

export type RichMaterialImage = {
  index: number
  dataUrl: string
  alt?: string
}

const MAX_IMAGES = 24
const OCR_BATCH_SIZE = 2

export function extractImagesFromRichHtml(html: string): RichMaterialImage[] {
  if (!html?.trim()) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const imgs = [...doc.querySelectorAll('img')]
  const out: RichMaterialImage[] = []
  for (const img of imgs) {
    const src = img.getAttribute('src')?.trim() ?? ''
    if (!src.startsWith('data:image/')) continue
    out.push({
      index: out.length + 1,
      dataUrl: src,
      alt: img.getAttribute('alt')?.trim() || undefined,
    })
    if (out.length >= MAX_IMAGES) break
  }
  return out
}

/** 富文本转纯文本（跳过图片节点，不插入 [附图] 占位） */
export function richHtmlToPlainTextOnly(html: string): string {
  if (!html?.trim()) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const parts: string[] = []
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? '').replace(/\s+/g, ' ')
      if (t.trim()) parts.push(t.trim())
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (tag === 'img') return
    if (tag === 'iframe' || tag === 'video' || tag === 'audio') {
      const src =
        el.getAttribute('src')?.trim() ||
        el.querySelector('source')?.getAttribute('src')?.trim() ||
        ''
      if (src) parts.push(`\n[视频/音频：${src}]\n`)
      return
    }
    if (/^h[1-6]$/.test(tag)) {
      const title = (el.textContent ?? '').trim()
      if (title) parts.push(`\n${'#'.repeat(Number(tag[1]) || 1)} ${title}\n`)
      return
    }
    if (tag === 'br') {
      parts.push('\n')
      return
    }
    if (tag === 'a') {
      const href = el.getAttribute('href')?.trim() ?? ''
      const text = (el.textContent ?? '').trim() || href
      parts.push(href && href !== text ? `${text}（${href}）` : text)
      return
    }
    if (tag === 'li') {
      parts.push('\n- ')
      for (const child of el.childNodes) walk(child)
      return
    }
    const blocks = ['p', 'div', 'blockquote', 'pre', 'ul', 'ol']
    if (blocks.includes(tag)) {
      for (const child of el.childNodes) walk(child)
      parts.push('\n')
      return
    }
    for (const child of el.childNodes) walk(child)
  }

  for (const child of doc.body.childNodes) walk(child)
  return parts
    .join(' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function compressImageDataUrl(
  dataUrl: string,
  maxEdge = 1280,
  quality = 0.82,
): Promise<string> {
  if (typeof document === 'undefined') return dataUrl
  if (dataUrl.length < 600_000) {
    return resizeIfNeeded(dataUrl, maxEdge, quality)
  }
  return resizeIfNeeded(dataUrl, maxEdge, quality)
}

function resizeIfNeeded(dataUrl: string, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (!w || !h) {
        resolve(dataUrl)
        return
      }
      const scale = Math.min(1, maxEdge / Math.max(w, h))
      if (scale >= 1 && dataUrl.length < 900_000) {
        resolve(dataUrl)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export async function prepareImagesForOcr(images: RichMaterialImage[]): Promise<RichMaterialImage[]> {
  const prepared: RichMaterialImage[] = []
  for (const img of images) {
    prepared.push({
      ...img,
      dataUrl: await compressImageDataUrl(img.dataUrl),
    })
  }
  return prepared
}

export function getOcrBatchSize(): number {
  return OCR_BATCH_SIZE
}

export function getMaxMaterialImages(): number {
  return MAX_IMAGES
}
