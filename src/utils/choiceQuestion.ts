export type ChoiceQuestionPayload = {
  mode: 'single' | 'multiple'
  correctAnswers: string[]
}

export function parseChoiceQuestionContent(raw: string): ChoiceQuestionPayload {
  try {
    const o = JSON.parse(raw) as Partial<ChoiceQuestionPayload>
    if (
      o &&
      (o.mode === 'single' || o.mode === 'multiple') &&
      Array.isArray(o.correctAnswers)
    ) {
      const answers = o.correctAnswers.map((s) => String(s))
      if (o.mode === 'single') {
        return { mode: 'single', correctAnswers: [answers[0] ?? ''] }
      }
      return {
        mode: 'multiple',
        correctAnswers: answers.length > 0 ? answers : ['', ''],
      }
    }
  } catch {
    /* 旧版纯文本 */
  }
  const t = raw.trim()
  return { mode: 'single', correctAnswers: [t] }
}

export function serializeChoiceQuestionPayload(p: ChoiceQuestionPayload): string {
  if (p.mode === 'single') {
    return JSON.stringify({
      mode: 'single',
      correctAnswers: [p.correctAnswers[0] ?? ''],
    })
  }
  return JSON.stringify({
    mode: 'multiple',
    correctAnswers: [...p.correctAnswers],
  })
}

/** 校验选择题 JSON 是否可提交 */
export function validateChoiceQuestionJson(content: string): {
  ok: boolean
  message?: string
} {
  const payload = parseChoiceQuestionContent(content)
  const single = payload.mode === 'single'
  const filled = payload.correctAnswers.map((s) => s.trim()).filter(Boolean)
  if (single) {
    if (filled.length === 0) {
      return { ok: false, message: '请填写正确答案。' }
    }
  } else if (filled.length < 2) {
    return { ok: false, message: '多选需至少填写两个正确答案。' }
  }
  return { ok: true }
}
