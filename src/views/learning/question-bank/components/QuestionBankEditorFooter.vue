<script setup lang="ts">
defineProps<{
  mode: 'create' | 'edit'
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'submit'): void
}>()
</script>

<template>
  <div class="question-bank-actions">
    <el-button plain @click="emit('cancel')">取消</el-button>
    <el-button type="primary" :loading="loading" @click="emit('submit')">
      {{ mode === 'edit' ? '保存修改' : '新增题目' }}
    </el-button>
  </div>
</template>

<style scoped>
.question-bank-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 6px;
}
</style>
