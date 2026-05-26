import { SETTINGS_MONEY_UNRESTRICTED } from '@/services/settings-money-policy'
import {
  applyMoneyDeltaAllowed,
  assertMoneySettlementAllowed,
  isMoneyCurfewActive,
  moneyCurfewMessage,
  MoneySettlementBlockedError,
} from '@/services/money-rule-auto'
import { applyMoneyDelta } from '@/views/learning/question-bank-score/wen-wu-user-scores'
import { loadWenWuUserScores } from '@/views/learning/question-bank-score/wen-wu-user-scores'

/** 背景音乐：每播放满 1 小时扣 3 元 */
export const BGM_HOUR_SECONDS = 3600
export const BGM_HOUR_FEE = 3

export const BGM_INSUFFICIENT_MSG = '金额不足，无法播放音乐'

const SESSION_KEY = 'wen-wu-bgm-billing-v1'

type BgmBillingSession = {
  /** 距下一次扣款已累计的播放秒数 */
  unbilledSeconds: number
  runningSinceMs: number | null
}

function loadSession(): BgmBillingSession {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return { unbilledSeconds: 0, runningSinceMs: null }
    const o = JSON.parse(raw) as Partial<BgmBillingSession>
    return {
      unbilledSeconds: Math.max(0, Math.round(Number(o.unbilledSeconds) || 0)),
      runningSinceMs:
        o.runningSinceMs != null && Number.isFinite(o.runningSinceMs)
          ? Number(o.runningSinceMs)
          : null,
    }
  } catch {
    return { unbilledSeconds: 0, runningSinceMs: null }
  }
}

function saveSession(session: BgmBillingSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getBgmBalance(): number {
  return loadWenWuUserScores().money
}

/** 开始播放前：余额至少够扣 1 小时（设置页 unrestricted 时不拦截） */
export function canAffordBgmPlayback(): boolean {
  if (SETTINGS_MONEY_UNRESTRICTED) return true
  return getBgmBalance() >= BGM_HOUR_FEE
}

export function isBgmBillingCurfew(at = new Date()): boolean {
  if (SETTINGS_MONEY_UNRESTRICTED) return false
  return isMoneyCurfewActive(at)
}

export function bgmBillingCurfewMessage(): string {
  return moneyCurfewMessage()
}

function flushRunningSeconds(session: BgmBillingSession, atMs: number): BgmBillingSession {
  if (session.runningSinceMs == null) return session
  const elapsed = Math.max(0, Math.floor((atMs - session.runningSinceMs) / 1000))
  return {
    unbilledSeconds: session.unbilledSeconds + elapsed,
    runningSinceMs: null,
  }
}

/** 将运行中计时写入累计（暂停时调用） */
export function pauseBgmBillingTimer(atMs = Date.now()): BgmBillingSession {
  const next = flushRunningSeconds(loadSession(), atMs)
  saveSession(next)
  return next
}

export function startBgmBillingTimer(atMs = Date.now()): BgmBillingSession {
  const session = flushRunningSeconds(loadSession(), atMs)
  const next = { ...session, runningSinceMs: atMs }
  saveSession(next)
  return next
}

export type BgmChargeHourResult =
  | { ok: true; balance: number }
  | { ok: false; reason: 'insufficient' | 'curfew' }

/** 扣减 1 小时费用；设置页 unrestricted 时余额不足或扣款失败视为跳过，不阻断播放 */
export function chargeBgmOneHour(at = new Date()): BgmChargeHourResult {
  if (SETTINGS_MONEY_UNRESTRICTED) {
    const balance = getBgmBalance()
    if (balance < BGM_HOUR_FEE) {
      return { ok: true, balance }
    }
    try {
      const next = applyMoneyDelta(-BGM_HOUR_FEE)
      return { ok: true, balance: next }
    } catch {
      return { ok: true, balance }
    }
  }

  if (isMoneyCurfewActive(at)) {
    return { ok: false, reason: 'curfew' }
  }
  if (getBgmBalance() < BGM_HOUR_FEE) {
    return { ok: false, reason: 'insufficient' }
  }
  try {
    assertMoneySettlementAllowed(at)
    const balance = applyMoneyDeltaAllowed(-BGM_HOUR_FEE, at)
    return { ok: true, balance }
  } catch (e) {
    if (e instanceof MoneySettlementBlockedError) {
      return { ok: false, reason: 'curfew' }
    }
    throw e
  }
}

/**
 * 推进计费：把运行中秒数并入 unbilled，满 1 小时则扣款。
 * @returns 是否仍可继续播放（扣款失败则为 false）
 */
export function tickBgmBilling(atMs = Date.now()): {
  canContinue: boolean
  chargedHours: number
  unbilledSeconds: number
  isRunning: boolean
} {
  let session = loadSession()
  if (session.runningSinceMs != null) {
    session = flushRunningSeconds(session, atMs)
    session = { ...session, runningSinceMs: atMs }
  }

  let chargedHours = 0
  while (session.unbilledSeconds >= BGM_HOUR_SECONDS) {
    const result = chargeBgmOneHour(new Date(atMs))
    if (!result.ok) {
      if (SETTINGS_MONEY_UNRESTRICTED) {
        session.unbilledSeconds -= BGM_HOUR_SECONDS
        continue
      }
      saveSession({ ...session, runningSinceMs: null })
      return {
        canContinue: false,
        chargedHours,
        unbilledSeconds: session.unbilledSeconds,
        isRunning: false,
      }
    }
    session.unbilledSeconds -= BGM_HOUR_SECONDS
    chargedHours += 1
  }

  saveSession(session)
  return {
    canContinue: true,
    chargedHours,
    unbilledSeconds: session.unbilledSeconds,
    isRunning: session.runningSinceMs != null,
  }
}

export function getBgmBillingStatus(atMs = Date.now()): {
  unbilledSeconds: number
  secondsUntilNextCharge: number
  isRunning: boolean
} {
  const session = loadSession()
  let unbilled = session.unbilledSeconds
  if (session.runningSinceMs != null) {
    unbilled += Math.max(0, Math.floor((atMs - session.runningSinceMs) / 1000))
  }
  const mod = unbilled % BGM_HOUR_SECONDS
  const secondsUntilNextCharge = mod === 0 ? BGM_HOUR_SECONDS : BGM_HOUR_SECONDS - mod
  return {
    unbilledSeconds: unbilled,
    secondsUntilNextCharge,
    isRunning: session.runningSinceMs != null,
  }
}

export function resetBgmBillingSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}
