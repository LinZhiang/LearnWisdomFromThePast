/** 将秒数格式化为中文可读时长 */
export function formatSecondsAsZh(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const sec = s % 60
  const m = Math.floor(s / 60) % 60
  const h = Math.floor(s / 3600)
  if (h > 0) {
    return `${h}小时${String(m).padStart(2, '0')}分${String(sec).padStart(2, '0')}秒`
  }
  if (m > 0) {
    return `${m}分${String(sec).padStart(2, '0')}秒`
  }
  return `${sec}秒`
}

/** 登记时长（小时）：最小 0.5，步长 0.5，最大 24 */
export const DURATION_HOURS_MIN = 0.5
export const DURATION_HOURS_MAX = 24
export const DURATION_HOURS_STEP = 0.5

/** 校验小时数是否为 0.5 的整数倍且在合法范围内 */
export function parseDurationHours(value: number | undefined): number | null {
  const h = Number(value)
  if (!Number.isFinite(h) || h < DURATION_HOURS_MIN || h > DURATION_HOURS_MAX) return null
  const halfSteps = Math.round(h * 2)
  if (Math.abs(h * 2 - halfSteps) > 1e-6) return null
  return halfSteps / 2
}

/** 小时 → 入库分钟（0.5 小时 = 30 分钟） */
export function durationHoursToMinutes(hours: number): number {
  return Math.round(hours * 60)
}

/** 将分钟格式化为「X小时Y分」或「Y分」 */
export function formatMinutesAsZh(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const r = m % 60
    return r > 0 ? `${h}小时${r}分` : `${h}小时`
  }
  return `${m}分钟`
}
