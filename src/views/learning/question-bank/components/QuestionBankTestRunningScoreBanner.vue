<script setup lang="ts">
defineProps<{
  totalScoreRounded: number
  runningTotalMax: number
  wrongBookMode?: boolean
  wrongBookCorrectCount?: number
  unitsLength?: number
}>()
</script>

<template>
  <div class="test-running-score-banner" role="status" aria-live="polite">
    <template v-if="wrongBookMode">
      <span class="test-running-score-main">
        已累计答对：
        <strong>{{ wrongBookCorrectCount ?? 0 }}</strong>
        / {{ unitsLength ?? 0 }} 题
      </span>
      <span class="test-running-score-sub">作答题提交后请自评对错；选择题自动判分</span>
    </template>
    <template v-else>
      <span class="test-running-score-main">
        做题累计得分：
        <strong>{{ totalScoreRounded }}</strong>
        分
      </span>
      <span class="test-running-score-sub">全卷满分 {{ runningTotalMax }} 分</span>
    </template>
  </div>
</template>

<style scoped>
.test-running-score-banner {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 14px;
  margin: 0 -14px 0;
  padding: 10px 14px;
  background: var(--app-surface-alt);
  border-bottom: 1px solid var(--app-border-soft);
  font-size: 14px;
}

.test-running-score-main {
  color: var(--app-text, inherit);
}

.test-running-score-main strong {
  font-size: 1.15em;
  color: var(--app-primary, #2563eb);
}

.test-running-score-sub {
  font-size: 13px;
  color: var(--app-text-muted);
}
</style>
