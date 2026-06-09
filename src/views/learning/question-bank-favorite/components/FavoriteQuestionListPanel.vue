<script setup lang="ts">
import type { FavoriteQuestion } from '@/db/models'
import type { LearningTypeTreeTableRow } from '@/utils/questionBankTreeTable'

defineProps<{
  loading: boolean
  selectedLearningTypeId: number | null
  selectedLearningTypeName: string
  message: string
  rows: FavoriteQuestion[]
  isParentNodeSelected: boolean
  parentHint: string
  parentTreeTableRows: LearningTypeTreeTableRow<FavoriteQuestion>[]
  isTreeBranchExpanded: (branchId: string) => boolean
  rowKeyForTreeRow: (row: LearningTypeTreeTableRow<FavoriteQuestion>, idx: number) => string
  rowTitle: (f: FavoriteQuestion) => string
  rowTypeLabel: (f: FavoriteQuestion) => string
}>()

const emit = defineEmits<{
  (e: 'open', item: FavoriteQuestion): void
  (e: 'remove', id?: number): void
  (e: 'test'): void
  (e: 'toggle-branch', branchId: string): void
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
    <div class="favorite-list-head">
      <p class="favorite-list-topic">
        当前节点：<strong>{{ selectedLearningTypeName }}</strong>
      </p>
      <div class="favorite-header-actions">
        <el-button
          :disabled="!selectedLearningTypeId || rows.length === 0"
          @click="emit('test')"
        >
          测验
        </el-button>
      </div>
    </div>
    <div class="favorite-list-body">
      <p v-if="loading" class="favorite-hint">收藏数据加载中...</p>
      <p v-if="message" class="favorite-hint">{{ message }}</p>
      <p v-if="!selectedLearningTypeId" class="favorite-hint">请先从左侧树中选择学习类型。</p>
      <template v-else>
        <p v-if="isParentNodeSelected" class="parent-node-hint">{{ parentHint }}</p>
        <p v-if="!loading && rows.length === 0" class="favorite-hint">当前节点下暂无收藏。</p>
        <div
          v-else-if="!loading && rows.length > 0"
          class="favorite-table"
          :class="{ 'favorite-table--tree': isParentNodeSelected }"
        >
          <div class="favorite-table-head">
            <span>名称</span>
            <span>内容类型</span>
            <span>收藏时间</span>
            <span>操作</span>
          </div>
          <div class="favorite-table-body">
            <template v-if="isParentNodeSelected">
              <template
                v-for="(treeRow, idx) in parentTreeTableRows"
                :key="rowKeyForTreeRow(treeRow, idx)"
              >
                <div
                  v-if="treeRow.kind === 'branch'"
                  class="favorite-tree-branch"
                  :class="{ 'is-expanded': isTreeBranchExpanded(treeRow.branchId) }"
                  :style="{ '--fav-tree-depth': treeRow.depth }"
                  role="button"
                  tabindex="0"
                  :aria-expanded="isTreeBranchExpanded(treeRow.branchId)"
                  @click="emit('toggle-branch', treeRow.branchId)"
                  @keydown.enter.prevent="emit('toggle-branch', treeRow.branchId)"
                  @keydown.space.prevent="emit('toggle-branch', treeRow.branchId)"
                >
                  <span class="favorite-tree-chevron" aria-hidden="true">{{
                    isTreeBranchExpanded(treeRow.branchId) ? '▼' : '▶'
                  }}</span>
                  <span class="favorite-tree-branch-label">{{ treeRow.node.name }}</span>
                  <span
                    v-if="
                      !isTreeBranchExpanded(treeRow.branchId) && treeRow.descendantCount > 0
                    "
                    class="favorite-tree-branch-meta"
                  >
                    {{ treeRow.descendantCount }} 条
                  </span>
                </div>
                <div
                  v-else
                  class="favorite-table-row is-row-open-detail favorite-table-row--tree-entry"
                  :style="{ '--fav-tree-depth': treeRow.depth }"
                  role="button"
                  tabindex="0"
                  @click="emit('open', treeRow.item)"
                  @keydown.enter.prevent="emit('open', treeRow.item)"
                  @keydown.space.prevent="emit('open', treeRow.item)"
                >
                  <span class="favorite-tree-entry-title" :title="rowTitle(treeRow.item)">{{
                    rowTitle(treeRow.item)
                  }}</span>
                  <span>{{ rowTypeLabel(treeRow.item) }}</span>
                  <span>{{ formatTime(treeRow.item.createdAt) }}</span>
                  <div class="favorite-row-actions" @click.stop>
                    <el-button size="small" @click="emit('open', treeRow.item)">查看</el-button>
                    <el-button size="small" type="danger" @click="emit('remove', treeRow.item.id)">
                      取消收藏
                    </el-button>
                  </div>
                </div>
              </template>
            </template>
            <template v-else>
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
                <span :title="rowTitle(item)">{{ rowTitle(item) }}</span>
                <span>{{ rowTypeLabel(item) }}</span>
                <span>{{ formatTime(item.createdAt) }}</span>
                <div class="favorite-row-actions" @click.stop>
                  <el-button size="small" @click="emit('open', item)">查看</el-button>
                  <el-button size="small" type="danger" @click="emit('remove', item.id)">
                    取消收藏
                  </el-button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.favorite-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px;
  gap: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--app-surface);
  box-sizing: border-box;
}

.favorite-list-head {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.favorite-list-topic {
  margin: 0;
}

.favorite-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.favorite-list-body {
  flex: 1 1 auto;
  min-height: 0;
  margin-right: -12px;
  padding-right: 12px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.favorite-hint,
.parent-node-hint {
  margin: 0 0 10px;
  color: var(--app-text-muted);
}

.favorite-table {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.favorite-table-body {
  min-height: 0;
}

.favorite-table-head,
.favorite-table-row {
  display: grid;
  grid-template-columns: 1.35fr 0.72fr 0.88fr 1fr;
  align-items: center;
  padding: 10px 12px;
  gap: 10px;
}

.favorite-table-head {
  flex-shrink: 0;
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

.favorite-tree-branch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px 9px calc(12px + var(--fav-tree-depth, 0) * var(--fav-tree-indent, 16px));
  font-weight: 600;
  font-size: calc(var(--app-handout-font-size, 14px) * 1.02);
  color: var(--app-text);
  background: var(--app-surface-alt);
  border-bottom: 1px solid var(--app-border-soft);
  cursor: pointer;
  user-select: none;
}

.favorite-tree-branch:hover {
  background: color-mix(in srgb, var(--app-surface-alt) 88%, var(--app-primary-soft));
}

.favorite-tree-branch.is-expanded {
  background: color-mix(in srgb, var(--app-primary-soft) 55%, var(--app-surface-alt));
}

.favorite-tree-chevron {
  flex-shrink: 0;
  width: 1.1em;
  font-size: 0.72em;
  line-height: 1;
  color: var(--app-text-muted);
}

.favorite-tree-branch-label {
  flex: 1 1 auto;
  min-width: 0;
}

.favorite-tree-branch-meta {
  flex-shrink: 0;
  font-size: 0.86em;
  font-weight: 500;
  color: var(--app-text-muted);
}

.favorite-table-row--tree-entry {
  padding-left: calc(12px + var(--fav-tree-depth, 0) * var(--fav-tree-indent, 16px));
}

.favorite-tree-entry-title {
  position: relative;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.45;
  padding-left: 0.65em;
}

.favorite-tree-entry-title::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--app-text-muted);
}

.favorite-row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-start;
}
</style>
