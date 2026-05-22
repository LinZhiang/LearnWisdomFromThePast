import { htmlToPlainText } from '@/utils/htmlToText'

export type MindmapDerivedMcq = {
  stem: string
  mode: 'single' | 'multiple'
  correct: string[]
  distractors: string[]
}

function stripJsonFence(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }
  return t.trim()
}

/** DeepSeek 偶发用 markdown 围栏包裹导图正文，需去掉后再交给 markmap */
function stripMindmapMarkdownFence(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }
  return t.trim()
}

const MINDMAP_SOURCE_TEXT_MAX = 18_000

/**
 * 学习工具「思维导图」：根据用户粘贴的长文，生成可供 markmap 渲染的 Markdown 树。
 */
export async function requestMindmapMarkdownFromSourceText(sourceText: string): Promise<string> {
  const raw = sourceText.trim()
  if (!raw) throw new Error('请先粘贴需要整理的学习材料')

  const body = truncatePlainText(raw, MINDMAP_SOURCE_TEXT_MAX)

  const user = `以下是用户提供的原始学习材料（纯文本）。请你完成「整理 → 重新划分板块 → 输出可直接用于 mindmap（markmap）渲染的 Markdown 思维导图」。

【核心风格】（请贯穿全文，与下列表述一致）
你帮我根据内容重新划分一下各个板块，并生成思维导图，弄得简单易懂，分得细一点，根据节点内容适当列举例子（比如我们国家的发展历史）或者补充一些历史背景，对一些关键词进行一定程度上的解释，并在节点上适当放上图标，重点内容需要加粗标出。

【任务要求】（须逐条落实）
1. 根据内容**重新划分各个板块**，整体**简单易懂**，层级**尽量细分**（主干清晰、细节可展开）。
2. 结合节点主题**适当列举例子**；若材料涉及发展脉络、阶段、史实等，可比照「我们国家的发展历史」这类方式补充**简短例子**或**必要背景**。材料未涉及处不要硬编事实，可写「材料未展开」等诚实提示。
3. 对难懂的**关键词**在对应节点下用一两句话做**适度解释**。
4. 在各级**节点标题前适当加上 emoji** 当作图标（如 📌 🔑 📚 ⚡️ 等与语义贴切即可；不要堆砌）。
5. **重点内容**（核心概念、结论、易错点、关键数字等）务必用 Markdown 加粗：**……**。

【输出格式】（必须严格遵守）
- **只输出**一段 Markdown 正文：不要用 \`\`\` 代码围栏包裹，不要前言或后记。
- 使用 \`#\` 总标题、\`##\` 大板块、\`###\` / \`####\` 继续细分；说明文字用 \`-\` 无序列表挂在对应标题下，可多级嵌套。
- 单条列表不宜过长；避免整段散文不加标题层级。
- 使用简体中文。

【原始材料】
${body}`

  const text = await deepseekChatRaw(user, {
    system:
      '你是专业的知识整理与思维导图助手，只输出符合用户格式要求的 Markdown，不输出任何额外说明。',
    temperature: 0.35,
  })
  const md = stripMindmapMarkdownFence(text)
  if (!md) throw new Error('DeepSeek 未返回有效的导图 Markdown')
  return md
}

/** 生产环境须在 .env 配置；开发环境默认走 Vite 代理 /api/ai → 本地 server（见 docs/ENV-说明.md） */
function chatCompletionsUrl(): string {
  const base = import.meta.env.VITE_AI_API_BASE?.trim()
  if (base) return `${base.replace(/\/$/, '')}/chat/completions`
  if (import.meta.env.DEV) return '/api/ai/chat/completions'
  return ''
}

/** 前端是否具备调用 AI 的配置（开发态假定已启动 server；生产需 VITE_AI_API_BASE） */
export function isAiChatConfigured(): boolean {
  if (import.meta.env.VITE_AI_API_BASE?.trim()) return true
  if (import.meta.env.DEV) return true
  return false
}

