<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  APP_GUIDE_SECTIONS,
  DEFAULT_GUIDE_SELECTION,
  findGuideArticle,
  isGuideSectionSingleArticle,
  type GuideArticle,
  type GuideSection,
} from '@/constants/app-guide-content'
const sections = APP_GUIDE_SECTIONS

const expandedSectionIds = ref<Set<string>>(
  new Set([DEFAULT_GUIDE_SELECTION.sectionId]),
)

const activeSectionId = ref(DEFAULT_GUIDE_SELECTION.sectionId)
const activeArticleId = ref(DEFAULT_GUIDE_SELECTION.articleId)

const activeArticle = computed(() => {
  const hit = findGuideArticle(activeSectionId.value, activeArticleId.value)
  return hit?.article ?? null
})

const activeSection = computed(() => {
  return sections.find((s) => s.id === activeSectionId.value) ?? sections[0]!
})

const breadcrumb = computed(() => {
  const section = activeSection.value
  const article = activeArticle.value
  if (!article) return section.title
  if (isGuideSectionSingleArticle(section)) return section.title
  return `${section.title} · ${article.title}`
})

const mainTitle = computed(() => {
  const section = activeSection.value
  const article = activeArticle.value
  if (!article) return ''
  if (isGuideSectionSingleArticle(section)) return section.title
  return article.title
})

function isSectionExpanded(id: string) {
  return expandedSectionIds.value.has(id)
}

function isSectionActive(section: GuideSection) {
  return activeSectionId.value === section.id
}

function toggleSection(section: GuideSection) {
  const next = new Set(expandedSectionIds.value)
  if (next.has(section.id)) next.delete(section.id)
  else next.add(section.id)
  expandedSectionIds.value = next
}

function onSectionHeaderClick(section: GuideSection) {
  if (isGuideSectionSingleArticle(section)) {
    selectArticle(section, section.articles[0]!)
    return
  }
  toggleSection(section)
}

function selectArticle(section: GuideSection, article: GuideArticle) {
  activeSectionId.value = section.id
  activeArticleId.value = article.id
  const next = new Set(expandedSectionIds.value)
  next.add(section.id)
  expandedSectionIds.value = next
}

function goHomeArticle() {
  selectArticle(sections[0]!, sections[0]!.articles[0]!)
}

watch(activeArticle, (article) => {
  if (!article) return
  document.title = `${article.title} · 操作说明`
})
</script>

<template>
  <section class="guide-page">
    <header class="guide-page__hero">
      <span class="page-kicker">帮助</span>
      <h2 class="page-title">网页操作说明</h2>
      <p class="page-subtitle">
        左侧选择章节，右侧查看分步说明。可随时从顶栏「操作说明」进入本页。
      </p>
    </header>

    <div class="guide-shell">
      <aside class="guide-sidebar" aria-label="说明目录">
        <button type="button" class="guide-sidebar__home" @click="goHomeArticle">
          说明首页
        </button>

        <div v-for="section in sections" :key="section.id" class="guide-sidebar__group">
          <button
            type="button"
            class="guide-sidebar__section"
            :class="{
              'is-expanded': !isGuideSectionSingleArticle(section) && isSectionExpanded(section.id),
              'is-active': isGuideSectionSingleArticle(section) && isSectionActive(section),
            }"
            @click="onSectionHeaderClick(section)"
          >
            <span class="guide-sidebar__diamond" aria-hidden="true">◆</span>
            <span class="guide-sidebar__section-title">{{ section.title }}</span>
            <span
              v-if="!isGuideSectionSingleArticle(section)"
              class="guide-sidebar__caret"
              aria-hidden="true"
            >{{
              isSectionExpanded(section.id) ? '▼' : '▶'
            }}</span>
          </button>
          <ul
            v-if="!isGuideSectionSingleArticle(section)"
            v-show="isSectionExpanded(section.id)"
            class="guide-sidebar__articles"
          >
            <li v-for="article in section.articles" :key="article.id">
              <button
                type="button"
                class="guide-sidebar__article"
                :class="{
                  'is-active':
                    activeSectionId === section.id && activeArticleId === article.id,
                }"
                @click="selectArticle(section, article)"
              >
                {{ article.title }}
              </button>
            </li>
          </ul>
        </div>
      </aside>

      <article v-if="activeArticle" class="guide-main">
        <div class="guide-main__head">
          <p class="guide-main__crumb">{{ breadcrumb }}</p>
          <h3 class="guide-main__title">{{ mainTitle }}</h3>
          <p v-if="activeArticle.summary" class="guide-main__summary">
            {{ activeArticle.summary }}
          </p>
          <nav v-if="activeSection.articles.length > 1" class="guide-main__quick" aria-label="本章快速跳转">
            <button
              v-for="item in activeSection.articles"
              :key="item.id"
              type="button"
              class="guide-main__quick-link"
              :class="{ 'is-active': item.id === activeArticleId }"
              @click="selectArticle(activeSection, item)"
            >
              {{ item.title }}
            </button>
          </nav>
        </div>

        <div class="guide-main__body">
          <template v-for="(block, idx) in activeArticle.blocks" :key="idx">
            <p v-if="block.type === 'p'" class="guide-block guide-block--p">{{ block.text }}</p>
            <h4 v-else-if="block.type === 'h3'" class="guide-block guide-block--h3">
              {{ block.text }}
            </h4>
            <ul v-else-if="block.type === 'ul'" class="guide-block guide-block--ul">
              <li v-for="(line, j) in block.items" :key="j">{{ line }}</li>
            </ul>
            <ol v-else-if="block.type === 'ol'" class="guide-block guide-block--ol">
              <li v-for="(line, j) in block.items" :key="j">{{ line }}</li>
            </ol>
            <p v-else-if="block.type === 'tip'" class="guide-block guide-block--tip">
              <strong>提示：</strong>{{ block.text }}
            </p>
          </template>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.guide-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  gap: 12px;
}

