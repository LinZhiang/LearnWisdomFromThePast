/**
 * AI 代理一键体检：npm run check:ai
 * 下次在 Cursor 里说「看看 AI 代理情况」即可让助手运行本脚本。
 */
const PROXY_BASE = (process.env.AI_PROXY_BASE || 'http://127.0.0.1:8787').replace(/\/$/, '')

function fmtTime(iso) {
  if (!iso) return '（尚无记录）'
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function printSection(title) {
  console.log('')
  console.log(`── ${title} ──`)
}

async function fetchJson(url, options) {
  const res = await fetch(url, options)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text.slice(0, 200) }
  }
  return { ok: res.ok, status: res.status, data }
}

async function main() {
  console.log('温故智学网 · AI 代理体检')
  console.log(`探测地址：${PROXY_BASE}`)

  printSection('1. 服务是否在线')
  let health
  try {
    health = await fetchJson(`${PROXY_BASE}/health`)
  } catch (e) {
    console.log('❌ 无法连接代理（请先 npm run dev:all 或 npm run dev:api）')
    console.log(`   ${e instanceof Error ? e.message : e}`)
    process.exit(1)
  }

  if (!health.ok) {
    console.log(`❌ /health 返回 HTTP ${health.status}`)
    process.exit(1)
  }

  const h = health.data
  console.log(`✅ 代理在线`)
  console.log(`   API Key 已配置：${h.hasApiKey ? '是' : '否（请检查 server/.env）'}`)
  console.log(`   上游：${h.upstream ?? '—'}`)

  printSection('2. 最近请求汇总（最多 50 条）')
  let summary
  try {
    summary = await fetchJson(`${PROXY_BASE}/status/summary`)
  } catch (e) {
    console.log(`⚠️ 无法读取 /status/summary（代理可能是旧版本，需重启 dev:api）`)
    console.log(`   ${e instanceof Error ? e.message : e}`)
    process.exit(0)
  }

  if (!summary.ok) {
    console.log(`⚠️ /status/summary 不可用 (HTTP ${summary.status})，请重启 AI 代理后重试`)
    process.exit(0)
  }

  const s = summary.data
  console.log(`   最近记录条数：${s.recentCount ?? 0}`)
  console.log(`   最后一次请求：${fmtTime(s.lastRequestAt)}`)
  console.log(`   近 50 次合计 tokens：${s.totalTokens ?? 0}`)
  console.log(`   失败次数：${s.errorCount ?? 0}`)

  const byModel = s.byModel ?? {}
  const modelKeys = Object.keys(byModel)
  if (modelKeys.length === 0) {
    console.log('   按模型：尚无请求（用过 App 内 AI 功能后会有记录）')
  } else {
    console.log('   按模型（次数）：')
    for (const k of modelKeys.sort()) {
      console.log(`     · ${k}：${byModel[k]} 次`)
    }
  }

  const bySource = s.bySource ?? {}
  const sourceKeys = Object.keys(bySource)
  if (sourceKeys.length === 0) {
    console.log('   按来源：尚无请求')
  } else {
    console.log('   按来源（次数）：')
    for (const k of sourceKeys.sort()) {
      const tag = k === 'wengu-learning-app' ? ' ← 本学习 App' : k === 'unknown' ? ' ← 非 App（可能是手动测试）' : ''
      console.log(`     · ${k}：${bySource[k]} 次${tag}`)
    }
  }

  const recent = Array.isArray(s.recent) ? s.recent : []
  if (recent.length > 0) {
    printSection('3. 最近 10 条明细')
    for (const row of recent) {
      const okMark = row.ok === false ? '❌' : '✅'
      const tokens =
        row.totalTokens != null ? `${row.totalTokens} tokens` : 'tokens 未知'
      console.log(
        `   ${okMark} ${fmtTime(row.at)} | ${row.model} | ${row.source} | ${tokens}`,
      )
    }
  }

  printSection('说明')
  console.log('   · source=wengu-learning-app 表示来自本学习 App')
  console.log('   · 账单里 v4-pro 若远高于此处 Flash 次数，多半是 Cursor 等用了同一 API Key')
  console.log('   · 建议为本 App 单独建 DeepSeek Key，与 Cursor 分开')
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
