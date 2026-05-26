<script setup lang="ts">
import { computed, unref } from 'vue'
import type { QuestionBank } from '@/db/models'
import {
  mindmapTestUnitToPayload,
  type QuestionFavoriteTarget,
} from '@/services/favorite-question-helpers'
import { useQuestionBankTest } from '../composables/useQuestionBankTest'
import type { QuestionBankTestLogMenuOrigin } from '@/utils/questionBankTestLog'
import type { QuestionBankTestBuildConfig, TestUnit } from './questionBankTestTypes'
import QuestionBankTestGeneralUnit from './QuestionBankTestGeneralUnit.vue'
import QuestionBankTestMcqUnit from './QuestionBankTestMcqUnit.vue'
import QuestionBankTestRunningScoreBanner from './QuestionBankTestRunningScoreBanner.vue'
import QuestionBankTestSummaryPanel from './QuestionBankTestSummaryPanel.vue'
import QuestionBankTestTopbar from './QuestionBankTestTopbar.vue'

const props = withDefaults(
  defineProps<{
    learningTypeName: string
    /** 当前测验所属学习类型（与左侧树一致，用于收藏落库） */
    learningTypeId: number | null
    /** 是否从学习题库「测试全部」进入（用于整库全对奖励） */
    testScopeAll?: boolean
    /** 测验全对时播放音乐并弹窗（不写题库全对标签） */
    celebrateSessionPerfect?: boolean
    questions: QuestionBank[]
    /** 学习题库测验构建配置 */
    testBuildConfig?: QuestionBankTestBuildConfig
    /** 收藏页可传入预置测试单元（如导图衍生小题） */
    presetUnits?: TestUnit[]
    loading: boolean
    typeTextMap: Record<QuestionBank['type'], string>
    logMenuOrigin?: QuestionBankTestLogMenuOrigin
  }>(),
  { testScopeAll: false, celebrateSessionPerfect: false, logMenuOrigin: 'learning-question-bank' },
)

const emit = defineEmits<{
  (e: 'back'): void
}>()

const { state: qb } = useQuestionBankTest(props, (e) => emit(e))

/** 用 units + index 取值，避免 reactive 内嵌 computed 在脚本里未解包导致一直拿不到当前题 */
const favoriteTarget = computed<QuestionFavoriteTarget | null>(() => {
  const list = unref(qb.units) as TestUnit[]
  const idx = unref(qb.currentIndex) as number
  const u = list[idx] ?? null
  if (!u) return null
  if (u.kind === 'general') return { mode: 'bank', question: u.question }
  if (u.kind === 'choice') return { mode: 'bank', question: u.question }
  if (u.parent.id == null) return null
  return { mode: 'derived-mcq', payload: mindmapTestUnitToPayload(u) }
})

const totalScoreRounded = computed(() => Math.round(qb.totalScore * 100) / 100)

const summaryTotalMax = computed(
  () => Math.round(qb.results.reduce((s, r) => s + r.maxScore, 0) * 100) / 100,
)

const summaryScoreRateText = computed(() => {
  const max = summaryTotalMax.value
  if (max <= 0) return '0%'
  return `${Math.round((totalScoreRounded.value / max) * 100)}%`
})

const summaryCorrectCount = computed(
  () => qb.results.filter((r) => r.maxScore > 0 && Math.round(r.score * 100) / 100 >= r.maxScore).length,
)

const summaryTotalCount = computed(() => qb.results.length)

const summaryCorrectRateText = computed(() => {
  const n = summaryTotalCount.value
  if (n <= 0) return '0%'
  return `${Math.round((summaryCorrectCount.value / n) * 100)}%`
})

const currentMaxScore = computed(() =>
  qb.currentUnit ? qb.maxScoreForUnit(qb.currentUnit) : 0,
)
</script>

