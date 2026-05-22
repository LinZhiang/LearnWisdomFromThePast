<script setup lang="ts">
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { computed } from 'vue'
import type { QuestionBank } from '@/db/models'
import type { QuestionFavoriteTarget } from '@/services/favorite-question-helpers'
import QuestionBankFavoriteButton from './QuestionBankFavoriteButton.vue'

const props = defineProps<{
  question: QuestionBank
  typeLabel: string
  learningTypeName: string
  navList?: QuestionBank[]
  /** 题库收藏页等场景隐藏「编辑此题」 */
  hideEditButton?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'edit', item: QuestionBank): void
  (e: 'go-to', item: QuestionBank): void
  (e: 'favorite-removed'): void
}>()

const isMindmap = computed(() => props.question.type === 'mindmap')

const navIndex = computed(() => {
  const id = props.question.id
  const list = props.navList
  if (id == null || !list?.length) return -1
  return list.findIndex((q) => q.id === id)
})

const showQuestionNav = computed(() => (props.navList?.length ?? 0) > 1)

const navPositionText = computed(() => {
  const n = props.navList?.length ?? 0
  const i = navIndex.value
  if (!showQuestionNav.value || i < 0) return ''
  return `第 ${i + 1} / ${n} 题`
})

const canPrev = computed(() => showQuestionNav.value && navIndex.value > 0)

const canNext = computed(() => {
  const len = props.navList?.length ?? 0
  const i = navIndex.value
  return showQuestionNav.value && i >= 0 && i < len - 1
})

const favoriteTarget = computed<QuestionFavoriteTarget | null>(() => {
  if (props.question.id == null) return null
  return { mode: 'bank', question: props.question }
})

const goPrev = () => {
  const list = props.navList
  const i = navIndex.value
  if (list && i > 0) emit('go-to', list[i - 1]!)
}

const goNext = () => {
  const list = props.navList
  const i = navIndex.value
  if (list && i >= 0 && i < list.length - 1) emit('go-to', list[i + 1]!)
}

function handleArrowLeft(): boolean {
  if (!showQuestionNav.value || !canPrev.value) return false
  goPrev()
  return true
}

function handleArrowRight(): boolean {
  if (!showQuestionNav.value || !canNext.value) return false
  goNext()
  return true
}

defineExpose({ handleArrowLeft, handleArrowRight })
</script>

<template>
  <header class="detail-topbar">
    <div class="detail-topbar-row">
      <div class="detail-title-block">
        <h3 class="detail-title">{{ question.title }}</h3>
        <ul class="detail-meta-chips" aria-label="题目属性">
          <li class="meta-chip">{{ typeLabel }}</li>
          <li class="meta-chip meta-chip-muted">{{ learningTypeName }}</li>
          <li v-if="!isMindmap" class="meta-chip meta-chip-accent">分数 {{ question.score ?? 0 }}</li>
        </ul>
      </div>
      <div class="detail-actions">
        <QuestionBankFavoriteButton
          v-if="favoriteTarget"
          plain
          :learning-type-id="question.learningTypeId ?? null"
          :target="favoriteTarget"
          @removed="emit('favorite-removed')"
        />
        <el-button plain @click="emit('back')">返回列表</el-button>
        <el-button
          v-if="!hideEditButton"
          type="primary"
          @click="emit('edit', question)"
        >
          编辑此题
        </el-button>
      </div>
    </div>
    <div v-if="showQuestionNav" class="detail-nav-row" aria-label="题目切换">
      <el-button :icon="ArrowLeft" :disabled="!canPrev" @click="goPrev">上一题</el-button>
      <span class="detail-nav-pos">{{ navPositionText }}</span>
      <el-button :icon="ArrowRight" :disabled="!canNext" @click="goNext">下一题</el-button>
    </div>
  </header>
</template>

<style scoped>
.detail-topbar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--app-surface);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.detail-topbar-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.detail-nav-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 4px;
  border-top: 1px solid var(--app-border-soft);
}

.detail-nav-pos {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-muted);
  min-width: 6.5rem;
  text-align: center;
}

.detail-title {
  margin: 0 0 10px;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--app-text, inherit);
  word-break: break-word;
}

.detail-meta-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}

.meta-chip {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
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

.meta-chip-accent {
  background: var(--app-surface-alt);
  color: var(--app-text);
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
</style>
