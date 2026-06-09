import { learningMenuItems } from '@/constants/learning-menu'

/**
 * 计入「今日网页学习时长」的顶栏菜单（不含学习分数、金钱消费、分数排名、设置等）。
 */
export const LEARNING_USAGE_MENU_KEYS = [
  'learning-type-edit',
  'question-bank',
  'question-bank-favorite',
  'answer-log',
  'wrong-book',
  'mindmap-viewer',
  'material-organize',
  'mental-math',
] as const

export type LearningUsageMenuKey = (typeof LEARNING_USAGE_MENU_KEYS)[number]

const keySet = new Set<string>(LEARNING_USAGE_MENU_KEYS)

export const LEARNING_USAGE_ROUTE_PATHS: string[] = learningMenuItems
  .filter((item) => keySet.has(item.key))
  .map((item) => item.path)

export function isLearningUsageRoute(path: string): boolean {
  const normalized = (path.split('?')[0] ?? path).split('#')[0] ?? path
  return LEARNING_USAGE_ROUTE_PATHS.includes(normalized)
}
