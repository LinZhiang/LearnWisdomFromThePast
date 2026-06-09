import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  FavoriteDerivedMcqPayload,
  LearningType,
  QuestionBank,
  WrongQuestion,
  WrongQuestionTrash,
} from '@/db/models'
import {
  learningTypeService,
  questionBankService,
  wrongQuestionService,
  wrongQuestionTrashService,
} from '@/services/data-services'
import {
  backfillWrongQuestionsFromAnswerLogs,
  buildWrongDueCountByTreeNode,
  countDueWrongQuestions,
  formatDueBranchHint,
  isWrongQuestionReviewDue,
  parseWrongDerivedPayload,
  summarizeDueOutsideLearningTypeScope,
} from '@/services/wrong-question-helpers'
import { useWrongBookDueStore } from '@/stores/wrong-book-due'
import { WRONG_BOOK_UI } from '@/constants/question-bank-copy'
import { QUESTION_BANK_TYPE_LABELS, questionBankNoScoreType } from '@/constants/question-bank-types'
import {
  collectLeafDescendants,
  collectSubtreeNodeIds,
  findLearningTypeNodeById,
} from '@/utils/learningTypeTree'
import {
  buildLearningTypeTreeBranches,
  collectLearningTypeBranchIds,
  flattenLearningTypeTreeDisplay,
} from '@/utils/questionBankTreeTable'
import { validateChoiceQuestionJson } from '@/utils/choiceQuestion'
import { usePageFocusStore } from '@/stores/page-focus'

type LearningTypeNode = LearningType & {
  level: number
  children: LearningTypeNode[]
}

export type WrongBookSortField = 'wrongCount' | 'reviewStage'

