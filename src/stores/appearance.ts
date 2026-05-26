import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  computeBackgroundFitCss,
  createDefaultBackgroundImageFit,
  isDataUrlBackground,
  loadImageDimensions,
  type BackgroundImageFit,
  normalizeBackgroundImageFit,
} from '@/utils/backgroundImageFit'

export type ThemeStyle = 'light' | 'dark' | 'soft'

interface AppearanceSettings {
  backgroundColor: string
  backgroundOpacity: number
  backgroundImage: string
  /** 本地 data URL 背景的取景（焦点、缩放） */
  backgroundImageFit?: BackgroundImageFit | null
  /** 顶栏、卡片、设置页等使用 --app-surface / --app-surface-alt 的底色不透明度（0–1），不影响文字与内容图 */
  chromeOpacity: number
  themeStyle: ThemeStyle
}

const STORAGE_KEY = 'wengu-zhixuewang-appearance'
const LEGACY_APPEARANCE_KEYS = ['shikao-zhixue-appearance', 'my-learning-app-appearance'] as const

const defaultSettings: AppearanceSettings = {
  backgroundColor: '#ffffff',
  backgroundOpacity: 1,
  backgroundImage: '',
  backgroundImageFit: null,
  chromeOpacity: 0.92,
  themeStyle: 'light',
}

let viewportResizeBound = false

function bindViewportResize(viewportW: { value: number }, viewportH: { value: number }) {
  if (viewportResizeBound || typeof window === 'undefined') return
  viewportResizeBound = true
  const sync = () => {
    viewportW.value = window.innerWidth
    viewportH.value = window.innerHeight
  }
  window.addEventListener('resize', sync)
  sync()
}

/** 切换整体风格时同步到设置里的「背景色」，与各主题画布/氛围一致（用户仍可再改）。 */
const themeDefaultBackgroundColor: Record<ThemeStyle, string> = {
  light: '#ffffff',
  dark: '#1e293b',
  soft: '#faf5ff',
}

const clampOpacity = (value: number) => Math.min(1, Math.max(0, value))

/** 与全局 style.css 中 html/body.app-theme-* 对齐，供 Teleport 弹层继承变量 */
export function applyAppearanceThemeToDocument(style: ThemeStyle) {
  if (typeof document === 'undefined') return
  const cls =
    style === 'dark' ? 'app-theme-dark' : style === 'soft' ? 'app-theme-soft' : 'app-theme-light'
  for (const el of [document.documentElement, document.body]) {
    el.classList.remove('app-theme-light', 'app-theme-dark', 'app-theme-soft')
    el.classList.add(cls)
  }
}

