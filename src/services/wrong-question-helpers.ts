import type { FavoriteDerivedMcqPayload, WrongQuestion, WrongQuestionTrash } from '@/db/models'
import {
  findLearningTypeNodeById,
  type LearningTypeTreeNode,
} from '@/utils/learningTypeTree'
import type { TestUnit } from '@/views/learning/question-bank/components/questionBankTestTypes'
import {
  answerLogService,
  questionBankService,
  wrongQuestionBackfillLogService,
  wrongQuestionTrashService,
  wrongQuestionService,
} from './data-services'
import { parseQuestionBankTestPayload } from '@/utils/questionBankTestLog'

const EBBINGHAUS_DAY_INTERVALS = [1, 2, 4, 7, 15] as const

/** 同一错题在连续这么多场测验中该题均满分后，自动移出错题本（与回收站手动删除一致） */
export const WRONG_BOOK_FULL_SCORE_STREAK_TO_GRADUATE = 3

export type WrongQuestionTarget =
  | {
      kind: 'question-bank'
      questionBankId: number
    }
  | {
      kind: 'derived-mcq'
      payload: FavoriteDerivedMcqPayload
    }
  | {
      /** 历史日志回填的导图小题（日志中无完整 options/correctIndices 快照） */
      kind: 'mindmap-log'
      questionBankId: number
      stem?: string
    }

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function clampStage(stage: number): number {
  if (!Number.isFinite(stage) || stage < 0) return 0
  return Math.min(Math.round(stage), EBBINGHAUS_DAY_INTERVALS.length - 1)
}

export function computeNextReviewAt(baseIso: string, stage: number): string {
  const idx = clampStage(stage)
  return addDaysIso(baseIso, EBBINGHAUS_DAY_INTERVALS[idx])
}

/** 是否已到计划复习时间（nextReviewAt ≤ 当前时刻） */
export function isWrongQuestionReviewDue(row: WrongQuestion, nowMs: number = Date.now()): boolean {
  const t = new Date(row.nextReviewAt ?? '').getTime()
  if (!Number.isFinite(t)) return true
  return t <= nowMs
}

export function countDueWrongQuestions(
  rows: WrongQuestion[],
  nowMs: number = Date.now(),
): number {
  let n = 0
  for (const row of rows) {
    if (isWrongQuestionReviewDue(row, nowMs)) n++
  }
  return n
}

function dueCountByLeafLearningType(
  rows: WrongQuestion[],
  nowMs: number = Date.now(),
): Map<number, number> {
  const map = new Map<number, number>()
  for (const row of rows) {
    if (!isWrongQuestionReviewDue(row, nowMs)) continue
    const ltId = row.learningTypeId
    if (ltId == null) continue
    map.set(ltId, (map.get(ltId) ?? 0) + 1)
  }
  return map
}

/** 各树节点（含父节点）下子树内的到期错题数，用于左侧树角标 */
export function buildWrongDueCountByTreeNode(
  treeNodes: LearningTypeTreeNode[],
  rows: WrongQuestion[],
  nowMs: number = Date.now(),
): Map<number, number> {
  const dueByLeaf = dueCountByLeafLearningType(rows, nowMs)
  const result = new Map<number, number>()

  const walk = (node: LearningTypeTreeNode): number => {
    if (node.id == null) return 0
    let sum = dueByLeaf.get(node.id) ?? 0
    for (const child of node.children) {
      sum += walk(child)
    }
    if (sum > 0) result.set(node.id, sum)
    return sum
  }

  for (const root of treeNodes) walk(root)
  return result
}

export type DueOutsideLearningTypeBranch = {
  learningTypeId: number
  name: string
  count: number
}

