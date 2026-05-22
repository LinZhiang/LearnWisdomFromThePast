/** Fisher–Yates 洗牌，返回新数组 */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = arr[i]!
    arr[i] = arr[j]!
    arr[j] = t
  }
  return arr
}

/**
 * 选择题判分：任一错误选项入选 → 0；
 * 所选均为正确且与正确集合完全一致 → 满分；
 * 否则（未选错但未选全，含全未选）→ 一半分。
 */
export function scoreMcqSelection(
  correctIndices: readonly number[],
  selectedIndices: readonly number[],
  maxScore: number,
): number {
  if (maxScore <= 0) return 0
  const c = new Set(correctIndices)
  const s = new Set(selectedIndices)
  for (const i of s) {
    if (!c.has(i)) return 0
  }
  if (s.size === c.size && c.size > 0 && [...c].every((i) => s.has(i))) {
    return maxScore
  }
  return maxScore / 2
}
