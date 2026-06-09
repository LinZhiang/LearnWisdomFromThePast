import type { QuestionBank } from '@/db/models'
import {
  questionBankExpandsToGeneralInTest,
  questionBankExpandsToJudgmentInTest,
  questionBankExpandsToMcqInTest,
} from '@/constants/question-bank-types'
import type { LearningTypeTreeNode } from '@/utils/learningTypeTree'
import {
  getHandoutGeneralCount,
  getHandoutJudgmentCount,
  getHandoutMcqCount,
} from '@/utils/handoutQuestion'

export type TestEntryTypeFilter = {
  includeChoiceLike: boolean
  includeGeneral: boolean
  includeJudgment: boolean
}

export type TestEntryTreeNode = {
  id: number
  label: string
  directCount: number
  totalCount: number
  children: TestEntryTreeNode[]
}

/** 根据导图 Markdown 预估可生成的选择题上限（与 DeepSeek 5～10 道规则对齐，仅用于 UI 展示） */
export function estimateMindmapMcqCount(markdown: string): number {
  const md = (markdown ?? '').trim()
  if (!md) return 0
  const boldCount = (md.match(/\*\*[^*]+?\*\*/g) ?? []).length
  const lines = md.split(/\n/).filter((l) => l.trim().length > 0).length
  if (boldCount >= 10 || lines >= 40) return 10
  if (boldCount >= 6 || lines >= 25) return 8
  if (boldCount >= 3 || lines >= 15) return 6
  return 5
}

/** 单条题库记录在测验中预估对应的小题数量 */
export function getQuestionBankTestUnitCount(q: QuestionBank): number {
  const t = q.type ?? 'general'
  if (t === 'mindmap') return estimateMindmapMcqCount(q.content)
  if (t === 'handout') {
    let n = 0
    if (questionBankExpandsToMcqInTest(q)) n += getHandoutMcqCount(q)
    if (questionBankExpandsToGeneralInTest(q)) n += getHandoutGeneralCount(q)
    if (questionBankExpandsToJudgmentInTest(q)) n += getHandoutJudgmentCount(q)
    return n
  }
  return 1
}

export function sumQuestionBankTestUnitCounts(questions: QuestionBank[]): number {
  return questions.reduce((sum, q) => sum + getQuestionBankTestUnitCount(q), 0)
}

export function hasExpandableMcqQuestionBankItems(questions: QuestionBank[]): boolean {
  return questions.some((q) => questionBankExpandsToMcqInTest(q))
}

export function hasExpandableGeneralQuestionBankItems(questions: QuestionBank[]): boolean {
  return questions.some((q) => questionBankExpandsToGeneralInTest(q))
}

export function hasExpandableJudgmentQuestionBankItems(questions: QuestionBank[]): boolean {
  return questions.some((q) => questionBankExpandsToJudgmentInTest(q))
}

export function questionMatchesTestTypeFilter(
  q: QuestionBank,
  config: TestEntryTypeFilter,
): boolean {
  const t = q.type ?? 'general'
  if (t === 'general') return config.includeGeneral
  if (t === 'choice') return config.includeChoiceLike
  if (questionBankExpandsToMcqInTest(q) && config.includeChoiceLike) return true
  if (questionBankExpandsToGeneralInTest(q) && config.includeGeneral) return true
  if (questionBankExpandsToJudgmentInTest(q) && config.includeJudgment) return true
  return false
}

export function countQuestionBankTestUnitsForConfig(
  q: QuestionBank,
  config: TestEntryTypeFilter,
): number {
  const t = q.type ?? 'general'
  if (t === 'handout') {
    let n = 0
    if (questionBankExpandsToMcqInTest(q) && config.includeChoiceLike) {
      n += getHandoutMcqCount(q)
    }
    if (questionBankExpandsToGeneralInTest(q) && config.includeGeneral) {
      n += getHandoutGeneralCount(q)
    }
    if (questionBankExpandsToJudgmentInTest(q) && config.includeJudgment) {
      n += getHandoutJudgmentCount(q)
    }
    return n
  }
  if (t === 'general') return config.includeGeneral ? 1 : 0
  if (t === 'choice') return config.includeChoiceLike ? 1 : 0
  if (t === 'mindmap') return config.includeChoiceLike ? getQuestionBankTestUnitCount(q) : 0
  return 0
}

/** 父节点测验弹窗：按学习类型树展示可测小项（仅保留子树内有测验题的节点） */
export function buildTestEntryTree(
  node: LearningTypeTreeNode,
  questions: QuestionBank[],
  config: TestEntryTypeFilter,
): TestEntryTreeNode | null {
  if (node.id == null) return null

  const children = node.children
    .map((child) => buildTestEntryTree(child, questions, config))
    .filter((x): x is TestEntryTreeNode => x != null)

  const directQs = questions.filter(
    (q) => q.learningTypeId === node.id && questionMatchesTestTypeFilter(q, config),
  )
  const directCount = directQs.reduce(
    (sum, q) => sum + countQuestionBankTestUnitsForConfig(q, config),
    0,
  )
  const totalCount = directCount + children.reduce((sum, child) => sum + child.totalCount, 0)
  if (totalCount === 0) return null

  return {
    id: node.id,
    label: node.name,
    directCount,
    totalCount,
    children,
  }
}

export function collectTestEntryTreeNodeIds(nodes: TestEntryTreeNode[]): number[] {
  const ids: number[] = []
  const walk = (list: TestEntryTreeNode[]) => {
    for (const node of list) {
      ids.push(node.id)
      if (node.children.length > 0) walk(node.children)
    }
  }
  walk(nodes)
  return ids
}

/** @deprecated 使用 hasExpandableMcqQuestionBankItems */
export function hasMindmapQuestionBankItems(questions: QuestionBank[]): boolean {
  return hasExpandableMcqQuestionBankItems(questions)
}

/** 按勾选顺序分组，便于逐小项覆盖 */
export function groupQuestionsByLearningType(
  questions: QuestionBank[],
  learningTypeIds: number[],
): Map<number, QuestionBank[]> {
  const map = new Map<number, QuestionBank[]>()
  for (const id of learningTypeIds) map.set(id, [])
  for (const q of questions) {
    const lt = q.learningTypeId
    if (lt == null || !map.has(lt)) continue
    map.get(lt)!.push(q)
  }
  return map
}

export function filterQuestionsForTestConfig(
  questions: QuestionBank[],
  config: {
    learningTypeIds: number[]
    includeChoiceLike: boolean
    includeGeneral: boolean
    includeJudgment: boolean
  },
): QuestionBank[] {
  const leafSet = new Set(config.learningTypeIds)
  return questions.filter((q) => {
    if (q.id == null || q.learningTypeId == null) return false
    if (!leafSet.has(q.learningTypeId)) return false
    const t = q.type ?? 'general'
    if (t === 'general') return config.includeGeneral
    if (t === 'choice') return config.includeChoiceLike
    if (questionBankExpandsToMcqInTest(q) && config.includeChoiceLike) return true
    if (questionBankExpandsToGeneralInTest(q) && config.includeGeneral) return true
    if (questionBankExpandsToJudgmentInTest(q) && config.includeJudgment) return true
    return false
  })
}

export function sumQuestionBankTestUnitCountsForConfig(
  questions: QuestionBank[],
  config: {
    learningTypeIds: number[]
    includeChoiceLike: boolean
    includeGeneral: boolean
    includeJudgment: boolean
  },
): number {
  const filtered = filterQuestionsForTestConfig(questions, config)
  return filtered.reduce(
    (sum, q) => sum + countQuestionBankTestUnitsForConfig(q, config),
    0,
  )
}