async function deepseekChatRaw(
  user: string,
  options?: { system?: string; temperature?: number },
): Promise<string> {
  const url = chatCompletionsUrl()
  if (!url) {
    throw new Error(
      '未配置 AI 代理地址：生产构建请设置 VITE_AI_API_BASE（见 docs/ENV-说明.md）',
    )
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            options?.system ??
            '你是专业、严谨的学习助手，只输出用户要求的格式，使用简体中文。',
        },
        { role: 'user', content: user },
      ],
      temperature: options?.temperature ?? 0.35,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`DeepSeek 请求失败（${res.status}）：${errText.slice(0, 280)}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('DeepSeek 未返回有效内容')
  return text
}

const KEYWORD_FOLLOWUP_MATERIAL_MAX = 14_000

function truncatePlainText(text: string, maxLen: number): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}\n\n…（后文已省略）`
}

/**
 * 题库详情「关键字追问」：在题目材料基础上按用户输入的关键词或短问作答。
 */
export async function requestQuestionKeywordFollowup(input: {
  typeLabel: string
  title: string
  materialPlainText: string
  userKeywords: string
}): Promise<string> {
  const kw = input.userKeywords.trim()
  if (!kw) throw new Error('请输入关键字或追问内容')

  const material = truncatePlainText(input.materialPlainText, KEYWORD_FOLLOWUP_MATERIAL_MAX)
  const title = input.title.trim() || '（无）'

  const user = `你正在辅助学员学习。下面是一道题库中的题目（纯文本摘录）以及题型说明。\n学员给出了「关键字 / 追问」，请你**紧扣该关注点**作答（可使用 Markdown）：先点明与题目材料的关联，再展开说明；若材料不足以支撑结论，请如实说明并给出可操作的补充学习建议。\n\n【题型】${input.typeLabel}\n【题目名称】${title}\n\n【题目相关材料】\n${material || '（暂无正文摘录）'}\n\n【学员关键字或追问】\n${kw}`

  return deepseekChatRaw(user, {
    system: '你是专业、耐心的学习助手，使用简体中文，条理清楚，避免空泛套话。',
    temperature: 0.4,
  })
}

export type GeneralQuestionSolveInput = {
  title: string
  contentHtml: string
  analysisHtml?: string
}

export type QuestionSolveInput =
  | {
      kind: 'general'
      title: string
      contentHtml: string
      analysisHtml?: string
    }
  | {
      kind: 'choice'
      title: string
      mode: 'single' | 'multiple'
      correctAnswers: string[]
      analysisHtml?: string
    }

function buildUserMessage(input: QuestionSolveInput): string {
  const analysisText = input.analysisHtml ? htmlToPlainText(input.analysisHtml) : ''

  if (input.kind === 'general') {
    const contentText = htmlToPlainText(input.contentHtml)
    let user = `请作为一名学习辅导老师，根据下面的题目给出清晰的解答思路与参考答案（可使用 Markdown 分点表述）。\n\n题目名称：${input.title.trim() || '（无）'}\n\n题目内容：\n${contentText || '（暂无正文）'}`
    if (analysisText) {
      user += `\n\n题目已有解析（仅供参考，可对比、补充或指出要点）：\n${analysisText}`
    }
    return user
  }

  const modeLabel = input.mode === 'single' ? '单选' : '多选'
  const answers = input.correctAnswers.map((s) => s.trim()).filter(Boolean)
  const answersBlock =
    answers.length > 0
      ? answers.map((a, i) => `${i + 1}. ${a}`).join('\n')
      : '（未填写）'

  let user = `请作为一名学习辅导老师，针对下面这道**选择题**进行讲解：说明考查点、正确选项为何成立，并给出简要的作答说明（可使用 Markdown 分点表述）。\n\n题目名称：${input.title.trim() || '（无）'}\n\n选项类型：${modeLabel}\n\n已知正确选项（命题给定）：\n${answersBlock}`
  if (analysisText) {
    user += `\n\n题目已有解析（仅供参考，可对比、补充或指出要点）：\n${analysisText}`
  }
  return user
}

/**
 * 统一入口：一般题型或选择题型的 DeepSeek 解答（经后端代理，不在浏览器携带密钥）。
 */
