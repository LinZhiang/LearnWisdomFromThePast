import { db } from '@/db'
import type { DailyWebUsage } from '@/db/models'

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function bumpDailyActiveSeconds(dateKey: string, deltaSeconds: number): Promise<void> {
  const sec = Math.round(deltaSeconds)
  if (sec <= 0) return
  const now = new Date().toISOString()
  const row = await db.dailyWebUsage.where('dateKey').equals(dateKey).first()
  if (row?.id != null) {
    const prev = Number(row.activeSeconds) || 0
    await db.dailyWebUsage.update(row.id, {
      activeSeconds: Math.max(0, prev + sec),
      updatedAt: now,
    })
  } else {
    await db.dailyWebUsage.add({
      dateKey,
      activeSeconds: sec,
      updatedAt: now,
    })
  }
}

export async function getDailyUsageByDateKey(dateKey: string): Promise<DailyWebUsage | undefined> {
  return db.dailyWebUsage.where('dateKey').equals(dateKey).first()
}

export async function listDailyUsageNewestFirst(): Promise<DailyWebUsage[]> {
  const rows = await db.dailyWebUsage.toArray()
  return rows.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0))
}
