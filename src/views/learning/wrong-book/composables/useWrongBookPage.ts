import { computed, onMounted, reactive, ref, watch } from 'vue'
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
  markWrongQuestionReviewed,
  parseWrongDerivedPayload,
} from '@/services/wrong-question-helpers'
import { validateChoiceQuestionJson } from '@/utils/choiceQuestion'
import type { TestUnit } from '@/views/learning/question-bank/components/questionBankTestTypes'

type LearningTypeNode = LearningType & {
  level: number
  children: LearningTypeNode[]
}

export function useWrongBookPage() {
  const ONLY_DUE_KEY = 'wrong-book-only-due'
  const SELECTED_LT_KEY = 'wrong-book-selected-learning-type-id'
  const readBool = (key: string, fallback: boolean) => {
    try {
      const v = window.localStorage.getItem(key)
      if (v == null) return fallback
      return v === '1'
    } catch {
      return fallback
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
  const onlyDue = ref(readBool(ONLY_DUE_KEY, false))
  const backfilling = ref(false)
  const backfillWithinDays = ref(30)
  const currentPage = ref(1)
  const pageSize = ref(10)
  const selectedRowIds = ref<number[]>([])
  const showTrashPanel = ref(false)
  const trashRows = ref<WrongQuestionTrash[]>([])
  const selectedTrashIds = ref<number[]>([])
  const showQuestionTest = ref(false)

  const viewingBankQuestion = ref<QuestionBank | null>(null)
  const viewingWrongRow = ref<WrongQuestion | null>(null)
  const viewingDerivedPayload = ref<FavoriteDerivedMcqPayload | null>(null)
  const viewingDerivedLearningTypeId = ref<number | null>(null)

  /**
   * 进入错题详情时冻结的「上下题」顺序（当前筛选 + 排序下各条 id），
   * 避免打开详情后复习时间更新、列表重排导致题标与上一题/下一题错位。
   */
  const detailNavOrderIds = ref<number[]>([])

  const typeTextMap: Record<QuestionBank['type'], string> = {
    general: '一般题型',
    choice: '选择题型',
    mindmap: '思维导图',
  }

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
        const p = map.get(parentId)!
        node.level = p.level + 1
        p.children.push(node)
        return
      }
      roots.push(node)
    })
    return roots
  })

  const filteredWrongRows = computed(() => {
    const nowMs = Date.now()
    let rows = wrongRows.value.slice()
    if (selectedLearningTypeId.value) {
      rows = rows.filter((r) => r.learningTypeId === selectedLearningTypeId.value)
    }
    if (onlyDue.value) {
      rows = rows.filter((r) => new Date(r.nextReviewAt).getTime() <= nowMs)
    }
    return rows.sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime())
  })

  /** 当前筛选下可组卷的题库原题（导图衍生小题走 presetUnits，不重复放此列表） */
  const wrongBookTestQuestionBanks = computed(() => {
    const ids = new Set<number>()
    for (const r of filteredWrongRows.value) {
      if (parseWrongDerivedPayload(r.derivedPayloadJson)) continue
      if (r.questionBankId != null) ids.add(r.questionBankId)
    }
    if (!ids.size) return []
    return questionBanks.value.filter((q) => q.id != null && ids.has(q.id))
  })

  /** 当前筛选下带完整快照的导图衍生错题，与题库测验页相同结构 */
  const wrongBookTestPresetUnits = computed<TestUnit[]>(() => {
    const out: TestUnit[] = []
    const seen = new Set<string>()
    for (const r of filteredWrongRows.value) {
      const derived = parseWrongDerivedPayload(r.derivedPayloadJson)
      if (!derived) continue
      const parent = questionBanks.value.find((q) => q.id === derived.parentQuestionBankId)
      if (!parent) continue
      const key = `${derived.parentQuestionBankId}\t${derived.stem}\t${derived.subIndex}\t${derived.subTotal}`
      if (seen.has(key)) continue
      seen.add(key)
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
    }
    return out
  })

  const paginatedWrongRows = computed(() => {
    const all = filteredWrongRows.value
    const start = (currentPage.value - 1) * pageSize.value
    return all.slice(start, start + pageSize.value)
  })

  const pageSelectedCount = computed(() =>
    paginatedWrongRows.value.filter((r) => r.id != null && selectedRowIds.value.includes(r.id)).length,
  )

  const pageAllSelected = computed(() => {
    if (!paginatedWrongRows.value.length) return false
    return pageSelectedCount.value === paginatedWrongRows.value.length
  })

  const pageIndeterminate = computed(
    () => pageSelectedCount.value > 0 && pageSelectedCount.value < paginatedWrongRows.value.length,
  )

  // 切换知识点：回到第一页并清空勾选
  watch(selectedLearningTypeId, () => {
    currentPage.value = 1
    selectedRowIds.value = []
  })

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
    } catch {
      message.value = '错题本加载失败，请刷新后重试。'
    } finally {
      loading.value = false
    }
  }

  const rowTypeLabel = (row: WrongQuestion) => {
    if (row.questionType === 'mindmap-mcq') return '导图衍生小题'
    if (row.questionType === 'choice') return '选择题型'
    return '一般题型'
  }

  const rowDisplayTitle = (row: WrongQuestion) => {
    const stem = (row.stem ?? '').trim()
    if (row.questionType === 'mindmap-mcq' && stem) return stem
    const fromBank =
      row.questionBankId != null ? questionBanks.value.find((q) => q.id === row.questionBankId)?.title : ''
    return (fromBank || row.title || '未知题目').trim()
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

  const captureWrongBookDetailNavSnapshot = () => {
    detailNavOrderIds.value = filteredWrongRows.value
      .map((r) => r.id)
      .filter((id): id is number => id != null)
  }

  const autoReviewOnOpen = async (row: WrongQuestion) => {
    if (row.id == null) return
    try {
      await markWrongQuestionReviewed(row)
      await loadData()
      if (viewingWrongRow.value?.id === row.id) {
        const latest = wrongRows.value.find((x) => x.id === row.id)
        if (latest) viewingWrongRow.value = latest
      }
    } catch {
      // 静默处理，避免影响详情打开
    }
  }

  const openRow = async (row: WrongQuestion, opts?: { keepNavSnapshot?: boolean }) => {
    message.value = ''
    if (!opts?.keepNavSnapshot) {
      captureWrongBookDetailNavSnapshot()
    }
    viewingWrongRow.value = row
    void autoReviewOnOpen(row)
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
    if (
      wrongBookTestQuestionBanks.value.length === 0 &&
      wrongBookTestPresetUnits.value.length === 0
    ) {
      message.value =
        '当前筛选下没有可测验的题目（可能原题已删除，或仅有无法还原的导图错题记录）。'
      return
    }
    closeDetail()
    showTrashPanel.value = false
    showQuestionTest.value = true
    message.value = ''
  }

  const closeWrongBookTest = () => {
    showQuestionTest.value = false
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
    const pageIds = paginatedWrongRows.value.map((r) => r.id).filter((id): id is number => id != null)
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

  onMounted(() => {
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
    wrongBookTestQuestionBanks,
    wrongBookTestPresetUnits,
    viewingBankQuestion,
    viewingWrongRow,
    viewingDerivedPayload,
    viewingDerivedLearningTypeId,
    typeTextMap,
    getLearningTypeName,
    selectedLearningTypeName,
    treeNodes,
    filteredWrongRows,
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