export async function requestQuestionSolve(input: QuestionSolveInput): Promise<string> {
  if (input.kind === 'general') {
    const contentText = htmlToPlainText(input.contentHtml)
    if (!input.title?.trim() && !contentText) {
      throw new Error('请先填写题目名称或题目内容')
    }
  } else {
    const filled = input.correctAnswers.map((s) => s.trim()).filter(Boolean)
    if (!input.title?.trim()) {
      throw new Error('请先填写题目名称')
    }
    if (input.mode === 'single' && filled.length === 0) {
      throw new Error('请先填写正确答案')
    }
    if (input.mode === 'multiple' && filled.length < 2) {
      throw new Error('多选题请至少填写两个正确答案')
    }
  }

  const user = buildUserMessage(input)

  return deepseekChatRaw(user, {
    system: '你是专业、耐心的学习助手，解答需准确、条理清楚，使用简体中文。',
    temperature: 0.4,
  })
}

/** 一般题型（兼容旧调用） */
export async function requestGeneralQuestionSolve(
  input: GeneralQuestionSolveInput,
): Promise<string> {
  return requestQuestionSolve({
    kind: 'general',
    title: input.title,
    contentHtml: input.contentHtml,
    analysisHtml: input.analysisHtml,
  })
}

/** 为测验生成干扰项（与正确选项语义接近但错误），返回恰好 need 条 */
export async function requestChoiceDistractors(input: {
  title: string
  correctAnswers: string[]
  need: number
  analysisHtml?: string
}): Promise<string[]> {
  const need = Math.max(0, Math.min(20, Math.floor(input.need)))
  if (need === 0) return []
  const correct = input.correctAnswers.map((s) => s.trim()).filter(Boolean)
  const analysisText = input.analysisHtml ? htmlToPlainText(input.analysisHtml) : ''
  const correctBlock = correct.map((a, i) => `${i + 1}. ${a}`).join('\n')
  let user = `你是命题助手。下面是一道选择题的已知**正确选项**（这些文本必须原样保留在题目中，不要改写）。\n请再生成恰好 ${need} 个**错误选项**文本：表述风格与正确项接近、容易混淆，但结论或事实明显错误；不要与正确选项重复或同义；每条一行意群，不要编号。\n\n题目名称：${input.title.trim() || '（无）'}\n\n正确选项：\n${correctBlock}`
  if (analysisText) {
    user += `\n\n题目解析（供你把握考点，不要照抄到选项里）：\n${analysisText}`
  }
  user += `\n\n仅返回 JSON 数组，共 ${need} 个字符串，例如：["干扰项1","干扰项2",...]。不要其它说明。`

  const raw = await deepseekChatRaw(user, {
    system: '只输出合法 JSON 数组字符串，元素为简体中文，不要 markdown 代码块。',
    temperature: 0.55,
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(raw))
  } catch {
    throw new Error('DeepSeek 返回的干扰项不是合法 JSON')
  }
  if (!Array.isArray(parsed)) throw new Error('干扰项格式应为 JSON 数组')
  const out = parsed.map((x) => String(x).trim()).filter(Boolean)
  const norm = (s: string) => s.replace(/\s+/g, '')
  const correctSet = new Set(correct.map(norm))
  const dedup: string[] = []
  const seen = new Set<string>()
  for (const s of out) {
    const n = norm(s)
    if (correctSet.has(n)) continue
    if (seen.has(n)) continue
    seen.add(n)
    dedup.push(s)
    if (dedup.length >= need) break
  }
  while (dedup.length < need) {
    dedup.push(`（干扰项 ${dedup.length + 1}）请重新生成测验`)
  }
  return dedup.slice(0, need)
}

