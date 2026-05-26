<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ladderGuaranteeText } from './gacha-draw'
import type { GachaDrawResult } from './gacha-types'
import type { GachaSettlement } from './gacha-pull'
import GachaResultCard from './GachaResultCard.vue'

const props = defineProps<{
  visible: boolean
  ticketName: string
  pullResults: GachaDrawResult[]
  settlement: GachaSettlement | null
  /** 阶梯券：今日第几次抽奖（1~4） */
  ladderPullIndex?: number | null
}>()

const emit = defineEmits<{
  close: []
}>()

type Phase = 'idle' | 'summon' | 'reveal' | 'summary'

const phase = ref<Phase>('idle')
const results = ref<GachaDrawResult[]>([])
const revealIndex = ref(-1)
const justRevealed = ref(false)

let revealTimer: ReturnType<typeof setTimeout> | null = null
let summonTimer: ReturnType<typeof setTimeout> | null = null

const REVEAL_MS = 420
const SUMMON_MS = 520
const REVEAL_GAP_MS = 120

const currentResult = computed(() =>
  revealIndex.value >= 0 ? results.value[revealIndex.value] : null,
)

const progressText = computed(() => {
  const ladderPrefix =
    props.ladderPullIndex != null && props.ladderPullIndex >= 1
      ? `今日第 ${props.ladderPullIndex} 次 · `
      : ''
  if (phase.value === 'summon') return `${ladderPrefix}召唤中…`
  if (phase.value === 'reveal' && revealIndex.value >= 0) {
    return `${ladderPrefix}第 ${revealIndex.value + 1} / 10 张`
  }
  if (phase.value === 'summary') {
    return ladderPullBanner.value || '10 连抽完成'
  }
  return ''
})

function clearTimers() {
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
  if (summonTimer) {
    clearTimeout(summonTimer)
    summonTimer = null
  }
}

function reset() {
  clearTimers()
  phase.value = 'idle'
  results.value = []
  revealIndex.value = -1
  justRevealed.value = false
}

function scheduleRevealStep() {
  revealTimer = setTimeout(() => {
    revealIndex.value += 1
    justRevealed.value = true
    revealTimer = setTimeout(() => {
      justRevealed.value = false
      if (revealIndex.value >= 9) {
        phase.value = 'summary'
        return
      }
      scheduleRevealStep()
    }, REVEAL_MS)
  }, REVEAL_GAP_MS)
}

const settlementSummary = computed(() => {
  const s = props.settlement
  if (!s) return ''
  const netLabel = s.net >= 0 ? `+${s.net}` : String(s.net)
  return `消耗 ${s.cost} 元 · 卡牌合计 ${s.reward} 元 · 净变动 ${netLabel} 元 · 余额 ${s.balance} 元`
})

const ladderPullBanner = computed(() => {
  const n = props.ladderPullIndex
  if (n == null || n < 1) return ''
  return `今日第 ${n} 次抽奖 · 第 10 张保底 ${ladderGuaranteeText(n)}`
})

function startPull() {
  reset()
  results.value = [...props.pullResults]
  phase.value = 'summon'
  summonTimer = setTimeout(() => {
    phase.value = 'reveal'
    revealIndex.value = -1
    scheduleRevealStep()
  }, SUMMON_MS)
}

function skipToSummary() {
  clearTimers()
  revealIndex.value = 9
  justRevealed.value = false
  phase.value = 'summary'
}

function onClose() {
  reset()
  emit('close')
}

watch(
  () => props.visible,
  (v) => {
    if (v && props.pullResults.length > 0) startPull()
    else if (!v) reset()
  },
)

onBeforeUnmount(() => clearTimers())
</script>

