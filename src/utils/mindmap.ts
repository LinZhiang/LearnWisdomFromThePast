type MarkmapModule = typeof import('markmap-view')
type TransformerModule = typeof import('markmap-lib')

let markmapModules: {
  Markmap: MarkmapModule['Markmap']
  Transformer: TransformerModule['Transformer']
} | null = null

async function loadMarkmapModules() {
  if (markmapModules) return markmapModules
  const [{ Markmap }, { Transformer }] = await Promise.all([
    import('markmap-view'),
    import('markmap-lib'),
  ])
  markmapModules = { Markmap, Transformer }
  return markmapModules
}

export const renderMindmap = async (
  svgElement: SVGSVGElement,
  markdown: string,
  options?: {
    /** 初始展开层级；不传则由 markmap 默认行为决定 */
    initialExpandLevel?: number
  },
) => {
  const { Markmap, Transformer } = await loadMarkmapModules()
  const transformer = new Transformer()
  const { root } = transformer.transform(markdown)
  const markmapOptions =
    options?.initialExpandLevel == null ?
      undefined
    : { initialExpandLevel: options.initialExpandLevel }
  return Markmap.create(svgElement, markmapOptions, root)
}
