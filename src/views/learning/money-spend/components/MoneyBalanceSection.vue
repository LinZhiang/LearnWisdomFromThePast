<script setup lang="ts">
import '../../question-bank-score/score-section.css'
import { useUserMoney } from '../composables/useUserMoney'
import { useMoneyRuleAuto } from '../composables/useMoneyRuleAuto'

const { money } = useUserMoney()
const { status, curfewActive, bonusHint, moneyCurfewMessage } = useMoneyRuleAuto()
</script>

<template>
  <section class="score-section money-spend-block money-balance" aria-labelledby="money-balance-title">
    <h3 id="money-balance-title" class="score-section-title">当前金钱</h3>
    <p class="score-muted">与「学习分数」页「金钱（累计）」同源，保存在本机浏览器。</p>
    <p class="money-balance-value">{{ money }}</p>
    <p class="money-balance-unit">元</p>

    <div class="money-auto-panel" aria-label="自动奖励与宵禁">
      <p v-if="curfewActive" class="money-auto-curfew">{{ moneyCurfewMessage() }}</p>
      <p class="money-auto-hint">{{ bonusHint() }}</p>
      <ul v-if="status" class="money-auto-stats">
        <li :class="{ 'money-auto-stats--ok': status.studyMet }">
          今日学习：{{ status.studySeconds >= 3600 ? '已满 1 小时' : '未满 1 小时' }}
        </li>
        <li :class="{ 'money-auto-stats--ok': status.workMet }">
          今日工作登记：{{ status.workMinutes >= 120 ? '已满 2 小时' : '未满 2 小时' }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.money-spend-block {
  margin: 0;
}

.money-balance {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
}

.money-balance .score-section-title {
  width: 100%;
  margin-bottom: 0;
}

.money-balance .score-muted {
  width: 100%;
  margin: 0 0 8px;
}

.money-balance-value {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--app-primary, #2563eb);
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}

.money-balance-unit {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-muted);
  font-weight: 500;
}

.money-auto-panel {
  width: 100%;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid var(--app-border-soft);
}

.app-shell.theme-dark .money-auto-panel {
  background: rgba(15, 23, 42, 0.35);
}

.money-auto-curfew {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #b45309;
}

.app-shell.theme-dark .money-auto-curfew {
  color: #fbbf24;
}

.money-auto-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.money-auto-stats {
  margin: 8px 0 0;
  padding-left: 1.2em;
  font-size: 12px;
  color: var(--app-text-muted);
  line-height: 1.55;
}

.money-auto-stats--ok {
  color: #15803d;
  font-weight: 600;
}

.app-shell.theme-dark .money-auto-stats--ok {
  color: #86efac;
}
</style>
