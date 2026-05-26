export function formatMoneyDelta(value: number): string {
  if (value > 0) return `+${value}`
  return String(value)
}

export function moneyDeltaClass(value: number): string {
  if (value > 0) return 'money-delta--gain'
  if (value < 0) return 'money-delta--loss'
  return 'money-delta--zero'
}
