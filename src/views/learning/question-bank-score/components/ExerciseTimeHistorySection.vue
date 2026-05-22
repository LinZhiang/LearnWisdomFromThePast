<script setup lang="ts">
import type { ExerciseTimeLog } from '@/db/models'
import { formatMinutesAsZh } from '@/utils/formatDuration'

defineProps<{
  rows: ExerciseTimeLog[]
}>()

const kindLabel = (k: ExerciseTimeLog['kind']) => (k === 'intense' ? '剧烈运动' : '一般运动')
</script>

<template>
  <div class="score-section">
    <h3 class="score-section-title">历史锻炼记录</h3>
    <p v-if="!rows.length" class="score-muted">暂无登记。提交后即会出现在下表。</p>
    <div v-else class="score-table-wrap">
      <table class="score-table">
        <thead>
          <tr>
            <th>登记时间</th>
            <th>所属日期</th>
            <th>强度</th>
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
