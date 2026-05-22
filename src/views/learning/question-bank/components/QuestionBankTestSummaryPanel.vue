<script setup lang="ts">
import type { QuizRadarDimension } from '@/services/deepseek'
import type { ResultRow } from './questionBankTestTypes'

defineProps<{
  results: ResultRow[]
  totalScoreRounded: number
  summaryTotalMax: number
  /** 测验总用时（与 DeepSeek 效率分析同源） */
  quizDurationSummaryText?: string
  scoreRateText: string
  correctRateText: string
  correctCount: number
  totalCount: number
  showRadarPanel: boolean
  radarLoading: boolean
  radarError: string
  radarDimensions: QuizRadarDimension[]
  radarAnalysisHtml: string
  radarChartError: string
}>()

defineEmits<{
  (e: 'open-radar'): void
  (e: 'retry-radar-analysis'): void
  (e: 'retry-radar-chart'): void
  (e: 'back'): void
}>()
</script>

<template>
  <div class="test-summary-root">
  <h4 class="test-summary-title test-summary-keep">作答情况</h4>
  <p class="test-muted test-summary-keep">
    总得分 {{ totalScoreRounded }} / {{ summaryTotalMax }} 分
  </p>
  <p class="test-muted test-summary-keep">
    分数正确率 {{ scoreRateText }}
  </p>
  <p class="test-muted test-summary-keep">
    答题正确率 {{ correctRateText }}（{{ correctCount }} / {{ totalCount }}）
  </p>
  <p v-if="quizDurationSummaryText" class="test-muted test-summary-keep">
    {{ quizDurationSummaryText }}（自进入可作答至最后一题提交）
  </p>
  <div class="test-summary-table-scroll">
    <div class="test-summary-table">
      <div class="test-summary-head">
        <span>序号</span>
        <span>题型</span>
        <span>题目</span>
        <span>说明</span>
        <span>得分</span>
      </div>
      <div v-for="row in results" :key="row.unitIndex" class="test-summary-row">
        <span>{{ row.unitIndex }}</span>
        <span>{{ row.typeLabel }}</span>
        <span>{{ row.title }}</span>
        <span>{{ row.detail }}</span>
        <span>{{ row.score }} / {{ row.maxScore }}</span>
      </div>
    </div>
  </div>

  <div class="test-summary-radar-trigger">
    <el-button
      type="primary"
      plain
      :loading="radarLoading"
      :disabled="radarLoading"
      @click="$emit('open-radar')"
    >
      <template v-if="!showRadarPanel">查看 DeepSeek 综合判定与六维雷达</template>
      <template v-else-if="radarLoading">正在生成…</template>
      <template v-else-if="radarError">请求失败，可再次点击或下方重试</template>
      <template v-else-if="radarDimensions.length === 6 && radarChartError">雷达图未显示，点击重试渲染</template>
      <template v-else-if="radarDimensions.length === 6">内容已在下方展开</template>
      <template v-else>生成中…</template>
    </el-button>
  </div>

  <div v-if="showRadarPanel" class="test-summary-radar">
    <h4 class="test-radar-section-title">DeepSeek 答题解析 · 六维雷达</h4>
    <p v-if="radarLoading" class="test-muted">正在根据作答情况生成解析与雷达图…</p>
    <div v-else-if="radarError" class="test-radar-error-block">
      <p class="test-error">{{ radarError }}</p>
      <el-button size="small" type="primary" plain @click="$emit('retry-radar-analysis')">
        重新请求解析与雷达数据
      </el-button>
    </div>
    <div v-else-if="radarDimensions.length === 6" class="test-radar-grid">
      <div class="test-radar-left">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="test-radar-md deepseek-md" v-html="radarAnalysisHtml" />
        <ul class="test-radar-dim-list" aria-label="六维得分要点">
          <li v-for="d in radarDimensions" :key="d.name">
            <span class="test-radar-dim-name">{{ d.name }}</span>
            <span class="test-radar-dim-score">{{ d.score }} 分</span>
            <span v-if="d.brief" class="test-radar-dim-brief">{{ d.brief }}</span>
          </li>
        </ul>
      </div>
      <div class="test-radar-chart-col">
        <slot name="chart" />
      </div>
    </div>
  </div>

  <el-button type="primary" @click="$emit('back')">返回学习题库</el-button>
  </div>
</template>

<style scoped>
.test-summary-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  max-height: calc(100dvh - 12rem);
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.test-muted {
  margin: 0;
  color: var(--app-text-muted);
}

.test-summary-title {
  margin: 0 0 8px;
}

.test-summary-keep {
  flex-shrink: 0;
}

.test-summary-table-scroll {
  flex-shrink: 0;
  min-height: 140px;
  max-height: min(40dvh, 480px);
  overflow: auto;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface);
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.test-summary-radar-trigger {
  margin-top: 16px;
  flex-shrink: 0;
}

.test-summary-radar {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--app-border-soft);
  position: relative;
  z-index: 0;
  flex-shrink: 0;
}

.test-radar-error-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.test-radar-section-title {
  margin: 0 0 12px;
  font-size: 1.05rem;
  font-weight: 600;
}

.test-radar-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  gap: 20px;
  align-items: start;
  min-width: 0;
}

@media (max-width: 900px) {
  .test-summary-root {
    max-height: none;
  }

  .test-radar-grid {
    grid-template-columns: 1fr;
  }
}

.test-radar-left {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.test-radar-md {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--app-surface-alt);
  font-size: 14px;
  line-height: 1.65;
  overflow-x: auto;
  word-break: break-word;
  -webkit-overflow-scrolling: touch;
}

.test-radar-dim-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.test-radar-dim-list li {
  display: grid;
  grid-template-columns: 7.5em 3.5em 1fr;
  gap: 8px;
  align-items: baseline;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--app-surface-alt);
  border: 1px solid var(--app-border-soft);
}

@media (max-width: 600px) {
  .test-radar-dim-list li {
    grid-template-columns: 1fr;
  }
}

.test-radar-dim-name {
  font-weight: 600;
}

.test-radar-dim-score {
  color: var(--app-primary, #2563eb);
  font-weight: 600;
}

.test-radar-dim-brief {
  color: var(--app-text-muted);
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.test-radar-chart-col {
  min-width: 0;
  min-height: 280px;
  position: sticky;
  top: 0;
  align-self: start;
}

.test-error {
  margin: 0;
  color: var(--app-danger, #dc2626);
  font-size: 13px;
}

.test-summary-table {
  border: none;
  border-radius: 0;
  overflow: visible;
  font-size: 13px;
  min-width: min-content;
}

.test-summary-head,
.test-summary-row {
  display: grid;
  grid-template-columns: 44px 88px minmax(0, 1fr) minmax(0, 1fr) 96px;
  gap: 8px;
  padding: 8px 10px;
  align-items: start;
}

.test-summary-head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--app-surface-alt);
  font-weight: 600;
  box-shadow: 0 1px 0 var(--app-border-soft);
}

.test-summary-row {
  border-top: 1px solid var(--app-border-soft);
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
  background: var(--app-surface);
  color: var(--app-text-muted);
}

.deepseek-md :deep(pre) {
  margin: 0.65em 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--app-border-soft);
  background: var(--app-surface);
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
  max-width: 100%;
  box-sizing: border-box;
}

.deepseek-md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  padding: 0.12em 0.35em;
  border-radius: 4px;
  background: var(--app-surface-alt);
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
