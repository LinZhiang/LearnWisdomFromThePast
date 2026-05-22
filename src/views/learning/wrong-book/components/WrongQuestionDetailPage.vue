<script setup lang="ts">
import { computed } from 'vue'
import type { QuestionBank, WrongQuestion } from '@/db/models'
import { parseWrongDerivedPayload } from '@/services/wrong-question-helpers'
import { parseChoiceQuestionContent } from '@/utils/choiceQuestion'
import { sanitizeRichHtml } from '@/utils/sanitize'
import DeepseekGeneralAssist from '@/views/learning/question-bank/components/DeepseekGeneralAssist.vue'

const props = defineProps<{
  row: WrongQuestion
  learningTypeName: string
  sourceQuestion: QuestionBank | null
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const safe = (html?: string) => sanitizeRichHtml(html ?? '')

const typeLabel = computed(() => {
  if (props.row.questionType === 'mindmap-mcq') return '导图衍生小题'
  if (props.row.questionType === 'choice') return '选择题型'
  return '一般题型'
})

const derivedPayload = computed(() => parseWrongDerivedPayload(props.row.derivedPayloadJson))
const derivedCorrectAnswers = computed(() => {
  const p = derivedPayload.value
  if (!p) return []
  return p.correctIndices
    .slice()
    .sort((a, b) => a - b)
    .map((i) => p.options[i])
    .filter(Boolean)
})

const sourceChoiceCorrectAnswers = computed(() => {
  if (props.sourceQuestion?.type !== 'choice') return []
  return parseChoiceQuestionContent(props.sourceQuestion.content ?? '').correctAnswers
    .map((s) => s.trim())
    .filter(Boolean)
})

const displayCorrectAnswers = computed(() => {
  if (derivedCorrectAnswers.value.length) return derivedCorrectAnswers.value
  return sourceChoiceCorrectAnswers.value
})

const displayAnalysisHtml = computed(() => {
  const t = props.sourceQuestion?.analysis?.trim() ?? ''
  return t
})

const isChoiceLike = computed(
  () =>
    props.row.questionType === 'choice' ||
    props.row.questionType === 'mindmap-mcq' ||
    props.sourceQuestion?.type === 'choice',
)

const formatTime = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
</script>

<template>
  <section class="wrong-detail-page">
    <header class="wrong-detail-topbar">
      <div>
        <h3 class="wrong-title">{{ row.title }}</h3>
        <ul class="wrong-meta" aria-label="错题信息">
          <li class="meta-chip">{{ typeLabel }}</li>
          <li class="meta-chip meta-chip-muted">{{ learningTypeName }}</li>
          <li class="meta-chip meta-chip-muted">错误 {{ row.wrongCount }} 次</li>
          <li class="meta-chip meta-chip-muted">下次复习 {{ formatTime(row.nextReviewAt) }}</li>
        </ul>
      </div>
      <el-button plain @click="emit('back')">返回列表</el-button>
    </header>

    <div class="wrong-detail-body">
      <div class="detail-section">
        <h4>题目内容</h4>
        <template v-if="isChoiceLike">
          <p v-if="row.stem" class="detail-text"><strong>题干：</strong>{{ row.stem }}</p>
          <p v-if="displayCorrectAnswers.length" class="detail-text">
            <strong>正确选项：</strong>{{ displayCorrectAnswers.join('；') }}
          </p>
          <p v-else class="detail-text">（该选择题暂无可用的正确选项数据）</p>
        </template>
        <template v-else>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-if="sourceQuestion?.content?.trim()"
            class="detail-rich ql-snow ql-editor"
            v-html="safe(sourceQuestion.content)"
          />
          <p v-else-if="row.stem" class="detail-text">{{ row.stem }}</p>
          <p v-else class="detail-text">（暂无题目内容）</p>
        </template>
      </div>

      <div class="detail-section">
        <h4>复习记录</h4>
        <p class="detail-text">最近做错：{{ formatTime(row.lastWrongAt) }}</p>
        <p class="detail-text">下次复习：{{ formatTime(row.nextReviewAt) }}</p>
      </div>

      <div class="detail-section">
        <h4>题目解析</h4>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="displayAnalysisHtml" class="detail-rich ql-snow ql-editor" v-html="safe(displayAnalysisHtml)" />
        <p v-else class="detail-text">（该题暂无解析）</p>
      </div>

      <div class="detail-section detail-section-deepseek">
        <h4>DeepSeek 解析</h4>
        <DeepseekGeneralAssist
          :title="row.title"
          :analysis-html="sourceQuestion?.analysis ?? ''"
          :content-html="sourceQuestion?.content ?? row.stem ?? ''"
          :choice-mode="derivedPayload?.mode"
          :choice-correct-answers="derivedCorrectAnswers"
          :choice-options="derivedPayload?.options"
          :choice-stem="derivedPayload?.stem"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.wrong-detail-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 56rem;
  margin: 0 auto;
  height: calc(100vh - 7.5rem);
  height: calc(100dvh - 7.5rem);
  overflow: hidden;
}

.wrong-detail-topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--app-surface);
}

.wrong-title {
  margin: 0 0 8px;
  font-size: 1.15rem;
  line-height: 1.4;
}

.wrong-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.meta-chip {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  border: 1px solid var(--app-border-soft);
}

.meta-chip-muted {
  font-weight: 500;
  background: var(--app-surface-alt);
  color: var(--app-text-muted);
}

.wrong-detail-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 14px;
  background: var(--app-surface);
}

.detail-section h4 {
  margin: 0 0 8px;
}

.detail-text {
  margin: 0 0 8px;
  line-height: 1.55;
}

.detail-rich {
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  padding: 10px;
  background: var(--app-surface-alt);
}

.detail-section-deepseek {
  margin-top: 12px;
}
</style>

