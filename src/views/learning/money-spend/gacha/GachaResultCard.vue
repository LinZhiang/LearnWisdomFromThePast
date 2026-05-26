<script setup lang="ts">
import { computed } from 'vue'
import { backgroundForRarity, portraitDisplayForRarity, portraitForRarity } from './gacha-portraits'
import type { GachaDrawResult } from './gacha-types'

const props = withDefaults(
  defineProps<{
    result: GachaDrawResult
    /** 单卡展示（召唤中） */
    featured?: boolean
    /** 已翻开（网格槽位） */
    revealed?: boolean
    /** 底部 2×5 网格 / 条带展示 */
    grid?: boolean
    compact?: boolean
  }>(),
  { featured: false, revealed: true, grid: false, compact: false },
)

const rankClass = `gacha-card--${props.result.rarityKey.toLowerCase()}`
const portraitSrc = computed(() => portraitForRarity(props.result.rarityKey))
const backgroundSrc = computed(() => backgroundForRarity(props.result.rarityKey))
const portraitDisplay = computed(() => portraitDisplayForRarity(props.result.rarityKey))

const portraitImgStyle = computed(() => {
  const d = portraitDisplay.value
  const style: Record<string, string> = {
    height: `${d.heightPercent}%`,
    width: 'auto',
    maxHeight: '100%',
    maxWidth: d.maxWidth,
    objectPosition: d.objectPosition,
    transformOrigin: 'bottom center',
  }
  if (d.scale !== 1) {
    style.transform = `scale(${d.scale})`
  }
  return style
})
</script>

<template>
  <div
    class="gacha-card"
    :class="[
      rankClass,
      {
        'gacha-card--featured': featured,
        'gacha-card--grid': grid,
        'gacha-card--compact': compact && !grid,
        'gacha-card--hidden': !revealed,
      },
    ]"
  >
    <div class="gacha-card-face">
      <div class="gacha-card-inner">
        <img class="gacha-card-bg" :src="backgroundSrc" alt="" />
        <div class="gacha-card-bg-dim" aria-hidden="true" />
        <div class="gacha-card-glow" aria-hidden="true" />
        <div class="gacha-card-sparkles" aria-hidden="true" />
        <span class="gacha-card-rarity">{{ result.rarityKey }}</span>
        <div class="gacha-card-portrait">
          <img
            class="gacha-card-portrait-img"
            :src="portraitSrc"
            alt=""
            :style="portraitImgStyle"
          />
        </div>
        <div class="gacha-card-badge">×1</div>
      </div>
    </div>
    <div v-if="revealed" class="gacha-card-caption">
      <p class="gacha-card-name">{{ result.tier.name }}</p>
      <p class="gacha-card-sub">价值 {{ result.tier.money }} 元</p>
    </div>
  </div>
</template>

<style scoped>
.gacha-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(2px, 0.5vh, 6px);
  min-width: 0;
  width: 100%;
  min-height: 0;
}

.gacha-card--hidden .gacha-card-inner {
  opacity: 0.35;
  filter: blur(2px) grayscale(0.6);
}

/* 卡面区域：高:宽 ≈ 2:5（宽:高 = 5:2），对齐参考图横条比例，可留白不拉伸 */
.gacha-card-face {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  flex: none;
}

.gacha-card-inner {
  position: relative;
  container-type: size;
  flex: none;
  box-sizing: border-box;
  aspect-ratio: 5 / 2;
  width: 100%;
  height: auto;
  max-width: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: #0d1220;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  transition:
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.45s ease,
    border-color 0.35s ease;
}

.gacha-card--featured {
  height: 100%;
  max-height: 100%;
  width: 100%;
}

.gacha-card--grid {
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: 100%;
  min-width: 0;
}

