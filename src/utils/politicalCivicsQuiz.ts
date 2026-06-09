/** 政治常识 / 时政类材料：自动出题时可结合近期时事热点作题干情境 */

const STRONG_TITLE_RE =
  /政治|党史|时政|中国特色社会主义|马克思主义|毛泽东思想|习近平新时代|习思想|邓小平理论|三个代表|科学发展观|公基|常识|国情|依法治国|依法执政|思想理论|形势与政策|形势政策/

const CONTENT_KEYWORDS = [
  '中国共产党',
  '社会主义',
  '马克思主义',
  '新时代',
  '二十大',
  '全会',
  '两会',
  '全国人大',
  '人民政协',
  '改革开放',
  '民族复兴',
  '中国式现代化',
  '四个自信',
  '四个意识',
  '两个维护',
  '一带一路',
  '基本国策',
  '人民当家作主',
  '民主集中制',
  '共产主义',
  '初级阶段',
  '主要矛盾',
  '基本路线',
  '党章',
  '党中央',
  '党的路线',
  '政府工作报告',
  '强军',
  '外交',
  '宪法',
  '政权',
  '纲领',
  '路线方针',
  '会议精神',
  '治国理政',
  '新发展理念',
  '高质量发展',
  '共同富裕',
  '脱贫攻坚',
  '乡村振兴',
] as const

export const AI_POLITICAL_CURRENT_EVENTS_QUIZ_RULES = `**政治常识 / 时政类题目（材料属此类时必须遵守）**：
- 若材料主要考查党史、时政、中国特色社会主义理论、国家大政方针、国情常识等，本批题目中应**适量**（约 **30%～60%**，视考点匹配度）采用「**时事热点情境 + 材料考点**」的题干写法。
- 时事情境宜选用**近半年至一年内**国内广为人知的重大成就、会议、政策或社会热点（如重大航天任务、国家级战略工程、重要会议精神落地、重大科技突破等），作为题干背景或引子；可自然提及具体任务/会议名称（须事实准确）。
- 考查重心仍须落在**学习材料中的政治知识点**（概念、关系、方针、意义、易混辨析等），不得以纯新闻复述代替考点；热点仅作情境，答案依据须能回溯材料。
- 题干示例：「结合近期××（如载人航天、重大会议、国家战略等），下列说法正确的是…」「××事件体现了材料中哪一论断/精神/布局」——促使用户把热点与所学理论、史实联系起来。
- **事实准确**：涉及时事数据、名称、时间须与公开权威信息一致；若对某热点细节不确定，改用更稳妥、广为人知的事件，或弱化为「近年来我国航天事业」等概括表述，**禁止编造新闻**。
- 非政治类材料（如纯计算机、数学、外语）**不要**强行套用时政情境。`

function countKeywordHits(text: string): number {
  let n = 0
  for (const kw of CONTENT_KEYWORDS) {
    if (text.includes(kw)) n++
  }
  return n
}

/** 根据标题与正文节选判断是否为政治常识 / 时政类学习材料 */
export function isPoliticalCivicsMaterial(
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
  if (hits >= 2 && /党|社会主义|马克思主义|中国特色社会主义/.test(combined)) return true
  return false
}

export function formatCurrentEventsTimeAnchor(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return `【时事参考】当前为 ${y} 年 ${m} 月；命题时可结合此前约半年至一年内的国内外重大时事热点（以公开权威信息为准）。`
}

/** 政治常识类材料时返回时事情境出题规则块，否则返回空字符串 */
export function politicalCurrentEventsQuizRulesBlock(
  title: string,
  bodyText: string,
  extraTexts: string[] = [],
): string {
  if (!isPoliticalCivicsMaterial(title, bodyText, extraTexts)) return ''
  return `${AI_POLITICAL_CURRENT_EVENTS_QUIZ_RULES}\n\n${formatCurrentEventsTimeAnchor()}`
}

/** 在 AI 用户提示末尾追加政治常识时事情境规则（按需） */
export function appendPoliticalCurrentEventsQuizRules(
  baseUser: string,
  title: string,
  bodyText: string,
  extraTexts: string[] = [],
): string {
  const block = politicalCurrentEventsQuizRulesBlock(title, bodyText, extraTexts)
  if (!block) return baseUser
  return `${baseUser}\n\n${block}`
}
