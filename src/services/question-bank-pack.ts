import { db } from '@/db'
import type {
  LearningType,
  QuestionBank,
  QuestionBankAiPrep,
} from '@/db/models'
import { parseCacheSnapshot } from '@/services/cache-backup'

export type QuestionBankPackData = {
  exportedAt: string
  source: 'pack' | 'full-cache'
  learningTypes: LearningType[]
  questionBanks: QuestionBank[]
  questionBankAiPrep: QuestionBankAiPrep[]
}

export type QuestionBankPackPreview = {
  exportedAt: string
  source: 'pack' | 'full-cache'
  counts: {
    learningTypes: number
    questionBanks: number
    questionBankAiPrep: number
  }
}

export type QuestionBankPackMergeResult = {
  learningTypesAdded: number
  learningTypesMerged: number
  questionBanksAdded: number
  questionBanksSkipped: number
  questionBankAiPrepAdded: number
  questionBankAiPrepSkipped: number
}

type QuestionBankPackFile = {
  packageType?: string
  exportedAt?: string
  data?: {
    learningTypes?: LearningType[]
    questionBanks?: QuestionBank[]
    questionBankAiPrep?: QuestionBankAiPrep[]
  }
}

function learningTypeLookupKey(parentId: number | undefined, name: string): string {
  return `${parentId ?? 'root'}|${name.trim()}`
}

function questionBankLookupKey(
  learningTypeId: number | undefined,
  type: QuestionBank['type'],
  title: string,
): string {
  return `${learningTypeId ?? 'none'}|${type}|${title.trim()}`
}

function sortLearningTypesByDepth(types: LearningType[]): LearningType[] {
  const byId = new Map<number, LearningType>()
  for (const item of types) {
    if (item.id != null) byId.set(item.id, item)
  }
  const depthCache = new Map<number, number>()

  const depthOf = (id: number, visiting = new Set<number>()): number => {
    const cached = depthCache.get(id)
    if (cached != null) return cached
    if (visiting.has(id)) return 0
    visiting.add(id)
    const row = byId.get(id)
    if (!row) return 0
    const parentId = row.parentId
    const d =
      parentId == null || !byId.has(parentId) ? 0 : depthOf(parentId, visiting) + 1
    depthCache.set(id, d)
    return d
  }

  return [...types].sort((a, b) => {
    const da = a.id != null ? depthOf(a.id) : 0
    const db = b.id != null ? depthOf(b.id) : 0
    return da - db || (a.id ?? 0) - (b.id ?? 0)
  })
}

export function parseQuestionBankPack(raw: string): QuestionBankPackData {
  const parsed = JSON.parse(raw) as QuestionBankPackFile
  if (parsed.packageType === 'question-bank-pack' && parsed.data) {
    return {
      exportedAt: parsed.exportedAt ?? '',
      source: 'pack',
      learningTypes: parsed.data.learningTypes ?? [],
      questionBanks: parsed.data.questionBanks ?? [],
      questionBankAiPrep: parsed.data.questionBankAiPrep ?? [],
    }
  }

  const cache = parseCacheSnapshot(raw)
  return {
    exportedAt: cache.exportedAt,
    source: 'full-cache',
    learningTypes: cache.data.learningTypes ?? [],
    questionBanks: cache.data.questionBanks ?? [],
    questionBankAiPrep: [],
  }
}

export function previewQuestionBankPack(raw: string): QuestionBankPackPreview {
  const pack = parseQuestionBankPack(raw)
  return {
    exportedAt: pack.exportedAt,
    source: pack.source,
    counts: {
      learningTypes: pack.learningTypes.length,
      questionBanks: pack.questionBanks.length,
      questionBankAiPrep: pack.questionBankAiPrep.length,
    },
  }
}

export async function exportQuestionBankPack(): Promise<string> {
  const learningTypes = await db.learningTypes.toArray()
  const questionBanks = await db.questionBanks.toArray()
  const bankIds = new Set(
    questionBanks
      .map((item) => item.id)
      .filter((id): id is number => id != null),
  )
  const questionBankAiPrep = (await db.questionBankAiPrep.toArray()).filter((item) =>
    bankIds.has(item.questionBankId),
  )

  const snapshot = {
    packageType: 'question-bank-pack',
    exportedAt: new Date().toISOString(),
    data: {
      learningTypes,
      questionBanks,
      questionBankAiPrep,
    },
  }
  return JSON.stringify(snapshot, null, 2)
}

