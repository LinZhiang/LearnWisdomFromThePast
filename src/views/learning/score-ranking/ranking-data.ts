import { fixedPlayers } from '@/views/learning/question-bank-score/hook'
import { loadWenWuUserScores } from '@/views/learning/question-bank-score/wen-wu-user-scores'

export type RankRow = {
  name: string
  wenScore: number
  wuScore: number
  isSelf?: boolean
  isFixed?: boolean
  isRandom?: boolean
}

const N_LOW = 15 /** 500×3% */
const N_HIGH = 5 /** 500×1% */
const N_MID = 500 - N_LOW - N_HIGH /** 86% */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffleInPlace<T>(a: T[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]!
    a[i] = a[j]!
    a[j] = t
  }
}

/** 恰好 3% 低、86% 中、1% 高，顺序随机打散 */
function makeBuckets500(): ('low' | 'mid' | 'high')[] {
  const a: ('low' | 'mid' | 'high')[] = []
  for (let i = 0; i < N_LOW; i++) a.push('low')
  for (let i = 0; i < N_HIGH; i++) a.push('high')
  for (let i = 0; i < N_MID; i++) a.push('mid')
  shuffleInPlace(a)
  return a
}

/** 中段 0~10000：幂分布，分越高越稀少，高分段约 2~3‰ 量级接近上限 */
function sampleMidScore(): number {
  const skew = 7
  return Math.min(10000, Math.floor(Math.pow(Math.random(), skew) * 10001))
}

/** 高段 10000~34999：幂分布，接近 35000 极稀少 */
function sampleHighScoreBelowCap(): number {
  const skew = 10
  return 10000 + Math.min(24999, Math.floor(Math.pow(Math.random(), skew) * 25000))
}

function sampleLowScore(): number {
  return randomInt(-1500, 0)
}

function sampleScoreInBucket(b: 'low' | 'mid' | 'high'): number {
  if (b === 'low') return sampleLowScore()
  if (b === 'high') return sampleHighScoreBelowCap()
  return sampleMidScore()
}

const MID_CAP = 10000
const DEDUPE_BAND_MAX = 8000

/**
 * 随机选手在 [0, DEDUPE_BAND_MAX] 内该维度分数互不相同。
 * 已占用：所有随机选手该维度上 <0 或 >8000 的分数（含高段、35000 等），避免挤占后与其它行冲突。
 */
