import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { wrongQuestionService } from '@/services/data-services'
import { countDueWrongQuestions } from '@/services/wrong-question-helpers'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

export const useWrongBookDueStore = defineStore('wrongBookDue', () => {
  const dueCount = ref(0)
  const loading = ref(false)
  let refreshTimer: ReturnType<typeof setInterval> | null = null
  let refreshSeq = 0

  const hasDue = computed(() => dueCount.value > 0)

  async function refresh(): Promise<void> {
    const seq = ++refreshSeq
    loading.value = true
    try {
      const rows = await wrongQuestionService.listAll()
      if (seq !== refreshSeq) return
      dueCount.value = countDueWrongQuestions(rows)
    } catch {
      if (seq !== refreshSeq) return
    } finally {
      if (seq === refreshSeq) loading.value = false
    }
  }

  function startAutoRefresh(): void {
    stopAutoRefresh()
    refreshTimer = setInterval(() => {
      void refresh()
    }, REFRESH_INTERVAL_MS)
  }

  function stopAutoRefresh(): void {
    if (refreshTimer != null) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  return {
    dueCount,
    loading,
    hasDue,
    refresh,
    startAutoRefresh,
    stopAutoRefresh,
  }
})
