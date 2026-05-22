import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'

const transformer = new Transformer()

export const renderMindmap = (
  svgElement: SVGSVGElement,
  markdown: string,
  options?: {
    /** 初始展开层级；不传则由 markmap 默认行为决定 */
    initialExpandLevel?: number
  },
) => {
  const { root } = transformer.transform(markdown)
  const markmapOptions =
    options?.initialExpandLevel == null ?
      undefined
    : { initialExpandLevel: options.initialExpandLevel }
  return Markmap.create(svgElement, markmapOptions, root)
}
