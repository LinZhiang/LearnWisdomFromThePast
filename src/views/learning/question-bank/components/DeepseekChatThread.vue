<script setup lang="ts">
import { computed } from 'vue'
import { markdownToSafeHtml } from '@/utils/markdownToHtml'
import type { DeepSeekDisplayTurn } from '@/composables/useDeepseekConversation'

const props = defineProps<{
  turns: DeepSeekDisplayTurn[]
  firstAssistantTitle?: string
}>()

const renderedTurns = computed(() =>
  props.turns.map((turn) => ({
    ...turn,
    html: markdownToSafeHtml(turn.content),
  })),
)

const firstAssistantIndex = computed(() =>
  props.turns.findIndex((turn) => turn.role === 'assistant'),
)
</script>

<template>
  <div v-if="renderedTurns.length" class="deepseek-thread" aria-label="智能对话">
    <article
      v-for="(turn, index) in renderedTurns"
      :key="index"
      class="deepseek-thread-item"
      :class="turn.role === 'user' ? 'deepseek-thread-item--user' : 'deepseek-thread-item--assistant'"
    >
      <h4 class="deepseek-thread-label">
        {{
          turn.label ??
          (turn.role === 'assistant' && index === firstAssistantIndex && firstAssistantTitle
            ? firstAssistantTitle
            : turn.role === 'user'
              ? '你的追问'
              : '智能助手')
        }}
      </h4>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="deepseek-thread-body deepseek-md" v-html="turn.html" />
    </article>
  </div>
</template>

<style scoped>
.deepseek-thread {
  display: grid;
  gap: 10px;
}

.deepseek-thread-item {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--app-surface-alt);
}

.deepseek-thread-item--user {
  background: var(--app-surface, #fff);
}

.deepseek-thread-label {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.deepseek-thread-body {
  margin: 0;
  word-break: break-word;
  color: var(--app-text, inherit);
}
</style>
