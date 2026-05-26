import { ElMessage, ElMessageBox } from 'element-plus'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import * as echarts from 'echarts'
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { QuestionBank } from '@/db/models'
import { answerLogService } from '@/services/data-services'
import {
  markWrongQuestionReviewedByTarget,
  recordWrongBookFullScoreQuizPass,
  upsertWrongQuestionFromAnswer,
  wrongTargetFromTestUnit,
  type WrongQuestionTarget,
} from '@/services/wrong-question-helpers'
import type { QuizRadarDimension } from '@/services/deepseek'
import {
  isAiChatConfigured,
  requestChoiceTestAssist,
  requestQuizRadarAnalysis,
} from '@/services/deepseek'
import {
  fetchCachedChoiceDistractors,
  fetchCachedMindmapDerivedMcqs,
} from '@/services/questionBankTestAiPrep'
import { parseChoiceQuestionContent, validateChoiceQuestionJson } from '@/utils/choiceQuestion'
import { htmlToPlainText } from '@/utils/htmlToText'
import type {
  QuestionBankTestAnswerPayload,
  QuestionBankTestLogMenuOrigin,
} from '@/utils/questionBankTestLog'
import { getAnswerLogUserName } from '@/utils/questionBankTestLog'
import {
  isLearningTypeQbPerfectCleared,
  markLearningTypeQbPerfectCleared,
} from '@/services/learning-type-qb-perfect-cleared'
import { loadWenWuUserScores, saveWenWuUserScores } from '@/views/learning/question-bank-score/wen-wu-user-scores'
import { useBackgroundMusicStore } from '@/stores/background-music'
import { startQbPerfectMidi, stopQbPerfectMidi } from '@/utils/qb-perfect-midi'
import {
  groupQuestionsByLearningType,
} from '@/utils/questionBankTestCount'
import { hashForAiCache, rememberAiResponse } from '@/utils/aiResponseCache'
import { shuffleArray, scoreMcqSelection } from '@/utils/testMcqScore'
import type { QuestionBankTestBuildConfig, ResultRow, TestPhase, TestUnit } from '../components/questionBankTestTypes'

/** 切题时保存草稿或已提交题目的 UI 状态，便于返回该题时还原 */
type UnitUiSnapshot =
  | {
      variant: 'general'
      answerHtml: string
      selfScore: number
      generalSubmitted: boolean
      assistMd: string
      assistError: string
    }
  | {
      variant: 'mcq'
      selectedSingle: number | null
      selectedMulti: number[]
      mcqSubmitted: boolean
      assistMd: string
      assistError: string
    }

type QuizUnitTimingRecord = {
  unitIndex: number
  kind: 'general' | 'choice' | 'mindmap-mcq'
  title: string
  secondsRounded: number
  /** 一般题型：题干/材料纯文本字数（用于效率加权） */
  generalPlainTextLen?: number
}

