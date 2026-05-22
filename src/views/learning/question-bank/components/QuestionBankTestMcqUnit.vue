<script setup lang="ts">
import type { QuestionFavoriteTarget } from '@/services/favorite-question-helpers'
import { sanitizeRichHtml } from '@/utils/sanitize'
import { scoreMcqSelection } from '@/utils/testMcqScore'
import DeepseekGeneralAssist from './DeepseekGeneralAssist.vue'
import QuestionBankFavoriteButton from './QuestionBankFavoriteButton.vue'
import type { TestUnit } from './questionBankTestTypes'

const props = defineProps<{
  unit: Exclude<TestUnit, { kind: 'general' }>
  mcqSubmitted: boolean
  currentOptions: string[]
  currentMcqMode: 'single' | 'multiple' | null
  assistHtml: string
  assistLoading: boolean
  assistError: string
  analysisForCurrent: string
  correctLabels: string[]
  mcqMistakeAware: boolean
  mcqUserSelectedLabels: string[]
  maxScore: number
  selectedIndices: number[]
  currentIndex: number
  learningTypeId?: number | null
  favoriteTarget?: QuestionFavoriteTarget | null
}>()

defineEmits<{
  (e: 'run-assist'): void
  (e: 'submit-mcq'): void
  (e: 'next-mcq'): void
}>()

const selectedSingle = defineModel<number | null>('selectedSingle', { required: true })
const selectedMulti = defineModel<number[]>('selectedMulti', { required: true })

const safe = (html?: string) => sanitizeRichHtml(html ?? '')

const displayScore = () =>
  Math.round(
    scoreMcqSelection(props.unit.correctIndices, props.selectedIndices, props.maxScore) * 100,
  ) / 100

const assistTitle = () =>
  props.unit.kind === 'mindmap-mcq'
    ? `${props.unit.parent.title} · ${props.unit.stem}`
    : props.unit.question.title
</script>

<template>
  <div class="test-q-head">
    <h4 class="test-q-title">
      <template v-if="unit.kind === 'mindmap-mcq'">
        {{ unit.parent.title }}
        <span class="test-subtag">导图小题 {{ unit.subIndex }}/{{ unit.subTotal }}</span>
      </template>
      <template v-else>{{ unit.question.title }}</template>
    </h4>
    <div class="test-q-head-right">
      <QuestionBankFavoriteButton
        v-if="learningTypeId != null && favoriteTarget"
        :learning-type-id="learningTypeId"
        :target="favoriteTarget"
      />
      <span class="test-score-tag">本题满分 {{ maxScore }} 分</span>
    </div>
  </div>
  <p v-if="unit.kind === 'mindmap-mcq'" class="test-stem">{{ unit.stem }}</p>
  <p class="test-mode-hint">
    {{ unit.mode === 'single' ? '单选题：选一项' : '多选题：可选多项' }} · 共 5 个选项
  </p>

  <template v-if="!mcqSubmitted">
    <el-radio-group v-if="currentMcqMode === 'single'" v-model="selectedSingle" class="test-options">
      <el-radio v-for="(opt, idx) in currentOptions" :key="idx" :label="idx" class="test-radio-line">
        <span class="test-opt-label">{{ String.fromCharCode(65 + idx) }}.</span>
        {{ opt }}
      </el-radio>
    </el-radio-group>
    <el-checkbox-group v-else v-model="selectedMulti" class="test-options">
      <el-checkbox v-for="(opt, idx) in currentOptions" :key="idx" :label="idx" class="test-checkbox-line">
        <span class="test-opt-label">{{ String.fromCharCode(65 + idx) }}.</span>
        {{ opt }}
      </el-checkbox>
    </el-checkbox-group>

    <div class="test-assist-block">
      <el-button type="primary" plain :loading="assistLoading" @click="$emit('run-assist')">
        DeepSeek 答题思路（不泄题）
      </el-button>
      <p v-if="assistError" class="test-error">{{ assistError }}</p>
      <div v-if="assistHtml" class="test-assist-md deepseek-md">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-html="assistHtml" />
      </div>
    </div>
    <el-button type="primary" @click="$emit('submit-mcq')">提交作答</el-button>
  </template>
  <template v-else>
    <div class="test-options test-options--readonly">
      <div v-for="(opt, idx) in currentOptions" :key="idx" class="test-opt-row">
        <span class="test-opt-label">{{ String.fromCharCode(65 + idx) }}.</span>
        <span
          :class="{
            'is-correct': unit.correctIndices.includes(idx),
            'is-wrong': selectedIndices.includes(idx) && !unit.correctIndices.includes(idx),
          }"
        >
          {{ opt }}
        </span>
      </div>
    </div>
    <div class="test-section">
      <h5>正确答案</h5>
      <ul class="test-correct-list">
        <li v-for="(t, i) in correctLabels" :key="i">{{ t }}</li>
      </ul>
    </div>
    <div v-if="analysisForCurrent.trim()" class="test-section">
      <h5>题目解析</h5>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="test-rich ql-snow ql-editor" v-html="safe(analysisForCurrent)" />
    </div>
    <div v-if="correctLabels.length" class="test-section test-mcq-deepseek">
      <h5>{{ mcqMistakeAware ? 'DeepSeek 错因解析' : 'DeepSeek 解答' }}</h5>
      <DeepseekGeneralAssist
        :title="assistTitle()"
        :choice-mode="unit.mode"
        :choice-correct-answers="correctLabels"
        :analysis-html="analysisForCurrent"
        :mistake-aware="mcqMistakeAware"
        :choice-user-selected-texts="mcqUserSelectedLabels"
        :choice-options="currentOptions"
        :choice-stem="unit.kind === 'mindmap-mcq' ? unit.stem : undefined"
      />
    </div>
    <p class="test-score-result">本题得分：{{ displayScore() }} / {{ maxScore }} 分</p>
    <el-button type="primary" @click="$emit('next-mcq')">下一题</el-button>
  </template>
