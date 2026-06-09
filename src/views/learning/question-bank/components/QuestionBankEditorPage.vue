<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { nextTick, provide, reactive, ref, watch } from 'vue'
import { markdownHasUnresolvedEmbedRefs } from '@/utils/markdownEmbeddedImages'
import type { QuestionBank } from '@/db/models'
import { QBANK_UI } from '@/constants/question-bank-copy'
import { questionBankNoScoreType } from '@/constants/question-bank-types'
import {
  HANDOUT_GENERAL_COUNT_DEFAULT,
  HANDOUT_JUDGMENT_COUNT_DEFAULT,
  HANDOUT_MCQ_COUNT_DEFAULT,
} from '@/utils/handoutQuestion'
import {
  parseChoiceQuestionContent,
  serializeChoiceQuestionPayload,
  validateChoiceQuestionJson,
  type ChoiceQuestionPayload,
} from '@/utils/choiceQuestion'
import { htmlToPlainText } from '@/utils/htmlToText'
import DeepseekGeneralAssist from './DeepseekGeneralAssist.vue'
import QuestionBankEditorBasics from './QuestionBankEditorBasics.vue'
import QuestionBankEditorChoiceFields from './QuestionBankEditorChoiceFields.vue'
import QuestionBankEditorFooter from './QuestionBankEditorFooter.vue'
import QuestionBankEditorHandoutFields from './QuestionBankEditorHandoutFields.vue'
import QuestionBankEditorMindmapFields from './QuestionBankEditorMindmapFields.vue'
import { questionBankEditorChoicePayloadKey } from './questionBankEditorInject'
import RichTextEditor from './RichTextEditor.vue'

export type QuestionBankEditorForm = {
  type: QuestionBank['type']
  title: string
  learningTypeId?: string
  score: string
  content: string
  analysis: string
  handoutAutoMcq: boolean
  handoutMcqCount: number
  handoutAutoGeneral: boolean
  handoutGeneralCount: number
  handoutAutoJudgment: boolean
  handoutJudgmentCount: number
}

const props = defineProps<{
  mode: 'create' | 'edit'
  loading?: boolean
  initialForm: QuestionBankEditorForm
  createLearningTypeName?: string
  learningTypeOptions?: { value: number; label: string }[]
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'submit', value: QuestionBankEditorForm): void
}>()

const form = reactive<QuestionBankEditorForm>({
  type: 'general',
  title: '',
  learningTypeId: '',
  score: '0',
  content: '',
  analysis: '',
  handoutAutoMcq: false,
  handoutMcqCount: HANDOUT_MCQ_COUNT_DEFAULT,
  handoutAutoGeneral: false,
  handoutGeneralCount: HANDOUT_GENERAL_COUNT_DEFAULT,
  handoutAutoJudgment: false,
  handoutJudgmentCount: HANDOUT_JUDGMENT_COUNT_DEFAULT,
})

const mindmapFieldsRef = ref<InstanceType<typeof QuestionBankEditorMindmapFields> | null>(null)
const handoutFieldsRef = ref<InstanceType<typeof QuestionBankEditorHandoutFields> | null>(null)

const choiceUiHydrating = ref(false)

const choicePayload = reactive<ChoiceQuestionPayload>({
  mode: 'single',
  correctAnswers: [''],
})

provide(questionBankEditorChoicePayloadKey, choicePayload)

const hydrateChoiceFromForm = () => {
  choiceUiHydrating.value = true
  const p = parseChoiceQuestionContent(form.content)
  choicePayload.mode = p.mode
  choicePayload.correctAnswers.splice(0, choicePayload.correctAnswers.length, ...p.correctAnswers)
  if (choicePayload.mode === 'multiple' && choicePayload.correctAnswers.length < 2) {
    choicePayload.correctAnswers.push('')
  }
  form.content = serializeChoiceQuestionPayload(choicePayload)
  void nextTick(() => {
    choiceUiHydrating.value = false
  })
}

watch(
  choicePayload,
  () => {
    if (form.type !== 'choice' || choiceUiHydrating.value) return
    form.content = serializeChoiceQuestionPayload(choicePayload)
  },
  { deep: true },
)