export function useQuestionBankTest(
  props: Readonly<{
    learningTypeName: string
    learningTypeId?: number | null
    /** 是否从「测试全部」进入（仅此时才可能触发整库全对奖励） */
    testScopeAll?: boolean
    /** 测验全对时播放音乐并弹窗（不写题库全对标签；与 testScopeAll 互斥使用） */
    celebrateSessionPerfect?: boolean
    questions: QuestionBank[]
    /** 学习题库测验构建配置（小项覆盖、题量；未设则构建全部候选） */
    testBuildConfig?: QuestionBankTestBuildConfig
    /** 外部预置测试单元（如收藏页中的导图衍生小题） */
    presetUnits?: TestUnit[]
    loading: boolean
    typeTextMap: Record<QuestionBank['type'], string>
    /** 答题日志中区分菜单来源（学习题库 / 错题本 / 题目收藏） */
    logMenuOrigin?: QuestionBankTestLogMenuOrigin
  }>,
  emit: (e: 'back') => void,
) {
  const resolvedLogMenuOrigin = (): QuestionBankTestLogMenuOrigin =>
    props.logMenuOrigin ?? 'learning-question-bank'
  const phase = ref<TestPhase>('idle')
  const buildStatus = ref('')
  const units = ref<TestUnit[]>([])
  const currentIndex = ref(0)
  const resultSlots = ref<(ResultRow | null)[]>([])
  const unitDrafts = ref<(UnitUiSnapshot | null)[]>([])
  const completedUiSnapshots = ref<(UnitUiSnapshot | null)[]>([])

  const totalScore = computed(() => {
    const raw = resultSlots.value.reduce((s, r) => s + (r?.score ?? 0), 0)
    return Math.round(raw * 100) / 100
  })

  const results = computed(() => {
    const out: ResultRow[] = []
    for (const r of resultSlots.value) {
      if (r) out.push(r)
    }
    return out
  })

  const quizSessionId = ref('')

  const answerHtml = ref('')
  const generalSubmitted = ref(false)
  const selfScore = ref(0)

  const selectedMulti = ref<number[]>([])
  const selectedSingle = ref<number | null>(null)
  const mcqSubmitted = ref(false)

  const assistLoading = ref(false)
  const assistMd = ref('')
  const assistError = ref('')

  const radarChartRef = ref<HTMLDivElement | null>(null)
  let radarChartInstance: echarts.ECharts | null = null
  const radarLoading = ref(false)
  const radarError = ref('')
  const radarDimensions = ref<QuizRadarDimension[]>([])
  const radarAnalysisMd = ref('')
  const radarChartError = ref('')
  const showRadarPanel = ref(false)

  /** 进入「可作答」阶段（running）起算，至最后一题提交止 */
  const quizWallClockStartMs = ref<number | null>(null)
  const unitSegmentStartMs = ref<number | null>(null)
  /** 当前题累计作答毫秒数（提交后会暂停并累计） */
  const currentUnitAccumulatedMs = ref(0)
  /** 全局累计作答毫秒数（提交后暂停，下一题继续） */
  const currentQuizAccumulatedMs = ref(0)
  const quizElapsedMs = ref(0)
  const unitTimings = ref<QuizUnitTimingRecord[]>([])
  const quizRunningDisplayMs = ref(0)
  let quizElapsedIntervalId: ReturnType<typeof setInterval> | null = null

  function clearQuizElapsedInterval() {
    if (quizElapsedIntervalId != null) {
      clearInterval(quizElapsedIntervalId)
      quizElapsedIntervalId = null
    }
  }

  /** 提交后暂停单题计时；点击下一题切题后再重新开始 */
  function pauseCurrentUnitTiming() {
    if (phase.value !== 'running' || unitSegmentStartMs.value == null) return
    currentUnitAccumulatedMs.value += Math.max(0, performance.now() - unitSegmentStartMs.value)
    unitSegmentStartMs.value = null
  }

  function pauseQuizTiming() {
    if (phase.value !== 'running' || quizWallClockStartMs.value == null) return
    currentQuizAccumulatedMs.value += Math.max(0, performance.now() - quizWallClockStartMs.value)
    quizWallClockStartMs.value = null
  }

  function pauseAllTiming() {
    pauseCurrentUnitTiming()
    pauseQuizTiming()
  }

  function resumeAllTiming() {
    if (phase.value !== 'running') return
    if (quizWallClockStartMs.value == null) quizWallClockStartMs.value = performance.now()
    if (unitSegmentStartMs.value == null) unitSegmentStartMs.value = performance.now()
  }

  function newQuizSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `qb-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  async function saveQuestionBankTestLog(
    payload: QuestionBankTestAnswerPayload,
    questionBankId?: number,
  ): Promise<boolean> {
    try {
      const roundedScore = Math.round(payload.score * 100) / 100
      const full: QuestionBankTestAnswerPayload = {
        ...payload,
        score: roundedScore,
        logMenuOrigin: resolvedLogMenuOrigin(),
      }
      await answerLogService.create({
        questionBankId,
        userName: getAnswerLogUserName(),
        answer: JSON.stringify(full),
        isCorrect: payload.maxScore > 0 && roundedScore >= payload.maxScore,
        createdAt: new Date().toISOString(),
        quizSessionId: payload.quizSessionId,
        learningTypeLabel: payload.learningTypeName,
      })
      return true
    } catch (e) {
      console.error(e)
      ElMessage.warning('答题记录未能保存到本地，请检查浏览器存储或权限。')
      return false
    }
  }

  async function collectWrongQuestion(input: {
    isWrong: boolean
    unit: TestUnit
    quizSessionId: string
  }) {
    if (!input.isWrong) return
    const ltId = Number(props.learningTypeId ?? 0)
    if (!Number.isInteger(ltId) || ltId <= 0) return
    const target = wrongTargetFromTestUnit(input.unit)
    if (!target) return
    const { unit } = input
    if (unit.kind === 'mindmap-mcq') {
      await upsertWrongQuestionFromAnswer({
        learningTypeId: ltId,
        target,
        questionType: 'mindmap-mcq',
        title: unit.stem,
        stem: unit.stem,
        quizSessionId: input.quizSessionId,
      })
      return
    }
    await upsertWrongQuestionFromAnswer({
      learningTypeId: ltId,
      target,
      questionType: unit.kind === 'general' ? 'general' : 'choice',
      title: unit.question.title,
      quizSessionId: input.quizSessionId,
    })
  }

  function wrongBookReviewTargetKey(ltId: number, target: WrongQuestionTarget): string {
    if (target.kind === 'question-bank') {
      return `qb:${ltId}:${target.questionBankId}`
    }
    if (target.kind === 'mindmap-log') {
      return `ml:${ltId}:${target.questionBankId}:${target.stem ?? ''}`
    }
    return `dm:${ltId}:${target.payload.parentQuestionBankId}:${target.payload.stem}:${target.payload.subIndex}:${target.payload.subTotal}`
  }

  /** 错题本测验中单题满分时，推进艾宾浩斯复习轮次（与打开详情「已复习」一致） */
  async function maybeMarkWrongBookReviewedOnFullScore(unit: TestUnit) {
    if (props.logMenuOrigin !== 'wrong-book') return
    const ltId = Number(props.learningTypeId ?? 0)
    if (!Number.isInteger(ltId) || ltId <= 0) return
    const target = wrongTargetFromTestUnit(unit)
    if (!target) return
    const key = wrongBookReviewTargetKey(ltId, target)
    if (wrongBookReviewedTargetKeys.value.has(key)) return
    const ok = await markWrongQuestionReviewedByTarget({ learningTypeId: ltId, target })
    if (ok) wrongBookReviewedTargetKeys.value.add(key)
  }

  /** 满分时累计「连续场次」；满 3 场自动移出错题本 */
  async function maybeGraduateWrongBookOnFullScore(unit: TestUnit) {
    const ltId = Number(props.learningTypeId ?? 0)
    if (!Number.isInteger(ltId) || ltId <= 0) return
    const target = wrongTargetFromTestUnit(unit)
    if (!target) return
    const res = await recordWrongBookFullScoreQuizPass({
      learningTypeId: ltId,
      target,
      quizSessionId: quizSessionId.value,
    })
    if (res === 'graduated') {
      ElMessage.success('该题已连续三场测验满分，已从错题本移除（可在回收站恢复）。')
    }
  }

  /** 避免同一会话重复写入归档/报告标记 */
  const sessionArchiveLoggedForQuizSessionId = ref<string | null>(null)
  const reportLogSavedForQuizSessionId = ref<string | null>(null)
  /** 避免 summary 阶段重复执行整库全对判定 */
  const perfectBankRewardCheckedForQuizSessionId = ref<string | null>(null)
  /** 避免 summary 阶段重复执行会话全对庆祝 */
  const sessionPerfectCelebrationCheckedForQuizSessionId = ref<string | null>(null)
  /** 错题本测验：同一场次内已对某题标记过「已复习」，避免重复推进轮次 */
  const wrongBookReviewedTargetKeys = ref(new Set<string>())

  watch(quizSessionId, () => {
    sessionArchiveLoggedForQuizSessionId.value = null
    reportLogSavedForQuizSessionId.value = null
    perfectBankRewardCheckedForQuizSessionId.value = null
    sessionPerfectCelebrationCheckedForQuizSessionId.value = null
    wrongBookReviewedTargetKeys.value = new Set()
  })

  function isAllGradedPerfect(): boolean {
    const graded = results.value.filter((r) => r.maxScore > 0)
    if (graded.length === 0) return false
    return graded.every((r) => {
      const max = Math.round(r.maxScore * 100) / 100
      const sc = Math.round(r.score * 100) / 100
      return sc >= max
    })
  }

  async function playPerfectCelebration(title: string, message: string) {
    const bgm = useBackgroundMusicStore()
    const resumeBgmAfterCelebration = bgm.isPlaying
    if (resumeBgmAfterCelebration) {
      await bgm.pausePlayback()
    }
    await startQbPerfectMidi()
    try {
      await ElMessageBox.alert(message, title, {
        confirmButtonText: '好的',
      })
    } finally {
      stopQbPerfectMidi()
      if (resumeBgmAfterCelebration) {
        await bgm.playCurrent()
      }
    }
  }

  async function persistQuizSessionArchiveIfNeeded() {
    const sid = quizSessionId.value
    if (!sid || phase.value !== 'summary') return
    if (sessionArchiveLoggedForQuizSessionId.value === sid) return
    const totalMax = results.value.reduce((s, r) => s + r.maxScore, 0)
    const ok = await saveQuestionBankTestLog(
      {
        source: 'question-bank-test',
        quizSessionId: sid,
        learningTypeName: props.learningTypeName,
        unitIndex: 0,
        questionTitle: '（测验归档）',
        questionType: 'session-summary',
        score: Math.round(totalScore.value * 100) / 100,
        maxScore: Math.round(totalMax * 100) / 100,
        resultDetail: `测验结束 · 共 ${results.value.length} 题`,
      },
      undefined,
    )
    if (ok) sessionArchiveLoggedForQuizSessionId.value = sid
  }

  async function persistQuizSessionReportIfNeeded() {
    const sid = quizSessionId.value
    if (!sid || phase.value !== 'summary') return
    if (reportLogSavedForQuizSessionId.value === sid) return
    const ok = await saveQuestionBankTestLog(
      {
        source: 'question-bank-test',
        quizSessionId: sid,
        learningTypeName: props.learningTypeName,
        unitIndex: 0,
        questionTitle: '（DeepSeek 测验报告）',
        questionType: 'session-report',
        score: 0,
        maxScore: 0,
        resultDetail: '已生成综合判定与六维雷达',
      },
      undefined,
    )
    if (ok) reportLogSavedForQuizSessionId.value = sid
  }

  const assistHtml = computed(() => {
    const md = assistMd.value.trim()
    if (!md) return ''
    const raw = marked.parse(md, { async: false })
    if (typeof raw !== 'string') return ''
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
  })

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

  /** 雷达容器与 radarLoading 互斥，须在 loading 结束、正文区域挂载后再 init。 */
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
      const totalMax = results.value.reduce((s, r) => s + r.maxScore, 0)
      const resultLines = results.value
        .map(
          (r) =>
            `${r.unitIndex}. [${r.typeLabel}] ${r.title} | ${r.score}/${r.maxScore} | ${r.detail}`,
        )
        .join('\n')
      const res = await rememberAiResponse(
        `quiz-radar:${hashForAiCache(
          [
            props.learningTypeName,
            String(totalScore.value),
            String(totalMax),
            resultLines,
            buildTimingAnalysisLinesForRadar(),
          ].join('\0'),
        )}`,
        () =>
          requestQuizRadarAnalysis({
            learningTypeName: props.learningTypeName,
            totalScore: Math.round(totalScore.value * 100) / 100,
            totalMax: Math.round(totalMax * 100) / 100,
            resultLines,
            timingAnalysisLines: buildTimingAnalysisLinesForRadar(),
          }),
      )
      radarDimensions.value = res.dimensions
      radarAnalysisMd.value = res.analysisMd
      await persistQuizSessionReportIfNeeded()
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

  watch(
    () => phase.value,
    (p) => {
      if (p !== 'summary') {
        sessionArchiveLoggedForQuizSessionId.value = null
        reportLogSavedForQuizSessionId.value = null
        disposeRadarChart()
        radarLoading.value = false
        radarError.value = ''
        radarDimensions.value = []
        radarAnalysisMd.value = ''
        radarChartError.value = ''
        showRadarPanel.value = false
      }
    },
  )

  async function applyFullBankPerfectRewardIfEligible() {
    const sid = quizSessionId.value
    if (!sid || phase.value !== 'summary') return
    if (perfectBankRewardCheckedForQuizSessionId.value === sid) return
    if (props.testScopeAll !== true) return
    const ltId = Number(props.learningTypeId ?? 0)
    if (!Number.isInteger(ltId) || ltId <= 0) return
    if (!isAllGradedPerfect()) return

    perfectBankRewardCheckedForQuizSessionId.value = sid
    sessionPerfectCelebrationCheckedForQuizSessionId.value = sid

    if (isLearningTypeQbPerfectCleared(ltId)) return

    const n = results.value.length
    const bonus = Math.ceil(n * 2.5)
    const cur = loadWenWuUserScores()
    saveWenWuUserScores({ ...cur, wenScore: cur.wenScore + bonus })
    markLearningTypeQbPerfectCleared(ltId)

    const label = props.learningTypeName.trim() || '该'
    await playPerfectCelebration('题库全对', `恭喜你，${label}题型题库全部答对！`)
  }

  async function applySessionPerfectCelebrationIfEligible() {
    const sid = quizSessionId.value
    if (!sid || phase.value !== 'summary') return
    if (sessionPerfectCelebrationCheckedForQuizSessionId.value === sid) return
    if (props.celebrateSessionPerfect !== true) return
    if (perfectBankRewardCheckedForQuizSessionId.value === sid) return
    if (!isAllGradedPerfect()) return

    sessionPerfectCelebrationCheckedForQuizSessionId.value = sid
    const label = props.learningTypeName.trim() || '本次'
    await playPerfectCelebration('答题全对', `恭喜你，${label}测验全部答对！`)
  }

  watch(
    () => phase.value,
    (p) => {
      if (p === 'summary') {
        void persistQuizSessionArchiveIfNeeded()
        void applyFullBankPerfectRewardIfEligible()
        void applySessionPerfectCelebrationIfEligible()
      }
    },
  )

  watch(
    () => phase.value,
    (p, prev) => {
      if (p === 'running' && prev !== 'running') {
        quizWallClockStartMs.value = performance.now()
        unitTimings.value = []
        currentUnitAccumulatedMs.value = 0
        currentQuizAccumulatedMs.value = 0
        unitSegmentStartMs.value = performance.now()
        quizRunningDisplayMs.value = 0
        quizElapsedMs.value = 0
        clearQuizElapsedInterval()
        const tickRunningClock = () => {
          const runningPart =
            quizWallClockStartMs.value == null ?
              0
            : Math.max(0, performance.now() - quizWallClockStartMs.value)
          quizRunningDisplayMs.value = Math.round(currentQuizAccumulatedMs.value + runningPart)
        }
        tickRunningClock()
        quizElapsedIntervalId = window.setInterval(tickRunningClock, 1000)
      } else if (p !== 'running') {
        clearQuizElapsedInterval()
      }

      if (p === 'summary' && prev === 'running') {
        const idx = currentIndex.value
        if (idx >= 0 && units.value[idx]) {
          flushUnitTimingSegment(idx)
        }
        pauseQuizTiming()
        quizElapsedMs.value = Math.round(currentQuizAccumulatedMs.value)
        quizRunningDisplayMs.value = quizElapsedMs.value
        quizWallClockStartMs.value = null
      }

      if (p === 'idle') {
        quizWallClockStartMs.value = null
        unitSegmentStartMs.value = null
        currentUnitAccumulatedMs.value = 0
        currentQuizAccumulatedMs.value = 0
        quizElapsedMs.value = 0
        quizRunningDisplayMs.value = 0
        unitTimings.value = []
        clearQuizElapsedInterval()
      }
    },
  )

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

  onMounted(() => {
    window.addEventListener('resize', resizeRadarChart)
  })

  onBeforeUnmount(() => {
    clearQuizElapsedInterval()
    window.removeEventListener('resize', resizeRadarChart)
    disposeRadarChart()
  })

  function maxScoreForUnit(unit: TestUnit): number {
    if (unit.kind === 'general') return unit.question.score ?? 0
    if (unit.kind === 'choice') return unit.question.score ?? 0
    return 2
  }

  function unitTitle(unit: TestUnit): string {
    if (unit.kind === 'mindmap-mcq') return unit.parent.title
    return unit.question.title
  }

  /** 测验结果表、日志与耗时摘要中展示的「题目名称」（导图小题为子题题干） */
  function unitDisplayTitle(unit: TestUnit): string {
    if (unit.kind === 'mindmap-mcq') {
      const s = unit.stem?.trim()
      if (s) return s
      return unit.parent.title
    }
    return unit.question.title
  }

  function unitTypeLabel(unit: TestUnit): string {
    if (unit.kind === 'mindmap-mcq') return '思维导图小题'
    const t = unit.question.type ?? 'general'
    return props.typeTextMap[t]
  }

  function flushUnitTimingSegment(unitIdx: number) {
    if (unitIdx < 0) return
    const u = units.value[unitIdx]
    if (!u) return
    const runningMs =
      unitSegmentStartMs.value == null ? 0 : Math.max(0, performance.now() - unitSegmentStartMs.value)
    const ms = currentUnitAccumulatedMs.value + runningMs
    const sec = Math.max(0, Math.round(ms / 1000))
    const rec: QuizUnitTimingRecord = {
      unitIndex: unitIdx + 1,
      kind: u.kind === 'general' ? 'general' : u.kind === 'choice' ? 'choice' : 'mindmap-mcq',
      title: unitDisplayTitle(u),
      secondsRounded: sec,
    }
    if (u.kind === 'general') {
      rec.generalPlainTextLen = htmlToPlainText(u.question.content ?? '').trim().length
    }
    unitTimings.value.push(rec)
    currentUnitAccumulatedMs.value = 0
    unitSegmentStartMs.value = null
  }

  function buildTimingAnalysisLinesForRadar(): string {
    const total = quizElapsedMs.value
    if (total <= 0 && unitTimings.value.length === 0) return ''
    const totalSec = Math.max(0, Math.round(total / 1000))
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    const header = `总用时（自进入可作答页至最后一题提交）：${
      mins > 0 ? `${mins} 分 ` : ''
    }${secs} 秒（合计约 ${totalSec} 秒）。`
    const nGen = unitTimings.value.filter((t) => t.kind === 'general').length
    const nMcq = unitTimings.value.length - nGen
    const sumChars = unitTimings.value.reduce((s, t) => s + (t.generalPlainTextLen ?? 0), 0)
    const meta =
      unitTimings.value.length > 0 ?
        `题型数量：一般题 ${nGen} 道；选择/导图小题 ${nMcq} 道。一般题题干累计纯文本约 ${sumChars} 字（用于评估阅读与作答负荷，非作答字数）。`
      : ''
    const lines = unitTimings.value.map((t) => {
      if (t.kind === 'general' && t.generalPlainTextLen != null) {
        const tier =
          t.generalPlainTextLen > 800 ?
            '篇幅较长'
          : t.generalPlainTextLen > 350 ? '篇幅中等' : '篇幅较短'
        return `第 ${t.unitIndex} 题 [一般题型] ${t.title}：约 ${t.secondsRounded} 秒；材料约 ${t.generalPlainTextLen} 字（${tier}）。评价效率时请结合篇幅加权，勿与客观小题直接对比单题秒数。`
      }
      if (t.kind === 'choice') {
        return `第 ${t.unitIndex} 题 [选择题型] ${t.title}：约 ${t.secondsRounded} 秒。`
      }
      return `第 ${t.unitIndex} 题 [思维导图小题] ${t.title}：约 ${t.secondsRounded} 秒。`
    })
    return [header, meta, ...lines].filter(Boolean).join('\n')
  }

  function formatQuizDurationMs(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000))
    const m = Math.floor(s / 60)
    const r = s % 60
    return m > 0 ? `${m} 分 ${r} 秒` : `${r} 秒`
  }

  const quizDurationSummaryText = computed(() => {
    const ms = quizElapsedMs.value
    if (ms <= 0) return ''
    return `测验总用时 ${formatQuizDurationMs(ms)}`
  })

  const quizRunningElapsedText = computed(() => {
    if (phase.value !== 'running' || quizWallClockStartMs.value == null) return ''
    return `作答计时 ${formatQuizDurationMs(quizRunningDisplayMs.value)}`
  })

  const currentUnit = computed(() => units.value[currentIndex.value] ?? null)

  const progressLabel = computed(() => {
    const n = units.value.length
    if (n === 0) return ''
    return `第 ${currentIndex.value + 1} / ${n} 题`
  })

  const runningTotalMax = computed(() =>
    units.value.reduce((s, u) => s + maxScoreForUnit(u), 0),
  )

  const currentOptions = computed(() => {
    const u = currentUnit.value
    if (!u || u.kind === 'general') return []
    return u.options
  })

  const currentMcqMode = computed(() => {
    const u = currentUnit.value
    if (!u || u.kind === 'general') return null
    return u.mode
  })

  function resetQuestionState() {
    answerHtml.value = ''
    generalSubmitted.value = false
    selfScore.value = 0
    selectedMulti.value = []
    selectedSingle.value = null
    mcqSubmitted.value = false
    assistMd.value = ''
    assistError.value = ''
  }

  function captureCurrentSnapshot(): UnitUiSnapshot | null {
    const u = units.value[currentIndex.value]
    if (!u) return null
    if (u.kind === 'general') {
      return {
        variant: 'general',
        answerHtml: answerHtml.value,
        selfScore: selfScore.value,
        generalSubmitted: generalSubmitted.value,
        assistMd: assistMd.value,
        assistError: assistError.value,
      }
    }
    return {
      variant: 'mcq',
      selectedSingle: selectedSingle.value,
      selectedMulti: [...selectedMulti.value],
      mcqSubmitted: mcqSubmitted.value,
      assistMd: assistMd.value,
      assistError: assistError.value,
    }
  }

  function applySnapshot(s: UnitUiSnapshot) {
    assistLoading.value = false
    if (s.variant === 'general') {
      answerHtml.value = s.answerHtml
      selfScore.value = s.selfScore
      generalSubmitted.value = s.generalSubmitted
      selectedMulti.value = []
      selectedSingle.value = null
      mcqSubmitted.value = false
      assistMd.value = s.assistMd
      assistError.value = s.assistError
      return
    }
    answerHtml.value = ''
    generalSubmitted.value = false
    selfScore.value = 0
    selectedSingle.value = s.selectedSingle
    selectedMulti.value = [...s.selectedMulti]
    mcqSubmitted.value = s.mcqSubmitted
    assistMd.value = s.assistMd
    assistError.value = s.assistError
  }

  function hydrateUnitState(idx: number) {
    if (phase.value !== 'running') return
    const done = resultSlots.value[idx]
    const completedSnap = completedUiSnapshots.value[idx]
    const draft = unitDrafts.value[idx]
    if (done != null && completedSnap != null) {
      applySnapshot(completedSnap)
      return
    }
    if (draft != null) {
      applySnapshot(draft)
      return
    }
    resetQuestionState()
  }

  function findNextUnansweredIndex(from: number): number | null {
    const n = units.value.length
    if (n === 0) return null
    for (let j = from + 1; j < n; j++) {
      if (resultSlots.value[j] == null) return j
    }
    for (let j = 0; j < n; j++) {
      if (resultSlots.value[j] == null) return j
    }
    return null
  }

  function setCurrentIndex(next: number) {
    if (next < 0 || next >= units.value.length) return
    if (phase.value !== 'running') {
      currentIndex.value = next
      return
    }
    const prev = currentIndex.value
    if (prev === next) return
    if (prev >= 0 && units.value[prev]) {
      if (resultSlots.value[prev] == null) {
        const snap = captureCurrentSnapshot()
        if (snap) unitDrafts.value.splice(prev, 1, snap)
      }
      flushUnitTimingSegment(prev)
      currentUnitAccumulatedMs.value = 0
    }
    currentIndex.value = next
    hydrateUnitState(next)
    resumeAllTiming()
  }

  function goToQuestion(idx: number) {
    if (phase.value !== 'running') return
    setCurrentIndex(idx)
  }

  async function fetchMindmapPrepared(q: QuestionBank): Promise<
    Array<{
      stem: string
      options: string[]
      correctIndices: number[]
      mode: 'single' | 'multiple'
    }>
  > {
    const mcqs = await fetchCachedMindmapDerivedMcqs(q)
    const prepared: Array<{
      stem: string
      options: string[]
      correctIndices: number[]
      mode: 'single' | 'multiple'
    }> = []
    for (const m of mcqs) {
      const options = shuffleArray([...m.correct, ...m.distractors])
      if (options.length !== 5) continue
      const norm = (s: string) => s.replace(/\s+/g, '')
      const setC = new Set(m.correct.map(norm))
      const correctIndices: number[] = []
      options.forEach((opt, idx) => {
        if (setC.has(norm(opt))) correctIndices.push(idx)
      })
      if (correctIndices.length !== m.correct.length) continue
      prepared.push({ stem: m.stem, options, correctIndices, mode: m.mode })
    }
    if (prepared.length === 0) {
      ElMessage.warning(`思维导图未生成有效小题：${q.title}`)
    }
    return prepared
  }

  async function appendMindmapUnits(q: QuestionBank, out: TestUnit[]): Promise<void> {
    try {
      const prepared = await fetchMindmapPrepared(q)
      const subTotal = prepared.length
      prepared.forEach((p, j) => {
        out.push({
          kind: 'mindmap-mcq',
          parent: q,
          stem: p.stem,
          options: p.options,
          correctIndices: p.correctIndices,
          mode: p.mode,
          subIndex: j + 1,
          subTotal,
        })
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求失败'
      ElMessage.error(`${msg}（${q.title}）`)
    }
  }

  async function appendChoiceUnit(q: QuestionBank, out: TestUnit[]): Promise<void> {
    const v = validateChoiceQuestionJson(q.content ?? '')
    if (!v.ok) {
      ElMessage.warning(`已跳过无效选择题：${q.title}`)
      return
    }
    const payload = parseChoiceQuestionContent(q.content ?? '')
    const correct = payload.correctAnswers.map((s) => s.trim()).filter(Boolean)
    const need = 5 - correct.length
    if (need < 0) {
      ElMessage.warning(`已跳过（正确项多于 5 条）：${q.title}`)
      return
    }
    try {
      const distractors = await fetchCachedChoiceDistractors(q, correct, need)
      const merged = [...correct, ...distractors.slice(0, need)]
      const options = shuffleArray(merged)
      while (options.length < 5) {
        options.push('（选项占位）')
      }
      const finalOpts = options.slice(0, 5)
      const norm = (s: string) => s.replace(/\s+/g, '')
      const setC = new Set(correct.map(norm))
      const correctIndices: number[] = []
      finalOpts.forEach((opt, idx) => {
        if (setC.has(norm(opt))) correctIndices.push(idx)
      })
      if (correctIndices.length !== correct.length) {
        ElMessage.warning(`选择题选项对齐失败，已跳过：${q.title}`)
        return
      }
      out.push({
        kind: 'choice',
        question: q,
        options: finalOpts,
        correctIndices,
        mode: payload.mode,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求失败'
      ElMessage.error(`${msg}（${q.title}）`)
    }
  }

  async function buildTestUnitsLegacy(source: QuestionBank[]): Promise<TestUnit[]> {
    const shuffled = shuffleArray(source)
    const out: TestUnit[] = []
    let i = 0
    for (const q of shuffled) {
      i++
      buildStatus.value = `正在准备第 ${i}/${shuffled.length} 道源题目…`
      const t = q.type ?? 'general'
      if (t === 'general') {
        out.push({ kind: 'general', question: q })
        continue
      }
      if (t === 'choice') {
        await appendChoiceUnit(q, out)
        continue
      }
      if (t === 'mindmap') {
        await appendMindmapUnits(q, out)
      }
    }
    return out
  }

  async function buildTestUnitsWithConfig(
    source: QuestionBank[],
    config: QuestionBankTestBuildConfig,
  ): Promise<TestUnit[]> {
    const limit = Math.max(0, Math.floor(config.questionCount))
    if (limit === 0) return []

  type MindmapPrepared = {
      stem: string
      options: string[]
      correctIndices: number[]
      mode: 'single' | 'multiple'
    }

    type LeafBuildState = {
      leafId: number
      sources: QuestionBank[]
      sourceIndex: number
      mindmapPrepared: Map<number, MindmapPrepared[]>
      mindmapNextIndex: Map<number, number>
    }

    const out: TestUnit[] = []
    const byLeaf = groupQuestionsByLearningType(source, config.learningTypeIds)

    const leafStates: LeafBuildState[] = config.learningTypeIds
      .map((leafId) => {
        const items = (byLeaf.get(leafId) ?? []).filter((q) => {
          const t = q.type ?? 'general'
          if (t === 'general') return config.includeGeneral
          if (t === 'choice' || t === 'mindmap') return config.includeChoiceLike
          return false
        })
        return {
          leafId,
          sources: shuffleArray(items),
          sourceIndex: 0,
          mindmapPrepared: new Map<number, MindmapPrepared[]>(),
          mindmapNextIndex: new Map<number, number>(),
        }
      })
      .filter((s) => s.sources.length > 0)

    const leafHasPending = (state: LeafBuildState): boolean => {
      for (let i = state.sourceIndex; i < state.sources.length; i++) {
        const q = state.sources[i]!
        const t = q.type ?? 'general'
        if (t === 'choice' || t === 'general') return true
        if (t === 'mindmap' && q.id != null) {
          const prepared = state.mindmapPrepared.get(q.id)
          if (!prepared) return true
          if ((state.mindmapNextIndex.get(q.id) ?? 0) < prepared.length) return true
        }
      }
      return false
    }

    const appendOneUnitFromLeaf = async (state: LeafBuildState): Promise<boolean> => {
      if (out.length >= limit) return false
      while (state.sourceIndex < state.sources.length) {
        const q = state.sources[state.sourceIndex]!
        const t = q.type ?? 'general'

        if (t === 'general') {
          state.sourceIndex++
          out.push({ kind: 'general', question: q })
          return true
        }

        if (t === 'choice') {
          state.sourceIndex++
          const before = out.length
          await appendChoiceUnit(q, out)
          return out.length > before
        }

        if (t === 'mindmap' && q.id != null) {
          if (!state.mindmapPrepared.has(q.id)) {
            buildStatus.value = `正在从「${q.title}」思维导图生成测验题…`
            try {
              state.mindmapPrepared.set(q.id, await fetchMindmapPrepared(q))
              state.mindmapNextIndex.set(q.id, 0)
            } catch (e) {
              const msg = e instanceof Error ? e.message : '请求失败'
              ElMessage.error(`${msg}（${q.title}）`)
              state.mindmapPrepared.set(q.id, [])
              state.mindmapNextIndex.set(q.id, 0)
            }
          }
          const prepared = state.mindmapPrepared.get(q.id) ?? []
          const idx = state.mindmapNextIndex.get(q.id) ?? 0
          if (idx < prepared.length) {
            const p = prepared[idx]!
            state.mindmapNextIndex.set(q.id, idx + 1)
            if (idx + 1 >= prepared.length) state.sourceIndex++
            const subTotal = prepared.length
            out.push({
              kind: 'mindmap-mcq',
              parent: q,
              stem: p.stem,
              options: p.options,
              correctIndices: p.correctIndices,
              mode: p.mode,
              subIndex: idx + 1,
              subTotal,
            })
            return true
          }
          state.sourceIndex++
          continue
        }

        state.sourceIndex++
      }
      return false
    }

    for (const state of leafStates) {
      if (out.length >= limit) break
      await appendOneUnitFromLeaf(state)
    }

    let round = 0
    while (out.length < limit && leafStates.some((s) => leafHasPending(s))) {
      const state = leafStates[round % leafStates.length]!
      await appendOneUnitFromLeaf(state)
      round++
      if (round > limit * leafStates.length * 8) break
    }

    return out
  }

  async function buildTestUnits(
    source: QuestionBank[],
    config?: QuestionBankTestBuildConfig,
  ): Promise<TestUnit[]> {
    if (!config) return buildTestUnitsLegacy(source)
    return buildTestUnitsWithConfig(source, config)
  }

  let buildSeq = 0
  watch(
    () =>
      [
        props.loading,
        props.questions.map((q) => q.id).join(','),
        props.questions.length,
        props.testBuildConfig?.learningTypeIds.join(','),
        props.testBuildConfig?.questionCount,
        props.testBuildConfig?.includeChoiceLike,
        props.testBuildConfig?.includeGeneral,
        (props.presetUnits ?? []).length,
      ] as const,
    async ([loading]) => {
      if (loading) return
      const preset = props.presetUnits ?? []
      if (props.questions.length === 0 && preset.length === 0) {
        phase.value = 'idle'
        units.value = []
        return
      }
      if (phase.value !== 'idle') return
      const seq = ++buildSeq
      phase.value = 'building'
      buildStatus.value = '正在打乱题目并生成测验…'
      try {
        const built = await buildTestUnits(props.questions, props.testBuildConfig)
        if (seq !== buildSeq) return
        const merged = shuffleArray([...built, ...preset])
        if (merged.length === 0) {
          ElMessage.warning('没有可用的测验小题，请检查题目类型与网络。')
          phase.value = 'idle'
          return
        }
        units.value = merged
        const len = merged.length
        resultSlots.value = Array.from({ length: len }, () => null)
        unitDrafts.value = Array.from({ length: len }, () => null)
        completedUiSnapshots.value = Array.from({ length: len }, () => null)
        currentIndex.value = 0
        quizSessionId.value = newQuizSessionId()
        phase.value = 'running'
        resetQuestionState()
        await nextTick()
        hydrateUnitState(0)
      } catch (e) {
        if (seq !== buildSeq) return
        const msg = e instanceof Error ? e.message : '生成失败'
        ElMessage.error(msg)
        phase.value = 'idle'
      }
    },
    { immediate: true },
  )

  const onInjectAnswer = (html: string) => {
    answerHtml.value = html
  }

  function submitGeneral() {
    const u = currentUnit.value
    if (!u || u.kind !== 'general') return
    pauseAllTiming()
    generalSubmitted.value = true
    selfScore.value = 0
  }

  async function nextAfterGeneral() {
    const u = currentUnit.value
    if (!u || u.kind !== 'general') return
    const maxS = maxScoreForUnit(u)
    let s = Number(selfScore.value)
    if (!Number.isFinite(s)) s = 0
    s = Math.max(0, Math.min(maxS, Math.round(s)))
    const ok = await saveQuestionBankTestLog(
      {
        source: 'question-bank-test',
        quizSessionId: quizSessionId.value,
        learningTypeName: props.learningTypeName,
        unitIndex: currentIndex.value + 1,
        questionTitle: u.question.title,
        questionType: 'general',
        score: s,
        maxScore: maxS,
        resultDetail: '一般题型 · 自评得分',
        userAnswerPlain: htmlToPlainText(answerHtml.value),
      },
      u.question.id,
    )
    if (!ok) return
    await collectWrongQuestion({
      isWrong: s < maxS,
      unit: u,
      quizSessionId: quizSessionId.value,
    })
    if (s >= maxS) {
      await maybeMarkWrongBookReviewedOnFullScore(u)
      await maybeGraduateWrongBookOnFullScore(u)
    }

    const i = currentIndex.value
    const row: ResultRow = {
      unitIndex: i + 1,
      title: unitTitle(u),
      detail: '一般题型 · 自评得分',
      typeLabel: unitTypeLabel(u),
      score: s,
      maxScore: maxS,
    }
    resultSlots.value.splice(i, 1, row)
    const doneSnap = captureCurrentSnapshot()
    if (doneSnap) completedUiSnapshots.value.splice(i, 1, doneSnap)
    unitDrafts.value.splice(i, 1, null)

    const nextIdx = findNextUnansweredIndex(i)
    if (nextIdx === null) {
      phase.value = 'summary'
      return
    }
    setCurrentIndex(nextIdx)
  }

  function selectedForMcq(): number[] {
    const mode = currentMcqMode.value
    if (mode === 'single') {
      if (selectedSingle.value === null) return []
      return [selectedSingle.value]
    }
    return [...selectedMulti.value]
  }

  async function runMcqAssist() {
    const u = currentUnit.value
    if (!u || u.kind === 'general' || mcqSubmitted.value) return
    assistError.value = ''
    assistLoading.value = true
    assistMd.value = ''
    try {
      const title = unitTitle(u)
      const stem = u.kind === 'mindmap-mcq' ? u.stem : undefined
      assistMd.value = await rememberAiResponse(
        `mcq-assist:${hashForAiCache([title, stem ?? '', ...u.options].join('\0'))}`,
        () =>
          requestChoiceTestAssist({
            title,
            stem,
            options: u.options,
          }),
      )
    } catch (e) {
      assistError.value = e instanceof Error ? e.message : '请求失败'
      ElMessage.error(assistError.value)
    } finally {
      assistLoading.value = false
    }
  }

  function submitMcq() {
    const u = currentUnit.value
    if (!u || u.kind === 'general') return
    pauseAllTiming()
    mcqSubmitted.value = true
  }

  async function nextAfterMcq() {
    const u = currentUnit.value
    if (!u || u.kind === 'general') return
    const maxS = maxScoreForUnit(u)
    const gained = scoreMcqSelection(u.correctIndices, selectedForMcq(), maxS)
    const modeLabel = u.mode === 'single' ? '单选' : '多选'
    const gainedRounded = Math.round(gained * 100) / 100
    const detail =
      u.kind === 'mindmap-mcq'
        ? `导图小题 ${u.subIndex}/${u.subTotal} · ${modeLabel}`
        : `${modeLabel} · 自动判分`
    const correctLabs = u.correctIndices
      .slice()
      .sort((a, b) => a - b)
      .map((i) => u.options[i])
      .filter(Boolean)
    const userLabs = selectedForMcq()
      .map((i) => u.options[i])
      .filter(Boolean)
    const ok = await saveQuestionBankTestLog(
      {
        source: 'question-bank-test',
        quizSessionId: quizSessionId.value,
        learningTypeName: props.learningTypeName,
        unitIndex: currentIndex.value + 1,
        questionTitle: unitDisplayTitle(u),
        questionType: u.kind === 'mindmap-mcq' ? 'mindmap-mcq' : 'choice',
        score: gainedRounded,
        maxScore: maxS,
        resultDetail: detail,
        userChoiceLabels: userLabs,
        correctChoiceLabels: correctLabs,
        mindmapStem: u.kind === 'mindmap-mcq' ? u.stem : undefined,
      },
      u.kind === 'mindmap-mcq' ? u.parent.id : u.question.id,
    )
    if (!ok) return
    await collectWrongQuestion({
      isWrong: gainedRounded < maxS,
      unit: u,
      quizSessionId: quizSessionId.value,
    })
    if (gainedRounded >= maxS) {
      await maybeMarkWrongBookReviewedOnFullScore(u)
      await maybeGraduateWrongBookOnFullScore(u)
    }

    const i = currentIndex.value
    const row: ResultRow = {
      unitIndex: i + 1,
      title: unitDisplayTitle(u),
      detail,
      typeLabel: unitTypeLabel(u),
      score: gainedRounded,
      maxScore: maxS,
    }
    resultSlots.value.splice(i, 1, row)
    const doneSnap = captureCurrentSnapshot()
    if (doneSnap) completedUiSnapshots.value.splice(i, 1, doneSnap)
    unitDrafts.value.splice(i, 1, null)

    const nextIdx = findNextUnansweredIndex(i)
    if (nextIdx === null) {
      phase.value = 'summary'
      return
    }
    setCurrentIndex(nextIdx)
  }

  function restartIdle() {
    phase.value = 'idle'
    units.value = []
    currentIndex.value = 0
    resultSlots.value = []
    unitDrafts.value = []
    completedUiSnapshots.value = []
    quizSessionId.value = ''
    buildStatus.value = ''
    quizWallClockStartMs.value = null
    unitSegmentStartMs.value = null
    currentUnitAccumulatedMs.value = 0
    currentQuizAccumulatedMs.value = 0
    quizElapsedMs.value = 0
    quizRunningDisplayMs.value = 0
    unitTimings.value = []
    clearQuizElapsedInterval()
    resetQuestionState()
  }

  function backToBank() {
    restartIdle()
    emit('back')
  }

  const analysisForCurrent = computed(() => {
    const u = currentUnit.value
    if (!u || u.kind === 'general') return ''
    if (u.kind === 'choice') return u.question.analysis ?? ''
    return u.parent.analysis ?? ''
  })

  const correctLabels = computed(() => {
    const u = currentUnit.value
    if (!u || u.kind === 'general' || !mcqSubmitted.value) return []
    return u.correctIndices
      .slice()
      .sort((a, b) => a - b)
      .map((i) => u.options[i])
      .filter(Boolean)
  })

  const generalMistakeAware = computed(() => {
    const u = currentUnit.value
    if (!u || u.kind !== 'general' || !generalSubmitted.value) return false
    return selfScore.value < maxScoreForUnit(u)
  })

  const mcqCurrentGained = computed(() => {
    const u = currentUnit.value
    if (!u || u.kind === 'general' || !mcqSubmitted.value) return 0
    return scoreMcqSelection(u.correctIndices, selectedForMcq(), maxScoreForUnit(u))
  })

  const mcqMistakeAware = computed(() => {
    const u = currentUnit.value
    if (!u || u.kind === 'general' || !mcqSubmitted.value) return false
    return mcqCurrentGained.value < maxScoreForUnit(u)
  })

  const mcqUserSelectedLabels = computed(() => {
    const u = currentUnit.value
    if (!u || u.kind === 'general' || !mcqSubmitted.value) return []
    return selectedForMcq()
      .map((i) => u.options[i])
      .filter(Boolean)
  })

  /** 左侧列表：提交后即视为已作答（不必等「下一题」）；得分与结果槽位或当前/草稿作答一致 */
  function getNavigatorEntryState(i: number): { done: boolean; statusLine: string } {
    const u = units.value[i]
    if (!u) return { done: false, statusLine: '未作答' }

    const row = resultSlots.value[i]
    if (row) {
      const sc = Math.round(row.score * 100) / 100
      const mx = Math.round(row.maxScore * 100) / 100
      return { done: true, statusLine: `已作答 · ${sc} / ${mx} 分` }
    }

    const maxS = maxScoreForUnit(u)
    const mxRounded = Math.round(maxS * 100) / 100

    if (i === currentIndex.value) {
      if (u.kind === 'general' && generalSubmitted.value) {
        let s = Number(selfScore.value)
        if (!Number.isFinite(s)) s = 0
        s = Math.max(0, Math.min(maxS, Math.round(s)))
        return { done: true, statusLine: `已作答 · ${s} / ${mxRounded} 分` }
      }
      if (u.kind !== 'general' && mcqSubmitted.value) {
        const gained = scoreMcqSelection(u.correctIndices, selectedForMcq(), maxS)
        const gr = Math.round(gained * 100) / 100
        return { done: true, statusLine: `已作答 · ${gr} / ${mxRounded} 分` }
      }
      return { done: false, statusLine: '未作答' }
    }

    const d = unitDrafts.value[i]
    if (d?.variant === 'general' && d.generalSubmitted && u.kind === 'general') {
      let s = Number(d.selfScore)
      if (!Number.isFinite(s)) s = 0
      s = Math.max(0, Math.min(maxS, Math.round(s)))
      return { done: true, statusLine: `已作答 · ${s} / ${mxRounded} 分` }
    }
    if (d?.variant === 'mcq' && d.mcqSubmitted && u.kind !== 'general') {
      const idxs =
        u.mode === 'single' ?
          d.selectedSingle === null ? [] : [d.selectedSingle]
        : [...d.selectedMulti]
      const gained = scoreMcqSelection(u.correctIndices, idxs, maxS)
      const gr = Math.round(gained * 100) / 100
      return { done: true, statusLine: `已作答 · ${gr} / ${mxRounded} 分` }
    }

    return { done: false, statusLine: '未作答' }
  }

  const quizNavigatorItems = computed(() =>
    units.value.map((u, i) => {
      const typeLabel = unitTypeLabel(u)
      const title = unitTitle(u)
      const { done, statusLine } = getNavigatorEntryState(i)
      return {
        unitIndex: i,
        displayNo: i + 1,
        title,
        typeLabel,
        subline:
          u.kind === 'mindmap-mcq' ?
            `导图小题 ${u.subIndex}/${u.subTotal} · ${u.stem.length > 56 ? `${u.stem.slice(0, 56)}…` : u.stem}`
          : '',
        done,
        statusLine,
        isCurrent: i === currentIndex.value,
      }
    }),
  )

  const questionsAnsweredCount = computed(() => {
    const n = units.value.length
    let c = 0
    for (let i = 0; i < n; i++) {
      if (getNavigatorEntryState(i).done) c++
    }
    return c
  })

  const bindRadarChartEl = (el: Element | ComponentPublicInstance | null) => {
    radarChartRef.value = el instanceof HTMLElement ? (el as HTMLDivElement) : null
  }

  const state = reactive({
    bindRadarChartEl,
    phase,
    buildStatus,
    units,
    currentIndex,
    totalScore,
    results,
    quizNavigatorItems,
    questionsAnsweredCount,
    goToQuestion,
    answerHtml,
    generalSubmitted,
    selfScore,
    selectedMulti,
    selectedSingle,
    mcqSubmitted,
    assistLoading,
    assistMd,
    assistError,
    assistHtml,
    radarLoading,
    radarError,
    radarDimensions,
    radarAnalysisMd,
    radarAnalysisHtml,
    radarChartError,
    showRadarPanel,
    currentUnit,
    progressLabel,
    runningTotalMax,
    currentOptions,
    currentMcqMode,
    analysisForCurrent,
    correctLabels,
    generalMistakeAware,
    mcqMistakeAware,
    mcqUserSelectedLabels,
    maxScoreForUnit,
    onInjectAnswer,
    submitGeneral,
    nextAfterGeneral,
    runMcqAssist,
    submitMcq,
    nextAfterMcq,
    backToBank,
    openRadarPanel,
    retryRadarAnalysis,
    retryRadarChartRender,
    selectedForMcq,
    quizDurationSummaryText,
    quizRunningElapsedText,
  })

  return { state }
}
