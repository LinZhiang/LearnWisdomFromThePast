<script setup lang="ts">
import { ElMessage } from 'element-plus'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, ref } from 'vue'
import { htmlToPlainText } from '@/utils/htmlToText'
import {
  isAiChatConfigured,
  requestChoiceMistakeAwareSolve,
  requestGeneralMistakeAwareSolve,
  requestQuestionSolve,
} from '@/services/deepseek'
import { hashForAiCache, rememberAiResponse } from '@/utils/aiResponseCache'

const props = defineProps<{
  title: string
  analysisHtml?: string
  /** 一般题型：富文本 HTML */
  contentHtml?: string
  /** 选择题型：与 contentHtml 二选一传入 */
  choiceMode?: 'single' | 'multiple'
  choiceCorrectAnswers?: string[]
  /** 测验模式：在 AI 解答后将 HTML 填入富文本作答区 */
  enableAnswerInject?: boolean
  /**
   * 为 true 时使用「错因对照」提示词（需配合学员作答或所选选项）。
   * 为 false 时仍走常规讲解。
   */
  mistakeAware?: boolean
  /** 一般题型错题模式：学员作答 HTML */
  reflectiveUserAnswerHtml?: string
  /** 选择题错题模式：学员所选选项的完整文案（顺序不限） */
  choiceUserSelectedTexts?: string[]
  /** 选择题错题模式：与测验一致的选项列表 */
  choiceOptions?: string[]
  /** 选择题错题模式：导图小题题干等 */
  choiceStem?: string
}>()

const emit = defineEmits<{
  (e: 'inject', html: string): void
}>()

const loading = ref(false)
const answer = ref('')
const error = ref('')

const hasAiProxy = computed(() => isAiChatConfigured())

const isChoiceAssist = computed(
  () => props.choiceMode != null && props.choiceCorrectAnswers != null,
)

const isChoiceMistake = computed(
  () =>
    Boolean(props.mistakeAware && isChoiceAssist.value && Array.isArray(props.choiceUserSelectedTexts)),
)

const isGeneralMistake = computed(
  () =>
    Boolean(
      props.mistakeAware &&
        !isChoiceAssist.value &&
        props.reflectiveUserAnswerHtml !== undefined &&
        props.reflectiveUserAnswerHtml !== null,
    ),
)

const canUseAssist = computed(() => {
  if (!hasAiProxy.value) return false
  if (isChoiceMistake.value) {
    const mode = props.choiceMode!
    const ans = props.choiceCorrectAnswers!.map((s) => s.trim()).filter(Boolean)
    if (!props.title.trim()) return false
    if (mode === 'single' && ans.length < 1) return false
    if (mode === 'multiple' && ans.length < 2) return false
    return (props.choiceOptions?.length ?? 0) >= 2
  }
  if (isGeneralMistake.value) {
    if (!props.title.trim()) return false
    return Boolean(
      htmlToPlainText(props.contentHtml ?? '') || htmlToPlainText(props.analysisHtml ?? ''),
    )
  }
  if (isChoiceAssist.value) {
    const mode = props.choiceMode!
    const ans = props.choiceCorrectAnswers!.map((s) => s.trim()).filter(Boolean)
    if (!props.title.trim()) return false
    if (mode === 'single') return ans.length >= 1
    return ans.length >= 2
  }
  return Boolean(props.title.trim() || htmlToPlainText(props.contentHtml ?? ''))
})

const solveButtonLabel = computed(() =>
  props.mistakeAware ? 'DeepSeek 错因解析' : 'DeepSeek 解答',
)

const answerHtml = computed(() => {
  const md = answer.value.trim()
  if (!md) return ''
  const raw = marked.parse(md, { async: false })
  if (typeof raw !== 'string') return ''
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
})

