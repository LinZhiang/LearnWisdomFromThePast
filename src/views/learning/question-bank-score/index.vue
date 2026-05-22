<script setup lang="ts">
import { useRouter } from 'vue-router'
import './score-section.css'
import DailyUsageHistorySection from './components/DailyUsageHistorySection.vue'
import DailyWebUsageSection from './components/DailyWebUsageSection.vue'
import ScorePageHero from './components/ScorePageHero.vue'
import WenWuScoresSummary from './components/WenWuScoresSummary.vue'
import ExerciseTimeHistorySection from './components/ExerciseTimeHistorySection.vue'
import ExerciseTimeSubmitSection from './components/ExerciseTimeSubmitSection.vue'
import WorkTimeHistorySection from './components/WorkTimeHistorySection.vue'
import WorkTimeSubmitSection from './components/WorkTimeSubmitSection.vue'
import { useDailyWebAndWork } from './composables/useDailyWebAndWork'
import { useExerciseTime } from './composables/useExerciseTime'

const {
  todayKey,
  dailyHistory,
  workHistory,
  workDateKey,
  workMinutes,
  workKind,
  workNote,
  submittingWork,
  todayLabel,
  submitWork,
} = useDailyWebAndWork()

const {
  exerciseHistory,
  exerciseDateKey,
  exerciseMinutes,
  exerciseKind,
  exerciseNote,
  submittingExercise,
  submitExercise,
} = useExerciseTime()

const router = useRouter()

const goWenWuRank = () => {
  void router.push({ name: 'wen-wu-rank' })
}
</script>

<template>
  <div class="score-page-root">
    <section class="score-page">
      <ScorePageHero
        kicker="智学 04"
        title="学习分数"
        subtitle="按学习类型统计得分表现；汇总本机网页学习时长、工作/出差登记与锻炼时间登记（数据存于浏览器本地）。文武累计分不可手动修改；学习模式与文武品阶入口均在下方「我的文武累计分」卡片内。"
      />

      <WenWuScoresSummary show-study-mode-toggle show-rank-entry @open-rank="goWenWuRank" />

      <DailyWebUsageSection :today-key="todayKey" :today-label="todayLabel" />

      <DailyUsageHistorySection :rows="dailyHistory" />

      <WorkTimeSubmitSection
        :work-date-key="workDateKey"
        :work-minutes="workMinutes"
        :work-kind="workKind"
        :work-note="workNote"
        :submitting="submittingWork"
        @update:work-date-key="workDateKey = $event"
        @update:work-minutes="workMinutes = $event"
        @update:work-kind="workKind = $event"
        @update:work-note="workNote = $event"
        @submit="submitWork"
      />

      <WorkTimeHistorySection :rows="workHistory" />

      <ExerciseTimeSubmitSection
        :exercise-date-key="exerciseDateKey"
        :exercise-minutes="exerciseMinutes"
        :exercise-kind="exerciseKind"
        :exercise-note="exerciseNote"
        :submitting="submittingExercise"
        @update:exercise-date-key="exerciseDateKey = $event"
        @update:exercise-minutes="exerciseMinutes = $event"
        @update:exercise-kind="exerciseKind = $event"
        @update:exercise-note="exerciseNote = $event"
        @submit="submitExercise"
      />

      <ExerciseTimeHistorySection :rows="exerciseHistory" />
    </section>
  </div>
</template>

<style scoped>
.score-page-root {
  width: 100%;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.score-page {
  width: 100%;
  max-width: 56rem;
  box-sizing: border-box;
  padding: 0 12px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