.gacha-card--featured .gacha-card-face,
.gacha-card--grid .gacha-card-face {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 父级槽位需设 container-type: size（见 GachaTenPullModal） */
.gacha-card--featured .gacha-card-inner {
  width: min(100cqw, calc((100cqh - 2.5em) * 5 / 2));
  max-width: 100%;
  max-height: calc(100cqh - 2.5em);
  height: auto;
}

/* 汇总/条带：以槽位宽度为准，避免矮格子把卡面挤成竖条 */
.gacha-card--grid .gacha-card-inner {
  width: 100%;
  max-width: 100%;
  aspect-ratio: 5 / 2;
  height: auto;
  max-height: min(100cqh, calc(100cqw * 2 / 5));
}

.gacha-card--featured .gacha-card-inner {
  border-radius: 16px;
  border-width: 3px;
}

.gacha-card--grid .gacha-card-inner {
  border-radius: 12px;
  border-width: 2px;
}

.gacha-card--featured .gacha-card-caption {
  width: min(100cqw, calc((100cqh - 2.5em) * 5 / 2));
  max-width: 100%;
  align-self: center;
  flex-shrink: 0;
  text-align: left;
  padding-left: 6%;
  box-sizing: border-box;
}

.gacha-card--grid .gacha-card-caption {
  width: 100%;
  max-width: 100%;
  align-self: stretch;
  flex-shrink: 0;
  text-align: left;
  padding-left: 6%;
  box-sizing: border-box;
}

.gacha-card--compact .gacha-card-inner {
  border-radius: 10px;
}

.gacha-card-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
}

.gacha-card-bg-dim {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(6, 10, 22, 0.65) 0%,
    rgba(6, 10, 22, 0.2) 28%,
    rgba(6, 10, 22, 0.05) 48%,
    rgba(6, 10, 22, 0.05) 62%,
    rgba(6, 10, 22, 0.15) 100%
  );
}

.gacha-card-glow {
  position: absolute;
  inset: -20%;
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s ease;
}

.gacha-card-sparkles {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.9) 0 1px, transparent 2px),
    radial-gradient(circle at 70% 20%, rgba(255, 215, 120, 0.85) 0 1.5px, transparent 3px),
    radial-gradient(circle at 40% 75%, rgba(255, 255, 255, 0.7) 0 1px, transparent 2px),
    radial-gradient(circle at 85% 65%, rgba(180, 220, 255, 0.8) 0 1px, transparent 2px);
  background-size: 100% 100%;
  animation: gacha-sparkle 2.2s linear infinite;
}

@keyframes gacha-sparkle {
  0% {
    transform: translateY(0);
    opacity: 0.35;
  }
  50% {
    opacity: 0.85;
  }
  100% {
    transform: translateY(-6%);
    opacity: 0.35;
  }
}

.gacha-card-rarity {
  position: absolute;
  left: 20%;
  top: 50%;
  transform: translate(-50%, -50%) skewX(-10deg);
  z-index: 4;
  font-size: 72cqh;
  font-weight: 900;
  font-style: italic;
  line-height: 0.82;
  letter-spacing: -0.04em;
  -webkit-text-stroke: 0.065em rgba(15, 23, 42, 0.95);
  paint-order: stroke fill;
  pointer-events: none;
  white-space: nowrap;
}

.gacha-card--sss .gacha-card-rarity {
  left: 18%;
  font-size: 52cqh;
  letter-spacing: -0.08em;
  transform: translate(-50%, -50%) skewX(-10deg);
}

