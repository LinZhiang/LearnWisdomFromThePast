import { db } from '@/db'
import type { QuestionBankAiPrepKind } from '@/db/models'

export async function loadQuestionBankAiPrep<T>(
  questionBankId: number,
  kind: QuestionBankAiPrepKind,
  fingerprint: string,
): Promise<T | null> {
  const row = await db.questionBankAiPrep
    .where('[questionBankId+kind]')
    .equals([questionBankId, kind])
    .first()
  if (!row || row.fingerprint !== fingerprint) return null
  try {
    return JSON.parse(row.payloadJson) as T
  } catch {
    return null
  }
}

export async function saveQuestionBankAiPrep(
  questionBankId: number,
  kind: QuestionBankAiPrepKind,
  fingerprint: string,
  payload: unknown,
): Promise<void> {
  const now = new Date().toISOString()
  const existing = await db.questionBankAiPrep
    .where('[questionBankId+kind]')
    .equals([questionBankId, kind])
    .first()
  const row = {
    questionBankId,
    kind,
    fingerprint,
    payloadJson: JSON.stringify(payload),
    updatedAt: now,
  }
  if (existing?.id != null) {
    await db.questionBankAiPrep.update(existing.id, row)
  } else {
    await db.questionBankAiPrep.add(row)
  }
}
