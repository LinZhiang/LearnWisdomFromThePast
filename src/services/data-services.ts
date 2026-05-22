import { db } from '@/db'
import type {
  AnswerLog,
  FavoriteQuestion,
  LearningType,
  QuestionBank,
  QuestionScore,
  ScoreRanking,
  WorkTimeLog,
  ExerciseTimeLog,
  WrongQuestion,
  WrongQuestionBackfillLog,
  WrongQuestionTrash,
} from '@/db/models'
import { CrudService } from './crud-service'

export const learningTypeService = new CrudService<LearningType>(db.learningTypes)
export const questionBankService = new CrudService<QuestionBank>(db.questionBanks)
export const favoriteQuestionService = new CrudService<FavoriteQuestion>(
  db.favoriteQuestions,
)
export const questionScoreService = new CrudService<QuestionScore>(db.questionScores)
export const scoreRankingService = new CrudService<ScoreRanking>(db.scoreRankings)
export const answerLogService = new CrudService<AnswerLog>(db.answerLogs)
export const wrongQuestionService = new CrudService<WrongQuestion>(db.wrongQuestions)
export const wrongQuestionBackfillLogService = new CrudService<WrongQuestionBackfillLog>(
  db.wrongQuestionBackfillLogs,
)
export const wrongQuestionTrashService = new CrudService<WrongQuestionTrash>(db.wrongQuestionTrash)
export const workTimeLogService = new CrudService<WorkTimeLog>(db.workTimeLogs)
export const exerciseTimeLogService = new CrudService<ExerciseTimeLog>(db.exerciseTimeLogs)