<template>
  <section
    class="question-test-page"
    :class="{
      'is-fill-page-padding':
        qb.phase === 'running' || qb.phase === 'building' || qb.phase === 'summary',
    }"
  >
    <QuestionBankTestTopbar
      :learning-type-name="learningTypeName"
      :phase="qb.phase"
      :units-length="qb.units.length"
      :progress-label="qb.progressLabel"
      :current-max-score="currentMaxScore"
      :total-score-rounded="totalScoreRounded"
      :running-total-max="qb.runningTotalMax"
      :summary-total-max="summaryTotalMax"
      :running-elapsed-text="qb.quizRunningElapsedText"
      :summary-duration-text="qb.quizDurationSummaryText"
      @back="qb.backToBank()"
    />

    <div
      class="test-body"
      :class="{
        'is-running-split': qb.phase === 'running' && !!qb.currentUnit,
      }"
    >
      <template v-if="loading">
        <p class="test-muted">题库加载中…</p>
      </template>
      <template v-else-if="!qb.units.length && qb.phase === 'idle'">
        <p class="test-muted">当前类型下暂无题目。</p>
      </template>
      <template v-else-if="qb.phase === 'building'">
        <p class="test-muted">{{ qb.buildStatus }}</p>
        <p v-if="!testBuildConfig" class="test-hint">
          正在调用 DeepSeek 生成干扰项与思维导图小题（约 5～10 道，以加粗考点为主），请稍候。
        </p>
      </template>
      <template v-else-if="qb.phase === 'running' && qb.currentUnit">
        <div class="test-running-with-nav">
          <aside class="quiz-nav-sidebar" aria-label="题目列表与作答情况">
            <h4 class="quiz-nav-aside-title">题目</h4>
            <p class="quiz-nav-intro">
              进度 {{ qb.questionsAnsweredCount }} / {{ qb.units.length }} 道；全部提交后进入结果页。点击条目跳转。
            </p>
            <ul class="quiz-nav-list" role="list">
              <li
                v-for="item in qb.quizNavigatorItems"
                :key="item.unitIndex"
                class="quiz-nav-item"
                :class="{ 'is-current': item.isCurrent, 'is-done': item.done }"
                role="button"
                tabindex="0"
                @click="qb.goToQuestion(item.unitIndex)"
                @keydown.enter.prevent="qb.goToQuestion(item.unitIndex)"
                @keydown.space.prevent="qb.goToQuestion(item.unitIndex)"
              >
                <span class="quiz-nav-no">{{ item.displayNo }}</span>
                <div class="quiz-nav-body">
                  <span class="quiz-nav-title">{{ item.title }}</span>
                  <span v-if="item.subline" class="quiz-nav-sub">{{ item.subline }}</span>
                  <span v-else class="quiz-nav-meta">{{ item.typeLabel }}</span>
                  <span
                    class="quiz-nav-status"
                    :class="item.done ? 'quiz-nav-status--done' : 'quiz-nav-status--todo'"
                  >
                    {{ item.statusLine }}
                  </span>
                </div>
              </li>
            </ul>
          </aside>
          <div class="test-running-main">
            <div
              v-if="!loading && qb.units.length"
              class="test-running-score-banner-wrap test-running-score-banner-wrap--in-main"
            >
              <QuestionBankTestRunningScoreBanner
                :total-score-rounded="totalScoreRounded"
                :running-total-max="qb.runningTotalMax"
              />
            </div>
            <QuestionBankTestGeneralUnit
              v-if="qb.currentUnit.kind === 'general'"
              v-model:answer-html="qb.answerHtml"
              v-model:self-score="qb.selfScore"
              :question="qb.currentUnit.question"
              :general-submitted="qb.generalSubmitted"
              :general-mistake-aware="qb.generalMistakeAware"
              :max-score="qb.maxScoreForUnit(qb.currentUnit)"
              :current-index="qb.currentIndex"
              :learning-type-id="learningTypeId"
              :favorite-target="favoriteTarget"
              @inject="qb.onInjectAnswer"
              @submit-general="qb.submitGeneral()"
              @next-general="qb.nextAfterGeneral()"
            />
            <QuestionBankTestMcqUnit
              v-else
              v-model:selected-single="qb.selectedSingle"
              v-model:selected-multi="qb.selectedMulti"
              :unit="qb.currentUnit"
              :mcq-submitted="qb.mcqSubmitted"
              :current-options="qb.currentOptions"
              :current-mcq-mode="qb.currentMcqMode"
              :assist-html="qb.assistHtml"
              :assist-loading="qb.assistLoading"
              :assist-error="qb.assistError"
              :analysis-for-current="qb.analysisForCurrent"
              :correct-labels="qb.correctLabels"
              :mcq-mistake-aware="qb.mcqMistakeAware"
              :mcq-user-selected-labels="qb.mcqUserSelectedLabels"
              :max-score="qb.maxScoreForUnit(qb.currentUnit)"
              :selected-indices="qb.selectedForMcq()"
              :current-index="qb.currentIndex"
              :learning-type-id="learningTypeId"
              :favorite-target="favoriteTarget"
              @run-assist="qb.runMcqAssist()"
              @submit-mcq="qb.submitMcq()"
              @next-mcq="qb.nextAfterMcq()"
            />
          </div>
        </div>
      </template>

      <QuestionBankTestSummaryPanel
        v-else-if="qb.phase === 'summary'"
        :results="qb.results"
        :total-score-rounded="totalScoreRounded"
        :summary-total-max="summaryTotalMax"
        :quiz-duration-summary-text="qb.quizDurationSummaryText"
        :score-rate-text="summaryScoreRateText"
        :correct-rate-text="summaryCorrectRateText"
        :correct-count="summaryCorrectCount"
        :total-count="summaryTotalCount"
        :show-radar-panel="qb.showRadarPanel"
        :radar-loading="qb.radarLoading"
        :radar-error="qb.radarError"
        :radar-dimensions="qb.radarDimensions"
        :radar-analysis-html="qb.radarAnalysisHtml"
        :radar-chart-error="qb.radarChartError"
        @open-radar="qb.openRadarPanel()"
        @retry-radar-analysis="qb.retryRadarAnalysis()"
        @retry-radar-chart="qb.retryRadarChartRender()"
        @back="qb.backToBank()"
      >
        <template #chart>
          <div v-if="qb.radarChartError" class="test-radar-chart-error">
            <p class="test-error">{{ qb.radarChartError }}</p>
            <el-button type="primary" plain size="small" @click="qb.retryRadarChartRender()">
              重试加载雷达图
            </el-button>
          </div>
          <div
            v-else
            :ref="(el) => qb.bindRadarChartEl(el)"
            class="test-radar-chart"
            role="img"
            aria-label="六维能力雷达图"
          />
        </template>
      </QuestionBankTestSummaryPanel>
    </div>
  </section>
