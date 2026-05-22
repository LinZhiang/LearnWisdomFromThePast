import type { InjectionKey } from 'vue'
import type { ChoiceQuestionPayload } from '@/utils/choiceQuestion'

export const questionBankEditorChoicePayloadKey: InjectionKey<ChoiceQuestionPayload> = Symbol(
  'question-bank-editor-choice-payload',
)
