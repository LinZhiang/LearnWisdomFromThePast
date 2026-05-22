<script setup lang="ts">
import { RANK_LIST } from '../rank-data'
</script>

<template>
  <div class="score-section rank-table-sticky rank-table-section">
    <h3 class="score-section-title">文武品阶阈值表</h3>
    <p class="score-muted">
      <strong>文</strong>累计分只看「文职 / 文说明」两列；<strong>武</strong>累计分只看「武职 / 武说明」两列。各自达到阈值即视为达到该档品阶（取已达成的最高一档）。
    </p>
    <div class="score-table-wrap rank-table-wrap">
      <table class="score-table rank-table-wide">
        <thead>
          <tr>
            <th class="rank-col-score">分数阈值</th>
            <th class="rank-col-wen-name">文职</th>
            <th class="rank-col-wen-explain">文说明</th>
            <th class="rank-col-wu-name">武职</th>
            <th class="rank-col-wu-explain">武说明</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in RANK_LIST" :key="idx">
            <td class="rank-col-score">{{ row.score }}</td>
            <td class="rank-col-wen-name">{{ row.wenguan }}</td>
            <td class="rank-col-wen-explain">
              <p v-if="row.wenExplain" class="score-rank-explain">{{ row.wenExplain }}</p>
              <span v-else class="rank-cell-empty">—</span>
            </td>
            <td class="rank-col-wu-name">{{ row.wuguan }}</td>
            <td class="rank-col-wu-explain">
              <p v-if="row.wuExplain" class="score-rank-explain">{{ row.wuExplain }}</p>
              <span v-else class="rank-cell-empty">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.rank-table-sticky :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 1;
  box-shadow: 0 1px 0 var(--app-border-soft);
}

.rank-table-wrap {
  overflow-x: auto;
}

.rank-table-wide {
  width: 100%;
  min-width: 72rem;
  table-layout: fixed;
}

.rank-col-score {
  width: 5.5rem;
}

.rank-col-wen-name,
.rank-col-wu-name {
  width: 9rem;
}

.rank-col-wen-explain,
.rank-col-wu-explain {
  width: auto;
}

.rank-cell-empty {
  color: var(--app-text-muted);
  font-size: 12px;
}

.rank-table-section .score-muted strong {
  color: var(--app-text);
  font-weight: 600;
}
</style>
