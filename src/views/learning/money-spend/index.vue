<script setup lang="ts">
import ScorePageHero from '../question-bank-score/components/ScorePageHero.vue'
import CardListSection from './components/CardListSection.vue'
import MoneyBalanceSection from './components/MoneyBalanceSection.vue'
import MoneyListSection from './components/MoneyListSection.vue'
import MoneyLeisureTimerSection from './components/MoneyLeisureTimerSection.vue'
import MoneyRuleSection from './components/MoneyRuleSection.vue'
</script>

<template>
  <div class="money-spend-root">
    <section class="money-spend-page">
      <ScorePageHero
        kicker="智学 06"
        title="金钱消费"
        subtitle="查阅日常收支、游戏/视频计时、抽奖券与消费积分规则；学习/工作奖励与品阶晋升奖励自动入账。"
      />

      <MoneyBalanceSection />
      <MoneyRuleSection />
      <MoneyLeisureTimerSection />
      <MoneyListSection />
      <CardListSection />
    </section>
  </div>
</template>

<style scoped>
.money-spend-root {
  width: 100%;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.money-spend-page {
  width: 100%;
  max-width: 56rem;
  box-sizing: border-box;
  padding: 0 12px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
