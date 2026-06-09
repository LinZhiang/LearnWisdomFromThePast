<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { markdownToSafeHtml } from '@/utils/markdownToHtml'
import { htmlToPlainText } from '@/utils/htmlToText'
import { useDeepseekConversation } from '@/composables/useDeepseekConversation'
import {
  buildChoiceMistakeAwareUserMessage,
  buildGeneralMistakeAwareUserMessage,
  buildQuestionSolveUserMessage,
  choiceMistakeAwareSystem,
  GENERAL_MISTAKE_AWARE_SYSTEM,
  isAiChatConfigured,
  QUESTION_SOLVE_SYSTEM,
  requestChoiceMistakeAwareSolve,
  requestGeneralMistakeAwareSolve,
  requestQuestionSolve,
} from '@/services/deepseek'
import { hashForAiCache } from '@/utils/aiResponseCache'
import DeepseekChatThread from './DeepseekChatThread.vue'

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

const followupInput = ref('')

const contextKey = computed(() =>
  hashForAiCache(
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
      mistakePromptVersion: 'single-multi-v2',
    }),
  ),
)

const {
  loading,
  error,
  hasStarted,
  lastAssistantText,
  displayTurns,
  reset,
  start,
  followup,
} = useDeepseekConversation({
  resetKey: contextKey,
})

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

const firstAssistantTitle = computed(() =>
  props.mistakeAware ? 'AI 错因与改进' : 'AI 解答',
)

const lastAnswerHtml = computed(() => markdownToSafeHtml(lastAssistantText.value))

const canSubmitFollowup = computed(
  () => hasAiProxy.value && followupInput.value.trim().length > 0 && !loading.value,
)

function buildInitialRequest(): {
  initialUser: string
  system: string
  cacheKey: string
  fetch: () => Promise<string>
} {
  const cachePayload = contextKey.value
  if (isChoiceMistake.value) {
    const mode = props.choiceMode ?? 'single'
    const input = {
      title: props.title,
      stem: props.choiceStem,
      mode,
      options: props.choiceOptions ?? [],
      correctAnswerTexts: [...(props.choiceCorrectAnswers ?? [])],
      userSelectedTexts: [...(props.choiceUserSelectedTexts ?? [])],
      analysisHtml: props.analysisHtml,
    }
    return {
      initialUser: buildChoiceMistakeAwareUserMessage(input),
      system: choiceMistakeAwareSystem(mode),
      cacheKey: `assist:${cachePayload}`,
      fetch: () => requestChoiceMistakeAwareSolve(input),
    }
  }
  if (isGeneralMistake.value) {
    const input = {
      title: props.title,
      contentHtml: props.contentHtml ?? '',
      analysisHtml: props.analysisHtml,
      userAnswerHtml: props.reflectiveUserAnswerHtml ?? '',
    }
    return {
      initialUser: buildGeneralMistakeAwareUserMessage(input),
      system: GENERAL_MISTAKE_AWARE_SYSTEM,
      cacheKey: `assist:${cachePayload}`,
      fetch: () => requestGeneralMistakeAwareSolve(input),
    }
  }
  if (isChoiceAssist.value) {
    const input = {
      kind: 'choice' as const,
      title: props.title,
      mode: props.choiceMode!,
      correctAnswers: [...props.choiceCorrectAnswers!],
      analysisHtml: props.analysisHtml,
    }
    return {
      initialUser: buildQuestionSolveUserMessage(input),
      system: QUESTION_SOLVE_SYSTEM,
      cacheKey: `assist:${cachePayload}`,
      fetch: () => requestQuestionSolve(input),
    }
  }
  const input = {
    kind: 'general' as const,
    title: props.title,
    contentHtml: props.contentHtml ?? '',
    analysisHtml: props.analysisHtml,
  }
  return {
    initialUser: buildQuestionSolveUserMessage(input),
    system: QUESTION_SOLVE_SYSTEM,
    cacheKey: `assist:${cachePayload}`,
    fetch: () => requestQuestionSolve(input),
  }
}

const onSolve = async () => {
  try {
    const req = buildInitialRequest()
    await start({
      ...req,
      displayAssistantLabel: firstAssistantTitle.value,
    })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '请求失败')
  }
}

const onFollowup = async () => {
  const text = followupInput.value.trim()
  if (!text) return
  try {
    await followup(text, { assistant: '回答' })
    followupInput.value = ''
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '请求失败')
  }
}

const injectAnswerHtml = () => {
  if (lastAnswerHtml.value) emit('inject', lastAnswerHtml.value)
}

const onReset = () => {
  reset()
  followupInput.value = ''
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
            v-if="!hasStarted"
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
        v-if="enableAnswerInject && lastAnswerHtml && !isChoiceAssist"
        type="success"
        plain
        @click="injectAnswerHtml"
      >
        填入作答区
      </el-button>
      <el-button v-if="hasStarted" text type="info" :disabled="loading" @click="onReset">
        重新开始
      </el-button>
    </div>

    <DeepseekChatThread
      v-if="displayTurns.length"
      :turns="displayTurns"
      :first-assistant-title="firstAssistantTitle"
    />

    <div v-if="hasStarted" class="deepseek-followup">
      <el-input
        v-model="followupInput"
        type="textarea"
        :rows="3"
        resize="none"
        maxlength="500"
        show-word-limit
        placeholder="针对本题继续追问，例如：能再举个例子吗？这一步为什么不对？"
        @keydown.ctrl.enter="onFollowup"
      />
      <div class="deepseek-followup-actions">
        <el-tooltip
          :disabled="hasAiProxy"
          placement="top"
          content="开发：server/.env 配置 DEEPSEEK_API_KEY 并运行 npm run dev:api；生产：VITE_AI_API_BASE。详见 docs/ENV-说明.md"
        >
          <span class="deepseek-btn-wrap">
            <el-button type="primary" plain :loading="loading" :disabled="!canSubmitFollowup" @click="onFollowup">
              继续追问
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </div>

    <p v-if="error" class="deepseek-error">{{ error }}</p>
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

.deepseek-followup {
  display: grid;
  gap: 8px;
}

.deepseek-followup-actions {
  display: flex;
  justify-content: flex-start;
}

.deepseek-error {
  margin: 0;
  font-size: 13px;
  color: var(--app-danger, #dc2626);
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
  font-size: 1.35em;
  border-bottom: 1px solid var(--app-border-soft);
  padding-bottom: 0.35em;
}

.deepseek-md :deep(h2) {
  font-size: 1.2em;
}

.deepseek-md :deep(h3) {
  font-size: 1.05em;
}

.deepseek-md :deep(h4) {
  font-size: 1em;
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
  padding: 0.65em 0.85em;
  border-radius: 8px;
  border: 1px solid var(--app-border-soft);
  background: var(--app-surface, #f8fafc);
  overflow-x: auto;
  font-size: 1em;
  line-height: 1.55;
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
  font-size: 1em;
}

.deepseek-md :deep(th),
.deepseek-md :deep(td) {
  border: 1px solid var(--app-border-soft);
  padding: 0.45em 0.65em;
  font-size: inherit;
  line-height: 1.5;
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
