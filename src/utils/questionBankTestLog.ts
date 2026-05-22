import type { AnswerLog } from '@/db/models'

/** 产生测验日志的菜单入口（写入每条 answer JSON，供答题日志区分来源） */
export type QuestionBankTestLogMenuOrigin = 'learning-question-bank' | 'wrong-book' | 'favorite'

/** 写入答题日志的 JSON 载荷（存于 AnswerLog.answer） */
export type QuestionBankTestAnswerPayload = {
  source: 'question-bank-test'
  quizSessionId: string
  /**
   * 从哪个菜单进入的题目测试；旧数据缺省在展示时按「学习题库」处理。
   */
  logMenuOrigin?: QuestionBankTestLogMenuOrigin
  learningTypeName: string
  unitIndex: number
  questionTitle: string
  /** 单题；session-summary=进入总结页归档；session-report=DeepSeek 雷达报告已生成 */
  questionType: 'general' | 'choice' | 'mindmap-mcq' | 'session-summary' | 'session-report'
  score: number
  maxScore: number
  resultDetail: string
  /** 一般题：作答纯文本摘要 */
  userAnswerPlain?: string
  /** 选择题：用户所选选项文案 */
  userChoiceLabels?: string[]
  /** 选择题：正确选项文案 */
  correctChoiceLabels?: string[]
  /** 导图小题题干 */
  mindmapStem?: string
}

export function parseQuestionBankTestPayload(
  answerField: string,
): QuestionBankTestAnswerPayload | null {
  const t = answerField.trim()
  if (!t.startsWith('{')) return null
  try {
    const o = JSON.parse(t) as Partial<QuestionBankTestAnswerPayload>
    if (o.source !== 'question-bank-test' || !o.quizSessionId) return null
    return o as QuestionBankTestAnswerPayload
  } catch {
    return null
  }
}

export function questionBankTestLogOriginLabel(
  origin?: QuestionBankTestLogMenuOrigin,
): string {
  if (origin === 'wrong-book') return '错题本'
  if (origin === 'favorite') return '题目收藏'
  return '学习题库'
}

/** 写入 IndexedDB 时的 userName 字段（答题日志页不再提供署名设置） */
export function getAnswerLogUserName(): string {
  return '本地学员'
}

export type QuestionBankTestSessionEntry = {
  payload: QuestionBankTestAnswerPayload
  createdAt: string
  /** 对应题库题目 id（导图小题为父题 id），用于详情页展示最新题目名称 */
  questionBankId?: number
}

export type QuestionBankTestSession = {
  quizSessionId: string
  learningTypeName: string
  logMenuOrigin: QuestionBankTestLogMenuOrigin
  /** 该批次最后一条相关日志时间（含归档/报告标记） */
  finishedAt: string
  questionCount: number
  totalScore: number
  totalMax: number
  entries: QuestionBankTestSessionEntry[]
}

function isSessionMetaPayload(p: QuestionBankTestAnswerPayload): boolean {
  return p.questionType === 'session-summary' || p.questionType === 'session-report'
}

/** 将多条答题日志按 quizSessionId 合并为一次「题目测试」 */
export function groupQuestionBankTestSessions(logs: AnswerLog[]): QuestionBankTestSession[] {
  const map = new Map<string, QuestionBankTestSession>()
  for (const log of logs) {
    const p = parseQuestionBankTestPayload(log.answer)
    if (!p?.quizSessionId) continue
    let s = map.get(p.quizSessionId)
    if (!s) {
      s = {
        quizSessionId: p.quizSessionId,
        learningTypeName: p.learningTypeName,
        logMenuOrigin: p.logMenuOrigin ?? 'learning-question-bank',
        finishedAt: log.createdAt,
        questionCount: 0,
        totalScore: 0,
        totalMax: 0,
        entries: [],
      }
      map.set(p.quizSessionId, s)
    }
    if (new Date(log.createdAt).getTime() > new Date(s.finishedAt).getTime()) {
      s.finishedAt = log.createdAt
    }
    if (isSessionMetaPayload(p)) {
      continue
    }
    s.entries.push({
      payload: p,
      createdAt: log.createdAt,
      questionBankId: log.questionBankId,
    })
    s.questionCount++
    s.totalScore += p.score
    s.totalMax += p.maxScore
  }
  for (const s of map.values()) {
    s.entries.sort((a, b) => a.payload.unitIndex - b.payload.unitIndex)
    s.totalScore = Math.round(s.totalScore * 100) / 100
    s.totalMax = Math.round(s.totalMax * 100) / 100
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime(),
  )
}

/** 与题目测试总结页一致，供 DeepSeek 六维雷达请求拼接逐题摘要 */
export function buildQuizRadarResultLines(session: QuestionBankTestSession): string {
  return session.entries
    .map(
      ({ payload: p }) =>
        `${p.unitIndex}. [${questionBankTestTypeLabel(p.questionType)}] ${p.questionTitle} | ${p.score}/${p.maxScore} | ${p.resultDetail}`,
    )
    .join('\n')
}

export function questionBankTestTypeLabel(questionType: QuestionBankTestAnswerPayload['questionType']): string {
  if (questionType === 'general') return '一般题型'
  if (questionType === 'choice') return '选择题型'
  if (questionType === 'mindmap-mcq') return '思维导图小题'
  if (questionType === 'session-summary') return '测验归档'
  return '测验报告'
}
