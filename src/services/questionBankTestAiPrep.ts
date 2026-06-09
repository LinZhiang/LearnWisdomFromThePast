import type { QuestionBank } from '@/db/models'
import type { MindmapDerivedMcq } from '@/services/deepseek'
import {
  requestChoiceDistractors,
  requestHandoutDerivedGeneralQuestions,
  requestHandoutDerivedJudgmentQuestions,
  requestHandoutDerivedMcqs,
  requestMindmapDerivedMcqs,
  type HandoutDerivedGeneral,
  type HandoutDerivedJudgment,
} from '@/services/deepseek'
import {
  getHandoutGeneralCount,
  getHandoutJudgmentCount,
  getHandoutMcqCount,
} from '@/utils/handoutQuestion'
import {
  loadQuestionBankAiPrep,
  saveQuestionBankAiPrep,
} from '@/services/question-bank-ai-prep-store'
import {
  buildQuestionBankAiCacheKey,
  hashForAiCache,
  rememberAiArrayResponse,
  rememberAiResponse,
} from '@/utils/aiResponseCache'
import {
  areMcqOptionsAllDistinct,
  dedupeMcqsByCorrectAnswer,
  filterConsistentMcqDistractors,
  mcqOptionsAreUniformlyFormatted,
  mcqOptionsHaveCategoryOutlier,
} from '@/utils/mcqOptionFormat'
import { shuffleArray } from '@/utils/testMcqScore'

function choiceDistractorsFingerprint(
  q: QuestionBank,
  correct: string[],
  need: number,
): string {
  return [
    'optfmt-v1',
    q.title ?? '',
    q.content ?? '',
    q.analysis ?? '',
    String(need),
    correct.join('\n'),
  ].join('\0')
}

function finalizeChoiceDistractors(
  raw: string[],
  correct: string[],
  need: number,
): string[] {
  const dedup = filterConsistentMcqDistractors(raw, correct)
  while (dedup.length < need) {
    dedup.push(`（干扰项 ${dedup.length + 1}）请重新生成测验`)
  }
  return dedup.slice(0, need)
}

function mindmapMcqsFingerprint(q: QuestionBank): string {
  return [q.title ?? '', q.content ?? ''].join('\0')
}

function quizAvoidFingerprint(q: QuestionBank, avoidanceHint?: string): string {
  return hashForAiCache(
    [mindmapMcqsFingerprint(q), avoidanceHint ?? '', 'quiz-avoid-v3'].join('\0'),
  )
}

export type PreparedQuizMcq = {
  stem: string
  options: string[]
  correctIndices: number[]
  mode: 'single' | 'multiple'
}

function matchMcqCorrectIndices(options: string[], correct: string[]): number[] | null {
  const norm = (s: string) => s.replace(/\s+/g, '')
  const pool = correct.map((c) => norm(c))
  const used = new Array(pool.length).fill(false)
  const indices: number[] = []
  for (let i = 0; i < options.length; i++) {
    const o = norm(options[i] ?? '')
    const hit = pool.findIndex((c, idx) => !used[idx] && c === o)
    if (hit < 0) continue
    used[hit] = true
    indices.push(i)
  }
  return indices.length === correct.length ? indices.sort((a, b) => a - b) : null
}

/** 将 API 返回的选择题转为测验单元所需结构（含选项打乱） */
export function prepareQuizMcqUnits(mcqs: MindmapDerivedMcq[]): PreparedQuizMcq[] {
  const prepared: PreparedQuizMcq[] = []
  for (const m of dedupeMcqsByCorrectAnswer(mcqs)) {
    if (!mcqOptionsAreUniformlyFormatted(m.correct, m.distractors)) continue
    if (mcqOptionsHaveCategoryOutlier(m.correct, m.distractors)) continue
    if (!areMcqOptionsAllDistinct(m.correct, m.distractors)) continue
    const options = shuffleArray([...m.correct, ...m.distractors])
    const expectedLen = m.layout === 'cloze-four' ? 4 : 5
    if (options.length !== expectedLen) continue
    const correctIndices = matchMcqCorrectIndices(options, m.correct)
    if (!correctIndices) continue
    prepared.push({ stem: m.stem, options, correctIndices, mode: m.mode })
  }
  return prepared
}

async function fetchQuizDerivedMcqsOnce(
  q: QuestionBank,
  quizAvoidanceHint?: string,
): Promise<MindmapDerivedMcq[]> {
  return q.type === 'handout'
    ? await fetchHandoutDerivedMcqs(q, quizAvoidanceHint)
    : await fetchQuizMindmapDerivedMcqs(q, quizAvoidanceHint)
}

/**
 * 学习题库测验：先带近几场参考出题；失败或空结果时自动回退为不带参考，避免整场无题。
 */
export async function fetchQuizDerivedMcqsResilient(
  q: QuestionBank,
  quizAvoidanceHint?: string,
): Promise<MindmapDerivedMcq[]> {
  const hint = quizAvoidanceHint?.trim() || undefined
  if (hint) {
    try {
      const withHint = await fetchQuizDerivedMcqsOnce(q, hint)
      if (withHint.length > 0) return withHint
    } catch {
      /* 带参考失败时回退 */
    }
  }
  return fetchQuizDerivedMcqsOnce(q, undefined)
}

