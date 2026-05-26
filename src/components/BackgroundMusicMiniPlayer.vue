<script setup lang="ts">
import { CaretRight, Close, DArrowLeft, DArrowRight, Minus, VideoPause } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useBackgroundMusicStore } from '@/stores/background-music'
import { formatSecondsAsZh } from '@/utils/formatDuration'
import { MUSIC_PLAY_MODE_OPTIONS } from '@/utils/music-catalog'

const PANEL_STORAGE_KEY = 'wen-wu-bgm-mini-panel-v1'

type PanelLayout = {
  minimized?: boolean
  left?: number
  top?: number
}

const PLAY_MODE_LABEL = Object.fromEntries(
  MUSIC_PLAY_MODE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<string, string>

const bgm = useBackgroundMusicStore()
const {
  treeData,
  selectedTrackId,
  selectedTrack,
  playMode,
  isPlaying,
  showMiniPlayer,
  canPlayPrevious,
  canPlayNext,
  billingStatus,
} = storeToRefs(bgm)

const panelRef = ref<HTMLElement | null>(null)
const minimized = ref(false)
const panelLeft = ref(0)
const panelTop = ref(76)
const dragging = ref(false)

let uiTick: ReturnType<typeof setInterval> | null = null
let dragOrigin = { pointerX: 0, pointerY: 0, left: 0, top: 0 }

function defaultPanelPosition(width = 320) {
  if (typeof window === 'undefined') return { left: 16, top: 76 }
  return {
    left: Math.max(8, window.innerWidth - width - 16),
    top: 76,
  }
}

function loadPanelLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PanelLayout
  } catch {
    return {}
  }
}

function savePanelLayout() {
  const payload: PanelLayout = {
    minimized: minimized.value,
    left: panelLeft.value,
    top: panelTop.value,
  }
  localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(payload))
}

function clampPanelPosition() {
  if (typeof window === 'undefined') return
  const el = panelRef.value
  const w = el?.offsetWidth ?? 320
  const h = el?.offsetHeight ?? 48
  panelLeft.value = Math.min(
    Math.max(8, panelLeft.value),
    Math.max(8, window.innerWidth - w - 8),
  )
  panelTop.value = Math.min(
    Math.max(8, panelTop.value),
    Math.max(8, window.innerHeight - h - 8),
  )
}

function applyLoadedLayout() {
  const saved = loadPanelLayout()
  minimized.value = Boolean(saved.minimized)
  const fallback = defaultPanelPosition()
  panelLeft.value =
    typeof saved.left === 'number' && Number.isFinite(saved.left) ? saved.left : fallback.left
  panelTop.value =
    typeof saved.top === 'number' && Number.isFinite(saved.top) ? saved.top : fallback.top
  clampPanelPosition()
}

const panelStyle = computed(() => ({
  left: `${panelLeft.value}px`,
  top: `${panelTop.value}px`,
}))

const startUiTick = () => {
  if (uiTick != null) return
  uiTick = window.setInterval(() => bgm.refreshBilling(), 1000)
}

const stopUiTick = () => {
  if (uiTick == null) return
  clearInterval(uiTick)
  uiTick = null
}

const onWindowResize = () => {
  clampPanelPosition()
  savePanelLayout()
}

onMounted(() => {
  bgm.ensureInitialized()
  bgm.refreshBilling()
  applyLoadedLayout()
  if (isPlaying.value) startUiTick()
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  stopUiTick()
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
})

watch(isPlaying, (playing) => {
  if (playing) startUiTick()
  else stopUiTick()
})

watch(showMiniPlayer, (visible) => {
  if (visible) {
    requestAnimationFrame(() => {
      clampPanelPosition()
    })
  }
})

const onToggle = () => {
  void bgm.togglePlayback()
}

const onClose = () => {
  bgm.dismissMiniPlayer()
}

const onTrackChange = (value: string | null | undefined) => {
  bgm.setSelectedTrackId(value ?? null)
}

const toggleMinimized = () => {
  minimized.value = !minimized.value
  savePanelLayout()
  requestAnimationFrame(() => clampPanelPosition())
}

const onDragStart = (e: PointerEvent) => {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('button') || target.closest('.el-button')) return

  dragging.value = true
  dragOrigin = {
    pointerX: e.clientX,
    pointerY: e.clientY,
    left: panelLeft.value,
    top: panelTop.value,
  }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}