/** 思维导图 Markdown → 多道选择题（每题 5 个选项） */
export async function requestMindmapDerivedMcqs(input: {
  title: string
  markdown: string
}): Promise<MindmapDerivedMcq[]> {
  const md = (input.markdown ?? '').trim()
  if (!md) throw new Error('思维导图内容为空')
  const user = `下面是一则思维导图草稿（Markdown）。其中 **加粗** 的文字是核心考点。\n\n请你根据全文**丰富程度**生成 **5～10 道** 测验用选择题：加粗要点多、层次丰富时尽量出满 **10 道**；内容较简略时不少于 **5 道**，并优先覆盖所有重要加粗要点。\n\n**出题比例（必须遵守）**：\n- **至少约 80%** 的题目要**主要考查加粗文字**对应的概念、结论或关系（正确选项的判据应能对应到这些加粗要点）。\n- **至多约 20%** 的题目可考查**非加粗**但结合上下文仍需理解的内容（如结构、层级、衔接），且必须**严格依据原文**，不得编造文中没有的信息。\n\n**关于“举例/案例”内容的命题约束（必须遵守）**：\n- 如果原文里出现“例如、举例、案例、样例、情景”等示例内容，**不要把示例原文直接当题干或正确选项**。\n- 可以把示例作为启发，改写为新的情境或换一个同类例子，题目要回到**考点本身**（概念、原理、关系、判据）而不是记忆某个示例句子。\n- 禁止仅做表面替换（改几个词仍是同一例子）；应做到“同考点、非原例、可迁移”。\n\n**格式要求**：\n- 每道题 5 个选项：correct 为所有正确选项文本数组，distractors 为所有错误选项文本数组；|correct|+|distractors| 必须等于 5。\n- mode 为 single 时 correct 长度必须为 1，distractors 长度 4；mode 为 multiple 时 correct 长度至少 2，distractors 长度 = 5 - |correct|。\n- 题干 stem 不要直接照抄加粗原句、示例原句或泄露答案。\n- 使用简体中文。\n\n思维导图标题：${input.title.trim() || '（无）'}\n\n---\n${md}\n---\n\n仅返回 JSON 数组（长度在 5～10 之间），元素字段：stem, mode, correct, distractors。不要 markdown 代码块或其它说明。`

  const raw = await deepseekChatRaw(user, {
    system:
      '只输出合法 JSON 数组，长度 5～10。不要输出 markdown 围栏。加粗相关题目须占绝大多数。',
    temperature: 0.45,
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(raw))
  } catch {
    throw new Error('DeepSeek 返回的思维导图小题不是合法 JSON')
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('未能从思维导图生成小题')
  }
  const out: MindmapDerivedMcq[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const stem = String(o.stem ?? '').trim()
    const mode = o.mode === 'multiple' ? 'multiple' : 'single'
    const correct = Array.isArray(o.correct)
      ? o.correct.map((x) => String(x).trim()).filter(Boolean)
      : []
    const distractors = Array.isArray(o.distractors)
      ? o.distractors.map((x) => String(x).trim()).filter(Boolean)
      : []
    if (!stem) continue
    if (mode === 'single' && correct.length !== 1) continue
    if (mode === 'multiple' && correct.length < 2) continue
    if (correct.length + distractors.length !== 5) continue
    out.push({ stem, mode, correct, distractors })
    if (out.length >= 10) break
  }
  if (out.length === 0) throw new Error('思维导图小题未能通过校验')
  return out
}

/** 测验用：不暴露正确答案，仅根据题干与选项给思路 */
export async function requestChoiceTestAssist(input: {
  title: string
  stem?: string
  options: string[]
}): Promise<string> {
  const opts = input.options.map((s, i) => `${String.fromCharCode(65 + i)}. ${s}`).join('\n')
  const stem = (input.stem ?? '').trim()
  const user = `请作为学习助手，根据下面题目与备选选项，给出**解题思路与排除法提示**（可用 Markdown）。\n**不要**直接写出正确选项的字母或完整正确选项原文；不要断言哪一个一定正确。\n\n题目名称：${input.title.trim() || '（无）'}${stem ? `\n题干：${stem}` : ''}\n\n备选选项：\n${opts}`

  return deepseekChatRaw(user, {
    system: '你是耐心的助教，遵守不泄题要求，使用简体中文。',
    temperature: 0.35,
  })
}

