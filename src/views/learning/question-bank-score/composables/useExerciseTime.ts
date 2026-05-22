import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import type { ExerciseTimeLog } from '@/db/models'
import { exerciseTimeLogService } from '@/services/data-services'
import { applyExerciseTimeLogWuBonus } from '@/services/exercise-time-wu-bonus'
import { localDateKey } from '@/services/daily-web-usage'

export function useExerciseTime() {
  const todayKey = localDateKey()
  const exerciseHistory = ref<ExerciseTimeLog[]>([])

  const exerciseDateKey = ref(todayKey)
  const exerciseMinutes = ref<number | undefined>(30)
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
      parts.push(`一般运动已满 ${blocksGeneral} 个 30 分钟，武分 +${wuFromGeneral}`)
    }
    if (blocksIntense > 0) {
      parts.push(`剧烈运动已满 ${blocksIntense} 个 30 分钟，武分 +${wuFromIntense}`)
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
    const m = Number(exerciseMinutes.value)
    if (!Number.isFinite(m) || m < 1 || m > 24 * 60) {
      ElMessage.warning('请填写 1～1440 之间的整数分钟。')
      return
    }
    submittingExercise.value = true
    try {
      await exerciseTimeLogService.create({
        dateKey: dk,
        minutes: Math.round(m),
        kind: exerciseKind.value,
        note: exerciseNote.value.trim() || undefined,
        createdAt: new Date().toISOString(),
      })
      ElMessage.success('已记录本条锻炼时间。')
      exerciseMinutes.value = 30
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
    exerciseMinutes,
    exerciseKind,
    exerciseNote,
    submittingExercise,
    loadExerciseHistory,
    submitExercise,
  }
}