export function useWrongBookPage() {
  const pageFocusStore = usePageFocusStore()
  const wrongBookDueStore = useWrongBookDueStore()
  const route = useRoute()
  const router = useRouter()
  const ONLY_DUE_KEY = 'wrong-book-only-due-v2'
  const ONLY_DUE_KEY_LEGACY = 'wrong-book-only-due'
  const SELECTED_LT_KEY = 'wrong-book-selected-learning-type-id'
  /** 进入错题本默认「仅看到期」；仅当用户在本页手动切换后才写入 v2 偏好 */
  const readOnlyDueDefault = (): boolean => {
    try {
      const v = window.localStorage.getItem(ONLY_DUE_KEY)
      if (v != null) return v === '1'
      // 旧键曾长期默认「全部」(0)，升级后不再沿用，统一默认仅看到期
      window.localStorage.removeItem(ONLY_DUE_KEY_LEGACY)
      return true
    } catch {
      return true
    }
  }
  const readNullableNumber = (key: string): number | null => {
    try {
      const v = window.localStorage.getItem(key)
      if (!v) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    } catch {
      return null
    }
  }
  const learningTypes = ref<LearningType[]>([])
  const questionBanks = ref<QuestionBank[]>([])
  const wrongRows = ref<WrongQuestion[]>([])
  const selectedLearningTypeId = ref<number | null>(readNullableNumber(SELECTED_LT_KEY))
  const loading = ref(false)
  const message = ref('')
  const onlyDue = ref(readOnlyDueDefault())
  const backfilling = ref(false)
  const backfillWithinDays = ref(30)
  const currentPage = ref(1)
  const pageSize = ref(10)
  const selectedRowIds = ref<number[]>([])
  const showTrashPanel = ref(false)
  const trashRows = ref<WrongQuestionTrash[]>([])
  const selectedTrashIds = ref<number[]>([])
  const showQuestionTest = ref(false)
  /** 进入错题测验时冻结的错题列表（用于 DeepSeek 变式出题） */
  const wrongBookTestSnapshot = ref<WrongQuestion[]>([])

  const viewingBankQuestion = ref<QuestionBank | null>(null)
  const viewingWrongRow = ref<WrongQuestion | null>(null)
  const viewingDerivedPayload = ref<FavoriteDerivedMcqPayload | null>(null)
  const viewingDerivedLearningTypeId = ref<number | null>(null)

  /**
   * 进入错题详情时冻结的「上下题」顺序（当前筛选 + 排序下各条 id），
   * 避免列表筛选/排序变化导致题标与上一题/下一题错位。
   */
  const detailNavOrderIds = ref<number[]>([])

  /** 错题列表排序：默认按下次复习时间；可切换错误次数 / 复习轮次升序或降序 */
  const wrongBookSortField = ref<WrongBookSortField | null>(null)
  const wrongBookSortOrder = ref<'asc' | 'desc'>('asc')

  const typeTextMap = QUESTION_BANK_TYPE_LABELS

  const normalizeQuestionBanks = (raw: QuestionBank[]) =>
    raw.map((item) => ({
      ...item,
      type: item.type ?? 'general',
      analysis: item.analysis ?? '',
      score: Number.isInteger(item.score) && item.score >= 0 ? item.score : 0,
    }))

  const getLearningTypeName = (id?: number) => {
    if (!id) return '未分类'
    return learningTypes.value.find((item) => item.id === id)?.name ?? '未分类'
  }

  const selectedLearningTypeName = computed(() => {
    if (selectedLearningTypeId.value == null) return '全库'
    return getLearningTypeName(selectedLearningTypeId.value)
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

  const descendantSubtreeIds = computed(() => {
    const node = selectedNode.value
    if (!node) return []
    return collectSubtreeNodeIds(node)
  })

  const isParentNodeSelected = computed(() => (selectedNode.value?.children.length ?? 0) > 0)

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
        const p = map.get(parentId)!
        node.level = p.level + 1
        p.children.push(node)
        return
      }
      roots.push(node)
    })
    return roots
  })

  const scopedWrongRows = computed(() => {
    let rows = wrongRows.value.slice()
    if (selectedLearningTypeId.value == null) return rows
    const node = selectedNode.value
    if (!node) return []
    const idSet = new Set(collectSubtreeNodeIds(node))
    return rows.filter((r) => r.learningTypeId != null && idSet.has(r.learningTypeId))
  })

  const dueCountInScope = computed(() => countDueWrongQuestions(scopedWrongRows.value))

  const dueCountByTreeNode = computed(() => {
    const map = buildWrongDueCountByTreeNode(treeNodes.value, wrongRows.value)
    return Object.fromEntries(map) as Record<number, number>
  })

  const dueOutsideBranches = computed(() => {
    if (selectedLearningTypeId.value == null) return []
    const scopeSubtreeSet = new Set(descendantSubtreeIds.value)
    return summarizeDueOutsideLearningTypeScope(
      treeNodes.value,
      wrongRows.value,
      scopeSubtreeSet,
    )
  })

  const dueNoticeText = computed(() => {
    const scope = dueCountInScope.value
    const global = wrongBookDueStore.dueCount
    const branchHint = formatDueBranchHint(dueOutsideBranches.value)

    if (selectedLearningTypeId.value == null) {
      if (scope > 0) return `全库共 ${scope} 道待复习，建议进行错题测验。`
      return ''
    }

    if (scope > 0) {
      if (global > scope) {
        return WRONG_BOOK_UI.dueScopePartialGlobal(scope, global, branchHint)
      }
      return WRONG_BOOK_UI.dueScopeNotice(scope)
    }
    if (global > 0) return WRONG_BOOK_UI.dueScopeNoneGlobal(global, branchHint)
    return ''
  })

  const showViewAllDueButton = computed(
    () => wrongBookDueStore.dueCount > 0 && selectedLearningTypeId.value != null,
  )

  const showAllDueQuestions = () => {
    selectedLearningTypeId.value = null
    onlyDue.value = true
    currentPage.value = 1
    selectedRowIds.value = []
  }

  const selectLearningTypeForDue = (learningTypeId: number) => {
    selectedLearningTypeId.value = learningTypeId
    onlyDue.value = true
    currentPage.value = 1
    selectedRowIds.value = []
  }

  const filteredWrongRows = computed(() => {
    const nowMs = Date.now()
    let rows = scopedWrongRows.value.slice()
    if (onlyDue.value) {
      rows = rows.filter((r) => isWrongQuestionReviewDue(r, nowMs))
    }
    const field = wrongBookSortField.value
    const order = wrongBookSortOrder.value
    return rows.sort((a, b) => {
      if (field === 'wrongCount') {
        const diff = (a.wrongCount ?? 0) - (b.wrongCount ?? 0)
        if (diff !== 0) return order === 'asc' ? diff : -diff
      } else if (field === 'reviewStage') {
        const diff = (a.reviewStage ?? 0) - (b.reviewStage ?? 0)
        if (diff !== 0) return order === 'asc' ? diff : -diff
      }
      return new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
    })
  })

  /** 错题测验构建时查找关联题库条目（不直接作为测验题） */
  const wrongBookTestBankLookup = computed(() => {
    const ids = new Set<number>()
    for (const r of filteredWrongRows.value) {
      const derived = parseWrongDerivedPayload(r.derivedPayloadJson)
      if (derived?.parentQuestionBankId != null) {
        ids.add(derived.parentQuestionBankId)
      }
      if (r.questionBankId != null) ids.add(r.questionBankId)
    }
    if (!ids.size) return []
    return questionBanks.value.filter((q) => q.id != null && ids.has(q.id))
  })

  const parentTreeBranches = computed(() => {
    const node = selectedNode.value
    if (!node || !isParentNodeSelected.value) return []
    return buildLearningTypeTreeBranches(node, filteredWrongRows.value, (r) => r.learningTypeId)
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

  const paginatedWrongRows = computed(() => {
    const all = filteredWrongRows.value
    const start = (currentPage.value - 1) * pageSize.value
    return all.slice(start, start + pageSize.value)
  })

  const selectableFilteredIds = computed(() =>
    filteredWrongRows.value.map((r) => r.id).filter((id): id is number => id != null),
  )

  const pageSelectedCount = computed(() => {
    const ids = isParentNodeSelected.value
      ? selectableFilteredIds.value
      : paginatedWrongRows.value.map((r) => r.id).filter((id): id is number => id != null)
    return ids.filter((id) => selectedRowIds.value.includes(id)).length
  })

  const pageAllSelected = computed(() => {
    const ids = isParentNodeSelected.value
      ? selectableFilteredIds.value
      : paginatedWrongRows.value.map((r) => r.id).filter((id): id is number => id != null)
    if (!ids.length) return false
    return pageSelectedCount.value === ids.length
  })

  const pageIndeterminate = computed(() => {
    const ids = isParentNodeSelected.value
      ? selectableFilteredIds.value
      : paginatedWrongRows.value.map((r) => r.id).filter((id): id is number => id != null)
    const n = pageSelectedCount.value
    return n > 0 && n < ids.length
  })

  // 切换知识点：回到第一页、清空勾选、收起树表分组
  watch(selectedLearningTypeId, () => {
    currentPage.value = 1
    selectedRowIds.value = []
    expandedTreeBranchIds.value = new Set()
  })

  watch(
    () => [parentTreeBranches.value, isParentNodeSelected.value] as const,
    ([branches, isParent]) => {
      if (!isParent || branches.length === 0) return
      expandedTreeBranchIds.value = new Set(collectLearningTypeBranchIds(branches))
    },
  )

  // 仅到期 / 每页条数：只回到第一页，不清空勾选
  watch(
    () => [onlyDue.value, pageSize.value],
    () => {
      currentPage.value = 1
    },
  )

  watch(onlyDue, (v) => {
    try {
      window.localStorage.setItem(ONLY_DUE_KEY, v ? '1' : '0')
    } catch {
      // ignore
    }
  })

  watch(selectedLearningTypeId, (v) => {
    try {
      if (v == null) {
        window.localStorage.removeItem(SELECTED_LT_KEY)
      } else {
        window.localStorage.setItem(SELECTED_LT_KEY, String(v))
      }
    } catch {
      // ignore
    }
  })

  watch(filteredWrongRows, (rows) => {
    const maxPage = Math.max(1, Math.ceil(rows.length / pageSize.value))
    if (currentPage.value > maxPage) currentPage.value = maxPage
    const valid = new Set(rows.map((r) => r.id).filter((id): id is number => id != null))
    selectedRowIds.value = selectedRowIds.value.filter((id) => valid.has(id))
  })

  const loadData = async () => {
    loading.value = true
    try {
      learningTypes.value = await learningTypeService.listAll()
      questionBanks.value = normalizeQuestionBanks(await questionBankService.listAll())
      wrongRows.value = await wrongQuestionService.listAll()
      trashRows.value = await wrongQuestionTrashService.listAll()
      if (
        selectedLearningTypeId.value != null &&
        !learningTypes.value.some((x) => x.id === selectedLearningTypeId.value)
      ) {
        selectedLearningTypeId.value = null
      }
      message.value = ''
      void wrongBookDueStore.refresh()
    } catch {
      message.value = '错题本加载失败，请刷新后重试。'
    } finally {
      loading.value = false
    }
  }

  const rowTypeLabel = (row: WrongQuestion) => {
    if (row.questionType === 'mindmap-mcq') return '导图选择题'
    if (row.questionType === 'choice') return '选择题'
    return '作答题'
  }

  const rowDisplayTitle = (row: WrongQuestion) => {
    const stem = (row.stem ?? '').trim()
    if (row.questionType === 'mindmap-mcq' && stem) return stem
    const fromBank =
      row.questionBankId != null ? questionBanks.value.find((q) => q.id === row.questionBankId)?.title : ''
    return (fromBank || row.title || '未知条目').trim()
  }

  const rowReviewStageLabel = (stage: number) => `第 ${Math.max(1, stage + 1)} 轮复习`

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  const rowDueTag = (row: WrongQuestion) => {
    const due = new Date(row.nextReviewAt).getTime()
    return due <= Date.now() ? '应复习' : '待安排'
  }

  const rowScoreDisplay = (row: WrongQuestion) => {
    if (row.questionType === 'mindmap-mcq') return '-'
    const bank =
      row.questionBankId != null
        ? questionBanks.value.find((q) => q.id === row.questionBankId)
        : undefined
    if (!bank) return '-'
    if (questionBankNoScoreType(bank)) return '-'
    return String(bank.score ?? 0)
  }

  const toggleWrongBookSort = (field: WrongBookSortField) => {
    if (wrongBookSortField.value === field) {
      if (wrongBookSortOrder.value === 'asc') {
        wrongBookSortOrder.value = 'desc'
      } else {
        wrongBookSortField.value = null
        wrongBookSortOrder.value = 'asc'
      }
    } else {
      wrongBookSortField.value = field
      wrongBookSortOrder.value = 'asc'
    }
    currentPage.value = 1
  }

  const wrongBookSortIndicator = (field: WrongBookSortField) => {
    if (wrongBookSortField.value !== field) return '↕'
    return wrongBookSortOrder.value === 'asc' ? '↑' : '↓'
  }

  const wrongBookSortAriaLabel = (field: WrongBookSortField, label: string) => {
    if (wrongBookSortField.value !== field) return `${label}，点击排序`
    const dir = wrongBookSortOrder.value === 'asc' ? '升序' : '降序'
    return `${label}，当前${dir}，再次点击切换`
  }

  const captureWrongBookDetailNavSnapshot = () => {
    detailNavOrderIds.value = filteredWrongRows.value
      .map((r) => r.id)
      .filter((id): id is number => id != null)
  }

  const openRow = async (row: WrongQuestion, opts?: { keepNavSnapshot?: boolean }) => {
    message.value = ''
    if (!opts?.keepNavSnapshot) {
      captureWrongBookDetailNavSnapshot()
    }
    viewingWrongRow.value = row
    const payload = parseWrongDerivedPayload(row.derivedPayloadJson)
    if (payload) {
      viewingBankQuestion.value = null
      viewingDerivedPayload.value = payload
      viewingDerivedLearningTypeId.value = row.learningTypeId
      return
    }
    viewingDerivedPayload.value = null
    viewingDerivedLearningTypeId.value = null
    if (row.questionBankId == null) {
      message.value = '该错题记录缺少原题引用。'
      return
    }
    const q = await questionBankService.getById(row.questionBankId)
    if (!q) {
      message.value = '原题可能已删除，无法打开详情。'
      viewingBankQuestion.value = null
      return
    }
    const norm = normalizeQuestionBanks([q])[0]!
    if (norm.type === 'choice' && !validateChoiceQuestionJson(norm.content ?? '').ok) {
      message.value = '该选择题数据无效，无法打开详情。'
      viewingBankQuestion.value = null
      return
    }
    viewingBankQuestion.value = norm
  }

  const closeDetail = () => {
    void pageFocusStore.exitStretchIfActive()
    viewingWrongRow.value = null
    viewingBankQuestion.value = null
    viewingDerivedPayload.value = null
    viewingDerivedLearningTypeId.value = null
    detailNavOrderIds.value = []
  }

  /** 与错题列表页三种详情视图一致，用于显示上一题/下一题导航 */
  const wrongBookDetailSurfaceOpen = computed(() => {
    if (showQuestionTest.value) return false
    const row = viewingWrongRow.value
    if (!row) return false
    if (row.questionType === 'mindmap-mcq' && !viewingDerivedPayload.value) return true
    if (viewingBankQuestion.value) return true
    if (viewingDerivedPayload.value != null && viewingDerivedLearningTypeId.value != null) return true
    return false
  })

  const wrongBookDetailNav = computed(() => {
    if (!wrongBookDetailSurfaceOpen.value) return null
    const id = viewingWrongRow.value?.id
    const ids = detailNavOrderIds.value
    if (id == null || !ids.length) return null
    const i = ids.indexOf(id)
    if (i < 0) return null
    return {
      current: i + 1,
      total: ids.length,
      hasPrev: i > 0,
      hasNext: i < ids.length - 1,
    }
  })

  async function goWrongBookDetailNeighbor(offset: -1 | 1) {
    const ids = detailNavOrderIds.value
    const id = viewingWrongRow.value?.id
    if (id == null || !ids.length) return
    const i = ids.indexOf(id)
    if (i < 0) return
    const nextI = i + offset
    if (nextI < 0 || nextI >= ids.length) return
    const nextId = ids[nextI]
    if (nextId == null) return
    const nextRow = wrongRows.value.find((r) => r.id === nextId)
    if (!nextRow) {
      message.value = '相邻错题记录可能已删除，请返回列表刷新。'
      return
    }
    await openRow(nextRow, { keepNavSnapshot: true })
  }

  const goWrongBookDetailPrev = () => {
    void goWrongBookDetailNeighbor(-1)
  }

  const goWrongBookDetailNext = () => {
    void goWrongBookDetailNeighbor(1)
  }

  const openWrongBookTest = () => {
    if (!selectedLearningTypeId.value) {
      message.value = '请先在左侧树中选择知识点。'
      return
    }
    if (filteredWrongRows.value.length === 0) {
      message.value = '当前筛选下没有可测验的错题。'
      return
    }
    const hasBankRef = filteredWrongRows.value.some((r) => {
      if (r.questionBankId != null) return true
      const derived = parseWrongDerivedPayload(r.derivedPayloadJson)
      return derived?.parentQuestionBankId != null
    })
    if (!hasBankRef) {
      message.value = '当前错题没有关联学习内容，无法生成测验。'
      return
    }
    closeDetail()
    showTrashPanel.value = false
    wrongBookTestSnapshot.value = filteredWrongRows.value.slice()
    showQuestionTest.value = true
    message.value = ''
  }

  const closeWrongBookTest = () => {
    showQuestionTest.value = false
    wrongBookTestSnapshot.value = []
    void loadData()
  }

  const removeRow = async (id?: number) => {
    if (id == null) return
    if (!window.confirm('确认删除该错题记录吗？')) return
    const row = wrongRows.value.find((x) => x.id === id)
    if (row) {
      await wrongQuestionTrashService.create({
        originalWrongQuestionId: row.id,
        payloadJson: JSON.stringify(row),
        deletedAt: new Date().toISOString(),
      })
    }
    await wrongQuestionService.remove(id)
    selectedRowIds.value = selectedRowIds.value.filter((x) => x !== id)
    await loadData()
  }

  const toggleRowSelect = (id?: number) => {
    if (id == null) return
    const set = new Set(selectedRowIds.value)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    selectedRowIds.value = [...set]
  }

  const toggleSelectAllOnPage = (checked: boolean) => {
    const pageIds = isParentNodeSelected.value
      ? selectableFilteredIds.value
      : paginatedWrongRows.value.map((r) => r.id).filter((id): id is number => id != null)
    const set = new Set(selectedRowIds.value)
    if (checked) pageIds.forEach((id) => set.add(id))
    else pageIds.forEach((id) => set.delete(id))
    selectedRowIds.value = [...set]
  }

  const clearSelection = () => {
    selectedRowIds.value = []
  }

  const batchRemoveSelected = async () => {
    const ids = selectedRowIds.value.slice()
    if (!ids.length) {
      message.value = '请先勾选要删除的错题。'
      return
    }
    if (!window.confirm(`确认批量删除已勾选的 ${ids.length} 条错题记录吗？`)) return
    const idSet = new Set(ids)
    const rows = wrongRows.value.filter((r) => r.id != null && idSet.has(r.id))
    await Promise.all(
      rows.map((r) =>
        wrongQuestionTrashService.create({
          originalWrongQuestionId: r.id,
          payloadJson: JSON.stringify(r),
          deletedAt: new Date().toISOString(),
        }),
      ),
    )
    await Promise.all(ids.map((id) => wrongQuestionService.remove(id)))
    selectedRowIds.value = []
    message.value = `已删除 ${ids.length} 条错题记录（可在回收站恢复）。`
    await loadData()
  }

  const trashAllSelected = computed(
    () => !!trashRows.value.length && selectedTrashIds.value.length === trashRows.value.length,
  )

  const trashIndeterminate = computed(
    () => selectedTrashIds.value.length > 0 && selectedTrashIds.value.length < trashRows.value.length,
  )

  const toggleTrashRowSelect = (id?: number) => {
    if (id == null) return
    const set = new Set(selectedTrashIds.value)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    selectedTrashIds.value = [...set]
  }

  const toggleTrashSelectAll = (checked: boolean) => {
    if (checked) {
      selectedTrashIds.value = trashRows.value.map((r) => r.id).filter((id): id is number => id != null)
      return
    }
    selectedTrashIds.value = []
  }

  const clearTrashSelection = () => {
    selectedTrashIds.value = []
  }

  const parseTrashRowTitle = (row: WrongQuestionTrash) => {
    try {
      const payload = JSON.parse(row.payloadJson) as Partial<WrongQuestion>
      return payload.title?.trim() || '未知错题'
    } catch {
      return '未知错题'
    }
  }

  const restoreSelectedFromTrash = async () => {
    const ids = selectedTrashIds.value.slice()
    if (!ids.length) {
      message.value = '请先勾选要恢复的记录。'
      return
    }
    const picked = trashRows.value.filter((r) => r.id != null && ids.includes(r.id))
    const active = await wrongQuestionService.listAll()
    for (const item of picked) {
      let payload: Partial<WrongQuestion> | null = null
      try {
        payload = JSON.parse(item.payloadJson) as Partial<WrongQuestion>
      } catch {
        payload = null
      }
      if (!payload) continue
      const now = new Date().toISOString()
      const existed = active.find(
        (x) =>
          x.learningTypeId === Number(payload.learningTypeId ?? 0) &&
          x.questionType === (payload.questionType ?? 'general') &&
          x.questionBankId === payload.questionBankId &&
          (x.stem ?? '') === (payload.stem ?? '') &&
          (x.derivedPayloadJson ?? '') === (payload.derivedPayloadJson ?? ''),
      )
      if (!existed) {
        await wrongQuestionService.create({
          learningTypeId: Number(payload.learningTypeId ?? 0),
          questionBankId: payload.questionBankId,
          derivedPayloadJson: payload.derivedPayloadJson,
          questionType: (payload.questionType ?? 'general') as WrongQuestion['questionType'],
          title: payload.title ?? '未知错题',
          stem: payload.stem,
          wrongCount: Math.max(1, Number(payload.wrongCount ?? 1)),
          reviewStage: Math.max(0, Number(payload.reviewStage ?? 0)),
          lastWrongAt: payload.lastWrongAt ?? now,
          nextReviewAt: payload.nextReviewAt ?? now,
          lastQuizSessionId: payload.lastQuizSessionId,
          createdAt: payload.createdAt ?? now,
          updatedAt: now,
        })
      }
      if (item.id != null) await wrongQuestionTrashService.remove(item.id)
    }
    selectedTrashIds.value = []
    message.value = `已恢复 ${picked.length} 条删除记录。`
    showTrashPanel.value = false
    await loadData()
  }

  const purgeSelectedFromTrash = async () => {
    const ids = selectedTrashIds.value.slice()
    if (!ids.length) {
      message.value = '请先勾选要彻底删除的记录。'
      return
    }
    if (!window.confirm(`确认彻底删除回收站内已勾选的 ${ids.length} 条记录吗？该操作不可恢复。`)) {
      return
    }
    await Promise.all(ids.map((id) => wrongQuestionTrashService.remove(id)))
    selectedTrashIds.value = []
    message.value = `已彻底删除 ${ids.length} 条回收站记录。`
    await loadData()
  }

  const backfillFromLogs = async () => {
    if (backfilling.value) return
    backfilling.value = true
    message.value = ''
    try {
      const res = await backfillWrongQuestionsFromAnswerLogs({
        withinDays: backfillWithinDays.value,
        dryRun: false,
      })
      // 回填后自动切到“全部”，避免新数据因“仅看到期”被隐藏而误以为未生效
      onlyDue.value = false
      currentPage.value = 1
      selectedRowIds.value = []
      await loadData()
      message.value = `回填完成：最近 ${backfillWithinDays.value} 天内扫描错题 ${res.scanned} 条，新增/更新 ${res.addedOrUpdated} 条；跳过重复回填 ${res.skippedDuplicated} 条（已自动刷新并切换为“全部”视图）。`
    } catch {
      message.value = '历史日志回填失败，请稍后重试。'
    } finally {
      backfilling.value = false
    }
  }

  const previewBackfillFromLogs = async () => {
    if (backfilling.value) return
    backfilling.value = true
    message.value = ''
    try {
      const res = await backfillWrongQuestionsFromAnswerLogs({
        withinDays: backfillWithinDays.value,
        dryRun: true,
      })
      message.value = `回填预览：最近 ${backfillWithinDays.value} 天内可识别错题 ${res.scanned} 条，预计新增/更新 ${res.addedOrUpdated} 条；已回填重复将跳过 ${res.skippedDuplicated} 条。`
    } catch {
      message.value = '回填预览失败，请稍后重试。'
    } finally {
      backfilling.value = false
    }
  }

  const applyAllDueViewFromRoute = () => {
    if (route.query.allDue !== '1') return
    showAllDueQuestions()
    void router.replace({ path: route.path })
  }

  watch(
    () => route.query.allDue,
    () => {
      applyAllDueViewFromRoute()
    },
  )

  onMounted(() => {
    applyAllDueViewFromRoute()
    void loadData()
  })

  return reactive({
    learningTypes,
    questionBanks,
    wrongRows,
    selectedLearningTypeId,
    loading,
    message,
    onlyDue,
    backfilling,
    backfillWithinDays,
    currentPage,
    pageSize,
    selectedRowIds,
    showTrashPanel,
    trashRows,
    selectedTrashIds,
    showQuestionTest,
    wrongBookTestBankLookup,
    wrongBookTestSnapshot,
    viewingBankQuestion,
    viewingWrongRow,
    viewingDerivedPayload,
    viewingDerivedLearningTypeId,
    typeTextMap,
    getLearningTypeName,
    selectedLearningTypeName,
    selectedNode,
    descendantLeafNodes,
    isParentNodeSelected,
    treeNodes,
    filteredWrongRows,
    dueCountInScope,
    dueCountByTreeNode,
    dueOutsideBranches,
    dueNoticeText,
    showViewAllDueButton,
    showAllDueQuestions,
    selectLearningTypeForDue,
    parentTreeTableRows,
    isTreeBranchExpanded,
    toggleTreeBranch,
    rowKeyForTreeRow,
    WRONG_BOOK_UI,
    paginatedWrongRows,
    pageAllSelected,
    pageIndeterminate,
    trashAllSelected,
    trashIndeterminate,
    loadData,
    rowTypeLabel,
    rowDisplayTitle,
    rowReviewStageLabel,
    formatTime,
    rowDueTag,
    rowScoreDisplay,
    toggleWrongBookSort,
    wrongBookSortIndicator,
    wrongBookSortAriaLabel,
    openRow,
    closeDetail,
    wrongBookDetailSurfaceOpen,
    wrongBookDetailNav,
    goWrongBookDetailPrev,
    goWrongBookDetailNext,
    openWrongBookTest,
    closeWrongBookTest,
    removeRow,
    toggleRowSelect,
    toggleSelectAllOnPage,
    clearSelection,
    batchRemoveSelected,
    toggleTrashRowSelect,
    toggleTrashSelectAll,
    clearTrashSelection,
    restoreSelectedFromTrash,
    purgeSelectedFromTrash,
    parseTrashRowTitle,
    backfillFromLogs,
    previewBackfillFromLogs,
  })
}

