import {
  applyMoneyDeltaAllowed,
  assertMoneySettlementAllowed,
  isMoneyCurfewActive,
  moneyCurfewMessage,
} from '@/services/money-rule-auto'
import { loadWenWuUserScores } from '@/views/learning/question-bank-score/wen-wu-user-scores'
import { drawLadderTenPull, drawTenPull, ladderGuaranteeText } from './gacha-draw'
import {
  getGachaRemainingToday,
  getGachaUsesToday,
  incrementGachaUse,
} from './gacha-usage'
import type { GachaCardTier, GachaDrawResult } from './gacha-types'

export type GachaTicketConfig = {
  name: string
  money: number
  timeLimit: number
  rank: GachaCardTier[]
  kind?: 'standard' | 'ladder'
}

export function isLadderTicket(ticket: Pick<GachaTicketConfig, 'kind' | 'name'>): boolean {
  return ticket.kind === 'ladder' || ticket.name === '阶梯抽奖券'
}

/** 阶梯券：按今日已抽次数，下一次是第几抽（1~4） */
export function nextLadderPullIndex(ticket: GachaTicketConfig): number {
  const used = getGachaUsesToday(ticket.name)
  return Math.min(used + 1, ticket.timeLimit)
}

export type GachaPullBlockReason = 'insufficient_money' | 'daily_limit' | 'curfew'

export type GachaPullCheck = {
  ok: boolean
  reason?: GachaPullBlockReason
  balance: number
  remainingToday: number
}

export function checkGachaPull(ticket: GachaTicketConfig): GachaPullCheck {
  const balance = loadWenWuUserScores().money
  const remainingToday = getGachaRemainingToday(ticket.name, ticket.timeLimit)
  if (isMoneyCurfewActive()) {
    return { ok: false, reason: 'curfew', balance, remainingToday }
  }
  if (balance < ticket.money) {
    return { ok: false, reason: 'insufficient_money', balance, remainingToday }
  }
  if (remainingToday <= 0) {
    return { ok: false, reason: 'daily_limit', balance, remainingToday }
  }
  return { ok: true, balance, remainingToday }
}

export function totalRewardFromResults(results: GachaDrawResult[]): number {
  return results.reduce((sum, r) => sum + r.tier.money, 0)
}

export type GachaSettlement = {
  cost: number
  reward: number
  net: number
  balance: number
}

export type TenPullOutcome = {
  results: GachaDrawResult[]
  settlement: GachaSettlement
  /** 阶梯券：本次为今日第几次 */
  ladderPullIndex?: number
}

/** 执行一次 10 连抽：抽奖、扣费加返还、计入今日次数 */
export function executeTenPull(ticket: GachaTicketConfig): TenPullOutcome {
  const check = checkGachaPull(ticket)
  if (!check.ok) {
    throw new Error(check.reason ?? 'cannot_pull')
  }

  let results: GachaDrawResult[]
  let ladderPullIndex: number | undefined

  if (isLadderTicket(ticket)) {
    ladderPullIndex = nextLadderPullIndex(ticket)
    results = drawLadderTenPull(ticket.rank, ladderPullIndex)
  } else {
    results = drawTenPull(ticket.rank)
  }

  const reward = totalRewardFromResults(results)
  const net = reward - ticket.money
  assertMoneySettlementAllowed()
  const balance = applyMoneyDeltaAllowed(net)
  incrementGachaUse(ticket.name)

  return {
    results,
    settlement: {
      cost: ticket.money,
      reward,
      net,
      balance,
    },
    ladderPullIndex,
  }
}

export function gachaPullBlockMessage(
  ticket: GachaTicketConfig,
  check: GachaPullCheck,
): string {
  if (check.reason === 'curfew') {
    return moneyCurfewMessage()
  }
  if (check.reason === 'insufficient_money') {
    return `金钱不足：本次需 ${ticket.money} 元，当前余额 ${check.balance} 元`
  }
  if (check.reason === 'daily_limit') {
    return `今日「${ticket.name}」已达上限（${ticket.timeLimit} 次），已抽 ${getGachaUsesToday(ticket.name)} 次`
  }
  return '暂时无法抽奖'
}

export function ladderPullHint(ticket: GachaTicketConfig, check: GachaPullCheck): string {
  const next = nextLadderPullIndex(ticket)
  return (
    `每次 10 张，消耗 ${ticket.money} 元，按卡牌价值返还；` +
    `本次为今日第 ${next} 次，第 10 张保底 ${ladderGuaranteeText(next)}；还可抽 ${check.remainingToday} 次`
  )
}
