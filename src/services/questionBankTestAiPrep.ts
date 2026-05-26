import type { QuestionBank } from '@/db/models'
import type { MindmapDerivedMcq } from '@/services/deepseek'
import { requestChoiceDistractors, requestMindmapDerivedMcqs } from '@/services/deepseek'
import {
  loadQuestionBankAiPrep,
  saveQuestionBankAiPrep,
} from '@/services/question-bank-ai-prep-store'
import { buildQuestionBankAiCacheKey, rememberAiResponse } from '@/utils/aiResponseCache'

function choiceDistractorsFingerprint(
  q: QuestionBank,
  correct: string[],
  need: number,
): string {
  return [
    q.title ?? '',
    q.content ?? '',
    q.analysis ?? '',
    String(need),
    correct.join('\n'),
  ].join('\0')
}

function mindmapMcqsFingerprint(q: QuestionBank): string {
  return [q.title ?? '', q.content ?? ''].join('\0')
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
    if (stored) return stored
  }

  const key = buildQuestionBankAiCacheKey('choice-distractors', q.id, fingerprint)
  return rememberAiResponse(key, async () => {
    const data = await requestChoiceDistractors({
      title: q.title,
      correctAnswers: correct,
      need,
      analysisHtml: q.analysis,
    })
    if (q.id != null) {
      await saveQuestionBankAiPrep(q.id, 'choice-distractors', fingerprint, data)
    }
    return data
  })
}

/** 带 IndexedDB + 会话缓存的思维导图衍生小题 */
export async function fetchCachedMindmapDerivedMcqs(
  q: QuestionBank,
): Promise<MindmapDerivedMcq[]> {
  const fingerprint = mindmapMcqsFingerprint(q)
  if (q.id != null) {
    const stored = await loadQuestionBankAiPrep<MindmapDerivedMcq[]>(
      q.id,
      'mindmap-mcqs',
      fingerprint,
    )
    if (stored) return stored
  }

  const key = buildQuestionBankAiCacheKey('mindmap-mcqs', q.id, fingerprint)
  return rememberAiResponse(key, async () => {
    const data = await requestMindmapDerivedMcqs({
      title: q.title,
      markdown: q.content ?? '',
    })
    if (q.id != null) {
      await saveQuestionBankAiPrep(q.id, 'mindmap-mcqs', fingerprint, data)
    }
    return data
  })
}
