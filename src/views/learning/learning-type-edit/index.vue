<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { LearningType } from '@/db/models'
import { learningTypeService } from '@/services/data-services'
import LearningTypeEditorPanel from './components/LearningTypeEditorPanel.vue'
import LearningTypeTreeChart from './components/LearningTypeTreeChart.vue'

type LearningTypeNode = LearningType & {
  level: number
  children: LearningTypeNode[]
}

type ChartTreeNode = {
  name: string
  value: string
  children: ChartTreeNode[]
}

const loading = ref(false)
const items = ref<LearningType[]>([])

const treeNodes = computed<LearningTypeNode[]>(() => {
  const map = new Map<number, LearningTypeNode>()
  const roots: LearningTypeNode[] = []

  items.value.forEach((item) => {
    if (!item.id) return
    map.set(item.id, { ...item, level: 0, children: [] })
  })

  map.forEach((node) => {
    const parentId = node.parentId
    if (parentId && map.has(parentId)) {
      const parentNode = map.get(parentId)!
      node.level = parentNode.level + 1
      parentNode.children.push(node)
      return
    }
    roots.push(node)
  })

  return roots
})

const refreshItems = async () => {
  loading.value = true
  items.value = await learningTypeService.listAll()
  loading.value = false
}

const runMutationAndRefresh = async (action: () => Promise<unknown>) => {
  await action()
  await refreshItems()
}

const onCreate = async (payload: { parentId?: number; name: string; description: string }) => {
  const now = new Date().toISOString()
  await runMutationAndRefresh(() =>
    learningTypeService.create({
      parentId: payload.parentId,
      name: payload.name,
      description: payload.description,
      createdAt: now,
      updatedAt: now,
    }),
  )
}

const onUpdate = async (payload: { id: number; name: string; description: string }) => {
  await runMutationAndRefresh(() =>
    learningTypeService.update(payload.id, {
      name: payload.name,
      description: payload.description,
      updatedAt: new Date().toISOString(),
    }),
  )
}

const collectDescendantIds = (parentId: number, allItems: LearningType[]) => {
  const childIds = allItems.filter((item) => item.parentId === parentId).map((item) => item.id)
  const validChildIds = childIds.filter((id): id is number => typeof id === 'number')
  const descendantIds = [...validChildIds]
  validChildIds.forEach((id) => {
    descendantIds.push(...collectDescendantIds(id, allItems))
  })
  return descendantIds
}

const onRemove = async (id: number) => {
  const allItems = await learningTypeService.listAll()
  const target = allItems.find((item) => item.id === id)
  if (!target) return
  const ok = window.confirm(`确认删除「${target.name}」及其所有子节点吗？`)
  if (!ok) return
  const idsToDelete = [id, ...collectDescendantIds(id, allItems)]
  await runMutationAndRefresh(() =>
    Promise.all(idsToDelete.map((itemId) => learningTypeService.remove(itemId))),
  )
}

const mapToChartNode = (node: LearningTypeNode): ChartTreeNode => ({
  name: node.name,
  value: node.description || '',
  children: node.children.map((child) => mapToChartNode(child)),
})

const chartData = computed(() => treeNodes.value.map((node) => mapToChartNode(node)))

onMounted(async () => {
  await refreshItems()
})
</script>

<template>
  <section class="learning-type-page">
    <header class="page-hero">
      <span class="page-kicker">智学 01</span>
      <h2 class="page-title">学习类型编辑</h2>
      <p class="page-subtitle">
        左侧管理分类树：添加根节点建立大类，选中节点后可添加子节点；右侧实时预览结构图。
      </p>
    </header>

    <div class="type-layout">
      <LearningTypeEditorPanel
        :loading="loading"
        :tree-nodes="treeNodes"
        @create="onCreate"
        @update="onUpdate"
        @remove="onRemove"
      />
      <LearningTypeTreeChart :data="chartData" />
    </div>
  </section>
</template>

<style scoped>
.learning-type-page {
  display: grid;
  gap: 12px;
}

.learning-type-page p {
  color: var(--app-text-muted);
}

.type-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 12px;
  min-height: 620px;
}
</style>
