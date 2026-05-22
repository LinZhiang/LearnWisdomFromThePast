<script setup lang="ts">
import type { ExerciseTimeLog } from '@/db/models'

defineProps<{
  exerciseDateKey: string
  exerciseMinutes: number | undefined
  exerciseKind: ExerciseTimeLog['kind']
  exerciseNote: string
  submitting: boolean
}>()

const emit = defineEmits<{
  (e: 'update:exerciseDateKey', v: string): void
  (e: 'update:exerciseMinutes', v: number | undefined): void
  (e: 'update:exerciseKind', v: ExerciseTimeLog['kind']): void
  (e: 'update:exerciseNote', v: string): void
  (e: 'submit'): void
}>()
</script>

<template>
  <div class="score-section">
    <h3 class="score-section-title">锻炼时间登记</h3>
    <p class="score-muted">
      请填写<strong>本次</strong>锻炼时长并选择强度后提交；可多次添加。规则：<strong>一般运动</strong>累计每满
      <strong>30 分钟</strong>为<strong>武分 +30</strong>；<strong>剧烈运动</strong>累计每满
      <strong>30 分钟</strong>为<strong>武分 +90</strong>（余数滚入下次，与「我的文武累计分」同源）。
    </p>
    <div class="score-work-form">
      <label class="score-field">
        <span>日期</span>
        <el-date-picker
          :model-value="exerciseDateKey"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 100%"
          @update:model-value="emit('update:exerciseDateKey', $event)"
        />
      </label>
      <label class="score-field">
        <span>时长（分钟）</span>
        <el-input-number
          :model-value="exerciseMinutes"
          :min="1"
          :max="1440"
          :step="5"
          controls-position="right"
          style="width: 100%"
          @update:model-value="emit('update:exerciseMinutes', $event)"
        />
      </label>
      <div class="score-field score-field--inline">
        <span>强度</span>
        <el-radio-group
          :model-value="exerciseKind"
          @update:model-value="emit('update:exerciseKind', $event)"
        >
          <el-radio value="general">一般运动</el-radio>
          <el-radio value="intense">剧烈运动</el-radio>
        </el-radio-group>
      </div>
      <label class="score-field">
        <span>备注（可选）</span>
        <el-input
          :model-value="exerciseNote"
          type="textarea"
          :rows="2"
          maxlength="200"
          show-word-limit
          @update:model-value="emit('update:exerciseNote', $event)"
        />
      </label>
      <el-button type="primary" :loading="submitting" @click="emit('submit')">提交记录</el-button>
    </div>
  </div>
</template>
