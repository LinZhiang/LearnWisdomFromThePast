import { ElMessageBox } from 'element-plus'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { playPomodoroClassEndBell, playPomodoroClassStartBell } from '@/utils/pomodoroSounds'

const PREFS_KEY = 'wen-wu-pomodoro-prefs-v1'

export const POMODORO_SESSIONS_BEFORE_LONG_BREAK = 4

export const POMODORO_DEFAULTS = {
  studyMinutes: 30,
  breakMinutes: 5,
  longBreakMinutes: 25,
} as const

export type PomodoroPhase = 'idle' | 'study' | 'break' | 'long-break'

export type PomodoroSettings = {
  studyMinutes: number
  breakMinutes: number
  longBreakMinutes: number
}

type PomodoroPrefs = PomodoroSettings

function clampMinutes(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function normalizeSettings(raw: Partial<PomodoroSettings> | null | undefined): PomodoroSettings {
  return {
    studyMinutes: clampMinutes(
      raw?.studyMinutes,
      1,
      180,
      POMODORO_DEFAULTS.studyMinutes,
    ),
    breakMinutes: clampMinutes(raw?.breakMinutes, 1, 60, POMODORO_DEFAULTS.breakMinutes),
    longBreakMinutes: clampMinutes(
      raw?.longBreakMinutes,
      1,
      90,
      POMODORO_DEFAULTS.longBreakMinutes,
    ),
  }
}

function loadPrefs(): PomodoroPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...POMODORO_DEFAULTS }
    return normalizeSettings(JSON.parse(raw) as Partial<PomodoroSettings>)
  } catch {
    return { ...POMODORO_DEFAULTS }
  }
}

function savePrefs(settings: PomodoroSettings): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(normalizeSettings(settings)))
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let alerting = false

export const usePomodoroStore = defineStore('pomodoro', () => {
  const enabled = ref(false)
  const phase = ref<PomodoroPhase>('idle')
  const phaseEndsAt = ref<number | null>(null)
  /** 本轮已完成的学习段数（满 4 次后进入长休息并清零） */
  const completedStudySessions = ref(0)
  const settings = ref<PomodoroSettings>(loadPrefs())

  const remainingMs = computed(() => {
    if (!enabled.value || phase.value === 'idle' || phaseEndsAt.value == null) return 0
    return Math.max(0, phaseEndsAt.value - Date.now())
  })

  const remainingLabel = computed(() => {
    const ms = remainingMs.value
    if (ms <= 0) return ''
    const totalSec = Math.ceil(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  })

  const phaseLabel = computed(() => {
    if (!enabled.value) return ''
    if (phase.value === 'study') return '学习中'
    if (phase.value === 'break') return '短休息'
    if (phase.value === 'long-break') return '长休息'
    return ''
  })

  function stopTick() {
    if (tickTimer != null) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }

  function startTick() {
    stopTick()
    tickTimer = setInterval(() => {
      void onTick()
    }, 1000)
  }

  function beginPhase(next: Exclude<PomodoroPhase, 'idle'>, durationMinutes: number) {
    phase.value = next
    phaseEndsAt.value = Date.now() + durationMinutes * 60_000
    startTick()
  }

  function resetToIdle() {
    stopTick()
    phase.value = 'idle'
    phaseEndsAt.value = null
  }

  function startStudyPhase() {
    beginPhase('study', settings.value.studyMinutes)
  }

  async function showPhaseAlert(title: string, message: string) {
    if (alerting) return
    alerting = true
    try {
      await ElMessageBox.alert(message, title, {
        confirmButtonText: '知道了',
        closeOnClickModal: false,
        closeOnPressEscape: true,
      })
    } finally {
      alerting = false
    }
  }

  async function onStudyComplete() {
    completedStudySessions.value += 1
    await playPomodoroClassEndBell()
    if (completedStudySessions.value >= POMODORO_SESSIONS_BEFORE_LONG_BREAK) {
      beginPhase('long-break', settings.value.longBreakMinutes)
      await showPhaseAlert(
        '番茄学习 · 长休息',
        `已连续学习 ${POMODORO_SESSIONS_BEFORE_LONG_BREAK} 个番茄，休息 ${settings.value.longBreakMinutes} 分钟后再继续。`,
      )
      return
    }
    beginPhase('break', settings.value.breakMinutes)
    await showPhaseAlert(
      '番茄学习 · 休息',
      `本轮学习结束，休息 ${settings.value.breakMinutes} 分钟。`,
    )
  }

  async function onBreakComplete(isLong: boolean) {
    if (isLong) {
      completedStudySessions.value = 0
    }
    await playPomodoroClassStartBell()
    startStudyPhase()
    await showPhaseAlert(
      '番茄学习 · 继续学习',
      `休息结束，开始 ${settings.value.studyMinutes} 分钟专注学习。`,
    )
  }

  async function onTick() {
    if (!enabled.value || phase.value === 'idle' || phaseEndsAt.value == null) return
    if (Date.now() < phaseEndsAt.value) return

    phaseEndsAt.value = null
    stopTick()

    if (phase.value === 'study') {
      await onStudyComplete()
      return
    }
    if (phase.value === 'break') {
      await onBreakComplete(false)
      return
    }
    if (phase.value === 'long-break') {
      await onBreakComplete(true)
    }
  }

  function enable() {
    enabled.value = true
    completedStudySessions.value = 0
    startStudyPhase()
  }

  function disable() {
    enabled.value = false
    completedStudySessions.value = 0
    resetToIdle()
  }

  function toggle() {
    if (enabled.value) {
      disable()
      return
    }
    enable()
  }

  function updateSettings(patch: Partial<PomodoroSettings>) {
    settings.value = normalizeSettings({ ...settings.value, ...patch })
    savePrefs(settings.value)
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      void onTick()
    }
  }

  function attachLifecycle() {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  function detachLifecycle() {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    stopTick()
  }

  return {
    enabled,
    phase,
    phaseEndsAt,
    completedStudySessions,
    settings,
    remainingMs,
    remainingLabel,
    phaseLabel,
    toggle,
    enable,
    disable,
    updateSettings,
    attachLifecycle,
    detachLifecycle,
    onTick,
  }
})
