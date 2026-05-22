import { db } from '@/db'
import type {
  AnswerLog,
  DailyWebUsage,
  FavoriteQuestion,
  LearningType,
  QuestionBank,
  QuestionScore,
  ScoreRanking,
  WorkTimeLog,
  ExerciseTimeLog,
} from '@/db/models'

type CacheSnapshot = {
  exportedAt: string
  data: {
    learningTypes: LearningType[]
    questionBanks: QuestionBank[]
    favoriteQuestions: FavoriteQuestion[]
    questionScores: QuestionScore[]
    scoreRankings: ScoreRanking[]
    answerLogs: AnswerLog[]
    dailyWebUsage?: DailyWebUsage[]
    workTimeLogs?: WorkTimeLog[]
    exerciseTimeLogs?: ExerciseTimeLog[]
  }
}

export type CachePreview = {
  exportedAt: string
  counts: {
    learningTypes: number
    questionBanks: number
    favoriteQuestions: number
    questionScores: number
    scoreRankings: number
    answerLogs: number
    dailyWebUsage: number
    workTimeLogs: number
    exerciseTimeLogs: number
  }
}

const parseSnapshot = (raw: string): CacheSnapshot => {
  const parsed = JSON.parse(raw) as CacheSnapshot
  const data = parsed.data
  if (!data) throw new Error('缓存文件格式不正确')
  return parsed
}

export const exportCacheSnapshot = async () => {
  const snapshot: CacheSnapshot = {
    exportedAt: new Date().toISOString(),
    data: {
      learningTypes: await db.learningTypes.toArray(),
      questionBanks: await db.questionBanks.toArray(),
      favoriteQuestions: await db.favoriteQuestions.toArray(),
      questionScores: await db.questionScores.toArray(),
      scoreRankings: await db.scoreRankings.toArray(),
      answerLogs: await db.answerLogs.toArray(),
      dailyWebUsage: await db.dailyWebUsage.toArray(),
      workTimeLogs: await db.workTimeLogs.toArray(),
      exerciseTimeLogs: await db.exerciseTimeLogs.toArray(),
    },
  }
  return JSON.stringify(snapshot, null, 2)
}

export const previewCacheSnapshot = (raw: string): CachePreview => {
  const parsed = parseSnapshot(raw)
  const data = parsed.data
  return {
    exportedAt: parsed.exportedAt,
    counts: {
      learningTypes: (data.learningTypes ?? []).length,
      questionBanks: (data.questionBanks ?? []).length,
      favoriteQuestions: (data.favoriteQuestions ?? []).length,
      questionScores: (data.questionScores ?? []).length,
      scoreRankings: (data.scoreRankings ?? []).length,
      answerLogs: (data.answerLogs ?? []).length,
      dailyWebUsage: (data.dailyWebUsage ?? []).length,
      workTimeLogs: (data.workTimeLogs ?? []).length,
      exerciseTimeLogs: (data.exerciseTimeLogs ?? []).length,
    },
  }
}

export const importCacheSnapshot = async (raw: string) => {
  const parsed = parseSnapshot(raw)
  const data = parsed.data

  await db.transaction(
    'rw',
    [
      db.learningTypes,
      db.questionBanks,
      db.favoriteQuestions,
      db.questionScores,
      db.scoreRankings,
      db.answerLogs,
      db.dailyWebUsage,
      db.workTimeLogs,
      db.exerciseTimeLogs,
    ],
    async () => {
      await db.learningTypes.clear()
      await db.questionBanks.clear()
      await db.favoriteQuestions.clear()
      await db.questionScores.clear()
      await db.scoreRankings.clear()
      await db.answerLogs.clear()
      await db.dailyWebUsage.clear()
      await db.workTimeLogs.clear()
      await db.exerciseTimeLogs.clear()

      await db.learningTypes.bulkAdd(data.learningTypes ?? [])
      await db.questionBanks.bulkAdd(data.questionBanks ?? [])
      await db.favoriteQuestions.bulkAdd(data.favoriteQuestions ?? [])
      await db.questionScores.bulkAdd(data.questionScores ?? [])
      await db.scoreRankings.bulkAdd(data.scoreRankings ?? [])
      await db.answerLogs.bulkAdd(data.answerLogs ?? [])
      await db.dailyWebUsage.bulkAdd(data.dailyWebUsage ?? [])
      await db.workTimeLogs.bulkAdd(data.workTimeLogs ?? [])
      await db.exerciseTimeLogs.bulkAdd(data.exerciseTimeLogs ?? [])
    },
  )
}
