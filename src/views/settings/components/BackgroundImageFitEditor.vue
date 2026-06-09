<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppearanceStore } from '@/stores/appearance'
import {
  BACKGROUND_IMAGE_ROTATION_MAX,
  BACKGROUND_IMAGE_ROTATION_MIN,
  BACKGROUND_IMAGE_ROTATION_STEP,
  BACKGROUND_IMAGE_ZOOM_MAX,
  BACKGROUND_IMAGE_ZOOM_MIN,
  BACKGROUND_IMAGE_ZOOM_STEP,
  clampFocalForPan,
  clampRotation,
  clampZoom,
  focalFromPanDelta,
  normalizeBackgroundImageFit,
  resetBackgroundImageFit,
  type BackgroundImageFit,
} from '@/utils/backgroundImageFit'

const props = defineProps<{
  imageUrl: string
}>()

const appearanceStore = useAppearanceStore()
const {
  backgroundImageFit,
  viewportWidth,
  viewportHeight,
  shellBackgroundImgStyle,
  shellTintOverlayStyle,
} = storeToRefs(appearanceStore)

const frameRef = ref<HTMLElement | null>(null)
/** 预览外框当前渲染宽度（用于等比缩小整窗镜像） */
const frameWidth = ref(640)

let resizeObserver: ResizeObserver | null = null
let topNavResizeObserver: ResizeObserver | null = null

/** 与 App.vue `.top-nav` 默认高度接近；优先实测顶栏 DOM */
const TOP_NAV_HEIGHT_FALLBACK_PX = 73

const topNavHeightPx = ref(TOP_NAV_HEIGHT_FALLBACK_PX)

const fit = computed(() => backgroundImageFit.value)

const showNavGuide = computed(() => topNavHeightPx.value > 0)

const navGuideStyle = computed(() => ({
  height: `${topNavHeightPx.value}px`,
}))

const viewportLabel = computed(() => {
  const w = Math.round(viewportWidth.value)
  const h = Math.round(viewportHeight.value)
  return `${w}×${h}`
})

const frameAspectStyle = computed(() => {
  const vw = Math.max(1, viewportWidth.value)
  const vh = Math.max(1, viewportHeight.value)
  return { aspectRatio: `${vw} / ${vh}` }
})

/** 将浏览器窗口等比缩放进预览框 */
const previewScale = computed(() => {
  const vw = Math.max(1, viewportWidth.value)
  return frameWidth.value / vw
})

