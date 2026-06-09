import { onBeforeUnmount, onMounted } from 'vue'
import router from '@/router'
import { isLearningUsageRoute } from '@/constants/learning-usage-routes'
import { bumpDailyActiveSeconds, localDateKey } from '@/services/daily-web-usage'
import { syncDailyStudyWorkMoneyBonus } from '@/services/money-rule-auto'
import { applyWenBonusForVisibleSeconds } from '@/services/wen-bonus-from-visible-time'

/**
 * 在应用前台可见且处于「学习类」菜单路由时，累计自然日活跃秒数（写入 IndexedDB）。
 * 切到后台、关闭页、离开学习菜单、定时落盘时写入。
 *
 * 时长用「墙钟」Date.now() 差值计算，不用 performance.now()：后者在部分浏览器/节能/后台场景下
 * 与真实经过时间不同步，会导致累计秒数明显少于实际可见学习时长。
 */
export function useWebUsageTracker() {
  /** 最近一次满足「可见 + 学习菜单」时的 Unix 毫秒时间戳 */
  let visibleSinceMs: number | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null
  let removeRouteHook: (() => void) | null = null

  const canAccumulateNow = () =>
    document.visibilityState === 'visible' &&
    isLearningUsageRoute(router.currentRoute.value.path)

  const recordSeconds = (secs: number) => {
    if (secs < 1) return
    void bumpDailyActiveSeconds(localDateKey(), secs).then(() =>
      syncDailyStudyWorkMoneyBonus(),
    )
    applyWenBonusForVisibleSeconds(secs)
  }

  const pauseAndFlush = () => {
    if (visibleSinceMs == null) return
    const secs = Math.floor((Date.now() - visibleSinceMs) / 1000)
    visibleSinceMs = null
    recordSeconds(secs)
  }

  const tryResume = () => {
    if (!canAccumulateNow()) return
    visibleSinceMs = Date.now()
  }

  const flushSegment = () => {
    if (!canAccumulateNow()) {
      pauseAndFlush()
      return
    }
    if (visibleSinceMs == null) {
      tryResume()
      return
    }
    const secs = Math.floor((Date.now() - visibleSinceMs) / 1000)
    if (secs < 1) return
    recordSeconds(secs)
    visibleSinceMs = Date.now()
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      tryResume()
    } else {
      pauseAndFlush()
    }
  }

  const onPageHide = () => {
    pauseAndFlush()
  }

  const onRouteChange = () => {
    pauseAndFlush()
    tryResume()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    removeRouteHook = router.afterEach(onRouteChange)
    tryResume()
    intervalId = window.setInterval(flushSegment, 30_000)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    removeRouteHook?.()
    removeRouteHook = null
    if (intervalId != null) {
      clearInterval(intervalId)
      intervalId = null
    }
    onPageHide()
  })
}
