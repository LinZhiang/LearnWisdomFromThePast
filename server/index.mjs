/**
 * 温故智学网 — DeepSeek 转发服务（密钥仅在此进程内，不进入前端构建）
 */
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  appendAiRequestLog,
  readRecentAiRequestLogs,
  summarizeRecentLogs,
} from './ai-request-log.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(__dirname, '.env')

dotenv.config({ path: envFile })

if (!fs.existsSync(envFile)) {
  // eslint-disable-next-line no-console
  console.warn(
    '[wengu-ai-proxy] 未找到 server/.env。请执行：复制 server/.env.example 为 server/.env，再在 .env 里填写 DEEPSEEK_API_KEY（不要只改 .env.example，该文件不会被读取）。',
  )
}

const PORT = Number(process.env.PORT || 8787)
const DEEPSEEK_KEY = (process.env.DEEPSEEK_API_KEY || '').trim()
const UPSTREAM = (process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '')
/** 设为 1 才允许转发 deepseek-v4-pro / reasoner（默认降为 flash，避免误扣费） */
const ALLOW_PRO_MODEL = String(process.env.WENGU_ALLOW_PRO_MODEL ?? '').trim() === '1'
const FLASH_FALLBACK = 'deepseek-v4-flash'
const WENGU_APP_SOURCE = 'wengu-learning-app'

function normalizeOutboundModel(model, source) {
  const m = String(model ?? '').trim()
  if (!m || ALLOW_PRO_MODEL) return m || FLASH_FALLBACK
  if (source !== WENGU_APP_SOURCE) return m || FLASH_FALLBACK
  if (/v4-pro/i.test(m) || /^deepseek-reasoner$/i.test(m)) {
    // eslint-disable-next-line no-console
    console.warn(`[wengu-ai-proxy] 已禁止 Pro：${m} → ${FLASH_FALLBACK}（source=${source}）`)
    return FLASH_FALLBACK
  }
  return m
}

/** 逗号分隔的前端源，如 https://a.com,https://b.com；不填则反射请求 Origin（仅适合开发） */
const CORS_ORIGIN_RAW = (process.env.CORS_ORIGIN || '').trim()

const app = express()
app.disable('x-powered-by')

const corsMiddleware =
  CORS_ORIGIN_RAW ?
    cors({
      origin: CORS_ORIGIN_RAW.split(',').map((s) => s.trim()).filter(Boolean),
      credentials: false,
    })
  : cors({ origin: true })

app.use(corsMiddleware)
app.use(express.json({ limit: '32mb' }))

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(DEEPSEEK_KEY),
    upstream: UPSTREAM,
  })
})

/** 最近 AI 请求汇总（供 npm run check:ai / 助手排查，不含密钥） */
app.get('/status/summary', (_req, res) => {
  const recent = readRecentAiRequestLogs(50)
  const summary = summarizeRecentLogs(recent)
  res.json({
    ok: true,
    hasApiKey: Boolean(DEEPSEEK_KEY),
    upstream: UPSTREAM,
    port: PORT,
    recentCount: recent.length,
    lastRequestAt: recent.at(-1)?.at ?? null,
    ...summary,
    recent: recent.slice(-10),
  })
})

app.post('/v1/chat/completions', async (req, res) => {
  if (!DEEPSEEK_KEY) {
    res.status(503).json({
      error: {
        message: '服务端未配置 DEEPSEEK_API_KEY，请查看 docs/ENV-说明.md',
        type: 'proxy_config',
      },
    })
    return
  }

  const body = { ...(req.body ?? {}) }
  const source = String(req.headers['x-wengu-ai-source'] ?? 'unknown').slice(0, 64)
  const requestedModel = String(body.model ?? '(unset)').slice(0, 64)
  const model = normalizeOutboundModel(body.model, source)
  body.model = model
  // eslint-disable-next-line no-console
  console.log(
    `[wengu-ai-proxy] model=${model}${requestedModel !== model ? ` (was ${requestedModel})` : ''} source=${source}`,
  )

  let upstreamStatus = 0
  let usage = null

  try {
    const upstreamRes = await fetch(`${UPSTREAM}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify(body),
    })

    upstreamStatus = upstreamRes.status
    const ct = upstreamRes.headers.get('content-type') || 'application/json'
    const buf = Buffer.from(await upstreamRes.arrayBuffer())

    if (ct.includes('json')) {
      try {
        const parsed = JSON.parse(buf.toString('utf8'))
        usage = parsed.usage ?? null
      } catch {
        /* ignore */
      }
    }

    appendAiRequestLog({
      model,
      source,
      status: upstreamStatus,
      ok: upstreamStatus >= 200 && upstreamStatus < 300,
      promptTokens: usage?.prompt_tokens ?? null,
      completionTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
    })

    res.status(upstreamRes.status).type(ct).send(buf)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'upstream fetch failed'
    appendAiRequestLog({
      model,
      source,
      status: 502,
      ok: false,
      error: msg,
    })
    // eslint-disable-next-line no-console
    console.error('[wengu-ai-proxy] 访问上游失败（常见原因：本机网络/DNS、未开代理、或 DeepSeek 地址不可达）:', e)
    res.status(502).json({
      error: {
        message: `AI 代理转发失败：${msg}`,
        type: 'proxy_fetch',
        hint: '请确认已创建 server/.env（非 .env.example）且已启动本服务；若在中国大陆网络，请检查访问 api.deepseek.com 是否正常。',
      },
    })
  }
})

const httpServer = app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[wengu-ai-proxy] http://0.0.0.0:${PORT}  →  ${UPSTREAM}/chat/completions`)
  if (!DEEPSEEK_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[wengu-ai-proxy] 警告：未读取到 DEEPSEEK_API_KEY，请在 server/.env 中配置')
  }
})

httpServer.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(
      `[wengu-ai-proxy] 端口 ${PORT} 已被占用（常见：上次 dev:api 未退出，或我排查时启动的代理仍在运行）。\n` +
        `  解决：关闭占用该端口的进程后重试 npm run dev:all；Windows 可在 PowerShell 执行：\n` +
        `  Get-NetTCPConnection -LocalPort ${PORT} | Select OwningProcess\n` +
        `  Stop-Process -Id <进程ID> -Force`,
    )
    process.exit(1)
  }
  throw err
})
