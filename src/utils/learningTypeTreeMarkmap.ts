export type LearningTypeChartNode = {
  name: string
  value: string
  children: LearningTypeChartNode[]
}

/** 避免节点名破坏 Markdown 结构 */
function escapeMdInline(text: string): string {
  return text.replace(/([\\`*_#[\]()])/g, '\\$1')
}

function nodeTitle(name: string, description: string): string {
  const label = escapeMdInline((name || '未命名').trim())
  const desc = (description || '').trim()
  if (!desc) return label
  const short = desc.length > 40 ? `${desc.slice(0, 37)}…` : desc
  return `${label}（${escapeMdInline(short)}）`
}

function renderHeadingLines(nodes: LearningTypeChartNode[], level: number): string[] {
  const headingLevel = Math.min(Math.max(level, 1), 6)
  const prefix = '#'.repeat(headingLevel)
  const lines: string[] = []
  for (const node of nodes) {
    lines.push(`${prefix} ${nodeTitle(node.name, node.value)}`)
    if (node.children.length > 0) {
      lines.push(...renderHeadingLines(node.children, headingLevel + 1))
    }
  }
  return lines
}

/** 将学习类型树转为 markmap 可渲染的 Markdown */
export function learningTypeTreeToMarkmap(nodes: LearningTypeChartNode[]): string {
  if (nodes.length === 0) {
    return '# 暂无学习类型\n\n请先创建父类或子类'
  }
  if (nodes.length === 1) {
    return renderHeadingLines(nodes, 1).join('\n\n')
  }
  return ['# 学习类型', '', ...renderHeadingLines(nodes, 2)].join('\n\n')
}

export function countLearningTypeChartNodes(nodes: LearningTypeChartNode[]): number {
  let count = 0
  const walk = (list: LearningTypeChartNode[]) => {
    list.forEach((node) => {
      count += 1
      if (node.children.length > 0) walk(node.children)
    })
  }
  walk(nodes)
  return count
}

/** 节点较多时默认少展开几层，避免初次渲染过挤 */
export function learningTypeMarkmapExpandLevel(nodeCount: number): number {
  if (nodeCount > 80) return 1
  if (nodeCount > 35) return 2
  return 3
}