</template>

<style scoped>
.test-mcq-deepseek :deep(.deepseek-assist) {
  padding-top: 0;
}

.test-q-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.test-q-head-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.test-q-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.test-subtag {
  display: inline-block;
  margin-left: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--app-text-muted);
}

.test-score-tag {
  font-size: 0.9rem;
  color: var(--app-primary, #2563eb);
  font-weight: 600;
  white-space: nowrap;
}

.test-section h5 {
  margin: 0 0 8px;
  font-size: 0.95rem;
}

.test-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.test-rich {
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  padding: 10px;
  background: var(--app-surface-alt);
  min-height: 48px;
}

.test-stem {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
}

.test-mode-hint {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

.test-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  width: 100%;
}

/* 与拆分前一致：每个选项独占一行（避免 el-radio/el-checkbox 默认横向排列） */
.test-options :deep(.el-radio),
.test-options :deep(.el-checkbox) {
  display: flex;
  align-items: flex-start;
  width: 100%;
  max-width: 100%;
  margin-right: 0;
  margin-bottom: 0;
  height: auto;
  min-height: 32px;
  white-space: normal;
  line-height: 1.5;
}

.test-options :deep(.el-radio__input),
.test-options :deep(.el-checkbox__input) {
  display: inline-flex;
  align-items: flex-start;
  line-height: 1;
  flex-shrink: 0;
}

.test-options :deep(.el-radio__label),
.test-options :deep(.el-checkbox__label) {
  flex: 1;
  min-width: 0;
  white-space: normal;
  line-height: 1.5;
  padding-left: 8px;
}

.test-radio-line,
.test-checkbox-line {
  margin: 0;
  align-items: flex-start;
  white-space: normal;
  height: auto;
  line-height: 1.5;
}

.test-opt-label {
  font-weight: 600;
  margin-right: 6px;
}

.test-assist-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0;
}

.test-assist-md {
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--app-surface-alt);
  font-size: 14px;
  line-height: 1.6;
}

.test-error {
  margin: 0;
  color: var(--app-danger, #dc2626);
  font-size: 13px;
}

.test-options--readonly .test-opt-row {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--app-border-soft);
}

.test-options--readonly .test-opt-row:last-child {
  border-bottom: none;
}

.is-correct {
  color: var(--app-success, #16a34a);
  font-weight: 600;
}

.is-wrong {
  color: var(--app-danger, #dc2626);
  text-decoration: line-through;
}

.test-correct-list {
  margin: 0;
  padding-left: 1.2rem;
}

.test-score-result {
  margin: 0;
  font-weight: 600;
}

.deepseek-md :deep(p) {
  margin: 0.5em 0;
}

.deepseek-md :deep(ul) {
  margin: 0.5em 0;
  padding-left: 1.25em;
}
</style>