/** 当前分类子树范围外，按实际学习类型汇总到期错题（用于提示与跳转） */
export function summarizeDueOutsideLearningTypeScope(
  treeNodes: LearningTypeTreeNode[],
  rows: WrongQuestion[],
  scopeSubtreeIds: Set<number>,
  nowMs: number = Date.now(),
): DueOutsideLearningTypeBranch[] {
  const byLtId = new Map<number, number>()
  for (const row of rows) {
    if (!isWrongQuestionReviewDue(row, nowMs)) continue
    const ltId = row.learningTypeId
    if (ltId == null || scopeSubtreeIds.has(ltId)) continue
    byLtId.set(ltId, (byLtId.get(ltId) ?? 0) + 1)
  }
  return [...byLtId.entries()]
    .map(([learningTypeId, count]) => ({
      learningTypeId,
      name: findLearningTypeNodeById(treeNodes, learningTypeId)?.name?.trim() || '未分类',
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
}

export function formatDueBranchHint(
  branches: { name: string; count: number }[],
  maxItems = 3,
): string {
  if (!branches.length) return '请查看左侧分类树'
  const shown = branches.slice(0, maxItems)
  const text = shown.map((b) => `${b.name} ${b.count} 道`).join('、')
  const rest = branches.length - shown.length
  return rest > 0 ? `${text} 等` : text
}

export function parseWrongDerivedPayload(json?: string): FavoriteDerivedMcqPayload | null {
  const t = (json ?? '').trim()
  if (!t) return null
  try {
    const p = JSON.parse(t) as FavoriteDerivedMcqPayload
    if (p.kind !== 'mindmap-mcq') return null
    if (!Array.isArray(p.options) || !Array.isArray(p.correctIndices)) return null
    return p
  } catch {
    return null
  }
}

/** 测验单元对应的学习类型（叶子 id）；父节点测验时不能用 props 上的父 id */
export function resolveLearningTypeIdFromTestUnit(unit: TestUnit): number | null {
  if (
    unit.kind === 'mindmap-mcq' ||
    unit.kind === 'handout-general' ||
    unit.kind === 'handout-judgment'
  ) {
    const id = unit.parent.learningTypeId
    return id != null && id > 0 ? id : null
  }
  const id = unit.question.learningTypeId
  return id != null && id > 0 ? id : null
}

/** 错题本列表行 → 稳定定位键（与变式题干/选项无关） */
export function wrongTargetFromWrongRow(row: WrongQuestion): WrongQuestionTarget | null {
  const derived = parseWrongDerivedPayload(row.derivedPayloadJson)
  if (derived) {
    return { kind: 'derived-mcq', payload: derived }
  }
  const qid = row.questionBankId
  if (qid == null || qid <= 0) return null
  if (row.questionType === 'mindmap-mcq' || row.questionType === 'handout-judgment') {
    return { kind: 'mindmap-log', questionBankId: qid, stem: row.stem }
  }
  return { kind: 'question-bank', questionBankId: qid }
}

/** 错题本测验单元：优先使用构建时绑定的 wrongBookTarget */
export function resolveWrongBookTarget(unit: TestUnit): WrongQuestionTarget | null {
  if (unit.wrongBookTarget) return unit.wrongBookTarget
  return wrongTargetFromTestUnit(unit)
}

export function wrongTargetFromTestUnit(unit: TestUnit): WrongQuestionTarget | null {
  if (unit.kind === 'mindmap-mcq' || unit.kind === 'handout-judgment') {
    const pid = unit.parent.id
    if (pid == null || pid <= 0) return null
    return {
      kind: 'derived-mcq',
      payload: {
        kind: 'mindmap-mcq',
        parentQuestionBankId: pid,
        parentTitle: unit.parent.title,
        stem: unit.stem,
        options: [...unit.options],
        correctIndices: [...unit.correctIndices],
        mode: unit.mode,
        subIndex: unit.subIndex,
        subTotal: unit.subTotal,
      },
    }
  }
  if (unit.kind === 'handout-general') {
    const pid = unit.parent.id
    if (pid == null || pid <= 0) return null
    const pt = unit.parent.type
    // 题库作答题/选择题的错题本变式：按主题目 id 关联（题干每次变式不同）
    if (pt === 'general' || pt === 'choice' || pt === 'handout') {
      return { kind: 'question-bank', questionBankId: pid }
    }
    return { kind: 'mindmap-log', questionBankId: pid, stem: unit.stem }
  }
  if (unit.question.id == null) return null
  return { kind: 'question-bank', questionBankId: unit.question.id }
}

function rowHasDerivedMcqSnapshot(row: WrongQuestion): boolean {
  return parseWrongDerivedPayload(row.derivedPayloadJson) != null
}

function targetsMatchRecord(target: WrongQuestionTarget, row: WrongQuestion): boolean {
  if (target.kind === 'question-bank') {
    return (
      row.questionBankId != null &&
      row.questionBankId === target.questionBankId &&
      !rowHasDerivedMcqSnapshot(row) &&
      row.questionType !== 'mindmap-mcq'
    )
  }
  if (target.kind === 'mindmap-log') {
    return (
      row.questionType === 'mindmap-mcq' &&
      row.questionBankId != null &&
      row.questionBankId === target.questionBankId &&
      (row.stem ?? '') === (target.stem ?? '')
    )
  }
  const payload = parseWrongDerivedPayload(row.derivedPayloadJson)
  if (payload) {
    return (
      payload.parentQuestionBankId === target.payload.parentQuestionBankId &&
      payload.stem === target.payload.stem &&
      payload.subIndex === target.payload.subIndex &&
      payload.subTotal === target.payload.subTotal
    )
  }
  // 历史回填的导图错题无 options 快照，仅 parentId + stem
  return (
    row.questionType === 'mindmap-mcq' &&
    row.questionBankId != null &&
    row.questionBankId === target.payload.parentQuestionBankId &&
    (row.stem ?? '') === (target.payload.stem ?? '') &&
    !(row.derivedPayloadJson ?? '').trim()
  )
}

export async function backfillWrongQuestionsFromAnswerLogs(options?: {
  /** 仅扫描最近 N 天；<=0 表示不限制 */
  withinDays?: number
  /** 预览模式：只统计不写库 */
  dryRun?: boolean
}): Promise<{
  scanned: number
  addedOrUpdated: number
  skippedDuplicated: number
}> {
  const logs = await answerLogService.listAll()
  const banks = await questionBankService.listAll()
  const processedRows = await wrongQuestionBackfillLogService.listAll()
  const activeWrongRows = await wrongQuestionService.listAll()
  const trashRows = await wrongQuestionTrashService.listAll()
  const processedLogIds = new Set(
    processedRows.map((x) => x.answerLogId).filter((id): id is number => Number.isInteger(id)),
  )
  const withinDays = Math.max(0, Math.floor(options?.withinDays ?? 0))
  const dryRun = !!options?.dryRun
  const cutoffMs =
    withinDays > 0 ? Date.now() - withinDays * 24 * 60 * 60 * 1000 : Number.NEGATIVE_INFINITY
  const bankLtMap = new Map<number, number>()
  const bankTitleMap = new Map<number, string>()
  for (const b of banks) {
    if (b.id != null) {
      if (b.learningTypeId != null) bankLtMap.set(b.id, b.learningTypeId)
      bankTitleMap.set(b.id, b.title ?? '')
    }
  }

  let scanned = 0
  let addedOrUpdated = 0
  let skippedDuplicated = 0

  const parseTrashPayload = (row: WrongQuestionTrash): WrongQuestion | null => {
    const txt = (row.payloadJson ?? '').trim()
    if (!txt) return null
    try {
      return JSON.parse(txt) as WrongQuestion
    } catch {
      return null
    }
  }

  const mapQuestionType = (pType: string): WrongQuestion['questionType'] =>
    pType === 'choice' ? 'choice' : pType === 'mindmap-mcq' ? 'mindmap-mcq' : 'general'

  const existsInActiveOrTrash = (
    learningTypeId: number,
    questionBankId: number,
    questionType: WrongQuestion['questionType'],
    mindmapStem?: string,
  ) => {
    const activeHit = activeWrongRows.some(
      (r) =>
        r.learningTypeId === learningTypeId &&
        r.questionType === questionType &&
        (r.questionBankId === questionBankId ||
          (questionType === 'mindmap-mcq' && (r.stem ?? '') === (mindmapStem ?? ''))) &&
        (questionType !== 'mindmap-mcq' || (r.stem ?? '') === (mindmapStem ?? '')),
    )
    if (activeHit) return true
    return trashRows.some((t) => {
      const p = parseTrashPayload(t)
      if (!p) return false
      return (
        p.learningTypeId === learningTypeId &&
        p.questionType === questionType &&
        (p.questionBankId === questionBankId ||
          (questionType === 'mindmap-mcq' && (p.stem ?? '') === (mindmapStem ?? ''))) &&
        (questionType !== 'mindmap-mcq' || (p.stem ?? '') === (mindmapStem ?? ''))
      )
    })
  }

  for (const log of logs) {
    const createdMs = new Date(log.createdAt).getTime()
    if (Number.isFinite(cutoffMs) && createdMs < cutoffMs) continue
    const p = parseQuestionBankTestPayload(log.answer)
    if (!p) continue
    if (p.questionType === 'session-summary' || p.questionType === 'session-report') continue
    if (!(p.maxScore > 0 && p.score < p.maxScore)) continue
    scanned++
    const qid = log.questionBankId
    if (qid == null) continue
    const ltId = bankLtMap.get(qid)
    if (ltId == null || ltId <= 0) continue
    const rowType = mapQuestionType(p.questionType)
    const hasProcessed = log.id != null && processedLogIds.has(log.id)
    if (hasProcessed && existsInActiveOrTrash(ltId, qid, rowType, p.mindmapStem)) {
      skippedDuplicated++
      continue
    }

    if (p.questionType === 'mindmap-mcq') {
      const concreteTitle = (p.mindmapStem ?? '').trim() || p.questionTitle || bankTitleMap.get(qid) || '导图小题'
      if (!dryRun) {
        await upsertWrongQuestionFromAnswer({
          learningTypeId: ltId,
          target: {
            kind: 'mindmap-log',
            questionBankId: qid,
            stem: p.mindmapStem,
          },
          questionType: 'mindmap-mcq',
          title: concreteTitle,
          stem: p.mindmapStem,
          quizSessionId: p.quizSessionId,
          nowIso: log.createdAt,
        })
        if (log.id != null && !hasProcessed) {
          await wrongQuestionBackfillLogService.create({
            answerLogId: log.id,
            processedAt: new Date().toISOString(),
          })
          processedLogIds.add(log.id)
        }
      }
      addedOrUpdated++
      continue
    }

    if (!dryRun) {
      const concreteTitle = bankTitleMap.get(qid) || p.questionTitle
      await upsertWrongQuestionFromAnswer({
        learningTypeId: ltId,
        target: { kind: 'question-bank', questionBankId: qid },
        questionType: p.questionType === 'choice' ? 'choice' : 'general',
        title: concreteTitle,
        quizSessionId: p.quizSessionId,
        nowIso: log.createdAt,
      })
      if (log.id != null && !hasProcessed) {
        await wrongQuestionBackfillLogService.create({
          answerLogId: log.id,
          processedAt: new Date().toISOString(),
        })
        processedLogIds.add(log.id)
      }
    }
    addedOrUpdated++
  }
  return { scanned, addedOrUpdated, skippedDuplicated }
}

export async function listWrongByLearningType(learningTypeId: number): Promise<WrongQuestion[]> {
  if (learningTypeId <= 0) return []
  const rows = await wrongQuestionService.listAll()
  return rows.filter((r) => r.learningTypeId === learningTypeId)
}

/** 按题目/导图快照定位错题本记录（不限 learningTypeId，支持父节点汇总测验） */
export async function findWrongQuestionsByTarget(
  target: WrongQuestionTarget,
): Promise<WrongQuestion[]> {
  const rows = await wrongQuestionService.listAll()
  return rows.filter((r) => targetsMatchRecord(target, r))
}

export async function findWrongQuestionByTarget(
  target: WrongQuestionTarget,
): Promise<WrongQuestion | undefined> {
  return (await findWrongQuestionsByTarget(target))[0]
}

async function resolveWrongBookRowForUpdate(input: {
  wrongBookRowId?: number
  target: WrongQuestionTarget
  learningTypeId?: number
}): Promise<WrongQuestion[]> {
  if (input.wrongBookRowId != null) {
    const row = await wrongQuestionService.getById(input.wrongBookRowId)
    return row ? [row] : []
  }
  const byTarget = await findWrongQuestionsByTarget(input.target)
  if (byTarget.length > 0) return byTarget
  if (input.learningTypeId != null && input.learningTypeId > 0) {
    const rows = await listWrongByLearningType(input.learningTypeId)
    return rows.filter((r) => targetsMatchRecord(input.target, r))
  }
  return []
}

export async function upsertWrongQuestionFromAnswer(input: {
  learningTypeId: number
  target: WrongQuestionTarget
  questionType: WrongQuestion['questionType']
  title: string
  stem?: string
  quizSessionId?: string
  nowIso?: string
}): Promise<void> {
  const now = input.nowIso ?? new Date().toISOString()
  const rows = await listWrongByLearningType(input.learningTypeId)
  const hit = rows.find((r) => targetsMatchRecord(input.target, r))
  if (!hit?.id) {
    const derivedPayloadJson =
      input.target.kind === 'derived-mcq' ? JSON.stringify(input.target.payload) : undefined
    const resolvedQuestionBankId =
      input.target.kind === 'question-bank' ? input.target.questionBankId
      : input.target.kind === 'mindmap-log' ? input.target.questionBankId
      : input.target.payload.parentQuestionBankId
    await wrongQuestionService.create({
      learningTypeId: input.learningTypeId,
      questionBankId: resolvedQuestionBankId,
      derivedPayloadJson,
      questionType: input.questionType,
      title: input.title,
      stem: input.stem,
      wrongCount: 1,
      reviewStage: 0,
      lastWrongAt: now,
      nextReviewAt: computeNextReviewAt(now, 0),
      lastQuizSessionId: input.quizSessionId,
      fullScoreQuizStreak: 0,
      fullScoreStreakLastSessionId: undefined,
      createdAt: now,
      updatedAt: now,
    })
    return
  }
  await wrongQuestionService.update(hit.id, {
    wrongCount: (hit.wrongCount ?? 0) + 1,
    reviewStage: 0,
    lastWrongAt: now,
    nextReviewAt: computeNextReviewAt(now, 0),
    lastQuizSessionId: input.quizSessionId,
    fullScoreQuizStreak: 0,
    fullScoreStreakLastSessionId: undefined,
    updatedAt: now,
    title: input.title,
    stem: input.stem,
  })
}

export type WrongBookQuizPassResult = 'graduated' | 'counted' | 'skipped-same-session' | 'not-in-wrong-book'

/**
 * 题目测试中单题满分时调用：若该题在错题本中，则累计「不同测验场次」的连续满分次数；
 * 满 WRONG_BOOK_FULL_SCORE_STREAK_TO_GRADUATE 场则移入回收站并删除活跃记录（与手动删除一致）。
 */
export async function recordWrongBookFullScoreQuizPass(input: {
  /** 兼容旧调用；查找记录时优先按 target 全局匹配 */
  learningTypeId?: number
  target: WrongQuestionTarget
  /** 错题本测验构建时绑定的列表行 id */
  wrongBookRowId?: number
  quizSessionId: string
}): Promise<WrongBookQuizPassResult> {
  const hits = await resolveWrongBookRowForUpdate(input)
  const hit = hits[0]
  if (!hit?.id) return 'not-in-wrong-book'
  if (hit.fullScoreStreakLastSessionId === input.quizSessionId) {
    return 'skipped-same-session'
  }
  const now = new Date().toISOString()
  const next = (hit.fullScoreQuizStreak ?? 0) + 1
  if (next >= WRONG_BOOK_FULL_SCORE_STREAK_TO_GRADUATE) {
    const snapshot: WrongQuestion = {
      ...hit,
      fullScoreQuizStreak: next,
      fullScoreStreakLastSessionId: input.quizSessionId,
      updatedAt: now,
    }
    await wrongQuestionTrashService.create({
      originalWrongQuestionId: hit.id,
      payloadJson: JSON.stringify(snapshot),
      deletedAt: now,
    })
    await wrongQuestionService.remove(hit.id)
    return 'graduated'
  }
  await wrongQuestionService.update(hit.id, {
    fullScoreQuizStreak: next,
    fullScoreStreakLastSessionId: input.quizSessionId,
    updatedAt: now,
  })
  return 'counted'
}

/**
 * 错题本测验中单题未满分时：清零连续满分计数（不增加错误次数、不改复习计划）。
 */
export async function resetWrongBookFullScoreStreakOnWrong(input: {
  learningTypeId?: number
  target: WrongQuestionTarget
  wrongBookRowId?: number
}): Promise<void> {
  const hits = await resolveWrongBookRowForUpdate(input)
  const hit = hits[0]
  if (!hit?.id) return
  if ((hit.fullScoreQuizStreak ?? 0) === 0 && !hit.fullScoreStreakLastSessionId) return
  const now = new Date().toISOString()
  await wrongQuestionService.update(hit.id, {
    fullScoreQuizStreak: 0,
    fullScoreStreakLastSessionId: undefined,
    updatedAt: now,
  })
}

/** 推进艾宾浩斯复习轮次；未到 nextReviewAt 时不更新，返回 false */
export async function markWrongQuestionReviewed(row: WrongQuestion, reviewAtIso?: string): Promise<boolean> {
  if (!row.id) return false
  const now = reviewAtIso ?? new Date().toISOString()
  if (!isWrongQuestionReviewDue(row, new Date(now).getTime())) return false
  const nextStage = Math.min(
    clampStage((row.reviewStage ?? 0) + 1),
    EBBINGHAUS_DAY_INTERVALS.length - 1,
  )
  await wrongQuestionService.update(row.id, {
    reviewStage: nextStage,
    nextReviewAt: computeNextReviewAt(now, nextStage),
    updatedAt: now,
  })
  return true
}

/** 按测验单元定位错题本记录；仅当已到复习时间且错题本测验单题满分时推进轮次 */
export async function markWrongQuestionReviewedByTarget(input: {
  /** 兼容旧调用；查找记录时优先按 target 全局匹配 */
  learningTypeId?: number
  target: WrongQuestionTarget
  wrongBookRowId?: number
}): Promise<boolean> {
  const hits = await resolveWrongBookRowForUpdate(input)
  if (!hits.length) return false
  let updated = false
  for (const hit of hits) {
    if (await markWrongQuestionReviewed(hit)) updated = true
  }
  return updated
}

