import type { QuestionBank } from '@/db/models'

/**
 * 学习题库统一用户可见称谓。
 * - 「条目」：题库中的一条记录（讲义 / 导图 / 选择题 / 作答题等）
 * - 「内容类型」：条目的种类，不用「题型」（避免与讲义、导图混淆）
 * - 「测验题」：进入测验后展开的单道作答单元
 */
export const QBANK_CONTENT_TYPE_LABELS: Record<QuestionBank['type'], string> = {
  general: '作答题',
  choice: '选择题',
  mindmap: '思维导图',
  handout: '讲义',
}

/** 与 QBANK_CONTENT_TYPE_LABELS 同义，兼容旧引用 */
export const QUESTION_BANK_TYPE_LABELS = QBANK_CONTENT_TYPE_LABELS

/** 测验展开后的单题类型（侧栏、结果、日志） */
export const QBANK_DERIVED_MCQ_LABEL = {
  handout: '讲义选择题',
  mindmap: '导图选择题',
} as const

export const QBANK_DERIVED_GENERAL_LABEL = '讲义计算题'

export const QBANK_DERIVED_JUDGMENT_LABEL = '讲义判断题'

/** 答题日志 / 雷达摘要中的测验单题类型 */
export const QBANK_TEST_UNIT_TYPE_LABELS = {
  general: '作答题',
  choice: '选择题',
  mindmapMcq: '导图选择题',
} as const

export const QBANK_UI = {
  moduleTitle: '学习题库',
  moduleSubtitle: '左侧选择学习类型，右侧管理该类型的学习内容（讲义、导图、试题等）。',
  entryName: '条目',
  entryNamePlural: '条目',
  contentTypeColumn: '内容类型',
  importanceColumn: '重要性',
  testColumn: '测验',
  scoreColumn: '分值',
  testButton: '测验',
  addButton: '新增',
  emptyInNode: '当前节点下暂无学习内容。',
  parentHint: (leafCount: number, entryCount: number) =>
    `父节点汇总 ${leafCount} 个小项，共 ${entryCount} 条学习内容。点击下方分组行可展开/收起；可点击「测验」跨小项测验；新增内容请选择具体小项。`,
  deleteConfirm: '确认删除该条学习内容吗？',
  deleteSuccess: '已删除。',
  createSuccess: '创建成功。',
  updateSuccess: '更新成功。',
  testPageTitle: '测验',
  backToModule: '返回学习题库',
  noTestable: '当前节点下没有可测验的学习内容。',
  previewOnlyHandout: '当前节点仅有「仅预览」讲义，无法开始测验。',
  editorCreateTitle: '新建学习内容',
  editorEditTitle: '编辑学习内容',
  editorContentType: '内容类型',
  editorSaveCreate: '保存并新建',
  editorSaveEdit: '保存修改',
  formScore: '分值（0 及以上整数）',
  formStem: '题干（富文本）',
  formAnalysis: '解析（富文本）',
  detailStem: '题干与材料',
  detailAnalysis: '解析',
  handoutContent: '讲义正文',
  previewOnly: '仅预览',
  testEligible: '可测验',
} as const

export const WRONG_BOOK_UI = {
  scoreColumn: '分值',
  parentHint: (leafCount: number, entryCount: number) =>
    `父节点汇总 ${leafCount} 个小项，共 ${entryCount} 条错题。点击下方分组行可展开/收起。`,
  dueGlobalNotice: (count: number) =>
    `错题本有 ${count} 道题已到复习时间`,
  dueGlobalNoticeShort: (count: number) => `错题 ${count} 道待复习`,
  dueScopeNotice: (count: number) =>
    `当前知识点下有 ${count} 道题已到复习时间，建议进行错题测验。`,
  dueScopePartialGlobal: (scope: number, global: number, branchHint: string) =>
    `全库共 ${global} 道待复习；当前分类 ${scope} 道。另有 ${global - scope} 道在：${branchHint}。可点下方分类名跳转，或点「查看全库到期」。`,
  dueScopeNoneGlobal: (count: number, branchHint: string) =>
    `当前分类暂无到期错题；全库另有 ${count} 道待复习（${branchHint}）。请切换左侧分类，或点「查看全库到期」。`,
} as const

export const FAVORITE_UI = {
  parentHint: (leafCount: number, entryCount: number) =>
    `父节点汇总 ${leafCount} 个小项，共 ${entryCount} 条收藏。点击下方分组行可展开/收起；可点击「测验」跨小项测验。`,
} as const
