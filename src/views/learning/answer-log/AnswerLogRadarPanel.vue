<script setup lang="ts">
import { ElMessage } from 'element-plus'
import DOMPurify from 'dompurify'
import * as echarts from 'echarts'
import { marked } from 'marked'
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { QuizRadarDimension } from '@/services/deepseek'
import { isAiChatConfigured, requestQuizRadarAnalysis } from '@/services/deepseek'
import { hashForAiCache, rememberAiResponse } from '@/utils/aiResponseCache'

const props = defineProps<{
  learningTypeName: string
  totalScore: number
  totalMax: number
  resultLines: string
}>()

const showRadarPanel = ref(false)
const radarLoading = ref(false)
const radarError = ref('')
const radarChartError = ref('')
const radarDimensions = ref<QuizRadarDimension[]>([])
const radarAnalysisMd = ref('')

const radarChartRef = ref<HTMLDivElement | null>(null)
let radarChartInstance: echarts.ECharts | null = null

const radarAnalysisHtml = computed(() => {
  const md = radarAnalysisMd.value.trim()
  if (!md) return ''
  const raw = marked.parse(md, { async: false })
  if (typeof raw !== 'string') return ''
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
})

function disposeRadarChart() {
  radarChartInstance?.dispose()
  radarChartInstance = null
}

function resizeRadarChart() {
  radarChartInstance?.resize()
}

/**
 * 雷达容器在模板中与 v-if="!radarLoading" 互斥，须在接口结束并将 radarLoading 置 false、
 * Markdown 区域挂载后再初始化 ECharts；否则 ref 为空，需手动刷新才能出现图。
 */
async function flushDomAndRenderRadarChart(
  onFail: (msg: string) => void = (msg) => ElMessage.warning(msg),
) {
  await nextTick()
  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
  if (radarDimensions.value.length !== 6) return
  if (!updateRadarChart()) {
    onFail(radarChartError.value || '雷达图未显示，可点击「重试加载雷达图」')
  } else {
    requestAnimationFrame(() => resizeRadarChart())
  }
}

function updateRadarChart(): boolean {
  radarChartError.value = ''
  const el = radarChartRef.value
  const dims = radarDimensions.value
  if (!el || dims.length !== 6) {
    radarChartError.value =
      '雷达图容器未就绪，请稍后点击「重试加载雷达图」，或稍候再试。'
    return false
  }
  try {
    disposeRadarChart()
    radarChartInstance = echarts.init(el)
    radarChartInstance.setOption({
      color: ['#2563eb'],
      tooltip: { trigger: 'item' },
      radar: {
        indicator: dims.map((d) => ({ name: d.name, max: 100 })),
        radius: '62%',
        splitNumber: 4,
        axisName: {
          fontSize: 11,
          color: '#64748b',
          overflow: 'break',
          width: 96,
          lineHeight: 14,
        },
      },
      series: [
        {
          type: 'radar',
          areaStyle: { opacity: 0.15 },
          lineStyle: { width: 2 },
          data: [{ value: dims.map((d) => d.score), name: '本次测验' }],
        },
      ],
    })
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知错误'
    radarChartError.value = `雷达图渲染失败：${msg}`
    return false
  }
}

async function loadQuizRadarAnalysis() {
  radarError.value = ''
  radarChartError.value = ''
  radarDimensions.value = []
  radarAnalysisMd.value = ''
  disposeRadarChart()
  if (!isAiChatConfigured()) {
    radarError.value = '未配置 AI 代理，无法生成综合判定与雷达图（见 docs/ENV-说明.md）。'
    return
  }
  radarLoading.value = true
  try {
    const res = await rememberAiResponse(
      `quiz-radar:${hashForAiCache(
        [
          props.learningTypeName,
          String(props.totalScore),
          String(props.totalMax),
          props.resultLines,
        ].join('\0'),
      )}`,
      () =>
        requestQuizRadarAnalysis({
          learningTypeName: props.learningTypeName,
          totalScore: Math.round(props.totalScore * 100) / 100,
          totalMax: Math.round(props.totalMax * 100) / 100,
          resultLines: props.resultLines,
        }),
    )
    radarDimensions.value = res.dimensions
    radarAnalysisMd.value = res.analysisMd
  } catch (e) {
    radarError.value = e instanceof Error ? e.message : '请求失败'
    ElMessage.error(radarError.value)
  } finally {
    radarLoading.value = false
  }
  if (radarDimensions.value.length === 6) {
    await flushDomAndRenderRadarChart()
  }
}

function openRadarPanel() {
  showRadarPanel.value = true
  if (radarLoading.value) return
  if (radarDimensions.value.length === 6) {
    if (radarChartError.value) {
      retryRadarChartRender()
      return
    }
    void flushDomAndRenderRadarChart()
    return
  }
  void loadQuizRadarAnalysis()
}

