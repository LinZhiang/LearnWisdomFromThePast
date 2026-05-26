<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { AnswerLog } from '@/db/models'
import { answerLogService, questionBankService } from '@/services/data-services'
import {
  buildQuizRadarResultLines,
  groupQuestionBankTestSessions,
  questionBankTestLogOriginLabel,
  questionBankTestTypeLabel,
  type QuestionBankTestAnswerPayload,
  type QuestionBankTestSession,
  type QuestionBankTestSessionEntry,
} from '@/utils/questionBankTestLog'
import AnswerLogRadarPanel from './AnswerLogRadarPanel.vue'

const logs = ref<AnswerLog[]>([])
const loading = ref(false)
const viewMode = ref<'list' | 'detail'>('list')
const selectedSession = ref<QuestionBankTestSession | null>(null)

const loadLogs = async () => {
  loading.value = true
  try {
    const raw = await answerLogService.listAll()
    logs.value = raw.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime()
      const tb = new Date(b.createdAt).getTime()
      return tb - ta
    })
  } finally {
    loading.value = false
  }
}

/** 列表表格可视高度（与详情得分表一致：min(45vh, 400px)） */
const sessionListTableMaxHeight = ref(400)
const syncSessionListTableMaxHeight = () => {
  if (typeof window === 'undefined') return
  sessionListTableMaxHeight.value = Math.min(Math.round(window.innerHeight * 0.45), 400)
}

onMounted(() => {
  syncSessionListTableMaxHeight()
  window.addEventListener('resize', syncSessionListTableMaxHeight)
  void loadLogs()
})

onUnmounted(() => {
  window.removeEventListener('resize', syncSessionListTableMaxHeight)
})

const sessions = computed(() => groupQuestionBankTestSessions(logs.value))

/** 测验列表分页 */
const listPageSize = ref(10)
const listCurrentPage = ref(1)

const paginatedSessions = computed(() => {
  const all = sessions.value
  const start = (listCurrentPage.value - 1) * listPageSize.value
  return all.slice(start, start + listPageSize.value)
})

watch(listPageSize, () => {
  listCurrentPage.value = 1
})

watch(
  () => sessions.value.length,
  () => {
    const n = sessions.value.length
    const maxPage = Math.max(1, Math.ceil(n / listPageSize.value) || 1)
    if (listCurrentPage.value > maxPage) listCurrentPage.value = maxPage
  },
)

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const openDetail = (s: QuestionBankTestSession) => {
  selectedSession.value = s
  viewMode.value = 'detail'
}

const removeSession = async (s: QuestionBankTestSession) => {
  const ok = window.confirm(
    `确认删除该次测验日志吗？\n来源：${questionBankTestLogOriginLabel(s.logMenuOrigin)}\n学习类型：${s.learningTypeName}\n完成时间：${formatTime(s.finishedAt)}`,
  )
  if (!ok) return
  const targets = logs.value.filter((log) => {
    const p = groupPayload(log)
    return p?.quizSessionId === s.quizSessionId
  })
  const ids = targets.map((x) => x.id).filter((id): id is number => id != null)
  if (!ids.length) return
  await Promise.all(ids.map((id) => answerLogService.remove(id)))
  await loadLogs()
}

const groupPayload = (log: AnswerLog) => {
  const t = log.answer.trim()
  if (!t.startsWith('{')) return null
  try {
    return JSON.parse(t) as { quizSessionId?: string }
  } catch {
    return null
  }
}

const backToList = () => {
  viewMode.value = 'list'
  selectedSession.value = null
}

const rowFullScore = (p: QuestionBankTestAnswerPayload) =>
  p.maxScore > 0 && Math.round(p.score * 100) / 100 >= p.maxScore

const radarResultLines = computed(() =>
  selectedSession.value ? buildQuizRadarResultLines(selectedSession.value) : '',
)

/** 答题明细分页 */
const detailPageSize = ref(5)
const detailCurrentPage = ref(1)

watch(
  () => selectedSession.value?.quizSessionId,
  () => {
    detailCurrentPage.value = 1
  },
)

watch(detailPageSize, () => {
  detailCurrentPage.value = 1
})

const detailEntriesAll = computed(() => selectedSession.value?.entries ?? [])

const paginatedDetailEntries = computed(() => {
  const all = detailEntriesAll.value
  const start = (detailCurrentPage.value - 1) * detailPageSize.value
  return all.slice(start, start + detailPageSize.value)
})

const detailCorrectCount = computed(() =>
  detailEntriesAll.value.filter(
    ({ payload: p }) => p.maxScore > 0 && Math.round(p.score * 100) / 100 >= p.maxScore,
  ).length,
)

const detailTotalCount = computed(() => detailEntriesAll.value.length)

