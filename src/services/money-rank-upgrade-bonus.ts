import { ElMessage } from 'element-plus'
import { buildWenWuRankings } from '@/views/learning/score-ranking/ranking-data'
import {
  applyMoneyDeltaAllowed,
  isMoneyCurfewActive,
  moneyCurfewMessage,
  MoneySettlementBlockedError,
} from '@/services/money-rule-auto'
import {
  resolveWenRankLevel,
  resolveWuRankLevel,
  titleForRankLevel,
} from '@/views/learning/question-bank-score/rank-data'
import type { WenWuUserScores } from '@/views/learning/question-bank-score/wen-wu-user-scores'

export const RANK_UPGRADE_MONEY_MIN = 20
export const RANK_UPGRADE_MONEY_MAX = 100

export const RANK_UPGRADE_MONEY_EVENT = 'wen-wu-rank-upgrade-money'

export type RankUpgradeMoneyDetail = {
  axis: 'wen' | 'wu'
  tierLevel: number
  tierTitle: string
  money: number
  leaderboardRank: number
  totalPlayers: number
  balance: number
}

const CREDITED_KEY = 'wen-wu-money-rank-tier-credited-v1'
const PENDING_KEY = 'wen-wu-money-rank-tier-pending-v1'

type CreditedStore = {
  wen: number[]
  wu: number[]
}

type PendingItem = { axis: 'wen' | 'wu'; tierLevel: number }

function loadCredited(): CreditedStore {
  try {
    const raw = localStorage.getItem(CREDITED_KEY)
    if (!raw) return { wen: [], wu: [] }
    const o = JSON.parse(raw) as Partial<CreditedStore>
    return {
      wen: Array.isArray(o.wen) ? o.wen.filter((n) => Number.isFinite(n)) : [],
      wu: Array.isArray(o.wu) ? o.wu.filter((n) => Number.isFinite(n)) : [],
    }
  } catch {
    return { wen: [], wu: [] }
  }
}

function saveCredited(store: CreditedStore): void {
  localStorage.setItem(CREDITED_KEY, JSON.stringify(store))
}

function isTierCredited(axis: 'wen' | 'wu', tierLevel: number): boolean {
  const s = loadCredited()
  return (axis === 'wen' ? s.wen : s.wu).includes(tierLevel)
}

function markTierCredited(axis: 'wen' | 'wu', tierLevel: number): void {
  const s = loadCredited()
  const list = axis === 'wen' ? s.wen : s.wu
  if (!list.includes(tierLevel)) list.push(tierLevel)
  saveCredited({ ...s, [axis]: list })
}

function loadPending(): PendingItem[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as PendingItem[]
    return Array.isArray(arr)
      ? arr.filter(
          (x) =>
            (x.axis === 'wen' || x.axis === 'wu') &&
            Number.isFinite(x.tierLevel),
        )
      : []
  } catch {
    return []
  }
}

function savePending(items: PendingItem[]): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(items))
}

function addPending(axis: 'wen' | 'wu', tierLevel: number): void {
  const items = loadPending()
  if (items.some((x) => x.axis === axis && x.tierLevel === tierLevel)) return
  items.push({ axis, tierLevel })
  savePending(items)
}

/** 宵禁结束后补发待入账的品阶晋升奖励 */
export function flushPendingRankUpgradeMoney(): RankUpgradeMoneyDetail[] {
  if (isMoneyCurfewActive()) return []
  const pending = loadPending()
  if (!pending.length) return []
  savePending([])
  const granted: RankUpgradeMoneyDetail[] = []
  for (const item of pending) {
    const d = grantTierUpgrade(item.axis, item.tierLevel)
    if (d) granted.push(d)
  }
  return granted
}

