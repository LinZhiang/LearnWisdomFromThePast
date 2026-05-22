import type { ExerciseTimeLog } from '@/db/models'
import { exerciseTimeLogService } from '@/services/data-services'
import { loadWenWuUserScores, saveWenWuUserScores } from '@/views/learning/question-bank-score/wen-wu-user-scores'

/** 已按「一般运动」分钟发放过奖励的基数（每满 30 分钟 +30 武） */
const CREDITED_GENERAL_MINUTES_KEY = 'exercise-time-wu-credited-general-v1'
/** 已按「剧烈运动」分钟发放过奖励的基数（每满 30 分钟 +90 武） */
const CREDITED_INTENSE_MINUTES_KEY = 'exercise-time-wu-credited-intense-v1'

const BLOCK_MINUTES = 30
const WU_PER_GENERAL_BLOCK = 30
const WU_PER_INTENSE_BLOCK = 90

function sumMinutes(logs: ExerciseTimeLog[], kind: ExerciseTimeLog['kind']): number {
  return logs.reduce((s, r) => s + (r.kind === kind ? Math.max(0, Math.round(Number(r.minutes) || 0)) : 0), 0)
}

function loadCredited(key: string): number {
  try {
    const n = Number(localStorage.getItem(key) ?? '0')
    if (!Number.isFinite(n) || n < 0) return 0
    return n
  } catch {
    return 0
  }
}

function saveCredited(key: string, m: number): void {
  localStorage.setItem(key, String(Math.max(0, m)))
}

/**
 * 根据全部锻炼登记：一般运动每满 30 分钟武分 +30；剧烈运动每满 30 分钟武分 +90。
 * 删除记录导致累计分钟回退时，会压低已发放基数，避免重复领奖。
 */
export async function applyExerciseTimeLogWuBonus(): Promise<{
  blocksGeneral: number
  blocksIntense: number
  wuFromGeneral: number
  wuFromIntense: number
}> {
  const logs = await exerciseTimeLogService.listAll()
  const totalGen = sumMinutes(logs, 'general')
  const totalInt = sumMinutes(logs, 'intense')

  let creditedGen = loadCredited(CREDITED_GENERAL_MINUTES_KEY)
  let creditedInt = loadCredited(CREDITED_INTENSE_MINUTES_KEY)

  if (totalGen + 1e-9 < creditedGen) {
    creditedGen = totalGen
    saveCredited(CREDITED_GENERAL_MINUTES_KEY, creditedGen)
  }
  if (totalInt + 1e-9 < creditedInt) {
    creditedInt = totalInt
    saveCredited(CREDITED_INTENSE_MINUTES_KEY, creditedInt)
  }

  const deltaGen = totalGen - creditedGen
  const blocksGen = Math.floor(deltaGen / BLOCK_MINUTES + 1e-9)
  const wuFromGen = blocksGen * WU_PER_GENERAL_BLOCK
  creditedGen += blocksGen * BLOCK_MINUTES

  const deltaInt = totalInt - creditedInt
  const blocksInt = Math.floor(deltaInt / BLOCK_MINUTES + 1e-9)
  const wuFromInt = blocksInt * WU_PER_INTENSE_BLOCK
  creditedInt += blocksInt * BLOCK_MINUTES

  saveCredited(CREDITED_GENERAL_MINUTES_KEY, creditedGen)
  saveCredited(CREDITED_INTENSE_MINUTES_KEY, creditedInt)

  const wuAdd = wuFromGen + wuFromInt
  if (wuAdd > 0) {
    const cur = loadWenWuUserScores()
    saveWenWuUserScores({ ...cur, wuScore: cur.wuScore + wuAdd })
  }

  return { blocksGeneral: blocksGen, blocksIntense: blocksInt, wuFromGeneral: wuFromGen, wuFromIntense: wuFromInt }
}
