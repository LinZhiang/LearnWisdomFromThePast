const MOUSE_AUX_BUTTON = 1
const MOUSE_BACK_BUTTON = 3
const MOUSE_FORWARD_BUTTON = 4

function isMouseHistoryButton(button: number): boolean {
  return button === MOUSE_BACK_BUTTON || button === MOUSE_FORWARD_BUTTON
}

/** 侧键后退/前进：在按下与抬起阶段均拦截，避免触发浏览器历史导航 */
function blockMouseHistoryButtons(event: MouseEvent): void {
  if (!isMouseHistoryButton(event.button)) return
  event.preventDefault()
  event.stopPropagation()
}

/** 中键点击：避免中键打开链接、触发 autoscroll 等误操作 */
function blockMiddleMouseButton(event: MouseEvent): void {
  if (event.button !== MOUSE_AUX_BUTTON) return
  event.preventDefault()
  event.stopPropagation()
}

/** Ctrl/Shift/Alt/Meta + 点击链接：避免新标签页或意外跳转 */
function blockModifiedLinkClick(event: MouseEvent): void {
  if (event.button !== 0) return
  if (!(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (!target.closest('a[href]')) return
  event.preventDefault()
  event.stopPropagation()
}

/**
 * 全站拦截常见鼠标快捷键误操作（侧键后退/前进、中键、修饰键+链接）。
 * 返回卸载函数，供应用根组件在 onBeforeUnmount 时调用。
 */
export function attachMouseShortcutNavigationGuards(): () => void {
  const options: AddEventListenerOptions = { capture: true }

  document.addEventListener('mousedown', blockMouseHistoryButtons, options)
  document.addEventListener('mouseup', blockMouseHistoryButtons, options)
  document.addEventListener('auxclick', blockMiddleMouseButton, options)
  document.addEventListener('mousedown', blockMiddleMouseButton, options)
  document.addEventListener('click', blockModifiedLinkClick, options)

  return () => {
    document.removeEventListener('mousedown', blockMouseHistoryButtons, options)
    document.removeEventListener('mouseup', blockMouseHistoryButtons, options)
    document.removeEventListener('auxclick', blockMiddleMouseButton, options)
    document.removeEventListener('mousedown', blockMiddleMouseButton, options)
    document.removeEventListener('click', blockModifiedLinkClick, options)
  }
}
