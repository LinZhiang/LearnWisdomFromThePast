import type { FavoriteDerivedMcqPayload, QuestionBank, WrongQuestion } from '@/db/models'
import type { MindmapDerivedMcq } from '@/services/deepseek'
import {
  requestWrongBookChoiceVariant,
  requestWrongBookGeneralVariant,
  requestWrongBookMcqVariant,
} from '@/services/deepseek'
import { questionBankService } from '@/services/data-services'
import { fetchCachedChoiceDistractors } from '@/services/questionBankTestAiPrep'
import { parseWrongDerivedPayload, wrongTargetFromWrongRow } from '@/services/wrong-question-helpers'
import { parseChoiceQuestionContent, validateChoiceQuestionJson } from '@/utils/choiceQuestion'
import { HANDOUT_GENERAL_SCORE_DEFAULT } from '@/utils/handoutQuestion'
import { prepareHandoutBodyForAi } from '@/utils/handoutAiMaterial'
import {
  areMcqOptionsAllDistinct,
  areMcqTextsEquivalent,
  normalizeMcqCompareText,
} from '@/utils/mcqOptionFormat'
import { shuffleArray } from '@/utils/testMcqScore'
import type { TestUnit } from '@/views/learning/question-bank/components/questionBankTestTypes'

const VARIANT_ATTEMPTS = 3

function bankScoreForGeneral(q: QuestionBank): number {
  const s = q.score
  return Number.isInteger(s) && s >= 0 ? s : HANDOUT_GENERAL_SCORE_DEFAULT
}

