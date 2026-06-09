<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LearningType, QuestionBank } from '@/db/models'
import { learningTypeService, questionBankService } from '@/services/data-services'
import { validateChoiceQuestionJson } from '@/utils/choiceQuestion'
import { htmlToPlainText } from '@/utils/htmlToText'
import { sanitizeRichHtml } from '@/utils/sanitize'
import LearningTypeTreePanel from '@/components/LearningTypeTreePanel.vue'
import QuestionBankDetailPage from './components/QuestionBankDetailPage.vue'
import QuestionBankImportanceEditor from './components/QuestionBankImportanceEditor.vue'
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
  collectSubtreeNodeIds,
  findLearningTypeNodeById,
  type LearningTypeTreeNode,
} from '@/utils/learningTypeTree'
import {
  buildQuestionBankTreeBranches,
  collectLearningTypeBranchIds,
  flattenQuestionBankTreeDisplay,
} from '@/utils/questionBankTreeTable'
import {
  QBANK_UI,
  QUESTION_BANK_TYPE_LABELS,
  questionBankEligibleForTest,
  questionBankIsPreviewOnlyInTest,
  questionBankTestEligibilityLabel,
} from '@/constants/question-bank-types'
import {
  buildTestEntryTree,
  filterQuestionsForTestConfig,
} from '@/utils/questionBankTestCount'
import {
  HANDOUT_GENERAL_COUNT_DEFAULT,
  HANDOUT_JUDGMENT_COUNT_DEFAULT,
  HANDOUT_MCQ_COUNT_DEFAULT,
  clampHandoutGeneralCount,
  clampHandoutJudgmentCount,
  clampHandoutMcqCount,
} from '@/utils/handoutQuestion'
import { normalizeQuestionBankImportance } from '@/utils/questionBankImportance'
import type { QuestionBankEditorForm } from './components/QuestionBankEditorPage.vue'
import type {
  QuestionBankTestBuildConfig,
  QuestionBankTestEntryPayload,
  QuestionBankTestLeafEntryPayload,
} from './components/questionBankTestTypes'
import { usePageFocusStore } from '@/stores/page-focus'

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
const editorInitialForm = ref<QuestionBankEditorForm>({
  type: 'general',
  title: '',
  score: '0',
  content: '',
  analysis: '',
  handoutAutoMcq: false,
  handoutMcqCount: HANDOUT_MCQ_COUNT_DEFAULT,
  handoutAutoGeneral: false,
  handoutGeneralCount: HANDOUT_GENERAL_COUNT_DEFAULT,
  handoutAutoJudgment: false,
  handoutJudgmentCount: HANDOUT_JUDGMENT_COUNT_DEFAULT,
})

