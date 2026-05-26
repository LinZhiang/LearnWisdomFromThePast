import { ElMessage, ElMessageBox } from 'element-plus'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  BGM_INSUFFICIENT_MSG,
  bgmBillingCurfewMessage,
  canAffordBgmPlayback,
  getBgmBalance,
  getBgmBillingStatus,
  isBgmBillingCurfew,
  pauseBgmBillingTimer,
  startBgmBillingTimer,
  tickBgmBilling,
} from '@/services/background-music-billing'
import {
  getMusicTrackById,
  getScopePlaylistForMode,
  hasMusicTracks,
  isShufflePlayMode,
  musicTreeData,
  normalizeMusicPlayMode,
  type MusicPlayMode,
  type MusicTreeNode,
} from '@/utils/music-catalog'
import { WEN_WU_SCORES_CHANGED_EVENT } from '@/views/learning/question-bank-score/wen-wu-user-scores'

const PREFS_KEY = 'wen-wu-bgm-prefs-v1'

type BgmPrefs = {
  trackId: string | null
  playMode: MusicPlayMode
}

function loadPrefs(): BgmPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { trackId: null, playMode: 'sequential' }
    const o = JSON.parse(raw) as Partial<BgmPrefs>
    const playMode = normalizeMusicPlayMode(o.playMode)
    const trackId = typeof o.trackId === 'string' && o.trackId ? o.trackId : null
    return { trackId, playMode }
  } catch {
    return { trackId: null, playMode: 'sequential' }
  }
}

function savePrefs(prefs: BgmPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

function pickRandomTrackId(candidates: { id: string }[], excludeId: string): string | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]?.id ?? null
  const others = candidates.filter((t) => t.id !== excludeId)
  const pool = others.length > 0 ? others : candidates
  const pick = pool[Math.floor(Math.random() * pool.length)]
  return pick?.id ?? null
}

let audio: HTMLAudioElement | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null
let globalListenersAttached = false

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
  }
  return audio
}

