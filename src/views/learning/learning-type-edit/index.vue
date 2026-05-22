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
const selectedId = ref<number | null>(null)
const editId = ref<number | null>(null)
const form = ref({
  name: '',
  description: '',
})
const items = ref<LearningType[]>([])

const selectedItem = computed(() =>
  items.value.find((item) => item.id === selectedId.value),
)

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

const createType = async (parentId?: number) => {
  if (!form.value.name.trim()) return
  const now = new Date().toISOString()
  await runMutationAndRefresh(() =>
    learningTypeService.create({
      parentId,
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      createdAt: now,
      updatedAt: now,
    }),
  )
  form.value.name = ''
  form.value.description = ''
}

const startEdit = (item: LearningType) => {
  if (!item.id) return
  editId.value = item.id
  form.value.name = item.name
  form.value.description = item.description ?? ''
}

const confirmEdit = async () => {
  if (!editId.value || !form.value.name.trim()) return
  await runMutationAndRefresh(() =>
    learningTypeService.update(editId.value!, {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      updatedAt: new Date().toISOString(),
    }),
  )
  editId.value = null
  form.value.name = ''
  form.value.description = ''
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

const removeType = async (id?: number) => {
  if (!id) return
  const allItems = await learningTypeService.listAll()
  const target = allItems.find((item) => item.id === id)
  if (!target) return
  const ok = window.confirm(`确认删除「${target.name}」及其所有子类吗？`)
  if (!ok) return
  const idsToDelete = [id, ...collectDescendantIds(id, allItems)]
  await runMutationAndRefresh(() =>
    Promise.all(idsToDelete.map((itemId) => learningTypeService.remove(itemId))),
  )
  if (selectedId.value && idsToDelete.includes(selectedId.value)) {
    selectedId.value = null
  }
}

const mapToChartNode = (node: LearningTypeNode): ChartTreeNode => ({
  name: node.name,
  value: node.description || '',
  children: node.children.map((child) => mapToChartNode(child)),
})

const chartData = computed(() => treeNodes.value.map((node) => mapToChartNode(node)))

const updateForm = (value: { name: string; description: string }) => {
  form.value = value
}

onMounted(async () => {
  await refreshItems()
})
</script>

<template>
  <section class="learning-type-page">
    <header class="page-hero">
      <span class="page-kicker">智学 01</span>
      <h2 class="page-title">学习类型编辑</h2>
      <p class="page-subtitle">点击左侧树节点后显示操作按钮，并同步展示 ECharts 树图。</p>
    </header>

    <div class="type-layout">
      <LearningTypeEditorPanel
        :loading="loading"
        :tree-nodes="treeNodes"
        :selected-id="selectedId"
        :edit-id="editId"
        :form="form"
        :selected-item="selectedItem"
        @update:selected-id="selectedId = $event"
        @update:form="updateForm"
        @create-parent="createType()"
        @create-child="createType($event)"
        @save-edit="confirmEdit"
        @start-edit="startEdit"
        @remove="removeType"
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
