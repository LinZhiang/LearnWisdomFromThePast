<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { LearningType, QuestionBank } from '@/db/models'
import { learningTypeService, questionBankService } from '@/services/data-services'
import { validateChoiceQuestionJson } from '@/utils/choiceQuestion'
import { sanitizeRichHtml } from '@/utils/sanitize'
import LearningTypeTreePanel from '@/components/LearningTypeTreePanel.vue'
import QuestionBankDetailPage from './components/QuestionBankDetailPage.vue'
import QuestionBankEditorPage from './components/QuestionBankEditorPage.vue'
import QuestionBankTestEntryDialog from './components/QuestionBankTestEntryDialog.vue'
import QuestionBankTestParentEntryDialog from './components/QuestionBankTestParentEntryDialog.vue'
import QuestionBankTestPage from './components/QuestionBankTestPage.vue'
import {
  LEARNING_TYPE_QB_PERFECT_CLEARED_CHANGED,
  loadPerfectClearedLearningTypeIds,
} from '@/services/learning-type-qb-perfect-cleared'
import {
  collectLeafDescendants,
  findLearningTypeNodeById,
  type LearningTypeTreeNode,
} from '@/utils/learningTypeTree'
import { sumQuestionBankTestUnitCounts } from '@/utils/questionBankTestCount'
import type {
  QuestionBankTestBuildConfig,
  QuestionBankTestEntryPayload,
  QuestionBankTestLeafEntryPayload,
} from './components/questionBankTestTypes'

type LearningTypeNode = LearningTypeTreeNode

const learningTypes = ref<LearningType[]>([])
const questionBanks = ref<QuestionBank[]>([])
const editingId = ref<number | null>(null)
const selectedLearningTypeId = ref<number | null>(null)
const message = ref('')
const loading = ref(false)
const showEditor = ref(false)
const viewingQuestion = ref<QuestionBank | null>(null)
const showQuestionTest = ref(false)
const showTestEntryDialog = ref(false)
const showParentTestEntryDialog = ref(false)
/** 进入测验页时使用的题目列表（符合筛选条件的全部候选） */
const testPageQuestions = ref<QuestionBank[]>([])
/** 测验构建配置（小项覆盖 + 题量） */
const testBuildConfig = ref<QuestionBankTestBuildConfig | undefined>(undefined)
/** 本次测验是否来自「测试全部」（单叶子节点、全部小项/题型/题量） */
const testScopeAll = ref(false)
/** 测验全对时播放音乐并弹窗（不写入题库全对标签） */
const celebrateSessionPerfect = ref(true)
const perfectClearedLearningTypeIds = ref<number[]>([])
const submitting = ref(false)
const editorInitialForm = ref({
  type: 'general' as QuestionBank['type'],
  title: '',
  score: '0',
  content: '',
  analysis: '',
})

const form = ref({
  type: 'general' as QuestionBank['type'],
  title: '',
  learningTypeId: '' as string,
  score: '0',
  content: '',
  analysis: '',
})

const selectedNode = computed(() => {
  const id = selectedLearningTypeId.value
  if (id == null) return null
  return findLearningTypeNodeById(treeNodes.value, id)
})

const descendantLeafNodes = computed(() => {
  const node = selectedNode.value
  if (!node) return []
  return collectLeafDescendants(node)
})

const descendantLeafIds = computed(() =>
  descendantLeafNodes.value.map((n) => n.id).filter((id): id is number => id != null),
)

const isParentNodeSelected = computed(() => (selectedNode.value?.children.length ?? 0) > 0)

const filteredQuestionBanks = computed(() => {
  if (descendantLeafIds.value.length === 0) return []
  const idSet = new Set(descendantLeafIds.value)
  return questionBanks.value.filter(
    (item) => item.learningTypeId != null && idSet.has(item.learningTypeId),
  )
})

const testEntryLeafOptions = computed(() =>
  descendantLeafNodes.value
    .filter((n): n is LearningTypeNode & { id: number } => n.id != null)
    .map((n) => {
      const qs = questionBanks.value.filter((q) => q.learningTypeId === n.id)
      return {
        id: n.id,
        name: n.name,
        questionCount: sumQuestionBankTestUnitCounts(qs),
      }
    }),
)

