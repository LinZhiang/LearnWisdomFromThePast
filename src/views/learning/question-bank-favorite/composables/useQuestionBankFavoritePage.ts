import { computed, onMounted, reactive, ref } from 'vue'
import type { FavoriteDerivedMcqPayload, LearningType, QuestionBank } from '@/db/models'
import {
  favoriteQuestionService,
  learningTypeService,
  questionBankService,
} from '@/services/data-services'
import { parseFavoriteDerivedPayload } from '@/services/favorite-question-helpers'
import { FAVORITE_UI, QUESTION_BANK_TYPE_LABELS } from '@/constants/question-bank-copy'
import { validateChoiceQuestionJson } from '@/utils/choiceQuestion'
import {
  collectLeafDescendants,
  collectSubtreeNodeIds,
  findLearningTypeNodeById,
} from '@/utils/learningTypeTree'
import {
  buildLearningTypeTreeBranches,
  flattenLearningTypeTreeDisplay,
} from '@/utils/questionBankTreeTable'
import type { TestUnit } from '@/views/learning/question-bank/components/questionBankTestTypes'
import { usePageFocusStore } from '@/stores/page-focus'

type LearningTypeNode = LearningType & {
  level: number
  children: LearningTypeNode[]
}

export function useQuestionBankFavoritePage() {
  const pageFocusStore = usePageFocusStore()
  const learningTypes = ref<LearningType[]>([])
  const questionBanks = ref<QuestionBank[]>([])
  const favorites = ref<Awaited<ReturnType<typeof favoriteQuestionService.listAll>>>([])
  const selectedLearningTypeId = ref<number | null>(null)
  const loading = ref(false)
  const message = ref('')

  const viewingBankQuestion = ref<QuestionBank | null>(null)
  const viewingDerivedPayload = ref<FavoriteDerivedMcqPayload | null>(null)
  /** 当前查看的衍生题收藏所属学习类型（与记录一致） */
  const viewingDerivedLearningTypeId = ref<number | null>(null)
  const viewingFavoriteId = ref<number | null>(null)
  const showQuestionTest = ref(false)

  const typeTextMap = QUESTION_BANK_TYPE_LABELS

  const getLearningTypeName = (id?: number) => {
    if (!id) return '未分类'
    return learningTypes.value.find((item) => item.id === id)?.name ?? '未分类'
  }

  const selectedLearningTypeName = computed(() =>
    getLearningTypeName(selectedLearningTypeId.value ?? undefined),
  )

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

  const isParentNodeSelected = computed(() => (selectedNode.value?.children.length ?? 0) > 0)

  const filteredFavorites = computed(() => {
    if (!selectedLearningTypeId.value) return []
    const node = selectedNode.value
    if (!node) return []
    const idSet = new Set(collectSubtreeNodeIds(node))
    return favorites.value
      .filter((f) => f.learningTypeId != null && idSet.has(f.learningTypeId))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  })

  const parentTreeBranches = computed(() => {
    const node = selectedNode.value
    if (!node || !isParentNodeSelected.value) return []
    return buildLearningTypeTreeBranches(node, filteredFavorites.value, (f) => f.learningTypeId)
  })

  const expandedTreeBranchIds = ref<Set<string>>(new Set())

  const parentTreeTableRows = computed(() =>
    flattenLearningTypeTreeDisplay(parentTreeBranches.value, expandedTreeBranchIds.value),
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
    const item = row.item
    return `entry-${item.id ?? idx}`
  }

  const testQuestionBanks = computed<QuestionBank[]>(() => {
    const ids = new Set<number>()
    filteredFavorites.value.forEach((f) => {
      if (f.questionBankId != null) ids.add(f.questionBankId)
    })
    if (!ids.size) return []
    return questionBanks.value.filter((q) => q.id != null && ids.has(q.id))
  })

  const testPresetUnits = computed<TestUnit[]>(() => {
    const out: TestUnit[] = []
    filteredFavorites.value.forEach((f) => {
      const derived = parseFavoriteDerivedPayload(f.derivedPayloadJson)
      if (!derived) return
      const parent = questionBanks.value.find((q) => q.id === derived.parentQuestionBankId)
      if (!parent) return
      out.push({
        kind: 'mindmap-mcq',
        parent,
        stem: derived.stem,
        options: [...derived.options],
        correctIndices: [...derived.correctIndices],
        mode: derived.mode,
        subIndex: derived.subIndex,
        subTotal: derived.subTotal,
      })
    })
    return out
  })

  const normalizeQuestionBanks = (raw: QuestionBank[]) =>
    raw.map((item) => ({
      ...item,
      type: item.type ?? 'general',
      analysis: item.analysis ?? '',
      score: Number.isInteger(item.score) && item.score >= 0 ? item.score : 0,
    }))

  const loadData = async () => {
    loading.value = true
    try {
      learningTypes.value = await learningTypeService.listAll()
      const raw = await questionBankService.listAll()
      questionBanks.value = normalizeQuestionBanks(raw)
      favorites.value = await favoriteQuestionService.listAll()
      message.value = ''
      if (viewingBankQuestion.value?.id != null) {
        const next = questionBanks.value.find((q) => q.id === viewingBankQuestion.value!.id)
        viewingBankQuestion.value = next ?? viewingBankQuestion.value
      }
    } catch {
      message.value = '数据加载失败，请刷新页面后重试。'
      viewingFavoriteId.value = null
      viewingDerivedLearningTypeId.value = null
      viewingBankQuestion.value = null
      viewingDerivedPayload.value = null
    } finally {
      loading.value = false
    }
  }

  const rowTitle = (f: (typeof favorites.value)[number]) => {
    const derived = parseFavoriteDerivedPayload(f.derivedPayloadJson)
    if (derived) {
      const s = derived.stem.trim()
      return `${derived.parentTitle} · ${s.length > 40 ? `${s.slice(0, 40)}…` : s}`
    }
    const q = questionBanks.value.find((x) => x.id === f.questionBankId)
    return q?.title ?? (f.questionBankId != null ? `题库 #${f.questionBankId}` : '未知条目')
  }

  const rowTypeLabel = (f: (typeof favorites.value)[number]) => {
    if (parseFavoriteDerivedPayload(f.derivedPayloadJson)) return '导图选择题'
    const q = questionBanks.value.find((x) => x.id === f.questionBankId)
    const t = q?.type ?? 'general'
    return typeTextMap[t]
  }

  const openFavoriteRow = async (f: (typeof favorites.value)[number]) => {
    viewingFavoriteId.value = f.id ?? null
    message.value = ''
    const derived = parseFavoriteDerivedPayload(f.derivedPayloadJson)
    if (derived) {
      viewingBankQuestion.value = null
      viewingDerivedLearningTypeId.value = f.learningTypeId
      viewingDerivedPayload.value = derived
      return
    }
    viewingDerivedLearningTypeId.value = null
    if (f.questionBankId == null) {
      message.value = '该收藏记录无效。'
      return
    }
    const q = await questionBankService.getById(f.questionBankId)
    viewingDerivedPayload.value = null
    viewingDerivedLearningTypeId.value = null
    if (!q) {
      message.value = '原题库题目可能已删除，仅保留收藏记录。'
      viewingBankQuestion.value = null
      return
    }
    const norm = normalizeQuestionBanks([q])[0]!
    if (norm.type === 'choice' && !validateChoiceQuestionJson(norm.content ?? '').ok) {
      message.value = '该选择题数据无效，无法在收藏页打开详情。'
      viewingBankQuestion.value = null
      return
    }
    viewingBankQuestion.value = norm
  }

  const closeDetail = () => {
    void pageFocusStore.exitStretchIfActive()
    viewingFavoriteId.value = null
    viewingDerivedLearningTypeId.value = null
    viewingBankQuestion.value = null
    viewingDerivedPayload.value = null
  }

  const openQuestionTest = () => {
    if (!selectedLearningTypeId.value) {
      message.value = '请先在左侧树中选择学习类型。'
      return
    }
    if (testQuestionBanks.value.length === 0 && testPresetUnits.value.length === 0) {
      message.value = '当前类型下暂无可测试的收藏题目。'
      return
    }
    closeDetail()
    showQuestionTest.value = true
    message.value = ''
  }

  const closeQuestionTest = () => {
    void pageFocusStore.exitStretchIfActive()
    showQuestionTest.value = false
  }

  const removeFavorite = async (id?: number) => {
    if (id == null) return
    const ok = window.confirm('确认取消收藏该题目吗？')
    if (!ok) return
    await favoriteQuestionService.remove(id)
    message.value = '已取消收藏。'
    if (viewingFavoriteId.value === id) closeDetail()
    await loadData()
  }

  onMounted(() => {
    void loadData()
  })

  return reactive({
    learningTypes,
    questionBanks,
    favorites,
    selectedLearningTypeId,
    loading,
    message,
    viewingBankQuestion,
    viewingDerivedPayload,
    viewingDerivedLearningTypeId,
    viewingFavoriteId,
    showQuestionTest,
    typeTextMap,
    FAVORITE_UI,
    getLearningTypeName,
    selectedLearningTypeName,
    treeNodes,
    selectedNode,
    descendantLeafNodes,
    isParentNodeSelected,
    parentTreeTableRows,
    isTreeBranchExpanded,
    toggleTreeBranch,
    rowKeyForTreeRow,
    filteredFavorites,
    loadData,
    rowTitle,
    rowTypeLabel,
    testQuestionBanks,
    testPresetUnits,
    openFavoriteRow,
    closeDetail,
    openQuestionTest,
    closeQuestionTest,
    removeFavorite,
  })
}
