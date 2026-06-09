<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useMarkdownSplitScrollSync } from '@/composables/useMarkdownSplitScrollSync'
import {
  MARKDOWN_SPLIT_HEIGHT_PX,
  MARKDOWN_SPLIT_STACKED_PANEL_HEIGHT_PX,
} from '@/constants/markdown-split-layout'
import MarkdownProsePreview from '@/components/MarkdownProsePreview.vue'
import MarkdownSourceEditor from '@/components/MarkdownSourceEditor.vue'
import { markdownToSafeHtmlPerLine } from '@/utils/markdownToHtml'

const content = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    editorPlaceholder?: string
    emptyPreviewText?: string
    /** 左右分栏区域固定高度（像素） */
    splitHeightPx?: number
    /** 左侧将 data:image 折叠为 :embed:N 短标记，避免 base64 占满编辑区 */
    collapseEmbeddedImages?: boolean
  }>(),
  {
    editorPlaceholder:
      '支持 Markdown。可 Ctrl+V 粘贴截图；从豆包等复制带图内容后 Ctrl+V。',
    emptyPreviewText: '在左侧输入或粘贴内容后，这里会显示讲义预览效果。',
    splitHeightPx: MARKDOWN_SPLIT_HEIGHT_PX,
    collapseEmbeddedImages: true,
  },
)

const splitStyle = computed(() => ({
  '--md-split-h': `${props.splitHeightPx}px`,
  '--md-split-panel-h': `${MARKDOWN_SPLIT_STACKED_PANEL_HEIGHT_PX}px`,
}))

const previewHtml = computed(() => {
  const md = sourceEditorRef.value?.getSyncExpandedMarkdown() ?? content.value
  return markdownToSafeHtmlPerLine(md)
})
const hasPreview = computed(() => Boolean(previewHtml.value))

const sourceEditorRef = ref<InstanceType<typeof MarkdownSourceEditor> | null>(null)
const previewBodyRef = ref<HTMLElement | null>(null)

const sourceScrollEl = computed(() => sourceEditorRef.value?.getScrollElement() ?? null)

const { bind: bindScrollSync, scheduleRemeasure } = useMarkdownSplitScrollSync({
  sourceEl: sourceScrollEl,
  previewEl: previewBodyRef,
  getSourceText: () => sourceEditorRef.value?.getSyncSourceText() ?? content.value,
  getPreviewMarkdown: () =>
    sourceEditorRef.value?.getSyncExpandedMarkdown() ?? content.value,
})

function bindAfterLayout() {
  void nextTick(() => {
    bindScrollSync()
    scheduleRemeasure(120)
  })
}

onMounted(bindAfterLayout)

watch(
  () => [sourceScrollEl.value, previewBodyRef.value] as const,
  bindAfterLayout,
  { flush: 'post' },
)

watch(
  () => content.value,
  () => {
    scheduleRemeasure(150)
  },
)

watch(previewHtml, () => {
  scheduleRemeasure(180)
})

/** 保存前取展开后的完整 Markdown（含内嵌图 data URL），并写回 v-model */
function flushContentForSave(): string {
  const md = sourceEditorRef.value?.getSyncExpandedMarkdown() ?? content.value
  if (md !== content.value) {
    content.value = md
  }
  return md
}

defineExpose({
  flushContentForSave,
})
</script>

<template>
  <div class="md-split" :style="splitStyle">
    <div class="md-split__panel md-split__panel--source">
      <header class="md-split__head">
        <div class="md-split__head-text">
          <h4 class="md-split__title">Markdown 编辑</h4>
          <p class="md-split__hint">
            左侧编写（一行一段）；内嵌图为短标记，右侧逐行预览，滚动按行号对齐
          </p>
        </div>
        <div v-if="$slots['source-actions']" class="md-split__head-actions">
          <slot name="source-actions" />
        </div>
      </header>
      <div v-if="$slots['source-extra']" class="md-split__extra">
        <slot name="source-extra" />
      </div>
      <div class="md-split__body">
        <MarkdownSourceEditor
          ref="sourceEditorRef"
          v-model="content"
          :placeholder="editorPlaceholder"
          :collapse-embedded-images="collapseEmbeddedImages"
          fill-height
        />
      </div>
    </div>

    <div class="md-split__panel md-split__panel--preview">
      <header class="md-split__head">
        <div class="md-split__head-text">
          <h4 class="md-split__title">预览</h4>
          <p class="md-split__hint">实时渲染，与保存后详情页效果一致</p>
        </div>
      </header>
      <div ref="previewBodyRef" class="md-split__body md-split__body--preview">
        <MarkdownProsePreview v-if="hasPreview" :html="previewHtml" />
        <p v-else class="md-split__empty">{{ emptyPreviewText }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.md-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  width: 100%;
  height: var(--md-split-h);
  min-height: var(--md-split-h);
  max-height: var(--md-split-h);
  flex: none;
  box-sizing: border-box;
}

.md-split__panel {
  display: flex;
  flex-direction: column;
  height: var(--md-split-h);
  max-height: var(--md-split-h);
  min-width: 0;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface);
  overflow: hidden;
  box-sizing: border-box;
}

.md-split__head {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-surface-alt);
}

.md-split__head-text {
  min-width: 0;
}

.md-split__title {
  margin: 0 0 4px;
  font-size: 1.02rem;
  font-weight: 600;
}

.md-split__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--app-text-muted);
}

.md-split__head-actions {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.md-split__extra {
  flex: 0 0 auto;
  padding: 10px 14px 0;
}

.md-split__body {
  flex: 1 1 auto;
  min-height: 0;
  height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 14px 14px;
  overflow: hidden;
  box-sizing: border-box;
}

.md-split__body--preview {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
  background: var(--app-surface-alt);
}

.md-split__empty {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--app-text-muted);
}

@media (max-width: 960px) {
  .md-split {
    grid-template-columns: 1fr;
    grid-template-rows: var(--md-split-panel-h) var(--md-split-panel-h);
    height: auto;
    min-height: 0;
    max-height: none;
  }

  .md-split__panel {
    height: var(--md-split-panel-h);
    max-height: var(--md-split-panel-h);
  }
}
</style>
