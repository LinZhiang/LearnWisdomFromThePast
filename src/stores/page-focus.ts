import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { dismissFloatingLayers } from '@/utils/dismissFloatingLayers'

/**
 * 两种全屏互不混用：
 * - 顶栏菜单：仅浏览器原生全屏（requestFullscreen）
 * - 查看/测验：仅应用内拉伸（stretch），不触发浏览器全屏
 */
export const usePageFocusStore = defineStore('pageFocus', () => {
  const stretch = ref(false)
  const browserFullscreen = ref(
    typeof document !== 'undefined' && !!document.fullscreenElement,
  )

  /** 查看/测验内页拉伸 */
  const isStretch = computed(() => stretch.value)
  /** @deprecated 仅表示 stretch，不再包含菜单模式 */
  const active = computed(() => stretch.value)
  /** 顶栏「网页全屏」 */
  const isBrowserFullscreen = computed(() => browserFullscreen.value)

  function setStretch(on: boolean) {
    if (stretch.value === on) return
    stretch.value = on
    if (on) {
      requestAnimationFrame(() => {
        dismissFloatingLayers()
        requestAnimationFrame(dismissFloatingLayers)
      })
    }
  }

  async function requestBrowserFullscreen() {
    if (document.fullscreenElement) return
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      /* 用户拒绝或环境不支持 */
    }
  }

  async function exitBrowserFullscreen() {
    if (!document.fullscreenElement) return
    try {
      await document.exitFullscreen()
    } catch {
      /* ignore */
    }
  }

  async function toggleBrowserFullscreen() {
    if (document.fullscreenElement) await exitBrowserFullscreen()
    else await requestBrowserFullscreen()
    syncFromBrowserFullscreen()
  }

  function syncFromBrowserFullscreen() {
    browserFullscreen.value = !!document.fullscreenElement
  }

  function toggleStretch() {
    setStretch(!stretch.value)
  }

  function exitStretch() {
    setStretch(false)
  }

  /** 仅退出内页拉伸（Esc / 返回列表） */
  function exit() {
    exitStretch()
  }

  function exitStretchIfActive() {
    exitStretch()
  }

  return {
    stretch,
    active,
    isStretch,
    isBrowserFullscreen,
    toggleBrowserFullscreen,
    toggleStretch,
    exitStretch,
    exit,
    exitStretchIfActive,
    syncFromBrowserFullscreen,
  }
})
