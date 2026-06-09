<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  clampMentalMathScore,
  generateMentalMathQuestion,
  getMentalMathModeConfig,
  MENTAL_MATH_TIME_CORRECT_BONUS_SEC,
  MENTAL_MATH_TIME_WRONG_PENALTY_SEC,
  MENTAL_MATH_ARITHMETIC_MODES,
  MENTAL_MATH_POWER_MODES,
  type MentalMathAnswerRecord,
  type MentalMathMode,
  type MentalMathQuestion,
} from '@/utils/mentalMathPractice'
import {
  playMentalMathCorrectSound,
  playMentalMathStartSound,
  playMentalMathWrongSound,
} from '@/utils/mentalMathSounds'

type Phase = 'select' | 'countdown' | 'playing' | 'finished'
type CountdownStep = 3 | 2 | 1 | 'GO'

const COUNTDOWN_STEPS: CountdownStep[] = [3, 2, 1, 'GO']

const phase = ref<Phase>('select')
const activeMode = ref<MentalMathMode | null>(null)
const score = ref(0)
const question = ref<MentalMathQuestion | null>(null)
const questionSeq = ref(0)
const records = ref<MentalMathAnswerRecord[]>([])
const remainingMs = ref(0)
const totalMs = ref(0)
const feedback = ref<'correct' | 'wrong' | null>(null)
const acceptingInput = ref(true)
const countdownValue = ref<CountdownStep | null>(null)

let timerHandle: ReturnType<typeof setInterval> | null = null
let feedbackTimer: ReturnType<typeof setTimeout> | null = null
let countdownTimer: ReturnType<typeof setTimeout> | null = null
let sessionStartMs = 0

const modeConfig = computed(() =>
  activeMode.value ? getMentalMathModeConfig(activeMode.value) : null,
)

const progressPercent = computed(() => {
  if (totalMs.value <= 0) return 0
  return Math.max(0, Math.min(100, (remainingMs.value / totalMs.value) * 100))
})

const correctCount = computed(() => records.value.filter((r) => r.correct).length)
const wrongCount = computed(() => records.value.filter((r) => !r.correct).length)