function onDragMove(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragOrigin.pointerX
  const dy = e.clientY - dragOrigin.pointerY
  panelLeft.value = dragOrigin.left + dx
  panelTop.value = dragOrigin.top + dy
  clampPanelPosition()
}

function onDragEnd() {
  if (!dragging.value) return
  dragging.value = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
  savePanelLayout()
}
</script>

<template>
  <Teleport to="body">
    <!-- 展开 -->
    <aside
      v-if="showMiniPlayer && !minimized"
      ref="panelRef"
      class="bgm-mini-player"
      :class="{ 'bgm-mini-player--dragging': dragging }"
      :style="panelStyle"
      role="region"
      aria-label="背景音乐控制"
    >
      <div
        class="bgm-mini-player__head bgm-mini-player__head--drag"
        title="拖动标题栏移动位置"
        @pointerdown="onDragStart"
      >
        <span class="bgm-mini-player__kicker">背景音乐</span>
        <div class="bgm-mini-player__head-actions" @pointerdown.stop>
          <el-button
            class="bgm-mini-player__icon-btn"
            :icon="Minus"
            circle
            size="small"
            text
            aria-label="最小化"
            @click="toggleMinimized"
          />
          <el-button
            v-if="!isPlaying"
            class="bgm-mini-player__icon-btn"
            :icon="Close"
            circle
            size="small"
            text
            aria-label="关闭面板"
            @click="onClose"
          />
        </div>
      </div>

      <label class="bgm-mini-player__label" for="bgm-mini-track-select">音乐文件</label>
      <el-tree-select
        id="bgm-mini-track-select"
        :model-value="selectedTrackId"
        class="bgm-mini-player__select"
        popper-class="bgm-mini-player__popper"
        :data="treeData"
        node-key="id"
        check-strictly
        filterable
        clearable
        placeholder="展开文件夹后选择曲目"
        :render-after-expand="false"
        teleported
        @update:model-value="onTrackChange"
      />

      <p v-if="selectedTrack" class="bgm-mini-player__current">
        <span class="bgm-mini-player__current-name">{{ selectedTrack.label }}</span>
        <span v-if="selectedTrack.folder" class="bgm-mini-player__current-folder">
          · {{ selectedTrack.folder }}
        </span>
      </p>

      <div class="bgm-mini-player__meta">
        <span>{{ PLAY_MODE_LABEL[playMode] ?? playMode }}</span>
        <span class="bgm-mini-player__dot" aria-hidden="true">·</span>
        <span>
          {{ isPlaying ? '计时中' : '已暂停' }}
          <template v-if="isPlaying">
            · 距扣费 {{ formatSecondsAsZh(billingStatus.secondsUntilNextCharge) }}
          </template>
        </span>
      </div>

      <div class="bgm-mini-player__transport">
        <el-button
          class="bgm-mini-player__play"
          type="primary"
          :disabled="!selectedTrackId"
          :icon="isPlaying ? VideoPause : CaretRight"
          @click="onToggle"
        >
          {{ isPlaying ? '暂停' : '播放' }}
        </el-button>
        <el-button :disabled="!canPlayPrevious" @click="bgm.playPreviousTrack()">上一首</el-button>
        <el-button :disabled="!canPlayNext" @click="bgm.playNextTrack()">下一首</el-button>
      </div>
    </aside>

    <!-- 最小化条 -->
    <div
      v-else-if="showMiniPlayer && minimized"
      ref="panelRef"
      class="bgm-mini-player bgm-mini-player--collapsed"
      :class="{ 'bgm-mini-player--dragging': dragging }"
      :style="panelStyle"
      role="region"
      aria-label="背景音乐（已最小化）"
    >
      <div
        class="bgm-mini-player__collapsed-drag"
        title="拖动移动位置"
        @pointerdown="onDragStart"
      >
        <span class="bgm-mini-player__collapsed-title">背景音乐</span>
        <span v-if="selectedTrack" class="bgm-mini-player__collapsed-track">
          {{ selectedTrack.label }}
        </span>
      </div>
      <div class="bgm-mini-player__collapsed-actions" @pointerdown.stop>
        <el-button
          class="bgm-mini-player__transport-btn"
          circle
          text
          :icon="DArrowLeft"
          :disabled="!canPlayPrevious"
          aria-label="上一首"
          @click="bgm.playPreviousTrack()"
        />
        <el-button
          class="bgm-mini-player__play-btn"
          type="primary"
          circle
          :disabled="!selectedTrackId"
          :aria-label="isPlaying ? '暂停' : '播放'"
          @click="onToggle"
        >
          <span v-if="isPlaying" class="bgm-mini-player__pause-glyphs" aria-hidden="true">
            <i /><i />
          </span>
          <el-icon v-else class="bgm-mini-player__play-icon"><CaretRight /></el-icon>
        </el-button>
        <el-button
          class="bgm-mini-player__transport-btn"
          circle
          text
          :icon="DArrowRight"
          :disabled="!canPlayNext"
          aria-label="下一首"
          @click="bgm.playNextTrack()"
        />
        <el-button class="bgm-mini-player__expand-btn" text @click="toggleMinimized">
          展开
        </el-button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.bgm-mini-player {
  position: fixed;
  z-index: 3000;
  width: min(320px, calc(100vw - 32px));
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--app-border-soft);
  background: var(--app-surface);
  box-shadow:
    0 12px 32px rgba(15, 23, 42, 0.14),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  touch-action: none;
}

