/** 选择题选项体例：保证 correct 与 distractors 形态一致，避免算式推导混入短答案项 */

export type McqOptionFormatKind =
  | 'hex_code'
  | 'plain_number'
  | 'formula'
  | 'short_phrase'
  | 'long_text'

export function normalizeMcqCompareText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/[「」""''《》、，,;；。.？?！!：:（）()]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase()
}

function normalizeCompare(text: string): string {
  return normalizeMcqCompareText(text)
}

/** 两选项是否相同或一方包含另一方（如「社会存在与社会意识」与「…谁决定谁」） */
export function areMcqTextsEquivalent(a: string, b: string): boolean {
  const na = normalizeCompare(a)
  const nb = normalizeCompare(b)
  if (!na || !nb) return na === nb
  if (na === nb) return true
  const shorter = na.length <= nb.length ? na : nb
  const longer = na.length <= nb.length ? nb : na
  if (shorter.length >= 4 && longer.includes(shorter)) return true
  return false
}

/** 选词填空：双空选项「词1/词2」形态 */
export function isClozePairedOption(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/[/／、]/.test(t)) return true
  return t.length >= 2 && t.length <= 24
}

function filterClozeDistractorList(distractors: string[], correct: string[]): string[] {
  const refs = correct.map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const d of distractors) {
    const t = d.trim()
    if (!t) continue
    const n = normalizeMcqCompareText(t)
    if ([...seen].some((s) => areMcqTextsEquivalent(s, t))) continue
    if (refs.some((c) => areMcqTextsEquivalent(c, t))) continue
    seen.add(n)
    out.push(t)
  }
  return out
}

/** 选词填空四选一：过滤重复干扰项 */
export function filterClozeDistractors(distractors: string[], correct: string[]): string[] {
  return filterClozeDistractorList(distractors, correct)
}

/** 选词填空四选一：选项不得重复或近乎相同 */
export function areClozeOptionsAllDistinct(correct: string[], distractors: string[]): boolean {
  const all = [...correct, ...distractors].map((s) => s.trim()).filter(Boolean)
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (areMcqTextsEquivalent(all[i]!, all[j]!)) return false
    }
  }
  return true
}

/** 单题 5 个选项之间不得重复或近乎相同 */
export function areMcqOptionsAllDistinct(correct: string[], distractors: string[]): boolean {
  const all = [...correct, ...distractors].map((s) => s.trim()).filter(Boolean)
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (areMcqTextsEquivalent(all[i]!, all[j]!)) return false
    }
  }
  return true
}

/** 判断选项属于哪类体例（用于五选一内部对齐） */
export function classifyMcqOptionFormat(text: string): McqOptionFormatKind {
  const s = text.trim()
  if (!s) return 'short_phrase'

  if (/[=＝]/.test(s) && /[+＋\-－×*÷/]/.test(s)) return 'formula'
  if (/[=＝]/.test(s) && /\d/.test(s) && s.length >= 6) return 'formula'

  const compact = s.replace(/\s/g, '')
  if (/^[0-9A-Fa-f]{2,8}H$/i.test(compact)) return 'hex_code'
  if (/^[0-9A-Fa-f]{4,8}$/i.test(compact) && /[A-Fa-f]/.test(compact)) return 'hex_code'

  if (/^-?\d+(\.\d+)?%?$/.test(compact)) return 'plain_number'

  if (s.length > 36 || /[。！？；]/.test(s)) return 'long_text'
  return 'short_phrase'
}

function referenceFormatKind(correct: string[]): McqOptionFormatKind {
  const kinds = correct.map(classifyMcqOptionFormat).filter(Boolean)
  if (kinds.length === 0) return 'short_phrase'
  const counts = new Map<McqOptionFormatKind, number>()
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1)
  let best = kinds[0]!
  let max = 0
  for (const [k, n] of counts) {
    if (n > max) {
      max = n
      best = k
    }
  }
  return best
}

/** 干扰项是否泄露正确答案（含「a+b=正确项」类推导） */
export function mcqDistractorRevealsAnswer(distractor: string, correct: string[]): boolean {
  const d = distractor.trim()
  if (!d) return true
  const normD = normalizeCompare(d)
  for (const ans of correct) {
    const normC = normalizeCompare(ans)
    if (!normC || normC.length < 3) continue
    if (normD.includes(normC)) return true
    if (/[=＝]/.test(d)) {
      const rhs = d.split(/[=＝]/).pop() ?? ''
      if (normalizeCompare(rhs).includes(normC)) return true
    }
  }
  return false
}

