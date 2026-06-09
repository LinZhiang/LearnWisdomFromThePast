import type { QuestionBank } from '@/db/models'

/** 未设置时视为普通重要程度 */
export const QUESTION_BANK_IMPORTANCE_DEFAULT = 2

export const QUESTION_BANK_IMPORTANCE_MIN = 1
export const QUESTION_BANK_IMPORTANCE_MAX = 4

export function normalizeQuestionBankImportance(value: unknown): number {
  if (value == null || value === '') return QUESTION_BANK_IMPORTANCE_DEFAULT
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return QUESTION_BANK_IMPORTANCE_DEFAULT
  return Math.min(
    QUESTION_BANK_IMPORTANCE_MAX,
    Math.max(QUESTION_BANK_IMPORTANCE_MIN, n),
  )
}

export function getQuestionBankImportance(q: QuestionBank): number {
  return normalizeQuestionBankImportance(q.importance)
}

/** 出题轮询权重，与星级一致（1～4） */
export function questionBankImportanceWeight(q: QuestionBank): number {
  return getQuestionBankImportance(q)
}

export function importanceStarsLabel(stars: number): string {
  const n = normalizeQuestionBankImportance(stars)
  return '★'.repeat(n) + '☆'.repeat(QUESTION_BANK_IMPORTANCE_MAX - n)
}
