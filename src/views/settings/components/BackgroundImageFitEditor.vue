<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppearanceStore } from '@/stores/appearance'
import {
  BACKGROUND_IMAGE_ZOOM_MAX,
  BACKGROUND_IMAGE_ZOOM_MIN,
  BACKGROUND_IMAGE_ZOOM_STEP,
  clampFocal,
  clampZoom,
  computeBackgroundFitCss,
  computeBackgroundFitPreviewStyle,
  normalizeBackgroundImageFit,
  type BackgroundImageFit,
} from '@/utils/backgroundImageFit'

const props = defineProps<{
  imageUrl: string
}>()

const appearanceStore = useAppearanceStore()
const { backgroundImageFit } = storeToRefs(appearanceStore)

const frameRef = ref<HTMLElement | null>(null)
const frameSize = ref({ w: 640, h: 360 })

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const el = frameRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (!rect) return
    frameSize.value = {
      w: Math.max(1, rect.width),
      h: Math.max(1, rect.height),
    }
  })
  resizeObserver.observe(el)
  frameSize.value = { w: el.clientWidth || 640, h: el.clientHeight || 360 }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

const fit = computed(() => backgroundImageFit.value)

const previewLayerStyle = computed(() => {
  const f = fit.value
  if (!f || !props.imageUrl.trim()) return {}
  return computeBackgroundFitPreviewStyle(
    f,
    frameSize.value.w,
    frameSize.value.h,
    props.imageUrl,
  )
})

const zoomSliderValue = computed(() => {
  const z = fit.value?.zoom ?? 1
  return Math.round(z * 100)
})

const zoomLabel = computed(() => {
  const z = fit.value?.zoom ?? 1
  return z <= 1.02 ? '铺满' : `${Math.round(z * 100)}%`
})

function patchFit(partial: Partial<BackgroundImageFit>) {
  const current = fit.value
  if (!current) return
  backgroundImageFit.value = normalizeBackgroundImageFit(
    { ...current, ...partial },
    current.intrinsicWidth,
    current.intrinsicHeight,
  )
}

function persistFit() {
  const current = fit.value
  if (!current) return
  appearanceStore.updateBackgroundImageFit(current)
}

function focalFromDrag(dx: number, dy: number, startFocalX: number, startFocalY: number) {
  const current = fit.value
  if (!current) return { focalX: startFocalX, focalY: startFocalY }
  const { backgroundSize } = computeBackgroundFitCss(
    current,
    frameSize.value.w,
    frameSize.value.h,
  )
  const [bwStr, bhStr] = backgroundSize.split(' ')
  const bw = Number.parseFloat(bwStr) || frameSize.value.w
  const bh = Number.parseFloat(bhStr) || frameSize.value.h
  const overflowX = Math.max(0, bw - frameSize.value.w)
  const overflowY = Math.max(0, bh - frameSize.value.h)
  let focalX = startFocalX
  let focalY = startFocalY
  if (overflowX > 0) focalX = clampFocal(startFocalX - (dx / overflowX) * 100)
  if (overflowY > 0) focalY = clampFocal(startFocalY - (dy / overflowY) * 100)
  return { focalX, focalY }
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
  patchFit({ zoom })
}

function onZoomChange() {
  persistFit()
}
</script>

<template>
  <div v-if="fit" class="bg-fit-editor">
    <div class="bg-fit-editor__toolbar">
      <span class="bg-fit-editor__ratio">背景取景（16∶9 预览）</span>
      <label class="bg-fit-editor__zoom">
        <span class="bg-fit-editor__zoom-icon" aria-hidden="true">−</span>
        <input
          type="range"
          :min="BACKGROUND_IMAGE_ZOOM_MIN * 100"
          :max="BACKGROUND_IMAGE_ZOOM_MAX * 100"
          :step="BACKGROUND_IMAGE_ZOOM_STEP * 100"
          :value="zoomSliderValue"
          aria-label="背景缩放"
          @input="onZoomInput"
          @change="onZoomChange"
        />
        <span class="bg-fit-editor__zoom-icon" aria-hidden="true">+</span>
        <span class="bg-fit-editor__zoom-label">{{ zoomLabel }}</span>
      </label>
    </div>

    <div
      ref="frameRef"
      class="bg-fit-editor__frame"
      :class="{ 'bg-fit-editor__frame--dragging': dragging }"
      @pointerdown="onFramePointerDown"
      @pointermove="onFramePointerMove"
      @pointerup="onFramePointerUp"
      @pointercancel="onFramePointerUp"
    >
      <div class="bg-fit-editor__layer" :style="previewLayerStyle" />
      <div class="bg-fit-editor__crop-mask" aria-hidden="true" />
      <p class="bg-fit-editor__hint">拖动图片调整位置 · 滑条缩放 · 不另扣费</p>
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.bg-fit-editor__ratio {
  font-size: 13px;
  color: var(--app-text-muted);
}

.bg-fit-editor__zoom {
  display: flex;
  flex: 1;
  min-width: 200px;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--app-text-muted);
}

.bg-fit-editor__zoom input[type='range'] {
  flex: 1;
  height: 28px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
}

.bg-fit-editor__zoom-icon {
  width: 1.25rem;
  text-align: center;
  font-weight: 600;
  color: var(--app-text-muted);
  user-select: none;
}

.bg-fit-editor__zoom-label {
  min-width: 2.5rem;
  text-align: right;
}

.bg-fit-editor__frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  background: var(--app-surface-alt);
  box-shadow: inset 0 0 0 2px #3b82f6;
}

.bg-fit-editor__frame--dragging {
  cursor: grabbing;
}

.bg-fit-editor__layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-fit-editor__crop-mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 0 2px #3b82f6;
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
}
</style>
