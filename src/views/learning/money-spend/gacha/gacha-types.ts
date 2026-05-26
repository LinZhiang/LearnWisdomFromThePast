/** 抽奖券档位（与 hook.cardList[].rank 项一致） */
export type GachaCardTier = {
  name: string
  rank: number
  money: number
  percent: number
}

export type GachaDrawResult = {
  index: number
  tier: GachaCardTier
  rarityKey: 'A' | 'S' | 'SS' | 'SSS'
}