/** 一般题：对照学员作答与官方解析，分析错因与改进方向 */
export async function requestGeneralMistakeAwareSolve(input: {
  title: string
  contentHtml: string
  analysisHtml?: string
  userAnswerHtml: string
}): Promise<string> {
  const contentText = htmlToPlainText(input.contentHtml)
  const analysisText = input.analysisHtml ? htmlToPlainText(input.analysisHtml) : ''
  const userText = htmlToPlainText(input.userAnswerHtml)
  const user = `请作为一名学习辅导老师。学员本题**未得满分或作答存在明显不足**。请对照「题目内容」「官方解析」与「学员作答」，完成：\n1）概括学员作答与标准思路或解析之间的**差距**；\n2）分析可能的**错因**（知识漏洞、审题偏差、推理跳步、表述不完整等，择要说明）；\n3）给出**可操作的改进建议**与正确要点提示。\n使用 Markdown，语气耐心、具体，避免空泛批评。\n\n题目名称：${input.title.trim() || '（无）'}\n\n题目内容：\n${contentText || '（无）'}\n\n官方解析：\n${analysisText || '（暂无，请仅依据题目与学员作答合理推断）'}\n\n学员作答：\n${userText || '（未检测到文字作答，可提示学员补充）'}`
  return deepseekChatRaw(user, {
    system: '你是专业、耐心的学习助手，使用简体中文。',
    temperature: 0.4,
  })
}

/** 选择题：根据学员所选与正确答案，分析错因 */
export async function requestChoiceMistakeAwareSolve(input: {
  title: string
  stem?: string
  options: string[]
  correctAnswerTexts: string[]
  userSelectedTexts: string[]
  analysisHtml?: string
}): Promise<string> {
  const opts = input.options.map((s, i) => `${String.fromCharCode(65 + i)}. ${s}`).join('\n')
  const correctBlock = input.correctAnswerTexts.map((s) => s.trim()).filter(Boolean).join('；') || '（无）'
  const userBlock =
    input.userSelectedTexts.length > 0
      ? input.userSelectedTexts.map((s) => s.trim()).filter(Boolean).join('；')
      : '（未选择任何选项）'
  const analysisText = input.analysisHtml ? htmlToPlainText(input.analysisHtml) : ''
  const stem = (input.stem ?? '').trim()
  let user = `请作为一名学习辅导老师。学员在完成本题时**未得满分**（漏选、错选或未选）。请根据下列选项、正确答案与学员实际所选：\n1）简要说明**错因**（如概念混淆、多选/单选策略、干扰项误导等）；\n2）指出正确思路或关键判据；\n3）若学员漏选，说明还缺哪些正确项及为何重要。\n使用 Markdown，语气耐心，不要指责学员。\n\n题目名称：${input.title.trim() || '（无）'}`
  if (stem) user += `\n题干：${stem}`
  user += `\n\n选项：\n${opts}\n\n正确答案（文本）：${correctBlock}\n学员所选（文本）：${userBlock}`
  if (analysisText) {
    user += `\n\n题目官方解析：\n${analysisText}`
  }
  return deepseekChatRaw(user, {
    system: '你是专业、耐心的学习助手，使用简体中文。',
    temperature: 0.4,
  })
}

/** 测验结束后六个固定维度的雷达数据 + Markdown 综合解析 */
export const QUIZ_RADAR_DIMENSION_ORDER = [
  '知识掌握',
  '审题理解',
  '推理严密',
  '作答完整度',
  '题型适应力',
  '复盘提升空间',
] as const

export type QuizRadarDimension = {
  name: string
  score: number
  brief?: string
}

export type QuizRadarResponse = {
  dimensions: QuizRadarDimension[]
  analysisMd: string
}

