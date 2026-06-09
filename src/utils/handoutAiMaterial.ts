import { stripLooseDataImagePayloads } from '@/utils/markdownEmbeddedImages'

/** 与思维导图出题一致：只发节选正文，控制 token 与费用 */
export const HANDOUT_AI_BODY_MAX = 18_000

const DATA_IMAGE_MD_RE =
  /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+)\)/gi
const ANY_IMAGE_MD_RE = /!\[[^\]]*\]\([^)]+\)/g
const EMBED_REF_RE = /!\[[^\]]*\]\(\s*:embed:\d+\s*\)/gi

function truncatePlainText(text: string, maxLen: number): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}\n\n…（后文已省略；出题请依据上文重点与加粗考点）`
}

/** 去掉一切图片相关 Markdown，不保留占位、不向模型描述图内容 */
function stripAllImageMarkdown(text: string): string {
  return text
    .replace(DATA_IMAGE_MD_RE, '')
    .replace(EMBED_REF_RE, '')
    .replace(ANY_IMAGE_MD_RE, '')
    .replace(/^\s*!\[[^\]]*\][^\n]*$/gm, '')
}

/**
 * 测验自动出题：剔除图片与 base64，截断至与思维导图相同的体量。
 */
/** 关键字追问：与出题相同地去掉图片/base64，但不截断（由 keywordFollowupMaterial 智能节选） */
export function prepareHandoutBodyForKeywordFollowup(raw: string): string {
  let text = (raw ?? '').trim()
  if (!text) return ''

  text = stripAllImageMarkdown(text)
  text = stripLooseDataImagePayloads(text)
  return text.replace(/\n{3,}/g, '\n\n')
}

export function prepareHandoutBodyForAi(raw: string, maxLen = HANDOUT_AI_BODY_MAX): string {
  const text = prepareHandoutBodyForKeywordFollowup(raw)
  if (!text) return ''
  return truncatePlainText(text, maxLen)
}

/** 与思维导图小题一致的「重难点 + 少量小点」命题说明（讲义/导图共用） */
export const AI_DERIVED_MCQ_FOCUS_RULES = `**出题比例（必须遵守）**：
- **至少约 80%** 的题目要**主要考查 **加粗** 文字**对应的核心概念、结论或关系（正确选项的判据应能对应这些加粗要点）。
- **至多约 20%** 的题目可考查**非加粗**但文中明确写出的次要点（结构、对比、易混概念等），须**严格依据原文**，不得编造。
- **禁止**考查图片、插图、导图画面或文中未写明的细节；材料中**不含图片信息**，勿出必须看图才能答的题。

**关于「举例/案例」的命题约束（必须遵守）**：
- 若原文有「例如、举例、案例」等，**不要把示例原文直接当题干或正确选项**；可改写情境考查**同一考点**，做到同考点、非原例、可迁移。

**防泄题（必须遵守）**：
- 题干 stem 中**不得**出现 correct 里任一正确选项的原文、加粗考点的完整复述，或与正确项高度重合的短语。`

export const AI_DERIVED_MCQ_OPTION_CONSISTENCY_RULES = `**选项体例一致（必须遵守）**：
- correct 与 distractors 共 5 项必须是**同一答案形态**：例如全是「十六进制编码（如 D6D0H）」、全是「单个数值+单位」、全是「同级短短语概念」等。
- **禁止**在 distractors 中混入：算式推导（含 +、-、×、÷、=）、解题步骤、多句说明、与正确项形态明显不同的长句。
- **禁止**干扰项写成「××+××=正确项」或包含任一 correct 的完整原文；错误项应是与正确项同形态的**并列候选答案**，不是推导过程。

**干扰项紧密贴合（必须遵守）**：
- 五个选项须处于**同一分类层级与表述粒度**，彼此是「可混淆的并列候选」，禁止出现「四项同一维度、一项明显异类」的配置。
- 概念/分类题：若正确项是类别名（如「表示媒体」），干扰项也须是**同级类别名**（如感觉媒体、显示媒体、存储媒体），不得用具体实例（文字、音乐、图片）充数。
- 数值/容量/频率题：干扰项须为**同单位、相近量级**的结果，来源于常见失误（错进制 1000/1024、漏乘声道或时间、位数算错等），禁止悬殊到可一眼排除的凑数项。`

/** 解答、错因分析、作答题解析：涉及时数与单位换算 */
export const AI_CALCULATION_EXPLANATION_RULES = `**计算与单位换算（题目涉及时必须遵守）**：
- 写出完整换算链条：原始量 → 中间量 → 与选项一致的最终单位；关键乘除（采样率、量化位数、声道数、时长、÷8 等）逐步列出。
- 数据容量：除非题干明确要求按 1000 进制，否则默认 **1 KB = 1024 B，1 MB = 1024 KB**；说明所用进制，并把结果换算到与选项相同单位后再对比。
- **不得**只给口头结论或只写一种口径；若学员误选项与正确项量级不同，应指出是进制、漏乘、单位未统一等具体环节。`

export const AI_DERIVED_MCQ_FORMAT_RULES = `**格式要求**：
- 每道题 5 个选项：correct 为正确选项文本数组，distractors 为错误选项数组；|correct|+|distractors| 必须等于 5。
- mode 为 single 时 correct 长度 1、distractors 长度 4；mode 为 multiple 时 correct 至少 2。
- 题干勿照抄加粗原句或示例原句；使用简体中文。

