import { onBeforeUnmount, onMounted } from 'vue'
import { bumpDailyActiveSeconds, localDateKey } from '@/services/daily-web-usage'
import { applyWenBonusForVisibleSeconds } from '@/services/wen-bonus-from-visible-time'

/**
 * 在应用前台可见时累计自然日活跃秒数（写入 IndexedDB）。
 * 切到后台、关闭页、定时落盘时写入，避免长时间停留单页却不触发 visibility 时丢数据。
 *
 * 时长用「墙钟」Date.now() 差值计算，不用 performance.now()：后者在部分浏览器/节能/后台场景下
 * 与真实经过时间不同步，会导致累计秒数明显少于实际可见学习时长。
 */
export function useWebUsageTracker() {
  /** 最近一次进入 visible 时的 Unix 毫秒时间戳 */
  let visibleSinceMs: number | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null

  const flushSegment = () => {
    if (visibleSinceMs == null) return
    if (document.visibilityState !== 'visible') return
    const nowMs = Date.now()
    const secs = Math.floor((nowMs - visibleSinceMs) / 1000)
    if (secs < 1) return
    void bumpDailyActiveSeconds(localDateKey(), secs)
    applyWenBonusForVisibleSeconds(secs)
    visibleSinceMs = Date.now()
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      visibleSinceMs = Date.now()
    } else {
      if (visibleSinceMs != null) {
        const secs = Math.floor((Date.now() - visibleSinceMs) / 1000)
        visibleSinceMs = null
        if (secs >= 1) {
          void bumpDailyActiveSeconds(localDateKey(), secs)
          applyWenBonusForVisibleSeconds(secs)
        }
      }
    }
  }

  const onPageHide = () => {
    if (visibleSinceMs == null) return
    const secs = Math.floor((Date.now() - visibleSinceMs) / 1000)
    visibleSinceMs = null
    if (secs >= 1) {
      void bumpDailyActiveSeconds(localDateKey(), secs)
      applyWenBonusForVisibleSeconds(secs)
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    if (document.visibilityState === 'visible') {
      visibleSinceMs = Date.now()
    }
    intervalId = window.setInterval(flushSegment, 30_000)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    if (intervalId != null) {
      clearInterval(intervalId)
      intervalId = null
    }
    onPageHide()
  })
}
