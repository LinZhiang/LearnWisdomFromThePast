<script setup lang="ts">
import type { WrongQuestionTrash } from '@/db/models'

const props = defineProps<{
  loading: boolean
  rows: WrongQuestionTrash[]
  selectedIds: number[]
  allSelected: boolean
  indeterminate: boolean
  parseTitle: (row: WrongQuestionTrash) => string
  formatTime: (iso: string) => string
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'toggle-all', checked: boolean): void
  (e: 'toggle-row', id?: number): void
  (e: 'restore-selected'): void
  (e: 'purge-selected'): void
  (e: 'clear-selected'): void
}>()
</script>

<template>
  <section class="trash-panel">
    <div class="trash-head">
      <h3>错题回收站</h3>
      <div class="trash-actions">
        <el-button @click="emit('back')">返回错题本</el-button>
        <el-button type="primary" @click="emit('restore-selected')">恢复勾选</el-button>
        <el-button type="danger" plain @click="emit('purge-selected')">彻底删除</el-button>
        <el-button plain @click="emit('clear-selected')">清空勾选</el-button>
      </div>
    </div>
    <p v-if="loading">加载中...</p>
    <p v-else-if="!rows.length">回收站暂无记录。</p>
    <div v-else class="trash-table">
      <div class="trash-row trash-head-row">
        <span class="cell-check">
          <el-checkbox
            :model-value="allSelected"
            :indeterminate="indeterminate"
            @change="emit('toggle-all', $event)"
          />
        </span>
        <span>题目</span>
        <span>删除时间</span>
      </div>
      <div v-for="row in rows" :key="row.id" class="trash-row">
        <span class="cell-check">
          <el-checkbox
            :model-value="row.id != null && selectedIds.includes(row.id)"
            @change="emit('toggle-row', row.id)"
          />
        </span>
        <span class="cell-title">{{ parseTitle(row) }}</span>
        <span>{{ formatTime(row.deletedAt) }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.trash-panel {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface);
  padding: 12px;
  min-height: 0;
  height: 100%;
  overflow: auto;
}

.trash-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.trash-head h3 {
  margin: 0;
}

.trash-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.trash-table {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  overflow: hidden;
}

.trash-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 220px;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.trash-head-row {
  background: var(--app-surface-alt);
  font-weight: 600;
}

.trash-row:last-child {
  border-bottom: none;
}

.cell-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cell-title {
  min-width: 0;
  word-break: break-word;
}
</style>

