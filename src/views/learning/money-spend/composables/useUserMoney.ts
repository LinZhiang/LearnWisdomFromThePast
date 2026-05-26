import { onBeforeUnmount, onMounted, ref } from 'vue'
import { applyMoneyDeltaAllowed } from '@/services/money-rule-auto'
import {
  loadWenWuUserScores,
  WEN_WU_SCORES_CHANGED_EVENT,
} from '@/views/learning/question-bank-score/wen-wu-user-scores'

export function useUserMoney() {
  const money = ref(0)

  const refresh = () => {
    money.value = loadWenWuUserScores().money
  }

  const onChanged = () => refresh()

  onMounted(() => {
    refresh()
    window.addEventListener(WEN_WU_SCORES_CHANGED_EVENT, onChanged)
  })

  onBeforeUnmount(() => {
    window.removeEventListener(WEN_WU_SCORES_CHANGED_EVENT, onChanged)
  })

  const registerDelta = (delta: number) => applyMoneyDeltaAllowed(delta)

  return { money, refresh, registerDelta }
}
