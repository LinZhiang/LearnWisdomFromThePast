import type { WorkTimeLog } from '@/db/models'
import { workTimeLogService } from '@/services/data-services'
import { loadWenWuUserScores, saveWenWuUserScores } from '@/views/learning/question-bank-score/wen-wu-user-scores'

/**
 * 已按「折算分」累计并发放过整小时奖励的基数（分钟，可为小数；出差按 1.15 倍计入）。
 * 与旧版 raw 分钟键分离，避免出差加权后基数不一致。
 */
const CREDITED_EFFECTIVE_KEY = 'work-time-wen-wu-bonus-credited-effective-v1'

const TRIP_MINUTES_MULTIPLIER = 1.15

const HOUR_MINUTES = 60
const WEN_PER_WORK_HOUR = 12
const WU_PER_WORK_HOUR = 14

/** 折算为「工作分」口径的分钟：出差 = 登记分钟 ×1.15，工作 = 登记分钟 ×1 */
function effectiveBonusMinutes(log: WorkTimeLog): number {
  const m = Number(log.minutes) || 0
  if (m <= 0) return 0
  return log.kind === 'trip' ? m * TRIP_MINUTES_MULTIPLIER : m
}

function totalEffectiveMinutes(logs: WorkTimeLog[]): number {
  return logs.reduce((s, r) => s + effectiveBonusMinutes(r), 0)
}

function loadCreditedEffective(): number {
  try {
    const n = Number(localStorage.getItem(CREDITED_EFFECTIVE_KEY) ?? '0')
    if (!Number.isFinite(n) || n < 0) return 0
    return n
  } catch {
    return 0
  }
}

function saveCreditedEffective(m: number): void {
  localStorage.setItem(CREDITED_EFFECTIVE_KEY, String(Math.max(0, m)))
}

/**
 * 根据全部工作/出差登记，将「折算分钟」累计后每满 1 小时：文 +12、武 +14。
 * 出差登记按 **工作分钟 ×1.15** 计入折算分；工作类型按原分钟数。
 * 登记删除或折算分回退时，会压低已发放基数，避免重复领奖。
 */
export async function applyWorkTimeLogWenWuBonus(): Promise<{ hours: number }> {
  const logs = await workTimeLogService.listAll()
  const totalEff = totalEffectiveMinutes(logs)

  let credited = loadCreditedEffective()
  if (totalEff + 1e-9 < credited) {
    credited = totalEff
    saveCreditedEffective(credited)
  }

  const delta = totalEff - credited
  const hours = Math.floor(delta / HOUR_MINUTES + 1e-9)
  if (hours < 1) return { hours: 0 }

  const creditedAdd = hours * HOUR_MINUTES
  saveCreditedEffective(credited + creditedAdd)

  const cur = loadWenWuUserScores()
  saveWenWuUserScores({
    ...cur,
    wenScore: cur.wenScore + hours * WEN_PER_WORK_HOUR,
    wuScore: cur.wuScore + hours * WU_PER_WORK_HOUR,
  })

  return { hours }
}
