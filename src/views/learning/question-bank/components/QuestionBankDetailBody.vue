<script setup lang="ts">
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import { computed, nextTick, ref, watch } from 'vue'
import type { QuestionBank } from '@/db/models'
import { parseChoiceQuestionContent } from '@/utils/choiceQuestion'
import { sanitizeRichHtml } from '@/utils/sanitize'
import DeepseekGeneralAssist from './DeepseekGeneralAssist.vue'
import MarkmapSvgPreview from './MarkmapSvgPreview.vue'

const props = defineProps<{
  question: QuestionBank
}>()

const safe = (html?: string) => sanitizeRichHtml(html ?? '')

const isMindmap = computed(() => props.question.type === 'mindmap')
const isGeneral = computed(() => props.question.type === 'general')
const isChoice = computed(() => props.question.type === 'choice')

const choiceParsed = computed(() =>
  isChoice.value ? parseChoiceQuestionContent(props.question.content ?? '') : null,
)

const choiceModeLabel = computed(() =>
  choiceParsed.value?.mode === 'multiple' ? '多选' : '单选',
)

const choiceAnswersDisplay = computed(() => {
  const p = choiceParsed.value
  if (!p) return []
  return p.correctAnswers.map((s) => s.trim()).filter(Boolean)
})

const mindmapMarkdown = computed(() => props.question.content ?? '')

const formatTime = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const scrollEl = ref<HTMLElement | null>(null)

watch(
  () => props.question.id,
  () => {
    nextTick(() => {
      scrollEl.value?.scrollTo(0, 0)
    })
  },
)
</script>

<template>
  <div class="detail-body">
    <div v-if="isMindmap" ref="scrollEl" class="detail-scroll detail-scroll--mindmap">
      <div class="detail-mindmap-wrap">
        <MarkmapSvgPreview :markdown="mindmapMarkdown" live fill-parent :initial-expand-level="3" />
      </div>
    </div>
    <div v-else ref="scrollEl" class="detail-scroll">
      <div class="detail-section">
        <h4>题目内容</h4>
        <div v-if="isChoice" class="choice-detail-content">
          <p class="choice-detail-mode">选项类型：<strong>{{ choiceModeLabel }}</strong></p>
          <p class="choice-detail-label">正确答案</p>
          <ul v-if="choiceAnswersDisplay.length" class="choice-detail-answers">
            <li v-for="(a, i) in choiceAnswersDisplay" :key="i">{{ a }}</li>
          </ul>
          <p v-else class="choice-detail-empty">（未填写正确答案）</p>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="detail-rich ql-snow ql-editor" v-html="safe(question.content)" />
      </div>
      <div class="detail-section">
        <h4>题目解析</h4>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="detail-rich ql-snow ql-editor" v-html="safe(question.analysis)" />
      </div>
      <DeepseekGeneralAssist
        v-if="isGeneral"
        :key="question.id"
        :title="question.title"
        :content-html="question.content ?? ''"
        :analysis-html="question.analysis ?? ''"
      />
      <DeepseekGeneralAssist
        v-else-if="isChoice"
        :key="question.id"
        :title="question.title"
        :analysis-html="question.analysis ?? ''"
        :choice-mode="choiceParsed!.mode"
        :choice-correct-answers="choiceParsed!.correctAnswers"
      />
      <footer class="detail-footer-meta">
        <span>创建：{{ formatTime(question.createdAt) }}</span>
        <span>更新：{{ formatTime(question.updatedAt) }}</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.detail-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface);
  overflow: hidden;
}

.detail-scroll--mindmap {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  padding: 6px 8px 8px;
  overflow: hidden;
}

.detail-mindmap-wrap {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.detail-scroll {
  flex: 1;
  min-height: 0;
  padding: 16px 18px 18px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.detail-section + .detail-section {
  margin-top: 1.5rem;
}

.detail-section h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.detail-rich {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 14px 16px;
  background: var(--app-surface-alt);
  min-height: 3rem;
  line-height: 1.65;
  max-width: 100%;
  overflow-x: auto;
}

.detail-rich :deep(img) {
  max-width: 100%;
  height: auto;
}

.choice-detail-content {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 14px 16px;
  background: var(--app-surface-alt);
  font-size: 14px;
  line-height: 1.65;
  color: var(--app-text, inherit);
}

.choice-detail-mode {
  margin: 0 0 10px;
}

.choice-detail-label {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.choice-detail-answers {
  margin: 0;
  padding-left: 1.25em;
}

.choice-detail-answers li {
  margin: 0.35em 0;
}

.choice-detail-empty {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

.detail-footer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  font-size: 12px;
  color: var(--app-text-muted);
  border-top: 1px solid var(--app-border-soft);
  margin-top: 1.5rem;
  padding-top: 1rem;
}
</style>
