<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QuestionBank } from '@/db/models'
import {
  hasMindmapQuestionBankItems,
  sumQuestionBankTestUnitCounts,
} from '@/utils/questionBankTestCount'
import type { QuestionBankTestEntryPayload } from './questionBankTestTypes'

const props = defineProps<{
  modelValue: boolean
  nodeName: string
  leafOptions: Array<{ id: number; name: string; questionCount: number }>
  allQuestions: QuestionBank[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm', payload: QuestionBankTestEntryPayload): void
}>()

const selectedLeafIds = ref<number[]>([])
const includeChoiceLike = ref(true)
const includeGeneral = ref(true)
const questionCount = ref(1)

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const hasGeneralInPool = computed(() =>
  props.allQuestions.some((q) => (q.type ?? 'general') === 'general'),
)

const hasChoiceLikeInPool = computed(() =>
  props.allQuestions.some((q) => {
    const t = q.type ?? 'general'
    return t === 'choice' || t === 'mindmap'
  }),
)

const filteredPool = computed(() => {
  const leafSet = new Set(selectedLeafIds.value)
  return props.allQuestions.filter((q) => {
    if (q.id == null || q.learningTypeId == null) return false
    if (!leafSet.has(q.learningTypeId)) return false
    const t = q.type ?? 'general'
    if (t === 'general') return includeGeneral.value && hasGeneralInPool.value
    return includeChoiceLike.value && hasChoiceLikeInPool.value
  })
})

const maxQuestionCount = computed(() => sumQuestionBankTestUnitCounts(filteredPool.value))

const hasMindmapInFilteredPool = computed(
  () => includeChoiceLike.value && hasMindmapQuestionBankItems(filteredPool.value),
)

const choiceLikeLabel = computed(() => {
  const choiceCount = filteredPool.value.filter((q) => q.type === 'choice').length
  const parts: string[] = []
  if (choiceCount > 0) parts.push(`${choiceCount} 道选择题型`)
  if (hasMindmapInFilteredPool.value) parts.push('包括思维导图的测验题')
  if (parts.length === 0) return '选择题型'
  return `选择题型（${parts.join('；')}）`
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    selectedLeafIds.value = props.leafOptions.map((o) => o.id)
    includeChoiceLike.value = hasChoiceLikeInPool.value
    includeGeneral.value = hasGeneralInPool.value
    questionCount.value = Math.max(1, sumQuestionBankTestUnitCounts(props.allQuestions))
  },
)

watch(maxQuestionCount, (max) => {
  if (max <= 0) {
    questionCount.value = 1
    return
  }
  if (questionCount.value > max) questionCount.value = max
  if (questionCount.value < 1) questionCount.value = 1
})

const selectAllLeaves = () => {
  selectedLeafIds.value = props.leafOptions.map((o) => o.id)
}

const clearLeaves = () => {
  selectedLeafIds.value = []
}

const primaryDisabled = computed(() => {
  if (props.leafOptions.length === 0) return true
  if (selectedLeafIds.value.length === 0) return true
  if (!includeChoiceLike.value && !includeGeneral.value) return true
  if (maxQuestionCount.value === 0) return true
  if (questionCount.value < 1 || questionCount.value > maxQuestionCount.value) return true
  return false
})

const onConfirm = () => {
  if (primaryDisabled.value) return
  emit('confirm', {
    learningTypeIds: [...selectedLeafIds.value],
    includeChoiceLike: includeChoiceLike.value && hasChoiceLikeInPool.value,
    includeGeneral: includeGeneral.value && hasGeneralInPool.value,
    questionCount: questionCount.value,
  })
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="题目测试"
    width="min(92vw, 560px)"
    class="test-entry-dialog"
    destroy-on-close
    append-to-body
  >
    <p v-if="leafOptions.length === 0" class="test-entry-empty">当前节点下没有可测试的小项。</p>
    <template v-else>
      <p class="test-entry-lead">
        当前节点：<strong>{{ nodeName }}</strong>（父节点，可跨小项配置测验）
      </p>

      <section class="test-entry-section">
        <h4 class="test-entry-section-title">选择小项</h4>
        <div class="test-entry-partial-actions">
          <el-button text type="primary" @click="selectAllLeaves">全选</el-button>
          <el-button text type="primary" @click="clearLeaves">清空</el-button>
          <span class="test-entry-count">已选 {{ selectedLeafIds.length }} / {{ leafOptions.length }} 项</span>
        </div>
        <el-scrollbar class="test-entry-scroll">
          <el-checkbox-group v-model="selectedLeafIds" class="test-entry-checkgroup">
            <div v-for="leaf in leafOptions" :key="leaf.id" class="test-entry-row">
              <el-checkbox :label="leaf.id">
                <span class="test-entry-title">{{ leaf.name }}</span>
                <span class="test-entry-type">{{ leaf.questionCount }} 道测验题</span>
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </el-scrollbar>
      </section>

      <section class="test-entry-section">
        <h4 class="test-entry-section-title">题目类型</h4>
        <el-checkbox
          v-if="hasChoiceLikeInPool"
          v-model="includeChoiceLike"
          class="test-entry-type-check"
        >
          {{ choiceLikeLabel }}
        </el-checkbox>
        <el-checkbox
          v-if="hasGeneralInPool"
          v-model="includeGeneral"
          class="test-entry-type-check"
        >
          一般题型
        </el-checkbox>
        <p v-if="!hasChoiceLikeInPool && !hasGeneralInPool" class="test-entry-empty">
          所选小项下暂无题目。
        </p>
      </section>

      <section class="test-entry-section">
        <h4 class="test-entry-section-title">出题数量</h4>
        <div class="test-entry-count-row">
          <el-input-number
            v-model="questionCount"
            :min="1"
            :max="Math.max(1, maxQuestionCount)"
            :disabled="maxQuestionCount === 0"
            controls-position="right"
          />
          <span class="test-entry-count-hint">
            按实际测验题数设定（选择/一般题型各 1 道；思维导图按内容预估展开为 5～10 道选择题，已计入总数与上限）。确认后将按此数量从各勾选小项生成测验题，并保证每个有题的小项都会涉及。最多 {{ maxQuestionCount }} 道。
          </span>
        </div>
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

.test-entry-section {
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--app-border-soft);
}

.test-entry-section:last-of-type {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.test-entry-section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
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

.test-entry-type-check {
  display: flex;
  margin-right: 0;
  margin-bottom: 8px;
  height: auto;
  line-height: 1.5;
  white-space: normal;
  align-items: flex-start;
}

.test-entry-count-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.test-entry-count-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.test-entry-empty {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-muted);
}

.test-entry-scroll {
  max-height: min(40vh, 240px);
}
</style>