<template>
  <Teleport to="body">
    <Transition name="gacha-overlay">
      <div
        v-if="visible"
        class="gacha-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="`${ticketName} 10 连抽`"
        @keydown.esc="onClose"
      >
        <div class="gacha-overlay-bg" aria-hidden="true">
          <div class="gacha-nebula gacha-nebula--a" />
          <div class="gacha-nebula gacha-nebula--b" />
          <div class="gacha-stars" />
        </div>

        <header class="gacha-overlay-head">
          <div>
            <p class="gacha-overlay-kicker">{{ ticketName }}</p>
            <h2 class="gacha-overlay-title">10 连抽</h2>
            <p v-if="ladderPullBanner" class="gacha-overlay-preview">{{ ladderPullBanner }}</p>
          </div>
          <button type="button" class="gacha-overlay-close" @click="onClose">关闭</button>
        </header>

        <main class="gacha-overlay-main">
          <p class="gacha-progress">{{ progressText }}</p>

          <div v-if="phase === 'summon'" class="gacha-summon">
            <div class="gacha-summon-ring" />
            <div class="gacha-summon-ring gacha-summon-ring--delay" />
            <p class="gacha-summon-text">聚光召唤中</p>
          </div>

          <div v-else-if="phase === 'reveal' && currentResult" class="gacha-stage">
            <div class="gacha-stage-featured">
              <GachaResultCard
                :result="currentResult"
                featured
                :revealed="true"
                :class="{ 'gacha-card--revealed-in': justRevealed }"
              />
            </div>
            <div class="gacha-strip" aria-label="已抽出卡牌">
              <div
                v-for="(item, idx) in results"
                :key="idx"
                class="gacha-strip-slot"
                :class="{ 'gacha-strip-slot--active': idx === revealIndex }"
              >
                <GachaResultCard v-if="idx <= revealIndex" :result="item" grid revealed />
                <div v-else class="gacha-strip-placeholder" />
              </div>
            </div>
            <button type="button" class="gacha-skip-btn" @click="skipToSummary">跳过动画</button>
          </div>

          <div v-else-if="phase === 'summary'" class="gacha-summary">
            <p v-if="ladderPullBanner" class="gacha-ladder-banner">{{ ladderPullBanner }}</p>
            <p v-if="settlementSummary" class="gacha-settlement">{{ settlementSummary }}</p>
            <div class="gacha-summary-grid">
              <div
                v-for="item in results"
                :key="item.index"
                class="gacha-summary-slot"
              >
                <GachaResultCard :result="item" grid revealed />
              </div>
            </div>
            <button type="button" class="gacha-done-btn" @click="onClose">收下卡牌</button>
          </div>
        </main>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gacha-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  height: 100dvh;
  max-height: 100dvh;
  padding: clamp(8px, 1.2vh, 16px) clamp(12px, 2.5vw, 32px) clamp(8px, 1.2vh, 16px);
  box-sizing: border-box;
  overflow: hidden;
  color: #f1f5f9;
}

.gacha-overlay-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: radial-gradient(ellipse 120% 80% at 50% 0%, #1e3a5f 0%, #0b1020 45%, #050810 100%);
}

.gacha-nebula {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.55;
  animation: gacha-nebula-drift 12s ease-in-out infinite alternate;
}

.gacha-nebula--a {
  width: 55vw;
  height: 55vw;
  top: -10%;
  left: -15%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.45), transparent 70%);
}

.gacha-nebula--b {
  width: 45vw;
  height: 45vw;
  bottom: -5%;
  right: -10%;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.35), transparent 70%);
  animation-delay: -4s;
}

.gacha-stars {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(1px 1px at 10% 20%, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1px 1px at 80% 40%, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1.5px 1.5px at 45% 70%, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1px 1px at 65% 15%, rgba(255, 255, 255, 0.45), transparent);
  opacity: 0.5;
}

@keyframes gacha-nebula-drift {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(3%, 2%) scale(1.05);
  }
}

.gacha-overlay-head {
  width: 100%;
  max-width: min(96vw, 1280px);
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.gacha-overlay-main {
  flex: 1;
  width: 100%;
  max-width: min(96vw, 1280px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: stretch;
  min-height: 0;
  overflow: hidden;
}

.gacha-overlay-kicker {
  margin: 0;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.9);
  letter-spacing: 0.06em;
}

.gacha-overlay-title {
  margin: 4px 0 0;
  font-size: 1.35rem;
  font-weight: 700;
}

.gacha-overlay-preview {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(253, 224, 71, 0.92);
  max-width: 28rem;
}

.gacha-overlay-close {
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  background: rgba(15, 23, 42, 0.5);
  color: #e2e8f0;
}

.gacha-overlay-close:hover {
  background: rgba(30, 41, 59, 0.75);
}

.gacha-progress {
  margin: 0 0 clamp(4px, 0.8vh, 10px);
  font-size: clamp(0.95rem, 1.8vh, 1.35rem);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #93c5fd;
  text-align: center;
  flex-shrink: 0;
  line-height: 1.2;
}

.gacha-summon {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  position: relative;
}

.gacha-summon-ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 3px solid transparent;
  border-top-color: #38bdf8;
  border-right-color: rgba(250, 204, 21, 0.6);
  animation: gacha-spin 0.65s linear infinite;
}

