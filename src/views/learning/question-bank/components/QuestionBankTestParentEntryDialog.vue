<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ElTree } from 'element-plus'
import type { QuestionBank } from '@/db/models'
import type { LearningTypeTreeNode } from '@/utils/learningTypeTree'
import {
  buildTestEntryTree,
  collectTestEntryTreeNodeIds,
  filterQuestionsForTestConfig,
  hasExpandableGeneralQuestionBankItems,
  hasExpandableJudgmentQuestionBankItems,
  hasExpandableMcqQuestionBankItems,
  sumQuestionBankTestUnitCountsForConfig,
  type TestEntryTreeNode,
} from '@/utils/questionBankTestCount'
import type { QuestionBankTestEntryPayload } from './questionBankTestTypes'

type ElTreeNode = {
  id: number
  label: string
  countHint: string
  children: ElTreeNode[]
}

const props = defineProps<{
  modelValue: boolean
  nodeName: string
  rootNode: LearningTypeTreeNode | null
  allQuestions: QuestionBank[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm', payload: QuestionBankTestEntryPayload): void
}>()

const treeRef = ref<InstanceType<typeof ElTree> | null>(null)
const includeChoiceLike = ref(true)
const includeGeneral = ref(true)
const includeJudgment = ref(true)
const questionCountMode = ref<'all' | 'custom'>('all')
const customQuestionCount = ref(30)

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

/** 展示用树：不受当前勾选/题型影响，避免清空后弹窗整块消失 */
const displayEntryTree = computed((): TestEntryTreeNode | null => {
  if (!props.rootNode) return null
  return buildTestEntryTree(props.rootNode, props.allQuestions, {
    includeChoiceLike: true,
    includeGeneral: true,
    includeJudgment: true,
  })
})

const toElTreeNodes = (nodes: TestEntryTreeNode[]): ElTreeNode[] =>
  nodes.map((node) => ({
    id: node.id,
    label: node.label,
    countHint:
      node.children.length > 0
        ? `共约 ${node.totalCount} 道`
        : `约 ${node.totalCount} 道测验题`,
    children: toElTreeNodes(node.children),
  }))

const treeRoots = computed((): TestEntryTreeNode[] => {
  const root = displayEntryTree.value
  if (!root) return []
  if (root.directCount === 0 && root.children.length > 0) return root.children
  return [root]
})

const treeData = computed((): ElTreeNode[] => toElTreeNodes(treeRoots.value))

const allTreeNodeIds = computed(() => collectTestEntryTreeNodeIds(treeRoots.value))

const checkedLearningTypeIds = ref<number[]>([])

const syncCheckedFromTree = () => {
  const keys = (treeRef.value?.getCheckedKeys(false) ?? []) as number[]
  checkedLearningTypeIds.value = keys
}

const hasGeneralInPool = computed(() =>
  props.allQuestions.some((q) => (q.type ?? 'general') === 'general'),
)

const hasChoiceLikeInPool = computed(() =>
  props.allQuestions.some((q) => {
    const t = q.type ?? 'general'
    return t === 'choice' || hasExpandableMcqQuestionBankItems([q])
  }),
)

const hasHandoutGeneralInPool = computed(() =>
  hasExpandableGeneralQuestionBankItems(props.allQuestions),
)

const hasHandoutJudgmentInPool = computed(() =>
  hasExpandableJudgmentQuestionBankItems(props.allQuestions),
)

const includeGeneralEffective = computed(
  () => includeGeneral.value && (hasGeneralInPool.value || hasHandoutGeneralInPool.value),
)

const includeJudgmentEffective = computed(
  () => includeJudgment.value && hasHandoutJudgmentInPool.value,
)

const filteredPool = computed(() =>
  filterQuestionsForTestConfig(props.allQuestions, {
    learningTypeIds: checkedLearningTypeIds.value,
    includeChoiceLike: includeChoiceLike.value && hasChoiceLikeInPool.value,
    includeGeneral: includeGeneralEffective.value,
    includeJudgment: includeJudgmentEffective.value,
  }),
)

const estimatedQuestionCount = computed(() =>
  sumQuestionBankTestUnitCountsForConfig(props.allQuestions, {
    learningTypeIds: checkedLearningTypeIds.value,
    includeChoiceLike: includeChoiceLike.value && hasChoiceLikeInPool.value,
    includeGeneral: includeGeneralEffective.value,
    includeJudgment: includeJudgmentEffective.value,
  }),
)

const hasExpandableMcqInFilteredPool = computed(
  () => includeChoiceLike.value && hasExpandableMcqQuestionBankItems(filteredPool.value),
)

const choiceLikeLabel = computed(() => {
  const choiceCount = filteredPool.value.filter((q) => q.type === 'choice').length
  const parts: string[] = []
  if (choiceCount > 0) parts.push(`${choiceCount} 条选择题`)
  if (hasExpandableMcqInFilteredPool.value) {
    parts.push('思维导图/讲义自动生成选择题')
  }
  if (parts.length === 0) return '选择题（含导图/讲义自动生成）'
  return `选择题（${parts.join('；')}）`
})

const generalLabel = computed(() => {
  const generalCount = filteredPool.value.filter((q) => (q.type ?? 'general') === 'general').length
  const parts: string[] = []
  if (generalCount > 0) parts.push(`${generalCount} 条作答题`)
  if (includeGeneral.value && hasHandoutGeneralInPool.value) {
    parts.push('讲义自动生成计算题')
  }
  if (parts.length === 0) return '作答题 / 计算题（含讲义自动生成）'
  return `作答题 / 计算题（${parts.join('；')}）`
})

const judgmentLabel = computed(() => {
  if (!hasHandoutJudgmentInPool.value) return '判断题（讲义自动生成）'
  return '判断题（讲义自动生成易混淆陈述）'
})

const checkedNodeCount = computed(() => checkedLearningTypeIds.value.length)

const applyDefaultChecks = async () => {
  await nextTick()
  const ids = allTreeNodeIds.value
  treeRef.value?.setCheckedKeys(ids)
  syncCheckedFromTree()
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    includeChoiceLike.value = hasChoiceLikeInPool.value
    includeGeneral.value = hasGeneralInPool.value || hasHandoutGeneralInPool.value
    includeJudgment.value = hasHandoutJudgmentInPool.value
    questionCountMode.value = 'all'
    customQuestionCount.value = 30
    checkedLearningTypeIds.value = []
    void applyDefaultChecks()
  },
)