${AI_DERIVED_MCQ_OPTION_CONSISTENCY_RULES}`

/** 讲义一般题：同样重难点优先，仅在有可算/可推导考点时出题 */
/** 错题本测验：在原错题基础上生成变式题（同考点、非原题照抄） */
export const WRONG_BOOK_MCQ_VARIANT_RULES = `**错题本选择题变式（必须遵守）**：
- **考查点锁定**：能力层次、知识点必须与「原错题」一致，不得更换考点或考到无关概念。
- 必须重新编写题干与选项，禁止照抄原题干、原选项的原文或原数字情境。
- **正确选项不必与原题逐字相同**：可同义改写、换问法后换更贴切的正确项；但不得变成另一知识点的结论。
- **场次节奏**：同一场错题测验里，约半数以上题目的 correct 仍应以原「标准答案」为准（可同义表述）；其余题目可在同一考点下换情境/换角度，使正确项合理变化。
- 干扰项与正确项须同一答案形态；题干不得泄题（不得包含正确选项原文）。`

export const WRONG_BOOK_MCQ_VARIANT_STANDARD_HINT = `**本题倾向**：请仍以原题「标准答案」（可同义改写，勿逐字照抄）作为 correct，换题干与干扰项即可。`

export const WRONG_BOOK_MCQ_VARIANT_FLEXIBLE_HINT = `**本题倾向**：可换情境或换提问角度；correct 可与原标准答案表述不同，但须仍考查同一考点、同一结论方向。`

export const WRONG_BOOK_GENERAL_VARIANT_RULES = `**错题本作答题/计算题变式（必须遵守）**：
- **考查点锁定**：同一考点、同一解题方法或同一概念要求，不得偏题。
- 必须改写题干与情境，禁止照抄原题全文；解析须对应新题条件。
- 计算/数值题：换具体数字或条件，结果可与原题不同。
- 概念/简答题：参考答案可同义调整或换表述，不必与原题参考答案逐字相同。`

export const WRONG_BOOK_GENERAL_VARIANT_STANDARD_HINT = `**本题倾向**：参考答案仍应围绕原题标准答法与考点，可同义改写。`

export const WRONG_BOOK_GENERAL_VARIANT_FLEXIBLE_HINT = `**本题倾向**：可换情境或条件出题；参考答案可与原题不同，但须仍落在同一考点。`

export const AI_DERIVED_JUDGMENT_FOCUS_RULES = `**判断题命题（必须遵守）**：
- 每题 stem 为**一句完整判断陈述**（如「……属于……」「……的默认进制是……」），不要出成选择题问法（禁止「下列正确的是」）。
- **约一半** answer 为 true（陈述与讲义一致），**约一半**为 false；错误陈述须**看似合理、易与正确说法混淆**。
- 错误项手法：概念张冠李戴、范围扩大/缩小、因果颠倒、数值/进制/单位微错、把特点说成定义、混淆同级易混术语等；须**严格依据讲义**，不得编造文中没有的概念。
- **优先**考查 **加粗** 考点；禁止考图片或文中未写明的细节。
- analysis 须简明说明为何对/错，指出易混点；knowledgePoint 为 4～12 字考点标签。`

export const AI_DERIVED_GENERAL_FOCUS_RULES = `**出题范围（必须遵守）**：
- **优先**针对 **加粗** 考点及文中明确给出的公式、算法、换算步骤出题；无合适计算点时，可出简答/填空式概念题，但仍须依据原文。
- **至多约 20%** 可覆盖非加粗次要点；**禁止**考图片或文中未出现的方法。
- 有例题时**不得照抄原数字**，应换数变式考查同一方法。
- 计算/容量题：analysis 中须写清单位换算与中间步骤；referenceAnswer 的单位口径须与题干一致（默认 1024 进制除非材料另有说明）。`

/** 测验批量出题：同批内答案与题干勿重复 */
export const AI_QUIZ_BATCH_DIVERSITY_RULES = `**同批题目勿重复（必须遵守）**：
- 同一 JSON 数组内，**任意两道题的正确选项不得相同或近乎相同**（含仅多几个字、换问法但答案仍是同一概念对/同一短语，如「社会存在与社会意识」与「社会存在与社会意识谁决定谁」只能出一题）。
- 同一批内题干不得高度雷同；每题应考查不同小点或不同问法，且**正确结论须不同**。
- 仍须以 **加粗/重难点** 为主，在覆盖面足够的前提下尽量分散考点。`

export function appendQuizAvoidanceToPrompt(baseUser: string, quizAvoidanceHint?: string): string {
  const hint = quizAvoidanceHint?.trim()
  if (!hint) return baseUser
  return `${baseUser}\n\n${hint}`
}

/** 补题轮次：在已有题面基础上追加规避提示，避免重复考点/题干 */
export function buildSupplementalQuizAvoidanceHint(
  quizAvoidanceHint: string | undefined,
  existingStems: string[],
  kindLabel = '题',
): string {
  const stems = [
    ...new Set(existingStems.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)),
  ]
  if (stems.length === 0) return quizAvoidanceHint?.trim() ?? ''
  const lines = stems
    .map((s, i) => {
      const t = s.length > 72 ? `${s.slice(0, 72)}…` : s
      return `${i + 1}. ${t}`
    })
    .join('\n')
  const block = `【补题说明】本轮已生成 ${stems.length} 道${kindLabel}，请再出不同考点或问法，勿与下列题面重复：\n${lines}`
  const base = quizAvoidanceHint?.trim() ?? ''
  return base ? `${base}\n\n${block}` : block
}
