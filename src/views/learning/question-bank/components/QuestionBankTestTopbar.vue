<script setup lang="ts">
import PageFocusToggle from '@/components/PageFocusToggle.vue'
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
  /** 错题本：顶栏显示对错统计，不显示分值 */
  wrongBookMode?: boolean
  wrongBookCorrectCount?: number
  backButtonLabel?: string
}>()

defineEmits<{
  (e: 'back'): void
}>()
</script>

<template>
  <header class="test-topbar">
    <div class="test-topbar-row">
      <div class="test-title-block">
        <h3 class="test-title">测验</h3>
        <p class="test-subtitle">
          当前节点：<strong>{{ learningTypeName }}</strong>
          <template v-if="phase === 'running' && unitsLength">
            · {{ progressLabel }}
            <template v-if="wrongBookMode">
              · 已累计答对 <strong>{{ wrongBookCorrectCount ?? 0 }}</strong> / {{ unitsLength }} 题
            </template>
            <template v-else>
              · 本题满分 {{ currentMaxScore }} 分 · 已累计
              <strong>{{ totalScoreRounded }}</strong> / {{ runningTotalMax }} 分
            </template>
            <template v-if="runningElapsedText"> · {{ runningElapsedText }}</template>
          </template>
          <template v-else-if="phase === 'ready' && unitsLength">
            · 已生成 <strong>{{ unitsLength }}</strong> 道题，请确认后点击「开始测验」；计时从开始后算起
          </template>
          <template v-else-if="phase === 'summary'">
            · 测验结束
            <template v-if="wrongBookMode">
              · 答对 <strong>{{ wrongBookCorrectCount ?? 0 }}</strong> / {{ unitsLength }} 题
            </template>
            <template v-else> · 总得分 {{ totalScoreRounded }} / {{ summaryTotalMax }} 分</template>
            <template v-if="summaryDurationText"> · {{ summaryDurationText }}</template>
          </template>
        </p>
      </div>
      <div class="test-topbar-actions">
        <PageFocusToggle variant="stretch" />
        <el-button type="primary" plain @click="$emit('back')">{{
          backButtonLabel ?? '返回学习题库'
        }}</el-button>
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

.test-title-block {
  flex: 1 1 auto;
  min-width: 0;
}

.test-topbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex: 0 0 auto;
  max-width: 100%;
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
