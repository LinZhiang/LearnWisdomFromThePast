<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import type { QuestionBank } from '@/db/models'
import { useDeepseekConversation } from '@/composables/useDeepseekConversation'
import {
  buildKeywordFollowupUserMessage,
  isAiChatConfigured,
  KEYWORD_FOLLOWUP_SYSTEM,
  requestQuestionKeywordFollowup,
} from '@/services/deepseek'
import { hashForAiCache } from '@/utils/aiResponseCache'
import { parseChoiceQuestionContent } from '@/utils/choiceQuestion'
import { prepareHandoutBodyForKeywordFollowup } from '@/utils/handoutAiMaterial'
import { htmlToPlainText } from '@/utils/htmlToText'
import DeepseekChatThread from './DeepseekChatThread.vue'

const props = defineProps<{
  question: QuestionBank
  typeLabel: string
}>()

const keywordInput = ref('')

const contextKey = computed(
  () => `${props.question.id ?? 'x'}:${props.typeLabel}:${hashForAiCache(props.question.content ?? '')}`,
)

const {
  loading,
  error,
  hasStarted,
  displayTurns,
  reset,
  start,
  followup,
} = useDeepseekConversation({
  resetKey: contextKey,
})

const hasAiProxy = computed(() => isAiChatConfigured())

const materialPlain = computed(() => {
  const q = props.question
  const title = q.title?.trim() ?? ''
  const t = q.type ?? 'general'

  if (t === 'mindmap') {
    const md = prepareHandoutBodyForKeywordFollowup(q.content ?? '')
    const parts: string[] = []
    if (title) parts.push(`名称：${title}`)
    if (md) parts.push(`思维导图正文（Markdown）：\n${md}`)
    return parts.join('\n\n')
  }

  if (t === 'choice') {
    const p = parseChoiceQuestionContent(q.content ?? '')
    const modeLabel = p.mode === 'multiple' ? '多选' : '单选'
    const answers = p.correctAnswers.map((s) => s.trim()).filter(Boolean)
    const answersBlock = answers.length ? answers.map((a, i) => `${i + 1}. ${a}`).join('\n') : '（未填写）'
    const analysis = htmlToPlainText(q.analysis ?? '')
    const parts: string[] = []
    if (title) parts.push(`名称：${title}`)
    parts.push(`选项类型：${modeLabel}`)
    parts.push(`已知正确选项：\n${answersBlock}`)
    if (analysis) parts.push(`解析：\n${analysis}`)
    return parts.join('\n\n')
  }

  const content = htmlToPlainText(q.content ?? '')
  const analysis = htmlToPlainText(q.analysis ?? '')
  const parts: string[] = []
  if (title) parts.push(`名称：${title}`)
  if (t === 'handout') {
    const raw = (q.content ?? '').trim()
    const normalized =
      raw.startsWith('<') && raw.includes('>')
        ? htmlToPlainText(raw).replace(/\s+/g, '\n').trim() || raw
        : raw
    const body = prepareHandoutBodyForKeywordFollowup(normalized)
    if (body) parts.push(`讲义正文：\n${body}`)
    return parts.join('\n\n')
  }
  if (content) parts.push(`题干与材料：\n${content}`)
  if (analysis) parts.push(`解析：\n${analysis}`)
  return parts.join('\n\n')
})

const canSubmit = computed(
  () => hasAiProxy.value && keywordInput.value.trim().length > 0 && !loading.value,
)

const askButtonLabel = computed(() => (hasStarted.value ? '继续追问' : '向 DeepSeek 提问'))

const onAsk = async () => {
  const text = keywordInput.value.trim()
  if (!text) return
  try {
    if (!hasStarted.value) {
      const initialUser = buildKeywordFollowupUserMessage({
        typeLabel: props.typeLabel,
        title: props.question.title ?? '',
        materialPlainText: materialPlain.value,
        userKeywords: text,
      })
      await start({
        initialUser,
        displayUser: text,
        system: KEYWORD_FOLLOWUP_SYSTEM,
        cacheKey: `keyword:v4:${props.question.id ?? 'x'}:${hashForAiCache(
          [props.typeLabel, materialPlain.value, text].join('\0'),
        )}`,
        fetch: () =>
          requestQuestionKeywordFollowup({
            typeLabel: props.typeLabel,
            title: props.question.title ?? '',
            materialPlainText: materialPlain.value,
            userKeywords: text,
          }),
      })
    } else {
      await followup(text)
    }
    keywordInput.value = ''
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '请求失败')
  }
}

const onReset = () => {
  reset()
  keywordInput.value = ''
}
</script>

<template>
  <aside class="keyword-panel" aria-label="DeepSeek 关键字追问">
    <header class="keyword-panel-head">
      <h3 class="keyword-panel-title">DeepSeek 关键字追问</h3>
      <p class="keyword-panel-desc">
        结合本题材料提问；首次提问后可继续追问，对话会保留在本题上下文中。
      </p>
    </header>
    <div class="keyword-panel-main">
      <div class="keyword-panel-form">
        <el-input
          v-model="keywordInput"
          type="textarea"
          :rows="4"
          resize="none"
          maxlength="500"
          show-word-limit
          :placeholder="
            hasStarted
              ? '继续追问，例如：能再举一个反例吗？'
              : '例如：易错点、核心概念、与解析的差异…'
          "
          class="keyword-textarea"
          @keydown.ctrl.enter="onAsk"
        />
        <div class="keyword-panel-actions">
          <el-tooltip
            :disabled="hasAiProxy"
            placement="top"
            content="开发：在 server/.env 配置 DEEPSEEK_API_KEY 并运行 npm run dev:api；生产：配置 VITE_AI_API_BASE。详见 docs/ENV-说明.md"
          >
            <span class="keyword-btn-wrap">
              <el-button type="primary" plain :loading="loading" :disabled="!canSubmit" @click="onAsk">
                {{ askButtonLabel }}
              </el-button>
            </span>
          </el-tooltip>
          <el-button v-if="hasStarted" text type="info" :disabled="loading" @click="onReset">
            重新开始
          </el-button>
        </div>
        <p v-if="error" class="keyword-error">{{ error }}</p>
      </div>
      <div v-if="displayTurns.length" class="keyword-answer" aria-label="DeepSeek 回答">
        <div class="keyword-answer-inner">
          <DeepseekChatThread :turns="displayTurns" first-assistant-title="回答" />
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.keyword-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 360px;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface);
  box-sizing: border-box;
  overflow: hidden;
  font-size: var(--app-handout-font-size, 14px);
  line-height: var(--app-handout-line-height, 1.65);
}

.keyword-panel-head {
  flex-shrink: 0;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-surface-alt);
}

.keyword-panel-title {
  margin: 0 0 6px;
  font-size: 1em;
  font-weight: 600;
  color: var(--app-text, inherit);
}

.keyword-panel-desc {
  margin: 0;
  font-size: 0.86em;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.keyword-panel-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.keyword-panel-form {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 10px;
}

.keyword-panel-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.keyword-answer {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border-top: 1px solid var(--app-border-soft);
  background: var(--app-surface-alt);
  -webkit-overflow-scrolling: touch;
}

.keyword-answer-inner {
  padding: 10px 14px 14px;
  box-sizing: border-box;
}

.keyword-textarea :deep(.el-textarea__inner) {
  font-size: 1em;
  line-height: var(--app-handout-line-height, 1.65);
}

.keyword-btn-wrap {
  display: inline-flex;
}

.keyword-error {
  margin: 0;
  font-size: 0.93em;
  color: var(--app-danger, #dc2626);
}
</style>
