import DOMPurify from 'dompurify'

export const sanitizeRichHtml = (html: string) => {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  })
}
