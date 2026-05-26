import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import type { ExerciseTimeLog } from '@/db/models'
import { exerciseTimeLogService } from '@/services/data-services'
import { applyExerciseTimeLogWuBonus } from '@/services/exercise-time-wu-bonus'
import { localDateKey } from '@/services/daily-web-usage'
import { durationHoursToMinutes, parseDurationHours } from '@/utils/formatDuration'

export function useExerciseTime() {
  const todayKey = localDateKey()
  const exerciseHistory = ref<ExerciseTimeLog[]>([])

  const exerciseDateKey = ref(todayKey)
  const exerciseHours = ref<number | undefined>(0.5)
  const exerciseKind = ref<ExerciseTimeLog['kind']>('general')
  const exerciseNote = ref('')
  const submittingExercise = ref(false)

  const loadExerciseHistory = async () => {
    const logs = await exerciseTimeLogService.listAll()
    exerciseHistory.value = logs
      .filter((x) => x.createdAt)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

    const { blocksGeneral, blocksIntense, wuFromGeneral, wuFromIntense } =
      await applyExerciseTimeLogWuBonus()
    const parts: string[] = []
    if (blocksGeneral > 0) {
      parts.push(`一般运动已满 ${blocksGeneral} 个 0.5 小时，武分 +${wuFromGeneral}`)
    }
    if (blocksIntense > 0) {
      parts.push(`剧烈运动已满 ${blocksIntense} 个 0.5 小时，武分 +${wuFromIntense}`)
    }
    if (parts.length > 0) {
      ElMessage.success(`${parts.join('；')}（与「我的文武累计分」同源）。`)
    }
  }

  const submitExercise = async () => {
    const dk = exerciseDateKey.value?.trim()
    if (!dk) {
      ElMessage.warning('请选择日期。')
      return
    }
    const hours = parseDurationHours(exerciseHours.value)
    if (hours == null) {
      ElMessage.warning('请填写 0.5～24 之间、且为 0.5 整数倍的小时数。')
      return
    }
    submittingExercise.value = true
    try {
      await exerciseTimeLogService.create({
        dateKey: dk,
        minutes: durationHoursToMinutes(hours),
        kind: exerciseKind.value,
        note: exerciseNote.value.trim() || undefined,
        createdAt: new Date().toISOString(),
      })
      ElMessage.success('已记录本条锻炼时间。')
      exerciseHours.value = 0.5
      exerciseNote.value = ''
      await loadExerciseHistory()
    } catch {
      ElMessage.error('保存失败，请重试。')
    } finally {
      submittingExercise.value = false
    }
  }

  onMounted(() => {
    void loadExerciseHistory()
  })

  return {
    exerciseHistory,
    exerciseDateKey,
    exerciseHours,
    exerciseKind,
    exerciseNote,
    submittingExercise,
    loadExerciseHistory,
    submitExercise,
  }
}
