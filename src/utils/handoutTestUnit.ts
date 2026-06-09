import type { QuestionBank } from '@/db/models'
import { markdownToSafeHtml } from '@/utils/markdownToHtml'
import {
  HANDOUT_GENERAL_SCORE_DEFAULT,
  HANDOUT_JUDGMENT_OPTIONS,
  HANDOUT_JUDGMENT_SCORE_DEFAULT,
} from '@/utils/handoutQuestion'
import type { TestUnit } from '@/views/learning/question-bank/components/questionBankTestTypes'

export type HandoutGeneralTestUnit = Extract<TestUnit, { kind: 'handout-general' }>

export function isGeneralLikeTestUnit(
  u: TestUnit,
): u is Extract<TestUnit, { kind: 'general' }> | HandoutGeneralTestUnit {
  return u.kind === 'general' || u.kind === 'handout-general'
}

/** 将讲义衍生一般题映射为测验页可用的虚拟题库行 */
export function virtualQuestionFromHandoutGeneral(unit: HandoutGeneralTestUnit): QuestionBank {
  const kp = unit.knowledgePoint.trim()
  const title = kp
    ? `${unit.parent.title} · ${kp}`
    : `${unit.parent.title}（第 ${unit.subIndex}/${unit.subTotal} 题）`
  const analysisMd = [
    unit.analysis.trim(),
    unit.referenceAnswer.trim() ? `**参考答案**\n\n${unit.referenceAnswer.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const now = new Date().toISOString()
  return {
    type: 'general',
    title,
    content: markdownToSafeHtml(unit.stem),
    analysis: markdownToSafeHtml(analysisMd),
    score: unit.score,
    learningTypeId: unit.parent.learningTypeId,
    createdAt: now,
    updatedAt: now,
  }
}

export function handoutGeneralUnitScore(): number {
  return HANDOUT_GENERAL_SCORE_DEFAULT
}

export function handoutJudgmentUnitScore(): number {
  return HANDOUT_JUDGMENT_SCORE_DEFAULT
}

export function handoutJudgmentOptions(): string[] {
  return [...HANDOUT_JUDGMENT_OPTIONS]
}
