/** 关键字追问：从长材料中优先保留与学员提问相关的片段，避免截断导致 AI 误判「材料未提及」 */

const SNIPPET_RADIUS = 520
const HEAD_CHARS = 2800

const MAX_TERM_FOR_SPAN_MATCH = 48

/** 从连续中文里提取 2~6 字子串，便于命中「补码」「原码」等术语 */
function addChineseSubterms(text: string, terms: Set<string>): void {
  for (const run of text.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (run.length <= 8) terms.add(run)
    const maxLen = Math.min(6, run.length)
    for (let len = 2; len <= maxLen; len += 1) {
      for (let i = 0; i + len <= run.length; i += 1) {
        terms.add(run.slice(i, i + len))
      }
    }
  }
}

/** 从学员追问中提取检索词（含英文缩写、中文术语、引号内短语） */
export function extractKeywordFollowupTerms(query: string): string[] {
  const q = query.trim()
  if (!q) return []
  const terms = new Set<string>()
  for (const m of q.matchAll(/[A-Za-z][A-Za-z0-9]{1,}/g)) {
    terms.add(m[0]!)
  }
  for (const seg of q.split(/[\s、，,;；/／和与及？?！!。.]+/)) {
    const s = seg.trim()
    if (s.length >= 2 && s.length <= MAX_TERM_FOR_SPAN_MATCH) terms.add(s)
  }
  addChineseSubterms(q, terms)
  for (const m of q.matchAll(/[「『"《]([^」』"》]{2,24})[」』"》]/g)) {
    const inner = m[1]?.trim()
    if (inner && inner.length >= 2) terms.add(inner)
  }
  for (const m of q.matchAll(/\(?[01]{4,}\)?\s*2/g)) {
    terms.add(m[0]!.replace(/\s+/g, ''))
  }
  return [...terms]
    .filter((t) => t.length >= 2 && t.length <= MAX_TERM_FOR_SPAN_MATCH)
    .sort((a, b) => b.length - a.length)
}

/** 优先保留在材料中确实出现过的检索词，避免整句追问无法命中 */
function termsMatchingMaterial(text: string, terms: string[]): string[] {
  const hits = terms.filter((term) => findTermSpans(text, term).length > 0)
  return hits.length > 0 ? hits : terms.filter((t) => t.length <= 24)
}

type Span = { start: number; end: number }

function mergeSpans(spans: Span[]): Span[] {
  if (spans.length === 0) return []
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const out: Span[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.start <= last.end + 80) {
      last.end = Math.max(last.end, cur.end)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

function findTermSpans(text: string, term: string): Span[] {
  const spans: Span[] = []
  if (!term) return spans
  const isLatin = /^[A-Za-z0-9]+$/.test(term)
  const needle = isLatin ? term.toLowerCase() : term
  const hay = isLatin ? text.toLowerCase() : text
  let from = 0
  while (from < hay.length) {
    const idx = hay.indexOf(needle, from)
    if (idx === -1) break
    spans.push({
      start: Math.max(0, idx - SNIPPET_RADIUS),
      end: Math.min(text.length, idx + term.length + SNIPPET_RADIUS),
    })
    from = idx + Math.max(1, term.length)
  }
  return spans
}

function sliceWithEllipsis(text: string, start: number, end: number): string {
  const chunk = text.slice(start, end).trim()
  if (!chunk) return ''
  const lead = start > 0 ? '…' : ''
  const trail = end < text.length ? '…' : ''
  return `${lead}${chunk}${trail}`
}

/**
 * 材料过长时：保留文首概要 + 所有与追问词相关的上下文片段（合并重叠区间）。
 */
export function buildKeywordFollowupMaterial(
  fullText: string,
  userQuery: string,
  maxLen: number,
): string {
  const text = fullText.trim()
  if (!text) return ''
  if (text.length <= maxLen) return text

  const terms = termsMatchingMaterial(text, extractKeywordFollowupTerms(userQuery))
  let spans: Span[] = []
  for (const term of terms) {
    spans.push(...findTermSpans(text, term))
  }
  spans = mergeSpans(spans)

  const parts: string[] = []
  const head = text.slice(0, Math.min(HEAD_CHARS, text.length)).trim()
  if (head) {
    parts.push(head.length < text.length ? `${head}\n\n…（文首节选，后文见相关片段）` : head)
  }

  if (spans.length > 0) {
    parts.push('【与学员追问相关的材料片段】')
    for (let i = 0; i < spans.length; i += 1) {
      const s = spans[i]!
      parts.push(`--- 片段 ${i + 1} ---\n${sliceWithEllipsis(text, s.start, s.end)}`)
    }
  } else {
    parts.push(text.slice(0, maxLen - 40).trim())
    parts.push('…（后文已省略；未在材料前段匹配到追问关键词，请结合已给文首作答）')
  }

  let out = parts.join('\n\n')
  if (out.length > maxLen) {
    out = `${out.slice(0, maxLen - 24)}\n\n…（为控制长度已截断）`
  }
  return out
}