.gacha-summon-ring--delay {
  position: absolute;
  width: 160px;
  height: 160px;
  border-top-color: rgba(167, 139, 250, 0.8);
  animation-duration: 1.4s;
  animation-direction: reverse;
}

@keyframes gacha-spin {
  to {
    transform: rotate(360deg);
  }
}

.gacha-summon-text {
  margin: 24px 0 0;
  font-size: 14px;
  color: rgba(226, 232, 240, 0.8);
}

.gacha-stage {
  width: 100%;
  flex: 1;
  display: grid;
  grid-template-rows: minmax(0, 40fr) minmax(0, 54fr) auto;
  align-items: stretch;
  gap: clamp(4px, 0.9vh, 12px);
  min-height: 0;
  overflow: hidden;
}

.gacha-stage-featured {
  width: 100%;
  max-width: min(96vw, 1280px);
  margin: 0 auto;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  container-type: size;
}

.gacha-stage-featured :deep(.gacha-card--featured) {
  width: 100%;
  height: 100%;
  max-height: 100%;
}

.gacha-strip {
  width: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: clamp(8px, 1.4vh, 18px);
  align-content: center;
  justify-items: center;
}

.gacha-strip-slot {
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  container-type: size;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.55;
  transform: scale(0.92);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.gacha-strip-slot :deep(.gacha-card--grid) {
  height: auto;
  max-height: 100%;
}

.gacha-strip-slot--active {
  opacity: 1;
  transform: scale(1);
}

.gacha-strip-placeholder {
  flex: none;
  width: 85%;
  max-width: 100%;
  aspect-ratio: 5 / 2;
  height: auto;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  background: rgba(15, 23, 42, 0.4);
}

.gacha-skip-btn {
  margin: 0;
  justify-self: center;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: rgba(148, 163, 184, 0.95);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.gacha-settlement {
  margin: 0;
  text-align: center;
  font-size: clamp(0.75rem, 1.4vh, 0.95rem);
  color: rgba(226, 232, 240, 0.88);
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.gacha-summary {
  width: 100%;
  flex: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  align-items: stretch;
  gap: clamp(6px, 1vh, 12px);
  min-height: 0;
  overflow: hidden;
}

.gacha-ladder-banner {
  margin: 0;
  text-align: center;
  font-size: clamp(0.85rem, 1.6vh, 1.05rem);
  font-weight: 700;
  color: #fde047;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.gacha-summary-grid {
  width: 100%;
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  align-content: center;
  justify-items: stretch;
  align-items: center;
  gap: clamp(8px, 1.4vh, 18px);
}

.gacha-summary-slot {
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  container-type: size;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.gacha-summary-slot :deep(.gacha-card--grid) {
  width: 100%;
  height: auto;
  max-height: 100%;
  min-width: 0;
}

@media (max-width: 720px) {
  .gacha-stage {
    grid-template-rows: minmax(0, 38fr) minmax(0, 56fr) auto;
  }

  .gacha-summary-grid,
  .gacha-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(5, minmax(0, 1fr));
  }
}

.gacha-done-btn {
  align-self: center;
  border: none;
  border-radius: 10px;
  padding: 12px 36px;
  font-size: clamp(0.95rem, 1.8vw, 1.1rem);
  font-weight: 600;
  cursor: pointer;
  color: #0f172a;
  background: linear-gradient(180deg, #fde047 0%, #f59e0b 100%);
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.45);
}

.gacha-done-btn:hover {
  filter: brightness(1.06);
}

.gacha-overlay-enter-active,
.gacha-overlay-leave-active {
  transition: opacity 0.35s ease;
}

.gacha-overlay-enter-from,
.gacha-overlay-leave-to {
  opacity: 0;
}
</style>
