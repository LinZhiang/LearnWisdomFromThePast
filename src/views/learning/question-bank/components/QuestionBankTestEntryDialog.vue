<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QuestionBank } from '@/db/models'
import type { QuestionBankTestLeafEntryPayload } from './questionBankTestTypes'

const props = defineProps<{
  modelValue: boolean
  nodeName: string
  questions: QuestionBank[]
  typeTextMap: Record<QuestionBank['type'], string>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm', payload: QuestionBankTestLeafEntryPayload): void
}>()

const scope = ref<'all' | 'partial'>('all')
const selectedIds = ref<number[]>([])

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const listable = computed(() =>
  props.questions.filter((q): q is QuestionBank & { id: number } => q.id != null),
)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    scope.value = 'all'
    selectedIds.value = listable.value.map((q) => q.id)
  },
)

const selectAll = () => {
  selectedIds.value = listable.value.map((q) => q.id)
}

const clearAll = () => {
  selectedIds.value = []
}

const primaryDisabled = computed(() => {
  if (listable.value.length === 0) return true
  if (scope.value === 'partial' && selectedIds.value.length === 0) return true
  return false
})

const onConfirm = () => {
  if (primaryDisabled.value) return
  if (scope.value === 'all') {
    emit('confirm', { scope: 'all' })
  } else {
    emit('confirm', { scope: 'partial', questionIds: [...selectedIds.value] })
  }
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="题目测试"
    width="min(92vw, 520px)"
    class="test-entry-dialog"
    destroy-on-close
    append-to-body
  >
    <p v-if="listable.length === 0" class="test-entry-empty">当前节点下暂无题目。</p>
    <template v-else>
      <p class="test-entry-lead">
        当前节点：<strong>{{ nodeName }}</strong>
      </p>

      <el-radio-group v-model="scope" class="test-entry-scope">
        <el-radio value="all" size="large">测试全部</el-radio>
        <el-radio value="partial" size="large">测试部分（勾选题目）</el-radio>
      </el-radio-group>

      <section v-if="scope === 'partial'" class="test-entry-partial">
        <div class="test-entry-partial-actions">
          <el-button text type="primary" @click="selectAll">全选</el-button>
          <el-button text type="primary" @click="clearAll">清空</el-button>
          <span class="test-entry-count">已选 {{ selectedIds.length }} / {{ listable.length }} 道</span>
        </div>
        <el-scrollbar max-height="min(52vh, 320px)" class="test-entry-scroll">
          <el-checkbox-group v-model="selectedIds" class="test-entry-checkgroup">
            <div v-for="q in listable" :key="q.id" class="test-entry-row">
              <el-checkbox :label="q.id">
                <span class="test-entry-title">{{ q.title }}</span>
                <span class="test-entry-type">{{ typeTextMap[q.type ?? 'general'] }}</span>
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </el-scrollbar>
      </section>
    </template>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="primaryDisabled" @click="onConfirm">开始测试</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.test-entry-lead {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--app-text-muted);
}

.test-entry-scope {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 4px;
}

.test-entry-partial {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--app-border-soft);
}

.test-entry-partial-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-bottom: 10px;
}

.test-entry-count {
  font-size: 13px;
  color: var(--app-text-muted);
}

.test-entry-checkgroup {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.test-entry-row {
  display: block;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
}

.test-entry-row:hover {
  background: var(--app-surface-alt);
}

.test-entry-title {
  font-size: 14px;
  color: var(--app-text, inherit);
}

.test-entry-type {
  margin-left: 8px;
  font-size: 12px;
  color: var(--app-text-muted);
}

.test-entry-empty {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-muted);
}

.test-entry-scroll {
  width: 100%;
}
</style>
