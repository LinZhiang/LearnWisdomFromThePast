<script setup lang="ts">
import type { QuestionBank } from '@/db/models'

defineProps<{
  mode: 'create' | 'edit'
  createLearningTypeName?: string
  learningTypeOptions?: { value: number; label: string }[]
}>()

const type = defineModel<QuestionBank['type']>('type', { required: true })
const title = defineModel<string>('title', { required: true })
const learningTypeId = defineModel<string>('learningTypeId')
</script>

<template>
  <div class="editor-basics">
  <label>
    <span>内容类型</span>
    <el-select v-model="type">
      <el-option value="general" label="作答题" />
      <el-option value="choice" label="选择题" />
      <el-option value="mindmap" label="思维导图" />
      <el-option value="handout" label="讲义" />
    </el-select>
  </label>
  <label v-if="mode === 'create' && createLearningTypeName">
    <span>所属分类</span>
    <span class="readonly-type">{{ createLearningTypeName }}</span>
  </label>
  <label v-else-if="mode === 'edit' && learningTypeOptions?.length">
    <span>所属分类</span>
    <el-select v-model="learningTypeId" filterable placeholder="请选择所属分类">
      <el-option
        v-for="opt in learningTypeOptions"
        :key="opt.value"
        :value="String(opt.value)"
        :label="opt.label"
      />
    </el-select>
  </label>
  <label>
    <span>名称</span>
    <el-input v-model="title" placeholder="请输入名称" />
  </label>
  </div>
</template>

<style scoped>
.editor-basics {
  display: grid;
  gap: 12px;
  flex-shrink: 0;
}

.readonly-type {
  color: var(--el-text-color-regular);
  line-height: 32px;
}
</style>
