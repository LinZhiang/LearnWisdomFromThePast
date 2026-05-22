/** 将富文本 HTML 转为纯文本，供 AI 提示词使用 */
export const htmlToPlainText = (html: string): string => {
  if (!html?.trim()) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const text = doc.body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim()
}
