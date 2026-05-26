export interface LearningType {
  id?: number
  parentId?: number
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface QuestionBank {
  id?: number
  type: 'general' | 'choice' | 'mindmap'
  title: string
  learningTypeId?: number
  content: string
  analysis: string
  score: number
  createdAt: string
  updatedAt: string
}

/** 题库测验 AI 预生成结果（干扰项 / 导图小题），按题目持久化以减少重复扣费 */
export type QuestionBankAiPrepKind = 'choice-distractors' | 'mindmap-mcqs'

export interface QuestionBankAiPrep {
  id?: number
  questionBankId: number
  kind: QuestionBankAiPrepKind
  /** 题目内容指纹；与当前题目不一致时视为过期并重新生成 */
  fingerprint: string
  payloadJson: string
  updatedAt: string
}

/** 测验中导图衍生选择题的快照（非题库独立行） */
export type FavoriteDerivedMcqPayload = {
  kind: 'mindmap-mcq'
  parentQuestionBankId: number
  parentTitle: string
  stem: string
  options: string[]
  correctIndices: number[]
  mode: 'single' | 'multiple'
  subIndex: number
  subTotal: number
}

export interface FavoriteQuestion {
  id?: number
  /** 与题库左侧树一致，用于按学习类型筛选 */
  learningTypeId: number
  /** 直接对应题库题目；导图衍生小题此项为空 */
  questionBankId?: number
  /** `FavoriteDerivedMcqPayload` 的 JSON 字符串 */
  derivedPayloadJson?: string
  note?: string
  createdAt: string
}

export interface QuestionScore {
  id?: number
  questionBankId: number
  score: number
  userName: string
  createdAt: string
}

/** 按自然日累计的前台活跃时长（秒），用于「学习分数」学习用时统计 */
export interface DailyWebUsage {
  id?: number
  /** 本地日期 YYYY-MM-DD */
  dateKey: string
  activeSeconds: number
  updatedAt: string
}

/** 用户手动填报的当日工作/出差时长 */
export interface WorkTimeLog {
  id?: number
  dateKey: string
  /** 时长（分钟） */
  minutes: number
  /** 工作 | 出差 */
  kind: 'work' | 'trip'
  note?: string
  createdAt: string
}

/** 用户手动填报的锻炼时长（用于武分奖励与历史展示） */
export interface ExerciseTimeLog {
  id?: number
  dateKey: string
  /** 时长（分钟） */
  minutes: number
  /** 一般运动 | 剧烈运动 */
  kind: 'general' | 'intense'
  note?: string
  createdAt: string
}

export interface ScoreRanking {
  id?: number
  userName: string
  totalScore: number
  rank: number
  createdAt: string
  updatedAt: string
}

export interface AnswerLog {
  id?: number
  questionBankId?: number
  userName: string
  answer: string
  isCorrect: boolean
  createdAt: string
  /** 同一次「题目测试」会话 id（IndexedDB 索引） */
  quizSessionId?: string
  /** 测验所选学习类型节点名称 */
  learningTypeLabel?: string
}

/**
 * 错题本记录（含普通题、选择题、导图衍生小题）
 * reviewStage 按艾宾浩斯间隔推进：1d -> 2d -> 4d -> 7d -> 15d
 */
export interface WrongQuestion {
  id?: number
  learningTypeId: number
  questionBankId?: number
  /** 导图衍生小题快照：`FavoriteDerivedMcqPayload` JSON */
  derivedPayloadJson?: string
  /** 题型：general/choice/mindmap-mcq */
  questionType: 'general' | 'choice' | 'mindmap-mcq'
  title: string
  /** 导图衍生小题题干 */
  stem?: string
  wrongCount: number
  reviewStage: number
  lastWrongAt: string
  nextReviewAt: string
  lastQuizSessionId?: string
  /**
   * 连续在不同测验场次中该题满分次数（同一场 quizSessionId 只计 1 次）。
   * 连续满 3 场测验后自动移出错题本；再次答错时清零。
   */
  fullScoreQuizStreak?: number
  /** 最近一次为 streak 计分的题目测试会话 id */
  fullScoreStreakLastSessionId?: string
  createdAt: string
  updatedAt: string
}

/** 历史日志回填去重标记：同一答题日志仅回填一次 */
export interface WrongQuestionBackfillLog {
  id?: number
  answerLogId: number
  processedAt: string
}

/** 错题回收站（用于恢复删除） */
export interface WrongQuestionTrash {
  id?: number
  originalWrongQuestionId?: number
  payloadJson: string
  deletedAt: string
}
