import { localDateKey } from '@/services/daily-web-usage'
import {
  applyMoneyDeltaAllowed,
  assertMoneySettlementAllowed,
  isMoneyCurfewActive,
  moneyCurfewMessage,
  MoneySettlementBlockedError,
} from '@/services/money-rule-auto'
import { loadWenWuUserScores } from '@/views/learning/question-bank-score/wen-wu-user-scores'

export type LeisureKind = 'game' | 'video'

/** 每日免费：游戏 30 分钟、视频 1 小时（与 hook.moneyRule / moneyList 一致） */
export const FREE_GAME_SECONDS = 30 * 60
export const FREE_VIDEO_SECONDS = 60 * 60
export const GAME_BLOCK_SECONDS = 30 * 60
export const VIDEO_BLOCK_SECONDS = 60 * 60
export const GAME_BLOCK_FEE = -20
export const VIDEO_BLOCK_FEE = -20

const DAILY_KEY = 'wen-wu-money-leisure-daily-v1'
const SESSION_KEY = 'wen-wu-money-leisure-session-v1'

type LeisureDailyRecord = {
  date: string
  gameSeconds: number
  videoSeconds: number
  /** 已结算扣款的超额秒数（游戏） */
  settledGameOverSeconds: number
  settledVideoOverSeconds: number
}

type LeisureSession = {
  kind: LeisureKind | null
  runningSinceMs: number | null
}

function loadDaily(): LeisureDailyRecord {
  const today = localDateKey()
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (!raw) {
      return {
        date: today,
        gameSeconds: 0,
        videoSeconds: 0,
        settledGameOverSeconds: 0,
        settledVideoOverSeconds: 0,
      }
    }
    const o = JSON.parse(raw) as Partial<LeisureDailyRecord>
    if (o.date !== today) {
      return {
        date: today,
        gameSeconds: 0,
        videoSeconds: 0,
        settledGameOverSeconds: 0,
        settledVideoOverSeconds: 0,
      }
    }
    return {
      date: today,
      gameSeconds: Math.max(0, Math.round(Number(o.gameSeconds) || 0)),
      videoSeconds: Math.max(0, Math.round(Number(o.videoSeconds) || 0)),
      settledGameOverSeconds: Math.max(0, Math.round(Number(o.settledGameOverSeconds) || 0)),
      settledVideoOverSeconds: Math.max(0, Math.round(Number(o.settledVideoOverSeconds) || 0)),
    }
  } catch {
    return {
      date: today,
      gameSeconds: 0,
      videoSeconds: 0,
      settledGameOverSeconds: 0,
      settledVideoOverSeconds: 0,
    }
  }
}

function saveDaily(record: LeisureDailyRecord): void {
  localStorage.setItem(DAILY_KEY, JSON.stringify(record))
}

function loadSession(): LeisureSession {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return { kind: null, runningSinceMs: null }
    const o = JSON.parse(raw) as Partial<LeisureSession>
    const kind = o.kind === 'game' || o.kind === 'video' ? o.kind : null
    const runningSinceMs =
      kind && o.runningSinceMs != null && Number.isFinite(o.runningSinceMs)
        ? Number(o.runningSinceMs)
        : null
    return { kind, runningSinceMs }
  } catch {
    return { kind: null, runningSinceMs: null }
  }
}

