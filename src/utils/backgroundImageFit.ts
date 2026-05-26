/** 本地背景图的取景：焦点位置（%）与相对「铺满」的缩放 */
export type BackgroundImageFit = {
  focalX: number
  focalY: number
  /** 1 = 刚好铺满视口（cover），更大为放大 */
  zoom: number
  intrinsicWidth: number
  intrinsicHeight: number
}

export const DEFAULT_BACKGROUND_IMAGE_FIT: Omit<
  BackgroundImageFit,
  'intrinsicWidth' | 'intrinsicHeight'
> = {
  focalX: 50,
  focalY: 50,
  zoom: 1,
}

export const BACKGROUND_IMAGE_ZOOM_MIN = 1
export const BACKGROUND_IMAGE_ZOOM_MAX = 3
export const BACKGROUND_IMAGE_ZOOM_STEP = 0.05

export function isDataUrlBackground(url: string): boolean {
  return /^data:image\//i.test(url.trim())
}

export function clampFocal(value: number): number {
  return Math.min(100, Math.max(0, Number(value) || 0))
}

export function clampZoom(value: number): number {
  const z = Number(value)
  if (!Number.isFinite(z)) return 1
  return Math.min(BACKGROUND_IMAGE_ZOOM_MAX, Math.max(BACKGROUND_IMAGE_ZOOM_MIN, z))
}

export function createDefaultBackgroundImageFit(
  intrinsicWidth: number,
  intrinsicHeight: number,
): BackgroundImageFit {
  return {
    ...DEFAULT_BACKGROUND_IMAGE_FIT,
    intrinsicWidth: Math.max(1, Math.round(intrinsicWidth)),
    intrinsicHeight: Math.max(1, Math.round(intrinsicHeight)),
  }
}

export function normalizeBackgroundImageFit(
  raw: Partial<BackgroundImageFit> | null | undefined,
  intrinsicWidth: number,
  intrinsicHeight: number,
): BackgroundImageFit {
  return {
    focalX: clampFocal(raw?.focalX ?? DEFAULT_BACKGROUND_IMAGE_FIT.focalX),
    focalY: clampFocal(raw?.focalY ?? DEFAULT_BACKGROUND_IMAGE_FIT.focalY),
    zoom: clampZoom(raw?.zoom ?? DEFAULT_BACKGROUND_IMAGE_FIT.zoom),
    intrinsicWidth: Math.max(1, Math.round(raw?.intrinsicWidth ?? intrinsicWidth)),
    intrinsicHeight: Math.max(1, Math.round(raw?.intrinsicHeight ?? intrinsicHeight)),
  }
}

/** 读取 data URL / 网络图尺寸 */
export function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        width: img.naturalWidth || 1,
        height: img.naturalHeight || 1,
      })
    }
    img.onerror = () => reject(new Error('decode'))
    img.src = src
  })
}

/**
 * 按视口计算背景图层 background-size / background-position（与全页 shell 一致）。
 */
export function computeBackgroundFitCss(
  fit: BackgroundImageFit,
  viewportWidth: number,
  viewportHeight: number,
): { backgroundSize: string; backgroundPosition: string } {
  const vw = Math.max(1, viewportWidth)
  const vh = Math.max(1, viewportHeight)
  const iw = Math.max(1, fit.intrinsicWidth)
  const ih = Math.max(1, fit.intrinsicHeight)
  const zoom = clampZoom(fit.zoom)

  const coverScale = Math.max(vw / iw, vh / ih)
  const scale = coverScale * zoom
  const bw = iw * scale
  const bh = ih * scale

  const fx = clampFocal(fit.focalX)
  const fy = clampFocal(fit.focalY)

  return {
    backgroundSize: `${bw}px ${bh}px`,
    backgroundPosition: `${fx}% ${fy}%`,
  }
}

/** 预览区（固定宽高）内的图层样式 */
export function computeBackgroundFitPreviewStyle(
  fit: BackgroundImageFit,
  frameWidth: number,
  frameHeight: number,
  imageUrl: string,
): Record<string, string> {
  const { backgroundSize, backgroundPosition } = computeBackgroundFitCss(
    fit,
    frameWidth,
    frameHeight,
  )
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundSize,
    backgroundPosition,
    backgroundRepeat: 'no-repeat',
  }
}
