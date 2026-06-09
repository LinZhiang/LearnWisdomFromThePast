import type { QuestionBank } from '@/db/models'
import {
  QBANK_DERIVED_GENERAL_LABEL,
  QBANK_DERIVED_JUDGMENT_LABEL,
  QBANK_DERIVED_MCQ_LABEL,
  QBANK_UI,
} from '@/constants/question-bank-copy'
import {
  getHandoutGeneralCount,
  getHandoutJudgmentCount,
  getHandoutMcqCount,
  handoutHasAutoTest,
} from '@/utils/handoutQuestion'

export {
  QBANK_CONTENT_TYPE_LABELS,
  QBANK_UI,
  QUESTION_BANK_TYPE_LABELS,
} from '@/constants/question-bank-copy'

/** 测验时是否会展开为多道选择题（思维导图；或勾选自动选择题的讲义） */
export function questionBankExpandsToMcqInTest(q: QuestionBank): boolean {
  const t = q.type ?? 'general'
  if (t === 'mindmap') return true
  if (t === 'handout') return q.handoutAutoMcq === true
  return false
}

/** 测验时是否会展开为多道作答题（勾选自动计算题的讲义） */
export function questionBankExpandsToGeneralInTest(q: QuestionBank): boolean {
  return (q.type ?? 'general') === 'handout' && q.handoutAutoGeneral === true
}

/** 测验时是否会展开为多道判断题（勾选自动判断题的讲义） */
export function questionBankExpandsToJudgmentInTest(q: QuestionBank): boolean {
  return (q.type ?? 'general') === 'handout' && q.handoutAutoJudgment === true
}

/** 是否仅阅读、不参与测验选题（未勾选任何自动出题的讲义） */
export function questionBankIsPreviewOnlyInTest(q: QuestionBank): boolean {
  return (q.type ?? 'general') === 'handout' && !handoutHasAutoTest(q)
}

/** 可出现在测验勾选列表中 */
export function questionBankEligibleForTest(q: QuestionBank): boolean {
  return !questionBankIsPreviewOnlyInTest(q)
}

/** 列表「测验」列展示 */
export function questionBankTestEligibilityLabel(q: QuestionBank): string {
  if (questionBankIsPreviewOnlyInTest(q)) return QBANK_UI.previewOnly
  const t = q.type ?? 'general'
  if (t === 'handout') {
    const parts: string[] = []
    if (q.handoutAutoMcq) parts.push(`选择 ${getHandoutMcqCount(q)} 道`)
    if (q.handoutAutoGeneral) parts.push(`计算 ${getHandoutGeneralCount(q)} 道`)
    if (q.handoutAutoJudgment) parts.push(`判断 ${getHandoutJudgmentCount(q)} 道`)
    if (parts.length) return `${QBANK_UI.testEligible}（${parts.join('、')}）`
  }
  if (t === 'mindmap') return `${QBANK_UI.testEligible}（${QBANK_DERIVED_MCQ_LABEL.mindmap}）`
  return QBANK_UI.testEligible
}

export function questionBankNoScoreType(q: QuestionBank): boolean {
  const t = q.type ?? 'general'
  return t === 'mindmap' || t === 'handout'
}

export function questionBankDerivedMcqKindLabel(parent: QuestionBank): string {
  return (parent.type ?? 'general') === 'handout'
    ? QBANK_DERIVED_MCQ_LABEL.handout
    : QBANK_DERIVED_MCQ_LABEL.mindmap
}

export function questionBankDerivedGeneralKindLabel(_parent: QuestionBank): string {
  return QBANK_DERIVED_GENERAL_LABEL
}

export function questionBankDerivedJudgmentKindLabel(_parent: QuestionBank): string {
  return QBANK_DERIVED_JUDGMENT_LABEL
}

export function handoutTestModeLabel(q: QuestionBank): string {
  if (q.type !== 'handout') return ''
  if (!handoutHasAutoTest(q)) return '测验时不自动生成测验题（仅阅读讲义）'
  const parts: string[] = []
  if (q.handoutAutoMcq) parts.push(`${getHandoutMcqCount(q)} 道选择题`)
  if (q.handoutAutoGeneral) parts.push(`${getHandoutGeneralCount(q)} 道计算题`)
  if (q.handoutAutoJudgment) parts.push(`${getHandoutJudgmentCount(q)} 道判断题`)
  return `测验时将自动生成 ${parts.join('、')}`
}