watch(
  () => choicePayload.mode,
  (mode, prev) => {
    if (choiceUiHydrating.value || form.type !== 'choice') return
    if (prev === undefined) return
    if (mode === 'single') {
      const first =
        choicePayload.correctAnswers.find((a) => a.trim()) ?? choicePayload.correctAnswers[0] ?? ''
      choicePayload.correctAnswers.splice(0, choicePayload.correctAnswers.length, first)
    } else {
      const xs = choicePayload.correctAnswers.filter((a) => a.trim())
      if (xs.length >= 2) {
        choicePayload.correctAnswers.splice(0, choicePayload.correctAnswers.length, ...xs)
      } else if (xs.length === 1) {
        choicePayload.correctAnswers.splice(0, choicePayload.correctAnswers.length, xs[0], '')
      } else {
        choicePayload.correctAnswers.splice(0, choicePayload.correctAnswers.length, '', '')
      }
    }
  },
)

watch(
  () => props.initialForm,
  (value) => {
    form.type = value.type
    form.title = value.title
    form.learningTypeId = value.learningTypeId ?? ''
    form.score = questionBankNoScoreType({ type: value.type } as QuestionBank) ? '0' : value.score
    form.content = value.content
    form.analysis = value.analysis
    form.handoutAutoMcq = value.handoutAutoMcq
    form.handoutMcqCount = value.handoutMcqCount
    form.handoutAutoGeneral = value.handoutAutoGeneral
    form.handoutGeneralCount = value.handoutGeneralCount
    form.handoutAutoJudgment = value.handoutAutoJudgment
    form.handoutJudgmentCount = value.handoutJudgmentCount
    if (value.type === 'choice') {
      hydrateChoiceFromForm()
    }
    if (value.type === 'mindmap') {
      void nextTick(() => mindmapFieldsRef.value?.draw())
    }
  },
  { immediate: true },
)

const submit = () => {
  if (!form.title.trim()) {
    ElMessage.error('名称不能为空。')
    return
  }
  if (props.mode === 'edit' && !form.learningTypeId?.trim()) {
    ElMessage.error('请选择所属分类。')
    return
  }
  if (form.type === 'handout') {
    const flushed = handoutFieldsRef.value?.flushContentForSave()
    if (flushed != null) {
      form.content = flushed
    }
    if (markdownHasUnresolvedEmbedRefs(form.content)) {
      ElMessage.error(
        '讲义中有图片占位符未带上实际图片数据，保存会丢失多媒体内容。请重新插入图片，或从备份 Markdown 恢复后再保存。',
      )
      return
    }
    if (!form.content.trim()) {
      ElMessage.error('讲义 Markdown 内容不能为空。')
      return
    }
  }
  if (form.type === 'mindmap' && !form.content.trim()) {
    ElMessage.error('思维导图文字不能为空。')
    return
  }
  if (form.type === 'choice') {
    const cv = validateChoiceQuestionJson(form.content)
    if (!cv.ok) {
      ElMessage.error(cv.message ?? '请完善选择题。')
      return
    }
    if (!htmlToPlainText(form.analysis).trim()) {
      ElMessage.error('解析不能为空。')
      return
    }
  }
  if (form.type === 'general') {
    if (!htmlToPlainText(form.content).trim()) {
      ElMessage.error('题干不能为空。')
      return
    }
    if (!htmlToPlainText(form.analysis).trim()) {
      ElMessage.error('解析不能为空。')
      return
    }
  }
  emit('submit', { ...form })
}

const redrawMindmap = () => {
  void nextTick(() => mindmapFieldsRef.value?.draw())
}

watch(
  () => form.type,
  (t, prev) => {
    if (t === 'mindmap' || t === 'handout') {
      form.score = '0'
      if (t === 'mindmap') redrawMindmap()
      if (t === 'handout' && prev !== 'handout') {
        form.analysis = ''
      }
    } else if (t === 'choice') {
      if (prev === 'general') {
        const plain = htmlToPlainText(form.content)
        choiceUiHydrating.value = true
        choicePayload.mode = 'single'
        choicePayload.correctAnswers.splice(0, choicePayload.correctAnswers.length, plain || '')
        form.content = serializeChoiceQuestionPayload(choicePayload)
        void nextTick(() => {
          choiceUiHydrating.value = false
        })
      } else if (prev === 'mindmap' || prev === 'handout') {
        choiceUiHydrating.value = true
        choicePayload.mode = 'single'
        choicePayload.correctAnswers.splice(0, choicePayload.correctAnswers.length, '')
        form.content = serializeChoiceQuestionPayload(choicePayload)
        void nextTick(() => {
          choiceUiHydrating.value = false
        })
      }
    } else if (t === 'general' && prev === 'choice') {
      form.content = ''
    }
  },
)
</script>

