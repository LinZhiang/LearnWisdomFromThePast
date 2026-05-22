const STORAGE_KEY = 'wen-wu-user-scores-v1'

/** 任意写入文武分后派发，供界面同步刷新 */
export const WEN_WU_SCORES_CHANGED_EVENT = 'wen-wu-user-scores-changed'

export type WenWuUserScores = {
  wenScore: number
  wuScore: number
  /** 本机累计金钱数，默认 0 */
  money: number
}

const defaultScores = (): WenWuUserScores => ({ wenScore: 0, wuScore: 0, money: 0 })

export function loadWenWuUserScores(): WenWuUserScores {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultScores()
    const o = JSON.parse(raw) as Partial<WenWuUserScores>
    const wen = Number(o.wenScore)
    const wu = Number(o.wuScore)
    const money = Number(o.money)
    return {
      wenScore: Number.isFinite(wen) ? wen : 0,
      wuScore: Number.isFinite(wu) ? wu : 0,
      money: Number.isFinite(money) ? money : 0,
    }
  } catch {
    return defaultScores()
  }
}

export function saveWenWuUserScores(scores: WenWuUserScores): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WEN_WU_SCORES_CHANGED_EVENT))
  }
}
