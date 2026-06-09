import type { QuestionBank } from '@/db/models'

export const HANDOUT_MCQ_COUNT_MIN = 1
export const HANDOUT_MCQ_COUNT_MAX = 20
export const HANDOUT_MCQ_COUNT_DEFAULT = 8

export const HANDOUT_GENERAL_COUNT_MIN = 1
export const HANDOUT_GENERAL_COUNT_MAX = 20
export const HANDOUT_GENERAL_COUNT_DEFAULT = 5

export const HANDOUT_JUDGMENT_COUNT_MIN = 1
export const HANDOUT_JUDGMENT_COUNT_MAX = 20
export const HANDOUT_JUDGMENT_COUNT_DEFAULT = 5

/** 讲义衍生计算题单题分值（与导图/讲义选择题小题一致） */
export const HANDOUT_GENERAL_SCORE_DEFAULT = 2

export const HANDOUT_JUDGMENT_SCORE_DEFAULT = 2

export const HANDOUT_JUDGMENT_OPTIONS = ['正确', '错误'] as const

export function clampHandoutMcqCount(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return HANDOUT_MCQ_COUNT_DEFAULT
  return Math.min(HANDOUT_MCQ_COUNT_MAX, Math.max(HANDOUT_MCQ_COUNT_MIN, n))
}

export function clampHandoutGeneralCount(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return HANDOUT_GENERAL_COUNT_DEFAULT
  return Math.min(HANDOUT_GENERAL_COUNT_MAX, Math.max(HANDOUT_GENERAL_COUNT_MIN, n))
}

export function clampHandoutJudgmentCount(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return HANDOUT_JUDGMENT_COUNT_DEFAULT
  return Math.min(HANDOUT_JUDGMENT_COUNT_MAX, Math.max(HANDOUT_JUDGMENT_COUNT_MIN, n))
}

/** 讲义勾选自动选择题时的目标小题数 */
export function getHandoutMcqCount(q: QuestionBank): number {
  if (q.type !== 'handout' || !q.handoutAutoMcq) return 0
  return clampHandoutMcqCount(q.handoutMcqCount ?? HANDOUT_MCQ_COUNT_DEFAULT)
}

/** 讲义勾选自动一般题时的目标小题数 */
export function getHandoutGeneralCount(q: QuestionBank): number {
  if (q.type !== 'handout' || !q.handoutAutoGeneral) return 0
  return clampHandoutGeneralCount(q.handoutGeneralCount ?? HANDOUT_GENERAL_COUNT_DEFAULT)
}

/** 讲义勾选自动判断题时的目标小题数 */
export function getHandoutJudgmentCount(q: QuestionBank): number {
  if (q.type !== 'handout' || !q.handoutAutoJudgment) return 0
  return clampHandoutJudgmentCount(q.handoutJudgmentCount ?? HANDOUT_JUDGMENT_COUNT_DEFAULT)
}

/** 讲义是否参与测验（至少勾选一种自动出题） */
export function handoutHasAutoTest(q: QuestionBank): boolean {
  if (q.type !== 'handout') return false
  return (
    q.handoutAutoMcq === true ||
    q.handoutAutoGeneral === true ||
    q.handoutAutoJudgment === true
  )
}
