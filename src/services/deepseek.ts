import { htmlToPlainText } from '@/utils/htmlToText'
import {
  extractImagesFromRichHtml,
  getMaxMaterialImages,
  richHtmlToPlainTextOnly,
} from '@/utils/richMaterialImages'
import { MATERIAL_LECTURE_USER_GOAL, ocrImagesLocally } from '@/utils/localImageOcr'

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

/** 命题比对用：去空白、去 markdown 加粗与常见引号 */
function normalizeMcqCompareText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/[「」""''《》]/g, '')
    .replace(/\s+/g, '')
}

function splitMcqAnswerSegments(text: string): string[] {
  return text
    .split(/[、，,;；/／]+/)
    .map((s) => normalizeMcqCompareText(s))
    .filter((s) => s.length >= 2)
}

/** 题干是否已包含正确选项原文（或其主要片段），导致“看题干就能选对” */
export function mcqStemLeaksAnswer(stem: string, correct: string[]): boolean {
  const normStem = normalizeMcqCompareText(stem)
  if (!normStem) return false
  for (const ans of correct) {
    const normAns = normalizeMcqCompareText(ans)
    if (!normAns) continue
    if (normAns.length >= 4 && normStem.includes(normAns)) return true
    const segments = splitMcqAnswerSegments(ans)
    if (segments.length >= 2) {
      const hitCount = segments.filter((seg) => seg.length >= 3 && normStem.includes(seg)).length
      if (hitCount >= 2) return true
    }
  }
  return false
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
const LECTURE_MATERIAL_MAX = 18_000

/** 默认 Flash（测验辅助、干扰项等）；可通过 VITE_DEEPSEEK_MODEL_DEFAULT 覆盖 */
export const DEEPSEEK_MODEL_DEFAULT =
  import.meta.env.VITE_DEEPSEEK_MODEL_DEFAULT?.trim() || 'deepseek-v4-flash'

/** 长文生成（思维导图、资料讲义）；可通过 VITE_DEEPSEEK_MODEL_HEAVY 覆盖 */
export const DEEPSEEK_MODEL_HEAVY =
  import.meta.env.VITE_DEEPSEEK_MODEL_HEAVY?.trim() || 'deepseek-v4-pro'

const WENGU_AI_SOURCE = 'wengu-learning-app'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function parseAssistantContent(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  return ''
}

/** 将代理/上游返回的错误体转成可读中文（避免直接展示整段 JSON） */
function formatDeepSeekFetchError(status: number, errText: string): string {
  let upstreamMsg = ''
  try {
    const parsed = JSON.parse(errText) as { error?: { message?: string; type?: string } }
    upstreamMsg = String(parsed.error?.message ?? '').trim()
  } catch {
    upstreamMsg = errText.trim().slice(0, 200)
  }

  if (status === 402 || /insufficient balance/i.test(upstreamMsg)) {
    return 'DeepSeek 账户余额不足（402）：请在 https://platform.deepseek.com 充值或更换有余额的 API Key，并更新 server/.env 中的 DEEPSEEK_API_KEY。'
  }
  if (status === 401 || /invalid.*api.*key|authentication/i.test(upstreamMsg)) {
    return 'DeepSeek API Key 无效或未授权（401）：请检查 server/.env 中的 DEEPSEEK_API_KEY 是否正确。'
  }
  if (status === 503) {
    return upstreamMsg.includes('DEEPSEEK_API_KEY')
      ? '本地 AI 代理未配置密钥：请在 server/.env 填写 DEEPSEEK_API_KEY 并运行 npm run dev:api。'
      : `AI 服务暂不可用（503）${upstreamMsg ? `：${upstreamMsg}` : ''}`
  }
  if (status === 502) {
    return `无法连接 DeepSeek 上游（502）${upstreamMsg ? `：${upstreamMsg}` : '，请检查网络或代理服务是否在运行。'}`
  }
  return `DeepSeek 请求失败（${status}）${upstreamMsg ? `：${upstreamMsg}` : errText ? `：${errText.slice(0, 120)}` : ''}`
}

async function deepseekChatCompletion(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<string> {
  const url = chatCompletionsUrl()
  if (!url) {
    throw new Error(
      '未配置 AI 代理地址：生产构建请设置 VITE_AI_API_BASE（见 docs/ENV-说明.md）',
    )
  }
  const body: Record<string, unknown> = {
    model: options?.model ?? DEEPSEEK_MODEL_DEFAULT,
    messages,
    temperature: options?.temperature ?? 0.35,
  }
  if (options?.maxTokens != null && options.maxTokens > 0) {
    body.max_tokens = options.maxTokens
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Wengu-Ai-Source': WENGU_AI_SOURCE,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(formatDeepSeekFetchError(res.status, errText))
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const text = parseAssistantContent(data.choices?.[0]?.message?.content)
  if (!text) throw new Error('DeepSeek 未返回有效内容')
  return text
}

export type LectureNotesProgress = (message: string) => void

/**
 * 资料整理：识别富文本中的图片文字 + 用户文字，整理为带加粗重点的讲义 Markdown。
 */
export async function requestLectureNotesFromMaterial(
  sourceHtml: string,
  options?: { onProgress?: LectureNotesProgress },
): Promise<string> {
  const images = extractImagesFromRichHtml(sourceHtml)
  const textOnly = richHtmlToPlainTextOnly(sourceHtml)

  if (images.length >= getMaxMaterialImages()) {
    options?.onProgress?.(`图片较多，仅处理前 ${getMaxMaterialImages()} 张…`)
  }

  let imageOcrText = ''
  if (images.length > 0) {
    options?.onProgress?.(`共 ${images.length} 张图片，正在本地识别文字（首次会加载字库）…`)
    imageOcrText = await ocrImagesLocally(images, options?.onProgress)
  }

  if (!textOnly.trim() && !imageOcrText.trim()) {
    throw new Error('请先在左侧粘贴文字或图片（Ctrl+V 粘贴截图）')
  }

  const chunks: string[] = []
  if (textOnly.trim()) chunks.push(`【用户输入的文字】\n${textOnly}`)
  if (imageOcrText.trim()) chunks.push(`【从图片识别出的文字】\n${imageOcrText}`)

  const body = truncatePlainText(chunks.join('\n\n'), LECTURE_MATERIAL_MAX)
  options?.onProgress?.('正在根据全文整理讲义…')

  const user = `【用户明确要求】${MATERIAL_LECTURE_USER_GOAL}

请严格按用户要求完成：依据下方「从图片识别出的文字」与「用户输入的文字」，整理为结构化讲义 Markdown，并把重点用 **加粗** 标出。

【你必须做到】
1. 以 OCR 识别出的附图文字为**主要依据**（若有附图），与用户文字说明合并整理；使用 \`#\`、\`##\`、\`###\` 分层。
2. 忠实原文，**不得编造**未出现的史实、数据、人名；看不清处可保留 OCR 原样或标注存疑。
3. 核心概念、结论、时间、易错点、关键词等必须用 **加粗**。
4. **禁止**写「如何转换图片」「假设附图内容」「示例」「讲义制作指南」等元说明；**禁止**复述本提示。
5. 只输出讲义正文（简体中文），无代码围栏，无前言后记。

【资料全文】
${body}`

  const text = await deepseekChatRaw(user, {
    system: `你是专业的课程讲义整理助手。用户要求：${MATERIAL_LECTURE_USER_GOAL}。你已收到从图片 OCR 得到的全文，请直接整理讲义并加粗重点，不要写教程或假设性示例。`,
    temperature: 0.35,
    model: DEEPSEEK_MODEL_HEAVY,
  })
  const md = stripMindmapMarkdownFence(text)
  if (!md) throw new Error('DeepSeek 未返回有效的讲义内容')
  return md
}


/**
 * 学习工具「思维导图」：根据用户粘贴的长文，生成可供 markmap 渲染的 Markdown 树。
 */
export async function requestMindmapMarkdownFromSourceText(
  sourceText: string,
  options?: {
    partIndex?: number
    partTotal?: number
    /** 全书总标题（若有），本段导图禁止照抄为 `#` 根节点 */
    documentThemeTitle?: string | null
    /** 据本段材料推断的本段主题（时期 / 章节 / 板块） */
    segmentThemeTitle?: string | null
  },
): Promise<string> {
  const raw = sourceText.trim()
  if (!raw) throw new Error('请先粘贴需要整理的学习材料')

  const body = truncatePlainText(raw, MINDMAP_SOURCE_TEXT_MAX)
  const docTheme = options?.documentThemeTitle?.trim()
  const segmentTheme = options?.segmentThemeTitle?.trim()
  const segmentRootHint =
    segmentTheme ?
      `\n【本段导图根主题 — 最重要】
- 输出**第一行必须是** \`# …\`（建议概括名：「${segmentTheme}」），概括本段讲哪一块（6～18 字），**禁止**缺省、禁止文首直接以 \`##\` 开头而无 \`#\`。
- 其下用 \`##\` 列各知识点，\`###\` 列细节。${docTheme ? `**禁止**把全书总标题「${docTheme}」或仅写时期范围（如「新时代 (2012至今)」）当作 \`#\`；\`#\` 要比 \`##\` 更上位、更有概括性。` : ''}\n`
    : options?.partTotal != null && options.partTotal > 1
      ? `\n【本段导图根主题】文首必须有概括性 \`#\` 标题；${docTheme ? `勿用全书总标题「${docTheme}」或空泛时期名充当 \`#\`。` : ''}再用 \`##\` 列各小节。\n`
      : `\n【导图根主题】文首必须有概括性 \`#\` 标题（6～18 字），概括本篇材料核心板块。\n`
  const partHint =
    options?.partTotal != null &&
    options.partTotal > 1 &&
    options.partIndex != null
      ? `\n【分段说明】这是用户全文的第 ${options.partIndex + 1} / ${options.partTotal} 段，**仅根据本段内容**生成导图，不要编造本段未出现的内容，也不要假设其他段落的内容。${segmentRootHint}`
      : segmentRootHint

  const user = `以下是用户提供的原始学习材料（纯文本）。请输出可供 markmap 渲染的 Markdown 思维导图。
${partHint}

【核心目标】
**禁止只堆名词、标语或干条目**。学习者没看过原文也要能懂：每个 \`###\` 知识点下，子项必须是**完整句子的通俗讲解**，该举例时要举例。

【通俗讲解 — 每一条都要有，不得遗漏】
- \`###\` 下**每一条**讲解子项都必须带通俗说法，禁止只写教材式正式句就结束。
- **正式与通俗必须分两行**：先写 \`- **标签**：正式句（≤40 字）\`，再写子项 \`- 通俗：……（≤40 字）\`；**禁止**把正式与通俗接在同一行（否则导图分支过长）。
- **是什么** 也不能例外：除时间、地点、决议名称外，必须跟 \`通俗：\` 说明「对普通人意味着什么」。
- 其他标签（意义、任务、方针、路线等）**同样每条必有通俗**；不要出现「有的子项有通俗、有的只有官方表述」这种不一致。
- 子项格式：\`- **标签**：……；通俗：……\` 或带嵌套通俗子项。标签可灵活，但冒号后必须是**可独立读懂的完整句**。
- 每个 \`###\` 知识点**至少**含：1 条「是什么」（含通俗）+ 1～3 条相关讲解（**每条含通俗**）+ 能举例时 1 条 \`例 🇨🇳\`（例不加粗）；**事件/会议类另加** 1 条「历史背景」（含通俗，见下）。
- \`###\` 标题下**禁止**只有标题、禁止只写一行关键词就结束；未展开的考点须补全讲解与通俗，勿留空壳节点。

【历史事件与会议 — 须补背景】
- 涉及**历史事件、会议、起义、运动、战争、重大转折**的 \`###\` 节点，除常规讲解外，**必须**有 1 条 \`**历史背景**\`（可放在「是什么」之前或之后）：
  - 用 1～2 句交代**时代局势、前因后果**（如国共关系、白色恐怖、革命处于什么阶段等），让读者知道「为什么这时发生」；
  - 同样须带 \`通俗：\`；关键时代特征、矛盾用语加 \`**\` 加粗。
- 仍遵守同级 ≤4 条：背景 + 是什么 + 意义/任务/决策等择 1～2 条 + 例，**不要**为凑背景而超出 4 条同级项（可把背景与「为什么」合并，但事件类优先单独写背景）。

【讲解方式 — 参考「是什么 / 为什么 / 怎么做 / 例」，可灵活微调】
- 以上角度是**帮助写全讲解**的，不是机械凑四条；**以说清为准**，但该解释、该背景不能省。
- 类型参考：定义型（是什么 + 要点/区分 + 例）；分类对比型（是什么 + 怎么区分 + 例）；**事件/会议型（历史背景 + 是什么 + 意义/任务/方针 + 例）**。
- 与上文重复或材料没有的**整条省略**，不写「无」、不写空洞套话。

【长度与拆分 — 硬性 ≤40 字/分支】
- **每条** \`-\` 列表项（从标签到句末）**不得超过 40 个汉字**；超出必须**拆成多条分支**（可并列多条 \`- **标签**：…\`，或续行嵌套子项 \`- …\`）。
- 一句里多个意思（用「；」连接）**必须拆成多条**，如「最高纲领 + 最低纲领」写两条，不要挤在一行。
- 「核心任务」含奋斗目标、中心任务等多项时，**每项单独一条**，每条仍 ≤40 字且配通俗子项。

【标题与主题 — 必遵守】
1. \`#\` \`##\` \`###\` 标题**禁止写序号**：不要「1.」「2.」「六、」「（一）」等开头。
2. 标题用**概括性短语**（如「主要矛盾与基本国情」「四个全面战略布局」），不要照抄材料长句、口号全文或带序号的目录条。
3. \`#\` 是本段总领（比 \`##\` 更上位）；\`##\` 是并列大知识点。勿用仅表示时期范围的短句当 \`#\` 而又在 \`##\` 重复列具体考点。

【分支数量与方向性 — 硬性上限 4 条】
- **同一父节点下直接子分支最多 4 条**（并列 \`##\` / \`###\` / \`####\`，或 \`###\` 下顶层 \`-\` 列表项）。**绝不可**出现 5～9 条平级分支（如一大下列 9 条）。
- 超过 4 条时，**必须先加 \`####\` 分支类型**再归类，推荐 4 类（按材料选用）：
  - \`#### 时代背景\`（历史背景、为什么等）
  - \`#### 会议概况\`（是什么）
  - \`#### 任务与方略\`（纲领、中心任务、方针等）
  - \`#### 组织与影响\`（选举、意义、例 🇨🇳 等）
- 每条 \`####\` 类型下再放 ≤4 条 \`-\` 讲解（含嵌套通俗子项）；**禁止**把「历史背景、是什么、核心任务、选举、例」全部平铺在 \`###\` 同一层。
- 分组要有**阅读顺序/逻辑方向**，让读者先抓主线再进细节，例如：
  - 按「背景与矛盾 → 目标任务 → 布局举措 → 保障要求」；
  - 或「是什么 → 为什么 → 怎么做/意义」；
  - 或按领域：经济 / 政治 / 文化社会 / 党建军事（择一种最贴材料的，勿混用太多套）。
- 父节点下优先 **2～4 条**即可，宁可用中间层归纳，也不要一次列出 5～9 个平级关键词。

【粒度与层级 — 细但不乱】
- 内容要拆成**短句、可记忆的子要点**，但**纵向加深层级**，不要**横向摊太多同级分支**。
- 推荐层级：\`#\` → \`##\`（≤4）→ \`###\` 事件/知识点（≤4）→ \`####\` 分支类型（≤4）→ \`-\` 讲解（每组 ≤4，通俗用子项）→ 必要时再嵌套。
- 会议类 \`###\` 示例结构：\`### 党的一大\` 下只有 4 个 \`####\`（时代背景 / 会议概况 / 任务与方略 / 组织与影响），**不要** 9 条同级 \`-\`。
- 材料考点要覆盖，但通过**分组归纳**呈现，不要牺牲结构清晰度。

【结构与风格】
1. 层级：\`#\` → \`##\`（≤4 个方向）→ \`###\`（每组 ≤4）→ 列表细节；**先方向、后细节**。
2. 节点标题前加贴切 **emoji**（勿堆砌）。
3. 表述通俗易懂。

【加粗重点 — 不可遗漏】
- 凡**解释性条目**（历史背景、是什么、为什么、意义、任务、方针、路线等）的正文中，对以下内容必须用 \`**…**\` 标出，**每个 \`###\` 知识点约 3～6 处**，不要整段无加粗：
  - 会议/事件名称与年份、纲领党章名称、路线方针提法、核心论断与口号、重要人物与职务、易混概念对比点。
- 加粗与 \`通俗：\` **同时出现**：先写带加粗的正式句，再写通俗，不要因加了通俗就省略加粗。
- **「例 🇨🇳」整条不得加粗**。

【禁止】
- 禁止**部分子项有通俗、部分没有**；禁止历史事件/会议类缺少 \`**历史背景**\`；禁止「是什么」只写决议原文而无 \`通俗：\`。
- 禁止解释性正文**该加粗却不加粗**（整段无 \`**\`）。
- 禁止单条分支超过 **40 字**；禁止正式与通俗写在同一行。
- 禁止同一层级下出现 **5 个及以上**并列分支（含 \`###\` 下平铺多条 \`-\`）；禁止不用 \`####\` 归类就把历史背景、是什么、任务、选举、例排成一排。
- 禁止只列术语/职务/年份；禁止 \`###\` 空节点或只有标题无列表子项。
- 禁止标题带序号；禁止无 \`#\` 开头；禁止「例」里加粗；禁止单条超长不换行。
- 禁止前言、后记、代码围栏。

【输出格式】
- 只输出 Markdown；\`-\` 列表可多级嵌套；简体中文。

【原始材料】
${body}`

  const text = await deepseekChatRaw(user, {
    system:
      '你是思维导图助教。###下用≤4个####归类（时代背景/会议概况/任务与方略/组织与影响），禁止9条平铺；每分支≤40字；通俗子项；**加粗**；例不加粗。',
    temperature: 0.38,
    model: DEEPSEEK_MODEL_HEAVY,
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
  options?: { system?: string; temperature?: number; maxTokens?: number; model?: string },
): Promise<string> {
  return deepseekChatCompletion(
    [
      {
        role: 'system',
        content:
          options?.system ??
          '你是专业、严谨的学习助手，只输出用户要求的格式，使用简体中文。',
      },
      { role: 'user', content: user },
    ],
    {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      model: options?.model ?? DEEPSEEK_MODEL_DEFAULT,
    },
  )
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
  const user = `下面是一则思维导图草稿（Markdown）。其中 **加粗** 的文字是核心考点。\n\n请你根据全文**丰富程度**生成 **5～10 道** 测验用选择题：加粗要点多、层次丰富时尽量出满 **10 道**；内容较简略时不少于 **5 道**，并优先覆盖所有重要加粗要点。\n\n**出题比例（必须遵守）**：\n- **至少约 80%** 的题目要**主要考查加粗文字**对应的概念、结论或关系（正确选项的判据应能对应到这些加粗要点）。\n- **至多约 20%** 的题目可考查**非加粗**但结合上下文仍需理解的内容（如结构、层级、衔接），且必须**严格依据原文**，不得编造文中没有的信息。\n\n**关于“举例/案例”内容的命题约束（必须遵守）**：\n- 如果原文里出现“例如、举例、案例、样例、情景”等示例内容，**不要把示例原文直接当题干或正确选项**。\n- 可以把示例作为启发，改写为新的情境或换一个同类例子，题目要回到**考点本身**（概念、原理、关系、判据）而不是记忆某个示例句子。\n- 禁止仅做表面替换（改几个词仍是同一例子）；应做到“同考点、非原例、可迁移”。\n\n**防泄题（必须遵守）**：\n- 题干 stem 中**不得**出现 correct 数组里任一正确选项的原文、加粗考点的完整复述，或与正确项高度重合的短语。\n- 若题目问「某概括/评价/定位对应什么」，题干只写背景与提问指向，**不要把答案短语写进题干**。\n- 错误示例：题干写「被概括为"立党之本、执政之基、力量之源"……对应什么地位？」，而
选项却是「立党之本、执政之基、力量之源」——题干已泄题。\n- 正确示例：题干写「"三个代表"重要思想在党史上的地位，常被概括为下列哪一表述？」——各表述放在选项中供辨析。\n\n**格式要求**：\n- 每道题 5 个选项：correct 为所有正确选项文本数组，distractors 为所有错误选项文本数组；|correct|+|distractors| 必须等于 5。\n- mode 为 single 时 correct 长度必须为 1，distractors 长度 4；mode 为 multiple 时 correct 长度至少 2，distractors 长度 = 5 - |correct|。\n- 题干 stem 不要直接照抄加粗原句、示例原句；不得泄露任何正确选项原文。\n- 使用简体中文。\n\n思维导图标题：${input.title.trim() || '（无）'}\n\n---\n${md}\n---\n\n仅返回 JSON 数组（长度在 5～10 之间），元素字段：stem, mode, correct, distractors。不要 markdown 代码块或其它说明。`

  const raw = await deepseekChatRaw(user, {
    system:
      '只输出合法 JSON 数组，长度 5～10。不要输出 markdown 围栏。加粗相关题目须占绝大多数。题干不得包含正确选项原文或泄题短语。',
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
    if (mcqStemLeaksAnswer(stem, correct)) continue
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