<template>
  <section class="question-editor-page">
    <div class="question-editor-topbar">
      <h3>{{ mode === 'edit' ? QBANK_UI.editorEditTitle : QBANK_UI.editorCreateTitle }}</h3>
      <div class="topbar-actions">
        <el-button plain @click="emit('back')">返回列表</el-button>
      </div>
    </div>

    <div
      class="question-editor-panel"
      :class="{ 'question-editor-panel--handout': form.type === 'handout' }"
    >
      <QuestionBankEditorBasics
        v-model:type="form.type"
        v-model:title="form.title"
        v-model:learning-type-id="form.learningTypeId"
        :mode="mode"
        :create-learning-type-name="createLearningTypeName"
        :learning-type-options="learningTypeOptions"
      />

      <template v-if="form.type === 'mindmap'">
        <QuestionBankEditorMindmapFields
          ref="mindmapFieldsRef"
          v-model:content="form.content"
          v-model:title="form.title"
        />
      </template>

      <template v-else-if="form.type === 'handout'">
        <QuestionBankEditorHandoutFields
          ref="handoutFieldsRef"
          v-model:content="form.content"
          v-model:handout-auto-mcq="form.handoutAutoMcq"
          v-model:handout-mcq-count="form.handoutMcqCount"
          v-model:handout-auto-general="form.handoutAutoGeneral"
          v-model:handout-general-count="form.handoutGeneralCount"
          v-model:handout-auto-judgment="form.handoutAutoJudgment"
          v-model:handout-judgment-count="form.handoutJudgmentCount"
          @import-title="form.title = $event"
        />
        <DeepseekGeneralAssist
          class="handout-deepseek"
          :title="form.title"
          :content-html="form.content"
          analysis-html=""
        />
      </template>

      <template v-else>
        <label>
          <span>{{ QBANK_UI.formScore }}</span>
          <el-input v-model="form.score" inputmode="numeric" />
        </label>
        <label v-if="form.type === 'general'">
          <span>{{ QBANK_UI.formStem }}</span>
          <RichTextEditor v-model="form.content" placeholder="请输入题干，可上传本地图片" />
        </label>
        <QuestionBankEditorChoiceFields v-else />
        <label>
          <span>{{ QBANK_UI.formAnalysis }}</span>
          <RichTextEditor v-model="form.analysis" placeholder="请输入解析，可上传本地图片" />
        </label>
        <DeepseekGeneralAssist
          v-if="form.type === 'general'"
          :title="form.title"
          :content-html="form.content"
          :analysis-html="form.analysis"
        />
        <DeepseekGeneralAssist
          v-else-if="form.type === 'choice'"
          :title="form.title"
          :analysis-html="form.analysis"
          :choice-mode="choicePayload.mode"
          :choice-correct-answers="choicePayload.correctAnswers"
        />
      </template>
      <QuestionBankEditorFooter
        :mode="mode"
        :loading="loading"
        @cancel="emit('back')"
        @submit="submit"
      />
    </div>
  </section>
</template>

<style scoped>
.question-editor-page {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.question-editor-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--app-surface);
}

.question-editor-topbar h3 {
  margin: 0;
  font-size: 18px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.question-editor-panel {
  flex: 1 1 auto;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 14px 14px 26px;
  background: var(--app-surface);
  display: grid;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  overflow-x: auto;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
  align-content: start;
}

.question-editor-panel label {
  display: grid;
  gap: 8px;
}

.question-editor-panel label > span {
  color: var(--app-text-muted);
  font-size: 13px;
}

:deep(.ql-container) {
  min-height: 140px;
}

.question-editor-panel--handout {
  display: block;
  padding-bottom: 14px;
}
</style>
