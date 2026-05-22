/** 常见图片扩展名（部分系统/浏览器不填 file.type，仅靠扩展名判断） */
const IMAGE_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'avif',
  'svg',
  'ico',
  'heic',
  'heif',
])

export function isLikelyImageFile(file: File): boolean {
  const t = file.type?.toLowerCase() ?? ''
  if (t.startsWith('image/')) return true
  const name = file.name?.toLowerCase() ?? ''
  const i = name.lastIndexOf('.')
  if (i < 0) return false
  return IMAGE_EXT.has(name.slice(i + 1))
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const x = r.result
      if (typeof x === 'string') resolve(x)
      else reject(new Error('read'))
    }
    r.onerror = () => reject(new Error('read'))
    r.readAsDataURL(file)
  })
}

/**
 * 将位图压成适合塞进 localStorage 的 data URL（优先 JPEG 体积更小）。
 * SVG 不栅格化，直接读文本 data URL。
 */
export async function fileToStorableBackgroundDataUrl(
  file: File,
  maxEdge: number,
  jpegQuality: number,
): Promise<string> {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()

  if (type === 'image/svg+xml' || name.endsWith('.svg')) {
    return readFileAsDataUrl(file)
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // 部分格式 createImageBitmap 不支持，退回 <img>
    const raw = await readFileAsDataUrl(file)
    const img = new Image()
    const done = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode'))
    })
    img.decoding = 'async'
    img.src = raw
    await done
    return rasterToJpegDataUrl(img, maxEdge, jpegQuality)
  }

  try {
    return rasterToJpegDataUrl(bitmap, maxEdge, jpegQuality)
  } finally {
    bitmap.close()
  }
}

function rasterToJpegDataUrl(
  img: HTMLImageElement | ImageBitmap,
  maxEdge: number,
  jpegQuality: number,
): string {
  let w = img.width
  let h = img.height
  const scale = Math.min(1, maxEdge / Math.max(w, h, 1))
  w = Math.max(1, Math.round(w * scale))
  h = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', jpegQuality)
}
