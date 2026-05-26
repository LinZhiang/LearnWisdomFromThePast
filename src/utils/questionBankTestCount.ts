import type { QuestionBank } from '@/db/models'

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

/** 单条题库记录在测验中预估对应的小题数量（思维导图按内容预估） */
export function getQuestionBankTestUnitCount(q: QuestionBank): number {
  const t = q.type ?? 'general'
  if (t === 'mindmap') return estimateMindmapMcqCount(q.content)
  return 1
}

export function sumQuestionBankTestUnitCounts(questions: QuestionBank[]): number {
  return questions.reduce((sum, q) => sum + getQuestionBankTestUnitCount(q), 0)
}

export function hasMindmapQuestionBankItems(questions: QuestionBank[]): boolean {
  return questions.some((q) => (q.type ?? 'general') === 'mindmap')
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
  },
): QuestionBank[] {
  const leafSet = new Set(config.learningTypeIds)
  return questions.filter((q) => {
    if (q.id == null || q.learningTypeId == null) return false
    if (!leafSet.has(q.learningTypeId)) return false
    const t = q.type ?? 'general'
    if (t === 'general') return config.includeGeneral
    if (t === 'choice' || t === 'mindmap') return config.includeChoiceLike
    return false
  })
}

export function sumQuestionBankTestUnitCountsForConfig(
  questions: QuestionBank[],
  config: {
    learningTypeIds: number[]
    includeChoiceLike: boolean
    includeGeneral: boolean
  },
): number {
  return sumQuestionBankTestUnitCounts(filterQuestionsForTestConfig(questions, config))
}
