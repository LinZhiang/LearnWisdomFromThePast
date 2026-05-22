<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { FavoriteDerivedMcqPayload, QuestionBank } from '@/db/models'
import { questionBankService } from '@/services/data-services'
import type { QuestionFavoriteTarget } from '@/services/favorite-question-helpers'
import { sanitizeRichHtml } from '@/utils/sanitize'
import DeepseekGeneralAssist from '@/views/learning/question-bank/components/DeepseekGeneralAssist.vue'
import QuestionBankFavoriteButton from '@/views/learning/question-bank/components/QuestionBankFavoriteButton.vue'

const props = defineProps<{
  payload: FavoriteDerivedMcqPayload
  learningTypeId: number
  learningTypeName: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const parentQuestion = ref<QuestionBank | null>(null)

const favoriteTarget = (): QuestionFavoriteTarget => ({
  mode: 'derived-mcq',
  payload: props.payload,
})

const safe = (html?: string) => sanitizeRichHtml(html ?? '')

onMounted(() => {
  void (async () => {
    parentQuestion.value =
      (await questionBankService.getById(props.payload.parentQuestionBankId)) ?? null
  })()
})

const correctLabels = () =>
  props.payload.correctIndices
    .slice()
    .sort((a, b) => a - b)
    .map((i) => props.payload.options[i])
    .filter(Boolean)

const deepseekTitle = computed(() => `${props.payload.parentTitle} · 导图小题`)
</script>

<template>
  <section class="favorite-derived-page">
    <header class="derived-topbar">
      <div class="derived-title-block">
        <h3 class="derived-title">{{ payload.parentTitle }}</h3>
        <ul class="derived-meta" aria-label="题目属性">
          <li class="meta-chip">导图衍生小题</li>
          <li class="meta-chip meta-chip-muted">{{ learningTypeName }}</li>
          <li class="meta-chip meta-chip-muted">
            {{ payload.mode === 'single' ? '单选' : '多选' }} · {{ payload.subIndex }}/{{
              payload.subTotal
            }}
          </li>
        </ul>
      </div>
      <div class="derived-actions">
        <QuestionBankFavoriteButton
          :learning-type-id="learningTypeId"
          :target="favoriteTarget()"
          plain
          @removed="emit('back')"
        />
        <el-button plain @click="emit('back')">返回列表</el-button>
      </div>
    </header>

    <div class="derived-body">
      <div class="derived-section">
        <h4>题干</h4>
        <p class="derived-stem">{{ payload.stem }}</p>
      </div>
      <div class="derived-section">
        <h4>选项与正确答案</h4>
        <ul class="derived-options">
          <li
            v-for="(opt, idx) in payload.options"
            :key="idx"
            :class="{ 'is-correct': payload.correctIndices.includes(idx) }"
          >
            <span class="opt-label">{{ String.fromCharCode(65 + idx) }}.</span>
            {{ opt }}
          </li>
        </ul>
        <p class="derived-correct-summary">
          正确项：{{ correctLabels().join('；') || '—' }}
        </p>
      </div>
      <div v-if="parentQuestion?.analysis?.trim()" class="derived-section">
        <h4>题目解析（母题）</h4>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="derived-rich ql-snow ql-editor" v-html="safe(parentQuestion.analysis)" />
      </div>
      <p v-else class="derived-muted">母题暂无解析或母题已删除。</p>
      <div class="derived-section derived-section--deepseek">
        <!-- <h4>DeepSeek 解析</h4> -->
        <DeepseekGeneralAssist
          :key="`${payload.parentQuestionBankId}-${payload.subIndex}-${payload.stem}`"
          :title="deepseekTitle"
          :analysis-html="parentQuestion?.analysis ?? ''"
          :choice-mode="payload.mode"
          :choice-correct-answers="correctLabels()"
          :choice-options="payload.options"
          :choice-stem="payload.stem"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.favorite-derived-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 56rem;
  margin: 0 auto;
  min-width: 0;
  /* 与题库详情页保持一致：详情区内滚动，避免整页被内容撑爆 */
  height: calc(100vh - 7.5rem);
  height: calc(100dvh - 7.5rem);
  min-height: 17.5rem;
}

.derived-topbar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--app-surface);
}

.derived-title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.derived-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.derived-meta {
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

.derived-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.derived-body {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 14px;
  background: var(--app-surface);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.derived-section h4 {
  margin: 0 0 8px;
  font-size: 0.95rem;
}

.derived-stem {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
}

.derived-options {
  margin: 0;
  padding-left: 1.1rem;
  list-style: none;
}

.derived-options li {
  padding: 6px 0;
  border-bottom: 1px solid var(--app-border-soft);
}

.derived-options li:last-child {
  border-bottom: none;
}

.opt-label {
  font-weight: 600;
  margin-right: 6px;
}

.is-correct {
  color: var(--app-success, #16a34a);
  font-weight: 600;
}

.derived-correct-summary {
  margin: 10px 0 0;
  font-size: 14px;
  font-weight: 600;
}

.derived-rich {
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  padding: 10px;
  background: var(--app-surface-alt);
  min-height: 48px;
}

.derived-muted {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 14px;
}

.derived-section--deepseek :deep(.deepseek-assist) {
  padding-top: 0;
}
</style>
