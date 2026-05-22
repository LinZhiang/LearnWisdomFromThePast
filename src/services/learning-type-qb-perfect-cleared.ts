const STORAGE_KEY = 'learning-type-qb-perfect-cleared-v1'

export const LEARNING_TYPE_QB_PERFECT_CLEARED_CHANGED = 'learning-type-qb-perfect-cleared-changed'

function parseIds(raw: string | null): number[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => Number(x))
      .filter((n) => Number.isInteger(n) && n > 0)
  } catch {
    return []
  }
}

export function loadPerfectClearedLearningTypeIds(): number[] {
  return parseIds(
    typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
  )
}

export function isLearningTypeQbPerfectCleared(learningTypeId: number): boolean {
  if (!Number.isInteger(learningTypeId) || learningTypeId <= 0) return false
  return loadPerfectClearedLearningTypeIds().includes(learningTypeId)
}

export function markLearningTypeQbPerfectCleared(learningTypeId: number): void {
  if (!Number.isInteger(learningTypeId) || learningTypeId <= 0) return
  const set = new Set(loadPerfectClearedLearningTypeIds())
  if (set.has(learningTypeId)) return
  set.add(learningTypeId)
  const next = [...set].sort((a, b) => a - b)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEARNING_TYPE_QB_PERFECT_CLEARED_CHANGED))
  }
}
