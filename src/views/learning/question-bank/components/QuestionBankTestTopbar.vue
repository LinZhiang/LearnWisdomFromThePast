<script setup lang="ts">
import type { TestPhase } from './questionBankTestTypes'

defineProps<{
  learningTypeName: string
  phase: TestPhase
  unitsLength: number
  progressLabel: string
  currentMaxScore: number
  totalScoreRounded: number
  runningTotalMax: number
  summaryTotalMax: number
  /** 作答过程中每秒刷新 */
  runningElapsedText?: string
  /** 测验结束后总用时 */
  summaryDurationText?: string
}>()

defineEmits<{
  (e: 'back'): void
}>()
</script>

<template>
  <header class="test-topbar">
    <div class="test-topbar-row">
      <div class="test-title-block">
        <h3 class="test-title">题目测试</h3>
        <p class="test-subtitle">
          当前节点：<strong>{{ learningTypeName }}</strong>
          <template v-if="phase === 'running' && unitsLength">
            · {{ progressLabel }} · 本题满分 {{ currentMaxScore }} 分 · 已累计
            <strong>{{ totalScoreRounded }}</strong> / {{ runningTotalMax }} 分
            <template v-if="runningElapsedText"> · {{ runningElapsedText }}</template>
          </template>
          <template v-else-if="phase === 'summary'">
            · 测验结束 · 总得分 {{ totalScoreRounded }} / {{ summaryTotalMax }} 分
            <template v-if="summaryDurationText"> · {{ summaryDurationText }}</template>
          </template>
        </p>
      </div>
      <div class="test-topbar-actions">
        <el-button type="primary" plain @click="$emit('back')">返回学习题库</el-button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.test-topbar {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--app-surface);
  margin-bottom: 12px;
}

.test-topbar-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.test-topbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.test-title {
  margin: 0 0 6px;
  font-size: 1.15rem;
  font-weight: 600;
}

.test-subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--app-text-muted);
}
</style>
