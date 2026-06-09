<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { APP_NAME, APP_TAGLINE } from '@/constants/branding'
import PomodoroStudyToggle from '@/components/PomodoroStudyToggle.vue'
import TopNavMenu from '@/components/TopNavMenu.vue'
import GuideWelcomeDialog from '@/views/guide/components/GuideWelcomeDialog.vue'
import { hasSeenGuideWelcome } from '@/utils/appGuidePrefs'
import { useWrongBookDueStore } from '@/stores/wrong-book-due'
import { useWebUsageTracker } from '@/composables/useWebUsageTracker'
import { useAppearanceStore } from '@/stores/appearance'
import { applyDailyStudyingPenaltyIfNeeded } from '@/views/learning/question-bank-score/wen-wu-study-mode'
import { usePageFocusStore } from '@/stores/page-focus'
import { usePomodoroStore } from '@/stores/pomodoro'
import { attachMouseShortcutNavigationGuards } from '@/utils/blockMouseShortcutNavigation'

useWebUsageTracker()

const route = useRoute()
const pageFocusStore = usePageFocusStore()
const { isStretch: pageFocusStretch } = storeToRefs(pageFocusStore)

const hideMainNav = computed(() => route.name === 'wen-wu-rank')
/** 查看/测验内页拉伸：隐藏站点顶栏（品牌 + 菜单） */
const hideTopNav = computed(() => pageFocusStretch.value)
const immersivePage = computed(() => route.name === 'wen-wu-rank')
/** 左右分栏页：滚动在列内面板，避免与 page-viewport 叠出双滚动条 */
const SPLIT_PANEL_INTERNAL_SCROLL_ROUTES = new Set([
  'question-bank',
  'question-bank-favorite',
  'wrong-book',
])

/** 滚动条在页面内部面板，而非最外层 page-viewport */
const internalScrollPage = computed(
  () =>
    route.name === 'markdown-preview' ||
    route.name === 'learning-type-edit' ||
    route.name === 'app-guide' ||
    (typeof route.name === 'string' && SPLIT_PANEL_INTERNAL_SCROLL_ROUTES.has(route.name)) ||
    pageFocusStretch.value,
)

watch(
  () => route.fullPath,
  () => {
    applyDailyStudyingPenaltyIfNeeded()
  },
  { immediate: true },
)

const appearanceStore = useAppearanceStore()
const {
  shellClass,
  shellStyle,
  shellTintOverlayStyle,
  shellBackgroundImage,
  shellBackgroundImgStyle,
  chromeSurfaceStyle,
  themeStyle,
} = storeToRefs(appearanceStore)

const wrongBookDueStore = useWrongBookDueStore()
const pomodoroStore = usePomodoroStore()
const showAppWelcome = ref(false)
let detachMouseShortcutGuards: (() => void) | null = null

function onVisibilityRefresh() {
  if (document.visibilityState === 'visible') void wrongBookDueStore.refresh()
}

function onStretchEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !pageFocusStretch.value || !e.isTrusted) return
  e.preventDefault()
  pageFocusStore.exitStretch()
}

onMounted(() => {
  detachMouseShortcutGuards = attachMouseShortcutNavigationGuards()
  pomodoroStore.attachLifecycle()
  pageFocusStore.syncFromBrowserFullscreen()
  document.addEventListener('fullscreenchange', pageFocusStore.syncFromBrowserFullscreen)
  window.addEventListener('keydown', onStretchEscape)
  document.addEventListener('visibilitychange', onVisibilityRefresh)
  void wrongBookDueStore.refresh()
  wrongBookDueStore.startAutoRefresh()
  if (!hasSeenGuideWelcome()) {
    showAppWelcome.value = true
  }
})

watch(
  () => route.path,
  (path) => {
    if (!pageFocusStretch.value) return
    const inApp =
      path.startsWith('/learning') || path.startsWith('/tools') || path.startsWith('/settings')
    if (!inApp) pageFocusStore.exitStretch()
  },
)

watch(
  () => route.path,
  () => {
    void wrongBookDueStore.refresh()
  },
)

