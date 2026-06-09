/**
 * 关闭可能挡住点击的 Element Plus 浮层（tooltip / dropdown 等）。
 * 全屏切换或顶栏 v-show 隐藏后，teleport 到 body 的 popper 常会残留。
 */
export function dismissFloatingLayers() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }

  /* 不可派发 Esc：App 会把它当成「退出全屏」，导致刚进入全屏立刻被关掉 */

  const hasOpenDialog = document.querySelector(
    '.el-overlay.is-message-box, .el-dialog, .el-drawer',
  )
  if (hasOpenDialog) return

  for (const el of document.querySelectorAll('body > .el-popper')) {
    el.remove()
  }
  for (const el of document.querySelectorAll('body > .el-tooltip__popper')) {
    el.remove()
  }
}
