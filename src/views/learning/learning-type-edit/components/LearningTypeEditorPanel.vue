<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LearningType } from '@/db/models'

type LearningTypeNode = LearningType & {
  level: number
  children: LearningTypeNode[]
}

type DialogMode = 'add-root' | 'add-child' | 'edit'

const props = defineProps<{
  loading: boolean
  treeNodes: LearningTypeNode[]
}>()

const emit = defineEmits<{
  (e: 'create', payload: { parentId?: number; name: string; description: string }): void
  (e: 'update', payload: { id: number; name: string; description: string }): void
  (e: 'remove', id: number): void
}>()

const selectedId = ref<number | null>(null)
const expandedKeys = ref<number[]>([])
const dialogVisible = ref(false)
const dialogMode = ref<DialogMode>('add-root')
const dialogParentId = ref<number | undefined>(undefined)
const dialogEditId = ref<number | null>(null)
const dialogName = ref('')
const dialogDescription = ref('')

const selectedNode = computed(() => {
  if (selectedId.value == null) return null
  const find = (nodes: LearningTypeNode[]): LearningTypeNode | null => {
    for (const n of nodes) {
      if (n.id === selectedId.value) return n
      const hit = find(n.children)
      if (hit) return hit
    }
    return null
  }
  return find(props.treeNodes)
})

const dialogTitle = computed(() => {
  if (dialogMode.value === 'add-root') return '添加根节点'
  if (dialogMode.value === 'add-child') {
    const parent = findNodeById(props.treeNodes, dialogParentId.value)
    return parent ? `在「${parent.name}」下添加子节点` : '添加子节点'
  }
  return dialogEditId.value ? `编辑「${dialogName.value || '节点'}」` : '编辑节点'
})

const dialogPrimaryLabel = computed(() =>
  dialogMode.value === 'edit' ? '保存' : '添加',
)

function findNodeById(nodes: LearningTypeNode[], id?: number | null): LearningTypeNode | null {
  if (id == null) return null
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = findNodeById(n.children, id)
    if (hit) return hit
  }
  return null
}

const collectAllExpandableIds = (nodes: LearningTypeNode[]): number[] => {
  const ids: number[] = []
  const walk = (list: LearningTypeNode[]) => {
    list.forEach((node) => {
      if (node.id && node.children.length > 0) ids.push(node.id)
      if (node.children.length > 0) walk(node.children)
    })
  }
  walk(nodes)
  return ids
}

watch(
  () => props.treeNodes,
  (nodes) => {
    expandedKeys.value = collectAllExpandableIds(nodes)
  },
  { immediate: true, deep: true },
)

const openAddRoot = () => {
  dialogMode.value = 'add-root'
  dialogParentId.value = undefined
  dialogEditId.value = null
  dialogName.value = ''
  dialogDescription.value = ''
  dialogVisible.value = true
}

const openAddChild = (parentId: number) => {
  selectedId.value = parentId
  dialogMode.value = 'add-child'
  dialogParentId.value = parentId
  dialogEditId.value = null
  dialogName.value = ''
  dialogDescription.value = ''
  dialogVisible.value = true
}

const openEdit = (node: LearningTypeNode) => {
  if (!node.id) return
  selectedId.value = node.id
  dialogMode.value = 'edit'
  dialogEditId.value = node.id
  dialogParentId.value = node.parentId
  dialogName.value = node.name
  dialogDescription.value = node.description ?? ''
  dialogVisible.value = true
}

const onNodeClick = (data: LearningTypeNode) => {
  selectedId.value = data.id ?? null
}

const confirmDialog = () => {
  const name = dialogName.value.trim()
  if (!name) return
  const description = dialogDescription.value.trim()
  if (dialogMode.value === 'edit' && dialogEditId.value != null) {
    emit('update', { id: dialogEditId.value, name, description })
  } else {
    emit('create', {
      parentId: dialogMode.value === 'add-child' ? dialogParentId.value : undefined,
      name,
      description,
    })
  }
  dialogVisible.value = false
}

