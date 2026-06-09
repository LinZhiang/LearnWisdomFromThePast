/**
 * 将抽卡背景 PNG 压缩为 WebP（卡片展示无需原图分辨率）。
 * 用法: node scripts/compress-gacha-textures.mjs
 */
import { existsSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEXTURE_DIR = join(__dirname, '../src/assets/texture2D')

/** 卡片背景图：宽不超过 1280，WebP 质量 82 */
const BACKGROUNDS = [
  'Gym_Front_Noon.png',
  'Forest_Spirit_BattleField.png',
  'Forest_Red_Morning.png',
  'Forest_Arena.png',
]

const MAX_WIDTH = 1280
const WEBP_QUALITY = 82

async function compressOne(name) {
  const src = join(TEXTURE_DIR, name)
  if (!existsSync(src)) {
    console.warn(`skip (missing): ${name}`)
    return
  }
  const out = join(TEXTURE_DIR, name.replace(/\.png$/i, '.webp'))
  const before = statSync(src).size
  await sharp(src)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(out)
  const after = statSync(out).size
  console.log(`${basename(out)}: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`)
}

for (const name of BACKGROUNDS) {
  await compressOne(name)
}
