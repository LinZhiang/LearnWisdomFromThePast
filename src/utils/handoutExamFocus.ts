/** 从讲义 Markdown「考情速览 / 本节考情说明」提取命题导向，供 AI 定制测验题 */

export type HandoutExamFocus = {
  frequency?: string
  memorizationIndex?: string
  understandingIndex?: string
  highFrequencyPoints?: string
  examCharacteristics?: string
  /** 考情贴士：结合热点、案例、命题风格等操作性提示 */
  examTips?: string
}

const EXAM_FOCUS_SECTION_HEADINGS = [
  /^#{1,4}\s*(?:考情速览|本节考情说明|考情说明)[^\n]*$/im,
  /^(?:\*\*)?(?:考情速览|本节考情说明|考情说明)(?:\*\*)?\s*$/im,
]

const FIELD_PATTERNS: { key: keyof HandoutExamFocus; labels: string[]; multiline?: boolean }[] =
  [
    { key: 'frequency', labels: ['考查频率', '考试频率', '出题频率'] },
    { key: 'memorizationIndex', labels: ['识记指数', '记忆指数', '背诵指数'] },
    { key: 'understandingIndex', labels: ['理解指数', '难度指数', '理解难度'] },
    { key: 'highFrequencyPoints', labels: ['高频考点', '重点考点', '常考考点'] },
    {
      key: 'examCharacteristics',
      labels: ['考查特点', '考试特点', '命题特点', '出题特点'],
    },
    {
      key: 'examTips',
      labels: ['考情贴士', '命题贴士', '出题贴士', '备考贴士'],
      multiline: true,
    },
  ]

const OTHER_FIELD_LABELS = FIELD_PATTERNS.flatMap((f) => f.labels)
  .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`/g, '')
    .trim()
}

function sliceExamFocusSection(raw: string): string {
  for (const re of EXAM_FOCUS_SECTION_HEADINGS) {
    const match = raw.match(re)
    if (!match || match.index == null) continue
    const afterHeading = raw.slice(match.index + match[0].length)
    const nextSection = afterHeading.match(/^#{1,3}\s+\S/im)
    const block =
      nextSection?.index != null && nextSection.index > 0
        ? afterHeading.slice(0, nextSection.index)
        : afterHeading.slice(0, 3000)
    if (block.trim()) return block.trim()
  }
  return ''
}

function pickFieldValue(source: string, labels: string[], multiline = false): string | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (multiline) {
      const re = new RegExp(
        `(?:^|\\n)\\s*(?:[-*+]\\s*)?(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*[：:]\\s*([\\s\\S]*?)(?=\\n\\s*(?:[-*+]\\s*)?(?:\\*\\*)?(?:${OTHER_FIELD_LABELS})(?:\\*\\*)?\\s*[：:]|\\n#{1,3}\\s|$)`,
        'i',
      )
      const hit = source.match(re)
      const value = hit?.[1]?.replace(/\s+/g, ' ').trim()
      if (value) return stripMarkdownInline(value)
    } else {
      const re = new RegExp(
        `(?:^|\\n)\\s*(?:[-*+]\\s*)?(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*[：:]\\s*([^\\n]+)`,
        'i',
      )
      const hit = source.match(re)
      const value = hit?.[1]?.trim()
      if (value) return stripMarkdownInline(value)
    }
  }
  return undefined
}

function hasAnyExamFocusField(focus: HandoutExamFocus): boolean {
  return Boolean(
    focus.frequency ||
      focus.memorizationIndex ||
      focus.understandingIndex ||
      focus.highFrequencyPoints ||
      focus.examCharacteristics ||
      focus.examTips,
  )
}

/** 解析讲义中的考情说明；无有效字段时返回 null */
export function extractHandoutExamFocus(raw: string): HandoutExamFocus | null {
  const text = (raw ?? '').trim()
  if (!text) return null

  const section = sliceExamFocusSection(text)
  const scanSources = section ? [section, text.slice(0, 5000)] : [text.slice(0, 5000)]

  const focus: HandoutExamFocus = {}
  for (const { key, labels, multiline } of FIELD_PATTERNS) {
    for (const source of scanSources) {
      const value = pickFieldValue(source, labels, multiline)
      if (value) {
        focus[key] = value
        break
      }
    }
  }

  if (!hasAnyExamFocusField(focus)) return null
  return focus
}

export const AI_HANDOUT_EXAM_FOCUS_QUIZ_RULES_INTRO = `**考情说明 · 命题导向（必须结合讲义遵守）**：
讲义「考情速览 / 本节考情说明」概括了考试规律与**考情贴士**。除依据正文 **加粗考点** 外，须按下列考情**定制题干形态、能力层次与覆盖面**；**考情贴士与考查特点须落实到题目**，勿出与之相悖的偏题。`

export function formatHandoutExamFocusQuizRulesBlock(focus: HandoutExamFocus): string {
  const lines: string[] = [AI_HANDOUT_EXAM_FOCUS_QUIZ_RULES_INTRO, '']

  if (focus.frequency) {
    lines.push(
      `- **考查频率**：${focus.frequency}（频率高的方向应多出题、多换情境；频率低的少出或不出）`,
    )
  }
  if (focus.memorizationIndex) {
    lines.push(
      `- **识记指数**：${focus.memorizationIndex}（指数偏高时适当增加对规范提法、关键表述的识记考查；偏低时减少纯背诵）`,
    )
  }
  if (focus.understandingIndex) {
    lines.push(
      `- **理解指数**：${focus.understandingIndex}（指数偏高时增加辨析、易混点与迁移；偏低时可适当增加识记类，但仍须符合考查特点/贴士）`,
    )
  }
  if (focus.highFrequencyPoints) {
    lines.push(
      `- **高频考点**：${focus.highFrequencyPoints}（本批题目应**优先、分散覆盖**这些方向，不要漏掉核心高频点）`,
    )
  }
  if (focus.examCharacteristics) {
    lines.push(`- **考查特点**：${focus.examCharacteristics}`)
    lines.push(
      '  → 据此决定题干用案例/情境还是概念直问；考查「理解运用」还是「识记」；是否避免死记硬背原文。',
    )
  }
  if (focus.examTips) {
    lines.push(`- **考情贴士（须落实）**：${focus.examTips}`)
    lines.push(
      '  → 按贴士调整命题：若写明结合政策热点/最新讲话/时事背景，适量题目须用近半年至一年内公开热点作题干情境；若写明结合生活案例，则多用小案例；本批题目应能明显看出已落实该贴士。',
    )
  }

  return lines.join('\n')
}

/** 讲义含考情说明时，在 AI 用户提示末尾追加定制命题规则 */
export function appendHandoutExamFocusQuizRules(
  baseUser: string,
  rawMarkdown: string,
): string {
  const focus = extractHandoutExamFocus(rawMarkdown)
  if (!focus) return baseUser
  return `${baseUser}\n\n${formatHandoutExamFocusQuizRulesBlock(focus)}`
}
