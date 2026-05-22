<script setup lang="ts">
import './score-section.css'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import RankListTable from './components/RankListTable.vue'
import ScorePageHero from './components/ScorePageHero.vue'
import WenWuScoresSummary from './components/WenWuScoresSummary.vue'
import { applyDailyStudyingPenaltyIfNeeded } from './wen-wu-study-mode'

const scoresRef = ref<InstanceType<typeof WenWuScoresSummary> | null>(null)

onMounted(() => {
  applyDailyStudyingPenaltyIfNeeded()
  scoresRef.value?.refresh()
})
</script>

<template>
  <div class="wen-wu-page-root">
    <div class="wen-wu-column">
      <header class="wen-wu-topbar">
        <RouterLink class="wen-wu-back" to="/learning/question-bank-score">← 返回学习分数</RouterLink>
      </header>

      <div class="wen-wu-scroll-body">
        <ScorePageHero
          kicker="智学 04"
          title="文武品阶"
          subtitle="文、武两套累计分彼此独立：文职品阶由「文」分对照文职列与文说明；武职品阶由「武」分对照武职列与武说明。分数不可手动编辑。学习模式请在「学习分数」页的「我的文武累计分」中切换。"
        />

        <WenWuScoresSummary ref="scoresRef" />

        <RankListTable />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wen-wu-page-root {
  width: 100%;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.wen-wu-column {
  width: 100%;
  max-width: min(96vw, 88rem);
  box-sizing: border-box;
  padding: 0 12px 32px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.wen-wu-topbar {
  flex-shrink: 0;
  padding: 12px 0 14px;
  border-bottom: 1px solid var(--app-border-soft);
  margin-bottom: 12px;
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--app-surface);
}

.wen-wu-scroll-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 8px;
}

.wen-wu-back {
  display: inline-block;
  font-size: 13px;
  color: var(--app-primary);
  text-decoration: none;
}

.wen-wu-back:hover {
  text-decoration: underline;
}
</style>