const mirrorStyle = computed(() => {
  const vw = Math.max(1, viewportWidth.value)
  const vh = Math.max(1, viewportHeight.value)
  const scale = previewScale.value
  return {
    width: `${vw}px`,
    height: `${vh}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }
})

function syncFrameWidth() {
  const el = frameRef.value
  if (!el) return
  frameWidth.value = Math.max(1, el.clientWidth || 640)
}

function measureTopNavHeight() {
  const el = document.querySelector('.app-shell .top-nav') as HTMLElement | null
  if (!el) {
    topNavHeightPx.value = TOP_NAV_HEIGHT_FALLBACK_PX
    return
  }
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') {
    topNavHeightPx.value = 0
    return
  }
  const h = el.getBoundingClientRect().height
  topNavHeightPx.value = h >= 1 ? Math.round(h) : TOP_NAV_HEIGHT_FALLBACK_PX
}

function bindTopNavObserver() {
  topNavResizeObserver?.disconnect()
  topNavResizeObserver = null
  measureTopNavHeight()
  const el = document.querySelector('.app-shell .top-nav') as HTMLElement | null
  if (!el || typeof ResizeObserver === 'undefined') return
  topNavResizeObserver = new ResizeObserver(() => measureTopNavHeight())
  topNavResizeObserver.observe(el)
}

function bindFrameObserver() {
  resizeObserver?.disconnect()
  resizeObserver = null
  const el = frameRef.value
  if (!el) return
  syncFrameWidth()
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (!rect) return
    frameWidth.value = Math.max(1, rect.width)
  })
  resizeObserver.observe(el)
}

watch(
  () => [fit.value, props.imageUrl, viewportWidth.value, viewportHeight.value] as const,
  () => {
    if (!fit.value || !props.imageUrl.trim()) return
    void nextTick(() => bindFrameObserver())
  },
  { immediate: true },
)

onMounted(() => {
  void nextTick(() => {
    bindTopNavObserver()
    bindFrameObserver()
  })
  window.addEventListener('resize', measureTopNavHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', measureTopNavHeight)
  topNavResizeObserver?.disconnect()
  resizeObserver?.disconnect()
})

const zoomSliderValue = computed(() => {
  const z = fit.value?.zoom ?? 1
  return Math.round(z * 100)
})

const zoomLabel = computed(() => {
  const z = fit.value?.zoom ?? 1
  return z <= 1.02 ? '铺满' : `${Math.round(z * 100)}%`
})

const rotationSliderValue = computed(() => Math.round(fit.value?.rotation ?? 0))

const rotationLabel = computed(() => `${rotationSliderValue.value}°`)

function patchFit(partial: Partial<BackgroundImageFit>) {
  const current = fit.value
  if (!current) return
  backgroundImageFit.value = normalizeBackgroundImageFit(
    { ...current, ...partial },
    current.intrinsicWidth,
    current.intrinsicHeight,
  )
}

function patchFitAndClampPan(partial: Partial<BackgroundImageFit>) {
  patchFit(partial)
  const current = fit.value
  if (!current) return
  const clamped = clampFocalForPan(
    current,
    viewportWidth.value,
    viewportHeight.value,
    current.focalX,
    current.focalY,
  )
  if (clamped.focalX !== current.focalX || clamped.focalY !== current.focalY) {
    patchFit(clamped)
  }
}

function onRotationInput(e: Event) {
  patchFitAndClampPan({ rotation: clampRotation(Number((e.target as HTMLInputElement).value)) })
}

function onRotationChange() {
  persistFit()
}

function rotateBy90() {
  const r = fit.value?.rotation ?? 0
  patchFitAndClampPan({ rotation: clampRotation(r + 90) })
  persistFit()
}

function resetRotation() {
  patchFitAndClampPan({ rotation: 0 })
  persistFit()
}

function toggleFlipX() {
  patchFitAndClampPan({ flipX: !fit.value?.flipX })
  persistFit()
}

function toggleFlipY() {
  patchFitAndClampPan({ flipY: !fit.value?.flipY })
  persistFit()
}

function resetFit() {
  const current = fit.value
  if (!current) return
  const next = resetBackgroundImageFit(current.intrinsicWidth, current.intrinsicHeight)
  appearanceStore.updateBackgroundImageFit(next)
}

function persistFit() {
  const current = fit.value
  if (!current) return
  appearanceStore.updateBackgroundImageFit(current)
}

function focalFromDrag(dx: number, dy: number, startFocalX: number, startFocalY: number) {
  const current = fit.value
  if (!current) return { focalX: startFocalX, focalY: startFocalY }
  const scale = previewScale.value || 1
  return focalFromPanDelta(
    current,
    viewportWidth.value,
    viewportHeight.value,
    dx / scale,
    dy / scale,
    startFocalX,
    startFocalY,
  )
}

const dragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let dragStartFocalX = 50
let dragStartFocalY = 50

function onFramePointerDown(e: PointerEvent) {
  if (!fit.value || e.button !== 0) return
  dragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartFocalX = fit.value.focalX
  dragStartFocalY = fit.value.focalY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onFramePointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  const { focalX, focalY } = focalFromDrag(dx, dy, dragStartFocalX, dragStartFocalY)
  patchFit({ focalX, focalY })
}

function onFramePointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  persistFit()
}

function onZoomInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value)
  const zoom = clampZoom(raw / 100)
  patchFitAndClampPan({ zoom })
}

function onZoomChange() {
  persistFit()
}
</script>

<template>
  <div v-if="fit" class="bg-fit-editor">
    <div class="bg-fit-editor__toolbar">
      <p class="bg-fit-editor__ratio">
        与当前浏览器窗口同步预览（{{ viewportLabel }}）；预览顶部红框为<strong>顶栏菜单位置</strong>
      </p>
      <div class="bg-fit-editor__controls">
        <label class="bg-fit-editor__zoom">
          <span class="bg-fit-editor__row-label">缩放</span>
          <span class="bg-fit-editor__zoom-icon" aria-hidden="true">−</span>
          <input
            type="range"
            class="bg-fit-editor__range"
            :min="BACKGROUND_IMAGE_ZOOM_MIN * 100"
            :max="BACKGROUND_IMAGE_ZOOM_MAX * 100"
            :step="BACKGROUND_IMAGE_ZOOM_STEP * 100"
            :value="zoomSliderValue"
            aria-label="背景缩放"
            @input="onZoomInput"
            @change="onZoomChange"
          />
          <span class="bg-fit-editor__zoom-icon" aria-hidden="true">+</span>
          <span class="bg-fit-editor__value">{{ zoomLabel }}</span>
        </label>
        <div class="bg-fit-editor__rotation">
          <span class="bg-fit-editor__row-label">旋转</span>
          <input
            type="range"
            class="bg-fit-editor__range"
            :min="BACKGROUND_IMAGE_ROTATION_MIN"
            :max="BACKGROUND_IMAGE_ROTATION_MAX"
            :step="BACKGROUND_IMAGE_ROTATION_STEP"
            :value="rotationSliderValue"
            aria-label="背景旋转"
            @input="onRotationInput"
            @change="onRotationChange"
          />
          <span class="bg-fit-editor__value">{{ rotationLabel }}</span>
          <div class="bg-fit-editor__rotate-actions">
            <button type="button" class="bg-fit-editor__rotate-btn" @click="rotateBy90">+90°</button>
            <button type="button" class="bg-fit-editor__rotate-btn" @click="resetRotation">旋转归零</button>
          </div>
        </div>
        <div class="bg-fit-editor__flip">
          <span class="bg-fit-editor__row-label">翻转</span>
          <div class="bg-fit-editor__flip-actions">
            <button
              type="button"
              class="bg-fit-editor__flip-btn"
              :class="{ 'bg-fit-editor__flip-btn--on': fit.flipX }"
              @click="toggleFlipX"
            >
              水平
            </button>
            <button
              type="button"
              class="bg-fit-editor__flip-btn"
              :class="{ 'bg-fit-editor__flip-btn--on': fit.flipY }"
              @click="toggleFlipY"
            >
              垂直
            </button>
          </div>
          <button type="button" class="bg-fit-editor__reset-btn" @click="resetFit">重置取景</button>
        </div>
      </div>
    </div>

    <div
      ref="frameRef"
      class="bg-fit-editor__frame"
      :style="frameAspectStyle"
      :class="{ 'bg-fit-editor__frame--dragging': dragging }"
      @pointerdown="onFramePointerDown"
      @pointermove="onFramePointerMove"
      @pointerup="onFramePointerUp"
      @pointercancel="onFramePointerUp"
    >
      <div class="bg-fit-editor__mirror" :style="mirrorStyle">
        <img
          v-if="props.imageUrl.trim()"
          :key="props.imageUrl"
          class="bg-fit-editor__preview-img"
          :src="props.imageUrl"
          alt=""
          draggable="false"
          :style="shellBackgroundImgStyle"
        />
        <div class="bg-fit-editor__mirror-tint" aria-hidden="true" :style="shellTintOverlayStyle" />
        <div
          v-if="showNavGuide"
          class="bg-fit-editor__nav-guide"
          :style="navGuideStyle"
          aria-hidden="true"
        >
          <span class="bg-fit-editor__nav-guide-label">顶栏菜单</span>
        </div>
      </div>
      <p class="bg-fit-editor__hint">
        拖动调整位置 · 红框内为顶栏遮挡区 · 可翻转或重置取景
      </p>
    </div>
  </div>
</template>

<style scoped>
.bg-fit-editor {
  grid-column: 1 / -1;
  display: grid;
  gap: 10px;
  margin-top: 4px;
}

.bg-fit-editor__toolbar {
  display: grid;
  gap: 10px;
}

.bg-fit-editor__ratio {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--app-text-muted);
}

.bg-fit-editor__controls {
  display: grid;
  gap: 10px;
}

.bg-fit-editor__row-label {
  justify-self: end;
  font-size: 13px;
  color: var(--app-text-muted);
  white-space: nowrap;
}

.bg-fit-editor__zoom {
  display: grid;
  grid-template-columns: 2.75rem 1.25rem minmax(0, 1fr) 1.25rem 3.25rem;
  align-items: center;
  gap: 4px 8px;
  width: 100%;
}

.bg-fit-editor__rotation {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) 3rem auto;
  align-items: center;
  gap: 4px 10px;
  width: 100%;
}

.bg-fit-editor__range {
  width: 100%;
  height: 28px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
}

.bg-fit-editor__value {
  font-size: 13px;
  text-align: right;
  color: var(--app-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.bg-fit-editor__rotate-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.bg-fit-editor__rotate-btn {
  flex-shrink: 0;
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid var(--app-border);
  background: var(--app-surface-alt);
  color: var(--app-text-muted);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.bg-fit-editor__rotate-btn:hover {
  color: var(--app-text);
  border-color: var(--app-primary);
}

.bg-fit-editor__flip {
  display: grid;
  grid-template-columns: 2.75rem 1fr auto;
  align-items: center;
  gap: 4px 10px;
  width: 100%;
}

.bg-fit-editor__flip-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bg-fit-editor__flip-btn {
  flex-shrink: 0;
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid var(--app-border);
  background: var(--app-surface-alt);
  color: var(--app-text-muted);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.bg-fit-editor__flip-btn:hover {
  color: var(--app-text);
  border-color: var(--app-primary);
}

.bg-fit-editor__flip-btn--on {
  color: var(--app-primary);
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  font-weight: 600;
}

.bg-fit-editor__reset-btn {
  flex-shrink: 0;
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid var(--app-border);
  background: var(--app-surface-alt);
  color: var(--app-text-muted);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.bg-fit-editor__reset-btn:hover {
  color: var(--app-text);
  border-color: var(--app-danger, #dc2626);
}

.bg-fit-editor__zoom-icon {
  width: 1.25rem;
  text-align: center;
  font-weight: 600;
  color: var(--app-text-muted);
  user-select: none;
}

@media (max-width: 520px) {
  .bg-fit-editor__flip {
    grid-template-columns: 2.75rem 1fr;
    grid-template-rows: auto auto;
  }

  .bg-fit-editor__flip .bg-fit-editor__row-label {
    grid-row: 1 / 3;
    align-self: center;
  }

  .bg-fit-editor__flip-actions {
    grid-column: 2;
  }

  .bg-fit-editor__reset-btn {
    grid-column: 1 / -1;
    justify-self: start;
    margin-left: 2.75rem;
  }

  .bg-fit-editor__rotation {
    grid-template-columns: 2.75rem minmax(0, 1fr) 3rem;
    grid-template-rows: auto auto;
  }

  .bg-fit-editor__rotation .bg-fit-editor__row-label {
    grid-column: 1;
    grid-row: 1;
    align-self: center;
  }

  .bg-fit-editor__rotation .bg-fit-editor__range {
    grid-column: 2;
    grid-row: 1;
  }

  .bg-fit-editor__rotation .bg-fit-editor__value {
    grid-column: 3;
    grid-row: 1;
  }

  .bg-fit-editor__rotate-actions {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: flex-start;
    padding-left: 2.75rem;
  }
}

.bg-fit-editor__frame {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  background: var(--app-outer-canvas, var(--app-surface-alt));
  box-shadow: inset 0 0 0 2px #3b82f6;
}

.bg-fit-editor__frame--dragging {
  cursor: grabbing;
}

.bg-fit-editor__mirror {
  position: relative;
  overflow: hidden;
  pointer-events: none;
}

.bg-fit-editor__preview-img {
  display: block;
}

.bg-fit-editor__mirror-tint {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-fit-editor__nav-guide {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  box-sizing: border-box;
  pointer-events: none;
  border-bottom: 2px dashed rgba(239, 68, 68, 0.9);
  background: linear-gradient(
    to bottom,
    rgba(239, 68, 68, 0.18),
    rgba(239, 68, 68, 0.05) 70%,
    transparent
  );
}

.bg-fit-editor__nav-guide-label {
  position: absolute;
  left: 8px;
  bottom: 5px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #fff;
  background: rgba(220, 38, 38, 0.82);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

.bg-fit-editor__hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  text-align: center;
  color: #fff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.45));
  pointer-events: none;
  z-index: 2;
}
</style>
