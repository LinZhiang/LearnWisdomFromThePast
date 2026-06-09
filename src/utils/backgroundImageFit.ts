/** 本地背景图的取景：焦点位置（%）、缩放、旋转与翻转 */
export type BackgroundImageFit = {
  focalX: number
  focalY: number
  /** 1 = 刚好铺满视口（cover），更大为放大 */
  zoom: number
  /** 顺时针角度（0–360） */
  rotation: number
  /** 水平镜像 */
  flipX: boolean
  /** 垂直镜像 */
  flipY: boolean
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
  rotation: 0,
  flipX: false,
  flipY: false,
}

export const BACKGROUND_IMAGE_ZOOM_MIN = 1
export const BACKGROUND_IMAGE_ZOOM_MAX = 3
export const BACKGROUND_IMAGE_ZOOM_STEP = 0.05
export const BACKGROUND_IMAGE_ROTATION_MIN = 0
export const BACKGROUND_IMAGE_ROTATION_MAX = 360
export const BACKGROUND_IMAGE_ROTATION_STEP = 1

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

export function clampRotation(value: number): number {
  const r = Number(value)
  if (!Number.isFinite(r)) return 0
  const wrapped = ((r % 360) + 360) % 360
  return Math.min(BACKGROUND_IMAGE_ROTATION_MAX, Math.max(BACKGROUND_IMAGE_ROTATION_MIN, wrapped))
}

function viewportSupportHalf(halfVw: number, halfVh: number, phi: number): number {
  return halfVw * Math.abs(Math.cos(phi)) + halfVh * Math.abs(Math.sin(phi))
}

function rotatedRectSupportHalf(
  halfIw: number,
  halfIh: number,
  phi: number,
  thetaRad: number,
): number {
  return (
    halfIw * Math.abs(Math.cos(phi - thetaRad)) + halfIh * Math.abs(Math.sin(phi - thetaRad))
  )
}

/**
 * 使旋转后的 iw×ih 在缩放 s 下能完全盖住居中视口的最小 s（再乘用户 zoom）。
 * 比外接矩形估算更严，避免旋转后四角露白。
 */
export function minRotatedCoverScale(
  intrinsicWidth: number,
  intrinsicHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  rotationDeg: number,
): number {
  const iw = Math.max(1, intrinsicWidth)
  const ih = Math.max(1, intrinsicHeight)
  const vw = Math.max(1, viewportWidth)
  const vh = Math.max(1, viewportHeight)
  const theta = (clampRotation(rotationDeg) * Math.PI) / 180

  if (theta === 0) {
    return Math.max(vw / iw, vh / ih)
  }

  const halfVw = vw / 2
  const halfVh = vh / 2
  const halfIw = iw / 2
  const halfIh = ih / 2
  let minScale = 0
  const steps = 360
  for (let i = 0; i < steps; i++) {
    const phi = (i * Math.PI * 2) / steps
    const vp = viewportSupportHalf(halfVw, halfVh, phi)
    const imgHalf = rotatedRectSupportHalf(halfIw, halfIh, phi, theta)
    if (imgHalf < 1e-9) continue
    minScale = Math.max(minScale, vp / imgHalf)
  }
  return minScale
}

/** 当前取景参数下的图层像素尺寸 */
export function computeBackgroundLayerSize(
  fit: BackgroundImageFit,
  containerWidth: number,
  containerHeight: number,
): { bw: number; bh: number } {
  const iw = Math.max(1, fit.intrinsicWidth)
  const ih = Math.max(1, fit.intrinsicHeight)
  const coverScale =
    minRotatedCoverScale(iw, ih, containerWidth, containerHeight, fit.rotation) *
    clampZoom(fit.zoom)
  return { bw: iw * coverScale, bh: ih * coverScale }
}

