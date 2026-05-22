<script setup lang="ts">
import type { WorkTimeLog } from '@/db/models'
import { formatMinutesAsZh } from '@/utils/formatDuration'

defineProps<{
  rows: WorkTimeLog[]
}>()

const kindLabel = (k: WorkTimeLog['kind']) => (k === 'trip' ? '出差' : '工作')
</script>

<template>
  <div class="score-section">
    <h3 class="score-section-title">历史工作 / 出差记录</h3>
    <p v-if="!rows.length" class="score-muted">暂无登记。提交后即会出现在下表。</p>
    <div v-else class="score-table-wrap">
      <table class="score-table">
        <thead>
          <tr>
            <th>登记时间</th>
            <th>所属日期</th>
            <th>类型</th>
            <th>时长</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in rows" :key="w.id ?? w.createdAt">
            <td>{{ new Date(w.createdAt).toLocaleString() }}</td>
            <td>{{ w.dateKey }}</td>
            <td>{{ kindLabel(w.kind) }}</td>
            <td>{{ formatMinutesAsZh(w.minutes) }}</td>
            <td>{{ w.note || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
