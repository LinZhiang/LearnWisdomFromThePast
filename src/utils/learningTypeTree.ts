import type { LearningType } from '@/db/models'

export type LearningTypeTreeNode = LearningType & {
  level: number
  children: LearningTypeTreeNode[]
}

/** 收集节点下所有叶子（含自身若为叶子） */
export function collectLeafDescendants(node: LearningTypeTreeNode): LearningTypeTreeNode[] {
  if (node.children.length === 0) return [node]
  return node.children.flatMap(collectLeafDescendants)
}

export function findLearningTypeNodeById(
  nodes: LearningTypeTreeNode[],
  id: number,
): LearningTypeTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findLearningTypeNodeById(node.children, id)
    if (found) return found
  }
  return null
}