/** 旋转后可沿画面方向平移的余量（像素） */
export function computePanOverflow(
  fit: BackgroundImageFit,
  containerWidth: number,
  containerHeight: number,
): { overflowX: number; overflowY: number } {
  const { bw, bh } = computeBackgroundLayerSize(fit, containerWidth, containerHeight)
  const vw = Math.max(1, containerWidth)
  const vh = Math.max(1, containerHeight)
  const rad = (clampRotation(fit.rotation) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const effW = bw * cos + bh * sin
  const effH = bw * sin + bh * cos
  return {
    overflowX: Math.max(0, effW - vw),
    overflowY: Math.max(0, effH - vh),
  }
}

/** 将焦点限制在当前旋转/缩放下可平移范围内 */
export function clampFocalForPan(
  fit: BackgroundImageFit,
  containerWidth: number,
  containerHeight: number,
  focalX: number,
  focalY: number,
): { focalX: number; focalY: number } {
  const { overflowX, overflowY } = computePanOverflow(fit, containerWidth, containerHeight)
  return {
    focalX: overflowX > 0 ? clampFocal(focalX) : 50,
    focalY: overflowY > 0 ? clampFocal(focalY) : 50,
  }
}

/** 焦点 ↔ 相对视口中心的像素平移 */
export function focalToPanPixels(
  fit: BackgroundImageFit,
  containerWidth: number,
  containerHeight: number,
  focalX: number,
  focalY: number,
): { panX: number; panY: number } {
  const { overflowX, overflowY } = computePanOverflow(fit, containerWidth, containerHeight)
  const fx = clampFocal(focalX)
  const fy = clampFocal(focalY)
  return {
    panX: overflowX > 0 ? ((50 - fx) / 100) * overflowX : 0,
    panY: overflowY > 0 ? ((50 - fy) / 100) * overflowY : 0,
  }
}

/** 根据屏幕拖动增量更新焦点（平移在旋转之前，与手势方向一致） */
export function focalFromPanDelta(
  fit: BackgroundImageFit,
  containerWidth: number,
  containerHeight: number,
  dx: number,
  dy: number,
  startFocalX: number,
  startFocalY: number,
): { focalX: number; focalY: number } {
  const { overflowX, overflowY } = computePanOverflow(fit, containerWidth, containerHeight)
  const start = focalToPanPixels(fit, containerWidth, containerHeight, startFocalX, startFocalY)
  const panX = start.panX + dx
  const panY = start.panY + dy
  let focalX = startFocalX
  let focalY = startFocalY
  if (overflowX > 0) focalX = 50 - (panX / overflowX) * 100
  if (overflowY > 0) focalY = 50 - (panY / overflowY) * 100
  return clampFocalForPan(fit, containerWidth, containerHeight, focalX, focalY)
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
    rotation: clampRotation(raw?.rotation ?? DEFAULT_BACKGROUND_IMAGE_FIT.rotation),
    flipX: Boolean(raw?.flipX),
    flipY: Boolean(raw?.flipY),
    intrinsicWidth: Math.max(1, Math.round(raw?.intrinsicWidth ?? intrinsicWidth)),
    intrinsicHeight: Math.max(1, Math.round(raw?.intrinsicHeight ?? intrinsicHeight)),
  }
}

/** 读取 data URL / 网络图尺寸 */
export function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const done = () => {
      resolve({
        width: img.naturalWidth || 1,
        height: img.naturalHeight || 1,
      })
    }
    img.onload = () => {
      void (async () => {
        try {
          if (typeof img.decode === 'function') await img.decode()
        } catch {
          /* 解码失败仍尝试用 naturalWidth/Height */
        }
        done()
      })()
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
  const { bw, bh } = computeBackgroundLayerSize(fit, vw, vh)

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

/** 平移 → 旋转 → 翻转（绕图层中心） */
export function buildBackgroundFitTransform(
  panX: number,
  panY: number,
  rotationDeg: number,
  flipX: boolean,
  flipY: boolean,
): string {
  const parts = [`translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))`]
  const rot = clampRotation(rotationDeg)
  if (rot !== 0) parts.push(`rotate(${rot}deg)`)
  const sx = flipX ? -1 : 1
  const sy = flipY ? -1 : 1
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`)
  return parts.join(' ')
}

/** 恢复默认取景（保留当前图尺寸） */
export function resetBackgroundImageFit(
  intrinsicWidth: number,
  intrinsicHeight: number,
): BackgroundImageFit {
  return createDefaultBackgroundImageFit(intrinsicWidth, intrinsicHeight)
}

/** 取景图层 <img> 样式（预览区与全页背景共用） */
export function computeBackgroundFitImgStyle(
  fit: BackgroundImageFit,
  containerWidth: number,
  containerHeight: number,
): Record<string, string> {
  const { bw, bh } = computeBackgroundLayerSize(fit, containerWidth, containerHeight)
  const { panX, panY } = focalToPanPixels(
    fit,
    containerWidth,
    containerHeight,
    fit.focalX,
    fit.focalY,
  )
  const transform = buildBackgroundFitTransform(
    panX,
    panY,
    fit.rotation,
    fit.flipX,
    fit.flipY,
  )
  return {
    position: 'absolute',
    width: `${bw}px`,
    height: `${bh}px`,
    maxWidth: 'none',
    left: '50%',
    top: '50%',
    transform,
    pointerEvents: 'none',
    userSelect: 'none',
  }
}

/** @deprecated 使用 computeBackgroundFitImgStyle */
export function computeBackgroundFitPreviewImgStyle(
  fit: BackgroundImageFit,
  frameWidth: number,
  frameHeight: number,
): Record<string, string> {
  return computeBackgroundFitImgStyle(fit, frameWidth, frameHeight)
}
