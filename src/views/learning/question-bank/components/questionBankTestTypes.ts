import type { QuestionBank } from '@/db/models'

export type TestUnit =
  | { kind: 'general'; question: QuestionBank }
  | {
      kind: 'choice'
      question: QuestionBank
      options: string[]
      correctIndices: number[]
      mode: 'single' | 'multiple'
    }
  | {
      kind: 'mindmap-mcq'
      parent: QuestionBank
      stem: string
      options: string[]
      correctIndices: number[]
      mode: 'single' | 'multiple'
      subIndex: number
      subTotal: number
    }

export type ResultRow = {
  unitIndex: number
  title: string
  detail: string
  typeLabel: string
  score: number
  maxScore: number
}

export type TestPhase = 'idle' | 'building' | 'running' | 'summary'

export type QuestionBankTestLeafEntryPayload =
  | { scope: 'all' }
  | { scope: 'partial'; questionIds: number[] }

export type QuestionBankTestEntryPayload = {
  learningTypeIds: number[]
  /** choice 含思维导图（测验时展开为选择题） */
  includeChoiceLike: boolean
  includeGeneral: boolean
  /** 测验小题总数（含思维导图展开后的选择题；生成时按此数量截断） */
  questionCount: number
}

/** 进入测验页时的构建配置（含小项覆盖顺序） */
export type QuestionBankTestBuildConfig = QuestionBankTestEntryPayload