/** 名次越靠前（rank 越小）奖励越高：第 1 名 100 元，末名 20 元 */
export function moneyRewardFromLeaderboardRank(
  leaderboardRank: number,
  totalPlayers: number,
): number {
  if (totalPlayers <= 1) return RANK_UPGRADE_MONEY_MAX
  const pos = Math.min(Math.max(1, Math.round(leaderboardRank)), totalPlayers)
  const ratio = (pos - 1) / (totalPlayers - 1)
  return Math.round(
    RANK_UPGRADE_MONEY_MAX - ratio * (RANK_UPGRADE_MONEY_MAX - RANK_UPGRADE_MONEY_MIN),
  )
}

function newlyReachedTierLevels(oldScore: number, newScore: number, axis: 'wen' | 'wu'): number[] {
  const resolve = axis === 'wen' ? resolveWenRankLevel : resolveWuRankLevel
  const oldLevel = resolve(oldScore)
  const newLevel = resolve(newScore)
  if (newLevel <= oldLevel) return []
  const out: number[] = []
  for (let l = oldLevel + 1; l <= newLevel; l += 1) {
    out.push(l)
  }
  return out
}

function dispatchRewardEvent(detail: RankUpgradeMoneyDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(RANK_UPGRADE_MONEY_EVENT, { detail }))
}

function showRankUpgradeToast(detail: RankUpgradeMoneyDetail): void {
  const axisLabel = detail.axis === 'wen' ? '文职' : '武职'
  ElMessage.success({
    message: `首次晋升${axisLabel}「${detail.tierTitle}」（第 ${detail.tierLevel} 档）！${axisLabel}榜第 ${detail.leaderboardRank} / ${detail.totalPlayers} 名，奖励 ${detail.money} 元（余额 ${detail.balance} 元）`,
    duration: 6000,
    showClose: true,
  })
}

function grantTierUpgrade(
  axis: 'wen' | 'wu',
  tierLevel: number,
): RankUpgradeMoneyDetail | null {
  if (isTierCredited(axis, tierLevel)) return null

  const { wenTable, wuTable } = buildWenWuRankings()
  const table = axis === 'wen' ? wenTable : wuTable
  const totalPlayers = table.length
  const self = table.find((r) => r.isSelf)
  const leaderboardRank = self?.rank ?? totalPlayers
  const money = moneyRewardFromLeaderboardRank(leaderboardRank, totalPlayers)
  const tierTitle = titleForRankLevel(tierLevel, axis)

  if (isMoneyCurfewActive()) {
    addPending(axis, tierLevel)
    ElMessage.warning(
      `已达成${axis === 'wen' ? '文职' : '武职'}「${tierTitle}」晋升，但当前为宵禁时段：${moneyCurfewMessage()} 奖励 ${money} 元已记入待发放，可在 09:00 后自动入账。`,
    )
    return null
  }

  try {
    const balance = applyMoneyDeltaAllowed(money)
    markTierCredited(axis, tierLevel)
    const detail: RankUpgradeMoneyDetail = {
      axis,
      tierLevel,
      tierTitle,
      money,
      leaderboardRank,
      totalPlayers,
      balance,
    }
    dispatchRewardEvent(detail)
    showRankUpgradeToast(detail)
    return detail
  } catch (e) {
    if (e instanceof MoneySettlementBlockedError) {
      ElMessage.warning(moneyCurfewMessage())
      return null
    }
    throw e
  }
}

/**
 * 文武分变动后：对首次到达的品阶档位发放 20~100 元（按当前榜内名次）。
 * 相同档位不重复发放。
 */
export function processRankUpgradeMoneyBonus(
  prev: WenWuUserScores,
  next: WenWuUserScores,
): RankUpgradeMoneyDetail[] {
  const granted: RankUpgradeMoneyDetail[] = []

  for (const tierLevel of newlyReachedTierLevels(prev.wenScore, next.wenScore, 'wen')) {
    const d = grantTierUpgrade('wen', tierLevel)
    if (d) granted.push(d)
  }
  for (const tierLevel of newlyReachedTierLevels(prev.wuScore, next.wuScore, 'wu')) {
    const d = grantTierUpgrade('wu', tierLevel)
    if (d) granted.push(d)
  }

  granted.push(...flushPendingRankUpgradeMoney())

  return granted
}
