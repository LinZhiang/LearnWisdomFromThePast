<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import '../../question-bank-score/score-section.css'
import { cardList } from '../../question-bank-score/hook'
import { WEN_WU_SCORES_CHANGED_EVENT } from '../../question-bank-score/wen-wu-user-scores'
import GachaTenPullModal from '../gacha/GachaTenPullModal.vue'
import {
  checkGachaPull,
  executeTenPull,
  gachaPullBlockMessage,
  isLadderTicket,
  ladderPullHint,
  type GachaSettlement,
} from '../gacha/gacha-pull'
import { getGachaUsesToday } from '../gacha/gacha-usage'
import type { GachaDrawResult } from '../gacha/gacha-types'
import { useUserMoney } from '../composables/useUserMoney'
import '../money-spend-shared.css'

const expanded = ref(false)
const gachaVisible = ref(false)
const activeTicketName = ref('')
const activeLadderPullIndex = ref<number | null>(null)
const usageTick = ref(0)
const pullResults = ref<GachaDrawResult[]>([])
const pullSettlement = ref<GachaSettlement | null>(null)

const { money } = useUserMoney()

function bumpUsage() {
  usageTick.value++
}

function usesToday(ticketName: string): number {
  void usageTick.value
  return getGachaUsesToday(ticketName)
}

function canPull(card: (typeof cardList.value)[number]) {
  void usageTick.value
  void money.value
  return checkGachaPull(card)
}

function pullHint(card: (typeof cardList.value)[number]): string {
  const check = canPull(card)
  if (!check.ok) {
    return gachaPullBlockMessage(card, check)
  }
  if (isLadderTicket(card)) {
    return ladderPullHint(card, check)
  }
  return `每次 10 张，消耗 ${card.money} 元，按卡牌价值返还；今日还可抽 ${check.remainingToday} 次`
}

function openTenPull(card: (typeof cardList.value)[number]) {
  const check = canPull(card)
  if (!check.ok) {
    ElMessage.warning(gachaPullBlockMessage(card, check))
    return
  }
  try {
    const { results, settlement, ladderPullIndex } = executeTenPull(card)
    pullResults.value = results
    pullSettlement.value = settlement
    activeLadderPullIndex.value = ladderPullIndex ?? null
    activeTicketName.value = card.name
    gachaVisible.value = true
    bumpUsage()
    const netText =
      settlement.net >= 0 ? `+${settlement.net}` : String(settlement.net)
    ElMessage.success(
      `抽奖完成：消耗 ${settlement.cost} 元，卡牌价值 ${settlement.reward} 元，净 ${netText} 元`,
    )
  } catch {
    ElMessage.error('抽奖失败，请重试')
  }
}

function closeGacha() {
  gachaVisible.value = false
  activeTicketName.value = ''
  activeLadderPullIndex.value = null
  pullResults.value = []
  pullSettlement.value = null
  bumpUsage()
}

const onScoresChanged = () => bumpUsage()

onMounted(() => {
  window.addEventListener(WEN_WU_SCORES_CHANGED_EVENT, onScoresChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener(WEN_WU_SCORES_CHANGED_EVENT, onScoresChanged)
})
</script>

<template>
  <section class="score-section money-spend-block" aria-labelledby="card-list-title">
    <div class="money-section-head">
      <h3 id="card-list-title" class="score-section-title money-section-title">抽奖券</h3>
      <button
        type="button"
        class="money-section-toggle"
        :aria-expanded="expanded"
        aria-controls="card-list-panel"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起详情' : '展开详情' }}
      </button>
    </div>
    <p v-if="!expanded" class="score-muted money-section-collapsed-hint">
      点击「展开详情」查看抽奖券种类与卡牌概率。
    </p>
    <div v-show="expanded" id="card-list-panel" class="money-section-panel">
      <p class="score-muted">每种券每日有抽奖次数上限；单次抽奖消耗对应金钱，并按规定概率产出卡牌。</p>
      <div class="money-card-list">
        <article v-for="(card, cardIdx) in cardList" :key="cardIdx" class="money-card-item">
          <header class="money-card-head">
            <h4 class="money-card-name">{{ card.name }}</h4>
            <dl class="money-card-meta">
              <div>
                <dt>单次消耗</dt>
                <dd>{{ card.money }} 元</dd>
              </div>
              <div>
                <dt>每日上限</dt>
                <dd>{{ card.timeLimit }} 次</dd>
              </div>
              <div>
                <dt>今日已抽</dt>
                <dd>{{ usesToday(card.name) }} / {{ card.timeLimit }} 次</dd>
              </div>
            </dl>
          </header>
          <p class="money-card-desc">{{ card.description }}</p>
          <div class="money-card-actions">
            <el-button type="primary" :disabled="!canPull(card).ok" @click="openTenPull(card)">
              10 连抽
            </el-button>
            <span
              class="money-card-actions-hint"
              :class="{ 'money-card-actions-hint--warn': !canPull(card).ok }"
            >
              {{ pullHint(card) }}
            </span>
          </div>
          <div class="score-table-wrap">
            <table class="score-table money-spend-table">
              <thead>
                <tr>
                  <th>卡牌</th>
                  <th class="money-col-rank">等级</th>
                  <th class="money-col-amount">面值</th>
                  <th class="money-col-percent">概率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(tier, tierIdx) in card.rank" :key="tierIdx">
                  <td>{{ tier.name }}</td>
                  <td class="money-col-rank">{{ tier.rank }}</td>
                  <td class="money-col-amount">{{ tier.money }}</td>
                  <td class="money-col-percent">{{ tier.percent }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </div>

    <GachaTenPullModal
      :visible="gachaVisible"
      :ticket-name="activeTicketName"
      :pull-results="pullResults"
      :settlement="pullSettlement"
      :ladder-pull-index="activeLadderPullIndex"
      @close="closeGacha"
    />
  </section>
</template>

<style scoped>
.money-card-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.money-card-item {
  padding: 14px 0 0;
  border-top: 1px solid var(--app-border-soft);
}

.money-card-item:first-child {
  padding-top: 0;
  border-top: none;
}

.money-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 10px;
}

.money-card-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.money-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin: 0;
}

.money-card-meta > div {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
}

.money-card-meta dt {
  margin: 0;
  color: var(--app-text-muted);
  font-weight: 500;
}

.money-card-meta dd {
  margin: 0;
  font-weight: 600;
}

.money-card-desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--app-text-muted);
}

.money-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-bottom: 14px;
}

.money-card-actions-hint {
  font-size: 12px;
  color: var(--app-text-muted);
}

.money-card-actions-hint--warn {
  color: #b45309;
}

.app-shell.theme-dark .money-card-actions-hint--warn {
  color: #fbbf24;
}
</style>
