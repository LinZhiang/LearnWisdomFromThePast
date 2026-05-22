<script setup lang="ts">
import type { QuestionBank } from '@/db/models'

const type = defineModel<QuestionBank['type']>('type', { required: true })
const title = defineModel<string>('title', { required: true })
</script>

<template>
  <label>
    <span>题型</span>
    <el-select v-model="type">
      <el-option value="general" label="一般题型" />
      <el-option value="choice" label="选择题型" />
      <el-option value="mindmap" label="思维导图" />
    </el-select>
  </label>
  <label>
    <span>题目名称</span>
    <el-input v-model="title" placeholder="请输入题目名称" />
  </label>
</template>
