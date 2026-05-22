import { db } from '@/db'
import type {
  FavoriteDerivedMcqPayload,
  FavoriteQuestion,
  QuestionBank,
} from '@/db/models'
import { favoriteQuestionService } from '@/services/data-services'

export type QuestionFavoriteTarget =
  | { mode: 'bank'; question: QuestionBank }
  | { mode: 'derived-mcq'; payload: FavoriteDerivedMcqPayload }

export function mindmapTestUnitToPayload(unit: {
  parent: QuestionBank
  stem: string
  options: string[]
  correctIndices: number[]
  mode: 'single' | 'multiple'
  subIndex: number
  subTotal: number
}): FavoriteDerivedMcqPayload {
  return {
    kind: 'mindmap-mcq',
    parentQuestionBankId: unit.parent.id!,
    parentTitle: unit.parent.title,
    stem: unit.stem,
    options: [...unit.options],
    correctIndices: [...unit.correctIndices],
    mode: unit.mode,
    subIndex: unit.subIndex,
    subTotal: unit.subTotal,
  }
}

export function parseFavoriteDerivedPayload(
  json?: string,
): FavoriteDerivedMcqPayload | null {
  if (!json?.trim()) return null
  try {
    const o = JSON.parse(json) as FavoriteDerivedMcqPayload
    if (o?.kind !== 'mindmap-mcq') return null
    return o
  } catch {
    return null
  }
}

function derivedPayloadEquals(
  a: FavoriteDerivedMcqPayload,
  b: FavoriteDerivedMcqPayload,
): boolean {
  if (a.parentQuestionBankId !== b.parentQuestionBankId) return false
  if (a.stem !== b.stem) return false
  if (a.mode !== b.mode) return false
  if (a.subIndex !== b.subIndex) return false
  if (a.subTotal !== b.subTotal) return false
  if (a.options.length !== b.options.length) return false
  for (let i = 0; i < a.options.length; i++) {
    if (a.options[i] !== b.options[i]) return false
  }
  const sa = [...a.correctIndices].sort((x, y) => x - y).join(',')
  const sb = [...b.correctIndices].sort((x, y) => x - y).join(',')
  return sa === sb
}

export function targetsMatchRecord(
  target: QuestionFavoriteTarget,
  f: FavoriteQuestion,
): boolean {
  if (target.mode === 'bank') {
    const qid = target.question.id
    if (qid == null) return false
    return f.questionBankId === qid && !f.derivedPayloadJson?.trim()
  }
  const parsed = parseFavoriteDerivedPayload(f.derivedPayloadJson)
  if (!parsed) return false
  return derivedPayloadEquals(parsed, target.payload)
}

export async function findFavoriteMatch(
  learningTypeId: number,
  target: QuestionFavoriteTarget,
): Promise<FavoriteQuestion | undefined> {
  const rows = await db.favoriteQuestions
    .where('learningTypeId')
    .equals(learningTypeId)
    .toArray()
  return rows.find((row) => targetsMatchRecord(target, row))
}

export async function listFavoritesByLearningType(
  learningTypeId: number,
): Promise<FavoriteQuestion[]> {
  return db.favoriteQuestions
    .where('learningTypeId')
    .equals(learningTypeId)
    .toArray()
}

export async function createFavorite(
  learningTypeId: number,
  target: QuestionFavoriteTarget,
): Promise<void> {
  const now = new Date().toISOString()
  if (target.mode === 'bank') {
    const q = target.question
    if (q.id == null) throw new Error('题目尚未保存，无法收藏。')
    const lt = q.learningTypeId ?? learningTypeId
    await favoriteQuestionService.create({
      learningTypeId: lt,
      questionBankId: q.id,
      derivedPayloadJson: undefined,
      note: undefined,
      createdAt: now,
    })
    return
  }
  await favoriteQuestionService.create({
    learningTypeId,
    questionBankId: undefined,
    derivedPayloadJson: JSON.stringify(target.payload),
    note: undefined,
    createdAt: now,
  })
}

export async function toggleFavorite(
  learningTypeId: number,
  target: QuestionFavoriteTarget,
): Promise<'added' | 'removed'> {
  const existing = await findFavoriteMatch(learningTypeId, target)
  if (existing?.id != null) {
    await favoriteQuestionService.remove(existing.id)
    return 'removed'
  }
  await createFavorite(learningTypeId, target)
  return 'added'
}