function retryRadarAnalysis() {
  radarError.value = ''
  radarChartError.value = ''
  disposeRadarChart()
  void loadQuizRadarAnalysis()
}

function retryRadarChartRender() {
  radarChartError.value = ''
  void flushDomAndRenderRadarChart((msg) =>
    ElMessage.error(msg || '雷达图仍无法显示'),
  )
}

const bindRadarChartEl = (el: Element | ComponentPublicInstance | null) => {
  radarChartRef.value = el instanceof HTMLElement ? (el as HTMLDivElement) : null
}

onMounted(() => {
  window.addEventListener('resize', resizeRadarChart)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeRadarChart)
  disposeRadarChart()
})
</script>

<template>
  <div class="alog-radar-wrap">
    <div class="alog-radar-trigger">
      <el-button
        type="primary"
        plain
        :loading="radarLoading"
        :disabled="radarLoading"
        @click="openRadarPanel"
      >
        <template v-if="!showRadarPanel">查看 DeepSeek 综合判定与六维雷达</template>
        <template v-else-if="radarLoading">正在生成…</template>
        <template v-else-if="radarError">请求失败，可再次点击或下方重试</template>
        <template v-else-if="radarDimensions.length === 6 && radarChartError">雷达图未显示，点击重试渲染</template>
        <template v-else-if="radarDimensions.length === 6">内容已在下方展开</template>
        <template v-else>生成中…</template>
      </el-button>
    </div>

    <div v-if="showRadarPanel" class="alog-radar-panel">
      <h4 class="alog-radar-title">DeepSeek 答题解析 · 六维雷达</h4>
      <p v-if="radarLoading" class="alog-muted">正在根据作答情况生成解析与雷达图…</p>
      <div v-else-if="radarError" class="alog-radar-error-block">
        <p class="alog-error">{{ radarError }}</p>
        <el-button size="small" type="primary" plain @click="retryRadarAnalysis">
          重新请求解析与雷达数据
        </el-button>
      </div>
      <div v-else-if="radarDimensions.length === 6" class="alog-radar-grid">
        <div class="alog-radar-left">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="alog-radar-md deepseek-md" v-html="radarAnalysisHtml" />
          <ul class="alog-radar-dim-list" aria-label="六维得分要点">
            <li v-for="d in radarDimensions" :key="d.name">
              <span class="alog-radar-dim-name">{{ d.name }}</span>
              <span class="alog-radar-dim-score">{{ d.score }} 分</span>
              <span v-if="d.brief" class="alog-radar-dim-brief">{{ d.brief }}</span>
            </li>
          </ul>
        </div>
        <div class="alog-radar-chart-col">
          <div v-if="radarChartError" class="alog-radar-chart-error">
            <p class="alog-error">{{ radarChartError }}</p>
            <el-button type="primary" plain size="small" @click="retryRadarChartRender">
              重试加载雷达图
            </el-button>
          </div>
          <div
            v-else
            :ref="(el) => bindRadarChartEl(el)"
            class="alog-radar-chart"
            role="img"
            aria-label="六维能力雷达图"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alog-radar-wrap {
  flex-shrink: 0;
}

.alog-radar-trigger {
  margin-top: 8px;
}

.alog-radar-panel {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--app-border-soft);
}

.alog-radar-title {
  margin: 0 0 12px;
  font-size: 1.05rem;
  font-weight: 600;
}

.alog-muted {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 14px;
}

.alog-error {
  margin: 0;
  color: var(--app-danger, #dc2626);
  font-size: 13px;
}

.alog-radar-error-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.alog-radar-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  gap: 20px;
  align-items: start;
}

@media (max-width: 900px) {
  .alog-radar-grid {
    grid-template-columns: 1fr;
  }
}

.alog-radar-left {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.alog-radar-md {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--app-surface-alt);
  font-size: 14px;
  line-height: 1.65;
  overflow-x: auto;
  overflow-y: visible;
  word-break: break-word;
  -webkit-overflow-scrolling: touch;
}

.alog-radar-dim-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.alog-radar-dim-list li {
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
  .alog-radar-dim-list li {
    grid-template-columns: 1fr;
  }
}

.alog-radar-dim-name {
  font-weight: 600;
}

.alog-radar-dim-score {
  color: var(--app-primary, #2563eb);
  font-weight: 600;
}

.alog-radar-dim-brief {
  color: var(--app-text-muted);
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.alog-radar-chart-col {
  min-width: 0;
  min-height: 280px;
}

.alog-radar-chart-error {
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

.alog-radar-chart {
  height: 340px;
  min-height: 280px;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface-alt);
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
