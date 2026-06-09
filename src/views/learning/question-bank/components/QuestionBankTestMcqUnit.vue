<script setup lang="ts">
import type { QuestionFavoriteTarget } from '@/services/favorite-question-helpers'
import { sanitizeRichHtml } from '@/utils/sanitize'
import { scoreMcqSelection } from '@/utils/testMcqScore'
import DeepseekGeneralAssist from './DeepseekGeneralAssist.vue'
import QuestionBankFavoriteButton from './QuestionBankFavoriteButton.vue'
import type { TestUnit } from './questionBankTestTypes'

const props = defineProps<{
  unit: Exclude<TestUnit, { kind: 'general' } | { kind: 'handout-general' }>
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
  /** 错题本：不展示本题分值（选择题自动判对错） */
  hideScoreTag?: boolean
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

const isDerivedMcqLike = () =>
  props.unit.kind === 'mindmap-mcq' || props.unit.kind === 'handout-judgment'

const assistTitle = () => {
  const u = props.unit
  if (u.kind === 'mindmap-mcq' || u.kind === 'handout-judgment') {
    return `${u.parent.title} · ${u.stem}`
  }
  return u.question.title
}
</script>

<template>
  <div class="test-q-head">
    <h4 class="test-q-title">
      <template v-if="unit.kind === 'mindmap-mcq'">
        {{ unit.parent.title }}
        <span class="test-subtag">导图选择 {{ unit.subIndex }}/{{ unit.subTotal }}</span>
      </template>
      <template v-else-if="unit.kind === 'handout-judgment'">
        {{ unit.parent.title }}
        <span class="test-subtag">判断 {{ unit.subIndex }}/{{ unit.subTotal }}</span>
      </template>
      <template v-else>{{ unit.question.title }}</template>
    </h4>
    <div class="test-q-head-right">
      <QuestionBankFavoriteButton
        v-if="learningTypeId != null && favoriteTarget"
        :learning-type-id="learningTypeId"
        :target="favoriteTarget"
      />
      <span v-if="!hideScoreTag" class="test-score-tag">本题满分 {{ maxScore }} 分</span>
    </div>
  </div>
  <p v-if="unit.stem" class="test-stem">
    {{ unit.stem }}
  </p>
  <p class="test-mode-hint">
    <template v-if="unit.kind === 'handout-judgment'">判断题：判断上述陈述是否正确</template>
    <template v-else>
      {{ unit.mode === 'single' ? '单选题：选一项' : '多选题：可选多项' }} · 共
      {{ currentOptions.length }} 个选项
    </template>
  </p>

  <template v-if="!mcqSubmitted">
    <el-radio-group v-if="currentMcqMode === 'single'" v-model="selectedSingle" class="test-options">
      <el-radio
        v-for="(opt, idx) in currentOptions"
        :key="idx"
        :label="idx"
        class="test-mcq-option"
      >
        <span class="test-mcq-option__inner">
          <span class="test-mcq-option__letter">{{ String.fromCharCode(65 + idx) }}</span>
          <span class="test-mcq-option__text">{{ opt }}</span>
        </span>
      </el-radio>
    </el-radio-group>
    <el-checkbox-group v-else v-model="selectedMulti" class="test-options">
      <el-checkbox
        v-for="(opt, idx) in currentOptions"
        :key="idx"
        :label="idx"
        class="test-mcq-option"
      >
        <span class="test-mcq-option__inner">
          <span class="test-mcq-option__letter">{{ String.fromCharCode(65 + idx) }}</span>
          <span class="test-mcq-option__text">{{ opt }}</span>
        </span>
      </el-checkbox>
    </el-checkbox-group>

    <div class="test-assist-block">
      <el-button type="primary" plain :loading="assistLoading" @click="$emit('run-assist')">
        智能答题思路（不泄题）
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
      <div v-for="(opt, idx) in currentOptions" :key="idx" class="test-mcq-option test-mcq-option--readonly">
        <span class="test-mcq-option__inner">
          <span class="test-mcq-option__letter">{{ String.fromCharCode(65 + idx) }}</span>
          <span
            class="test-mcq-option__text"
            :class="{
              'is-correct': unit.correctIndices.includes(idx),
              'is-wrong': selectedIndices.includes(idx) && !unit.correctIndices.includes(idx),
            }"
          >
            {{ opt }}
          </span>
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
      <h5>解析</h5>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="test-rich ql-snow ql-editor" v-html="safe(analysisForCurrent)" />
    </div>
    <div v-if="correctLabels.length" class="test-section test-mcq-deepseek">
      <h5>{{ mcqMistakeAware ? '智能错因解析' : '智能解答' }}</h5>
      <DeepseekGeneralAssist
        :title="assistTitle()"
        :choice-mode="unit.mode"
        :choice-correct-answers="correctLabels"
        :analysis-html="analysisForCurrent"
        :mistake-aware="mcqMistakeAware"
        :choice-user-selected-texts="mcqUserSelectedLabels"
        :choice-options="currentOptions"
        :choice-stem="isDerivedMcqLike() ? unit.stem : undefined"
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
}

.test-mode-hint {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

.test-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
  width: 100%;
}

.test-options.el-radio-group,
.test-options.el-checkbox-group {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

/* 每行：单选框 + 字母 + 正文，与题干左缘对齐 */
.test-options :deep(.test-mcq-option.el-radio),
.test-options :deep(.test-mcq-option.el-checkbox) {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  column-gap: 8px;
  align-items: center;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 6px 10px;
  height: auto;
  min-height: 0;
  box-sizing: border-box;
  white-space: normal;
  line-height: 1.45;
  border: 1px solid color-mix(in srgb, var(--app-border-soft) 55%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--app-surface) 38%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.test-options :deep(.test-mcq-option.el-radio.is-checked),
.test-options :deep(.test-mcq-option.el-checkbox.is-checked) {
  border-color: color-mix(in srgb, var(--el-color-primary-light-5, #93c5fd) 70%, transparent);
  background: color-mix(in srgb, var(--el-color-primary-light-9, #eff6ff) 52%, transparent);
}

.test-options :deep(.test-mcq-option .el-radio__input),
.test-options :deep(.test-mcq-option .el-checkbox__input) {
  grid-column: 1;
  grid-row: 1;
  align-self: center;
  margin: 0;
  height: auto;
  line-height: 1;
}

.test-options :deep(.test-mcq-option .el-radio__label),
.test-options :deep(.test-mcq-option .el-checkbox__label) {
  grid-column: 2;
  grid-row: 1;
  flex: none;
  width: 100%;
  min-width: 0;
  padding-left: 0 !important;
  margin-left: 0 !important;
  white-space: normal;
  line-height: inherit;
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
}

.test-mcq-option__inner {
  display: flex;
  align-items: baseline;
  gap: 0.45em;
  width: 100%;
  min-width: 0;
}

.test-mcq-option__letter {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 0.92em;
  line-height: inherit;
  color: var(--app-text-muted);
}

.test-mcq-option__letter::after {
  content: '.';
  margin-left: 0.05em;
}

.test-mcq-option__text {
  flex: 1;
  min-width: 0;
  line-height: inherit;
  word-break: break-word;
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
}

.test-error {
  margin: 0;
  color: var(--app-danger, #dc2626);
  font-size: 13px;
}

.test-mcq-option--readonly {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  column-gap: 8px;
  align-items: center;
  padding: 6px 10px;
  line-height: 1.45;
  border: 1px solid color-mix(in srgb, var(--app-border-soft) 55%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--app-surface) 38%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-sizing: border-box;
}

.test-mcq-option--readonly .test-mcq-option__inner {
  grid-column: 2;
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
