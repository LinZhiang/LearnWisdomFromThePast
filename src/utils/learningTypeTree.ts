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

/** 收集节点自身及子树内全部节点 id（父节点选中时，错题可能挂在父级或非叶子分类上） */
export function collectSubtreeNodeIds(node: LearningTypeTreeNode): number[] {
  const ids: number[] = []
  if (node.id != null) ids.push(node.id)
  for (const child of node.children) {
    ids.push(...collectSubtreeNodeIds(child))
  }
  return ids
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
