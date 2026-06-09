<script setup lang="ts">
import type { QuestionBank } from '@/db/models'
import type { QuestionFavoriteTarget } from '@/services/favorite-question-helpers'
import { sanitizeRichHtml } from '@/utils/sanitize'
import DeepseekGeneralAssist from './DeepseekGeneralAssist.vue'
import QuestionBankFavoriteButton from './QuestionBankFavoriteButton.vue'
import RichTextEditor from './RichTextEditor.vue'

defineProps<{
  question: QuestionBank
  generalSubmitted: boolean
  generalMistakeAware: boolean
  maxScore: number
  /** 错题本：不显示分值，作答后选对/选错 */
  binarySelfGrade?: boolean
  currentIndex: number
  learningTypeId?: number | null
  favoriteTarget?: QuestionFavoriteTarget | null
}>()

const answerHtml = defineModel<string>('answerHtml', { required: true })
const selfScore = defineModel<number>('selfScore', { required: true })
const generalSelfCorrect = defineModel<boolean | null>('generalSelfCorrect', { required: true })

defineEmits<{
  (e: 'inject', html: string): void
  (e: 'submit-general'): void
  (e: 'next-general'): void
}>()

const safe = (html?: string) => sanitizeRichHtml(html ?? '')
</script>

<template>
  <div class="test-q-head">
    <h4 class="test-q-title">{{ question.title }}</h4>
    <div class="test-q-head-right">
      <QuestionBankFavoriteButton
        v-if="learningTypeId != null && favoriteTarget"
        :learning-type-id="learningTypeId"
        :target="favoriteTarget"
      />
      <span v-if="!binarySelfGrade" class="test-score-tag">分值 {{ question.score ?? 0 }} 分</span>
    </div>
  </div>
  <div class="test-section">
    <h5>题干与材料</h5>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="test-rich ql-snow ql-editor" v-html="safe(question.content)" />
  </div>
  <div class="test-section test-rich-editor-tall">
    <h5>作答（富文本）</h5>
    <RichTextEditor v-model="answerHtml" placeholder="在此输入你的作答…" />
  </div>
  <template v-if="!generalSubmitted">
    <DeepseekGeneralAssist
      :title="question.title"
      :content-html="question.content ?? ''"
      enable-answer-inject
      @inject="$emit('inject', $event)"
    />
    <el-button type="primary" @click="$emit('submit-general')">提交作答</el-button>
  </template>
  <template v-else>
    <div class="test-section">
      <h5>解析</h5>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="test-rich ql-snow ql-editor" v-html="safe(question.analysis)" />
    </div>
    <div class="test-section test-mcq-deepseek">
      <h5>{{ generalMistakeAware ? 'DeepSeek 错因解析' : 'DeepSeek 解答' }}</h5>
      <DeepseekGeneralAssist
        :key="`general-post-${question.id}-${currentIndex}`"
        :title="question.title"
        :content-html="question.content ?? ''"
        :analysis-html="question.analysis ?? ''"
        :mistake-aware="generalMistakeAware"
        :reflective-user-answer-html="answerHtml"
        enable-answer-inject
        @inject="$emit('inject', $event)"
      />
    </div>
    <div v-if="binarySelfGrade" class="test-section test-binary-verdict">
      <h5>对照解析，本题答得对吗？</h5>
      <p class="test-muted">错题本只记录对错，无需打分。请诚实自评后进入下一题。</p>
      <div class="test-binary-verdict-actions" role="group" aria-label="自评对错">
        <el-button
          :type="generalSelfCorrect === true ? 'success' : 'default'"
          size="large"
          @click="generalSelfCorrect = true"
        >
          答对了
        </el-button>
        <el-button
          :type="generalSelfCorrect === false ? 'danger' : 'default'"
          size="large"
          plain
          @click="generalSelfCorrect = false"
        >
          答错了
        </el-button>
      </div>
    </div>
    <div v-else class="test-section test-self-score">
      <h5>根据解析自评得分</h5>
      <p class="test-muted">
        本题满分 {{ maxScore }} 分，请根据掌握程度在 0～满分之间打分。
      </p>
      <el-input-number v-model="selfScore" :min="0" :max="maxScore" />
    </div>
    <el-button
      type="primary"
      :disabled="binarySelfGrade && generalSelfCorrect == null"
      @click="$emit('next-general')"
    >
      下一题
    </el-button>
  </template>
</template>

<style scoped>
.test-rich-editor-tall :deep(.ql-container.ql-snow) {
  min-height: 260px;
}

.test-mcq-deepseek :deep(.deepseek-assist) {
  padding-top: 0;
}

.test-muted {
  margin: 0;
  color: var(--app-text-muted);
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

.test-self-score {
  max-width: 360px;
}

.test-binary-verdict-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.test-binary-verdict-actions :deep(.el-button) {
  min-width: 120px;
}
</style>
