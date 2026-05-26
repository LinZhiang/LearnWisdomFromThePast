import face002 from '@/assets/texture2D/Face_002.png'
import forestArena from '@/assets/texture2D/Forest_Arena.png'
import forestRedMorning from '@/assets/texture2D/Forest_Red_Morning.png'
import forestSpiritBattleField from '@/assets/texture2D/Forest_Spirit_BattleField.png'
import gymFrontNoon from '@/assets/texture2D/Gym_Front_Noon.png'
import hitoyo from '@/assets/texture2D/HitoyoIcon.png'
import inatsume from '@/assets/texture2D/INatsumeIcon.png'
import yshirakawa from '@/assets/texture2D/YShirakawaIcon.png'
import type { GachaDrawResult } from './gacha-types'

const PORTRAIT_BY_RARITY: Record<GachaDrawResult['rarityKey'], string> = {
  A: hitoyo,
  S: inatsume,
  SS: yshirakawa,
  SSS: face002,
}

const BG_BY_RARITY: Record<GachaDrawResult['rarityKey'], string> = {
  A: gymFrontNoon,
  S: forestSpiritBattleField,
  SS: forestRedMorning,
  SSS: forestArena,
}

export function portraitForRarity(key: GachaDrawResult['rarityKey']): string {
  return PORTRAIT_BY_RARITY[key]
}

export function backgroundForRarity(key: GachaDrawResult['rarityKey']): string {
  return BG_BY_RARITY[key]
}

/**
 * 方形 Icon：按高度撑满；横图 Face_002：同样按高度 + maxWidth 做 contain，需配合更宽的立绘区
 */
export type PortraitDisplay = {
  heightPercent: number
  maxWidth: string
  scale: number
  objectPosition: string
}

const PORTRAIT_DISPLAY: Record<GachaDrawResult['rarityKey'], PortraitDisplay> = {
  A: {
    heightPercent: 100,
    maxWidth: '100%',
    scale: 1,
    objectPosition: 'bottom center',
  },
  S: {
    heightPercent: 100,
    maxWidth: '100%',
    scale: 1,
    objectPosition: 'bottom center',
  },
  SS: {
    heightPercent: 104,
    maxWidth: '100%',
    scale: 1.05,
    objectPosition: 'bottom center',
  },
  SSS: {
    heightPercent: 102,
    maxWidth: '100%',
    scale: 1,
    objectPosition: 'bottom center',
  },
}

export function portraitDisplayForRarity(key: GachaDrawResult['rarityKey']): PortraitDisplay {
  return PORTRAIT_DISPLAY[key]
}