</template>

<style scoped>
.question-test-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  /* 内层算错高度时仍可纵向滚动，避免内容被裁死 */
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.question-test-page :deep(.test-topbar) {
  flex-shrink: 0;
}

.question-test-page.is-fill-page-padding {
  margin: -20px -20px 0;
  padding: 0 20px;
  width: calc(100% + 40px);
  max-width: none;
  box-sizing: border-box;
}

.question-test-page.is-fill-page-padding :deep(.test-topbar) {
  margin-bottom: 0;
  border-radius: 0;
  padding-top: 20px;
  border-top: none;
  border-left: none;
  border-right: none;
}

.question-test-page.is-fill-page-padding .test-body {
  border-top: none;
  border-radius: 0;
}

.test-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 0 14px 14px;
  background: var(--app-surface);
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-overflow-scrolling: touch;
}

/* 作答中：左右栏用视口高度定死滚动容器，不依赖父级 flex 是否算出高度 */
.test-body.is-running-split {
  flex: 1;
  min-height: 0;
  overflow: visible;
}

.test-running-with-nav {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;
  width: 100%;
  box-sizing: border-box;
  /* 顶栏 + 主区域 padding + 测验顶栏约 12rem，剩余给左右分栏各自 overflow */
  height: calc(100dvh - 12rem);
  max-height: calc(100dvh - 12rem);
  min-height: 240px;
  overflow: hidden;
  flex: none;
}

.test-running-with-nav > .quiz-nav-sidebar,
.test-running-with-nav > .test-running-main {
  min-height: 0;
}

.quiz-nav-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  padding: 12px 10px;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface-alt);
}

.quiz-nav-aside-title {
  margin: 0 0 8px;
  font-size: 0.95rem;
  font-weight: 600;
}

.quiz-nav-sidebar .quiz-nav-list {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.test-running-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.test-running-score-banner-wrap--in-main :deep(.test-running-score-banner) {
  margin-left: 0;
  margin-right: 0;
}

@media (max-width: 900px) {
  .test-running-with-nav {
    grid-template-columns: 1fr;
    height: auto;
    max-height: none;
    min-height: 0;
    overflow: visible;
    flex: 1;
  }

  .test-body.is-running-split {
    overflow-y: auto;
  }

  .quiz-nav-sidebar {
    height: auto;
    max-height: min(42vh, 340px);
    overflow: hidden;
  }

  .quiz-nav-sidebar .quiz-nav-list {
    overflow-y: auto;
  }

  .test-running-main {
    height: auto;
    max-height: none;
    overflow-y: visible;
  }
}

.test-muted {
  margin: 0;
  color: var(--app-text-muted);
}

.test-hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

.test-radar-chart-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  height: 340px;
  min-height: 280px;
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface-alt);
  justify-content: center;
  box-sizing: border-box;
}

.test-radar-chart {
  height: 340px;
  min-height: 280px;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface-alt);
}

.test-error {
  margin: 0;
  color: var(--app-danger, #dc2626);
  font-size: 13px;
}

.quiz-nav-intro {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.quiz-nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quiz-nav-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface);
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.quiz-nav-item:hover {
  border-color: var(--app-primary, #2563eb);
  background: var(--app-surface-alt);
}

.quiz-nav-item.is-current {
  border-color: var(--app-primary, #2563eb);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.quiz-nav-item.is-done:not(.is-current) {
  opacity: 0.96;
}

.quiz-nav-no {
  flex-shrink: 0;
  min-width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 8px;
  background: var(--app-surface);
  border: 1px solid var(--app-border-soft);
  color: var(--app-text-muted);
}

.quiz-nav-item.is-current .quiz-nav-no {
  background: var(--app-primary, #2563eb);
  border-color: var(--app-primary, #2563eb);
  color: #fff;
}

.quiz-nav-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quiz-nav-title {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.35;
  word-break: break-word;
}

.quiz-nav-sub,
.quiz-nav-meta {
  font-size: 12px;
  color: var(--app-text-muted);
  line-height: 1.4;
  word-break: break-word;
}

.quiz-nav-status {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
}

.quiz-nav-status--todo {
  color: var(--app-text-muted);
}

.quiz-nav-status--done {
  color: var(--app-primary, #2563eb);
}
</style>