/** 选项体例是否与正确项一致 */
export function isMcqOptionFormatConsistent(option: string, correct: string[]): boolean {
  if (!correct.length) return true
  const ref = referenceFormatKind(correct)
  const kind = classifyMcqOptionFormat(option)
  if (kind === ref) return true
  if (ref === 'hex_code' && kind === 'plain_number') return false
  if (ref === 'plain_number' && kind === 'hex_code') return false
  return false
}

/** 从干扰项列表中剔除体例不一致或泄题的项 */
export function filterConsistentMcqDistractors(
  distractors: string[],
  correct: string[],
): string[] {
  const refs = correct.map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const d of distractors) {
    const t = d.trim()
    if (!t) continue
    const n = normalizeCompare(t)
    if ([...seen].some((s) => areMcqTextsEquivalent(s, t))) continue
    if (refs.some((c) => areMcqTextsEquivalent(c, t))) continue
    if (!isMcqOptionFormatConsistent(t, refs)) continue
    if (mcqDistractorRevealsAnswer(t, refs)) continue
    seen.add(n)
    out.push(t)
  }
  return out
}

type McqOptionCategoryKind =
  | 'media_taxonomy'
  | 'short_concrete'
  | 'numeric_with_unit'
  | 'plain_number'
  | 'other'

function classifyMcqOptionCategory(opt: string): McqOptionCategoryKind {
  const o = opt.trim()
  if (!o) return 'other'
  if (
    /\d/.test(o) &&
    /(B|KB|MB|GB|TB|Hz|kHz|MHz|bps|bit|字节|位)/i.test(o)
  ) {
    return 'numeric_with_unit'
  }
  if (/^-?\d+(\.\d+)?%?$/.test(o.replace(/\s/g, ''))) return 'plain_number'
  if (/^(感觉|表示|显示|存储|传输|表现|记录)媒体$/.test(o)) return 'media_taxonomy'
  if (/媒体$/.test(o) && o.length <= 8) return 'media_taxonomy'
  if (o.length <= 8 && !/媒体/.test(o)) return 'short_concrete'
  return 'other'
}

/** 是否存在「一项与另四项明显不同维度」导致一眼可辨 */
export function mcqOptionsHaveCategoryOutlier(
  correct: string[],
  distractors: string[],
): boolean {
  const all = [...correct, ...distractors].map((s) => s.trim()).filter(Boolean)
  if (all.length !== 5) return false
  const kinds = all.map(classifyMcqOptionCategory)
  const counts = new Map<McqOptionCategoryKind, number>()
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1)
  for (const n of counts.values()) {
    if (n === 1) return true
  }
  return false
}

/** 校验整题 5 选项是否体例统一（correct + distractors） */
export function mcqOptionsAreUniformlyFormatted(correct: string[], distractors: string[]): boolean {
  const all = [...correct, ...distractors].map((s) => s.trim()).filter(Boolean)
  if (all.length !== 5) return false
  const ref = referenceFormatKind(correct)
  return all.every((o) => classifyMcqOptionFormat(o) === ref)
}

export type McqBatchItem = {
  stem: string
  mode: 'single' | 'multiple'
  correct: string[]
  distractors: string[]
}

function mcqCorrectSignature(mcq: McqBatchItem): string {
  return [...mcq.correct]
    .map((s) => normalizeMcqCompareText(s))
    .filter(Boolean)
    .sort()
    .join('\u0001')
}

function mcqSharesCorrectAnswer(a: McqBatchItem, b: McqBatchItem): boolean {
  if (a.mode !== b.mode) return false
  if (a.mode === 'single' && a.correct.length === 1 && b.correct.length === 1) {
    return areMcqTextsEquivalent(a.correct[0]!, b.correct[0]!)
  }
  return mcqCorrectSignature(a) === mcqCorrectSignature(b)
}

/** 同批 AI 题：去掉正确项相同或近乎相同的重复题 */
export function dedupeMcqsByCorrectAnswer<T extends McqBatchItem>(mcqs: T[]): T[] {
  const out: T[] = []
  const seenStems = new Set<string>()
  for (const mcq of mcqs) {
    const stemKey = normalizeMcqCompareText(mcq.stem)
    if (stemKey && seenStems.has(stemKey)) continue
    if (out.some((prev) => mcqSharesCorrectAnswer(prev, mcq))) continue
    out.push(mcq)
    if (stemKey) seenStems.add(stemKey)
  }
  return out
}
