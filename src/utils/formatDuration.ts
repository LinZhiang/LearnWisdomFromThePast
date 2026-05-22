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