function dedupeRandomScores0To8000(rows: RankRow[], key: 'wenScore' | 'wuScore'): void {
  const used = new Set<number>()
  for (const r of rows) {
    if (!r.isRandom) continue
    const v = r[key]
    if (v < 0 || v > DEDUPE_BAND_MAX) used.add(v)
  }
  const inBand = rows.filter((r) => r.isRandom && r[key] >= 0 && r[key] <= DEDUPE_BAND_MAX)
  inBand.sort((a, b) => a[key] - b[key] || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  for (const r of inBand) {
    let s = r[key]
    while (s <= DEDUPE_BAND_MAX && used.has(s)) s += 1
    if (s > DEDUPE_BAND_MAX) {
      s = DEDUPE_BAND_MAX + 1
      while (s <= MID_CAP && used.has(s)) s += 1
    }
    if (s > MID_CAP) {
      s = MID_CAP + 1
      while (used.has(s)) s += 1
    }
    r[key] = s
    used.add(s)
  }
}

const SURNAMES = [
  '王',
  '李',
  '张',
  '刘',
  '陈',
  '杨',
  '黄',
  '赵',
  '吴',
  '周',
  '徐',
  '孙',
  '马',
  '朱',
  '胡',
  '郭',
  '何',
  '高',
  '林',
  '罗',
  '郑',
  '梁',
  '谢',
  '宋',
  '唐',
  '许',
  '韩',
  '冯',
  '邓',
  '曹',
  '彭',
  '曾',
  '肖',
  '田',
  '董',
  '袁',
  '潘',
  '于',
  '蒋',
  '蔡',
  '余',
  '杜',
  '叶',
  '程',
  '苏',
  '魏',
  '吕',
  '丁',
  '任',
  '沈',
]

const GIVEN1 = [
  '伟',
  '芳',
  '娜',
  '敏',
  '静',
  '丽',
  '强',
  '磊',
  '军',
  '洋',
  '勇',
  '艳',
  '杰',
  '娟',
  '涛',
  '明',
  '超',
  '秀英',
  '霞',
  '平',
  '刚',
  '桂英',
  '辉',
  '鹏',
  '华',
  '飞',
  '波',
  '斌',
  '浩',
  '宇',
  '欣',
  '怡',
  '婷',
  '琳',
  '颖',
  '慧',
  '洁',
  '雪',
  '蕾',
  '晨',
  '博',
  '文',
  '武',
  '峰',
  '建',
  '红',
  '梅',
  '兰',
  '竹',
  '菊',
  '松',
  '柏',
  '海',
  '江',
  '河',
  '山',
  '川',
  '云',
  '风',
  '雷',
  '星',
  '月',
  '阳',
  '龙',
  '虎',
  '凤',
  '麒麟',
]

const GIVEN2 = [
  '',
  '之',
  '子',
  '公',
  '卿',
  '安',
  '宁',
  '远',
  '思',
  '行',
  '德',
  '义',
  '礼',
  '智',
  '信',
  '元',
  '仲',
  '季',
  '伯',
]

function randomChineseName(exclude: Set<string>): string {
  for (let k = 0; k < 80; k++) {
    const sn = SURNAMES[randomInt(0, SURNAMES.length - 1)]!
    const a = GIVEN1[randomInt(0, GIVEN1.length - 1)]!
    const b = GIVEN2[randomInt(0, GIVEN2.length - 1)]!
    const name = b ? `${sn}${a}${b}` : `${sn}${a}`
    if (!exclude.has(name)) {
      exclude.add(name)
      return name
    }
  }
  let i = 0
  while (true) {
    const name = `路人${++i}`
    if (!exclude.has(name)) {
      exclude.add(name)
      return name
    }
  }
}

/** 生成 500 名随机选手；文、武各自分层 3% / 86% / 1%，并各在高段桶内指定一人为 35000 */
export function generateRandomPlayers(excludeNames: Set<string>): RankRow[] {
  const count = 500
  const bucketsWen = makeBuckets500()
  const bucketsWu = makeBuckets500()
  const rows: RankRow[] = []
  for (let i = 0; i < count; i++) {
    rows.push({
      name: randomChineseName(excludeNames),
      wenScore: sampleScoreInBucket(bucketsWen[i]!),
      wuScore: sampleScoreInBucket(bucketsWu[i]!),
      isRandom: true,
    })
  }

  const highWenIdx = bucketsWen.map((b, i) => (b === 'high' ? i : -1)).filter((i) => i >= 0)
  const highWuIdx = bucketsWu.map((b, i) => (b === 'high' ? i : -1)).filter((i) => i >= 0)
  if (highWenIdx.length) {
    rows[highWenIdx[randomInt(0, highWenIdx.length - 1)]!]!.wenScore = 35000
  }
  if (highWuIdx.length) {
    rows[highWuIdx[randomInt(0, highWuIdx.length - 1)]!]!.wuScore = 35000
  }

  dedupeRandomScores0To8000(rows, 'wenScore')
  dedupeRandomScores0To8000(rows, 'wuScore')

  return rows
}

function assignRanks(sorted: RankRow[], key: 'wenScore' | 'wuScore'): (RankRow & { rank: number })[] {
  const out: (RankRow & { rank: number })[] = []
  let rank = 0
  let prev: number | null = null
  let pos = 0
  for (const row of sorted) {
    pos += 1
    const v = row[key]
    if (prev === null || v !== prev) {
      rank = pos
      prev = v
    }
    out.push({ ...row, rank })
  }
  return out
}

/** 合并随机人、固定名单、当前用户，并生成文榜 / 武榜（按分降序） */
export function buildWenWuRankings(): {
  wenTable: (RankRow & { rank: number })[]
  wuTable: (RankRow & { rank: number })[]
} {
  const exclude = new Set<string>()
  for (const p of fixedPlayers) {
    exclude.add(p.name)
  }
  exclude.add('我')

  const randomRows = generateRandomPlayers(exclude)

  const fixedRows: RankRow[] = fixedPlayers.map((p) => ({
    name: p.name,
    wenScore: p.wenScore,
    wuScore: p.wuScore,
    isFixed: true,
  }))

  const user = loadWenWuUserScores()
  const selfRow: RankRow = {
    name: '我',
    wenScore: user.wenScore,
    wuScore: user.wuScore,
    isSelf: true,
  }

  const all = [...randomRows, ...fixedRows, selfRow]

  const byWen = [...all].sort((a, b) => b.wenScore - a.wenScore || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  const byWu = [...all].sort((a, b) => b.wuScore - a.wuScore || a.name.localeCompare(b.name, 'zh-Hans-CN'))

  return {
    wenTable: assignRanks(byWen, 'wenScore'),
    wuTable: assignRanks(byWu, 'wuScore'),
  }
}
