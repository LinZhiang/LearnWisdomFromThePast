<script setup lang="ts">
import { computed } from 'vue'
import {
  QUESTION_BANK_IMPORTANCE_MAX,
  normalizeQuestionBankImportance,
} from '@/utils/questionBankImportance'

const props = defineProps<{
  modelValue?: number | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const displayValue = computed(() => normalizeQuestionBankImportance(props.modelValue))

const onChange = (value: number | null | undefined) => {
  if (props.disabled) return
  if (value == null || Number.isNaN(value) || value < 1) return
  emit('update:modelValue', normalizeQuestionBankImportance(value))
}
</script>

<template>
  <div class="importance-editor" :title="`重要性 ${displayValue} 星（1～4，默认 2）`">
    <el-rate
      :model-value="displayValue"
      :max="QUESTION_BANK_IMPORTANCE_MAX"
      :disabled="disabled"
      @update:model-value="onChange"
    />
  </div>
</template>

<style scoped>
.importance-editor {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.importance-editor :deep(.el-rate) {
  height: auto;
}

.importance-editor :deep(.el-rate__icon) {
  font-size: 16px;
  margin-right: 2px;
}
</style>
