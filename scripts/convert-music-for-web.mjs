/**
 * 将 src/assets/music 中浏览器无法直接播放的格式转为 WAV/保留可播格式。
 * 用法: node scripts/convert-music-for-web.mjs [--dry-run]
 */
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeNwaFileToWav } from './lib/nwa-decode.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const MUSIC_ROOT = join(__dirname, '../src/assets/music')
const dryRun = process.argv.includes('--dry-run')

const WEB_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'])
const CONVERT_NWA = '.nwa'
const CONVERT_OWP = '.owp'
const UNSUPPORTED = new Set(['.mid', '.midi'])

/** @type {string[]} */
const converted = []
/** @type {string[]} */
const skipped = []
/** @type {{ path: string; reason: string }[]} */
const failed = []

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      walk(full, files)
    } else {
      files.push(full)
    }
  }
  return files
}

function rel(full) {
  return full.slice(MUSIC_ROOT.length + 1).replace(/\\/g, '/')
}

/** Siglus OWP：单字节 XOR，mask = 'O' ^ data[0]（见 SiglusExtract UnpackOGG.h） */
function decodeOwpToOgg(input) {
  const mask = 0x4f ^ input[0]
  const out = Buffer.alloc(input.length)
  for (let i = 0; i < input.length; i++) out[i] = input[i] ^ mask
  if (out.indexOf('OggS', 0, 'ascii') !== 0) {
    throw new Error('解密后不是有效的 Ogg 容器')
  }
  return out
}

function convertOwp(full) {
  const out = full.replace(/\.owp$/i, '.ogg')
  if (existsSync(out)) {
    skipped.push(`${rel(full)}（已存在 ${basename(out)}）`)
    if (!dryRun) unlinkSync(full)
    return
  }
  if (dryRun) {
    converted.push(`${rel(full)} → ${basename(out)}`)
    return
  }
  try {
    const ogg = decodeOwpToOgg(readFileSync(full))
    writeFileSync(out, ogg)
    unlinkSync(full)
    converted.push(rel(full))
  } catch (e) {
    failed.push({ path: rel(full), reason: e instanceof Error ? e.message : String(e) })
  }
}

function convertNwa(full) {
  const out = full.replace(/\.nwa$/i, '.wav')
  if (existsSync(out)) {
    skipped.push(`${rel(full)}（已存在 ${basename(out)}）`)
    if (!dryRun) unlinkSync(full)
    return
  }
  if (dryRun) {
    converted.push(`${rel(full)} → ${basename(out)}`)
    return
  }
  try {
    decodeNwaFileToWav(full, out)
    unlinkSync(full)
    converted.push(rel(full))
  } catch (e) {
    failed.push({ path: rel(full), reason: e instanceof Error ? e.message : String(e) })
  }
}

function main() {
  if (!existsSync(MUSIC_ROOT)) {
    console.error('未找到目录:', MUSIC_ROOT)
    process.exit(1)
  }

  const all = walk(MUSIC_ROOT).filter((f) => !f.endsWith('README.md'))

  for (const full of all) {
    const ext = extname(full).toLowerCase()
    if (ext === CONVERT_NWA) {
      convertNwa(full)
      continue
    }
    if (ext === CONVERT_OWP) {
      convertOwp(full)
      continue
    }
    if (UNSUPPORTED.has(ext)) {
      failed.push({
        path: rel(full),
        reason: 'MIDI 需合成器导出为 MP3/OGG/WAV，HTML Audio 无法直接播放',
      })
      continue
    }
    if (!WEB_EXTS.has(ext)) {
      failed.push({ path: rel(full), reason: `未知扩展名 ${ext}` })
    }
  }

  console.log(`\n=== 音乐资源网页化 ${dryRun ? '(预览)' : ''} ===\n`)
  console.log(`目录: ${MUSIC_ROOT}`)
  if (converted.length) {
    console.log(`\n已转换 (${converted.length}):`)
    for (const p of converted) console.log(`  ✓ ${p}`)
  }
  if (skipped.length) {
    console.log(`\n已跳过 (${skipped.length}):`)
    for (const p of skipped) console.log(`  · ${p}`)
  }
  if (failed.length) {
    console.log(`\n无法自动处理，建议删除或自行转码 (${failed.length}):`)
    for (const { path, reason } of failed) console.log(`  ✗ ${path}\n    ${reason}`)
  }

  if (!dryRun && converted.length) {
    console.log('\n请重新运行 npm run dev 或 npm run build 以更新曲目列表。')
  }
  process.exit(failed.length > 0 ? 2 : 0)
}

main()
