const MARKDOWN_HTTP_IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g
const HAS_MARKDOWN_HTTP_IMAGE_RE = /!\[[^\]]*\]\(https?:\/\//

/** 将图片文件读为 data URL；过大时压缩后嵌入 */
export async function readImageFileAsDataUrl(file: File): Promise<string | null> {
  const prepared = await compressImageFileForEmbed(file)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(prepared)
  })
}

/** 缩小体积，避免讲义内容过大导致粘贴/保存失败 */
export async function compressImageFileForEmbed(
  file: File,
  maxWidth = 1400,
  quality = 0.82,
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file
  }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') || 'image.jpg', {
      type: 'image/jpeg',
    })
  } catch {
    return file
  }
}

export function buildMarkdownImageLine(src: string, alt = '图片'): string {
  const safeAlt = alt.replace(/[\[\]()]/g, ' ').trim() || '图片'
  return `![${safeAlt}](${src})`
}

/** 在 textarea 光标处插入文本，并尽量保持前后空行 */
export function insertTextIntoTextarea(
  textarea: HTMLTextAreaElement,
  current: string,
  insertion: string,
): { next: string; cursor: number } {
  const start = textarea.selectionStart ?? current.length
  const end = textarea.selectionEnd ?? start
  const before = current.slice(0, start)
  const after = current.slice(end)

  const padBefore = before.length > 0 && !before.endsWith('\n') ? '\n\n' : ''
  const padAfter = after.length > 0 && !after.startsWith('\n') ? '\n\n' : ''
  const block = `${padBefore}${insertion}${padAfter}`

  const next = before + block + after
  const cursor = before.length + block.length
  return { next, cursor }
}

export function focusTextareaCursor(textarea: HTMLTextAreaElement, pos: number) {
  textarea.focus()
  textarea.selectionStart = pos
  textarea.selectionEnd = pos
}

export async function embedImageSrcForMarkdown(src: string): Promise<string> {
  const trimmed = src.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('data:')) return trimmed

  try {
    const res = await fetch(trimmed, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) return trimmed
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return trimmed
    const file = new File([blob], 'clipboard.jpg', { type: blob.type || 'image/jpeg' })
    const dataUrl = await readImageFileAsDataUrl(file)
    return dataUrl ?? trimmed
  } catch {
    return trimmed
  }
}

export async function inlineMarkdownHttpImages(markdown: string): Promise<string> {
  const matches = [...markdown.matchAll(MARKDOWN_HTTP_IMAGE_RE)]
  if (matches.length === 0) return markdown

  let result = markdown
  for (const m of matches) {
    const full = m[0]
    const alt = m[1] ?? '图片'
    const url = m[2]
    if (!url) continue
    const embedded = await embedImageSrcForMarkdown(url)
    const line = buildMarkdownImageLine(embedded, alt)
    result = result.replace(full, line)
  }
  return result
}

/** 从 HTML 剪贴板提取正文（去掉图片节点） */
export function plainTextFromHtmlClipboard(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const img of doc.querySelectorAll('img')) {
    img.remove()
  }
  return (doc.body.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

export function extractImagesFromHtml(html: string): Array<{ src: string; alt: string }> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: Array<{ src: string; alt: string }> = []
  for (const img of doc.querySelectorAll('img')) {
    const src = img.getAttribute('src')?.trim() ?? ''
    if (!src) continue
    const alt = img.getAttribute('alt')?.trim() || img.getAttribute('title')?.trim() || '图片'
    out.push({ src, alt })
  }
  return out
}

/** 从 HTML 剪贴板（豆包/网页复制）生成可插入的 Markdown 图片块 */
export async function markdownImagesFromHtmlClipboard(html: string): Promise<string> {
  const imgs = extractImagesFromHtml(html)
  if (imgs.length === 0) return ''

  const lines: string[] = []
  for (const img of imgs) {
    const src = await embedImageSrcForMarkdown(img.src)
    lines.push(buildMarkdownImageLine(src, img.alt))
  }
  return lines.join('\n\n')
}

/** 从剪贴板事件中取第一张图片文件（含 files 与 items） */
export function getClipboardImageFile(event: ClipboardEvent): File | null {
  const dt = event.clipboardData
  if (!dt) return null

  const files = dt.files
  if (files?.length) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f?.type.startsWith('image/')) return f
    }
  }

  const items = dt.items
  if (items?.length) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item) continue
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) return file
      }
    }
  }
  return null
}

/** 部分浏览器截图仅能通过异步 Clipboard API 读到图片 */
export async function readClipboardImageFileAsync(): Promise<File | null> {
  if (!navigator.clipboard?.read) return null
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'))
      if (!imageType) continue
      const blob = await item.getType(imageType)
      const ext = imageType.split('/')[1] || 'png'
      return new File([blob], `paste.${ext}`, { type: imageType })
    }
  } catch {
    return null
  }
  return null
}