.guide-page__hero {
  flex-shrink: 0;
}

.guide-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
  gap: 0;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  overflow: hidden;
  background: var(--app-surface);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.guide-sidebar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 6px 12px;
  background: linear-gradient(180deg, #3d7a45 0%, #2f6838 100%);
  color: #f8fafc;
  overflow-y: auto;
  min-height: 0;
}

.app-shell.theme-dark .guide-sidebar {
  background: linear-gradient(180deg, #1e4d28 0%, #163820 100%);
}

.guide-sidebar__home {
  margin: 4px 4px 8px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 6px;
  background: linear-gradient(180deg, #5cb368 0%, #449652 100%);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.guide-sidebar__home:hover {
  filter: brightness(1.05);
}

.guide-sidebar__group {
  margin-bottom: 2px;
}

.guide-sidebar__section {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 7px 8px;
  border: none;
  border-radius: 4px;
  background: linear-gradient(180deg, #4a9154 0%, #3a7a44 100%);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.guide-sidebar__section:hover {
  filter: brightness(1.06);
}

.guide-sidebar__section.is-expanded,
.guide-sidebar__section.is-active {
  background: linear-gradient(180deg, #5aa864 0%, #458a50 100%);
}

.guide-sidebar__diamond {
  font-size: 10px;
  opacity: 0.85;
}

.guide-sidebar__section-title {
  flex: 1;
  min-width: 0;
}

.guide-sidebar__caret {
  font-size: 10px;
  opacity: 0.8;
}

.guide-sidebar__articles {
  list-style: none;
  margin: 0;
  padding: 4px 0 6px 8px;
}

.guide-sidebar__article {
  display: block;
  width: 100%;
  margin: 0;
  padding: 5px 8px 5px 14px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  line-height: 1.45;
}

.guide-sidebar__article:hover {
  background: rgba(255, 255, 255, 0.12);
}

.guide-sidebar__article.is-active {
  background: rgba(255, 255, 255, 0.22);
  font-weight: 650;
}

.guide-main {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: #fff;
}

.app-shell.theme-dark .guide-main,
.app-shell.theme-soft .guide-main {
  background: var(--app-surface);
}

.guide-main__head {
  flex-shrink: 0;
  padding: 12px 16px 10px;
  border-bottom: 1px solid var(--app-border-soft);
  background: linear-gradient(90deg, #6b4c9a 0%, #7d5cad 100%);
  color: #fff;
}

.guide-main__crumb {
  margin: 0 0 6px;
  font-size: 12px;
  opacity: 0.9;
}

.guide-main__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 750;
  line-height: 1.35;
}

.guide-main__summary {
  margin: 8px 0 0;
  font-size: 13px;
  opacity: 0.92;
}

.guide-main__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.guide-main__quick-link {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.88);
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}

.guide-main__quick-link.is-active {
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}

.guide-main__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 24px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--app-text);
}

.guide-block {
  margin: 0 0 12px;
}

.guide-block--h3 {
  margin: 18px 0 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text);
}

.guide-block--ul,
.guide-block--ol {
  margin: 0 0 12px;
  padding-left: 1.35rem;
}

.guide-block--ul li,
.guide-block--ol li {
  margin: 0.35em 0;
}

.guide-block--tip {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 40%, var(--app-border-soft));
  background: color-mix(in srgb, var(--el-color-warning-light-9) 80%, var(--app-surface));
  font-size: 13px;
}

@media (max-width: 768px) {
  .guide-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .guide-sidebar {
    max-height: 38vh;
  }
}
</style>