const detailCorrectRateText = computed(() => {
  const n = detailTotalCount.value
  if (n <= 0) return '0%'
  return `${Math.round((detailCorrectCount.value / n) * 100)}%`
})

const detailScoreRateText = computed(() => {
  const s = selectedSession.value
  if (!s || s.totalMax <= 0) return '0%'
  return `${Math.round((s.totalScore / s.totalMax) * 100)}%`
})

/** 按题库 id 解析的题目名称（优先于日志里存的 questionTitle，避免历史误存为类型名等） */
const resolvedQuestionTitleByBankId = ref<Record<number, string>>({})

watch(
  () => selectedSession.value?.quizSessionId,
  async (sid) => {
    resolvedQuestionTitleByBankId.value = {}
    if (!sid) return
    const s = selectedSession.value
    if (!s || s.quizSessionId !== sid) return
    const ids = [
      ...new Set(
        s.entries
          .map((e) => e.questionBankId)
          .filter((id): id is number => typeof id === 'number' && id > 0),
      ),
    ]
    if (!ids.length) return
    const rec: Record<number, string> = {}
    await Promise.all(
      ids.map(async (id) => {
        const q = await questionBankService.getById(id)
        const t = q?.title?.trim()
        if (t) rec[id] = t
      }),
    )
    if (selectedSession.value?.quizSessionId === sid) {
      resolvedQuestionTitleByBankId.value = rec
    }
  },
)

const entryQuestionDisplayTitle = (entry: QuestionBankTestSessionEntry) => {
  const p = entry.payload
  // 导图小题：日志里的 questionTitle / 父题 id 查库都是「父题名称」，与明细里的题干 mindmapStem 一一对应
  if (p.questionType === 'mindmap-mcq') {
    const stem = p.mindmapStem?.trim()
    if (stem) return stem
  }
  const id = entry.questionBankId
  if (id != null && id > 0) {
    const fromBank = resolvedQuestionTitleByBankId.value[id]
    if (fromBank) return fromBank
  }
  return p.questionTitle
}
</script>

