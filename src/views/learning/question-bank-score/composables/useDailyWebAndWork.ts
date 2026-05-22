import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DailyWebUsage, WorkTimeLog } from '@/db/models'
import { workTimeLogService } from '@/services/data-services'
import { getDailyUsageByDateKey, listDailyUsageNewestFirst, localDateKey } from '@/services/daily-web-usage'
import { applyWorkTimeLogWenWuBonus } from '@/services/work-time-wen-wu-bonus'
import { formatSecondsAsZh } from '@/utils/formatDuration'

export function useDailyWebAndWork() {
  const todayKey = localDateKey()
  const todayUsageSeconds = ref(0)
  const dailyHistory = ref<DailyWebUsage[]>([])
  const workHistory = ref<WorkTimeLog[]>([])

  const workDateKey = ref(todayKey)
  const workMinutes = ref<number | undefined>(60)
  const workKind = ref<'work' | 'trip'>('work')
  const workNote = ref('')
  const submittingWork = ref(false)

  let pollId: ReturnType<typeof setInterval> | null = null

  const loadToday = async () => {
    const row = await getDailyUsageByDateKey(todayKey)
    todayUsageSeconds.value = row?.activeSeconds ?? 0
  }

  const loadHistory = async () => {
    dailyHistory.value = await listDailyUsageNewestFirst()
    const logs = await workTimeLogService.listAll()
    workHistory.value = logs
      .filter((x) => x.createdAt)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    const { hours } = await applyWorkTimeLogWenWuBonus()
    if (hours > 0) {
      ElMessage.success(
        `累计工作/出差登记已满 ${hours} 小时，文分 +${hours * 12}，武分 +${hours * 14}（与「我的文武累计分」同源）。`,
      )
    }
  }

  const refreshAll = async () => {
    await loadToday()
    await loadHistory()
  }

  const todayLabel = computed(() => formatSecondsAsZh(todayUsageSeconds.value))

  const submitWork = async () => {
    const dk = workDateKey.value?.trim()
    if (!dk) {
      ElMessage.warning('请选择日期。')
      return
    }
    const m = Number(workMinutes.value)
    if (!Number.isFinite(m) || m < 1 || m > 24 * 60) {
      ElMessage.warning('请填写 1～1440 之间的整数分钟。')
      return
    }
    submittingWork.value = true
    try {
      await workTimeLogService.create({
        dateKey: dk,
        minutes: Math.round(m),
        kind: workKind.value,
        note: workNote.value.trim() || undefined,
        createdAt: new Date().toISOString(),
      })
      ElMessage.success('已记录本条工作时间。')
      workMinutes.value = 60
      workNote.value = ''
      await loadHistory()
    } catch {
      ElMessage.error('保存失败，请重试。')
    } finally {
      submittingWork.value = false
    }
  }

  onMounted(() => {
    void refreshAll()
    pollId = window.setInterval(() => {
      void loadToday()
    }, 4000)
  })

  onBeforeUnmount(() => {
    if (pollId != null) {
      clearInterval(pollId)
      pollId = null
    }
  })

  return {
    todayKey,
    todayUsageSeconds,
    dailyHistory,
    workHistory,
    workDateKey,
    workMinutes,
    workKind,
    workNote,
    submittingWork,
    todayLabel,
    refreshAll,
    submitWork,
  }
}
