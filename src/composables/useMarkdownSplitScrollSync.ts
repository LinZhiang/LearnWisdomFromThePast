import { onBeforeUnmount, ref, type Ref } from 'vue'
import {
  buildMarkdownScrollMaps,
  ratioScroll,
  scrollPreviewToMatchSource,
  scrollSourceToMatchPreview,
  type MarkdownScrollMaps,
} from '@/utils/markdownSplitScrollSync'

export function useMarkdownSplitScrollSync(options: {
  sourceEl: Ref<HTMLElement | null | undefined>
  previewEl: Ref<HTMLElement | null | undefined>
  /** 与左侧 textarea 显示一致的 Markdown（折叠占位时勿用展开后的全文） */
  getSourceText: () => string
  /** 预览用 Markdown（通常为展开内嵌图后的全文） */
  getPreviewMarkdown: () => string
  /** 预览 HTML 更新后调用，用于在 DOM 渲染后重建映射 */
  onRemeasure?: () => void
}) {
  let syncing = false
  let sourceScrollRaf = 0
  let previewScrollRaf = 0
  let sourceAttached: HTMLElement | null = null
  let previewAttached: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let remeasureTimer: ReturnType<typeof setTimeout> | null = null

  const maps = ref<MarkdownScrollMaps | null>(null)

  function clearRemeasureTimer() {
    if (remeasureTimer != null) {
      clearTimeout(remeasureTimer)
      remeasureTimer = null
    }
  }

  function scheduleRemeasure(delayMs = 80) {
    clearRemeasureTimer()
    remeasureTimer = setTimeout(() => {
      remeasureTimer = null
      rebuildMaps()
      options.onRemeasure?.()
    }, delayMs)
  }

  function rebuildMaps() {
    const src = options.sourceEl.value
    const preview = options.previewEl.value
    if (!src || !preview) {
      maps.value = null
      return
    }
    maps.value = buildMarkdownScrollMaps(
      options.getSourceText(),
      options.getPreviewMarkdown(),
      src,
      preview,
    )
    if (maps.value) {
      syncing = true
      scrollPreviewToMatchSource(maps.value, src.scrollTop, src, preview)
      requestAnimationFrame(() => {
        syncing = false
      })
    }
  }

  function applySourceScrollSync() {
    const src = options.sourceEl.value
    const preview = options.previewEl.value
    if (!src || !preview || syncing) return
    syncing = true
    const m = maps.value
    if (m) {
      scrollPreviewToMatchSource(m, src.scrollTop, src, preview)
    } else {
      ratioScroll(src, preview)
    }
    requestAnimationFrame(() => {
      syncing = false
    })
  }

  function applyPreviewScrollSync() {
    const src = options.sourceEl.value
    const preview = options.previewEl.value
    if (!src || !preview || syncing) return
    syncing = true
    const m = maps.value
    if (m) {
      scrollSourceToMatchPreview(m, preview.scrollTop, src, preview)
    } else {
      ratioScroll(preview, src)
    }
    requestAnimationFrame(() => {
      syncing = false
    })
  }

  function onSourceScroll() {
    if (syncing) return
    if (sourceScrollRaf) cancelAnimationFrame(sourceScrollRaf)
    sourceScrollRaf = requestAnimationFrame(() => {
      sourceScrollRaf = 0
      applySourceScrollSync()
    })
  }

  function onPreviewScroll() {
    if (syncing) return
    if (previewScrollRaf) cancelAnimationFrame(previewScrollRaf)
    previewScrollRaf = requestAnimationFrame(() => {
      previewScrollRaf = 0
      applyPreviewScrollSync()
    })
  }

  function watchPreviewImages(preview: HTMLElement) {
    const imgs = preview.querySelectorAll('img')
    imgs.forEach((img) => {
      if (img.complete) return
      img.addEventListener('load', () => scheduleRemeasure(50), { once: true })
      img.addEventListener('error', () => scheduleRemeasure(50), { once: true })
    })
  }

  function bind() {
    unbind()
    const src = options.sourceEl.value
    const preview = options.previewEl.value
    if (!src || !preview) return

    rebuildMaps()
    watchPreviewImages(preview)

    sourceAttached = src
    previewAttached = preview
    src.addEventListener('scroll', onSourceScroll, { passive: true })
    preview.addEventListener('scroll', onPreviewScroll, { passive: true })

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => scheduleRemeasure(100))
      resizeObserver.observe(preview)
      resizeObserver.observe(src)
    }
  }

  function unbind() {
    if (sourceScrollRaf) cancelAnimationFrame(sourceScrollRaf)
    if (previewScrollRaf) cancelAnimationFrame(previewScrollRaf)
    sourceScrollRaf = 0
    previewScrollRaf = 0
    clearRemeasureTimer()
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (sourceAttached) {
      sourceAttached.removeEventListener('scroll', onSourceScroll)
      sourceAttached = null
    }
    if (previewAttached) {
      previewAttached.removeEventListener('scroll', onPreviewScroll)
      previewAttached = null
    }
  }

  onBeforeUnmount(unbind)

  return {
    maps,
    bind,
    unbind,
    scheduleRemeasure,
    rebuildMaps,
  }
}