const toRgbaColor = (hexColor: string, opacity: number) => {
  const hex = hexColor.trim().replace('#', '')
  if (!/^[\da-fA-F]{6}$/.test(hex)) return hexColor
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${clampOpacity(opacity)})`
}

/** 归一化 #rgb / #rrggbb 便于比较 */
function normalizeHex6(hexColor: string): string | null {
  const raw = hexColor.trim().replace('#', '').toLowerCase()
  if (/^[\da-f]{3}$/.test(raw)) return raw.split('').map((c) => c + c).join('')
  if (/^[\da-f]{6}$/.test(raw)) return raw
  return null
}

/**
 * 设置里默认「白 + 100%」在浅色主题用于提亮；在深色/柔和下若仍保留该默认，
 * 会整块盖住 --app-outer-canvas，看起来像最外层仍是白底。此时视为不叠色。
 */
function shellTintRgba(theme: ThemeStyle, hexColor: string, opacity: number): string {
  const op = clampOpacity(opacity)
  if (theme !== 'light') {
    const n = normalizeHex6(hexColor)
    if (n === 'ffffff' && op >= 0.999) return 'rgba(0, 0, 0, 0)'
  }
  return toRgbaColor(hexColor, opacity)
}

export const useAppearanceStore = defineStore('appearance', () => {
  const backgroundColor = ref(defaultSettings.backgroundColor)
  const backgroundOpacity = ref(defaultSettings.backgroundOpacity)
  const backgroundImage = ref(defaultSettings.backgroundImage)
  const backgroundImageFit = ref<BackgroundImageFit | null>(defaultSettings.backgroundImageFit ?? null)
  const chromeOpacity = ref(defaultSettings.chromeOpacity)
  const themeStyle = ref<ThemeStyle>(defaultSettings.themeStyle)
  const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
  const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 1080)

  bindViewportResize(viewportWidth, viewportHeight)

  const shellClass = computed(() => `theme-${themeStyle.value}`)

  /**
   * 背景分层（CSS 中先写的层在最上）：色罩 → 可选背景图 → 主题画布。
   * 这样半透明色会叠在图片上方；仅图时也不会「只有图、没有叠色」。
   */
  const shellStyle = computed(() => {
    const tint = shellTintRgba(themeStyle.value, backgroundColor.value, backgroundOpacity.value)
    const canvasLayer = 'linear-gradient(var(--app-outer-canvas), var(--app-outer-canvas))'
    const tintLayer = `linear-gradient(${tint}, ${tint})`
    const img = backgroundImage.value.trim()
    if (img) {
      const fit = backgroundImageFit.value
      const useFit = fit && isDataUrlBackground(img) && fit.intrinsicWidth > 0
      const layer =
        useFit ?
          computeBackgroundFitCss(fit, viewportWidth.value, viewportHeight.value)
        : { backgroundSize: 'cover', backgroundPosition: 'center center' }
      return {
        backgroundColor: 'transparent',
        backgroundImage: `${tintLayer}, url("${img}"), ${canvasLayer}`,
        backgroundSize: `100% 100%, ${layer.backgroundSize}, auto`,
        backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
        backgroundPosition: `center, ${layer.backgroundPosition}, center`,
      }
    }
    return {
      backgroundColor: 'transparent',
      backgroundImage: `${tintLayer}, ${canvasLayer}`,
      backgroundSize: 'auto, auto',
      backgroundRepeat: 'no-repeat, no-repeat',
      backgroundPosition: 'center, center',
    }
  })

  /** 顶栏/面板衬底透明度（与全页背景层分开） */
  const chromeSurfaceStyle = computed(() => ({
    '--app-chrome-opacity': String(clampOpacity(chromeOpacity.value)),
  }))

  const save = (): boolean => {
    const payload: AppearanceSettings = {
      backgroundColor: backgroundColor.value,
      backgroundOpacity: backgroundOpacity.value,
      backgroundImage: backgroundImage.value,
      backgroundImageFit: backgroundImageFit.value,
      chromeOpacity: chromeOpacity.value,
      themeStyle: themeStyle.value,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      return true
    } catch (e) {
      if (e instanceof DOMException) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          return false
        }
      }
      console.error('[appearance] localStorage.setItem failed', e)
      return false
    }
  }

  const load = () => {
    const fromNew = localStorage.getItem(STORAGE_KEY)
    let legacyKey: (typeof LEGACY_APPEARANCE_KEYS)[number] | null = null
    let raw = fromNew
    if (!raw) {
      for (const k of LEGACY_APPEARANCE_KEYS) {
        const v = localStorage.getItem(k)
        if (v) {
          raw = v
          legacyKey = k
          break
        }
      }
    }
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Partial<AppearanceSettings>
      backgroundColor.value = parsed.backgroundColor ?? defaultSettings.backgroundColor
      backgroundOpacity.value = clampOpacity(
        typeof parsed.backgroundOpacity === 'number'
          ? parsed.backgroundOpacity
          : defaultSettings.backgroundOpacity,
      )
      backgroundImage.value = parsed.backgroundImage ?? defaultSettings.backgroundImage
      const img = backgroundImage.value.trim()
      const rawFit = parsed.backgroundImageFit
      if (rawFit && isDataUrlBackground(img)) {
        backgroundImageFit.value = normalizeBackgroundImageFit(
          rawFit,
          rawFit.intrinsicWidth ?? 1920,
          rawFit.intrinsicHeight ?? 1080,
        )
      } else {
        backgroundImageFit.value = null
      }
      chromeOpacity.value = clampOpacity(
        typeof parsed.chromeOpacity === 'number'
          ? parsed.chromeOpacity
          : defaultSettings.chromeOpacity,
      )
      themeStyle.value =
        parsed.themeStyle === 'dark' || parsed.themeStyle === 'soft'
          ? parsed.themeStyle
          : defaultSettings.themeStyle
      if (legacyKey) {
        void save()
        localStorage.removeItem(legacyKey)
      }
      applyAppearanceThemeToDocument(themeStyle.value)
    } catch {
      backgroundColor.value = defaultSettings.backgroundColor
      backgroundOpacity.value = defaultSettings.backgroundOpacity
      backgroundImage.value = defaultSettings.backgroundImage
      backgroundImageFit.value = defaultSettings.backgroundImageFit ?? null
      chromeOpacity.value = defaultSettings.chromeOpacity
      themeStyle.value = defaultSettings.themeStyle
      applyAppearanceThemeToDocument(themeStyle.value)
    }
  }

  const updateBackgroundColor = (value: string) => {
    backgroundColor.value = value
    void save()
  }

  const updateBackgroundOpacity = (value: number) => {
    backgroundOpacity.value = clampOpacity(value)
    void save()
  }

  /** 返回 false 表示未写入本地存储（多为配额不足），调用方应保留原图或提示用户 */
  const updateBackgroundImage = (value: string): boolean => {
    const next = value.trim()
    const prev = backgroundImage.value
    const prevFit = backgroundImageFit.value
    backgroundImage.value = next
    if (!next || !isDataUrlBackground(next)) {
      backgroundImageFit.value = null
    } else if (prev !== next) {
      backgroundImageFit.value = null
    }
    if (!save()) {
      backgroundImage.value = prev
      backgroundImageFit.value = prevFit
      return false
    }
    return true
  }

  const updateBackgroundImageFit = (fit: BackgroundImageFit | null): boolean => {
    const prev = backgroundImageFit.value
    const img = backgroundImage.value.trim()
    if (!img || !isDataUrlBackground(img)) {
      backgroundImageFit.value = null
      return save()
    }
    backgroundImageFit.value = normalizeBackgroundImageFit(
      fit ?? createDefaultBackgroundImageFit(1920, 1080),
      fit?.intrinsicWidth ?? 1920,
      fit?.intrinsicHeight ?? 1080,
    )
    if (!save()) {
      backgroundImageFit.value = prev
      return false
    }
    return true
  }

  const initBackgroundImageFitFromUrl = async (src: string): Promise<boolean> => {
    if (!isDataUrlBackground(src)) return false
    try {
      const { width, height } = await loadImageDimensions(src)
      return updateBackgroundImageFit(createDefaultBackgroundImageFit(width, height))
    } catch {
      return updateBackgroundImageFit(createDefaultBackgroundImageFit(1920, 1080))
    }
  }

  const updateChromeOpacity = (value: number) => {
    chromeOpacity.value = clampOpacity(value)
    void save()
  }

  const updateThemeStyle = (value: ThemeStyle) => {
    themeStyle.value = value
    backgroundColor.value = themeDefaultBackgroundColor[value]
    applyAppearanceThemeToDocument(value)
    void save()
  }

  const reset = () => {
    backgroundColor.value = defaultSettings.backgroundColor
    backgroundOpacity.value = defaultSettings.backgroundOpacity
    backgroundImage.value = defaultSettings.backgroundImage
    backgroundImageFit.value = defaultSettings.backgroundImageFit ?? null
    chromeOpacity.value = defaultSettings.chromeOpacity
    themeStyle.value = defaultSettings.themeStyle
    applyAppearanceThemeToDocument(themeStyle.value)
    void save()
  }

  return {
    backgroundColor,
    backgroundOpacity,
    backgroundImage,
    backgroundImageFit,
    chromeOpacity,
    themeStyle,
    shellClass,
    shellStyle,
    chromeSurfaceStyle,
    applyThemeToDocument: () => applyAppearanceThemeToDocument(themeStyle.value),
    load,
    updateBackgroundColor,
    updateBackgroundOpacity,
    updateBackgroundImage,
    updateBackgroundImageFit,
    initBackgroundImageFitFromUrl,
    updateChromeOpacity,
    updateThemeStyle,
    reset,
  }
})
