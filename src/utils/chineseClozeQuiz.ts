/** 语文「选词填空 / 逻辑填空」类讲义：定制 AI 测验题形态与逻辑关系考点 */

const STRONG_TITLE_RE =
  /选词填空|逻辑填空|言语理解|言语表达|成语辨析|实词辨析|分析题干|填空题|逻辑关系/

const CONTENT_KEYWORDS = [
  '选词填空',
  '逻辑填空',
  '解释说明',
  '相反相对',
  '并举',
  '递进',
  '转折',
  '因果',
  '并列',
  '画横线',
  '填入横线',
  '填入画横线',
  '最恰当的一项',
  '成语',
  '实词',
  '关联词',
  '标志信息',
  '逻辑关系',
  '语境',
  '横线处',
  '言语理解',
  '言语表达',
] as const

export const AI_CHINESE_CLOZE_QUIZ_RULES = `**语文选词填空 / 逻辑填空（材料属此类时必须遵守）**：

**题型形态（与公考/事业单位经典真题一致）**：
- 每题为**单道选词填空**：一段带 **1～2 个空** 的题干（空位用 **____** 或 **______** 表示），句末须有「填入画横线部分最恰当的一项是（  ）」或同义表述。
- **共 4 个选项**（A～D 形态）：layout 必须为 **cloze-four**；correct 长度 **1**，distractors 长度 **3**（合计 4 项，不是 5 项）。
- 若题干有 **2 个空**，每个选项用 **「词1/词2」** 或 **「成语/词语」** 表示两空答案（如「大相径庭/固有」「泾渭分明/潜在」）；仅 **1 个空** 时选项为单个词语或成语，勿强行凑双空。
- 选项须为**同级词语或成语**，干扰项与正确项在语义强度、感情色彩、搭配对象上**可混淆**，禁止一眼可排除的凑数项。

**考点（紧扣讲义，优先考情说明中的高频考点）**：
- 重点考查讲义中的**逻辑关系**：解释说明、相反相对、并举/并列、递进、转折、因果等；题干中应保留或改写讲义中的**标志词/标志信息**（如「因此」「然而」「甚至」「也就是说」等）。
- 结合讲义「考情贴士」：熟记逻辑标志、从提示信息较明确的空入手、多种关系可综合考查。
- 题干情境可**改写**讲义例句与经典真题，**禁止**照抄讲义例题或真题原文；须同考点、新表述、可迁移。

**命题质量**：
- 约 **80%** 题考查讲义 **加粗** 或考情速览中的**高频考点**；其余考查文中明确写出的次要点。
- 同批题目勿重复同一成语/同一逻辑关系组合；正确选项不得相同或近乎相同。
- 使用简体中文；mode 固定为 **single**。`

export const AI_CHINESE_CLOZE_FORMAT_RULES = `**选词填空 JSON 格式（与通用五选一不同，必须遵守）**：
- 每题对象字段：stem, mode（single）, layout（cloze-four）, correct（1 项）, distractors（3 项）。
- 示例（双空）：
  {"stem":"…两种文明，____，甚至可以说完全相对。…传统统治中形成的____矛盾…填入画横线部分最恰当的一项是（  ）","mode":"single","layout":"cloze-four","correct":["大相径庭/固有"],"distractors":["南辕北辙/历史","泾渭分明/潜在","标新立异/长期"]}`

function countKeywordHits(text: string): number {
  let n = 0
  for (const kw of CONTENT_KEYWORDS) {
    if (text.includes(kw)) n++
  }
  return n
}

/** 判断是否为语文选词填空 / 逻辑填空类讲义 */
export function isChineseClozeHandout(
  title: string,
  bodyText: string,
  extraTexts: string[] = [],
): boolean {
  const titleT = title.trim()
  if (titleT && STRONG_TITLE_RE.test(titleT)) return true

  const combined = [titleT, bodyText, ...extraTexts]
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 12_000)
  if (!combined) return false

  const hits = countKeywordHits(combined)
  if (hits >= 3) return true
  if (hits >= 2 && /选词填空|逻辑填空|逻辑关系/.test(combined)) return true
  return false
}

export function chineseClozeQuizRulesBlock(
  title: string,
  bodyText: string,
  extraTexts: string[] = [],
): string {
  if (!isChineseClozeHandout(title, bodyText, extraTexts)) return ''
  return `${AI_CHINESE_CLOZE_QUIZ_RULES}\n\n${AI_CHINESE_CLOZE_FORMAT_RULES}`
}

/** 在 AI 用户提示末尾追加选词填空出题规则（按需） */
export function appendChineseClozeQuizRules(
  baseUser: string,
  title: string,
  bodyText: string,
  extraTexts: string[] = [],
): string {
  const block = chineseClozeQuizRulesBlock(title, bodyText, extraTexts)
  if (!block) return baseUser
  return `${baseUser}\n\n${block}`
}