function normalizeQuizRadarDimensions(raw: unknown): QuizRadarDimension[] {
  const byName = new Map<string, { score: number; brief?: string }>()
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      let score = Number(o.score)
      if (!Number.isFinite(score)) score = 50
      score = Math.max(0, Math.min(100, Math.round(score)))
      const brief = o.brief != null ? String(o.brief).trim() : undefined
      if (name) byName.set(name, { score, brief })
    }
  }
  return QUIZ_RADAR_DIMENSION_ORDER.map((canonical) => {
    const hit = byName.get(canonical)
    if (hit) return { name: canonical, score: hit.score, brief: hit.brief }
    for (const [k, v] of byName) {
      if (k.includes(canonical.slice(0, 4)) || canonical.includes(k.slice(0, 4))) {
        return { name: canonical, score: v.score, brief: v.brief }
      }
    }
    return { name: canonical, score: 50, brief: undefined }
  })
}

/** 根据逐题得分情况生成六维雷达 + 综合点评（JSON） */
export async function requestQuizRadarAnalysis(input: {
  learningTypeName: string
  totalScore: number
  totalMax: number
  resultLines: string
  /**
   * 客户端统计的测验耗时与分题用时（含一般题正文篇幅），用于效率分析。
   * 无则省略，不影响 JSON 结构。
   */
  timingAnalysisLines?: string
}): Promise<QuizRadarResponse> {
  const orderText = QUIZ_RADAR_DIMENSION_ORDER.map((n, i) => `${i + 1}. ${n}`).join('\n')
  const timingBlock =
    input.timingAnalysisLines?.trim() ?
      `\n\n【做题耗时与效率分析要求】\n以下由系统记录（从进入可作答状态到提交最后一题为止）。请在 **analysisMd** 与六个维度的 **brief** 中适度体现「时间管理 / 做题效率」评价，并严格遵守：\n- **选择题型、思维导图小题**：选项固定、阅读负担相对较低，可结合单题用时判断节奏是否拖沓或过于仓促。\n- **一般题型**：往往需要阅读较长材料并组织表述，**不得**仅用「总用时 ÷ 题数」与选择题简单对比；须结合每题给出的「题干/材料纯文本字数（约）」判断：篇幅越长，合理用时通常应越长；可提及「单位篇幅耗时」或「相对篇幅是否过快/过慢」等。\n- 若某类题得分偏低且用时异常（过短或过长），可在「复盘提升空间」「审题理解」「作答完整度」等维度中点出可改进习惯。\n\n耗时与分题统计：\n${input.timingAnalysisLines.trim()}\n`
      : ''
  const user = `你是一名学习测评顾问。根据学员本次**题库测验**的逐题结果，完成两件事：\n1）在下列 **6 个固定维度** 上各打一个 **0～100 的整数分**（100 表示表现极好），并给每条一个不超过 15 字的 brief 要点；\n2）用 **analysisMd** 写一段 **Markdown** 综合点评（可含二级标题、列表），结合得分率、题型分布与薄弱环节，语气积极、具体可改进。${timingBlock ? '若上方提供了耗时数据，综合点评中须包含一小节对「做题效率/时间分配」的具体分析（避免空泛）。' : ''}\n\n六个维度名称必须**逐字一致**（JSON 里 name 字段）：\n${orderText}\n\n测验节点：${input.learningTypeName}\n总得分：${input.totalScore} / ${input.totalMax}\n\n逐题摘要：\n${input.resultLines}${timingBlock}\n\n**仅返回一个 JSON 对象**，不要 markdown 代码围栏，不要其它文字。格式：\n{"dimensions":[{"name":"知识掌握","score":72,"brief":"要点"},{"name":"审题理解",...},...共6条],"analysisMd":"..."}`

  const raw = await deepseekChatRaw(user, {
    system:
      '只输出合法 JSON 对象。dimensions 必须恰好 6 项且 name 与要求的六个维度一致。使用简体中文。',
    temperature: 0.35,
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(raw))
  } catch {
    throw new Error('DeepSeek 返回的雷达数据不是合法 JSON')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('雷达数据格式无效')
  const o = parsed as Record<string, unknown>
  const analysisMd = String(o.analysisMd ?? '').trim() || '（暂无综合点评）'
  const dimensions = normalizeQuizRadarDimensions(o.dimensions)
  return { dimensions, analysisMd }
}
