<script setup lang="ts">
import type { FavoriteQuestion } from '@/db/models'

defineProps<{
  loading: boolean
  selectedLearningTypeId: number | null
  selectedLearningTypeName: string
  message: string
  rows: FavoriteQuestion[]
  rowTitle: (f: FavoriteQuestion) => string
  rowTypeLabel: (f: FavoriteQuestion) => string
}>()

const emit = defineEmits<{
  (e: 'open', item: FavoriteQuestion): void
  (e: 'remove', id?: number): void
  (e: 'test'): void
}>()

const formatTime = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="favorite-list">
    <div class="favorite-header">
      <p>
        当前节点：<strong>{{ selectedLearningTypeName }}</strong>
      </p>
      <el-button @click="emit('test')">题目测试</el-button>
    </div>
    <p v-if="loading">收藏数据加载中...</p>
    <p v-if="message">{{ message }}</p>
    <p v-if="!selectedLearningTypeId">请先从左侧树中选择学习类型。</p>
    <template v-else>
      <p v-if="!loading && rows.length === 0">当前类型下暂无收藏。</p>
      <div v-else class="favorite-table">
        <div class="favorite-table-head">
          <span>题目摘要</span>
          <span>题型</span>
          <span>收藏时间</span>
          <span>操作</span>
        </div>
        <div
          v-for="item in rows"
          :key="item.id"
          class="favorite-table-row is-row-open-detail"
          role="button"
          tabindex="0"
          @click="emit('open', item)"
          @keydown.enter.prevent="emit('open', item)"
          @keydown.space.prevent="emit('open', item)"
        >
          <span>{{ rowTitle(item) }}</span>
          <span>{{ rowTypeLabel(item) }}</span>
          <span>{{ formatTime(item.createdAt) }}</span>
          <div class="favorite-row-actions" @click.stop>
            <el-button size="small" @click="emit('open', item)">查看</el-button>
            <el-button size="small" type="danger" @click="emit('remove', item.id)">
              取消收藏
            </el-button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.favorite-list {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: var(--app-surface);
}

.favorite-list p {
  color: var(--app-text-muted);
}

.favorite-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.favorite-table {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  display: grid;
  overflow: hidden;
  min-height: 0;
}

.favorite-table-head,
.favorite-table-row {
  display: grid;
  grid-template-columns: 1.4fr 0.55fr 0.85fr 0.95fr;
  align-items: center;
  padding: 8px 10px;
  gap: 8px;
}

.favorite-table-head {
  background: var(--app-surface-alt);
  font-weight: 600;
  border-bottom: 1px solid var(--app-border-soft);
}

.favorite-table-row {
  border-bottom: 1px solid var(--app-border-soft);
}

.favorite-table-row:last-child {
  border-bottom: none;
}

.favorite-table-row.is-row-open-detail {
  cursor: pointer;
}

.favorite-table-row.is-row-open-detail:hover {
  background: var(--app-surface-alt);
}

.favorite-row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
