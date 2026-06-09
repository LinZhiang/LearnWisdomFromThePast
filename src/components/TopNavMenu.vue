<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageFocusToggle from '@/components/PageFocusToggle.vue'
import WrongBookDueNotice from '@/components/WrongBookDueNotice.vue'
import { useWrongBookDueStore } from '@/stores/wrong-book-due'
import {
  guideMenuItem,
  learningMenuGroups,
  settingsMenuItem,
  type LearningMenuGroup,
  type LearningMenuItem,
} from '@/constants/learning-menu'

const route = useRoute()
const router = useRouter()
const wrongBookDueStore = useWrongBookDueStore()
const { dueCount } = storeToRefs(wrongBookDueStore)

function dueBadgeText(count: number): string {
  if (count > 99) return '99+'
  return String(count)
}

type NavEntry =
  | { kind: 'group'; group: LearningMenuGroup }
  | { kind: 'guide' }
  | { kind: 'settings' }

/** 顶栏顺序：三个二级菜单 → 操作说明 → 设置 */
const navEntries = computed<NavEntry[]>(() => [
  ...learningMenuGroups.map((group) => ({ kind: 'group' as const, group })),
  { kind: 'guide' as const },
  { kind: 'settings' as const },
])

function normalizePath(path: string): string {
  return (path.split('?')[0] ?? path).split('#')[0] ?? path
}

function isItemActive(item: LearningMenuItem): boolean {
  const current = normalizePath(route.path)
  const target = normalizePath(item.path)
  return current === target || current.startsWith(`${target}/`)
}

function isGroupActive(group: LearningMenuGroup): boolean {
  return group.children.some((child) => isItemActive(child))
}

const guideActive = computed(() => isItemActive(guideMenuItem))
const settingsActive = computed(() => isItemActive(settingsMenuItem))

function go(path: string) {
  void router.push(path)
}
</script>

<template>
  <nav class="top-nav-menu" aria-label="主菜单">
    <WrongBookDueNotice class="top-nav-menu__due" />
    <template
      v-for="entry in navEntries"
      :key="entry.kind === 'group' ? entry.group.key : entry.kind"
    >
      <el-dropdown
        v-if="entry.kind === 'group'"
        trigger="hover"
        placement="bottom-end"
        :show-timeout="80"
        :hide-timeout="120"
        popper-class="top-nav-menu-popper"
      >
        <button
          type="button"
          class="top-nav-menu__trigger"
          :class="{ 'is-active': isGroupActive(entry.group) }"
          :aria-expanded="isGroupActive(entry.group)"
          :aria-haspopup="true"
        >
          <span>{{ entry.group.title }}</span>
          <el-icon class="top-nav-menu__caret" aria-hidden="true"><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="child in entry.group.children"
              :key="child.key"
              :class="{ 'is-route-active': isItemActive(child) }"
              @click="go(child.path)"
            >
              <span class="top-nav-menu__item-label">
                <span>{{ child.title }}</span>
                <span
                  v-if="child.key === 'wrong-book' && dueCount > 0"
                  class="top-nav-menu__badge"
                  :title="`有 ${dueCount} 道题待复习`"
                >
                  {{ dueBadgeText(dueCount) }}
                </span>
              </span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <RouterLink
        v-else-if="entry.kind === 'guide'"
        :to="guideMenuItem.path"
        class="top-nav-menu__link"
        :class="{ 'is-active': guideActive }"
      >
        {{ guideMenuItem.title }}
      </RouterLink>

      <RouterLink
        v-else
        :to="settingsMenuItem.path"
        class="top-nav-menu__link"
        :class="{ 'is-active': settingsActive }"
      >
        {{ settingsMenuItem.title }}
      </RouterLink>
    </template>
    <span class="top-nav-menu__focus">
      <PageFocusToggle size="small" icon-only variant="browser" />
    </span>
  </nav>
</template>

<style scoped>
.top-nav-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.top-nav-menu__trigger,
.top-nav-menu__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: var(--app-text-muted);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1.4;
}

.top-nav-menu__trigger:hover,
.top-nav-menu__link:hover {
  color: var(--app-primary);
  background: var(--app-primary-soft);
}

.top-nav-menu__trigger.is-active,
.top-nav-menu__link.is-active {
  color: var(--app-primary);
  font-weight: 600;
  background: var(--app-primary-soft);
}

.top-nav-menu__caret {
  font-size: 12px;
  opacity: 0.75;
}

.top-nav-menu__due {
  flex-shrink: 0;
  margin-right: 2px;
}

.top-nav-menu__focus {
  margin-left: 4px;
}

.top-nav-menu__item-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.top-nav-menu__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--el-color-warning);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}
</style>

<style>
.top-nav-menu-popper .el-dropdown-menu__item.is-route-active {
  color: var(--el-color-primary);
  font-weight: 600;
  background: var(--el-color-primary-light-9);
}
</style>
