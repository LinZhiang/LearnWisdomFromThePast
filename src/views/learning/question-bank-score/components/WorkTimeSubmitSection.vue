<script setup lang="ts">
import type { WorkTimeLog } from '@/db/models'

defineProps<{
  workDateKey: string
  workMinutes: number | undefined
  workKind: WorkTimeLog['kind']
  workNote: string
  submitting: boolean
}>()

const emit = defineEmits<{
  (e: 'update:workDateKey', v: string): void
  (e: 'update:workMinutes', v: number | undefined): void
  (e: 'update:workKind', v: WorkTimeLog['kind']): void
  (e: 'update:workNote', v: string): void
  (e: 'submit'): void
}>()
</script>

<template>
  <div class="score-section">
    <h3 class="score-section-title">今日工作登记</h3>
    <p class="score-muted">
      若当天有工作安排，请填写<strong>本次</strong>工作/出差时长并选择类型后提交；可多次添加（如上午、下午分段）。折算规则：「工作」按登记分钟累计；「出差」按<strong>登记分钟
      ×1.15</strong>计入工作分后再累计。折算分每满 <strong>1 小时</strong>为<strong>文分 +12、武分 +14</strong>（余数滚入下次，与「我的文武累计分」同源）。
    </p>
    <div class="score-work-form">
      <label class="score-field">
        <span>日期</span>
        <el-date-picker
          :model-value="workDateKey"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 100%"
          @update:model-value="emit('update:workDateKey', $event)"
        />
      </label>
      <label class="score-field">
        <span>时长（分钟）</span>
        <el-input-number
          :model-value="workMinutes"
          :min="1"
          :max="1440"
          :step="15"
          controls-position="right"
          style="width: 100%"
          @update:model-value="emit('update:workMinutes', $event)"
        />
      </label>
      <div class="score-field score-field--inline">
        <span>类型</span>
        <el-radio-group :model-value="workKind" @update:model-value="emit('update:workKind', $event)">
          <el-radio value="work">工作</el-radio>
          <el-radio value="trip">出差</el-radio>
        </el-radio-group>
      </div>
      <label class="score-field">
        <span>备注（可选）</span>
        <el-input
          :model-value="workNote"
          type="textarea"
          :rows="2"
          maxlength="200"
          show-word-limit
          @update:model-value="emit('update:workNote', $event)"
        />
      </label>
      <el-button type="primary" :loading="submitting" @click="emit('submit')">提交记录</el-button>
    </div>
  </div>
</template>
