import { onBeforeUnmount, type Ref } from 'vue'

/** 两侧独立滚动容器按滚动比例联动（适合 Markdown 编辑 + 预览） */
export function useLinkedVerticalScroll(
  sourceEl: Ref<HTMLElement | null | undefined>,
  targetEl: Ref<HTMLElement | null | undefined>,
) {
  let syncing = false
  let sourceAttached: HTMLElement | null = null
  let targetAttached: HTMLElement | null = null

  function ratioScroll(from: HTMLElement, to: HTMLElement) {
    const fromMax = from.scrollHeight - from.clientHeight
    const toMax = to.scrollHeight - to.clientHeight
    if (fromMax <= 0) {
      to.scrollTop = 0
      return
    }
    const ratio = from.scrollTop / fromMax
    to.scrollTop = ratio * Math.max(0, toMax)
  }

  function onSourceScroll() {
    if (syncing) return
    const src = sourceEl.value
    const tgt = targetEl.value
    if (!src || !tgt) return
    syncing = true
    ratioScroll(src, tgt)
    requestAnimationFrame(() => {
      syncing = false
    })
  }

  function onTargetScroll() {
    if (syncing) return
    const src = sourceEl.value
    const tgt = targetEl.value
    if (!src || !tgt) return
    syncing = true
    ratioScroll(tgt, src)
    requestAnimationFrame(() => {
      syncing = false
    })
  }

  function bind() {
    unbind()
    const src = sourceEl.value
    const tgt = targetEl.value
    if (!src || !tgt) return
    sourceAttached = src
    targetAttached = tgt
    src.addEventListener('scroll', onSourceScroll, { passive: true })
    tgt.addEventListener('scroll', onTargetScroll, { passive: true })
  }

  function unbind() {
    if (sourceAttached) {
      sourceAttached.removeEventListener('scroll', onSourceScroll)
      sourceAttached = null
    }
    if (targetAttached) {
      targetAttached.removeEventListener('scroll', onTargetScroll)
      targetAttached = null
    }
  }

  onBeforeUnmount(unbind)

  return { bind, unbind }
}
