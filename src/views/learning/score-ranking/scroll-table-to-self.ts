import type { ComponentPublicInstance } from 'vue'

/** Element Plus 表格内部可纵向滚动的容器 */
function getTableBodyScrollWrap(tableRoot: HTMLElement): HTMLElement | null {
  const inner =
    (tableRoot.querySelector('.el-table__body-wrapper .el-scrollbar__wrap') as HTMLElement | null) ??
    (tableRoot.querySelector('.el-table__body-wrapper') as HTMLElement | null)
  return inner
}

/** 将表格滚动区滚到「我」所在行大致居中 */
export function scrollRankTableToSelf(tableInst: ComponentPublicInstance | null | undefined): void {
  const root = tableInst?.$el as HTMLElement | undefined
  if (!root) return
  const wrap = getTableBodyScrollWrap(root)
  const tr = root.querySelector('tbody tr.rank-row-self') as HTMLElement | null
  if (!wrap || !tr) return
  const delta =
    tr.getBoundingClientRect().top - wrap.getBoundingClientRect().top - wrap.clientHeight / 2 + tr.clientHeight / 2
  const top = Math.max(0, wrap.scrollTop + delta)
  wrap.scrollTo({ top, behavior: 'smooth' })
}
