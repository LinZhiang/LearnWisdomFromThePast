import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = path.join(__dirname, 'logs')
const LOG_FILE = path.join(LOG_DIR, 'ai-requests.log')
const MAX_LINES = 400

function trimLogFile() {
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    if (lines.length <= MAX_LINES) return
    fs.writeFileSync(LOG_FILE, `${lines.slice(-MAX_LINES).join('\n')}\n`, 'utf8')
  } catch {
    /* ignore */
  }
}

/** 追加一条 AI 请求记录（JSON Lines，供 npm run check:ai 汇总） */
export function appendAiRequestLog(entry) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    const line = `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`
    fs.appendFileSync(LOG_FILE, line, 'utf8')
    trimLogFile()
  } catch {
    /* ignore */
  }
}

export function readRecentAiRequestLogs(limit = 50) {
  try {
    if (!fs.existsSync(LOG_FILE)) return []
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean)
    return lines
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function summarizeRecentLogs(recent) {
  const byModel = {}
  const bySource = {}
  let totalTokens = 0
  let errorCount = 0
  for (const row of recent) {
    const model = String(row.model ?? '(unset)')
    const source = String(row.source ?? 'unknown')
    byModel[model] = (byModel[model] ?? 0) + 1
    bySource[source] = (bySource[source] ?? 0) + 1
    if (typeof row.totalTokens === 'number') totalTokens += row.totalTokens
    if (row.ok === false || (row.status != null && row.status >= 400)) errorCount += 1
  }
  return { byModel, bySource, totalTokens, errorCount }
}
