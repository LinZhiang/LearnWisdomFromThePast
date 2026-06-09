const TEXT_EXT = new Set(['.md', '.markdown', '.txt'])
const DOCX_EXT = new Set(['.docx'])

export const PREVIEW_DOCUMENT_ACCEPT = '.md,.markdown,.txt,.docx,.doc'

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

/** 从用户选择的文件读取为可在 Markdown 预览中编辑的文本 */
export async function readPreviewDocumentFile(file: File): Promise<string> {
  const ext = extOf(file.name)
  if (TEXT_EXT.has(ext)) {
    const text = await file.text()
    return text.replace(/\r\n/g, '\n')
  }
  if (ext === '.doc') {
    throw new Error('旧版 .doc 暂不支持，请用 Word 另存为 .docx 后再上传。')
  }
  if (DOCX_EXT.has(ext)) {
    const { default: mammoth } = await import('mammoth')
    const buf = await file.arrayBuffer()
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
    const text = (value ?? '').replace(/\r\n/g, '\n').trim()
    if (!text) throw new Error('Word 文档中未识别到文字内容。')
    return text
  }
  throw new Error(`不支持的文件类型：${ext || '（无扩展名）'}`)
}

export function isPreviewDocumentFile(file: File): boolean {
  const ext = extOf(file.name)
  return TEXT_EXT.has(ext) || DOCX_EXT.has(ext) || ext === '.doc'
}
