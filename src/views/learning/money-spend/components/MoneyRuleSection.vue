<script setup lang="ts">
import '../../question-bank-score/score-section.css'
import { moneyRule } from '../../question-bank-score/hook'
</script>

<template>
  <section class="score-section money-spend-block" aria-labelledby="money-rule-title">
    <h3 id="money-rule-title" class="score-section-title">消费积分规则</h3>
    <pre class="money-rule-body">{{ moneyRule.trim() }}</pre>
  </section>
</template>

<style scoped>
.money-spend-block {
  margin: 0;
}

.money-rule-body {
  margin: 0;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.65;
  color: var(--app-text);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