.gacha-card-portrait {
  position: absolute;
  right: 4%;
  bottom: 0;
  top: 0;
  width: 44%;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
  padding-left: 5%;
  box-sizing: border-box;
  mask-image: linear-gradient(90deg, transparent 0%, #000 18%);
}

.gacha-card--featured .gacha-card-portrait {
  width: 42%;
  right: 5%;
}

.gacha-card--grid .gacha-card-portrait {
  width: 44%;
  right: 3%;
}

/* Face_002 横扁：立绘区向左扩宽，按高度 contain 才能尽量大且整张可见 */
.gacha-card--sss .gacha-card-portrait {
  left: 24%;
  right: 0;
  width: auto;
  padding-left: 0;
  mask-image: linear-gradient(90deg, transparent 0%, #000 6%);
}

.gacha-card--sss.gacha-card--featured .gacha-card-portrait,
.gacha-card--sss.gacha-card--grid .gacha-card-portrait {
  left: 22%;
}

.gacha-card-portrait-img {
  display: block;
  flex-shrink: 0;
  object-fit: contain;
  transform-origin: bottom center;
  filter: drop-shadow(-2px 4px 12px rgba(0, 0, 0, 0.45));
}

.gacha-card-badge {
  position: absolute;
  left: 8px;
  top: 6px;
  transform: none;
  z-index: 5;
  font-size: clamp(9px, 2.6cqh, 12px);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  padding: 2px 7px;
  line-height: 1.2;
}

.gacha-card-caption {
  text-align: left;
  padding: 0;
  box-sizing: border-box;
}

.gacha-card-name {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.3;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gacha-card--featured .gacha-card-name {
  font-size: clamp(0.9rem, 2vh, 1.4rem);
  white-space: normal;
}

.gacha-card--grid .gacha-card-name {
  font-size: clamp(0.65rem, 1.35vh, 0.9rem);
  white-space: normal;
  line-height: 1.25;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.gacha-card-sub {
  margin: 3px 0 0;
  font-size: 11px;
  font-weight: 400;
  color: rgba(226, 232, 240, 0.72);
  letter-spacing: 0.03em;
}

.gacha-card--featured .gacha-card-sub {
  font-size: clamp(0.8rem, 1.6vh, 1.05rem);
  margin-top: 4px;
}

.gacha-card--grid .gacha-card-sub {
  font-size: clamp(0.6rem, 1.1vh, 0.8rem);
  margin-top: 2px;
}

.gacha-card-caption {
  flex-shrink: 0;
}

/* A */
.gacha-card--a .gacha-card-rarity {
  color: #fb923c;
  -webkit-text-stroke-color: #9a3412;
}
.gacha-card--a .gacha-card-inner {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

/* S */
.gacha-card--s .gacha-card-rarity {
  color: #7dd3fc;
  -webkit-text-stroke-color: #0c4a6e;
  text-shadow: 0 0 18px rgba(56, 189, 248, 0.85);
}
.gacha-card--s .gacha-card-inner {
  border-width: 2px;
  border-color: rgba(56, 189, 248, 0.65);
  box-shadow:
    0 0 20px rgba(56, 189, 248, 0.28),
    0 6px 20px rgba(0, 0, 0, 0.42);
}
.gacha-card--s .gacha-card-glow {
  opacity: 1;
  background: radial-gradient(circle at 30% 50%, rgba(56, 189, 248, 0.35), transparent 65%);
}

/* SS */
.gacha-card--ss .gacha-card-rarity {
  color: #fde047;
  -webkit-text-stroke-color: #a16207;
  text-shadow: 0 0 22px rgba(250, 204, 21, 0.9);
}
.gacha-card--ss .gacha-card-inner {
  border-width: 2px;
  border-color: rgba(250, 204, 21, 0.9);
  box-shadow:
    0 0 28px rgba(250, 204, 21, 0.42),
    0 0 0 1px rgba(253, 224, 71, 0.35),
    0 6px 22px rgba(0, 0, 0, 0.45);
}
.gacha-card--ss .gacha-card-glow {
  opacity: 1;
  background: radial-gradient(circle at 25% 50%, rgba(250, 204, 21, 0.4), transparent 60%);
}
.gacha-card--ss .gacha-card-sparkles {
  opacity: 0.75;
}

/* SSS — 评级在左、立绘在右，与 SS 同构 */
.gacha-card--sss .gacha-card-rarity {
  color: #fff7ed;
  -webkit-text-stroke-color: #b45309;
  text-shadow:
    0 0 12px #fbbf24,
    0 0 28px rgba(251, 191, 36, 0.95);
}
.gacha-card--sss .gacha-card-inner {
  border-width: 3px;
  border-color: #fde047;
  box-shadow:
    0 0 36px rgba(251, 191, 36, 0.7),
    0 0 64px rgba(245, 158, 11, 0.28),
    0 0 0 2px rgba(253, 224, 71, 0.45),
    0 8px 28px rgba(0, 0, 0, 0.5);
  animation: gacha-sss-pulse 1.6s ease-in-out infinite;
}
.gacha-card--sss .gacha-card-glow {
  opacity: 1;
  background: radial-gradient(circle at 20% 50%, rgba(251, 191, 36, 0.55), transparent 55%);
}
.gacha-card--sss .gacha-card-sparkles {
  opacity: 1;
}

@keyframes gacha-sss-pulse {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.12);
  }
}

.gacha-card--featured.gacha-card--revealed-in .gacha-card-inner {
  animation: gacha-featured-pop 0.38s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes gacha-featured-pop {
  0% {
    transform: scale(0.72) rotateY(-18deg);
    opacity: 0.2;
  }
  55% {
    transform: scale(1.06);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
