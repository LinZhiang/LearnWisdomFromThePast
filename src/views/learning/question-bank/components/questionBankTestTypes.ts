import type { QuestionBank } from '@/db/models'
import type { WrongQuestionTarget } from '@/services/wrong-question-helpers'

/** 错题本变式测验：绑定列表行 id / 定位键，避免变式题干或重复记录导致复习不更新 */
export type WrongBookTestLink = {
  wrongBookTarget?: WrongQuestionTarget
  wrongBookRowId?: number
}

export type TestUnit =
  | (WrongBookTestLink & { kind: 'general'; question: QuestionBank })
  | (WrongBookTestLink & {
      kind: 'choice'
      question: QuestionBank
      options: string[]
      correctIndices: number[]
      mode: 'single' | 'multiple'
      /** 错题本等场景下 DeepSeek 生成的新题干（有则展示在标题下方） */
      stem?: string
    })
  | (WrongBookTestLink & {
      kind: 'mindmap-mcq'
      parent: QuestionBank
      stem: string
      options: string[]
      correctIndices: number[]
      mode: 'single' | 'multiple'
      subIndex: number
      subTotal: number
    })
  | (WrongBookTestLink & {
      kind: 'handout-general'
      parent: QuestionBank
      stem: string
      referenceAnswer: string
      analysis: string
      knowledgePoint: string
      score: number
      subIndex: number
      subTotal: number
    })
  | (WrongBookTestLink & {
      kind: 'handout-judgment'
      parent: QuestionBank
      stem: string
      options: string[]
      correctIndices: number[]
      mode: 'single'
      analysis: string
      knowledgePoint: string
      subIndex: number
      subTotal: number
    })

export type ResultRow = {
  unitIndex: number
  title: string
  detail: string
  typeLabel: string
  score: number
  maxScore: number
}

export type TestPhase = 'idle' | 'building' | 'ready' | 'running' | 'summary'

export type QuestionBankTestLeafEntryPayload =
  | { scope: 'all' }
  | { scope: 'partial'; questionIds: number[] }

export type QuestionBankTestEntryPayload = {
  learningTypeIds: number[]
  /** choice 含思维导图（测验时展开为选择题） */
  includeChoiceLike: boolean
  includeGeneral: boolean
  includeJudgment: boolean
  /**
   * 测验小题上限；省略或 ≤0 表示在勾选范围内尽量出满全部可生成题（含 AI 展开的选择/计算题）
   */
  questionCount?: number
}

/** 进入测验页时的构建配置（含小项覆盖顺序） */
export type QuestionBankTestBuildConfig = QuestionBankTestEntryPayload
