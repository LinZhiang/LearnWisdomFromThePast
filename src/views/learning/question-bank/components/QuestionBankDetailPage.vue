<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { QuestionBank } from '@/db/models'
import DeepseekKeywordAskPanel from './DeepseekKeywordAskPanel.vue'
import QuestionBankDetailBody from './QuestionBankDetailBody.vue'
import QuestionBankDetailTopbar from './QuestionBankDetailTopbar.vue'

const props = defineProps<{
  question: QuestionBank
  typeLabel: string
  learningTypeName: string
  navList?: QuestionBank[]
  hideEditButton?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'edit', item: QuestionBank): void
  (e: 'go-to', item: QuestionBank): void
  (e: 'favorite-removed'): void
}>()

const isMindmap = computed(() => props.question.type === 'mindmap')

const topbarRef = ref<InstanceType<typeof QuestionBankDetailTopbar> | null>(null)

const onDocKeydown = (e: KeyboardEvent) => {
  const el = e.target
  if (el instanceof HTMLElement && el.closest('input, textarea, [contenteditable="true"]')) return
  if (e.key === 'ArrowLeft' && topbarRef.value?.handleArrowLeft()) {
    e.preventDefault()
  } else if (e.key === 'ArrowRight' && topbarRef.value?.handleArrowRight()) {
    e.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onDocKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <section class="question-detail-page" :class="{ 'is-mindmap-detail': isMindmap }">
    <QuestionBankDetailTopbar
      ref="topbarRef"
      :question="question"
      :type-label="typeLabel"
      :learning-type-name="learningTypeName"
      :nav-list="navList"
      :hide-edit-button="!!hideEditButton"
      @back="emit('back')"
      @edit="emit('edit', $event)"
      @go-to="emit('go-to', $event)"
      @favorite-removed="emit('favorite-removed')"
    />
    <div class="detail-page-columns">
      <QuestionBankDetailBody class="detail-column-main" :question="question" />
      <DeepseekKeywordAskPanel
        :key="question.id"
        class="detail-column-aside"
        :question="question"
        :type-label="typeLabel"
      />
    </div>
  </section>
</template>

<style scoped>
.question-detail-page {
  /* 略低于主区域满高，并留出底边空隙，避免最后一行贴边被裁切感 */
  --detail-bottom-breath: max(1.25rem, env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: min(100%, 88rem);
  margin: 0 auto var(--detail-bottom-breath);
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(100% - var(--detail-bottom-breath));
  min-width: 0;
  box-sizing: border-box;
}

.question-detail-page :deep(.detail-topbar) {
  flex-shrink: 0;
}

.detail-page-columns {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.detail-column-main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.detail-column-aside {
  flex: 0 0 min(32vw, 340px);
  align-self: flex-start;
}

.detail-column-aside :deep(.keyword-panel) {
  max-width: none;
  width: 100%;
}

@media (max-width: 900px) {
  .detail-page-columns {
    flex-direction: column;
  }

  .detail-column-aside {
    flex: 0 0 auto;
    width: 100%;
  }

  .detail-column-aside :deep(.keyword-panel) {
    max-width: none;
  }
}

.question-detail-page.is-mindmap-detail {
  max-width: min(100%, 96rem);
  gap: 8px;
  /* 顶栏 + page-content 上下 padding 约 7rem，思维导图区贴齐可视区域底部 */
  max-height: none;
  min-height: calc(100dvh - 7rem - var(--detail-bottom-breath));
  margin-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));
}

.question-detail-page.is-mindmap-detail .detail-page-columns {
  flex: 1 1 auto;
  min-height: 0;
}

.question-detail-page.is-mindmap-detail .detail-column-aside {
  align-self: stretch;
  max-height: 100%;
  min-height: 0;
  overflow: auto;
}

.question-detail-page.is-mindmap-detail :deep(.detail-topbar) {
  padding: 10px 12px;
  gap: 8px;
}

.question-detail-page.is-mindmap-detail :deep(.detail-nav-row) {
  padding-top: 2px;
}
</style>
