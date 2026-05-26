import { ElMessage } from 'element-plus'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { formatSecondsAsZh } from '@/utils/formatDuration'
import {
  getLeisureDailyStatus,
  leisureCurfewMessage,
  pauseLeisureTimer,
  settleLeisureOverage,
  toggleLeisureTimer,
  type LeisureDailyStatus,
  type LeisureKind,
} from '@/services/money-leisure-time'
import { WEN_WU_SCORES_CHANGED_EVENT } from '@/views/learning/question-bank-score/wen-wu-user-scores'

export function useMoneyLeisureTimer() {
  const expanded = ref(true)
  const status = ref<LeisureDailyStatus | null>(null)
  const settling = ref(false)
  let tickId: ReturnType<typeof setInterval> | null = null

  const refresh = () => {
    status.value = getLeisureDailyStatus()
  }

  const onToggle = (kind: LeisureKind) => {
    status.value = toggleLeisureTimer(kind)
  }

  const onPause = () => {
    status.value = pauseLeisureTimer()
    ElMessage.info('已暂停计时，时长已计入今日累计。')
  }

  const onSettle = async () => {
    if (settling.value) return
    settling.value = true
    try {
      status.value = pauseLeisureTimer()
      const result = settleLeisureOverage()
      refresh()
      if (result.reason === 'curfew') {
        ElMessage.warning(leisureCurfewMessage())
        return
      }
      if (result.reason === 'nothing' || result.totalDelta === 0) {
        ElMessage.info('今日游戏/视频暂无需要结算的超额时长。')
        return
      }
      ElMessage.success(
        `已自动结算扣款 ${result.totalDelta} 元，当前余额 ${result.balance} 元。${result.lines.join('；')}`,
      )
    } catch {
      ElMessage.error('结算失败，请重试')
    } finally {
      settling.value = false
    }
  }

  const formatQuota = (seconds: number) => formatSecondsAsZh(seconds)

  const isRunning = (kind: LeisureKind) => status.value?.runningKind === kind

  const onPageHide = () => {
    pauseLeisureTimer()
    refresh()
  }

  onMounted(() => {
    refresh()
    tickId = window.setInterval(refresh, 1000)
    window.addEventListener(WEN_WU_SCORES_CHANGED_EVENT, refresh)
    window.addEventListener('pagehide', onPageHide)
  })

  onBeforeUnmount(() => {
    if (tickId != null) {
      clearInterval(tickId)
      tickId = null
    }
    window.removeEventListener(WEN_WU_SCORES_CHANGED_EVENT, refresh)
    window.removeEventListener('pagehide', onPageHide)
    pauseLeisureTimer()
  })

  return {
    expanded,
    status,
    settling,
    refresh,
    onToggle,
    onPause,
    onSettle,
    formatQuota,
    isRunning,
  }
}
