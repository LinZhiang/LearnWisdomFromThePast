import type { GachaCardTier, GachaDrawResult } from './gacha-types'

export function rarityKeyFromRank(rank: number): GachaDrawResult['rarityKey'] {
  if (rank >= 4) return 'SSS'
  if (rank >= 3) return 'SS'
  if (rank >= 2) return 'S'
  return 'A'
}

function pickWeighted(tiers: GachaCardTier[], minRank = 1): GachaCardTier {
  const pool = tiers.filter((t) => t.rank >= minRank)
  const total = pool.reduce((sum, t) => sum + t.percent, 0)
  let roll = Math.random() * total
  for (const tier of pool) {
    roll -= tier.percent
    if (roll <= 0) return tier
  }
  return pool[pool.length - 1]!
}

/** 当日第几次十连抽（1~4）对应的第 10 张保底最低等级 */
export function ladderGuaranteedMinRank(dailyPullIndex: number): number {
  const n = Math.min(Math.max(1, Math.floor(dailyPullIndex)), 4)
  if (n >= 4) return 4
  if (n >= 3) return 3
  return 2
}

export function ladderGuaranteeText(dailyPullIndex: number): string {
  return `${ladderGuaranteedMinRank(dailyPullIndex)} 级或以上`
}

/** 10 连抽：前 9 张按概率；第 10 张按保底等级 */
export function drawTenPullWithGuarantee(
  tiers: GachaCardTier[],
  lastCardMinRank: number,
): GachaDrawResult[] {
  const results: GachaDrawResult[] = []
  for (let i = 0; i < 9; i++) {
    const tier = pickWeighted(tiers, 1)
    results.push({ index: i, tier, rarityKey: rarityKeyFromRank(tier.rank) })
  }
  const last = pickWeighted(tiers, lastCardMinRank)
  results.push({ index: 9, tier: last, rarityKey: rarityKeyFromRank(last.rank) })
  return results
}

/** 普通/豪华券：第 10 张保底 2 级及以上 */
export function drawTenPull(tiers: GachaCardTier[]): GachaDrawResult[] {
  return drawTenPullWithGuarantee(tiers, 2)
}

/**
 * 阶梯券：按当日第几次抽奖提升第 10 张保底
 * 第 1~2 次 → 2 级+；第 3 次 → 3 级+；第 4 次 → 4 级+
 */
export function drawLadderTenPull(
  tiers: GachaCardTier[],
  dailyPullIndex: number,
): GachaDrawResult[] {
  return drawTenPullWithGuarantee(tiers, ladderGuaranteedMinRank(dailyPullIndex))
}
