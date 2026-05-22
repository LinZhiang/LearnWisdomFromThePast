<script setup lang="ts">
import { nextTick, provide, reactive, ref, watch } from 'vue'
import type { QuestionBank } from '@/db/models'
import {
  parseChoiceQuestionContent,
  serializeChoiceQuestionPayload,
  type ChoiceQuestionPayload,
} from '@/utils/choiceQuestion'
import { htmlToPlainText } from '@/utils/htmlToText'
import DeepseekGeneralAssist from './DeepseekGeneralAssist.vue'
import QuestionBankEditorBasics from './QuestionBankEditorBasics.vue'
import QuestionBankEditorChoiceFields from './QuestionBankEditorChoiceFields.vue'
import QuestionBankEditorFooter from './QuestionBankEditorFooter.vue'
import QuestionBankEditorMindmapFields from './QuestionBankEditorMindmapFields.vue'
import { questionBankEditorChoicePayloadKey } from './questionBankEditorInject'
import RichTextEditor from './RichTextEditor.vue'

type EditorForm = {
  type: QuestionBank['type']
  title: string
  score: string
  content: string
  analysis: string
}

const props = defineProps<{
  mode: 'create' | 'edit'
  loading?: boolean
  initialForm: EditorForm
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'submit', value: EditorForm): void
}>()

const form = reactive<EditorForm>({
  type: 'general',
  title: '',
  score: '0',
  content: '',
  analysis: '',
})

const mindmapFieldsRef = ref<InstanceType<typeof QuestionBankEditorMindmapFields> | null>(null)

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
    form.score = value.type === 'mindmap' ? '0' : value.score
    form.content = value.content
    form.analysis = value.analysis
    if (value.type === 'choice') {
      hydrateChoiceFromForm()
    }
    if (value.type === 'mindmap') {
      void nextTick(() => mindmapFieldsRef.value?.draw())
    }
  },
  { immediate: true },
)

const submit = () => emit('submit', { ...form })

const redrawMindmap = () => {
  void nextTick(() => mindmapFieldsRef.value?.draw())
}

watch(
  () => form.type,
  (t, prev) => {
    if (t === 'mindmap') {
      form.score = '0'
      redrawMindmap()
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
      } else if (prev === 'mindmap') {
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
      <h3>{{ mode === 'edit' ? '编辑题目' : '新增题目' }}</h3>
      <div class="topbar-actions">
        <el-button plain @click="emit('back')">返回列表</el-button>
      </div>
    </div>

    <div class="question-editor-panel">
      <QuestionBankEditorBasics v-model:type="form.type" v-model:title="form.title" />

      <template v-if="form.type === 'mindmap'">
        <QuestionBankEditorMindmapFields
          ref="mindmapFieldsRef"
          v-model:content="form.content"
          v-model:title="form.title"
        />
      </template>

      <template v-else>
        <label>
          <span>题目分数（0+整数）</span>
          <el-input v-model="form.score" inputmode="numeric" />
        </label>
        <label v-if="form.type === 'general'">
          <span>题目内容（富文本）</span>
          <RichTextEditor v-model="form.content" placeholder="请输入题目内容，可上传本地图片" />
        </label>
        <QuestionBankEditorChoiceFields v-else />
        <label>
          <span>题目解析（富文本）</span>
          <RichTextEditor v-model="form.analysis" placeholder="请输入题目解析，可上传本地图片" />
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
  display: grid;
  gap: 12px;
  height: calc(100vh - 230px);
  min-height: 0;
}

.question-editor-topbar {
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
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 14px 14px 26px;
  background: var(--app-surface);
  display: grid;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
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
</style>