export async function mergeQuestionBankPack(
  raw: string,
  options?: { dryRun?: boolean },
): Promise<QuestionBankPackMergeResult> {
  const pack = parseQuestionBankPack(raw)
  const dryRun = options?.dryRun === true

  const localTypes = await db.learningTypes.toArray()
  const localBanks = await db.questionBanks.toArray()
  const localPrep = await db.questionBankAiPrep.toArray()

  const localTypeByKey = new Map<string, LearningType>()
  for (const item of localTypes) {
    if (item.id == null) continue
    localTypeByKey.set(learningTypeLookupKey(item.parentId, item.name), item)
  }

  const localBankByKey = new Map<string, QuestionBank>()
  for (const item of localBanks) {
    if (item.id == null) continue
    localBankByKey.set(
      questionBankLookupKey(item.learningTypeId, item.type, item.title),
      item,
    )
  }

  const localPrepKeys = new Set(
    localPrep.map((item) => `${item.questionBankId}|${item.kind}`),
  )

  const typeIdMap = new Map<number, number>()
  let learningTypesAdded = 0
  let learningTypesMerged = 0

  const sortedTypes = sortLearningTypesByDepth(pack.learningTypes)
  for (const imported of sortedTypes) {
    if (imported.id == null) continue
    const mappedParentId =
      imported.parentId == null ? undefined : typeIdMap.get(imported.parentId)
    if (imported.parentId != null && mappedParentId == null) continue

    const key = learningTypeLookupKey(mappedParentId, imported.name)
    const existing = localTypeByKey.get(key)
    if (existing?.id != null) {
      typeIdMap.set(imported.id, existing.id)
      learningTypesMerged += 1
      continue
    }

    learningTypesAdded += 1
    if (dryRun) {
      const fakeId = -(typeIdMap.size + 1)
      typeIdMap.set(imported.id, fakeId)
      localTypeByKey.set(key, {
        ...imported,
        id: fakeId,
        parentId: mappedParentId,
      })
      continue
    }

    const newId = await db.learningTypes.add({
      parentId: mappedParentId,
      name: imported.name,
      description: imported.description,
      createdAt: imported.createdAt,
      updatedAt: imported.updatedAt,
    })
    typeIdMap.set(imported.id, newId)
    localTypeByKey.set(key, {
      ...imported,
      id: newId,
      parentId: mappedParentId,
    })
  }

  const bankIdMap = new Map<number, number>()
  let questionBanksAdded = 0
  let questionBanksSkipped = 0

  for (const imported of pack.questionBanks) {
    if (imported.id == null) continue
    const mappedLearningTypeId =
      imported.learningTypeId == null
        ? undefined
        : typeIdMap.get(imported.learningTypeId)
    if (imported.learningTypeId != null && mappedLearningTypeId == null) {
      questionBanksSkipped += 1
      continue
    }

    const key = questionBankLookupKey(mappedLearningTypeId, imported.type, imported.title)
    const existing = localBankByKey.get(key)
    if (existing?.id != null) {
      bankIdMap.set(imported.id, existing.id)
      questionBanksSkipped += 1
      continue
    }

    questionBanksAdded += 1
    if (dryRun) {
      const fakeId = -(bankIdMap.size + 1)
      bankIdMap.set(imported.id, fakeId)
      localBankByKey.set(key, {
        ...imported,
        id: fakeId,
        learningTypeId: mappedLearningTypeId,
      })
      continue
    }

    const { id: _omit, ...rest } = imported
    const newId = await db.questionBanks.add({
      ...rest,
      learningTypeId: mappedLearningTypeId,
    })
    bankIdMap.set(imported.id, newId)
    localBankByKey.set(key, {
      ...imported,
      id: newId,
      learningTypeId: mappedLearningTypeId,
    })
  }

  let questionBankAiPrepAdded = 0
  let questionBankAiPrepSkipped = 0

  for (const imported of pack.questionBankAiPrep) {
    const mappedBankId = bankIdMap.get(imported.questionBankId)
    if (mappedBankId == null || mappedBankId < 0) {
      questionBankAiPrepSkipped += 1
      continue
    }
    const prepKey = `${mappedBankId}|${imported.kind}`
    if (localPrepKeys.has(prepKey)) {
      questionBankAiPrepSkipped += 1
      continue
    }

    questionBankAiPrepAdded += 1
    if (dryRun) {
      localPrepKeys.add(prepKey)
      continue
    }

    const { id: _omit, ...rest } = imported
    await db.questionBankAiPrep.add({
      ...rest,
      questionBankId: mappedBankId,
    })
    localPrepKeys.add(prepKey)
  }

  return {
    learningTypesAdded,
    learningTypesMerged,
    questionBanksAdded,
    questionBanksSkipped,
    questionBankAiPrepAdded,
    questionBankAiPrepSkipped,
  }
}
