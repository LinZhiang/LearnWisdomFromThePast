import Dexie, { type Table } from 'dexie'
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
  WrongQuestion,
  WrongQuestionBackfillLog,
  WrongQuestionTrash,
  QuestionBankAiPrep,
} from './models'

export class LearningAppDatabase extends Dexie {
  learningTypes!: Table<LearningType, number>
  questionBanks!: Table<QuestionBank, number>
  favoriteQuestions!: Table<FavoriteQuestion, number>
  questionScores!: Table<QuestionScore, number>
  scoreRankings!: Table<ScoreRanking, number>
  answerLogs!: Table<AnswerLog, number>
  wrongQuestions!: Table<WrongQuestion, number>
  wrongQuestionBackfillLogs!: Table<WrongQuestionBackfillLog, number>
  wrongQuestionTrash!: Table<WrongQuestionTrash, number>
  dailyWebUsage!: Table<DailyWebUsage, number>
  workTimeLogs!: Table<WorkTimeLog, number>
  exerciseTimeLogs!: Table<ExerciseTimeLog, number>
  questionBankAiPrep!: Table<QuestionBankAiPrep, number>

  constructor() {
    super('LearningAppDatabase')

    this.version(1).stores({
      learningTypes: '++id, name, createdAt, updatedAt',
      questionBanks: '++id, title, learningTypeId, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, createdAt',
    })

    this.version(2).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks: '++id, title, learningTypeId, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, createdAt',
    })

    this.version(3).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks:
        '++id, type, title, learningTypeId, score, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, createdAt',
    })

    this.version(4).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks:
        '++id, type, title, learningTypeId, score, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, quizSessionId, createdAt',
    })

    this.version(5)
      .stores({
        learningTypes: '++id, parentId, name, createdAt, updatedAt',
        questionBanks:
          '++id, type, title, learningTypeId, score, createdAt, updatedAt',
        favoriteQuestions: '++id, questionBankId, learningTypeId, createdAt',
        questionScores: '++id, questionBankId, userName, createdAt',
        scoreRankings: '++id, userName, totalScore, rank, updatedAt',
        answerLogs: '++id, questionBankId, userName, quizSessionId, createdAt',
      })
      .upgrade(async (trans) => {
        const bankRows = await trans.table('questionBanks').toArray()
        const bankLt = new Map<number, number>()
        for (const b of bankRows as { id?: number; learningTypeId?: number }[]) {
          if (b.id != null && b.learningTypeId != null) bankLt.set(b.id, b.learningTypeId)
        }
        await trans
          .table('favoriteQuestions')
          .toCollection()
          .modify((fav: Record<string, unknown>) => {
            if (fav.learningTypeId != null && fav.learningTypeId !== '') return
            const qid = fav.questionBankId as number | undefined
            fav.learningTypeId =
              qid != null && bankLt.has(qid) ? bankLt.get(qid)! : 0
          })
      })

    this.version(6).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks:
        '++id, type, title, learningTypeId, score, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, learningTypeId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, quizSessionId, createdAt',
      wrongQuestions:
        '++id, learningTypeId, questionBankId, questionType, nextReviewAt, updatedAt, lastWrongAt',
    })

    this.version(7).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks:
        '++id, type, title, learningTypeId, score, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, learningTypeId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, quizSessionId, createdAt',
      wrongQuestions:
        '++id, learningTypeId, questionBankId, questionType, nextReviewAt, updatedAt, lastWrongAt',
      wrongQuestionBackfillLogs: '++id, &answerLogId, processedAt',
    })

    this.version(8).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks:
        '++id, type, title, learningTypeId, score, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, learningTypeId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, quizSessionId, createdAt',
      wrongQuestions:
        '++id, learningTypeId, questionBankId, questionType, nextReviewAt, updatedAt, lastWrongAt',
      wrongQuestionBackfillLogs: '++id, &answerLogId, processedAt',
      wrongQuestionTrash: '++id, originalWrongQuestionId, deletedAt',
    })

    this.version(9).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks:
        '++id, type, title, learningTypeId, score, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, learningTypeId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, quizSessionId, createdAt',
      wrongQuestions:
        '++id, learningTypeId, questionBankId, questionType, nextReviewAt, updatedAt, lastWrongAt',
      wrongQuestionBackfillLogs: '++id, &answerLogId, processedAt',
      wrongQuestionTrash: '++id, originalWrongQuestionId, deletedAt',
      dailyWebUsage: '++id, &dateKey, updatedAt',
      workTimeLogs: '++id, dateKey, kind, createdAt',
    })

    this.version(10).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks:
        '++id, type, title, learningTypeId, score, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, learningTypeId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, quizSessionId, createdAt',
      wrongQuestions:
        '++id, learningTypeId, questionBankId, questionType, nextReviewAt, updatedAt, lastWrongAt',
      wrongQuestionBackfillLogs: '++id, &answerLogId, processedAt',
      wrongQuestionTrash: '++id, originalWrongQuestionId, deletedAt',
      dailyWebUsage: '++id, &dateKey, updatedAt',
      workTimeLogs: '++id, dateKey, kind, createdAt',
      exerciseTimeLogs: '++id, dateKey, kind, createdAt',
    })

    this.version(11).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks:
        '++id, type, title, learningTypeId, score, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, learningTypeId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, quizSessionId, createdAt',
      wrongQuestions:
        '++id, learningTypeId, questionBankId, questionType, nextReviewAt, updatedAt, lastWrongAt',
      wrongQuestionBackfillLogs: '++id, &answerLogId, processedAt',
      wrongQuestionTrash: '++id, originalWrongQuestionId, deletedAt',
      dailyWebUsage: '++id, &dateKey, updatedAt',
      workTimeLogs: '++id, dateKey, kind, createdAt',
      exerciseTimeLogs: '++id, dateKey, kind, createdAt',
    })

    this.version(12).stores({
      learningTypes: '++id, parentId, name, createdAt, updatedAt',
      questionBanks:
        '++id, type, title, learningTypeId, score, createdAt, updatedAt',
      favoriteQuestions: '++id, questionBankId, learningTypeId, createdAt',
      questionScores: '++id, questionBankId, userName, createdAt',
      scoreRankings: '++id, userName, totalScore, rank, updatedAt',
      answerLogs: '++id, questionBankId, userName, quizSessionId, createdAt',
      wrongQuestions:
        '++id, learningTypeId, questionBankId, questionType, nextReviewAt, updatedAt, lastWrongAt',
      wrongQuestionBackfillLogs: '++id, &answerLogId, processedAt',
      wrongQuestionTrash: '++id, originalWrongQuestionId, deletedAt',
      dailyWebUsage: '++id, &dateKey, updatedAt',
      workTimeLogs: '++id, dateKey, kind, createdAt',
      exerciseTimeLogs: '++id, dateKey, kind, createdAt',
      questionBankAiPrep:
        '++id, &[questionBankId+kind], questionBankId, kind, fingerprint, updatedAt',
    })
  }
}

export const db = new LearningAppDatabase()
