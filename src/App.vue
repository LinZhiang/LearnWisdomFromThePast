<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { APP_NAME, APP_TAGLINE } from '@/constants/branding'
import { learningMenuItems } from '@/constants/learning-menu'
import { useWebUsageTracker } from '@/composables/useWebUsageTracker'
import { useAppearanceStore } from '@/stores/appearance'
import { applyDailyStudyingPenaltyIfNeeded } from '@/views/learning/question-bank-score/wen-wu-study-mode'
import BackgroundMusicMiniPlayer from '@/components/BackgroundMusicMiniPlayer.vue'
import { useBackgroundMusicStore } from '@/stores/background-music'

useWebUsageTracker()

const route = useRoute()
const hideMainNav = computed(() => route.name === 'wen-wu-rank')
const immersivePage = computed(() => route.name === 'wen-wu-rank')

watch(
  () => route.fullPath,
  () => {
    applyDailyStudyingPenaltyIfNeeded()
  },
  { immediate: true },
)

const appearanceStore = useAppearanceStore()
const { shellClass, shellStyle, chromeSurfaceStyle, themeStyle } = storeToRefs(appearanceStore)

const backgroundMusicStore = useBackgroundMusicStore()
onMounted(() => {
  backgroundMusicStore.ensureInitialized()
})

const appShellInlineStyle = computed(() => ({
  ...shellStyle.value,
  ...chromeSurfaceStyle.value,
}))

watchEffect(() => {
  void themeStyle.value
  appearanceStore.applyThemeToDocument()
})

onBeforeUnmount(() => {
  for (const el of [document.documentElement, document.body]) {
    el.classList.remove('app-theme-light', 'app-theme-dark', 'app-theme-soft')
  }
})
</script>

<template>
  <div class="app-shell" :class="shellClass" :style="appShellInlineStyle">
    <header class="top-nav">
      <div class="brand" aria-label="温故智学网">
        <img class="brand-logo" src="/favicon.svg" width="40" height="40" alt="" />
        <div class="brand-meta">
          <h1 class="brand-title">{{ APP_NAME }}</h1>
          <p class="brand-tagline">{{ APP_TAGLINE }}</p>
        </div>
      </div>
      <nav v-show="!hideMainNav">
        <RouterLink v-for="item in learningMenuItems" :key="item.key" :to="item.path">
          {{ item.title }}
        </RouterLink>
      </nav>
    </header>
    <main class="page-content" :class="{ 'page-content--immersive': immersivePage }">
      <div class="page-viewport">
        <RouterView />
      </div>
    </main>
    <BackgroundMusicMiniPlayer />
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
}

.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.top-nav nav {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.top-nav a {
  color: var(--app-text-muted);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.top-nav a.router-link-active {
  color: var(--app-primary);
  font-weight: 600;
  background: var(--app-primary-soft);
}

.page-content {
  padding: 20px;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

</style>