const onRemove = (id?: number) => {
  if (id == null) return
  emit('remove', id)
  if (selectedId.value === id) selectedId.value = null
}
</script>

<template>
  <aside class="type-edit-panel">
    <div class="type-edit-toolbar">
      <el-button type="primary" @click="openAddRoot">添加根节点</el-button>
      <p class="type-edit-tip">点击树节点选中后，可在下方快速添加子节点、重命名或删除。</p>
    </div>

    <div class="type-tree-wrap">
      <p v-if="loading" class="type-edit-muted">加载中…</p>
      <div v-else-if="treeNodes.length === 0" class="type-edit-empty">
        <p>还没有任何分类。</p>
        <el-button type="primary" @click="openAddRoot">添加第一个根节点</el-button>
      </div>
      <el-tree
        v-else
        :data="treeNodes"
        node-key="id"
        :props="{ label: 'name', children: 'children' }"
        :default-expanded-keys="expandedKeys"
        :current-node-key="selectedId ?? undefined"
        highlight-current
        :expand-on-click-node="false"
        @node-click="onNodeClick"
      >
        <template #default="{ data, node }">
          <div class="type-tree-row">
            <span
              class="type-tree-label"
              :class="{
                'is-level-1': node.level === 1,
                'is-level-2': node.level === 2,
              }"
            >
              {{ data.name }}
            </span>
          </div>
        </template>
      </el-tree>
    </div>

    <footer v-if="selectedNode?.id" class="type-edit-selection">
      <p class="type-edit-selection-label">
        已选：<strong>{{ selectedNode.name }}</strong>
      </p>
      <div class="type-edit-selection-actions">
        <el-button size="small" type="primary" plain @click="openAddChild(selectedNode.id!)">
          添加子节点
        </el-button>
        <el-button size="small" @click="openEdit(selectedNode)">重命名</el-button>
        <el-button size="small" type="danger" plain @click="onRemove(selectedNode.id)">
          删除
        </el-button>
      </div>
    </footer>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="min(92vw, 420px)"
      destroy-on-close
      append-to-body
      @closed="dialogName = ''"
    >
      <el-form label-position="top" @submit.prevent="confirmDialog">
        <el-form-item label="名称" required>
          <el-input
            v-model="dialogName"
            placeholder="例如：专题一 · 政治理论"
            maxlength="80"
            show-word-limit
            autofocus
          />
        </el-form-item>
        <el-form-item label="描述（可选）">
          <el-input
            v-model="dialogDescription"
            type="textarea"
            :rows="2"
            placeholder="简要说明该分类用途"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!dialogName.trim()" @click="confirmDialog">
          {{ dialogPrimaryLabel }}
        </el-button>
      </template>
    </el-dialog>
  </aside>
</template>

<style scoped>
.type-edit-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px;
  background: var(--app-surface);
  min-height: 620px;
  overflow: hidden;
}

.type-edit-toolbar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.type-edit-tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.type-tree-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 0;
}

.type-edit-muted,
.type-edit-empty {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-muted);
}

.type-edit-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 4px;
}

.type-tree-wrap :deep(.el-tree) {
  --el-fill-color-blank: transparent;
  background-color: transparent;
  --el-tree-text-color: var(--app-text);
  color: var(--app-text);
}

.type-tree-wrap :deep(.el-tree-node__content) {
  min-height: 36px;
  border-radius: 8px;
}

.type-tree-wrap :deep(.el-tree-node__content:hover) {
  background: var(--app-surface-alt);
}

.type-tree-wrap :deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
}

.type-tree-row {
  display: flex;
  align-items: center;
  width: 100%;
  padding-right: 4px;
}

.type-tree-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--app-text);
}

.type-tree-label.is-level-1 {
  font-size: 16px;
  font-weight: 700;
}

.type-tree-label.is-level-2 {
  font-size: 15px;
  font-weight: 650;
}

.type-edit-selection {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--app-border-soft);
}

.type-edit-selection-label {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--app-text-muted);
}

.type-edit-selection-label strong {
  color: var(--app-text);
  font-weight: 600;
}

.type-edit-selection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