function clearTimers() {
  if (timerHandle) {
    clearInterval(timerHandle)
    timerHandle = null
  }
  if (feedbackTimer) {
    clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
  if (countdownTimer) {
    clearTimeout(countdownTimer)
    countdownTimer = null
  }
}

function nextQuestion() {
  if (!activeMode.value || !modeConfig.value) return
  questionSeq.value += 1
  question.value = generateMentalMathQuestion(
    activeMode.value,
    questionSeq.value,
    modeConfig.value.optionCount,
  )
  feedback.value = null
  acceptingInput.value = true
}

function finishSession() {
  clearTimers()
  acceptingInput.value = false
  phase.value = 'finished'
}

function syncRemainingFromSession() {
  remainingMs.value = Math.max(0, totalMs.value - (Date.now() - sessionStartMs))
}

function applyTimeDeltaForAnswer(ok: boolean) {
  const deltaMs = ok
    ? MENTAL_MATH_TIME_CORRECT_BONUS_SEC * 1000
    : -MENTAL_MATH_TIME_WRONG_PENALTY_SEC * 1000
  sessionStartMs += deltaMs
  syncRemainingFromSession()
}

function beginPlaying(mode: MentalMathMode) {
  clearTimers()
  countdownValue.value = null
  activeMode.value = mode
  const cfg = getMentalMathModeConfig(mode)
  score.value = 0
  records.value = []
  questionSeq.value = 0
  totalMs.value = cfg.durationSec * 1000
  remainingMs.value = totalMs.value
  sessionStartMs = Date.now()
  phase.value = 'playing'
  nextQuestion()

  timerHandle = setInterval(() => {
    remainingMs.value = Math.max(0, totalMs.value - (Date.now() - sessionStartMs))
    if (remainingMs.value <= 0) {
      finishSession()
    }
  }, 50)
}

function runCountdownStep(stepIndex: number, mode: MentalMathMode) {
  if (stepIndex >= COUNTDOWN_STEPS.length) {
    beginPlaying(mode)
    return
  }

  const step = COUNTDOWN_STEPS[stepIndex]
  countdownValue.value = step
  if (step === 'GO') {
    playMentalMathStartSound()
  }

  const delayMs = step === 'GO' ? 700 : 1000
  countdownTimer = setTimeout(() => {
    runCountdownStep(stepIndex + 1, mode)
  }, delayMs)
}

function startMode(mode: MentalMathMode) {
  clearTimers()
  activeMode.value = mode
  phase.value = 'countdown'
  countdownValue.value = COUNTDOWN_STEPS[0]
  runCountdownStep(0, mode)
}

function applyAnswer(choiceIndex: number) {
  if (phase.value !== 'playing' || !acceptingInput.value || !question.value || !modeConfig.value) {
    return
  }
  acceptingInput.value = false
  const q = question.value
  const cfg = modeConfig.value
  const chosenAnswer = q.options[choiceIndex] ?? q.correctAnswer
  const ok = choiceIndex === q.correctIndex
  const elapsedMs = Date.now() - sessionStartMs
  score.value = clampMentalMathScore(score.value + (ok ? cfg.correctDelta : cfg.wrongDelta))
  applyTimeDeltaForAnswer(ok)

  records.value.push({
    questionId: q.id,
    expression: q.expression,
    correctAnswer: q.correctAnswer,
    chosenAnswer,
    chosenIndex: choiceIndex,
    correct: ok,
    scoreAfter: score.value,
    elapsedMs,
  })

  feedback.value = ok ? 'correct' : 'wrong'
  if (ok) playMentalMathCorrectSound()
  else playMentalMathWrongSound()

  if (remainingMs.value <= 0) {
    finishSession()
    return
  }

  feedbackTimer = setTimeout(() => {
    if (phase.value === 'playing' && remainingMs.value > 0) {
      nextQuestion()
    }
  }, 380)
}

function onKeydown(e: KeyboardEvent) {
  if (phase.value !== 'playing' || !acceptingInput.value || !modeConfig.value) return
  const key = e.key
  const idx = Number(key) - 1
  if (!Number.isFinite(idx) || idx < 0 || idx >= modeConfig.value.optionCount) return
  e.preventDefault()
  applyAnswer(idx)
}

function backToSelect() {
  clearTimers()
  phase.value = 'select'
  activeMode.value = null
  question.value = null
  feedback.value = null
  countdownValue.value = null
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimers()
})
</script>

