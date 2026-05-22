<script setup lang="ts">
import type { LearningType } from '@/db/models'
import LearningTypeTreePanel from '@/components/LearningTypeTreePanel.vue'

type LearningTypeNode = LearningType & {
  level: number
  children: LearningTypeNode[]
}

defineProps<{
  loading: boolean
  treeNodes: LearningTypeNode[]
  selectedId: number | null
  editId: number | null
  form: {
    name: string
    description: string
  }
  selectedItem: LearningType | undefined
}>()

const emit = defineEmits<{
  (e: 'update:selectedId', value: number | null): void
  (e: 'update:form', value: { name: string; description: string }): void
  (e: 'create-parent'): void
  (e: 'create-child', parentId?: number): void
  (e: 'save-edit'): void
  (e: 'start-edit', item: LearningType): void
  (e: 'remove', id?: number): void
}>()
</script>

<template>
  <LearningTypeTreePanel
    :loading="loading"
    :tree-nodes="treeNodes"
    :selected-id="selectedId"
    type-edit-tree
    :show-form="true"
    :show-node-actions="true"
    :form="form"
    :edit-id="editId"
    :selected-item="selectedItem"
    @update:selected-id="emit('update:selectedId', $event)"
    @update:form="emit('update:form', $event)"
    @create-parent="emit('create-parent')"
    @create-child="emit('create-child', $event)"
    @save-edit="emit('save-edit')"
    @start-edit="emit('start-edit', $event)"
    @remove="emit('remove', $event)"
  />
</template>
