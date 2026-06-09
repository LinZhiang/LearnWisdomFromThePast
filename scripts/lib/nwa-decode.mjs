/**
 * RealLive / Siglus NWA → WAV（移植自 rlvm vendor/xclannad/nwatowav.cc）
 */
import { readFileSync, writeFileSync } from 'node:fs'

function readI16(buf, off) {
  return buf.readInt16LE(off)
}

function readI32(buf, off) {
  return buf.readInt32LE(off)
}

function writeI16(buf, off, v) {
  buf.writeInt16LE(v, off)
}

function writeI32(buf, off, v) {
  buf.writeInt32LE(v, off)
}

/** 与 C++ short 一样保持在 16 位有符号范围 */
function clampS16(v) {
  return ((v | 0) << 16) >> 16
}

function getbits(state, bits) {
  let { pos, shift, data } = state
  if (shift > 8) {
    pos++
    shift -= 8
  }
  const val = data.readUInt16LE(pos)
  const ret = (val >> shift) & ((1 << bits) - 1)
  shift += bits
  state.pos = pos
  state.shift = shift
  return ret
}

function nwaDecode(info, comp, out, compSize, outSize) {
  const d = [0, 0]
  const state = { pos: 0, shift: 0, data: comp }
  const dataEnd = compSize
  const bps = info.bps
  const byps = bps / 8
  const dsize = outSize / byps
  let flip = 0
  let runlength = 0

  if (bps === 8) {
    d[0] = comp[state.pos++]
  } else {
    d[0] = comp.readInt16LE(state.pos)
    state.pos += 2
  }
  if (info.channels === 2) {
    if (bps === 8) {
      d[1] = comp[state.pos++]
    } else {
      d[1] = comp.readInt16LE(state.pos)
      state.pos += 2
    }
  }

  let outPos = 0
  for (let i = 0; i < dsize; i++) {
    if (state.pos >= dataEnd && state.shift >= 8) break
    if (runlength === 0) {
      const type = getbits(state, 3)
      if (type === 7) {
        if (getbits(state, 1) === 1) {
          d[flip] = 0
        } else {
          let BITS
          let SHIFT
          if (info.complevel >= 3) {
            BITS = 8
            SHIFT = 9
          } else {
            BITS = 8 - info.complevel
            SHIFT = 2 + 7 + info.complevel
          }
          const MASK1 = 1 << (BITS - 1)
          const MASK2 = MASK1 - 1
          const b = getbits(state, BITS)
          if (b & MASK1) d[flip] = clampS16(d[flip] - ((b & MASK2) << SHIFT))
          else d[flip] = clampS16(d[flip] + ((b & MASK2) << SHIFT))
        }
      } else if (type !== 0) {
        let BITS
        let SHIFT
        if (info.complevel >= 3) {
          BITS = info.complevel + 3
          SHIFT = 1 + type
        } else {
          BITS = 5 - info.complevel
          SHIFT = 2 + type + info.complevel
        }
        const MASK1 = 1 << (BITS - 1)
        const MASK2 = MASK1 - 1
        const b = getbits(state, BITS)
        if (b & MASK1) d[flip] = clampS16(d[flip] - ((b & MASK2) << SHIFT))
        else d[flip] = clampS16(d[flip] + ((b & MASK2) << SHIFT))
      } else if (info.useRunLength) {
        runlength = getbits(state, 1)
        if (runlength === 1) {
          runlength = getbits(state, 2)
          if (runlength === 3) {
            runlength = getbits(state, 8)
          }
        }
      }
    } else {
      runlength--
    }

    if (bps === 8) {
      out[outPos++] = d[flip] & 0xff
    } else {
      writeI16(out, outPos, d[flip])
      outPos += 2
    }
    if (info.channels === 2) flip ^= 1
  }
}

function makeWavHeader(dataSize, channels, bps, freq) {
  const h = Buffer.alloc(0x2c)
  h.write('RIFF', 0)
  writeI32(h, 4, dataSize + 0x24)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  writeI32(h, 16, 16)
  writeI16(h, 20, 1)
  writeI16(h, 22, channels)
  writeI32(h, 24, freq)
  const byps = (bps + 7) >> 3
  writeI32(h, 28, freq * byps * channels)
  writeI16(h, 32, byps * channels)
  writeI16(h, 34, bps)
  h.write('data', 36)
  writeI32(h, 40, dataSize)
  return h
}

/**
 * @param {Buffer} input
 * @returns {Buffer}
 */
export function decodeNwaToWav(input) {
  const channels = readI16(input, 0)
  const bps = readI16(input, 2)
  const freq = readI32(input, 4)
  let complevel = readI32(input, 8)
  const useRunLength = readI32(input, 12) !== 0
  let blocks = readI32(input, 16)
  const datasize = readI32(input, 20)
  const compdatasize = readI32(input, 24)
  const samplecount = readI32(input, 28)
  let blocksize = readI32(input, 32)
  let restsize = readI32(input, 36)

  if (channels !== 1 && channels !== 2) {
    throw new Error(`不支持的声道数: ${channels}`)
  }
  if (bps !== 8 && bps !== 16) {
    throw new Error(`不支持的位深: ${bps}`)
  }
  if (complevel < -1 || complevel > 5) {
    throw new Error(`不支持的压缩级别: ${complevel}`)
  }

  const byps = bps / 8
  const pcm = Buffer.alloc(datasize)
  const info = { channels, bps, complevel, useRunLength }

  if (complevel === -1) {
    input.copy(pcm, 0, 0x2c)
    return Buffer.concat([makeWavHeader(datasize, channels, bps, freq), pcm])
  }

  const offsets = []
  let off = 0x2c
  for (let i = 0; i < blocks; i++) {
    offsets.push(readI32(input, off))
    off += 4
  }
  const dataStart = off

  if (samplecount !== (blocks - 1) * blocksize + restsize) {
    throw new Error('NWA 样本数与块表不一致')
  }

  let pcmPos = 0
  for (let block = 0; block < blocks; block++) {
    const curBlockSamples = block !== blocks - 1 ? blocksize : restsize
    const curBlockSize = curBlockSamples * byps
    const compOff = offsets[block]
    const compSize =
      block !== blocks - 1
        ? offsets[block + 1] - offsets[block]
        : blocksize * byps * 2
    const comp = input.subarray(compOff, compOff + compSize)
    const blockOut = Buffer.alloc(curBlockSize)
    nwaDecode(info, comp, blockOut, compSize, curBlockSize)
    blockOut.copy(pcm, pcmPos)
    pcmPos += curBlockSize
  }

  if (pcmPos !== datasize) {
    throw new Error(`解码长度不符: ${pcmPos} != ${datasize}`)
  }

  return Buffer.concat([makeWavHeader(datasize, channels, bps, freq), pcm])
}

export function decodeNwaFileToWav(inPath, outPath) {
  const wav = decodeNwaToWav(readFileSync(inPath))
  writeFileSync(outPath, wav)
  return wav.length
}