function correctTextsFromDerived(d: FavoriteDerivedMcqPayload): string[] {
  return d.correctIndices
    .map((i) => d.options[i])
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function mindmapMcqToTestUnit(
  parent: QuestionBank,
  mcq: MindmapDerivedMcq,
  subIndex = 1,
  subTotal = 1,
): TestUnit | null {
  if (!areMcqOptionsAllDistinct(mcq.correct, mcq.distractors)) return null
  const options = shuffleArray([...mcq.correct, ...mcq.distractors])
  if (options.length !== 5) return null
  const norm = (s: string) => s.replace(/\s+/g, '')
  const setC = new Set(mcq.correct.map(norm))
  const correctIndices: number[] = []
  options.forEach((opt, idx) => {
    if (setC.has(norm(opt))) correctIndices.push(idx)
  })
  if (correctIndices.length !== mcq.correct.length) return null
  return {
    kind: 'mindmap-mcq',
    parent,
    stem: mcq.stem,
    options,
    correctIndices,
    mode: mcq.mode,
    subIndex,
    subTotal,
  }
}

export function choiceMcqToTestUnit(q: QuestionBank, mcq: MindmapDerivedMcq): TestUnit | null {
  if (!areMcqOptionsAllDistinct(mcq.correct, mcq.distractors)) return null
  const options = shuffleArray([...mcq.correct, ...mcq.distractors])
  if (options.length !== 5) return null
  const norm = (s: string) => s.replace(/\s+/g, '')
  const setC = new Set(mcq.correct.map(norm))
  const correctIndices: number[] = []
  options.forEach((opt, idx) => {
    if (setC.has(norm(opt))) correctIndices.push(idx)
  })
  if (correctIndices.length !== mcq.correct.length) return null
  return {
    kind: 'choice',
    question: q,
    stem: mcq.stem,
    options,
    correctIndices,
    mode: mcq.mode,
  }
}

function findBank(banks: QuestionBank[], id?: number): QuestionBank | undefined {
  if (id == null) return undefined
  return banks.find((q) => q.id === id)
}

function linkWrongBookTarget<T extends TestUnit>(unit: T, row: WrongQuestion): T {
  const target = wrongTargetFromWrongRow(row)
  const link: { wrongBookTarget?: typeof target; wrongBookRowId?: number } = {}
  if (target) link.wrongBookTarget = target
  if (row.id != null) link.wrongBookRowId = row.id
  return Object.keys(link).length ? { ...unit, ...link } : unit
}

async function ensureBankMap(
  rows: WrongQuestion[],
  seedBanks: QuestionBank[],
): Promise<Map<number, QuestionBank>> {
  const map = new Map<number, QuestionBank>()
  for (const b of seedBanks) {
    if (b.id != null) map.set(b.id, b)
  }
  const needed = new Set<number>()
  for (const row of rows) {
    const derived = parseWrongDerivedPayload(row.derivedPayloadJson)
    if (derived?.parentQuestionBankId != null) needed.add(derived.parentQuestionBankId)
    if (row.questionBankId != null) needed.add(row.questionBankId)
  }
  const missing = [...needed].filter((id) => !map.has(id))
  if (missing.length === 0) return map
  const all = await questionBankService.listAll()
  for (const b of all) {
    if (b.id != null && missing.includes(b.id)) map.set(b.id, b)
  }
  return map
}

function banksFromMap(map: Map<number, QuestionBank>): QuestionBank[] {
  return [...map.values()]
}

function diagnoseNullUnit(row: WrongQuestion, banks: QuestionBank[]): string {
  const derived = parseWrongDerivedPayload(row.derivedPayloadJson)
  if (derived) {
    if (!findBank(banks, derived.parentQuestionBankId)) {
      return '关联讲义/导图条目已删除'
    }
    return '变式题结构校验未通过（选项数量或格式不符）'
  }
  if (row.questionType === 'mindmap-mcq') {
    if (!findBank(banks, row.questionBankId)) return '关联导图/讲义已删除'
    return '导图错题快照不完整，且材料出题未能组装'
  }
  const bank = findBank(banks, row.questionBankId)
  if (!bank) return '关联题库条目已删除'
  if (row.questionType === 'choice' || bank.type === 'choice') {
    const v = validateChoiceQuestionJson(bank.content ?? '')
    if (!v.ok) return `选择题内容无效：${v.message ?? '格式错误'}`
    return '变式选择题校验未通过'
  }
  if (!bank.content?.trim() && !bank.title?.trim()) return '作答题正文为空'
  return '变式作答题校验未通过'
}

function preferStandardAnswerForIndex(index: number, total: number): boolean {
  if (total <= 0) return true
  return index < Math.ceil(total / 2)
}

async function buildUnitFromWrongRow(
  row: WrongQuestion,
  banks: QuestionBank[],
  preferStandardAnswer = true,
): Promise<TestUnit | null> {
  const derived = parseWrongDerivedPayload(row.derivedPayloadJson)
  if (derived) {
    const parent = findBank(banks, derived.parentQuestionBankId)
    if (!parent) return null
    const originalCorrect = correctTextsFromDerived(derived)
    const material =
      parent.type === 'handout' || parent.type === 'mindmap'
        ? prepareHandoutBodyForAi(parent.content ?? '')
        : ''
    const mcq = await requestWrongBookMcqVariant({
      anchorTitle: derived.parentTitle || parent.title,
      originalStem: derived.stem,
      originalCorrect,
      originalOptions: derived.options,
      mode: derived.mode,
      materialPlain: material || undefined,
      preferStandardAnswer,
    })
    const unit = mindmapMcqToTestUnit(parent, mcq, derived.subIndex, derived.subTotal)
    return unit ? linkWrongBookTarget(unit, row) : null
  }

  if (row.questionType === 'mindmap-mcq') {
    const parent = findBank(banks, row.questionBankId)
    if (!parent) return null
    const originalStem = (row.stem ?? row.title ?? parent.title).trim()
    const material = prepareHandoutBodyForAi(parent.content ?? '')
    const mcq = await requestWrongBookMcqVariant({
      anchorTitle: parent.title,
      originalStem,
      originalCorrect: [],
      mode: 'single',
      materialPlain: material || undefined,
      preferStandardAnswer,
    })
    const unit = mindmapMcqToTestUnit(parent, mcq, 1, 1)
    return unit ? linkWrongBookTarget(unit, row) : null
  }

  const bank = findBank(banks, row.questionBankId)
  if (!bank) return null

  if (row.questionType === 'choice' || bank.type === 'choice') {
    const v = validateChoiceQuestionJson(bank.content ?? '')
    if (!v.ok) return null
    const payload = parseChoiceQuestionContent(bank.content ?? '')
    const correctAnswers = payload.correctAnswers.map((s) => s.trim()).filter(Boolean)
    const mcq = await requestWrongBookChoiceVariant({
      title: bank.title,
      correctAnswers,
      analysisHtml: bank.analysis,
      preferStandardAnswer,
    })
    const unit = choiceMcqToTestUnit(bank, mcq)
    return unit ? linkWrongBookTarget(unit, row) : null
  }

  const variant = await requestWrongBookGeneralVariant({
    title: bank.title,
    contentHtml: bank.content ?? '',
    analysisHtml: bank.analysis,
    preferStandardAnswer,
  })
  return linkWrongBookTarget(
    {
      kind: 'handout-general',
      parent: bank,
      stem: variant.stem,
      referenceAnswer: variant.referenceAnswer,
      analysis: variant.analysis,
      knowledgePoint: variant.knowledgePoint,
      score: bankScoreForGeneral(bank),
      subIndex: 1,
      subTotal: 1,
    },
    row,
  )
}

/** 从错题快照还原导图/讲义衍生小题（原题，非变式） */
function originalUnitFromDerived(
  derived: FavoriteDerivedMcqPayload,
  parent: QuestionBank,
  row: WrongQuestion,
): TestUnit | null {
  if (!Array.isArray(derived.options) || derived.options.length !== 5) return null
  if (!Array.isArray(derived.correctIndices) || derived.correctIndices.length === 0) return null
  const correctIndices = derived.correctIndices.filter(
    (i) => Number.isInteger(i) && i >= 0 && i < derived.options.length,
  )
  if (correctIndices.length === 0) return null
  return linkWrongBookTarget(
    {
      kind: 'mindmap-mcq',
      parent,
      stem: derived.stem,
      options: [...derived.options],
      correctIndices,
      mode: derived.mode,
      subIndex: derived.subIndex,
      subTotal: derived.subTotal,
    },
    row,
  )
}

async function originalChoiceFromBank(bank: QuestionBank): Promise<TestUnit | null> {
  const v = validateChoiceQuestionJson(bank.content ?? '')
  if (!v.ok) return null
  const payload = parseChoiceQuestionContent(bank.content ?? '')
  const correct = payload.correctAnswers.map((s) => s.trim()).filter(Boolean)
  const need = 5 - correct.length
  if (need < 0) return null
  try {
    const distractors = await fetchCachedChoiceDistractors(bank, correct, need)
    const merged = [...correct, ...distractors.slice(0, need)]
    const options = shuffleArray(merged).slice(0, 5)
    while (options.length < 5) options.push('（选项占位）')
    const norm = (s: string) => s.replace(/\s+/g, '')
    const setC = new Set(correct.map(norm))
    const correctIndices: number[] = []
    options.forEach((opt, idx) => {
      if (setC.has(norm(opt))) correctIndices.push(idx)
    })
    if (correctIndices.length !== correct.length) return null
    return {
      kind: 'choice',
      question: bank,
      options,
      correctIndices,
      mode: payload.mode,
    }
  } catch {
    return null
  }
}

function originalGeneralFromBank(bank: QuestionBank, row: WrongQuestion): TestUnit | null {
  if (bank.type === 'general') {
    return linkWrongBookTarget({ kind: 'general', question: bank }, row)
  }
  if (bank.type === 'handout' || bank.type === 'mindmap') {
    const stem = (row.stem ?? row.title ?? bank.title).trim()
    if (!stem) return null
    return linkWrongBookTarget(
      {
        kind: 'handout-general',
        parent: bank,
        stem,
        referenceAnswer: '',
        analysis: '本题为错题复习，请依据原讲义/导图材料核对作答。',
        knowledgePoint: '错题复习',
        score: bankScoreForGeneral(bank),
        subIndex: 1,
        subTotal: 1,
      },
      row,
    )
  }
  return null
}

/** 变式生成失败时：尽量用错题记录或题库条目还原原题 */
async function tryOriginalUnit(
  row: WrongQuestion,
  bankMap: Map<number, QuestionBank>,
): Promise<{ unit: TestUnit | null; reason: string }> {
  const banks = banksFromMap(bankMap)
  const derived = parseWrongDerivedPayload(row.derivedPayloadJson)
  if (derived) {
    const parent = findBank(banks, derived.parentQuestionBankId)
    if (!parent) return { unit: null, reason: '关联讲义/导图已删除' }
    const unit = originalUnitFromDerived(derived, parent, row)
    if (unit) return { unit, reason: '' }
    return { unit: null, reason: '错题快照不完整，无法还原原题' }
  }

  if (row.questionType === 'mindmap-mcq' || row.questionType === 'handout-judgment') {
    const parent = findBank(banks, row.questionBankId)
    if (!parent) return { unit: null, reason: '关联导图/讲义已删除' }
    const unit = originalGeneralFromBank(parent, row)
    if (unit) return { unit, reason: '' }
    return { unit: null, reason: '缺少原题快照，无法还原选择题' }
  }

  const bank = findBank(banks, row.questionBankId)
  if (!bank) return { unit: null, reason: '关联题库条目已删除' }

  if (row.questionType === 'choice' || bank.type === 'choice') {
    const unit = await originalChoiceFromBank(bank)
    if (unit) return { unit: linkWrongBookTarget(unit, row), reason: '' }
    return { unit: null, reason: '原选择题无效或干扰项补全失败' }
  }

  const unit = originalGeneralFromBank(bank, row)
  if (unit) return { unit, reason: '' }
  return { unit: null, reason: '无法还原原作答题' }
}

async function buildUnitFromWrongRowResilient(
  row: WrongQuestion,
  bankMap: Map<number, QuestionBank>,
  preferStandardAnswer = true,
  onStatus?: (message: string) => void,
): Promise<{ unit: TestUnit | null; reason: string; recoveredVia?: string }> {
  const banks = banksFromMap(bankMap)
  const label = (row.stem ?? row.title ?? '错题').trim() || '错题'
  let lastReason = ''

  for (let attempt = 1; attempt <= VARIANT_ATTEMPTS; attempt++) {
    onStatus?.(
      attempt === 1
        ? `正在为「${label}」生成变式题…`
        : `「${label}」变式题第 ${attempt}/${VARIANT_ATTEMPTS} 次重试…`,
    )
    try {
      const unit = await buildUnitFromWrongRow(row, banks, preferStandardAnswer)
      if (unit) {
        return {
          unit,
          reason: '',
          recoveredVia: attempt > 1 ? `变式题第 ${attempt} 次重试成功` : undefined,
        }
      }
      lastReason = diagnoseNullUnit(row, banks)
    } catch (e) {
      lastReason = e instanceof Error ? e.message : '变式题生成失败'
    }
    if (attempt < VARIANT_ATTEMPTS) {
      await delay(400 * attempt)
    }
  }

  onStatus?.(`「${label}」变式失败，改用原题…`)
  const original = await tryOriginalUnit(row, bankMap)
  if (original.unit) {
    return {
      unit: original.unit,
      reason: '',
      recoveredVia: '变式生成失败，已使用原题',
    }
  }

  return {
    unit: null,
    reason: original.reason || lastReason || '未知原因',
  }
}

const WRONG_BOOK_DEDUP_REASON = '与本场其他题目考察内容重复，已跳过'

function wrongBookUnitStem(unit: TestUnit): string {
  if (unit.kind === 'mindmap-mcq' || unit.kind === 'handout-general') return unit.stem
  if (unit.kind === 'choice') return (unit.stem ?? unit.question.title ?? '').trim()
  if (unit.kind === 'general') return unit.question.title ?? ''
  return ''
}

function wrongBookUnitCorrectTexts(unit: TestUnit): string[] {
  if (unit.kind === 'choice' || unit.kind === 'mindmap-mcq') {
    return unit.correctIndices
      .slice()
      .sort((a, b) => a - b)
      .map((i) => unit.options[i] ?? '')
      .filter((s) => s.trim())
  }
  if (unit.kind === 'handout-general') {
    const ref = unit.referenceAnswer.trim()
    return ref ? [ref] : []
  }
  return []
}

function wrongBookUnitsShareExamContent(a: TestUnit, b: TestUnit): boolean {
  const stemA = normalizeMcqCompareText(wrongBookUnitStem(a))
  const stemB = normalizeMcqCompareText(wrongBookUnitStem(b))
  if (stemA.length >= 8 && stemA === stemB) return true

  const correctA = wrongBookUnitCorrectTexts(a)
  const correctB = wrongBookUnitCorrectTexts(b)
  if (correctA.length > 0 && correctB.length > 0) {
    if (correctA.length === 1 && correctB.length === 1) {
      return areMcqTextsEquivalent(correctA[0]!, correctB[0]!)
    }
    if (correctA.length === correctB.length) {
      const matched = correctA.every((ca) => correctB.some((cb) => areMcqTextsEquivalent(ca, cb)))
      if (matched) return true
    }
  }

  if (a.kind === 'handout-general' && b.kind === 'handout-general') {
    const kpA = normalizeMcqCompareText(a.knowledgePoint)
    const kpB = normalizeMcqCompareText(b.knowledgePoint)
    if (kpA && kpA === kpB && areMcqTextsEquivalent(a.referenceAnswer, b.referenceAnswer)) {
      return true
    }
  }

  return false
}

export type WrongBookTestBuildResult = {
  units: TestUnit[]
  skipped: { title: string; reason: string }[]
  recovered: { title: string; via: string }[]
  deduped: { title: string }[]
}

/** 为错题本当前筛选列表逐条生成测验题：变式失败时自动重试并回退为原题 */
export async function buildWrongBookTestUnits(
  rows: WrongQuestion[],
  banks: QuestionBank[],
  onStatus?: (message: string) => void,
): Promise<WrongBookTestBuildResult> {
  const bankMap = await ensureBankMap(rows, banks)
  const shuffled = shuffleArray(rows.slice())
  const units: TestUnit[] = []
  const skipped: { title: string; reason: string }[] = []
  const recovered: { title: string; via: string }[] = []
  const deduped: { title: string }[] = []
  const total = shuffled.length

  for (let i = 0; i < shuffled.length; i++) {
    const row = shuffled[i]!
    const label = (row.stem ?? row.title ?? '错题').trim() || '错题'
    onStatus?.(`正在处理第 ${i + 1}/${total} 道错题…`)

    const preferStandardAnswer = preferStandardAnswerForIndex(i, total)
    const { unit, reason, recoveredVia } = await buildUnitFromWrongRowResilient(
      row,
      bankMap,
      preferStandardAnswer,
      onStatus,
    )
    if (unit) {
      if (units.some((existing) => wrongBookUnitsShareExamContent(existing, unit))) {
        deduped.push({ title: label })
        skipped.push({ title: label, reason: WRONG_BOOK_DEDUP_REASON })
        continue
      }
      units.push(unit)
      if (recoveredVia) recovered.push({ title: label, via: recoveredVia })
    } else {
      skipped.push({ title: label, reason })
    }
  }

  return { units: shuffleArray(units), skipped, recovered, deduped }
}