<template>
  <section class="answer-log-page" :class="{ 'is-detail-open': viewMode === 'detail' && selectedSession }">
    <header v-if="viewMode === 'list'" class="page-hero">
      <span class="page-kicker">智学 06</span>
      <h2 class="page-title">答题日志</h2>
      <p class="page-subtitle">
        学习题库、错题本、题目收藏中的「题目测试」均会写入日志，并按同一次测验汇总为一行（列表中可区分来源）；点击查看详情可浏览得分表与逐题明细，并可在本页重新生成 DeepSeek 六维雷达（需配置 API Key）。
      </p>
    </header>

    <template v-if="viewMode === 'list'">
      <div class="answer-log-toolbar">
        <el-button :loading="loading" @click="loadLogs">刷新</el-button>
      </div>

      <p v-if="loading" class="muted">加载中…</p>
      <p v-else-if="!sessions.length" class="muted">暂无测验记录。请在学习题库、错题本或题目收藏中完成题目测试。</p>

      <div v-else class="session-table-wrap">
        <el-table
          class="session-el-table"
          :data="paginatedSessions"
          row-key="quizSessionId"
          border
          stripe
          table-layout="auto"
          :max-height="sessionListTableMaxHeight"
        >
          <el-table-column label="完成时间" min-width="168">
            <template #default="{ row }">
              <span class="cell-time">{{ formatTime(row.finishedAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="100" align="center">
            <template #default="{ row }">
              <span class="cell-origin">{{ questionBankTestLogOriginLabel(row.logMenuOrigin) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="learningTypeName" label="学习类型" min-width="120" show-overflow-tooltip />
          <el-table-column prop="questionCount" label="题数" width="72" align="center" />
          <el-table-column label="得分" width="120" align="center">
            <template #default="{ row }">
              <span class="cell-score">{{ row.totalScore }} / {{ row.totalMax }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="168" align="center" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link @click="openDetail(row)">查看详情</el-button>
              <el-button type="danger" link @click="removeSession(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="sessions.length" class="list-pagination-bar">
          <el-pagination
            v-model:current-page="listCurrentPage"
            v-model:page-size="listPageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="sessions.length"
            layout="total, sizes, prev, pager, next"
            background
          />
        </div>
      </div>
    </template>

    <template v-else-if="selectedSession">
      <div class="detail-toolbar">
        <el-button @click="backToList">返回列表</el-button>
      </div>

      <div class="detail-shell">
        <div class="detail-scroll">
          <div class="detail-card">
            <h3 class="detail-title">作答情况</h3>
            <p class="detail-sub muted">
              来源：<strong>{{ questionBankTestLogOriginLabel(selectedSession.logMenuOrigin) }}</strong>
              · 学习类型：<strong>{{ selectedSession.learningTypeName }}</strong>
              · 完成于 {{ formatTime(selectedSession.finishedAt) }}
            </p>
            <p class="detail-total">
              总得分 {{ selectedSession.totalScore }} / {{ selectedSession.totalMax }} 分
            </p>
            <p class="detail-total detail-total-sub">
              分数正确率 {{ detailScoreRateText }}
            </p>
            <p class="detail-total detail-total-sub">
              答题正确率 {{ detailCorrectRateText }}（{{ detailCorrectCount }} / {{ detailTotalCount }}）
            </p>

            <div class="detail-table-scroll">
              <div class="detail-summary-table">
                <div class="detail-summary-head">
                  <span>序号</span>
                  <span>题型</span>
                  <span>题目名称</span>
                  <span>说明</span>
                  <span>得分</span>
                </div>
                <div
                  v-for="entry in selectedSession.entries"
                  :key="entry.payload.unitIndex + entry.createdAt"
                  class="detail-summary-row"
                >
                  <span>{{ entry.payload.unitIndex }}</span>
                  <span>{{ questionBankTestTypeLabel(entry.payload.questionType) }}</span>
                  <span class="cell-title">{{ entryQuestionDisplayTitle(entry) }}</span>
                  <span class="cell-detail">{{ entry.payload.resultDetail }}</span>
                  <span>{{ entry.payload.score }} / {{ entry.payload.maxScore }}</span>
                </div>
              </div>
            </div>

            <h4 class="detail-section-title">答题明细</h4>
            <div class="detail-blocks">
              <div
                v-for="entry in paginatedDetailEntries"
                :key="'d-' + entry.payload.unitIndex + entry.createdAt"
                class="detail-block"
              >
                <div class="detail-block-head">
                  <span class="detail-block-idx">第 {{ entry.payload.unitIndex }} 题</span>
                  <span class="detail-block-type">{{
                    questionBankTestTypeLabel(entry.payload.questionType)
                  }}</span>
                  <span :class="rowFullScore(entry.payload) ? 'tag-ok' : 'tag-warn'">
                    {{ rowFullScore(entry.payload) ? '满分' : '未满分' }} ·
                    {{ entry.payload.score }} / {{ entry.payload.maxScore }} 分
                  </span>
                </div>
                <p class="detail-block-title">{{ entryQuestionDisplayTitle(entry) }}</p>
                <div class="detail-block-body-scroll">
                  <template v-if="entry.payload.questionType === 'general'">
                    <p v-if="entry.payload.userAnswerPlain" class="detail-block-line">
                      <strong>作答摘要：</strong>{{ entry.payload.userAnswerPlain }}
                    </p>
                    <p v-else class="detail-block-line muted">（无作答文本摘要）</p>
                  </template>
                  <template v-else>
                    <p
                      v-if="
                        entry.payload.mindmapStem?.trim() &&
                        entryQuestionDisplayTitle(entry) !== entry.payload.mindmapStem.trim()
                      "
                      class="detail-block-line"
                    >
                      <strong>题干：</strong>{{ entry.payload.mindmapStem }}
                    </p>
                    <p v-if="entry.payload.userChoiceLabels?.length" class="detail-block-line">
                      <strong>所选：</strong>{{ entry.payload.userChoiceLabels.join('；') }}
                    </p>
                    <p v-if="entry.payload.correctChoiceLabels?.length" class="detail-block-line">
                      <strong>正确选项：</strong>{{ entry.payload.correctChoiceLabels.join('；') }}
                    </p>
                  </template>
                  <p class="detail-block-meta muted">{{ entry.payload.resultDetail }}</p>
                </div>
              </div>
            </div>
            <div v-if="detailEntriesAll.length" class="detail-pagination-bar">
              <el-pagination
                v-model:current-page="detailCurrentPage"
                v-model:page-size="detailPageSize"
                :page-sizes="[5, 10, 15, 20]"
                :total="detailEntriesAll.length"
                layout="total, sizes, prev, pager, next"
                background
                small
              />
            </div>

            <AnswerLogRadarPanel
              :key="selectedSession.quizSessionId"
              :learning-type-name="selectedSession.learningTypeName"
              :total-score="selectedSession.totalScore"
              :total-max="selectedSession.totalMax"
              :result-lines="radarResultLines"
            />
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.answer-log-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
}

.answer-log-page.is-detail-open {
  display: flex;
  flex-direction: column;
  /* 顶栏 + main 上下 padding，保证详情区内自行滚动、整页不再无限拉长 */
  height: calc(100vh - 7.5rem);
  height: calc(100dvh - 7.5rem);
  max-height: calc(100vh - 7.5rem);
  max-height: calc(100dvh - 7.5rem);
  min-height: 0;
}

.detail-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.detail-block-body-scroll {
  max-height: min(40vh, 320px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  -webkit-overflow-scrolling: touch;
}

.page-hero .page-title {
  margin: 0 0 8px;
}

.page-subtitle {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 14px;
}

.answer-log-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.muted {
  margin: 0;
  color: var(--app-text-muted);
}

.session-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.session-el-table {
  width: 100%;
  font-size: 14px;
  border-radius: 10px;
  overflow: hidden;
}

.cell-origin {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.cell-time {
  font-size: 12px;
  color: var(--app-text-muted);
}

.cell-score {
  font-weight: 600;
  color: var(--app-primary, #2563eb);
}

.list-pagination-bar {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.list-pagination-bar :deep(.el-pagination) {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.detail-toolbar {
  flex-shrink: 0;
  margin-bottom: 4px;
}

.detail-card {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 16px;
  background: var(--app-surface);
}

.detail-title {
  margin: 0 0 8px;
  font-size: 1.1rem;
}

.detail-sub {
  margin: 0 0 8px;
  font-size: 13px;
}

.detail-total {
  margin: 0 0 14px;
  font-weight: 600;
}

.detail-total-sub {
  margin-top: -8px;
  margin-bottom: 14px;
  font-weight: 500;
  font-size: 13px;
  color: var(--app-text-muted);
}

.detail-table-scroll {
  max-height: min(45vh, 400px);
  min-height: 120px;
  overflow: auto;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  margin-bottom: 20px;
  -webkit-overflow-scrolling: touch;
}

.detail-summary-table {
  font-size: 13px;
  min-width: min-content;
}

.detail-summary-head,
.detail-summary-row {
  display: grid;
  grid-template-columns: 44px 100px minmax(0, 1fr) minmax(0, 1fr) 88px;
  gap: 8px;
  padding: 8px 10px;
  align-items: start;
}

.detail-summary-head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: color-mix(
    in srgb,
    var(--app-text-muted, #64748b) 6%,
    var(--app-surface, #fff)
  );
  font-weight: 600;
  box-shadow: 0 1px 0 var(--app-border-soft);
}

.detail-summary-row {
  border-top: 1px solid var(--app-border-soft);
}

.detail-summary-row:nth-child(even) {
  background: color-mix(
    in srgb,
    var(--app-text-muted, #64748b) 4%,
    var(--app-surface, #fff)
  );
}

.cell-title,
.cell-detail {
  min-width: 0;
  word-break: break-word;
}

.detail-section-title {
  margin: 0 0 12px;
  font-size: 1rem;
}

.detail-pagination-bar {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.detail-pagination-bar :deep(.el-pagination) {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.detail-blocks {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-block {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--app-surface-alt);
}

.detail-block-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 8px;
  font-size: 13px;
}

.detail-block-idx {
  font-weight: 600;
}

.detail-block-type {
  color: var(--app-text-muted);
}

.detail-block-title {
  margin: 0 0 8px;
  font-weight: 600;
  font-size: 14px;
}

.detail-block-line {
  margin: 0 0 6px;
  line-height: 1.55;
  font-size: 13px;
}

.detail-block-meta {
  margin: 8px 0 0;
  font-size: 12px;
}

.tag-ok {
  color: var(--app-success, #16a34a);
  font-weight: 600;
}

.tag-warn {
  color: var(--app-warning, #ca8a04);
  font-weight: 600;
}

@media (max-width: 720px) {
  .detail-summary-head {
    display: none;
  }

  .detail-summary-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}
</style>

<style>
/* el-table 内部节点需非 scoped，与分数排名页斑纹风格一致 */
.session-el-table.el-table {
  --el-table-bg-color: var(--app-surface, #fff);
  --el-table-tr-bg-color: var(--app-surface, #fff);
  --el-table-header-bg-color: color-mix(
    in srgb,
    var(--app-text-muted, #64748b) 6%,
    var(--app-surface, #fff)
  );
  --el-table-row-hover-bg-color: color-mix(
    in srgb,
    var(--app-text-muted, #64748b) 7%,
    var(--app-surface, #fff)
  );
  --el-table-border-color: var(--app-border-soft, #e2e8f0);
}

.session-el-table.el-table--striped
  .el-table__body
  tr.el-table__row--striped
  > td.el-table__cell {
  background-color: color-mix(
    in srgb,
    var(--app-text-muted, #64748b) 4%,
    var(--app-surface, #fff)
  ) !important;
}

.session-el-table .el-table__body tr:hover > td.el-table__cell {
  background-color: color-mix(
    in srgb,
    var(--app-text-muted, #64748b) 7%,
    var(--app-surface, #fff)
  ) !important;
}
</style>