const form = ref({
  type: 'general' as QuestionBank['type'],
  title: '',
  learningTypeId: '' as string,
  score: '0',
  content: '',
  analysis: '',
  handoutAutoMcq: false,
  handoutMcqCount: HANDOUT_MCQ_COUNT_DEFAULT,
  handoutAutoGeneral: false,
  handoutGeneralCount: HANDOUT_GENERAL_COUNT_DEFAULT,
  handoutAutoJudgment: false,
  handoutJudgmentCount: HANDOUT_JUDGMENT_COUNT_DEFAULT,
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

/** 当前选中节点子树内全部学习类型 id（含父节点自身，与错题本一致） */
const descendantSubtreeIds = computed(() => {
  const node = selectedNode.value
  if (!node) return []
  return collectSubtreeNodeIds(node)
})

const isParentNodeSelected = computed(() => (selectedNode.value?.children.length ?? 0) > 0)

const knownLearningTypeIds = computed(
  () =>
    new Set(
      learningTypes.value.map((t) => t.id).filter((id): id is number => id != null),
    ),
)

const filteredQuestionBanks = computed(() => {
  if (selectedLearningTypeId.value == null) return []
  const node = selectedNode.value
  if (!node) return []
  const idSet = new Set(descendantSubtreeIds.value)
  return questionBanks.value.filter(
    (item) => item.learningTypeId != null && idSet.has(item.learningTypeId),
  )
})

/** 学习分类已删除、但仍留在 IndexedDB 的题库条目 */
const orphanQuestionBanks = computed(() =>
  questionBanks.value.filter(
    (q) => q.learningTypeId != null && !knownLearningTypeIds.value.has(q.learningTypeId),
  ),
)

const parentTreeBranches = computed(() => {
  const node = selectedNode.value
  if (!node || !isParentNodeSelected.value) return []
  return buildQuestionBankTreeBranches(node, filteredQuestionBanks.value)
})

/** 父节点表格：可折叠分组，默认全部收起 */
const expandedTreeBranchIds = ref<Set<string>>(new Set())

watch(selectedLearningTypeId, () => {
  expandedTreeBranchIds.value = new Set()
  void nextTick(() => {
    if (!isParentNodeSelected.value || filteredQuestionBanks.value.length === 0) return
    expandedTreeBranchIds.value = new Set(
      collectLearningTypeBranchIds(parentTreeBranches.value),
    )
  })
})

const parentTreeTableRows = computed(() =>
  flattenQuestionBankTreeDisplay(parentTreeBranches.value, expandedTreeBranchIds.value),
)

const isTreeBranchExpanded = (branchId: string) => expandedTreeBranchIds.value.has(branchId)

const toggleTreeBranch = (branchId: string) => {
  const next = new Set(expandedTreeBranchIds.value)
  if (next.has(branchId)) next.delete(branchId)
  else next.add(branchId)
  expandedTreeBranchIds.value = next
}

const rowKeyForTreeRow = (row: (typeof parentTreeTableRows.value)[number], idx: number) => {
  if (row.kind === 'branch') return `branch-${row.branchId}`
  return `entry-${row.question.id ?? idx}`
}

/** 可参与题目测试的条目（排除仅预览、未勾选自动出题的讲义） */
const testableQuestionBanks = computed(() =>
  filteredQuestionBanks.value.filter(questionBankEligibleForTest),
)

const parentTestEntryTree = computed(() => {
  const node = selectedNode.value
  if (!node) return null
  return buildTestEntryTree(node, filteredQuestionBanks.value, {
    includeChoiceLike: true,
    includeGeneral: true,
    includeJudgment: true,
  })
})

const typeTextMap = QUESTION_BANK_TYPE_LABELS

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
    handoutAutoMcq: false,
    handoutMcqCount: HANDOUT_MCQ_COUNT_DEFAULT,
    handoutAutoGeneral: false,
    handoutGeneralCount: HANDOUT_GENERAL_COUNT_DEFAULT,
    handoutAutoJudgment: false,
    handoutJudgmentCount: HANDOUT_JUDGMENT_COUNT_DEFAULT,
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

const failForm = (msg: string): false => {
  message.value = msg
  ElMessage.error(msg)
  return false
}

const validateForm = () => {
  if (!form.value.title.trim()) {
    return failForm('名称不能为空。')
  }
  if (!form.value.learningTypeId) {
    return failForm('请选择学习类型。')
  }
  if (
    form.value.type !== 'mindmap' &&
    form.value.type !== 'handout' &&
    !isNonNegativeInteger(form.value.score)
  ) {
    return failForm('分值必须是零以上的正整数。')
  }
  if (form.value.type === 'mindmap') {
    if (!form.value.content.trim()) {
      return failForm('思维导图文字不能为空。')
    }
    return true
  }
  if (form.value.type === 'handout') {
    if (!form.value.content.trim()) {
      return failForm('讲义 Markdown 内容不能为空。')
    }
    if (form.value.handoutAutoMcq) {
      form.value.handoutMcqCount = clampHandoutMcqCount(form.value.handoutMcqCount)
    }
    if (form.value.handoutAutoGeneral) {
      form.value.handoutGeneralCount = clampHandoutGeneralCount(form.value.handoutGeneralCount)
    }
    if (form.value.handoutAutoJudgment) {
      form.value.handoutJudgmentCount = clampHandoutJudgmentCount(form.value.handoutJudgmentCount)
    }
    return true
  }
  if (form.value.type === 'choice') {
    const cv = validateChoiceQuestionJson(form.value.content)
    if (!cv.ok) {
      return failForm(cv.message ?? '请完善选择题。')
    }
    if (!htmlToPlainText(form.value.analysis).trim()) {
      return failForm('解析不能为空。')
    }
    return true
  }
  if (!htmlToPlainText(form.value.content).trim()) {
    return failForm('题干不能为空。')
  }
  if (!htmlToPlainText(form.value.analysis).trim()) {
    return failForm('解析不能为空。')
  }
  return true
}

const learningTypeSelectOptions = computed(() => {
  const items: { value: number; label: string }[] = []
  const walk = (nodes: LearningTypeNode[], depth = 0) => {
    for (const node of nodes) {
      if (node.id != null) {
        const indent = depth > 0 ? `${'　'.repeat(depth)}` : ''
        items.push({ value: node.id, label: `${indent}${node.name}` })
      }
      if (node.children.length > 0) walk(node.children, depth + 1)
    }
  }
  walk(treeNodes.value)
  return items
})

const submitForm = async () => {
  if (editingId.value) {
    if (!form.value.learningTypeId) {
      failForm('请选择所属学习类型。')
      return
    }
  } else {
    if (!selectedLearningTypeId.value) {
      failForm('请先在左侧选择学习类型节点。')
      return
    }
    form.value.learningTypeId = String(selectedLearningTypeId.value)
  }
  if (!validateForm()) return
  const now = new Date().toISOString()
  const isMindmap = form.value.type === 'mindmap'
  const isHandout = form.value.type === 'handout'
  const isChoice = form.value.type === 'choice'
  const noScore = isMindmap || isHandout
  const payload: Omit<QuestionBank, 'id'> = {
    type: form.value.type,
    title: form.value.title.trim(),
    learningTypeId: Number(form.value.learningTypeId),
    score: noScore ? 0 : Number(form.value.score),
    content: isMindmap
      ? form.value.content.trim()
      : isHandout
        ? form.value.content.trim()
        : isChoice
          ? form.value.content.trim()
          : sanitizeRichHtml(form.value.content),
    analysis: isMindmap || isHandout ? '' : sanitizeRichHtml(form.value.analysis),
    handoutAutoMcq: isHandout ? form.value.handoutAutoMcq : undefined,
    handoutMcqCount:
      isHandout && form.value.handoutAutoMcq
        ? clampHandoutMcqCount(form.value.handoutMcqCount)
        : undefined,
    handoutAutoGeneral: isHandout ? form.value.handoutAutoGeneral : undefined,
    handoutGeneralCount:
      isHandout && form.value.handoutAutoGeneral
        ? clampHandoutGeneralCount(form.value.handoutGeneralCount)
        : undefined,
    handoutAutoJudgment: isHandout ? form.value.handoutAutoJudgment : undefined,
    handoutJudgmentCount:
      isHandout && form.value.handoutAutoJudgment
        ? clampHandoutJudgmentCount(form.value.handoutJudgmentCount)
        : undefined,
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
      handoutAutoMcq: payload.handoutAutoMcq,
      handoutMcqCount: payload.handoutMcqCount,
      handoutAutoGeneral: payload.handoutAutoGeneral,
      handoutGeneralCount: payload.handoutGeneralCount,
      handoutAutoJudgment: payload.handoutAutoJudgment,
      handoutJudgmentCount: payload.handoutJudgmentCount,
      updatedAt: now,
    })
    message.value = QBANK_UI.updateSuccess
  } else {
    await questionBankService.create(payload)
    message.value = QBANK_UI.createSuccess
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

const pageFocusStore = usePageFocusStore()

const closeQuestionDetail = () => {
  void pageFocusStore.exitStretchIfActive()
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
    handoutAutoMcq: item.handoutAutoMcq === true,
    handoutMcqCount: clampHandoutMcqCount(item.handoutMcqCount),
    handoutAutoGeneral: item.handoutAutoGeneral === true,
    handoutGeneralCount: clampHandoutGeneralCount(item.handoutGeneralCount),
    handoutAutoJudgment: item.handoutAutoJudgment === true,
    handoutJudgmentCount: clampHandoutJudgmentCount(item.handoutJudgmentCount),
  }
  editorInitialForm.value = {
    type: form.value.type,
    title: form.value.title,
    learningTypeId: form.value.learningTypeId,
    score: form.value.score,
    content: form.value.content,
    analysis: form.value.analysis,
    handoutAutoMcq: form.value.handoutAutoMcq,
    handoutMcqCount: form.value.handoutMcqCount,
    handoutAutoGeneral: form.value.handoutAutoGeneral,
    handoutGeneralCount: form.value.handoutGeneralCount,
    handoutAutoJudgment: form.value.handoutAutoJudgment,
    handoutJudgmentCount: form.value.handoutJudgmentCount,
  }
}

const updateQuestionImportance = async (item: QuestionBank, importance: number) => {
  if (item.id == null) return
  const normalized = normalizeQuestionBankImportance(importance)
  if (normalizeQuestionBankImportance(item.importance) === normalized) return
  const now = new Date().toISOString()
  await questionBankService.update(item.id, {
    importance: normalized,
    updatedAt: now,
  })
  const idx = questionBanks.value.findIndex((q) => q.id === item.id)
  if (idx >= 0) {
    questionBanks.value[idx] = {
      ...questionBanks.value[idx]!,
      importance: normalized,
      updatedAt: now,
    }
  }
  if (viewingQuestion.value?.id === item.id) {
    viewingQuestion.value = {
      ...viewingQuestion.value,
      importance: normalized,
      updatedAt: now,
    }
  }
}

const removeItem = async (id?: number) => {
  if (!id) return
  const ok = window.confirm(QBANK_UI.deleteConfirm)
  if (!ok) return
  await questionBankService.remove(id)
  message.value = QBANK_UI.deleteSuccess
  if (editingId.value === id) resetForm()
  if (viewingQuestion.value?.id === id) viewingQuestion.value = null
  await loadData()
}

const startCreate = () => {
  if (!selectedLearningTypeId.value || isParentNodeSelected.value) {
    message.value = isParentNodeSelected.value
      ? '父节点不能直接新增内容，请选择具体小项。'
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
    handoutAutoMcq: false,
    handoutMcqCount: HANDOUT_MCQ_COUNT_DEFAULT,
    handoutAutoGeneral: false,
    handoutGeneralCount: HANDOUT_GENERAL_COUNT_DEFAULT,
    handoutAutoJudgment: false,
    handoutJudgmentCount: HANDOUT_JUDGMENT_COUNT_DEFAULT,
  }
  editorInitialForm.value = {
    type: form.value.type,
    title: form.value.title,
    score: form.value.score,
    content: form.value.content,
    analysis: form.value.analysis,
    handoutAutoMcq: false,
    handoutMcqCount: HANDOUT_MCQ_COUNT_DEFAULT,
    handoutAutoGeneral: false,
    handoutGeneralCount: HANDOUT_GENERAL_COUNT_DEFAULT,
    handoutAutoJudgment: false,
    handoutJudgmentCount: HANDOUT_JUDGMENT_COUNT_DEFAULT,
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
    if (!parentTestEntryTree.value) {
      message.value = '当前节点下没有可测试的小项。'
      return
    }
    showParentTestEntryDialog.value = true
    return
  }
  if (testableQuestionBanks.value.length === 0) {
    message.value =
      filteredQuestionBanks.value.length > 0
        ? QBANK_UI.previewOnlyHandout
        : QBANK_UI.noTestable
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
      ? testableQuestionBanks.value.filter((q) => q.id != null)
      : testableQuestionBanks.value.filter(
          (q) => q.id != null && payload.questionIds.includes(q.id),
        )
  if (list.length === 0) {
    message.value = QBANK_UI.noTestable
    return
  }
  testPageQuestions.value = list
  testBuildConfig.value = undefined
  showTestEntryDialog.value = false
  showQuestionTest.value = true
}

function poolQuestionsForTest(payload: QuestionBankTestEntryPayload): QuestionBank[] {
  return filterQuestionsForTestConfig(filteredQuestionBanks.value, {
    learningTypeIds: payload.learningTypeIds,
    includeChoiceLike: payload.includeChoiceLike,
    includeGeneral: payload.includeGeneral,
    includeJudgment: payload.includeJudgment,
  })
}

const onParentTestEntryConfirm = (payload: QuestionBankTestEntryPayload) => {
  resetForm()
  viewingQuestion.value = null
  const list = poolQuestionsForTest(payload)
  if (list.length === 0) {
    message.value = '没有可测验的学习内容，请调整小项或测验包含的题型。'
    return
  }
  if (payload.questionCount != null && payload.questionCount < 1) {
    message.value = '自定义出题数量至少为 1。'
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
  void pageFocusStore.exitStretchIfActive()
  showQuestionTest.value = false
  testPageQuestions.value = []
  testBuildConfig.value = undefined
  testScopeAll.value = false
  celebrateSessionPerfect.value = true
  refreshPerfectClearedIds()
}

const submitFromEditor = async (value: QuestionBankEditorForm) => {
  form.value.type = value.type
  form.value.title = value.title
  if (value.learningTypeId != null) {
    form.value.learningTypeId = value.learningTypeId
  }
  form.value.score = value.score
  form.value.content = value.content
  form.value.analysis = value.analysis
  form.value.handoutAutoMcq = value.handoutAutoMcq
  form.value.handoutMcqCount = value.handoutMcqCount
  form.value.handoutAutoGeneral = value.handoutAutoGeneral
  form.value.handoutGeneralCount = value.handoutGeneralCount
  form.value.handoutAutoJudgment = value.handoutAutoJudgment
  form.value.handoutJudgmentCount = value.handoutJudgmentCount
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
    :class="{
      'is-detail-view': viewingQuestion || showQuestionTest,
      'is-editor-view': showEditor && !viewingQuestion && !showQuestionTest,
    }"
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
        <h2 class="page-title">{{ QBANK_UI.moduleTitle }}</h2>
        <p class="page-subtitle">{{ QBANK_UI.moduleSubtitle }}</p>
      </header>
      <QuestionBankEditorPage
        v-if="showEditor"
        :key="editingId ? `edit-${editingId}` : 'create'"
        :mode="editingId ? 'edit' : 'create'"
        :loading="submitting"
        :initial-form="editorInitialForm"
        :create-learning-type-name="selectedLearningTypeName"
        :learning-type-options="learningTypeSelectOptions"
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
                  ? !parentTestEntryTree
                  : testableQuestionBanks.length === 0
              "
              @click="openQuestionTest"
            >
              {{ QBANK_UI.testButton }}
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
        <div class="question-bank-list-body">
        <p v-if="loading">题库数据加载中...</p>
        <p v-if="message">{{ message }}</p>
        <p v-if="!selectedLearningTypeId">请先从左侧树中选择学习类型。</p>
        <template v-else>
          <p v-if="isParentNodeSelected && !loading" class="parent-node-hint">
            {{
              QBANK_UI.parentHint(
                descendantLeafNodes.length,
                filteredQuestionBanks.length,
              )
            }}
          </p>
          <p v-if="!loading && filteredQuestionBanks.length === 0">{{ QBANK_UI.emptyInNode }}</p>
          <div
            v-if="filteredQuestionBanks.length > 0"
            class="question-table"
            :class="{ 'question-table--tree': isParentNodeSelected }"
          >
            <div class="question-table-head">
              <span>名称</span>
              <span>{{ QBANK_UI.importanceColumn }}</span>
              <span>{{ QBANK_UI.contentTypeColumn }}</span>
              <span>{{ QBANK_UI.testColumn }}</span>
              <span v-if="!isParentNodeSelected">操作</span>
            </div>
            <template v-if="isParentNodeSelected">
              <template v-for="(row, idx) in parentTreeTableRows" :key="rowKeyForTreeRow(row, idx)">
                <div
                  v-if="row.kind === 'branch'"
                  class="question-tree-branch"
                  :class="{ 'is-expanded': isTreeBranchExpanded(row.branchId) }"
                  :style="{ '--qb-tree-depth': row.depth }"
                  role="button"
                  tabindex="0"
                  :aria-expanded="isTreeBranchExpanded(row.branchId)"
                  @click="toggleTreeBranch(row.branchId)"
                  @keydown.enter.prevent="toggleTreeBranch(row.branchId)"
                  @keydown.space.prevent="toggleTreeBranch(row.branchId)"
                >
                  <span class="question-tree-chevron" aria-hidden="true">{{
                    isTreeBranchExpanded(row.branchId) ? '▼' : '▶'
                  }}</span>
                  <span class="question-tree-branch-label">{{ row.node.name }}</span>
                  <span
                    v-if="!isTreeBranchExpanded(row.branchId) && row.descendantCount > 0"
                    class="question-tree-branch-meta"
                  >
                    {{ row.descendantCount }} 条
                  </span>
                </div>
                <div
                  v-else
                  class="question-table-row is-row-open-detail question-table-row--tree-entry"
                  :style="{ '--qb-tree-depth': row.depth }"
                  role="button"
                  tabindex="0"
                  @click="openQuestionDetail(row.question)"
                  @keydown.enter.prevent="openQuestionDetail(row.question)"
                  @keydown.space.prevent="openQuestionDetail(row.question)"
                >
                  <span class="question-tree-entry-title">{{ row.question.title }}</span>
                  <span class="question-importance-cell" @click.stop>
                    <QuestionBankImportanceEditor
                      :model-value="row.question.importance"
                      @update:model-value="updateQuestionImportance(row.question, $event)"
                    />
                  </span>
                  <span>{{ typeTextMap[row.question.type ?? 'general'] }}</span>
                  <span class="question-test-eligibility">
                    <el-tag
                      :type="questionBankIsPreviewOnlyInTest(row.question) ? 'info' : 'success'"
                      size="small"
                      effect="plain"
                    >
                      {{ questionBankTestEligibilityLabel(row.question) }}
                    </el-tag>
                  </span>
                </div>
              </template>
            </template>
            <template v-else>
              <div
                v-for="item in filteredQuestionBanks"
                :key="item.id"
                class="question-table-row is-row-open-detail"
                role="button"
                tabindex="0"
                @click="openQuestionDetail(item)"
                @keydown.enter.prevent="openQuestionDetail(item)"
                @keydown.space.prevent="openQuestionDetail(item)"
              >
                <span>{{ item.title }}</span>
                <span class="question-importance-cell" @click.stop>
                  <QuestionBankImportanceEditor
                    :model-value="item.importance"
                    @update:model-value="updateQuestionImportance(item, $event)"
                  />
                </span>
                <span>{{ typeTextMap[item.type ?? 'general'] }}</span>
                <span class="question-test-eligibility">
                  <el-tag
                    :type="questionBankIsPreviewOnlyInTest(item) ? 'info' : 'success'"
                    size="small"
                    effect="plain"
                  >
                    {{ questionBankTestEligibilityLabel(item) }}
                  </el-tag>
                </span>
                <div class="question-card-actions" @click.stop>
                  <el-button size="small" @click="startEdit(item)">修改</el-button>
                  <el-button size="small" type="danger" @click="removeItem(item.id)">
                    删除
                  </el-button>
                </div>
              </div>
            </template>
          </div>
          <div v-if="orphanQuestionBanks.length > 0" class="orphan-banks-block">
            <p class="orphan-banks-hint">
              以下 {{ orphanQuestionBanks.length }}
              条题库的学习分类已不存在（数据仍在本地库中），可直接打开查看或修改后保存到有效分类。
            </p>
            <div class="question-table">
              <div class="question-table-head">
                <span>名称</span>
                <span>{{ QBANK_UI.contentTypeColumn }}</span>
                <span>原分类 id</span>
                <span>操作</span>
              </div>
              <div
                v-for="item in orphanQuestionBanks"
                :key="item.id ?? item.title"
                class="question-table-row is-row-open-detail"
                role="button"
                tabindex="0"
                @click="openQuestionDetail(item)"
                @keydown.enter.prevent="openQuestionDetail(item)"
                @keydown.space.prevent="openQuestionDetail(item)"
              >
                <span>{{ item.title }}</span>
                <span>{{ typeTextMap[item.type ?? 'general'] }}</span>
                <span>{{ item.learningTypeId }}</span>
                <div class="question-card-actions" @click.stop>
                  <el-button size="small" @click="startEdit(item)">修改</el-button>
                </div>
              </div>
            </div>
          </div>
        </template>
        </div>
      </div>
    </div>
    </template>
    <QuestionBankTestEntryDialog
      v-model="showTestEntryDialog"
      :node-name="selectedLearningTypeName"
      :questions="testableQuestionBanks"
      :type-text-map="typeTextMap"
      @confirm="onLeafTestEntryConfirm"
    />
    <QuestionBankTestParentEntryDialog
      v-model="showParentTestEntryDialog"
      :node-name="selectedLearningTypeName"
      :root-node="selectedNode"
      :all-questions="filteredQuestionBanks"
      @confirm="onParentTestEntryConfirm"
    />
  </section>
</template>

<style scoped>
.question-bank-page:not(.is-detail-view) {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.question-bank-page.is-detail-view {
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

.page-hero {
  flex-shrink: 0;
}

/* 新建/编辑：顶栏固定，表单区在内部滚动（避免被 page overflow:hidden 裁切） */
.question-bank-page.is-editor-view :deep(.question-editor-page) {
  flex: 1 1 auto;
  min-height: 0;
}

.question-bank-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 12px;
  align-items: stretch;
  overflow: hidden;
  --qb-tree-indent: calc(var(--app-handout-font-size, 14px) * 1.15);
  font-size: var(--app-handout-font-size, 14px);
  line-height: var(--app-handout-line-height, 1.65);
}

/* 左侧学习类型树：字号随「学习内容字号」设置联动 */
.question-bank-layout :deep(.type-panel .node-label) {
  font-size: calc(var(--app-handout-font-size, 14px) * 0.9);
}

.question-bank-layout :deep(.type-panel .node-label-level-1) {
  font-size: calc(var(--app-handout-font-size, 14px) * 1.42);
}

.question-bank-layout :deep(.type-panel .node-label-level-2) {
  font-size: calc(var(--app-handout-font-size, 14px) * 1.12);
}

.question-bank-layout :deep(.type-panel .el-tree-node__content) {
  min-height: calc(var(--app-handout-font-size, 14px) * 2.35);
}

.question-bank-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--app-surface);
  box-sizing: border-box;
}

.question-bank-list-body {
  flex: 1 1 auto;
  min-height: 0;
  margin-right: -12px;
  padding-right: 12px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.question-bank-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
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
  grid-template-columns: 1.2fr 0.72fr 0.68fr 1fr 0.88fr;
  align-items: center;
  padding: 8px 10px;
  gap: 8px;
}

.question-table--tree .question-table-head,
.question-table--tree .question-table-row--tree-entry {
  grid-template-columns: 1.35fr 0.72fr 0.68fr 1fr;
}

.question-importance-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}

.question-tree-branch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px 9px calc(10px + var(--qb-tree-depth, 0) * var(--qb-tree-indent));
  font-weight: 600;
  font-size: calc(var(--app-handout-font-size, 14px) * 1.02);
  color: var(--app-text);
  background: var(--app-surface-alt);
  border-bottom: 1px solid var(--app-border-soft);
  cursor: pointer;
  user-select: none;
}

.question-tree-branch:hover {
  background: color-mix(in srgb, var(--app-surface-alt) 88%, var(--app-primary-soft));
}

.question-tree-branch.is-expanded {
  background: color-mix(in srgb, var(--app-primary-soft) 55%, var(--app-surface-alt));
}

.question-tree-chevron {
  flex-shrink: 0;
  width: 1.1em;
  font-size: 0.72em;
  line-height: 1;
  color: var(--app-text-muted);
}

.question-tree-branch-label {
  flex: 1 1 auto;
  min-width: 0;
}

.question-tree-branch-meta {
  flex-shrink: 0;
  font-size: 0.86em;
  font-weight: 500;
  color: var(--app-text-muted);
}

.question-table-row--tree-entry {
  padding-left: calc(10px + var(--qb-tree-depth, 0) * var(--qb-tree-indent));
}

.question-tree-entry-title {
  position: relative;
  padding-left: 0.65em;
}

.question-tree-entry-title::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--app-text-muted);
}

.question-test-eligibility :deep(.el-tag) {
  max-width: 100%;
  white-space: normal;
}

.parent-node-hint {
  margin: 0 0 10px;
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

.orphan-banks-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--app-border-soft);
}

.orphan-banks-hint {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

</style>