const typeTextMap: Record<QuestionBank['type'], string> = {
  general: '一般题型',
  choice: '选择题型',
  mindmap: '思维导图',
}

const getLearningTypeName = (id?: number) => {
  if (!id) return '未分类'
  return learningTypes.value.find((item) => item.id === id)?.name ?? '未分类'
}

const selectedLearningTypeName = computed(() =>
  getLearningTypeName(selectedLearningTypeId.value ?? undefined),
)

const selectedLearningTypePerfectCleared = computed(() => {
  const id = selectedLearningTypeId.value
  if (id == null || isParentNodeSelected.value) return false
  return perfectClearedLearningTypeIds.value.includes(id)
})

const refreshPerfectClearedIds = () => {
  perfectClearedLearningTypeIds.value = loadPerfectClearedLearningTypeIds()
}

const treeNodes = computed<LearningTypeNode[]>(() => {
  const map = new Map<number, LearningTypeNode>()
  const roots: LearningTypeNode[] = []

  learningTypes.value.forEach((item) => {
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

const isNonNegativeInteger = (value: string) => /^\d+$/.test(value)

const resetForm = () => {
  editingId.value = null
  showEditor.value = false
  form.value = {
    type: 'general',
    title: '',
    learningTypeId: selectedLearningTypeId.value ? String(selectedLearningTypeId.value) : '',
    score: '0',
    content: '',
    analysis: '',
  }
}

const loadData = async () => {
  loading.value = true
  try {
    learningTypes.value = await learningTypeService.listAll()
    const rawQuestionBanks = await questionBankService.listAll()
    questionBanks.value = rawQuestionBanks.map((item) => ({
      ...item,
      type: item.type ?? 'general',
      analysis: item.analysis ?? '',
      score: Number.isInteger(item.score) && item.score >= 0 ? item.score : 0,
    }))
    message.value = ''
    if (viewingQuestion.value?.id != null) {
      const next = questionBanks.value.find((q) => q.id === viewingQuestion.value!.id)
      viewingQuestion.value = next ?? null
    }
  } catch {
    questionBanks.value = []
    message.value = '题库数据加载失败，请刷新页面后重试。'
    viewingQuestion.value = null
  } finally {
    loading.value = false
  }
}

const validateForm = () => {
  if (!form.value.title.trim()) {
    message.value = '题目名称不能为空。'
    return false
  }
  if (!form.value.learningTypeId) {
    message.value = '请选择学习类型。'
    return false
  }
  if (form.value.type !== 'mindmap' && !isNonNegativeInteger(form.value.score)) {
    message.value = '题目分数必须是零以上的正整数。'
    return false
  }
  if (form.value.type === 'mindmap') {
    if (!form.value.content.trim()) {
      message.value = '思维导图文字不能为空。'
      return false
    }
    return true
  }
  if (form.value.type === 'choice') {
    const cv = validateChoiceQuestionJson(form.value.content)
    if (!cv.ok) {
      message.value = cv.message ?? '请完善选择题。'
      return false
    }
    if (!form.value.analysis.trim()) {
      message.value = '题目解析不能为空。'
      return false
    }
    return true
  }
  if (!form.value.content.trim()) {
    message.value = '题目内容不能为空。'
    return false
  }
  if (!form.value.analysis.trim()) {
    message.value = '题目解析不能为空。'
    return false
  }
  return true
}

const submitForm = async () => {
  if (!selectedLearningTypeId.value) {
    message.value = '请先在左侧选择学习类型节点。'
    return
  }
  form.value.learningTypeId = String(selectedLearningTypeId.value)
  if (!validateForm()) return
  const now = new Date().toISOString()
  const isMindmap = form.value.type === 'mindmap'
  const isChoice = form.value.type === 'choice'
  const payload: Omit<QuestionBank, 'id'> = {
    type: form.value.type,
    title: form.value.title.trim(),
    learningTypeId: Number(form.value.learningTypeId),
    score: isMindmap ? 0 : Number(form.value.score),
    content: isMindmap
      ? form.value.content.trim()
      : isChoice
        ? form.value.content.trim()
        : sanitizeRichHtml(form.value.content),
    analysis: isMindmap ? '' : sanitizeRichHtml(form.value.analysis),
    createdAt: now,
    updatedAt: now,
  }

  if (editingId.value) {
    await questionBankService.update(editingId.value, {
      type: payload.type,
      title: payload.title,
      learningTypeId: payload.learningTypeId,
      score: payload.score,
      content: payload.content,
      analysis: payload.analysis,
      updatedAt: now,
    })
    message.value = '题目更新成功。'
  } else {
    await questionBankService.create(payload)
    message.value = '题目创建成功。'
  }
  resetForm()
  await loadData()
}

const openQuestionDetail = (item: QuestionBank) => {
  viewingQuestion.value = item
}

const goToDetailQuestion = (item: QuestionBank) => {
  viewingQuestion.value = item
}

const closeQuestionDetail = () => {
  viewingQuestion.value = null
}

const onEditFromDetail = (item: QuestionBank) => {
  viewingQuestion.value = null
  startEdit(item)
}

const startEdit = (item: QuestionBank) => {
  if (!item.id) return
  editingId.value = item.id
  showEditor.value = true
  form.value = {
    type: item.type ?? 'general',
    title: item.title,
    learningTypeId: String(item.learningTypeId ?? ''),
    score: String(item.score ?? 0),
    content: item.content ?? '',
    analysis: item.analysis ?? '',
  }
  editorInitialForm.value = {
    type: form.value.type,
    title: form.value.title,
    score: form.value.score,
    content: form.value.content,
    analysis: form.value.analysis,
  }
}

const removeItem = async (id?: number) => {
  if (!id) return
  const ok = window.confirm('确认删除该题目吗？')
  if (!ok) return
  await questionBankService.remove(id)
  message.value = '题目已删除。'
  if (editingId.value === id) resetForm()
  if (viewingQuestion.value?.id === id) viewingQuestion.value = null
  await loadData()
}

const startCreate = () => {
  if (!selectedLearningTypeId.value || isParentNodeSelected.value) {
    message.value = isParentNodeSelected.value
      ? '父节点不能直接新增题目，请选择具体小项。'
      : '请先在左侧选择学习类型节点。'
    return
  }
  editingId.value = null
  showEditor.value = true
  form.value = {
    type: 'general',
    title: '',
    learningTypeId: String(selectedLearningTypeId.value),
    score: '0',
    content: '',
    analysis: '',
  }
  editorInitialForm.value = {
    type: form.value.type,
    title: form.value.title,
    score: form.value.score,
    content: form.value.content,
    analysis: form.value.analysis,
  }
}

const backToList = () => {
  resetForm()
}

const openQuestionTest = () => {
  if (!selectedLearningTypeId.value) {
    message.value = '请先在左侧树中选择学习类型。'
    return
  }
  if (isParentNodeSelected.value) {
    if (testEntryLeafOptions.value.length === 0) {
      message.value = '当前节点下没有可测试的小项。'
      return
    }
    showParentTestEntryDialog.value = true
    return
  }
  if (filteredQuestionBanks.value.length === 0) {
    message.value = '当前节点下没有可测试的题目。'
    return
  }
  showTestEntryDialog.value = true
}

const onLeafTestEntryConfirm = (payload: QuestionBankTestLeafEntryPayload) => {
  resetForm()
  viewingQuestion.value = null
  testScopeAll.value = payload.scope === 'all'
  celebrateSessionPerfect.value = false
  const list =
    payload.scope === 'all'
      ? filteredQuestionBanks.value.filter((q) => q.id != null)
      : filteredQuestionBanks.value.filter(
          (q) => q.id != null && payload.questionIds.includes(q.id),
        )
  if (list.length === 0) {
    message.value = '没有可测试的题目。'
    return
  }
  testPageQuestions.value = list
  testBuildConfig.value = undefined
  showTestEntryDialog.value = false
  showQuestionTest.value = true
}

function poolQuestionsForTest(payload: QuestionBankTestEntryPayload): QuestionBank[] {
  const leafSet = new Set(payload.learningTypeIds)
  return filteredQuestionBanks.value.filter((q) => {
    if (q.id == null || q.learningTypeId == null) return false
    if (!leafSet.has(q.learningTypeId)) return false
    const t = q.type ?? 'general'
    if (t === 'general') return payload.includeGeneral
    return payload.includeChoiceLike
  })
}

const onParentTestEntryConfirm = (payload: QuestionBankTestEntryPayload) => {
  resetForm()
  viewingQuestion.value = null
  const list = poolQuestionsForTest(payload)
  if (list.length === 0 || payload.questionCount < 1) {
    message.value = '没有可测试的题目，请调整小项、题型或出题数量。'
    return
  }
  testScopeAll.value = false
  celebrateSessionPerfect.value = true
  testPageQuestions.value = list
  testBuildConfig.value = payload
  showParentTestEntryDialog.value = false
  showQuestionTest.value = true
}

const closeQuestionTest = () => {
  showQuestionTest.value = false
  testPageQuestions.value = []
  testBuildConfig.value = undefined
  testScopeAll.value = false
  celebrateSessionPerfect.value = true
  refreshPerfectClearedIds()
}

const submitFromEditor = async (value: {
  type: QuestionBank['type']
  title: string
  score: string
  content: string
  analysis: string
}) => {
  form.value.type = value.type
  form.value.title = value.title
  form.value.score = value.score
  form.value.content = value.content
  form.value.analysis = value.analysis
  submitting.value = true
  try {
    await submitForm()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  refreshPerfectClearedIds()
  window.addEventListener(LEARNING_TYPE_QB_PERFECT_CLEARED_CHANGED, refreshPerfectClearedIds)
  void loadData()
})

onBeforeUnmount(() => {
  window.removeEventListener(LEARNING_TYPE_QB_PERFECT_CLEARED_CHANGED, refreshPerfectClearedIds)
})
</script>

<template>
  <section
    class="question-bank-page"
    :class="{ 'is-detail-view': viewingQuestion || showQuestionTest }"
  >
    <QuestionBankDetailPage
      v-if="viewingQuestion"
      :question="viewingQuestion"
      :type-label="typeTextMap[viewingQuestion.type ?? 'general']"
      :learning-type-name="getLearningTypeName(viewingQuestion.learningTypeId)"
      :nav-list="filteredQuestionBanks"
      @back="closeQuestionDetail"
      @edit="onEditFromDetail"
      @go-to="goToDetailQuestion"
    />
    <QuestionBankTestPage
      v-else-if="showQuestionTest"
      :learning-type-name="selectedLearningTypeName"
      :learning-type-id="isParentNodeSelected ? null : selectedLearningTypeId"
      :test-scope-all="testScopeAll"
      :celebrate-session-perfect="celebrateSessionPerfect"
      :questions="testPageQuestions"
      :test-build-config="testBuildConfig"
      :loading="loading"
      :type-text-map="typeTextMap"
      @back="closeQuestionTest"
    />
    <template v-else>
      <header class="page-hero">
        <span class="page-kicker">智学 02</span>
        <h2 class="page-title">学习题库</h2>
        <p class="page-subtitle">左侧选择学习类型，右侧管理该类型题目（新增、删除、修改）。</p>
      </header>
      <QuestionBankEditorPage
        v-if="showEditor"
        :key="editingId ? `edit-${editingId}` : 'create'"
        :mode="editingId ? 'edit' : 'create'"
        :loading="submitting"
        :initial-form="editorInitialForm"
        @back="backToList"
        @submit="submitFromEditor"
      />
      <div v-else class="question-bank-layout">
      <LearningTypeTreePanel
        :loading="loading"
        :tree-nodes="treeNodes"
        :selected-id="selectedLearningTypeId"
        :leaf-selectable-only="false"
        :perfect-cleared-ids="perfectClearedLearningTypeIds"
        @update:selected-id="selectedLearningTypeId = $event"
      />

      <div class="question-bank-list">
        <div class="question-bank-header">
          <p class="question-bank-header-title">
            当前节点：<strong>{{ selectedLearningTypeName }}</strong>
            <el-tag
              v-if="selectedLearningTypePerfectCleared"
              class="perfect-cleared-tag"
              type="success"
              size="small"
              effect="plain"
            >
              题库全对
            </el-tag>
          </p>
          <div class="question-bank-header-actions">
            <el-button
              :disabled="
                isParentNodeSelected
                  ? testEntryLeafOptions.length === 0
                  : filteredQuestionBanks.length === 0
              "
              @click="openQuestionTest"
            >
              题目测试
            </el-button>
            <el-button
              v-if="!isParentNodeSelected"
              type="primary"
              @click="startCreate"
            >
              新增
            </el-button>
          </div>
        </div>
        <p v-if="loading">题库数据加载中...</p>
        <p v-if="message">{{ message }}</p>
        <p v-if="!selectedLearningTypeId">请先从左侧树中选择学习类型。</p>
        <template v-else>
          <p v-if="isParentNodeSelected && !loading" class="parent-node-hint">
            父节点汇总 {{ descendantLeafNodes.length }} 个小项，共 {{ filteredQuestionBanks.length }} 道题。可点击「题目测试」跨小项测验；新增题目请选择具体小项。
          </p>
          <p v-if="!loading && filteredQuestionBanks.length === 0">当前节点下暂无题目。</p>
          <div v-if="filteredQuestionBanks.length > 0" class="question-table">
            <div
              class="question-table-head"
              :class="{ 'has-leaf-column': isParentNodeSelected }"
            >
              <span>题目名称</span>
              <span v-if="isParentNodeSelected">所属小项</span>
              <span>题型</span>
              <span>分数</span>
              <span v-if="!isParentNodeSelected">操作</span>
            </div>
            <div
              v-for="item in filteredQuestionBanks"
              :key="item.id"
              class="question-table-row is-row-open-detail"
              :class="{ 'has-leaf-column': isParentNodeSelected }"
              role="button"
              tabindex="0"
              @click="openQuestionDetail(item)"
              @keydown.enter.prevent="openQuestionDetail(item)"
              @keydown.space.prevent="openQuestionDetail(item)"
            >
              <span>{{ item.title }}</span>
              <span v-if="isParentNodeSelected">{{
                getLearningTypeName(item.learningTypeId)
              }}</span>
              <span>{{ typeTextMap[item.type ?? 'general'] }}</span>
              <span>{{ item.type === 'mindmap' ? '-' : (item.score ?? 0) }}</span>
              <div v-if="!isParentNodeSelected" class="question-card-actions" @click.stop>
                <el-button size="small" @click="startEdit(item)">修改</el-button>
                <el-button size="small" type="danger" @click="removeItem(item.id)">
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
    </template>
    <QuestionBankTestEntryDialog
      v-model="showTestEntryDialog"
      :node-name="selectedLearningTypeName"
      :questions="filteredQuestionBanks"
      :type-text-map="typeTextMap"
      @confirm="onLeafTestEntryConfirm"
    />
    <QuestionBankTestParentEntryDialog
      v-model="showParentTestEntryDialog"
      :node-name="selectedLearningTypeName"
      :leaf-options="testEntryLeafOptions"
      :all-questions="filteredQuestionBanks"
      @confirm="onParentTestEntryConfirm"
    />
  </section>
</template>

<style scoped>
.question-bank-page {
  display: grid;
  gap: 12px;
}

.question-bank-page.is-detail-view {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  gap: 0;
}

.question-bank-page p {
  color: var(--app-text-muted);
}

.question-bank-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 12px;
  align-items: start;
  height: calc(100vh - 230px);
}

.question-bank-list {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: var(--app-surface);
}

.question-bank-layout :deep(.type-panel) {
  overflow: auto;
}

.question-bank-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.question-bank-header-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
}

.question-bank-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.question-table {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  display: grid;
  overflow: hidden;
  min-height: 0;
}

.question-table-head,
.question-table-row {
  display: grid;
  grid-template-columns: 1.2fr 0.6fr 0.4fr 0.8fr;
  align-items: center;
  padding: 8px 10px;
  gap: 8px;
}

.question-table-head.has-leaf-column,
.question-table-row.has-leaf-column {
  grid-template-columns: 1.2fr 0.8fr 0.6fr 0.4fr;
}

.parent-node-hint {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.question-table-head {
  background: var(--app-surface-alt);
  font-weight: 600;
  border-bottom: 1px solid var(--app-border-soft);
}

.question-table-row {
  border-bottom: 1px solid var(--app-border-soft);
}

.question-table-row:last-child {
  border-bottom: none;
}

.question-table-row.is-row-open-detail {
  cursor: pointer;
}

.question-table-row.is-row-open-detail:hover {
  background: var(--app-surface-alt);
}

.question-card-actions {
  display: flex;
  gap: 6px;
}

</style>
