<script setup lang="ts">
import { ref, watch } from 'vue'
import { Delete, Edit, Plus } from '@element-plus/icons-vue'
import type { Node as ElTreeNode } from 'element-plus/es/components/tree/src/model/node'
import type { LearningType } from '@/db/models'

type LearningTypeNode = LearningType & {
  level: number
  children: LearningTypeNode[]
}

const props = withDefaults(
  defineProps<{
    loading: boolean
    treeNodes: LearningTypeNode[]
    selectedId: number | null
    showForm?: boolean
    showNodeActions?: boolean
    /** 为 true 时仅叶子节点会更新选中并联动右侧；点击父节点只展开/收起 */
    leafSelectableOnly?: boolean
    form?: {
      name: string
      description: string
    }
    editId?: number | null
    selectedItem?: LearningType
    /** 已在学习题库「测试全部」中整库全对的学习类型 id（用于叶子节点标记） */
    perfectClearedIds?: number[]
    /** 学习类型编辑页：略放大字号、统一字重与主题字色，便于长时间编辑 */
    typeEditTree?: boolean
  }>(),
  {
    showForm: false,
    showNodeActions: false,
    leafSelectableOnly: false,
    form: () => ({
      name: '',
      description: '',
    }),
    editId: null,
    selectedItem: undefined,
    perfectClearedIds: () => [],
    typeEditTree: false,
  },
)

const emit = defineEmits<{
  (e: 'update:selectedId', value: number | null): void
  (e: 'update:form', value: { name: string; description: string }): void
  (e: 'create-parent'): void
  (e: 'create-child', parentId?: number): void
  (e: 'save-edit'): void
  (e: 'start-edit', item: LearningType): void
  (e: 'remove', id?: number): void
}>()

const expandedKeys = ref<number[]>([])

const collectTopTwoLevelExpandableIds = (nodes: LearningTypeNode[]) => {
  const ids: number[] = []
  const walk = (list: LearningTypeNode[], depth: number) => {
    list.forEach((node) => {
      if (node.id && node.children.length > 0 && depth < 2) {
        ids.push(node.id)
      }
      if (node.children.length > 0) {
        walk(node.children, depth + 1)
      }
    })
  }
  walk(nodes, 0)
  return ids
}

const applyDefaultExpand = () => {
  expandedKeys.value = collectTopTwoLevelExpandableIds(props.treeNodes)
}

const handleNodeClick = (data: LearningTypeNode, node: ElTreeNode) => {
  const hasChildren = data.children.length > 0
  if (props.leafSelectableOnly && hasChildren) {
    if (node.expanded) node.collapse()
    else node.expand()
    return
  }
  emit('update:selectedId', data.id ?? null)
}

watch(
  () => props.treeNodes,
  () => {
    applyDefaultExpand()
  },
  { immediate: true, deep: true },
)

watch(
  () => props.loading,
  (loading) => {
    if (!loading) applyDefaultExpand()
  },
)
</script>

<template>
  <aside class="type-panel" :class="{ 'type-panel--type-edit-tree': typeEditTree }">
    <div v-if="showForm" class="type-form">
      <el-input
        :model-value="form.name"
        placeholder="请输入类型名称"
        @update:model-value="
          emit('update:form', {
            ...form,
            name: String($event ?? ''),
          })
        "
      />
      <el-input
        :model-value="form.description"
        placeholder="请输入描述（可选）"
        @update:model-value="
          emit('update:form', {
            ...form,
            description: String($event ?? ''),
          })
        "
      />
      <div class="type-actions">
        <el-button plain :disabled="!selectedItem" @click="emit('create-child', selectedItem?.id)">
          新增子类
        </el-button>
        <el-button type="primary" @click="emit('create-parent')">新增父类</el-button>
        <el-button v-if="editId" type="primary" @click="emit('save-edit')">保存修改</el-button>
      </div>
    </div>

    <div class="type-tree-list">
      <p v-if="loading">加载中...</p>
      <p v-else-if="treeNodes.length === 0">暂无学习类型，请先去学习类型编辑新增。</p>
      <el-tree
        v-else
        :data="treeNodes"
        node-key="id"
        :props="{ label: 'name', children: 'children' }"
        :default-expanded-keys="expandedKeys"
        :current-node-key="selectedId ?? undefined"
        highlight-current
        :expand-on-click-node="false"
        @node-click="handleNodeClick"
      >
        <template #default="{ data, node }">
          <div class="type-node">
            <span
              class="node-label"
              :class="{
                'node-label-level-1': node.level === 1,
                'node-label-level-2': node.level === 2,
              }"
            >
              {{ data.name }}
              <el-tag
                v-if="
                  data.id &&
                  data.children.length === 0 &&
                  perfectClearedIds.includes(data.id)
                "
                class="perfect-cleared-node-tag"
                type="success"
                size="small"
                effect="plain"
              >
                全对
              </el-tag>
            </span>
            <div
              v-if="showNodeActions && selectedId === data.id"
              class="node-actions"
              @click.stop
            >
              <el-tooltip content="编辑" placement="top">
                <el-button
                  class="node-icon-btn"
                  :icon="Edit"
                  circle
                  size="small"
                  @click="emit('start-edit', data)"
                />
              </el-tooltip>
              <el-tooltip content="新增子类" placement="top">
                <el-button
                  class="node-icon-btn"
                  :icon="Plus"
                  circle
                  size="small"
                  @click="emit('create-child', data.id)"
                />
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <el-button
                  class="node-icon-btn"
                  :icon="Delete"
                  circle
                  size="small"
                  type="danger"
                  @click="emit('remove', data.id)"
                />
              </el-tooltip>
            </div>
          </div>
        </template>
      </el-tree>
    </div>
  </aside>
