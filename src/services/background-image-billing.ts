import { SETTINGS_MONEY_UNRESTRICTED } from '@/services/settings-money-policy'
import {
  applyMoneyDelta,
  loadWenWuUserScores,
} from '@/views/learning/question-bank-score/wen-wu-user-scores'

/** 每次设置（更换）背景图扣费，去除背景不扣费 */
export const BACKGROUND_IMAGE_SET_FEE = 5

export function normalizeBackgroundImageValue(value: string): string {
  return value.trim()
}

/** 改为空视为去除背景，不收费 */
export function isBackgroundImageRemoval(next: string): boolean {
  return !normalizeBackgroundImageValue(next)
}

/** 新设或更换为非空背景时需扣费；内容未变不重复扣 */
export function shouldChargeForBackgroundImageChange(prev: string, next: string): boolean {
  const p = normalizeBackgroundImageValue(prev)
  const n = normalizeBackgroundImageValue(next)
  if (!n) return false
  return p !== n
}

export type BackgroundImageChargeBlockReason = 'curfew' | 'insufficient'

export type BackgroundImageChargeResult =
  | { ok: true; balance: number; charged: boolean }
  | { ok: false; reason: BackgroundImageChargeBlockReason; balance: number; message: string }

export function backgroundImageChargeBlockMessage(
  reason: BackgroundImageChargeBlockReason,
  balance: number,
): string {
  if (reason === 'curfew') {
    return `每日 23:00 至次日 09:00 不进行金额结算，请稍后再试。`
  }
  return `金钱不足：设置背景图需 ${BACKGROUND_IMAGE_SET_FEE} 元，当前余额 ${balance} 元`
}

/** 扣减一次背景图设置费用（设置页不受宵禁与余额门槛拦截） */
export function tryChargeForBackgroundImageSet(): BackgroundImageChargeResult {
  const balance = loadWenWuUserScores().money

  if (SETTINGS_MONEY_UNRESTRICTED) {
    if (balance < BACKGROUND_IMAGE_SET_FEE) {
      return { ok: true, balance, charged: false }
    }
    try {
      const newBalance = applyMoneyDelta(-BACKGROUND_IMAGE_SET_FEE)
      return { ok: true, balance: newBalance, charged: true }
    } catch {
      return { ok: true, balance, charged: false }
    }
  }

  if (balance < BACKGROUND_IMAGE_SET_FEE) {
    return {
      ok: false,
      reason: 'insufficient',
      balance,
      message: backgroundImageChargeBlockMessage('insufficient', balance),
    }
  }
  try {
    const newBalance = applyMoneyDelta(-BACKGROUND_IMAGE_SET_FEE)
    return { ok: true, balance: newBalance, charged: true }
  } catch {
    return { ok: true, balance, charged: false }
  }
}

/** 保存背景成功后扣费；去除或内容未变则不扣 */
export function settleBackgroundImageSetFee(
  prev: string,
  next: string,
): BackgroundImageChargeResult {
  if (!shouldChargeForBackgroundImageChange(prev, next)) {
    return { ok: true, balance: loadWenWuUserScores().money, charged: false }
  }
  return tryChargeForBackgroundImageSet()
}