function stopBillingTick(): void {
  if (tickTimer != null) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

function attachGlobalListeners(): void {
  if (globalListenersAttached || typeof window === 'undefined') return
  globalListenersAttached = true
  window.addEventListener('pagehide', () => {
    stopBillingTick()
    pauseBgmBillingTimer()
    getAudio().pause()
    onExternalPause()
  })
  window.addEventListener(WEN_WU_SCORES_CHANGED_EVENT, () => {
    balanceSyncFromStorage()
  })
}

let balanceSyncFromStorage: () => void = () => {}
let onExternalPause: () => void = () => {}

export const useBackgroundMusicStore = defineStore('background-music', () => {
  const prefs = loadPrefs()
  const selectedTrackId = ref<string | null>(prefs.trackId)
  const playMode = ref<MusicPlayMode>(prefs.playMode)
  const isPlaying = ref(false)
  /** 曾从设置页开始播放后，在全局右上角展示迷你控制器（跨路由） */
  const miniPlayerOpen = ref(false)
  const playHistory = ref<string[]>([])
  const balance = ref(getBgmBalance())
  const billingStatus = ref(getBgmBillingStatus())
  const lastError = ref('')

  const treeData = computed<MusicTreeNode[]>(() => musicTreeData)
  const hasTracks = computed(() => hasMusicTracks())
  const selectedTrack = computed(() => getMusicTrackById(selectedTrackId.value))

  const showMiniPlayer = computed(() => isPlaying.value || miniPlayerOpen.value)

  const navPlaylist = computed(() => {
    const id = selectedTrackId.value
    if (!id) return []
    return getScopePlaylistForMode(id, playMode.value)
  })

  const canPlayPrevious = computed(() => {
    if (!selectedTrackId.value) return false
    if (isShufflePlayMode(playMode.value)) return playHistory.value.length > 0
    return navPlaylist.value.length > 1
  })

  const canPlayNext = computed(() => Boolean(selectedTrackId.value) && navPlaylist.value.length > 0)

  const persistPrefs = () => {
    savePrefs({ trackId: selectedTrackId.value, playMode: playMode.value })
  }

  const refreshBalance = () => {
    balance.value = getBgmBalance()
  }
  balanceSyncFromStorage = refreshBalance
  onExternalPause = () => {
    isPlaying.value = false
    refreshBilling()
  }

  const refreshBilling = () => {
    billingStatus.value = getBgmBillingStatus()
  }

  const startBillingTick = () => {
    stopBillingTick()
    tickTimer = window.setInterval(() => {
      const result = tickBgmBilling()
      refreshBilling()
      refreshBalance()
      if (!result.canContinue) {
        void stopForInsufficientFunds()
      }
    }, 1000)
  }

  async function showInsufficientFunds(): Promise<void> {
    await ElMessageBox.alert(BGM_INSUFFICIENT_MSG, '提示', { confirmButtonText: '好的' })
  }

  async function stopForInsufficientFunds(): Promise<void> {
    lastError.value = BGM_INSUFFICIENT_MSG
    await pausePlayback()
    await showInsufficientFunds()
  }

  async function assertCanStartPlayback(): Promise<boolean> {
    if (canAffordBgmPlayback() && !isBgmBillingCurfew()) {
      return true
    }
    if (isBgmBillingCurfew()) {
      lastError.value = bgmBillingCurfewMessage()
      ElMessage.warning(bgmBillingCurfewMessage())
      return false
    }
    lastError.value = BGM_INSUFFICIENT_MSG
    await showInsufficientFunds()
    return false
  }

  function pushPlayHistory(trackId: string) {
    playHistory.value.push(trackId)
    if (playHistory.value.length > 80) {
      playHistory.value = playHistory.value.slice(-80)
    }
  }

  /** @param manual 手动「下一首」时，循环模式也按列表前进 */
  function pickNextTrackId(manual = false): string | null {
    const currentId = selectedTrackId.value
    if (!currentId) return null

    if (playMode.value === 'loop' && !manual) return currentId

    const playlist = getScopePlaylistForMode(currentId, playMode.value)
    if (playlist.length === 0) return currentId

    if (isShufflePlayMode(playMode.value)) {
      return pickRandomTrackId(playlist, currentId) ?? currentId
    }

    const idx = playlist.findIndex((t) => t.id === currentId)
    const next = playlist[(idx + 1) % playlist.length]
    return next?.id ?? currentId
  }

  function pickPreviousTrackId(): string | null {
    const currentId = selectedTrackId.value
    if (!currentId) return null

    if (isShufflePlayMode(playMode.value)) {
      const prev = playHistory.value.pop()
      return prev ?? null
    }

    const playlist = getScopePlaylistForMode(currentId, playMode.value)
    if (playlist.length <= 1) return null
    const idx = playlist.findIndex((t) => t.id === currentId)
    const prev = playlist[(idx - 1 + playlist.length) % playlist.length]
    return prev?.id ?? null
  }

  async function loadAndPlayTrack(trackId: string): Promise<boolean> {
    const track = getMusicTrackById(trackId)
    if (!track) {
      ElMessage.warning('未找到该曲目，请重新选择')
      return false
    }
    const el = getAudio()
    if (el.src !== track.url) {
      el.src = track.url
    }
    selectedTrackId.value = trackId
    persistPrefs()
    try {
      await el.play()
      isPlaying.value = true
      miniPlayerOpen.value = true
      startBgmBillingTimer()
      startBillingTick()
      refreshBilling()
      return true
    } catch {
      ElMessage.error('无法播放该音频，请检查文件格式或浏览器权限')
      return false
    }
  }

  async function advanceToTrack(
    trackId: string,
    options?: { recordHistory?: boolean },
  ): Promise<boolean> {
    const cur = selectedTrackId.value
    if (options?.recordHistory !== false && cur && cur !== trackId) {
      pushPlayHistory(cur)
    }
    if (!(await assertCanStartPlayback())) return false
    const wasPlaying = isPlaying.value
    if (wasPlaying) {
      return loadAndPlayTrack(trackId)
    }
    selectedTrackId.value = trackId
    persistPrefs()
    return true
  }

  async function playCurrent(): Promise<void> {
    lastError.value = ''
    if (!selectedTrackId.value) {
      ElMessage.info('请先选择一首音乐')
      return
    }
    if (!(await assertCanStartPlayback())) return
    const ok = await loadAndPlayTrack(selectedTrackId.value)
    if (!ok) {
      pauseBgmBillingTimer()
      isPlaying.value = false
      stopBillingTick()
    }
  }

  async function pausePlayback(): Promise<void> {
    stopBillingTick()
    pauseBgmBillingTimer()
    refreshBilling()
    const el = getAudio()
    el.pause()
    isPlaying.value = false
  }

  async function togglePlayback(): Promise<void> {
    if (isPlaying.value) {
      await pausePlayback()
      ElMessage.info('已暂停播放')
      return
    }
    await playCurrent()
  }

  async function playNextTrack(): Promise<void> {
    if (!selectedTrackId.value) {
      ElMessage.info('请先选择一首音乐')
      return
    }
    const nextId = pickNextTrackId(true)
    if (!nextId) return
    if (nextId === selectedTrackId.value && playMode.value === 'loop') {
      await loadAndPlayTrack(nextId)
      return
    }
    const ok = await advanceToTrack(nextId)
    if (!ok) return
    if (!isPlaying.value) {
      await playCurrent()
    }
  }

  async function playPreviousTrack(): Promise<void> {
    if (!selectedTrackId.value) {
      ElMessage.info('请先选择一首音乐')
      return
    }
    const prevId = pickPreviousTrackId()
    if (!prevId) {
      ElMessage.info('没有上一首了')
      return
    }
    const ok = await advanceToTrack(prevId, { recordHistory: false })
    if (!ok) return
    if (!isPlaying.value) {
      await playCurrent()
    }
  }

  function onAudioEnded(): void {
    const nextId = pickNextTrackId(false)
    if (!nextId) return
    void (async () => {
      const cur = selectedTrackId.value
      if (cur && nextId !== cur) pushPlayHistory(cur)
      if (!(await assertCanStartPlayback())) {
        await pausePlayback()
        return
      }
      const ok = await loadAndPlayTrack(nextId)
      if (!ok) await pausePlayback()
    })()
  }

  function initAudioEndedHandler(): void {
    const el = getAudio()
    el.onended = () => onAudioEnded()
  }

  function setSelectedTrackId(id: string | null): void {
    if (id !== selectedTrackId.value) {
      playHistory.value = []
    }
    selectedTrackId.value = id
    persistPrefs()
    if (isPlaying.value && id) {
      void loadAndPlayTrack(id)
    }
  }

  function setPlayMode(mode: MusicPlayMode): void {
    if (playMode.value !== mode) {
      playHistory.value = []
    }
    playMode.value = mode
    persistPrefs()
  }

  function ensureInitialized(): void {
    attachGlobalListeners()
    initAudioEndedHandler()
  }

  function dismissMiniPlayer(): void {
    if (!isPlaying.value) miniPlayerOpen.value = false
  }

  return {
    treeData,
    hasTracks,
    selectedTrackId,
    selectedTrack,
    playMode,
    isPlaying,
    miniPlayerOpen,
    showMiniPlayer,
    canPlayPrevious,
    canPlayNext,
    balance,
    billingStatus,
    lastError,
    refreshBalance,
    refreshBilling,
    setSelectedTrackId,
    setPlayMode,
    playCurrent,
    pausePlayback,
    togglePlayback,
    playNextTrack,
    playPreviousTrack,
    dismissMiniPlayer,
    ensureInitialized,
  }
})
