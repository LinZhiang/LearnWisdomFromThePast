/** 标题行首序号：1. / 六、 / （一） / 第几章 等 */
const HEADING_NUMBER_PREFIX =
  /^(?:第?\s*[一二三四五六七八九十百千万\d]+\s*[、.．.)）\s]+|\d+\s*[.、．.)）\s]+|[（(]\s*[一二三四五六七八九十\d]+\s*[）)]\s*)/u

/** 去掉标题中的序号与加粗标记 */
export function stripHeadingNumberPrefix(title: string): string {
  let s = title.replace(/\*\*/g, '').trim()
  for (let i = 0; i < 4; i += 1) {
    const next = s.replace(HEADING_NUMBER_PREFIX, '').trim()
    if (next === s) break
    s = next
  }
  return s.trim() || title.trim()
}

/** 从材料开头提取全书总标题（仅用于识别，不宜作分段导图根节点） */
export function extractLeadingThemeFromSource(text: string): string | null {
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    if (/^#(?!#)\s+/.test(t)) return t
    if (/^##(?!#)\s+/.test(t)) {
      const title = stripHeadingNumberPrefix(t.replace(/^##\s+/, ''))
      return title ? `# ${title}` : null
    }
    return null
  }
  return null
}

function cleanHeadingLine(line: string): string {
  const m = line.match(/^(#{1,6})\s+(.+)$/)
  if (!m) return line
  return `${m[1]} ${stripHeadingNumberPrefix(m[2])}`
}

/** 导图 Markdown 中首个一级标题的纯文本（已去序号） */
export function extractMarkdownH1Title(markdown: string): string | null {
  for (const line of markdown.split('\n')) {
    const t = line.trim()
    const m = t.match(/^#\s+(.+)$/)
    if (m) {
      return stripHeadingNumberPrefix(m[1]) || null
    }
  }
  return null
}

/** 导图 Markdown 中所有二级标题（已去序号） */
export function extractMarkdownH2Titles(markdown: string): string[] {
  const titles: string[] = []
  for (const line of markdown.split('\n')) {
    const t = line.trim()
    const m = t.match(/^##\s+(.+)$/)
    if (m) {
      const title = stripHeadingNumberPrefix(m[1])
      if (title) titles.push(title)
    }
  }
  return titles
}

/** 是否为「仅时期/阶段」类大标题（宜改成本段概括主题） */
export function isPeriodOnlyTitle(title: string): boolean {
  const t = stripHeadingNumberPrefix(title)
  if (/\d{4}\s*[—\-~至]\s*(至今|\d{4})/.test(t)) return true
  if (
    /^(?:中国)?特色社会主义新时代|^改革开放新时期|^社会主义革命与建设|^党的创建与早期革命/.test(
      t,
    ) &&
    t.length <= 28
  ) {
    return true
  }
  if (/新时代|新时期|历史阶段|历史时期/.test(t) && t.length <= 22) return true
  return false
}

function findLongestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return ''
  let prefix = strings[0]!
  for (const s of strings.slice(1)) {
    while (prefix && !s.startsWith(prefix)) {
      prefix = prefix.slice(0, -1)
    }
    if (!prefix) break
  }
  return prefix
}

/**
 * 根据本段若干 `##` 标题归纳一句概括性根主题（6～18 字为宜）。
 */
export function buildGeneralSegmentTheme(
  h2Titles: string[],
  segmentThemeHint?: string | null,
): string {
  const cleaned = h2Titles.map(stripHeadingNumberPrefix).filter(Boolean)
  if (segmentThemeHint) {
    const hint = stripHeadingNumberPrefix(segmentThemeHint)
    if (hint && !hint.includes('、') && hint.length <= 20 && !isPeriodOnlyTitle(hint)) {
      return hint
    }
  }
  if (cleaned.length === 0) {
    return stripHeadingNumberPrefix(segmentThemeHint ?? '') || '本段要点'
  }
  if (cleaned.length === 1) {
    const one = cleaned[0]!
    return one.length <= 18 ? one : `${one.slice(0, 16)}…`
  }

  const prefixes = cleaned.map((t) => t.replace(/[与和及].+$/, '').slice(0, 10))
  const common = findLongestCommonPrefix(prefixes)
  if (common.length >= 2) {
    const base = `${common}核心要点`
    return base.length <= 18 ? base : base.slice(0, 18)
  }

  if (cleaned.every((t) => /新时代|中国特色社会主义/.test(t))) {
    return '新时代核心要点'
  }

  const first = cleaned[0]!
  if (first.length <= 14) return `${first}等要点`
  return `${first.slice(0, 12)}等要点`
}

/** 下载 txt 用的安全文件名（不含扩展名） */
export function sanitizeTxtFilename(title: string): string {
  const s = stripHeadingNumberPrefix(title)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
  return s || '思维导图'
}

/**
 * 根据本段原文推断本段概括主题（去序号，优先板块而非全书总名）。
 */
export function inferSegmentThemeFromSource(
  partText: string,
  documentThemeTitle?: string | null,
): string | null {
  const h2s: string[] = []
  let partH1: string | null = null
  const doc = documentThemeTitle ? stripHeadingNumberPrefix(documentThemeTitle) : null

  for (const line of partText.split('\n')) {
    const t = line.trim()
    if (!t) continue
    if (/^#(?!#)\s+/.test(t)) {
      const title = stripHeadingNumberPrefix(t.replace(/^#\s+/, ''))
      if (doc && title === doc) continue
      if (!isPeriodOnlyTitle(title)) partH1 = title
      else partH1 = null
      continue
    }
    const m = t.match(/^##\s+(.+)$/)
    if (m) {
      const title = stripHeadingNumberPrefix(m[1])
      if (title) h2s.push(title)
    }
  }

  if (h2s.length > 0) return buildGeneralSegmentTheme(h2s, partH1)
  return partH1
}

/**
 * 本段导图用于展示 / 下载的主题名。
 */
export function extractSegmentThemeTitle(
  markdown: string,
  documentThemeTitle?: string | null,
): string | null {
  const h1 = extractMarkdownH1Title(markdown)
  const h2s = extractMarkdownH2Titles(markdown)
  const doc = documentThemeTitle ? stripHeadingNumberPrefix(documentThemeTitle) : null

  if (!h1 && h2s.length > 0) return buildGeneralSegmentTheme(h2s)
  if (h1 && doc && h1 === doc && h2s.length > 0) {
    return buildGeneralSegmentTheme(h2s)
  }
  if (h1 && isPeriodOnlyTitle(h1) && h2s.length > 0) {
    return buildGeneralSegmentTheme(h2s, h1)
  }
  if (h1) return h1
  if (h2s.length > 0) return buildGeneralSegmentTheme(h2s)
  return null
}

export type NormalizeSegmentMindmapOptions = {
  documentThemeTitle?: string | null
  segmentThemeHint?: string | null
}

/** 导图单条分支可见文字上限（汉字计） */
export const MINDMAP_BRANCH_MAX_CHARS = 40

/** 统计可见字符数（去掉 Markdown 加粗符） */
export function countVisibleChars(text: string): number {
  return [...text.replace(/\*\*/g, '').trim()].length
}

function chunkByDelimiters(text: string, maxChars: number): string[] {
  const t = text.trim()
  if (!t) return []
  if (countVisibleChars(t) <= maxChars) return [t]

  for (const delim of ['；', ';', '，', ','] as const) {
    if (!t.includes(delim)) continue
    const parts = t.split(delim).map((p) => p.trim()).filter(Boolean)
    if (parts.length <= 1) continue

    const merged: string[] = []
    let buf = ''
    for (const p of parts) {
      const next = buf ? `${buf}${delim}${p}` : p
      if (countVisibleChars(next) <= maxChars) {
        buf = next
        continue
      }
      if (buf) merged.push(...chunkByDelimiters(buf, maxChars))
      buf = p
    }
    if (buf) merged.push(...chunkByDelimiters(buf, maxChars))
    if (merged.length > 0) return merged
  }

  const chars = [...t]
  const chunks: string[] = []
  let buf = ''
  for (const ch of chars) {
    const next = buf + ch
    if (countVisibleChars(next) > maxChars && buf) {
      chunks.push(buf)
      buf = ch
    } else {
      buf = next
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks.length > 0 ? chunks : [t.slice(0, maxChars)]
}

function parseListItemContent(content: string): {
  label: string
  formal: string
  tongsu: string | null
} {
  let label = ''
  let formal = content

  const labelMatch = content.match(/^(\*\*[^*]+?\*\*(?:\s*🇨🇳)?[：:])\s*(.*)$/s)
  if (labelMatch) {
    label = labelMatch[1]
    formal = labelMatch[2]
  } else if (/^例\s*🇨🇳[：:]/i.test(content)) {
    const em = content.match(/^(例\s*🇨🇳[：:])\s*(.*)$/s)
    if (em) {
      label = em[1]
      formal = em[2]
    }
  } else if (/^通俗[：:]/.test(content.trim())) {
    return { label: '', formal: '', tongsu: content.trim() }
  }

  let tongsu: string | null = null
  const tsInFormal = formal.match(/(.+?)(?:[。；]\s*)?(通俗[：:]\s*.+)$/s)
  if (tsInFormal) {
    formal = tsInFormal[1].trim().replace(/[。；]\s*$/, '')
    tongsu = tsInFormal[2].trim().replace(/^通俗[：:]\s*/, '')
  }

  return { label, formal: formal.trim(), tongsu }
}

function expandListItemLine(content: string, baseIndent: string): string[] {
  const childIndent = `${baseIndent}  `
  const { label, formal, tongsu } = parseListItemContent(content)

  if (!label && tongsu) {
    const body = tongsu.replace(/^通俗[：:]\s*/, '')
    return chunkByDelimiters(body, MINDMAP_BRANCH_MAX_CHARS - 3).map(
      (c) => `${baseIndent}- 通俗：${c}`,
    )
  }

  const labelLen = countVisibleChars(label)
  const budget = Math.max(12, MINDMAP_BRANCH_MAX_CHARS - labelLen)
  const formalChunks = chunkByDelimiters(formal, budget)
  const lines: string[] = []

  if (formalChunks.length === 0 && !tongsu) {
    return [`${baseIndent}- ${content}`]
  }

  formalChunks.forEach((chunk, i) => {
    if (i === 0) lines.push(`${baseIndent}- ${label}${chunk}`)
    else lines.push(`${childIndent}- ${chunk}`)
  })

  if (tongsu) {
    const tongsuChunks = chunkByDelimiters(tongsu, MINDMAP_BRANCH_MAX_CHARS - 3)
    for (const tc of tongsuChunks) {
      lines.push(`${childIndent}- 通俗：${tc}`)
    }
  }

  return lines
}

/**
 * 将超长列表项拆成多条短分支（≤40 字），正式与「通俗」分列。
 */
export function splitLongMindmapBranches(markdown: string): string {
  const lines = markdown.split('\n')
  const out: string[] = []

  for (const line of lines) {
    const m = line.match(/^(\s*)- (.+)$/)
    if (!m) {
      out.push(line)
      continue
    }
    const expanded = expandListItemLine(m[2], m[1])
    const hasInlineTongsu =
      /^\*\*[^*]+\*\*[\s\S]*通俗[：:]/u.test(m[2]) ||
      /^例\s*🇨🇳[\s\S]*通俗[：:]/iu.test(m[2])
    const tooLong = countVisibleChars(m[2]) > MINDMAP_BRANCH_MAX_CHARS
    if (tooLong || hasInlineTongsu || expanded.length > 1) out.push(...expanded)
    else out.push(line)
  }

  return out.join('\n')
}

const GROUP_READING_ORDER = [
  '时代背景',
  '会议概况',
  '任务与方略',
  '组织与影响',
  '历史意义',
  '要点讲解',
  '记忆举例',
]

function inferListItemCategory(firstListLine: string): string {
  const t = firstListLine
  if (/\*\*历史背景\*\*|历史背景/.test(t)) return '时代背景'
  if (/\*\*是什么\*\*|是什么/.test(t)) return '会议概况'
  if (/\*\*为什么\*\*|为什么/.test(t)) return '时代背景'
  if (
    /\*\*(核心任务|中心任务|奋斗目标|最高纲领|最低纲领|策略方针|基本路线|纲领)\*\*/.test(t) ||
    /核心任务|中心任务|最高纲领|最低纲领/.test(t)
  ) {
    return '任务与方略'
  }
  if (/\*\*(选举|组织|领导|人事)\*\*|选举|组织/.test(t)) return '组织与影响'
  if (/\*\*意义\*\*|意义|影响/.test(t)) return '历史意义'
  if (/例\s*🇨🇳|例\s*CN/i.test(t)) return '组织与影响'
  return '要点讲解'
}

function mergeCategoryGroups(
  groups: Map<string, { lines: string[] }[]>,
): { title: string; items: { lines: string[] }[] }[] {
  let entries = [...groups.entries()].map(([title, items]) => ({ title, items }))

  const pick = (name: string) => entries.find((e) => e.title === name)
  const mem = pick('记忆举例')
  if (mem) {
    const org = pick('组织与影响') ?? pick('组织与人事')
    if (org) {
      org.items.push(...mem.items)
      entries = entries.filter((e) => e !== mem)
    } else {
      mem.title = '组织与影响'
    }
  }

  const yi = pick('历史意义')
  if (yi && entries.length > 4) {
    const org = pick('组织与影响')
    if (org) {
      org.items.push(...yi.items)
      entries = entries.filter((e) => e !== yi)
    }
  }

  while (entries.length > 4) {
    entries.sort((a, b) => a.items.length - b.items.length)
    const a = entries[0]!
    const b = entries[1]!
    b.items.push(...a.items)
    const mergedTitle =
      GROUP_READING_ORDER.includes(b.title) ? b.title : `${a.title}·${b.title}`.slice(0, 14)
    b.title = mergedTitle
    entries.shift()
  }

  entries.sort(
    (a, b) =>
      (GROUP_READING_ORDER.indexOf(a.title) + 1 || 99) -
      (GROUP_READING_ORDER.indexOf(b.title) + 1 || 99),
  )
  return entries
}

function parseTopLevelListBlocks(block: string[]): { lines: string[] }[] | null {
  const listLines = block.filter((l) => /^(\s*)- /.test(l))
  if (listLines.length === 0) return null

  const minIndent = Math.min(
    ...listLines.map((l) => l.match(/^(\s*)/)?.[1]?.length ?? 0),
  )

  const items: { lines: string[] }[] = []
  let cur: string[] = []

  for (const line of block) {
    const m = line.match(/^(\s*)- /)
    if (m && m[1].length === minIndent) {
      if (cur.length) items.push({ lines: cur })
      cur = [line]
    } else if (cur.length) {
      cur.push(line)
    } else if (line.trim() === '') {
      if (items.length) items[items.length - 1]!.lines.push(line)
    }
  }
  if (cur.length) items.push({ lines: cur })
  return items.length > 0 ? items : null
}

function emitGroupedListBlocks(
  items: { lines: string[] }[],
  subPrefix: '####' | '#####',
): string[] {
  const groups = new Map<string, { lines: string[] }[]>()
  for (const item of items) {
    const head = item.lines.find((l) => /^(\s*)- /.test(l)) ?? ''
    const cat = inferListItemCategory(head)
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(item)
  }

  const merged = mergeCategoryGroups(groups)
  const out: string[] = []
  for (const g of merged) {
    out.push(`${subPrefix} ${g.title}`)
    for (const item of g.items) {
      out.push(...item.lines)
    }
  }
  return out
}

function regroupH4Sections(block: string[]): string[] {
  const sections: { title: string; lines: string[] }[] = []
  let orphan: string[] = []
  let current: { title: string; lines: string[] } | null = null

  for (const line of block) {
    const h4 = line.match(/^####\s+(.+)$/)
    if (h4) {
      if (current) sections.push(current)
      current = { title: stripHeadingNumberPrefix(h4[1]), lines: [] }
      continue
    }
    if (current) current.lines.push(line)
    else orphan.push(line)
  }
  if (current) sections.push(current)

  if (sections.length <= 4) return block

  const groups = new Map<string, { lines: string[] }[]>()
  for (const sec of sections) {
    const cat = GROUP_READING_ORDER.includes(sec.title)
      ? sec.title
      : inferListItemCategory(`**${sec.title}**`)
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push({ lines: sec.lines })
  }

  const merged = mergeCategoryGroups(groups)
  const out: string[] = [...orphan]
  for (const g of merged) {
    out.push(`#### ${g.title}`)
    for (const item of g.items) {
      out.push(...item.lines)
    }
  }
  return out
}

function regroupSectionBlock(block: string[], headingLevel: number): string[] {
  if (block.length === 0) return block

  const hasH4 = block.some((l) => /^####\s+/.test(l))
  if (hasH4) {
    const regrouped = regroupH4Sections(block)
    if (regrouped !== block) return regrouped
    return block
  }

  const items = parseTopLevelListBlocks(block)
  if (!items || items.length <= 4) return block

  const subPrefix = headingLevel >= 3 ? '####' : '#####'
  return emitGroupedListBlocks(items, subPrefix)
}

/**
 * 同一标题下并列子分支超过 4 条时，用 #### 归纳分组。
 */
export function groupExcessMindmapBranches(markdown: string): string {
  const lines = markdown.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!
    const hm = line.match(/^(#{1,4})\s+/)
    if (!hm) {
      out.push(line)
      i += 1
      continue
    }

    const level = hm[1].length
    out.push(line)
    i += 1

    const block: string[] = []
    while (i < lines.length) {
      const next = lines[i]!
      const nh = next.match(/^(#{1,4})\s+/)
      if (nh && nh[1].length <= level) break
      block.push(next)
      i += 1
    }

    if (level >= 3) out.push(...regroupSectionBlock(block, level))
    else out.push(...block)
  }

  return out.join('\n')
}

/**
 * 规范化导图 Markdown：去标题序号、保证文首有概括性 `#`、修正空泛时期根节点。
 */
export function normalizeSegmentMindmapMarkdown(
  markdown: string,
  options?: NormalizeSegmentMindmapOptions,
): string {
  const doc = options?.documentThemeTitle
    ? stripHeadingNumberPrefix(options.documentThemeTitle)
    : null
  const hint = options?.segmentThemeHint
    ? stripHeadingNumberPrefix(options.segmentThemeHint)
    : null

  let lines = markdown
    .trim()
    .split('\n')
    .map((line) => cleanHeadingLine(line))
  let md = lines.join('\n').trim()

  let h1 = extractMarkdownH1Title(md)
  let h2s = extractMarkdownH2Titles(md)

  let firstLine = ''
  for (const line of md.split('\n')) {
    const t = line.trim()
    if (t) {
      firstLine = t
      break
    }
  }
  const startsWithH2 = /^##\s+/.test(firstLine)

  if (!h1 && (startsWithH2 || h2s.length > 0)) {
    const root = buildGeneralSegmentTheme(h2s, hint)
    md = `# ${root}\n\n${md}`
    h1 = root
    h2s = extractMarkdownH2Titles(md)
  } else if (!h1) {
    const root = hint || '本段要点'
    md = `# ${root}\n\n${md}`
    h1 = root
  }

  const needsBetterRoot =
    h1 &&
    h2s.length > 0 &&
    ((doc && h1 === doc) || isPeriodOnlyTitle(h1) || (hint && h1 === hint && h2s.length >= 2))

  if (needsBetterRoot) {
    const root = buildGeneralSegmentTheme(h2s, hint)
    md = md.replace(/^#\s+.+$/m, `# ${root}`)
    h1 = root
  } else if (h1) {
    const stripped = stripHeadingNumberPrefix(h1)
    if (stripped !== h1) md = md.replace(/^#\s+.+$/m, `# ${stripped}`)
  }

  lines = md.split('\n').map((line) => cleanHeadingLine(line))
  md = lines.join('\n').trim()
  md = splitLongMindmapBranches(md)
  return groupExcessMindmapBranches(md)
}

/** @deprecated 使用 normalizeSegmentMindmapMarkdown */
export function promoteSegmentRootTheme(
  markdown: string,
  documentThemeTitle?: string | null,
): string {
  return normalizeSegmentMindmapMarkdown(markdown, { documentThemeTitle })
}
