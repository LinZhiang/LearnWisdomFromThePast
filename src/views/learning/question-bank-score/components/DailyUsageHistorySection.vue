<script setup lang="ts">
import type { DailyWebUsage } from '@/db/models'
import { formatSecondsAsZh } from '@/utils/formatDuration'

defineProps<{
  rows: DailyWebUsage[]
}>()
</script>

<template>
  <div class="score-section">
    <h3 class="score-section-title">历史学习用时</h3>
    <p v-if="!rows.length" class="score-muted">暂无记录。使用本应用后，按自然日自动累计。</p>
    <div v-else class="score-table-wrap">
      <table class="score-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>累计时长</th>
            <th>最近更新</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.dateKey">
            <td>{{ row.dateKey }}</td>
            <td>{{ formatSecondsAsZh(row.activeSeconds) }}</td>
            <td>{{ row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