<template>
  <section class="mental-math-page">
    <header class="page-hero">
      <span class="page-kicker">工具 04</span>
      <h2 class="page-title">口算练习</h2>
      <p class="page-subtitle">
        限时口算，结果仅在本页展示、不写入本地。按数字键 <strong>1～3</strong> 或
        <strong>1～4</strong> 选择对应选项；答对 <strong>+1 秒</strong>，答错
        <strong>-1 秒</strong>，答完自动进入下一题。
      </p>
    </header>

    <div v-if="phase === 'select'" class="mode-select">
      <section class="mode-section">
        <h3 class="mode-section__title">四则口算</h3>
        <div class="mode-grid">
          <button
            v-for="m in MENTAL_MATH_ARITHMETIC_MODES"
            :key="m.id"
            type="button"
            class="mode-card"
            @click="startMode(m.id)"
          >
            <h3 class="mode-card__title">{{ m.label }}</h3>
            <p class="mode-card__desc">{{ m.desc }}</p>
            <span class="mode-card__cta">开始练习</span>
          </button>
        </div>
      </section>

      <section class="mode-section">
        <h3 class="mode-section__title">2 的 n 次幂</h3>
        <p class="mode-section__hint">
          题目形如 2ⁿ（简单含 2⁻¹～2⁻³，复杂含 2⁻¹～2⁻⁵），选项均为 2 的次幂，干扰项为相邻次幂。
        </p>
        <div class="mode-grid">
          <button
            v-for="m in MENTAL_MATH_POWER_MODES"
            :key="m.id"
            type="button"
            class="mode-card mode-card--power"
            @click="startMode(m.id)"
          >
            <h3 class="mode-card__title">{{ m.label }}</h3>
            <p class="mode-card__desc">{{ m.desc }}</p>
            <span class="mode-card__cta">开始练习</span>
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="phase === 'countdown' && modeConfig && countdownValue" class="countdown-panel">
      <p class="countdown-mode">{{ modeConfig.label }}</p>
      <p
        class="countdown-value"
        :class="{ 'countdown-value--go': countdownValue === 'GO' }"
      >
        {{ countdownValue }}
      </p>
      <p class="countdown-hint">准备好，马上开始计时</p>
    </div>

    <div v-else-if="phase === 'playing' && question && modeConfig" class="play-panel">
      <div class="play-top">
        <div class="play-meta">
          <span class="play-mode">{{ modeConfig.label }}</span>
          <span class="play-score">得分 <strong>{{ score }}</strong> / {{ modeConfig.maxScore }}</span>
        </div>
        <div class="time-bar" aria-label="剩余时间">
          <div class="time-bar__fill" :style="{ width: `${progressPercent}%` }" />
        </div>
        <div class="time-bar__label">{{ (remainingMs / 1000).toFixed(1) }} 秒</div>
      </div>

      <div class="question-block">
        <p
          class="question-expression"
          :class="{
            'question-expression--ok': feedback === 'correct',
            'question-expression--bad': feedback === 'wrong',
          }"
        >
          {{ question.expression }}
        </p>
        <p v-if="feedback === 'correct'" class="feedback feedback--ok">答对了！</p>
        <p v-else-if="feedback === 'wrong'" class="feedback feedback--bad">答错了</p>
      </div>

      <ul class="option-list">
        <li v-for="(opt, idx) in question.options" :key="idx">
          <button
            type="button"
            class="option-btn"
            :disabled="!acceptingInput"
            @click="applyAnswer(idx)"
          >
            <span class="option-btn__key">{{ idx + 1 }}</span>
            <span class="option-btn__val">{{ opt }}</span>
          </button>
        </li>
      </ul>

      <p class="hint">键盘按 <kbd>1</kbd>～<kbd>{{ modeConfig.optionCount }}</kbd> 快速作答</p>
    </div>

    <div v-else-if="phase === 'finished' && modeConfig" class="result-panel">
      <h3 class="result-title">时间到</h3>
      <p class="result-score">
        最终得分：<strong>{{ score }}</strong> / {{ modeConfig.maxScore }}
      </p>
      <p class="result-stats">
        共 {{ records.length }} 题 · 答对 {{ correctCount }} · 答错 {{ wrongCount }}
      </p>

      <div v-if="records.length" class="result-log">
        <h4>本题记录</h4>
        <ul>
          <li v-for="(r, i) in records" :key="i" :class="r.correct ? 'log-ok' : 'log-bad'">
            <span class="log-idx">{{ i + 1 }}.</span>
            <span class="log-expr">{{ r.expression }}</span>
            <span class="log-detail">
              选 {{ r.chosenAnswer }}（正确 {{ r.correctAnswer }}）· {{ r.correct ? '对' : '错' }}
            </span>
          </li>
        </ul>
      </div>

      <div class="result-actions">
        <el-button type="primary" @click="startMode(modeConfig.id)">再来一局</el-button>
        <el-button @click="backToSelect">换模式</el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mental-math-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 8px 4px 32px;
}

.page-hero {
  margin-bottom: 24px;
}

.page-kicker {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 6px;
}

.page-title {
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 700;
}

.page-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--app-text-muted);
}