const appShellInlineStyle = computed(() => ({
  ...shellStyle.value,
  ...chromeSurfaceStyle.value,
}))

watchEffect(() => {
  void themeStyle.value
  appearanceStore.applyThemeToDocument()
})

onBeforeUnmount(() => {
  detachMouseShortcutGuards?.()
  detachMouseShortcutGuards = null
  pomodoroStore.detachLifecycle()
  document.removeEventListener('fullscreenchange', pageFocusStore.syncFromBrowserFullscreen)
  window.removeEventListener('keydown', onStretchEscape)
  document.removeEventListener('visibilitychange', onVisibilityRefresh)
  wrongBookDueStore.stopAutoRefresh()
  for (const el of [document.documentElement, document.body]) {
    el.classList.remove('app-theme-light', 'app-theme-dark', 'app-theme-soft')
  }
})
</script>

<template>
  <div
    class="app-shell"
    :class="[shellClass, { 'app-shell--page-focus-stretch': pageFocusStretch }]"
    :style="appShellInlineStyle"
  >
    <img
      v-if="shellBackgroundImage"
      class="app-shell__bg-image"
      :src="shellBackgroundImage"
      alt=""
      draggable="false"
      :style="shellBackgroundImgStyle"
    />
    <div class="app-shell__bg-tint" aria-hidden="true" :style="shellTintOverlayStyle" />
    <header v-if="!hideTopNav" class="top-nav">
      <div class="brand" aria-label="温故智学网">
        <img class="brand-logo" src="/favicon.svg" width="40" height="40" alt="" />
        <div class="brand-meta">
          <h1 class="brand-title">{{ APP_NAME }}</h1>
          <p class="brand-tagline">{{ APP_TAGLINE }}</p>
        </div>
        <PomodoroStudyToggle class="brand-pomodoro" />
      </div>
      <TopNavMenu v-if="!hideMainNav" />
    </header>
    <main
      class="page-content"
      :class="{
        'page-content--immersive': immersivePage,
        'page-content--internal-scroll': internalScrollPage,
      }"
    >
      <div class="page-viewport">
        <RouterView />
      </div>
    </main>
    <GuideWelcomeDialog v-model="showAppWelcome" />
  </div>
</template>

<style scoped>
/* 主题色与 Element 变量定义在全局 style.css 的 html/body.app-theme-*，供 Teleport 弹层继承 */
.app-shell {
  color: var(--app-text);
  flex: 1;
  min-height: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  isolation: isolate;
}

.app-shell__bg-image {
  position: fixed;
  z-index: 0;
  pointer-events: none;
}

.app-shell__bg-tint {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.top-nav {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-surface);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-pomodoro {
  flex-shrink: 0;
  margin-left: 4px;
  align-self: center;
}

.brand-logo {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  box-shadow:
    0 2px 10px rgba(37, 99, 235, 0.22),
    0 0 0 1px rgba(255, 255, 255, 0.12) inset;
}

.brand-meta {
  min-width: 0;
}

.brand-title {
  margin: 0;
  font-size: 1.22rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  line-height: 1.15;
  color: #1e3a8a;
}

.app-shell.theme-dark .brand-title {
  color: #f1f5f9;
}

.app-shell.theme-soft .brand-title {
  color: #4338ca;
}

.brand-tagline {
  margin: 3px 0 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--app-text-muted);
  letter-spacing: 0.02em;
}

@media (max-width: 720px) {
  .brand-tagline {
    display: none;
  }

  .brand-title {
    font-size: 1.1rem;
    letter-spacing: 0.06em;
  }
}

.page-content {
  padding: 20px;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 2;
}

.page-content--immersive {
  padding: 12px 16px 20px;
}

.page-viewport {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.page-content--internal-scroll .page-viewport {
  overflow: hidden;
}

.page-content--internal-scroll .page-viewport > * {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

</style>

<style>
/* 内页拉伸全屏：隐藏悬浮背景音乐面板 */
.app-shell--page-focus-stretch .bgm-mini-player {
  display: none !important;
}
</style>
