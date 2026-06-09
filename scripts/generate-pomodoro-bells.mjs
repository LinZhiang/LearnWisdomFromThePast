/**
 * 生成番茄钟上课/放学铃 WAV（写入 src/assets/voice）
 * 运行：node scripts/generate-pomodoro-bells.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../src/assets/voice')
mkdirSync(outDir, { recursive: true })

const SAMPLE_RATE = 44100

function writeWav(path, samples) {
  const numSamples = samples.length
  const buffer = Buffer.alloc(44 + numSamples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + numSamples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(numSamples * 2, 40)
  for (let i = 0; i < numSamples; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE(Math.floor(v * 32767 * 0.85), 44 + i * 2)
  }
  writeFileSync(path, buffer)
}

/** 学校铃：基频 + 泛音，指数衰减 */
function bellTone(durationSec, baseHz, gain = 1) {
  const n = Math.floor(SAMPLE_RATE * durationSec)
  const out = new Float64Array(n)
  const harmonics = [1, 2.4, 3.8, 5.2]
  const weights = [1, 0.45, 0.22, 0.12]
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-t * 2.8) * (1 - Math.exp(-t * 40))
    let s = 0
    for (let h = 0; h < harmonics.length; h++) {
      s += Math.sin(2 * Math.PI * baseHz * harmonics[h] * t) * weights[h]
    }
    out[i] = (s / harmonics.length) * env * gain
  }
  return out
}

function concat(...chunks) {
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Float64Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

function silence(sec) {
  return new Float64Array(Math.floor(SAMPLE_RATE * sec))
}

/** 上课铃：两声较高铃 */
const classStart = concat(
  bellTone(0.55, 880, 1),
  silence(0.12),
  bellTone(0.7, 988, 0.95),
)

/** 放学铃：三声略低、稍长 */
const classEnd = concat(
  bellTone(0.5, 659, 1),
  silence(0.1),
  bellTone(0.5, 587, 0.95),
  silence(0.1),
  bellTone(0.65, 523, 0.9),
)

writeWav(join(outDir, 'pomodoro-class-start.wav'), classStart)
writeWav(join(outDir, 'pomodoro-class-end.wav'), classEnd)

console.log('Wrote pomodoro-class-start.wav & pomodoro-class-end.wav')
