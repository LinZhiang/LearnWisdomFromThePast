const STORAGE_KEY = 'wen-wu-gacha-daily-v1'

type GachaDailyStore = {
  date: string
  byTicket: Record<string, number>
}

function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function loadStore(): GachaDailyStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { date: localDateKey(), byTicket: {} }
    const o = JSON.parse(raw) as Partial<GachaDailyStore>
    const today = localDateKey()
    if (o.date !== today) return { date: today, byTicket: {} }
    return {
      date: today,
      byTicket: typeof o.byTicket === 'object' && o.byTicket ? { ...o.byTicket } : {},
    }
  } catch {
    return { date: localDateKey(), byTicket: {} }
  }
}

function saveStore(store: GachaDailyStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/** 今日该券已抽次数（每次 10 连抽计 1 次） */
export function getGachaUsesToday(ticketName: string): number {
  const store = loadStore()
  return store.byTicket[ticketName] ?? 0
}

export function getGachaRemainingToday(ticketName: string, timeLimit: number): number {
  return Math.max(0, timeLimit - getGachaUsesToday(ticketName))
}

export function incrementGachaUse(ticketName: string): void {
  const store = loadStore()
  store.byTicket[ticketName] = (store.byTicket[ticketName] ?? 0) + 1
  saveStore(store)
}