</template>

<style scoped>
/* 与顶栏、主内容区一致：衬底走 app-shell 上的 --app-surface（随「顶栏与内容面板透明度」联动） */
.type-panel {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px;
  background: var(--app-surface);
  min-height: 0;
  height: 100%;
  overflow: auto;
}

.type-form :deep(.el-input__wrapper) {
  box-shadow: none;
  border: none;
  background: transparent;
}

.type-form {
  display: grid;
  gap: 12px;
  margin-bottom: 10px;
  padding: 2px 2px 8px;
  border-bottom: 1px solid var(--app-border-soft);
}

.type-form :deep(.el-input__wrapper) {
  padding: 2px 0;
}

.type-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.type-actions :deep(.el-button) {
  margin: 0;
}

.type-tree-list {
  min-height: 0;
  overflow: auto;
  border-top: 1px solid var(--app-border-soft);
  padding-top: 8px;
}

/* 与页面主题字色一致，避免深色主题下仍用偏暗的 --el-text-color-regular 导致看不清 */
.type-tree-list :deep(.el-tree) {
  /* 避免与 .type-panel 的 --app-surface 叠两层，否则树区会比上方透明输入区更「闷」 */
  --el-fill-color-blank: transparent;
  background-color: transparent;
  --el-tree-text-color: var(--app-text);
  --el-tree-expand-icon-color: var(--app-text-muted);
  color: var(--app-text);
}

.type-tree-list :deep(.el-tree-node__content) {
  color: var(--app-text);
  text-shadow: none;
}

.type-tree-list :deep(.node-label) {
  text-shadow: none;
  -webkit-text-stroke: 0 transparent;
}

.type-node {
  display: flex;
  align-items: center;
  width: 100%;
}

.node-label {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  font-weight: 400;
  color: var(--app-text);
}

.perfect-cleared-node-tag {
  flex-shrink: 0;
}

.node-label-level-1 {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.45;
}

.node-label-level-2 {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
}

.type-tree-list :deep(.el-tree-node__content) {
  min-height: 34px;
  padding-top: 4px;
  padding-bottom: 4px;
  border-radius: 8px;
}

.type-tree-list :deep(.el-tree-node__content .node-label-level-1),
.type-tree-list :deep(.el-tree-node__content .node-label-level-2) {
  margin-top: 2px;
  margin-bottom: 2px;
}

.node-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0;
}

.node-icon-btn {
  padding: 6px;
}

.node-actions :deep(.el-button + .el-button) {
  margin-left: 6px;
}

.type-tree-list :deep(.el-tree-node__content:hover) {
  background: var(--app-surface-alt);
}

.type-tree-list :deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
}

/* 学习类型编辑：树节点字体更易读，层级用字号区分而非过大跳变 */
.type-panel--type-edit-tree.type-panel {
  font-family: inherit;
}

.type-panel--type-edit-tree .type-tree-list :deep(.el-tree) {
  font-family: inherit;
  font-size: 14px;
}

.type-panel--type-edit-tree .node-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.02em;
}

.type-panel--type-edit-tree .node-label-level-1 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.type-panel--type-edit-tree .node-label-level-2 {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.03em;
}

.type-panel--type-edit-tree .type-tree-list :deep(.el-tree-node__content) {
  min-height: 38px;
}
</style>