/** 讲义一般题：带参考失败或空结果时回退 */
export async function fetchHandoutDerivedGeneralResilient(
  q: QuestionBank,
  quizAvoidanceHint?: string,
): Promise<HandoutDerivedGeneral[]> {
  const hint = quizAvoidanceHint?.trim() || undefined
  if (hint) {
    try {
      const withHint = await fetchHandoutDerivedGeneral(q, hint)
      if (withHint.length > 0) return withHint
    } catch {
      /* 带参考失败时回退 */
    }
  }
  return fetchHandoutDerivedGeneral(q, undefined)
}

/** 讲义判断题：带参考失败或空结果时回退 */
export async function fetchHandoutDerivedJudgmentResilient(
  q: QuestionBank,
  quizAvoidanceHint?: string,
): Promise<HandoutDerivedJudgment[]> {
  const hint = quizAvoidanceHint?.trim() || undefined
  if (hint) {
    try {
      const withHint = await fetchHandoutDerivedJudgment(q, hint)
      if (withHint.length > 0) return withHint
    } catch {
      /* 带参考失败时回退 */
    }
  }
  return fetchHandoutDerivedJudgment(q, undefined)
}

/** 带 IndexedDB + 会话缓存的选择题干扰项（题目未改则不再请求 API） */
export async function fetchCachedChoiceDistractors(
  q: QuestionBank,
  correct: string[],
  need: number,
): Promise<string[]> {
  const fingerprint = choiceDistractorsFingerprint(q, correct, need)
  if (q.id != null) {
    const stored = await loadQuestionBankAiPrep<string[]>(
      q.id,
      'choice-distractors',
      fingerprint,
    )
    if (stored) return finalizeChoiceDistractors(stored, correct, need)
  }

  const key = buildQuestionBankAiCacheKey('choice-distractors', q.id, fingerprint)
  return rememberAiResponse(key, async () => {
    const data = await requestChoiceDistractors({
      title: q.title,
      correctAnswers: correct,
      need,
      analysisHtml: q.analysis,
    })
    const finalized = finalizeChoiceDistractors(data, correct, need)
    if (q.id != null) {
      await saveQuestionBankAiPrep(q.id, 'choice-distractors', fingerprint, finalized)
    }
    return finalized
  })
}

/**
 * 思维导图测验小题：按「内容 + 近几场去重提示」生成，不写长期 IndexedDB 缓存（避免每次测验题目完全相同）。
 */
export async function fetchQuizMindmapDerivedMcqs(
  q: QuestionBank,
  quizAvoidanceHint?: string,
): Promise<MindmapDerivedMcq[]> {
  const fp = quizAvoidFingerprint(q, quizAvoidanceHint)
  const key = buildQuestionBankAiCacheKey('mindmap-mcqs-quiz', q.id, fp)
  return rememberAiResponse(key, () =>
    requestMindmapDerivedMcqs({
      title: q.title,
      markdown: q.content ?? '',
      quizAvoidanceHint,
    }),
  )
}

/** @deprecated 仅保留兼容；学习题库测验请用 fetchQuizMindmapDerivedMcqs */
export async function fetchCachedMindmapDerivedMcqs(
  q: QuestionBank,
): Promise<MindmapDerivedMcq[]> {
  return fetchQuizMindmapDerivedMcqs(q)
}

/** 讲义衍生选择题（测验：带近几场去重，会话级缓存） */
export async function fetchHandoutDerivedMcqs(
  q: QuestionBank,
  quizAvoidanceHint?: string,
): Promise<MindmapDerivedMcq[]> {
  const count = getHandoutMcqCount(q)
  const fp = quizAvoidFingerprint(q, `${quizAvoidanceHint ?? ''}\0mcq\0${count}\0v3`)
  const key = buildQuestionBankAiCacheKey('handout-mcqs-quiz-v3', q.id, fp)
  return rememberAiArrayResponse(key, count, () =>
    requestHandoutDerivedMcqs({
      title: q.title,
      bodyText: q.content ?? '',
      questionCount: count,
      quizAvoidanceHint,
    }),
  )
}

/** 讲义衍生计算/一般题（测验：带近几场去重，会话级缓存） */
export async function fetchHandoutDerivedGeneral(
  q: QuestionBank,
  quizAvoidanceHint?: string,
): Promise<HandoutDerivedGeneral[]> {
  const count = getHandoutGeneralCount(q)
  const fp = quizAvoidFingerprint(q, `${quizAvoidanceHint ?? ''}\0gen\0${count}\0v3`)
  const key = buildQuestionBankAiCacheKey('handout-general-quiz-v3', q.id, fp)
  return rememberAiArrayResponse(key, count, () =>
    requestHandoutDerivedGeneralQuestions({
      title: q.title,
      bodyText: q.content ?? '',
      questionCount: count,
      quizAvoidanceHint,
    }),
  )
}

/** 讲义衍生判断题（测验：带近几场去重，会话级缓存） */
export async function fetchHandoutDerivedJudgment(
  q: QuestionBank,
  quizAvoidanceHint?: string,
): Promise<HandoutDerivedJudgment[]> {
  const count = getHandoutJudgmentCount(q)
  const fp = quizAvoidFingerprint(q, `${quizAvoidanceHint ?? ''}\0judgment\0${count}\0v3`)
  const key = buildQuestionBankAiCacheKey('handout-judgment-quiz-v3', q.id, fp)
  return rememberAiArrayResponse(key, count, () =>
    requestHandoutDerivedJudgmentQuestions({
      title: q.title,
      bodyText: q.content ?? '',
      questionCount: count,
      quizAvoidanceHint,
    }),
  )
}
