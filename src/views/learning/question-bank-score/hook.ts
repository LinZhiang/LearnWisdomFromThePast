import { ref } from 'vue'
import type { RankTier } from './rank-data'
import { RANK_LIST } from './rank-data'

export const rankList = ref<RankTier[]>([...RANK_LIST])

type Player = {
  name: string
  wenScore: number
  wuScore: number
  wenTitle: string
  wuTitle: string
  isSelf?: boolean
  isFixed?: boolean
}

export const fixedPlayers: Array<Pick<Player, 'name' | 'wenScore' | 'wuScore'>> = [
  { name: '刘恒', wenScore: 100000, wuScore: 50000 },
  { name: '刘彻', wenScore: 50000, wuScore: 100000 },
  { name: '诸葛亮', wenScore: 48000, wuScore: 42000 },
  { name: '姜维', wenScore: 27000, wuScore: 41000 },
  { name: '钟繇', wenScore: 39000, wuScore: 27000 },
  { name: '华歆', wenScore: 36000, wuScore: 21000 },
  { name: '王朗', wenScore: 35000, wuScore: 20000 },
  { name: '甘宁', wenScore: 7000, wuScore: 11000 },
  { name: '赵云', wenScore: 10000, wuScore: 20000 },
  { name: '关羽', wenScore: 11000, wuScore: 23900 },
  { name: '马超', wenScore: 10500, wuScore: 23700 },
  { name: '陆逊', wenScore: 45000, wuScore: 45000 },
  { name: '孔融', wenScore: 24000, wuScore: 5000 },
  { name: '许褚', wenScore: 1500, wuScore: 10000 },
  { name: '朱治', wenScore: 8900, wuScore: 10000 },
  { name: '法正', wenScore: 19000, wuScore: 11000 },
]

