/**
 * 将长文按份数拆成若干段（尽量在段落边界切分），供分批生成思维导图。
 */
export function splitSourceTextIntoParts(text: string, partCount: number): string[] {
  const raw = text.trim()
  if (!raw) return []
  const n = Math.max(1, Math.round(partCount) || 1)
  if (n <= 1) return [raw]

  const len = raw.length
  const chunkSize = Math.ceil(len / n)
  const parts: string[] = []
  let start = 0

  for (let i = 0; i < n; i += 1) {
    if (start >= len) break

    let end = i === n - 1 ? len : Math.min(len, start + chunkSize)
    if (i < n - 1 && end < len) {
      const slice = raw.slice(start, end)
      const lastBreak = slice.lastIndexOf('\n\n')
      if (lastBreak > Math.floor(chunkSize * 0.35)) {
        end = start + lastBreak
      }
    }

    const chunk = raw.slice(start, end).trim()
    if (chunk) parts.push(chunk)

    start = end
    while (start < len && /\s/.test(raw[start] ?? '')) start += 1
  }

  if (parts.length === 0) return [raw]
  if (parts.length < n && parts.length === 1) return [raw]
  return parts
}
