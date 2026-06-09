/** 去掉模型返回中的思考/检索过程，仅保留给学员看的正文 */
export function sanitizeAssistantReplyForDisplay(text: string): string {
  let t = text.trim()
  if (!t) return ''

  // DeepSeek / 常见 reasoning 围栏
  t = t.replace(/[\s\S]*?<\/think>/gi, '')
  t = t.replace(/[\s\S]*?<\/redacted_reasoning>/gi, '')
  t = t.replace(/[\s\S]*?<\/reasoning>/gi, '')

  // 未闭合的思考块（整段在开头）
  if (/^[\s\S]*$/i.test(t) && /<(think|redacted_reasoning|reasoning)\b/i.test(text)) {
    const afterClose = text.split(/<\/(?:think|redacted_reasoning|reasoning)>/i).pop()
    if (afterClose?.trim()) t = afterClose.trim()
  }

  // 去掉「先检索材料…」类元叙述开头（保守匹配一两行）
  t = t.replace(
    /^(?:[^\n]*(?:检索|查找|阅读|分析).*?(?:材料|讲义|题目)[^\n]*\n+){1,3}/i,
    '',
  )

  return t.trim()
}
