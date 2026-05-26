import { getDailyUsageByDateKey, localDateKey } from '@/services/daily-web-usage'
import { workTimeLogService } from '@/services/data-services'
import { applyMoneyDelta } from '@/views/learning/question-bank-score/wen-wu-user-scores'

/** 与 hook.moneyRule 一致 */
export const MONEY_STUDY_REWARD_SECONDS = 3600
export const MONEY_WORK_REWARD_MINUTES = 120
export const MONEY_STUDY_OR_WORK_REWARD = 10
export const MONEY_CURFEW_START_HOUR = 23
export const MONEY_CURFEW_END_HOUR = 9

const STUDY_WORK_BONUS_KEY = 'wen-wu-money-study-work-bonus-v1'

export type MoneyBlockReason = 'curfew'

export class MoneySettlementBlockedError extends Error {
  reason: MoneyBlockReason

  constructor(reason: MoneyBlockReason) {
    super(reason)
    this.reason = reason
  }
}

/** 每日 23:00～次日 09:00（本地时间）不进行金额结算 */
export function isMoneyCurfewActive(at = new Date()): boolean {
  const h = at.getHours()
  return h >= MONEY_CURFEW_START_HOUR || h < MONEY_CURFEW_END_HOUR
}

export function moneyCurfewMessage(): string {
  return `每日 ${MONEY_CURFEW_START_HOUR}:00 至次日 ${MONEY_CURFEW_END_HOUR}:00 不进行金额结算，请稍后再试。`
}

export function assertMoneySettlementAllowed(at = new Date()): void {
  if (isMoneyCurfewActive(at)) {
    throw new MoneySettlementBlockedError('curfew')
  }
}

/** 增减金钱；宵禁时段拒绝结算 */
export function applyMoneyDeltaAllowed(delta: number, at = new Date()): number {
  assertMoneySettlementAllowed(at)
  return applyMoneyDelta(delta)
}

function loadStudyWorkBonusDates(): Record<string, true> {
  try {
    const raw = localStorage.getItem(STUDY_WORK_BONUS_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as { dates?: Record<string, true> }
    return o.dates && typeof o.dates === 'object' ? { ...o.dates } : {}
  } catch {
    return {}
  }
}

function saveStudyWorkBonusDate(dateKey: string): void {
  const dates = loadStudyWorkBonusDates()
  dates[dateKey] = true
  localStorage.setItem(STUDY_WORK_BONUS_KEY, JSON.stringify({ dates }))
}

export function isStudyWorkBonusGranted(dateKey: string): boolean {
  return !!loadStudyWorkBonusDates()[dateKey]
}

async function workMinutesForDate(dateKey: string): Promise<number> {
  const logs = await workTimeLogService.listAll()
  return logs
    .filter((l) => l.dateKey === dateKey)
    .reduce((s, l) => s + Math.max(0, Math.round(Number(l.minutes) || 0)), 0)
}

export type DailyMoneyBonusStatus = {
  dateKey: string
  studySeconds: number
  workMinutes: number
  studyMet: boolean
  workMet: boolean
  eligible: boolean
  alreadyGranted: boolean
  curfewActive: boolean
  rewardAmount: number
}

export async function getDailyMoneyBonusStatus(
  dateKey = localDateKey(),
): Promise<DailyMoneyBonusStatus> {
  const usage = await getDailyUsageByDateKey(dateKey)
  const studySeconds = Math.max(0, Math.round(Number(usage?.activeSeconds) || 0))
  const workMinutes = await workMinutesForDate(dateKey)
  const studyMet = studySeconds >= MONEY_STUDY_REWARD_SECONDS
  const workMet = workMinutes >= MONEY_WORK_REWARD_MINUTES
  const eligible = studyMet || workMet
  const alreadyGranted = isStudyWorkBonusGranted(dateKey)

  return {
    dateKey,
    studySeconds,
    workMinutes,
    studyMet,
    workMet,
    eligible,
    alreadyGranted,
    curfewActive: isMoneyCurfewActive(),
    rewardAmount: MONEY_STUDY_OR_WORK_REWARD,
  }
}

/**
 * 规则 2：当日学习满 1 小时或工作登记满 2 小时，自动奖励 10 元（每日一次）。
 * 规则 3：仅在非宵禁时段入账。
 */
export async function syncDailyStudyWorkMoneyBonus(
  dateKey = localDateKey(),
): Promise<{ granted: boolean; status: DailyMoneyBonusStatus }> {
  const status = await getDailyMoneyBonusStatus(dateKey)

  if (!status.eligible || status.alreadyGranted) {
    return { granted: false, status }
  }

  if (status.curfewActive) {
    return { granted: false, status }
  }

  applyMoneyDelta(MONEY_STUDY_OR_WORK_REWARD)
  saveStudyWorkBonusDate(dateKey)
  status.alreadyGranted = true

  return { granted: true, status }
}

export function formatStudyProgress(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  const rm = m % 60
  if (h > 0) return `${h} 小时 ${rm} 分`
  return `${m} 分`
}

export function formatWorkProgress(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const rm = minutes % 60
  if (h > 0) return `${h} 小时 ${rm} 分`
  return `${minutes} 分`
}
