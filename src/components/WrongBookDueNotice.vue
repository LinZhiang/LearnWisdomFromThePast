<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { WRONG_BOOK_UI } from '@/constants/question-bank-copy'
import { useWrongBookDueStore } from '@/stores/wrong-book-due'

const route = useRoute()
const router = useRouter()
const dueStore = useWrongBookDueStore()
const { dueCount, hasDue } = storeToRefs(dueStore)

const visible = computed(() => hasDue.value && route.name !== 'wen-wu-rank')

const label = computed(() => WRONG_BOOK_UI.dueGlobalNoticeShort(dueCount.value))

function goWrongBook() {
  if (route.name === 'wrong-book') {
    void router.replace({ path: '/learning/wrong-book', query: { allDue: '1' } })
    return
  }
  void router.push({ path: '/learning/wrong-book', query: { allDue: '1' } })
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="wrong-book-due-notice"
    :class="{ 'wrong-book-due-notice--current': route.name === 'wrong-book' }"
    :title="WRONG_BOOK_UI.dueGlobalNotice(dueCount)"
    @click="goWrongBook"
  >
    <span class="wrong-book-due-notice__dot" aria-hidden="true" />
    <span class="wrong-book-due-notice__text">{{ label }}</span>
  </button>
</template>

<style scoped>
.wrong-book-due-notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 11rem;
  margin: 0;
  padding: 5px 10px;
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 45%, var(--app-border-soft));
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-color-warning-light-9) 82%, var(--app-surface));
  color: var(--app-text);
  font: inherit;
  font-size: 12px;
  line-height: 1.3;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.wrong-book-due-notice:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--el-color-warning) 65%, var(--app-border-soft));
  background: color-mix(in srgb, var(--el-color-warning-light-8) 88%, var(--app-surface));
}

.wrong-book-due-notice--current,
.wrong-book-due-notice:disabled {
  cursor: default;
  opacity: 0.92;
}

.wrong-book-due-notice__dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-warning);
}

.wrong-book-due-notice__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}
</style>