function saveSession(session: LeisureSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function runningElapsedSeconds(session = loadSession(), atMs = Date.now()): number {
  if (!session.kind || session.runningSinceMs == null) return 0
  return Math.max(0, Math.floor((atMs - session.runningSinceMs) / 1000))
}

function excessSeconds(total: number, free: number): number {
  return Math.max(0, total - free)
}

function blocksForOverageSeconds(overageSeconds: number, blockSeconds: number): number {
  if (overageSeconds <= 0) return 0
  return Math.ceil(overageSeconds / blockSeconds)
}

export type LeisureKindStatus = {
  kind: LeisureKind
  label: string
  freeSeconds: number
  blockSeconds: number
  blockFee: number
  totalSeconds: number
  excessSeconds: number
  unbilledOverSeconds: number
  pendingBlocks: number
  pendingFee: number
}

export type LeisureDailyStatus = {
  dateKey: string
  game: LeisureKindStatus
  video: LeisureKindStatus
  runningKind: LeisureKind | null
  runningElapsedSeconds: number
  totalPendingFee: number
  curfewActive: boolean
}

function buildKindStatus(
  kind: LeisureKind,
  totalSeconds: number,
  settledOverSeconds: number,
): LeisureKindStatus {
  const isGame = kind === 'game'
  const free = isGame ? FREE_GAME_SECONDS : FREE_VIDEO_SECONDS
  const blockSec = isGame ? GAME_BLOCK_SECONDS : VIDEO_BLOCK_SECONDS
  const fee = isGame ? GAME_BLOCK_FEE : VIDEO_BLOCK_FEE
  const excess = excessSeconds(totalSeconds, free)
  const unbilled = Math.max(0, excess - settledOverSeconds)
  const pendingBlocks = blocksForOverageSeconds(unbilled, blockSec)
  return {
    kind,
    label: isGame ? '玩游戏' : '看视频',
    freeSeconds: free,
    blockSeconds: blockSec,
    blockFee: fee,
    totalSeconds: totalSeconds,
    excessSeconds: excess,
    unbilledOverSeconds: unbilled,
    pendingBlocks,
    pendingFee: pendingBlocks * fee,
  }
}

export function getLeisureDailyStatus(atMs = Date.now()): LeisureDailyStatus {
  const daily = loadDaily()
  const session = loadSession()
  const runSec = runningElapsedSeconds(session, atMs)

  let gameTotal = daily.gameSeconds
  let videoTotal = daily.videoSeconds
  if (session.kind === 'game') gameTotal += runSec
  if (session.kind === 'video') videoTotal += runSec

  const game = buildKindStatus('game', gameTotal, daily.settledGameOverSeconds)
  const video = buildKindStatus('video', videoTotal, daily.settledVideoOverSeconds)

  return {
    dateKey: daily.date,
    game,
    video,
    runningKind: session.kind,
    runningElapsedSeconds: runSec,
    totalPendingFee: game.pendingFee + video.pendingFee,
    curfewActive: isMoneyCurfewActive(new Date(atMs)),
  }
}

/** 将当前计时片段写入今日累计并停止计时 */
export function flushRunningTimerToDaily(atMs = Date.now()): LeisureDailyStatus {
  const daily = loadDaily()
  const session = loadSession()
  const elapsed = runningElapsedSeconds(session, atMs)
  if (session.kind && elapsed > 0) {
    if (session.kind === 'game') daily.gameSeconds += elapsed
    else daily.videoSeconds += elapsed
    saveDaily(daily)
  }
  saveSession({ kind: null, runningSinceMs: null })
  return getLeisureDailyStatus(atMs)
}

export function startLeisureTimer(kind: LeisureKind, atMs = Date.now()): LeisureDailyStatus {
  const session = loadSession()
  if (session.kind && session.runningSinceMs != null) {
    flushRunningTimerToDaily(atMs)
  }
  saveSession({ kind, runningSinceMs: atMs })
  return getLeisureDailyStatus(atMs)
}

export function pauseLeisureTimer(atMs = Date.now()): LeisureDailyStatus {
  return flushRunningTimerToDaily(atMs)
}

export function toggleLeisureTimer(kind: LeisureKind, atMs = Date.now()): LeisureDailyStatus {
  const session = loadSession()
  if (session.kind === kind && session.runningSinceMs != null) {
    return pauseLeisureTimer(atMs)
  }
  return startLeisureTimer(kind, atMs)
}

export type LeisureSettleResult = {
  ok: boolean
  totalDelta: number
  balance: number
  lines: string[]
  reason?: 'curfew' | 'nothing'
}

/** 结算今日超额游戏/视频时长并扣款（仅对尚未结算的超额部分） */
export function settleLeisureOverage(atMs = Date.now()): LeisureSettleResult {
  if (isMoneyCurfewActive(new Date(atMs))) {
    return {
      ok: false,
      totalDelta: 0,
      balance: 0,
      lines: [],
      reason: 'curfew',
    }
  }

  flushRunningTimerToDaily(atMs)
  const refreshed = loadDaily()

  let totalDelta = 0
  const lines: string[] = []

  const gameExcess = excessSeconds(refreshed.gameSeconds, FREE_GAME_SECONDS)
  const gameUnbilled = Math.max(0, gameExcess - refreshed.settledGameOverSeconds)
  const gameBlocks = blocksForOverageSeconds(gameUnbilled, GAME_BLOCK_SECONDS)
  if (gameBlocks > 0) {
    totalDelta += gameBlocks * GAME_BLOCK_FEE
    refreshed.settledGameOverSeconds = gameExcess
    lines.push(
      `玩游戏超额 ${Math.ceil(gameUnbilled / 60)} 分钟（按每 ${GAME_BLOCK_SECONDS / 60} 分钟 ${GAME_BLOCK_FEE} 元）→ ${gameBlocks * GAME_BLOCK_FEE} 元`,
    )
  }

  const videoExcess = excessSeconds(refreshed.videoSeconds, FREE_VIDEO_SECONDS)
  const videoUnbilled = Math.max(0, videoExcess - refreshed.settledVideoOverSeconds)
  const videoBlocks = blocksForOverageSeconds(videoUnbilled, VIDEO_BLOCK_SECONDS)
  if (videoBlocks > 0) {
    totalDelta += videoBlocks * VIDEO_BLOCK_FEE
    refreshed.settledVideoOverSeconds = videoExcess
    lines.push(
      `看视频超额 ${Math.ceil(videoUnbilled / 60)} 分钟（按每 ${VIDEO_BLOCK_SECONDS / 60} 分钟 ${VIDEO_BLOCK_FEE} 元）→ ${videoBlocks * VIDEO_BLOCK_FEE} 元`,
    )
  }

  saveDaily(refreshed)

  if (totalDelta === 0) {
    return {
      ok: true,
      totalDelta: 0,
      balance: loadWenWuUserScores().money,
      lines: [],
      reason: 'nothing',
    }
  }

  try {
    assertMoneySettlementAllowed(new Date(atMs))
    const balance = applyMoneyDeltaAllowed(totalDelta, new Date(atMs))
    return { ok: true, totalDelta, balance, lines }
  } catch (e) {
    if (e instanceof MoneySettlementBlockedError) {
      return { ok: false, totalDelta: 0, balance: 0, lines: [], reason: 'curfew' }
    }
    throw e
  }
}

export function leisureCurfewMessage(): string {
  return moneyCurfewMessage()
}
