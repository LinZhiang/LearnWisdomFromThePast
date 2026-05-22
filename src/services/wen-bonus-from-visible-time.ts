import { loadWenWuUserScores, saveWenWuUserScores } from '@/views/learning/question-bank-score/wen-wu-user-scores'

/** 未满半个钟头、暂存待凑整的可见前台秒数 */
const BANK_KEY = 'wen-bonus-visible-seconds-bank-v1'

const HALF_HOUR_SEC = 30 * 60
const WEN_PER_HALF_HOUR = 20

function loadBank(): number {
  try {
    const raw = localStorage.getItem(BANK_KEY)
    const n = raw == null ? 0 : Number(raw)
    if (!Number.isFinite(n) || n < 0) return 0
    return ((Math.floor(n) % HALF_HOUR_SEC) + HALF_HOUR_SEC) % HALF_HOUR_SEC
  } catch {
    return 0
  }
}

function saveBank(sec: number): void {
  const s = Math.max(0, Math.min(sec, HALF_HOUR_SEC - 1))
  localStorage.setItem(BANK_KEY, String(Math.floor(s)))
}

/**
 * 根据本日「网页前台可见」累计的增量秒数，每满 30 分钟为文分 +20（余数滚入下次）。
 * 与 `useWebUsageTracker` 写入 `bumpDailyActiveSeconds` 的时段应对齐，在同一处传入相同 delta 调用即可。
 */
export function applyWenBonusForVisibleSeconds(deltaSeconds: number): void {
  const sec = Math.floor(deltaSeconds)
  if (sec < 1) return

  let bank = loadBank() + sec
  const grants = Math.floor(bank / HALF_HOUR_SEC)
  bank %= HALF_HOUR_SEC
  saveBank(bank)

  if (grants < 1) return

  const cur = loadWenWuUserScores()
  saveWenWuUserScores({
    ...cur,
    wenScore: cur.wenScore + grants * WEN_PER_HALF_HOUR,
    wuScore: cur.wuScore,
  })
}
