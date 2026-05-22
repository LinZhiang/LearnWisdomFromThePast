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
