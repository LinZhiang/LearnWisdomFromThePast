import type { QuestionBank } from '@/db/models'
import type { LearningTypeTreeNode } from '@/utils/learningTypeTree'

export type LearningTypeTreeBranch<T> = {
  id: string
  node: LearningTypeTreeNode
  depth: number
  branches: LearningTypeTreeBranch<T>[]
  entries: T[]
}

export type LearningTypeTreeTableBranchRow = {
  kind: 'branch'
  node: LearningTypeTreeNode
  depth: number
  branchId: string
  descendantCount: number
}

export type LearningTypeTreeTableEntryRow<T> = {
  kind: 'entry'
  item: T
  depth: number
}

export type LearningTypeTreeTableRow<T> =
  | LearningTypeTreeTableBranchRow
  | LearningTypeTreeTableEntryRow<T>

function branchIdForNode(node: LearningTypeTreeNode): string {
  return node.id != null ? `lt-${node.id}` : `lt-name-${node.name}`
}

function countBranchContent<T>(branch: LearningTypeTreeBranch<T>): number {
  let n = branch.entries.length
  for (const child of branch.branches) {
    n += countBranchContent(child)
  }
  return n
}

function buildSubtree<T>(
  node: LearningTypeTreeNode,
  depth: number,
  byLearningTypeId: Map<number, T[]>,
): LearningTypeTreeBranch<T> | null {
  const directEntries = node.id != null ? (byLearningTypeId.get(node.id) ?? []) : []

  if (node.children.length === 0) {
    if (directEntries.length === 0) return null
    return {
      id: branchIdForNode(node),
      node,
      depth,
      branches: [],
      entries: directEntries,
    }
  }

  const branches = node.children
    .map((child) => buildSubtree(child, depth + 1, byLearningTypeId))
    .filter((x): x is LearningTypeTreeBranch<T> => x != null)

  if (branches.length === 0 && directEntries.length === 0) return null

  return {
    id: branchIdForNode(node),
    node,
    depth,
    branches,
    entries: directEntries,
  }
}

/** 收集分支树上全部 branch id（用于默认展开分组） */
export function collectLearningTypeBranchIds<T>(
  branches: LearningTypeTreeBranch<T>[],
): string[] {
  const ids: string[] = []
  const walk = (list: LearningTypeTreeBranch<T>[]) => {
    for (const branch of list) {
      ids.push(branch.id)
      walk(branch.branches)
    }
  }
  walk(branches)
  return ids
}

/** 按学习类型子树分组条目（learningTypeId 可落在父节点或叶子） */
export function buildLearningTypeTreeBranches<T>(
  root: LearningTypeTreeNode,
  items: T[],
  getLearningTypeId: (item: T) => number | null | undefined,
): LearningTypeTreeBranch<T>[] {
  const byLearningTypeId = new Map<number, T[]>()
  for (const item of items) {
    const ltId = getLearningTypeId(item)
    if (ltId == null) continue
    const list = byLearningTypeId.get(ltId) ?? []
    list.push(item)
    byLearningTypeId.set(ltId, list)
  }

  const rootDirect = root.id != null ? (byLearningTypeId.get(root.id) ?? []) : []
  const childBranches = root.children
    .map((child) => buildSubtree(child, 0, byLearningTypeId))
    .filter((x): x is LearningTypeTreeBranch<T> => x != null)

  const result: LearningTypeTreeBranch<T>[] = []

  if (rootDirect.length > 0) {
    result.push({
      id: `${branchIdForNode(root)}__direct`,
      node: root,
      depth: 0,
      branches: [],
      entries: rootDirect,
    })
  }

  result.push(...childBranches)
  return result
}

/** 按展开状态压平为表格行（expanded 为空则仅显示分组标题） */
export function flattenLearningTypeTreeDisplay<T>(
  branches: LearningTypeTreeBranch<T>[],
  expanded: ReadonlySet<string>,
): LearningTypeTreeTableRow<T>[] {
  const rows: LearningTypeTreeTableRow<T>[] = []

  const walk = (list: LearningTypeTreeBranch<T>[]) => {
    for (const branch of list) {
      rows.push({
        kind: 'branch',
        node: branch.node,
        depth: branch.depth,
        branchId: branch.id,
        descendantCount: countBranchContent(branch),
      })
      if (!expanded.has(branch.id)) continue
      walk(branch.branches)
      for (const item of branch.entries) {
        rows.push({
          kind: 'entry',
          item,
          depth: branch.depth + 1,
        })
      }
    }
  }

  walk(branches)
  return rows
}

/** 讲义/题库：按题目 learningTypeId 建树 */
export function buildQuestionBankTreeBranches(
  root: LearningTypeTreeNode,
  questions: QuestionBank[],
): LearningTypeTreeBranch<QuestionBank>[] {
  return buildLearningTypeTreeBranches(root, questions, (q) => q.learningTypeId)
}

export type QuestionBankTreeTableEntryRow = {
  kind: 'entry'
  question: QuestionBank
  depth: number
}

export type QuestionBankTreeTableRow =
  | LearningTypeTreeTableBranchRow
  | QuestionBankTreeTableEntryRow

/** 兼容题库页：entry 行使用 question 字段名 */
export function flattenQuestionBankTreeDisplay(
  branches: LearningTypeTreeBranch<QuestionBank>[],
  expanded: ReadonlySet<string>,
): QuestionBankTreeTableRow[] {
  return flattenLearningTypeTreeDisplay(branches, expanded).map((row) => {
    if (row.kind === 'branch') return row
    return { kind: 'entry', question: row.item, depth: row.depth }
  })
}

/** @deprecated 使用 buildQuestionBankTreeBranches + flattenQuestionBankTreeDisplay */
export function buildQuestionBankTreeTableRows(
  root: LearningTypeTreeNode,
  questions: QuestionBank[],
): QuestionBankTreeTableRow[] {
  return flattenQuestionBankTreeDisplay(
    buildQuestionBankTreeBranches(root, questions),
    new Set(),
  )
}
