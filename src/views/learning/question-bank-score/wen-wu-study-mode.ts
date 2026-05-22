import { localDateKey } from '@/services/daily-web-usage'
import { loadWenWuUserScores, saveWenWuUserScores } from './wen-wu-user-scores'

export type StudyMode = 'studying' | 'relaxing'

const MODE_KEY = 'wen-wu-study-mode-v1'
/** 「学习中」模式下，上次执行文/武日扣的日期 */
const LAST_STUDYING_DEDUCT_KEY = 'wen-wu-last-studying-deduct-v1'
/** 「放松中」模式下，上次执行武分日扣的日期 */
const LAST_RELAXING_DEDUCT_KEY = 'wen-wu-last-relaxing-deduct-v1'

const STUDYING_WEN_DAILY = 100
const STUDYING_WU_DAILY = 100
const RELAXING_WU_DAILY = 80

export function loadStudyMode(): StudyMode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    return v === 'relaxing' ? 'relaxing' : 'studying'
  } catch {
    return 'studying'
  }
}

export function saveStudyMode(mode: StudyMode): void {
  localStorage.setItem(MODE_KEY, mode)
}

function lastStudyingDeductDate(): string | null {
  try {
    return localStorage.getItem(LAST_STUDYING_DEDUCT_KEY)
  } catch {
    return null
  }
}

function setLastStudyingDeductDate(dk: string): void {
  localStorage.setItem(LAST_STUDYING_DEDUCT_KEY, dk)
}

function lastRelaxingDeductDate(): string | null {
  try {
    return localStorage.getItem(LAST_RELAXING_DEDUCT_KEY)
  } catch {
    return null
  }
}

function setLastRelaxingDeductDate(dk: string): void {
  localStorage.setItem(LAST_RELAXING_DEDUCT_KEY, dk)
}

/**
 * 按当前学习模式执行「该模式下当日尚未执行过」的日扣：
 * - **学习中**：文 -100、武 -100（每自然日在该模式下最多一次）
 * - **放松中**：文不扣，武 -80（每自然日在该模式下最多一次）
 *
 * 学习与放松各记一条「上次在该模式下扣款」的日期；同一天内若切换模式，两种扣款规则可能各触发一次。
 */
export function applyDailyStudyingPenaltyIfNeeded(): void {
  const today = localDateKey()
  const mode = loadStudyMode()
  const s = loadWenWuUserScores()
  let { wenScore, wuScore } = s
  let changed = false

  if (mode === 'studying') {
    if (lastStudyingDeductDate() !== today) {
      wenScore -= STUDYING_WEN_DAILY
      wuScore -= STUDYING_WU_DAILY
      setLastStudyingDeductDate(today)
      changed = true
    }
  } else if (lastRelaxingDeductDate() !== today) {
    wuScore -= RELAXING_WU_DAILY
    setLastRelaxingDeductDate(today)
    changed = true
  }

  if (changed) {
    saveWenWuUserScores({ ...s, wenScore, wuScore })
  }
}
