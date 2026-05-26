import { ElMessage } from 'element-plus'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  formatStudyProgress,
  formatWorkProgress,
  getDailyMoneyBonusStatus,
  isMoneyCurfewActive,
  MONEY_STUDY_OR_WORK_REWARD,
  MONEY_STUDY_REWARD_SECONDS,
  MONEY_WORK_REWARD_MINUTES,
  moneyCurfewMessage,
  syncDailyStudyWorkMoneyBonus,
  type DailyMoneyBonusStatus,
} from '@/services/money-rule-auto'
import { flushPendingRankUpgradeMoney } from '@/services/money-rank-upgrade-bonus'
import { WEN_WU_SCORES_CHANGED_EVENT } from '@/views/learning/question-bank-score/wen-wu-user-scores'

export function useMoneyRuleAuto() {
  const status = ref<DailyMoneyBonusStatus | null>(null)
  const curfewActive = ref(isMoneyCurfewActive())
  let pollId: ReturnType<typeof setInterval> | null = null

  const refresh = async (silent = true) => {
    curfewActive.value = isMoneyCurfewActive()
    const prevGranted = status.value?.alreadyGranted
    const { granted, status: next } = await syncDailyStudyWorkMoneyBonus()
    flushPendingRankUpgradeMoney()
    status.value = next
    if (granted && !silent) {
      ElMessage.success(`今日学习/工作达标，已自动奖励 ${MONEY_STUDY_OR_WORK_REWARD} 元`)
    } else if (granted && silent && !prevGranted) {
      ElMessage.success(`今日学习/工作达标，已自动奖励 ${MONEY_STUDY_OR_WORK_REWARD} 元`)
    }
    return { granted, status: next }
  }

  const bonusHint = () => {
    const s = status.value
    if (!s) return '正在统计今日学习用时与工作登记…'
    if (s.alreadyGranted) {
      return `今日已发放学习/工作奖励 ${MONEY_STUDY_OR_WORK_REWARD} 元。`
    }
    if (s.eligible && s.curfewActive) {
      return `已达标，当前为宵禁时段，${moneyCurfewMessage()}`
    }
    if (s.eligible) {
      return `已达标，将自动发放 ${MONEY_STUDY_OR_WORK_REWARD} 元。`
    }
    const parts: string[] = []
    parts.push(
      `学习 ${formatStudyProgress(s.studySeconds)} / ${formatStudyProgress(MONEY_STUDY_REWARD_SECONDS)}`,
    )
    parts.push(
      `工作登记 ${formatWorkProgress(s.workMinutes)} / ${formatWorkProgress(MONEY_WORK_REWARD_MINUTES)}`,
    )
    return `达标任一即奖 ${MONEY_STUDY_OR_WORK_REWARD} 元：${parts.join('；')}`
  }

  const onScoresChanged = () => {
    void getDailyMoneyBonusStatus().then((s) => {
      status.value = s
      curfewActive.value = s.curfewActive
    })
  }

  onMounted(() => {
    void refresh(true)
    pollId = window.setInterval(() => {
      void refresh(true)
    }, 8000)
    window.addEventListener(WEN_WU_SCORES_CHANGED_EVENT, onScoresChanged)
  })

  onBeforeUnmount(() => {
    if (pollId != null) {
      clearInterval(pollId)
      pollId = null
    }
    window.removeEventListener(WEN_WU_SCORES_CHANGED_EVENT, onScoresChanged)
  })

  return {
    status,
    curfewActive,
    bonusHint,
    refresh,
    moneyCurfewMessage,
  }
}