.mode-select {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.mode-section__title {
  margin: 0 0 12px;
  font-size: 1rem;
  font-weight: 700;
}

.mode-section__hint {
  margin: -4px 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.mode-grid {
  display: grid;
  gap: 14px;
}

.mode-card--power {
  border-color: color-mix(in srgb, var(--el-color-success) 25%, var(--app-border-soft));
}

.mode-card--power:hover {
  border-color: color-mix(in srgb, var(--el-color-success) 45%, var(--app-border-soft));
  box-shadow: 0 4px 16px rgba(34, 197, 94, 0.08);
}

.mode-card {
  display: block;
  width: 100%;
  text-align: left;
  padding: 18px 20px;
  border: 1px solid var(--app-border-soft);
  border-radius: 14px;
  background: var(--app-surface);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.mode-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.08);
}

.mode-card__title {
  margin: 0 0 8px;
  font-size: 1.1rem;
  font-weight: 700;
}

.mode-card__desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--app-text-muted);
}

.mode-card__cta {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.countdown-panel {
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  padding: 48px 22px 56px;
  background: var(--app-surface);
  text-align: center;
}

.countdown-mode {
  margin: 0 0 20px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.countdown-value {
  margin: 0;
  font-size: clamp(4rem, 18vw, 6rem);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--el-color-primary);
  animation: countdown-pop 0.35s ease-out;
}

.countdown-value--go {
  font-size: clamp(3rem, 14vw, 4.5rem);
  color: var(--el-color-success);
}

.countdown-hint {
  margin: 24px 0 0;
  font-size: 14px;
  color: var(--app-text-muted);
}

@keyframes countdown-pop {
  0% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.play-panel {
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  padding: 20px 22px 24px;
  background: var(--app-surface);
}

.play-top {
  margin-bottom: 28px;
}

.play-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 10px;
  font-size: 14px;
}

.play-mode {
  font-weight: 600;
}

.play-score strong {
  font-size: 1.25em;
  color: var(--el-color-primary);
}

.time-bar {
  height: 10px;
  border-radius: 999px;
  background: var(--app-surface-alt);
  overflow: hidden;
}

.time-bar__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-3));
  transition: width 0.05s linear;
}

.time-bar__label {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-text-muted);
  text-align: right;
}

.question-block {
  text-align: center;
  margin-bottom: 24px;
}

.question-expression {
  margin: 0;
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: color 0.15s ease;
}

.question-expression--ok {
  color: var(--el-color-success);
}

.question-expression--bad {
  color: var(--el-color-danger);
}

.feedback {
  margin: 12px 0 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.feedback--ok {
  color: var(--el-color-success);
}

.feedback--bad {
  color: var(--el-color-danger);
}

.option-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface-alt);
  cursor: pointer;
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
  transition:
    border-color 0.12s ease,
    background 0.12s ease;
}

.option-btn:hover:not(:disabled) {
  border-color: var(--el-color-primary-light-5);
  background: color-mix(in srgb, var(--el-color-primary-light-9) 60%, transparent);
}

.option-btn:disabled {
  opacity: 0.65;
  cursor: default;
}

.option-btn__key {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--app-surface);
  border: 1px solid var(--app-border-soft);
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text-muted);
}

.hint {
  margin: 16px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--app-text-muted);
}

.hint kbd {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--app-border-soft);
  background: var(--app-surface-alt);
  font-size: 11px;
}

.result-panel {
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  padding: 24px 22px;
  background: var(--app-surface);
}

.result-title {
  margin: 0 0 8px;
  font-size: 1.25rem;
}

.result-score {
  margin: 0 0 6px;
  font-size: 1.05rem;
}

.result-score strong {
  font-size: 1.4em;
  color: var(--el-color-primary);
}

.result-stats {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--app-text-muted);
}

.result-log h4 {
  margin: 0 0 10px;
  font-size: 14px;
  color: var(--app-text-muted);
}

.result-log ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
}

.result-log li {
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.45;
  border-bottom: 1px solid var(--app-border-soft);
}

.result-log li:last-child {
  border-bottom: none;
}

.log-ok {
  background: color-mix(in srgb, var(--el-color-success-light-9) 40%, transparent);
}

.log-bad {
  background: color-mix(in srgb, var(--el-color-danger-light-9) 35%, transparent);
}

.log-idx {
  font-weight: 600;
  margin-right: 6px;
}

.log-expr {
  font-weight: 600;
  margin-right: 8px;
}

.log-detail {
  color: var(--app-text-muted);
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
</style>
