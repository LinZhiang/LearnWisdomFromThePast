<script setup lang="ts">
import { ElMessage } from 'element-plus'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, ref } from 'vue'
import type { QuestionBank } from '@/db/models'
import { isAiChatConfigured, requestQuestionKeywordFollowup } from '@/services/deepseek'
import { parseChoiceQuestionContent } from '@/utils/choiceQuestion'
import { htmlToPlainText } from '@/utils/htmlToText'

const props = defineProps<{
  question: QuestionBank
  typeLabel: string
}>()

const keywordInput = ref('')
const loading = ref(false)
const answer = ref('')
const error = ref('')

const hasAiProxy = computed(() => isAiChatConfigured())

const materialPlain = computed(() => {
  const q = props.question
  const title = q.title?.trim() ?? ''
  const t = q.type ?? 'general'

  if (t === 'mindmap') {
    const md = (q.content ?? '').trim()
    const parts: string[] = []
    if (title) parts.push(`题目名称：${title}`)
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
    if (title) parts.push(`题目名称：${title}`)
    parts.push(`选项类型：${modeLabel}`)
    parts.push(`已知正确选项：\n${answersBlock}`)
    if (analysis) parts.push(`题目解析：\n${analysis}`)
    return parts.join('\n\n')
  }

  const content = htmlToPlainText(q.content ?? '')
  const analysis = htmlToPlainText(q.analysis ?? '')
  const parts: string[] = []
  if (title) parts.push(`题目名称：${title}`)
  if (content) parts.push(`题目内容：\n${content}`)
  if (analysis) parts.push(`题目解析：\n${analysis}`)
  return parts.join('\n\n')
})

const canSubmit = computed(
  () => hasAiProxy.value && keywordInput.value.trim().length > 0 && !loading.value,
)

const answerHtml = computed(() => {
  const md = answer.value.trim()
  if (!md) return ''
  const raw = marked.parse(md, { async: false })
  if (typeof raw !== 'string') return ''
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
})

const onAsk = async () => {
  error.value = ''
  loading.value = true
  try {
    answer.value = await requestQuestionKeywordFollowup({
      typeLabel: props.typeLabel,
      title: props.question.title ?? '',
      materialPlainText: materialPlain.value,
      userKeywords: keywordInput.value,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '请求失败'
    error.value = msg
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <aside class="keyword-panel" aria-label="DeepSeek 关键字追问">
    <header class="keyword-panel-head">
      <h3 class="keyword-panel-title">DeepSeek 关键字追问</h3>
      <p class="keyword-panel-desc">
        结合本题材料，输入你想了解的关键词或一句话问题，由 DeepSeek 针对性说明。
      </p>
    </header>
    <!-- 固定上限 + overflow，不依赖外层 flex 高度是否传下来 -->
    <div class="keyword-panel-scroll" tabindex="-1" aria-label="关键字追问与回答">
      <div class="keyword-panel-form">
        <el-input
          v-model="keywordInput"
          type="textarea"
          :rows="4"
          resize="none"
          maxlength="500"
          show-word-limit
          placeholder="例如：易错点、核心概念、与解析的差异…"
          class="keyword-textarea"
        />
        <el-tooltip
          :disabled="hasAiProxy"
          placement="top"
          content="开发：在 server/.env 配置 DEEPSEEK_API_KEY 并运行 npm run dev:api；生产：配置 VITE_AI_API_BASE。详见 docs/ENV-说明.md"
        >
          <span class="keyword-btn-wrap">
            <el-button type="primary" plain :loading="loading" :disabled="!canSubmit" @click="onAsk">
              向 DeepSeek 提问
            </el-button>
          </span>
        </el-tooltip>
        <p v-if="error" class="keyword-error">{{ error }}</p>
      </div>
      <div v-if="answerHtml" class="keyword-answer">
        <h4 class="keyword-answer-title">回答</h4>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="keyword-answer-body deepseek-md" v-html="answerHtml" />
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
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface);
  box-sizing: border-box;
  overflow: hidden;
}

.keyword-panel-head {
  flex-shrink: 0;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-surface-alt);
}

.keyword-panel-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text, inherit);
}

.keyword-panel-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.keyword-panel-scroll {
  max-height: min(62dvh, calc(100dvh - 13rem));
  overflow-x: hidden;
  overflow-y: auto;
  padding: 12px 14px 14px;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.keyword-panel-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.keyword-textarea :deep(.el-textarea__inner) {
  font-size: 13px;
  line-height: 1.5;
}

.keyword-btn-wrap {
  display: inline-flex;
}

.keyword-error {
  margin: 0;
  font-size: 13px;
  color: var(--app-danger, #dc2626);
}

.keyword-answer {
  margin-top: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--app-surface-alt);
}

.keyword-answer-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.keyword-answer-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  word-break: break-word;
  color: var(--app-text, inherit);
}

.deepseek-md :deep(h1),
.deepseek-md :deep(h2),
.deepseek-md :deep(h3),
.deepseek-md :deep(h4) {
  margin: 1em 0 0.4em;
  font-weight: 700;
  line-height: 1.35;
}

.deepseek-md :deep(p) {
  margin: 0.5em 0;
}

.deepseek-md :deep(p:first-child) {
  margin-top: 0;
}

.deepseek-md :deep(p:last-child) {
  margin-bottom: 0;
}

.deepseek-md :deep(ul),
.deepseek-md :deep(ol) {
  margin: 0.45em 0;
  padding-left: 1.25em;
}

.deepseek-md :deep(li) {
  margin: 0.2em 0;
}

.deepseek-md :deep(pre) {
  margin: 0.5em 0;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--app-border-soft);
  background: var(--app-surface, #f8fafc);
  overflow-x: auto;
  font-size: 12px;
}

.deepseek-md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
}
</style>