.bgm-mini-player--dragging {
  user-select: none;
  cursor: grabbing;
}

.bgm-mini-player--collapsed {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(420px, calc(100vw - 24px));
  padding: 8px 12px;
  min-height: 52px;
  box-sizing: border-box;
}

.bgm-mini-player__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.bgm-mini-player__head--drag {
  cursor: grab;
  margin: -4px -6px 6px;
  padding: 4px 6px;
  border-radius: 8px;
}

.bgm-mini-player__head--drag:hover {
  background: var(--app-surface-alt);
}

.bgm-mini-player--dragging .bgm-mini-player__head--drag,
.bgm-mini-player--dragging .bgm-mini-player__collapsed-drag {
  cursor: grabbing;
}

.bgm-mini-player__kicker {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--app-text-muted);
}

.bgm-mini-player__head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.bgm-mini-player__icon-btn {
  flex-shrink: 0;
}

.bgm-mini-player__label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--app-text-muted);
}

.bgm-mini-player__select {
  width: 100%;
}

.bgm-mini-player__select :deep(.el-select__wrapper) {
  min-height: 36px;
  background-color: var(--app-surface-alt);
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.bgm-mini-player__current {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--app-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bgm-mini-player__current-name {
  font-weight: 600;
  color: var(--app-text);
}

.bgm-mini-player__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--app-text-muted);
  line-height: 1.45;
}

.bgm-mini-player__dot {
  opacity: 0.6;
}

.bgm-mini-player__transport {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.bgm-mini-player__transport .el-button {
  margin: 0;
  flex: 1;
  min-width: 72px;
}

.bgm-mini-player__play {
  flex: 1.2;
  min-width: 88px;
}

.bgm-mini-player__collapsed-drag {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 40px;
  cursor: grab;
  padding: 2px 4px;
  border-radius: 6px;
}

.bgm-mini-player__collapsed-drag:hover {
  background: var(--app-surface-alt);
}

.bgm-mini-player__collapsed-title {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--app-text-muted);
  letter-spacing: 0.04em;
}

.bgm-mini-player__collapsed-track {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bgm-mini-player__collapsed-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  height: 40px;
}

.bgm-mini-player__collapsed-actions :deep(.el-button) {
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}

.bgm-mini-player__transport-btn {
  flex-shrink: 0;
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
}

.bgm-mini-player__transport-btn :deep(.el-icon) {
  font-size: 18px;
}

.bgm-mini-player__play-btn {
  flex-shrink: 0;
  width: 40px !important;
  height: 40px !important;
  min-width: 40px !important;
  padding: 0 !important;
}

.bgm-mini-player__play-btn :deep(> span) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  margin: 0;
}

.bgm-mini-player__play-icon {
  font-size: 24px;
}

.bgm-mini-player__play-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.bgm-mini-player__pause-glyphs {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 24px;
  height: 24px;
  color: #fff;
}

.bgm-mini-player__pause-glyphs i {
  display: block;
  width: 4px;
  height: 18px;
  border-radius: 1px;
  background: currentColor;
}

.bgm-mini-player__expand-btn {
  height: 32px !important;
  padding: 0 8px !important;
  font-size: 13px;
  line-height: 32px;
}
</style>

<style>
.bgm-mini-player__popper {
  z-index: 3100 !important;
}
</style>
