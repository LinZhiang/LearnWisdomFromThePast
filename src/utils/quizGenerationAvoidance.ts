import type { QuestionBankTestAnswerPayload } from '@/utils/questionBankTestLog'
import { answerLogService } from '@/services/data-services'
import {
  groupQuestionBankTestSessions,
  type QuestionBankTestLogMenuOrigin,
  type QuestionBankTestSession,
} from '@/utils/questionBankTestLog'
import { AI_QUIZ_BATCH_DIVERSITY_RULES } from '@/utils/handoutAiMaterial'

/** 与日志 questionType / 展开方式对齐，用于「同类型」对照 */
export type QuizAvoidanceDerivativeKind =
  | 'mindmap-mcq'
  | 'handout-general'
  | 'handout-judgment'
  | 'choice'
  | 'general'

export type QuizAvoidanceLoadOptions = {
  /** 日志菜单来源 */
  logMenuOrigin?: QuestionBankTestLogMenuOrigin
  /** 对照的出题形态（默认导图/讲义选择题） */
  derivativeKind?: QuizAvoidanceDerivativeKind
  /** 单场摘录上限（仅取最近一场） */
  maxItems?: number
}

let cachedSessions: QuestionBankTestSession[] | null = null

/** 一次测验构建结束后可调用，避免长期占用内存 */
export function clearQuizAvoidanceSessionCache(): void {
  cachedSessions = null
}

async function loadLearningQuestionBankSessions(): Promise<QuestionBankTestSession[]> {
  if (cachedSessions) return cachedSessions
  const logs = await answerLogService.listAll()
  cachedSessions = groupQuestionBankTestSessions(logs)
  return cachedSessions
}

function isSessionMetaPayload(p: QuestionBankTestAnswerPayload): boolean {
  return p.questionType === 'session-summary' || p.questionType === 'session-report'
}

export function entryMatchesAvoidanceKind(
  payload: QuestionBankTestAnswerPayload,
  kind: QuizAvoidanceDerivativeKind,
): boolean {
  if (kind === 'mindmap-mcq') return payload.questionType === 'mindmap-mcq'
  if (kind === 'handout-general') {
    return payload.questionType === 'general' && !!(payload.mindmapStem ?? '').trim()
  }
  if (kind === 'handout-judgment') return payload.questionType === 'handout-judgment'
  if (kind === 'choice') return payload.questionType === 'choice'
  return payload.questionType === 'general' && !(payload.mindmapStem ?? '').trim()
}

function truncateStem(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

/**
 * 拼进 prompt 的轻量参考（无历史则返回空，不额外占 token）。
 * 仅作「适当规避」提示，不要求完全错开考点。
 */
export function buildQuizAvoidancePrompt(recentStems: string[]): string {
  const unique = [...new Set(recentStems.map((s) => truncateStem(s, 40)).filter(Boolean))].slice(
    0,
    8,
  )
  if (unique.length === 0) return ''
  const lines = unique.map((s, i) => `${i + 1}. ${s}`).join('\n')
  return `${AI_QUIZ_BATCH_DIVERSITY_RULES}\n\n【供参考：上一场相关测验出现过类似题面，请勿照搬原文；同考点换问法、换数据仍可出】\n${lines}`
}

/**
 * 读取**最近一场**包含该题库条目、且题型与当前生成方式一致的测验题干。
 * 父节点大范围测验若考过该条目（日志 questionBankId 相同），也会命中同一场。
 */
export async function loadRecentQuizStemsForBank(
  questionBankId: number,
  options?: QuizAvoidanceLoadOptions,
): Promise<string[]> {
  const derivativeKind = options?.derivativeKind ?? 'mindmap-mcq'
  const maxItems = Math.max(1, Math.min(20, options?.maxItems ?? 12))
  const origin = options?.logMenuOrigin ?? 'learning-question-bank'

  const sessions = (await loadLearningQuestionBankSessions()).filter(
    (s) => (s.logMenuOrigin ?? 'learning-question-bank') === origin,
  )

  const isRelevantEntry = (e: (typeof sessions)[0]['entries'][0]) =>
    e.questionBankId === questionBankId &&
    !isSessionMetaPayload(e.payload) &&
    entryMatchesAvoidanceKind(e.payload, derivativeKind)

  const session = sessions.find((s) => s.entries.some(isRelevantEntry))
  if (!session) return []

  const stems: string[] = []
  for (const entry of session.entries) {
    if (!isRelevantEntry(entry)) continue
    const p = entry.payload
    const stem = (p.mindmapStem ?? '').trim() || (p.questionTitle ?? '').trim()
    if (stem) stems.push(stem)
    if (stems.length >= maxItems) break
  }
  return stems
}
