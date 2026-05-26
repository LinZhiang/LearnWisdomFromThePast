/** 版本号变更会作废旧 localStorage 缓存（避免截断响应等脏数据长期命中） */
const CACHE_PREFIX = 'wengu-ai-cache-v2:'
const INDEX_KEY = `${CACHE_PREFIX}__index__`
const MAX_ENTRIES = 180

type CacheEntry = {
  v: unknown
  at: number
}

const inflight = new Map<string, Promise<unknown>>()

/** 轻量字符串哈希，用于缓存键（非加密） */
export function hashForAiCache(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : []
  } catch {
    return []
  }
}

function writeIndex(keys: string[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(keys.slice(0, MAX_ENTRIES)))
  } catch {
    /* quota */
  }
}

function touchIndexKey(key: string) {
  const keys = readIndex().filter((k) => k !== key)
  keys.unshift(key)
  writeIndex(keys)
}

function evictOverflow() {
  const keys = readIndex()
  while (keys.length > MAX_ENTRIES) {
    const drop = keys.pop()
    if (drop) {
      try {
        localStorage.removeItem(`${CACHE_PREFIX}${drop}`)
      } catch {
        /* ignore */
      }
    }
  }
  writeIndex(keys)
}

function readEntry(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (!parsed || typeof parsed !== 'object' || !('v' in parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function writeEntry(key: string, value: unknown) {
  try {
    const entry: CacheEntry = { v: value, at: Date.now() }
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry))
    touchIndexKey(key)
    evictOverflow()
  } catch {
    /* quota — 静默跳过，不影响主流程 */
  }
}

/**
 * 本地缓存 AI 响应：相同 key 不重复请求；并发同 key 合并为一次请求。
 */
export async function rememberAiResponse<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = readEntry(key)
  if (cached) return cached.v as T

  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const task = (async () => {
    try {
      const value = await fetcher()
      writeEntry(key, value)
      return value
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, task)
  return task
}

export function buildQuestionBankAiCacheKey(
  kind: 'choice-distractors' | 'mindmap-mcqs',
  questionId: number | undefined,
  fingerprint: string,
): string {
  const idPart = questionId != null && questionId > 0 ? String(questionId) : 'no-id'
  return `${kind}:${idPart}:${hashForAiCache(fingerprint)}`
}