const onTreeCheck = () => {
  syncCheckedFromTree()
}

const selectAllNodes = () => {
  treeRef.value?.setCheckedKeys(allTreeNodeIds.value)
  syncCheckedFromTree()
}

const clearNodes = () => {
  treeRef.value?.setCheckedKeys([])
  syncCheckedFromTree()
}

const validationHint = computed(() => {
  if (!displayEntryTree.value) return ''
  if (checkedLearningTypeIds.value.length === 0) return '请至少选择一个分类节点。'
  if (!includeChoiceLike.value && !includeGeneral.value && !includeJudgment.value) {
    return '请至少选择一种测验题型。'
  }
  if (filteredPool.value.length === 0) return '当前勾选下没有可测验内容，请调整分类或题型。'
  if (questionCountMode.value === 'custom' && customQuestionCount.value < 1) {
    return '自定义出题数量至少为 1。'
  }
  return ''
})

const primaryDisabled = computed(() => validationHint.value !== '')

const onConfirm = () => {
  if (primaryDisabled.value) return
  emit('confirm', {
    learningTypeIds: [...checkedLearningTypeIds.value],
    includeChoiceLike: includeChoiceLike.value && hasChoiceLikeInPool.value,
    includeGeneral: includeGeneralEffective.value,
    includeJudgment: includeJudgmentEffective.value,
    questionCount:
      questionCountMode.value === 'all' ? undefined : Math.floor(customQuestionCount.value),
  })
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="测验"
    width="min(92vw, 600px)"
    class="test-entry-dialog"
    destroy-on-close
    append-to-body
  >
    <p v-if="!displayEntryTree" class="test-entry-empty">当前节点下没有可测试的小项。</p>
    <template v-else>
      <p class="test-entry-lead">
        当前节点：<strong>{{ nodeName }}</strong>（父节点，可跨小项配置测验）
      </p>

      <section class="test-entry-section">
        <h4 class="test-entry-section-title">选择小项</h4>
        <div class="test-entry-partial-actions">
          <el-button text type="primary" @click="selectAllNodes">全选</el-button>
          <el-button text type="primary" @click="clearNodes">清空</el-button>
          <span class="test-entry-count">已选 {{ checkedNodeCount }} 个分类节点</span>
        </div>
        <el-scrollbar class="test-entry-scroll">
          <el-tree
            ref="treeRef"
            :data="treeData"
            node-key="id"
            show-checkbox
            default-expand-all
            :props="{ label: 'label', children: 'children' }"
            class="test-entry-tree"
            @check="onTreeCheck"
          >
            <template #default="{ data }">
              <span class="test-entry-tree-label">{{ data.label }}</span>
              <span class="test-entry-type">{{ data.countHint }}</span>
            </template>
          </el-tree>
        </el-scrollbar>
        <p v-if="validationHint" class="test-entry-validation">{{ validationHint }}</p>
      </section>

      <section class="test-entry-section">
        <h4 class="test-entry-section-title">测验包含</h4>
        <el-checkbox
          v-if="hasChoiceLikeInPool"
          v-model="includeChoiceLike"
          class="test-entry-type-check"
        >
          {{ choiceLikeLabel }}
        </el-checkbox>
        <el-checkbox
          v-if="hasGeneralInPool || hasHandoutGeneralInPool"
          v-model="includeGeneral"
          class="test-entry-type-check"
        >
          {{ generalLabel }}
        </el-checkbox>
        <el-checkbox
          v-if="hasHandoutJudgmentInPool"
          v-model="includeJudgment"
          class="test-entry-type-check"
        >
          {{ judgmentLabel }}
        </el-checkbox>
        <p
          v-if="
            !hasChoiceLikeInPool &&
            !hasGeneralInPool &&
            !hasHandoutGeneralInPool &&
            !hasHandoutJudgmentInPool
          "
          class="test-entry-empty"
        >
          所选小项下暂无可测验内容。
        </p>
      </section>

      <section class="test-entry-section">
        <h4 class="test-entry-section-title">出题数量</h4>
        <el-radio-group v-model="questionCountMode" class="test-entry-count-mode">
          <el-radio value="all" size="large">
            全部出题（勾选范围内约 {{ estimatedQuestionCount }} 道，含 AI 自动生成）
          </el-radio>
          <el-radio value="custom" size="large">自定义上限</el-radio>
        </el-radio-group>
        <div v-if="questionCountMode === 'custom'" class="test-entry-count-row">
          <el-input-number
            v-model="customQuestionCount"
            :min="1"
            :step="1"
            controls-position="right"
          />
          <span class="test-entry-count-hint">
            按上限截断；实际题量取决于勾选条目与题型。选择题/作答题各 1 道；思维导图约 5～10 道选择；讲义按你设定的自动生成数量。
          </span>
        </div>
        <p v-else class="test-entry-count-hint test-entry-count-hint--block">
          将从各勾选分类轮流出题，尽量覆盖全部可测验内容与自动生成的选择/计算题，不设固定上限。
        </p>
      </section>
    </template>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="primaryDisabled" @click="onConfirm">开始测验</el-button>
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

.test-entry-tree {
  background: transparent;
}

.test-entry-tree-label {
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

.test-entry-count-mode {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
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

.test-entry-count-hint--block {
  margin: 0;
}

.test-entry-empty {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-muted);
}

.test-entry-validation {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--el-color-warning);
}

.test-entry-scroll {
  max-height: min(44vh, 280px);
}

.test-entry-tree :deep(.el-tree-node__content) {
  height: auto;
  min-height: 30px;
  padding: 4px 0;
  align-items: flex-start;
}
</style>