const onSolve = async () => {
  error.value = ''
  loading.value = true
  try {
    const cacheKey = `assist:${hashForAiCache(
      JSON.stringify({
        title: props.title,
        analysisHtml: props.analysisHtml ?? '',
        contentHtml: props.contentHtml ?? '',
        choiceMode: props.choiceMode,
        choiceCorrectAnswers: props.choiceCorrectAnswers,
        choiceOptions: props.choiceOptions,
        choiceStem: props.choiceStem,
        mistakeAware: props.mistakeAware,
        reflectiveUserAnswerHtml: props.reflectiveUserAnswerHtml,
        choiceUserSelectedTexts: props.choiceUserSelectedTexts,
      }),
    )}`
    answer.value = await rememberAiResponse(cacheKey, async () => {
      if (isChoiceMistake.value) {
        return requestChoiceMistakeAwareSolve({
          title: props.title,
          stem: props.choiceStem,
          options: props.choiceOptions ?? [],
          correctAnswerTexts: [...(props.choiceCorrectAnswers ?? [])],
          userSelectedTexts: [...(props.choiceUserSelectedTexts ?? [])],
          analysisHtml: props.analysisHtml,
        })
      }
      if (isGeneralMistake.value) {
        return requestGeneralMistakeAwareSolve({
          title: props.title,
          contentHtml: props.contentHtml ?? '',
          analysisHtml: props.analysisHtml,
          userAnswerHtml: props.reflectiveUserAnswerHtml ?? '',
        })
      }
      if (isChoiceAssist.value) {
        return requestQuestionSolve({
          kind: 'choice',
          title: props.title,
          mode: props.choiceMode!,
          correctAnswers: [...props.choiceCorrectAnswers!],
          analysisHtml: props.analysisHtml,
        })
      }
      return requestQuestionSolve({
        kind: 'general',
        title: props.title,
        contentHtml: props.contentHtml ?? '',
        analysisHtml: props.analysisHtml,
      })
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '请求失败'
    error.value = msg
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

const injectAnswerHtml = () => {
  if (answerHtml.value) emit('inject', answerHtml.value)
}
</script>

<template>
  <div class="deepseek-assist">
    <div class="deepseek-toolbar">
      <el-tooltip
        :disabled="hasAiProxy"
        placement="top"
        content="开发：server/.env 配置 DEEPSEEK_API_KEY 并运行 npm run dev:api；生产：VITE_AI_API_BASE。详见 docs/ENV-说明.md"
      >
        <span class="deepseek-btn-wrap">
          <el-button
            type="primary"
            plain
            :loading="loading"
            :disabled="!canUseAssist"
            @click="onSolve"
          >
            {{ solveButtonLabel }}
          </el-button>
        </span>
      </el-tooltip>
      <el-button
        v-if="enableAnswerInject && answerHtml && !isChoiceAssist"
        type="success"
        plain
        @click="injectAnswerHtml"
      >
        填入作答区
      </el-button>
    </div>
    <p v-if="error" class="deepseek-error">{{ error }}</p>
    <div v-if="answerHtml" class="deepseek-answer">
      <h4 class="deepseek-answer-title">{{ mistakeAware ? 'AI 错因与改进' : 'AI 解答' }}</h4>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="deepseek-answer-body deepseek-md" v-html="answerHtml" />
    </div>
  </div>
</template>

<style scoped>
.deepseek-assist {
  display: grid;
  gap: 10px;
  padding-top: 4px;
}

.deepseek-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.deepseek-btn-wrap {
  display: inline-flex;
}

.deepseek-error {
  margin: 0;
  font-size: 13px;
  color: var(--app-danger, #dc2626);
}

.deepseek-answer {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--app-surface-alt);
}

.deepseek-answer-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.deepseek-answer-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
  color: var(--app-text, inherit);
}

.deepseek-md :deep(h1),
.deepseek-md :deep(h2),
.deepseek-md :deep(h3),
.deepseek-md :deep(h4) {
  margin: 1.1em 0 0.45em;
  font-weight: 700;
  line-height: 1.35;
}

.deepseek-md :deep(h1) {
  font-size: 1.35rem;
  border-bottom: 1px solid var(--app-border-soft);
  padding-bottom: 0.35em;
}

.deepseek-md :deep(h2) {
  font-size: 1.2rem;
}

.deepseek-md :deep(h3) {
  font-size: 1.05rem;
}

.deepseek-md :deep(h4) {
  font-size: 1rem;
}

.deepseek-md :deep(p) {
  margin: 0.55em 0;
}

.deepseek-md :deep(p:first-child) {
  margin-top: 0;
}

.deepseek-md :deep(p:last-child) {
  margin-bottom: 0;
}

.deepseek-md :deep(ul),
.deepseek-md :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.35em;
}

.deepseek-md :deep(li) {
  margin: 0.25em 0;
}

.deepseek-md :deep(blockquote) {
  margin: 0.6em 0;
  padding: 0.35em 0 0.35em 0.85em;
  border-left: 4px solid var(--app-primary, #2563eb);
  background: var(--app-surface, #fff);
  color: var(--app-text-muted);
}

.deepseek-md :deep(pre) {
  margin: 0.65em 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--app-border-soft);
  background: var(--app-surface, #f8fafc);
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

.deepseek-md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  padding: 0.12em 0.35em;
  border-radius: 4px;
  background: var(--app-surface-alt, #f1f5f9);
}

.deepseek-md :deep(pre code) {
  padding: 0;
  background: transparent;
  font-size: inherit;
}

.deepseek-md :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.65em 0;
  font-size: 13px;
}

.deepseek-md :deep(th),
.deepseek-md :deep(td) {
  border: 1px solid var(--app-border-soft);
  padding: 6px 10px;
  text-align: left;
}

.deepseek-md :deep(th) {
  background: var(--app-surface-alt);
  font-weight: 600;
}

.deepseek-md :deep(a) {
  color: var(--app-primary, #2563eb);
  text-decoration: underline;
}

.deepseek-md :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid var(--app-border-soft);
}

.deepseek-md :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>