export async function insertMarkdownImageAtTextarea(
  textarea: HTMLTextAreaElement,
  current: string,
  file: File,
  alt?: string,
): Promise<string | null> {
  const dataUrl = await readImageFileAsDataUrl(file)
  if (!dataUrl) return null
  const line = buildMarkdownImageLine(dataUrl, alt)
  const { next, cursor } = insertTextIntoTextarea(textarea, current, line)
  focusTextareaCursor(textarea, cursor)
  return next
}

export type MarkdownPasteResult = {
  handled: boolean
  nextContent?: string
  message?: string
}

const PLAIN_DATA_IMAGE_MD_RE = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+)\)/i
const PLAIN_DATA_URL_RE = /^data:image\/[a-z0-9+.-]+;base64,[a-z0-9+/=\s]+$/i

/** 同步判断：需拦截默认粘贴并由脚本插入（避免与异步处理竞态导致重复 base64） */
export function shouldInterceptMarkdownPaste(event: ClipboardEvent): boolean {
  const dt = event.clipboardData
  if (!dt) return false
  if (getClipboardImageFile(event)) return true
  if (dt.types.some((t) => t.startsWith('image/'))) return true
  const html = dt.getData('text/html') ?? ''
  const plain = (dt.getData('text/plain') ?? '').trim()
  if (html && /<img[\s>]/i.test(html)) return true
  if (plain && HAS_MARKDOWN_HTTP_IMAGE_RE.test(plain)) return true
  if (plain && PLAIN_DATA_IMAGE_MD_RE.test(plain)) return true
  if (plain && PLAIN_DATA_URL_RE.test(plain)) return true
  return false
}

/**
 * 统一处理 Markdown 编辑器粘贴：截图、图片文件、豆包/网页 HTML、带外链的 Markdown 图片语法。
 */
export async function processMarkdownEditorPaste(
  event: ClipboardEvent,
  textarea: HTMLTextAreaElement,
  current: string,
): Promise<MarkdownPasteResult> {
  const dt = event.clipboardData
  if (!dt) return { handled: false }

  let file = getClipboardImageFile(event)
  if (!file && dt.types?.some((t) => t.startsWith('image/'))) {
    file = await readClipboardImageFileAsync()
  }
  if (file) {
    const next = await insertMarkdownImageAtTextarea(textarea, current, file)
    if (!next) return { handled: true, message: '图片读取失败' }
    return { handled: true, nextContent: next, message: '已插入图片' }
  }

  const plain = dt.getData('text/plain') ?? ''
  const html = dt.getData('text/html') ?? ''
  const plainTrim = plain.trim()

  if (plainTrim && PLAIN_DATA_URL_RE.test(plainTrim)) {
    const line = buildMarkdownImageLine(plainTrim, '图片')
    const { next, cursor } = insertTextIntoTextarea(textarea, current, line)
    focusTextareaCursor(textarea, cursor)
    return { handled: true, nextContent: next, message: '已插入图片' }
  }

  if (plainTrim && PLAIN_DATA_IMAGE_MD_RE.test(plainTrim)) {
    const { next, cursor } = insertTextIntoTextarea(textarea, current, plainTrim)
    focusTextareaCursor(textarea, cursor)
    return { handled: true, nextContent: next, message: '已粘贴图片' }
  }

  if (plainTrim && HAS_MARKDOWN_HTTP_IMAGE_RE.test(plainTrim)) {
    const inlined = await inlineMarkdownHttpImages(plainTrim)
    const { next, cursor } = insertTextIntoTextarea(textarea, current, inlined)
    focusTextareaCursor(textarea, cursor)
    return {
      handled: true,
      nextContent: next,
      message:
        inlined === plainTrim
          ? '已粘贴；外链图片若预览空白，请对图片单独复制后粘贴'
          : '已粘贴并内嵌图片',
    }
  }

  if (html && /<img[\s>]/i.test(html)) {
    const imageBlock = await markdownImagesFromHtmlClipboard(html)
    if (imageBlock) {
      let insertion = imageBlock
      if (plainTrim) {
        insertion = `${plainTrim}\n\n${imageBlock}`
      } else {
        const textFromHtml = plainTextFromHtmlClipboard(html)
        if (textFromHtml) insertion = `${textFromHtml}\n\n${imageBlock}`
      }
      const { next, cursor } = insertTextIntoTextarea(textarea, current, insertion)
      focusTextareaCursor(textarea, cursor)
      return { handled: true, nextContent: next, message: '已粘贴文本并提取图片' }
    }
  }

  return { handled: false }
}

export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      resolve(input.files?.[0] ?? null)
      input.remove()
    }
    input.click()
  })
}
