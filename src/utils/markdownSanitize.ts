import DOMPurify from 'dompurify'

let katexHooksInstalled = false

/** KaTeX 依赖行内 style；仅允许出现在 .katex 容器内 */
function installKatexDompurifyHooks(): void {
  if (katexHooksInstalled) return
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName !== 'style') return
    const el = node as Element
    if (el.closest?.('.katex') || el.closest?.('.katex-display')) {
      data.keepAttr = true
    }
  })
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName !== 'IMG') return
    const el = node as Element
    el.removeAttribute('width')
    el.removeAttribute('height')
    el.removeAttribute('style')
    const cls = (el.getAttribute('class') ?? '').trim()
    el.setAttribute('class', cls ? `${cls} md-embed-img` : 'md-embed-img')
  })
  katexHooksInstalled = true
}

const SANITIZE_OPTS = {
  USE_PROFILES: { html: true, mathMl: true },
  ADD_DATA_URI_TAGS: ['img'],
  ADD_ATTR: [
    'src',
    'alt',
    'title',
    'loading',
    'referrerpolicy',
    'data-md-line',
    'class',
    'style',
    'aria-hidden',
    'role',
    'xmlns',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
}

export function sanitizeMarkdownHtml(raw: string): string {
  installKatexDompurifyHooks()
  return String(DOMPurify.sanitize(raw, SANITIZE_OPTS))
}
