<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  collapseEmbeddedImages as collapseDataImagesInMarkdown,
  expandEmbeddedImages,
  formatEmbedChipLabel,
  listEmbedRefsInText,
  mapCursorAfterTextChange,
  sameEmbedStore,
} from '@/utils/markdownEmbeddedImages'
import {
  buildMarkdownImageLine,
  insertMarkdownImageAtTextarea,
  insertTextIntoTextarea,
  processMarkdownEditorPaste,
  readImageFileAsDataUrl,
  shouldInterceptMarkdownPaste,
} from '@/utils/markdownImageInsert'

const props = withDefaults(
  defineProps<{
    placeholder?: string
    minHeight?: string
    fillHeight?: boolean
    /** 左侧编辑区将 data:image 内嵌图折叠为一行短标记 */
    collapseEmbeddedImages?: boolean
  }>(),
  {
    placeholder:
      '支持 Markdown。可 Ctrl+V 粘贴截图；从豆包等复制带图内容后 Ctrl+V。',
    minHeight: '220px',
    fillHeight: false,
    collapseEmbeddedImages: false,
  },
)

const content = defineModel<string>({ required: true })

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const pasting = ref(false)

const editorText = ref('')
const embedStore = ref<string[]>([])
/** 避免 pushToModel → content 变化 → pullFromModel 把光标冲到文末 */
let skipContentPull = false
let syncing = false

function expandedFromEditor(): string {
  return expandEmbeddedImages(editorText.value, embedStore.value)
}

function syncFromParent(md: string, restoreCursor = true) {
  if (!props.collapseEmbeddedImages) return
  const ta = textareaRef.value
  const selStart = ta?.selectionStart ?? 0
  const selEnd = ta?.selectionEnd ?? selStart
  const oldText = editorText.value

  const { text, embeds } = collapseDataImagesInMarkdown(md, embedStore.value)
  const textChanged = text !== oldText
  const embedsChanged = !sameEmbedStore(embeds, embedStore.value)
  if (!textChanged && !embedsChanged) return

  syncing = true
  if (textChanged) editorText.value = text
  if (embedsChanged) embedStore.value = embeds
  void nextTick(() => {
    syncing = false
    if (restoreCursor && textChanged && ta) {
      ta.selectionStart = mapCursorAfterTextChange(oldText, text, selStart)
      ta.selectionEnd = mapCursorAfterTextChange(oldText, text, selEnd)
    }
  })
}

function pushToModel() {
  if (!props.collapseEmbeddedImages || syncing) return
  const expanded = expandedFromEditor()
  if (expanded === content.value) return
  skipContentPull = true
  syncing = true
  content.value = expanded
  void nextTick(() => {
    skipContentPull = false
    syncing = false
  })
}

/** 粘贴/插入后写入模型，并折叠内嵌图、清理误粘贴的裸 base64 */
function applyFullMarkdown(md: string, cursorAfter?: number) {
  if (!props.collapseEmbeddedImages) {
    content.value = md
    return
  }
  const ta = textareaRef.value
  const { text, embeds } = collapseDataImagesInMarkdown(md, embedStore.value)
  skipContentPull = true
  syncing = true
  editorText.value = text
  embedStore.value = embeds
  content.value = expandEmbeddedImages(text, embeds)
  void nextTick(() => {
    skipContentPull = false
    syncing = false
    if (ta != null && cursorAfter != null) {
      const pos = Math.min(Math.max(0, cursorAfter), text.length)
      ta.selectionStart = pos
      ta.selectionEnd = pos
    }
  })
}

watch(
  () => content.value,
  (md) => {
    if (!props.collapseEmbeddedImages || skipContentPull || syncing) return
    if (expandedFromEditor() === md) return
    syncFromParent(md)
  },
  { immediate: true },
)

watch(editorText, () => {
  pushToModel()
})

watch(
  embedStore,
  () => {
    pushToModel()
  },
  { deep: true },
)

watch(
  () => props.collapseEmbeddedImages,
  (on) => {
    if (on) syncFromParent(content.value, false)
  },
)

const textareaModel = computed({
  get: () => (props.collapseEmbeddedImages ? editorText.value : content.value),
  set: (v: string) => {
    if (props.collapseEmbeddedImages) {
      editorText.value = v
    } else {
      content.value = v
    }
  },
})

const embedChips = computed(() => {
  if (!props.collapseEmbeddedImages) return []
  const refs = listEmbedRefsInText(editorText.value)
  const unique = new Map<number, string>()
  for (const r of refs) {
    if (!unique.has(r.index)) unique.set(r.index, r.alt)
  }
  return [...unique.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, alt]) => ({
      index,
      label: formatEmbedChipLabel(index, alt, embedStore.value[index] ?? ''),
    }))
    .filter((c) => embedStore.value[c.index])
})

function textareaInsertBase(): string {
  return props.collapseEmbeddedImages ? editorText.value : content.value
}

async function readPlainFromClipboard(event: ClipboardEvent): Promise<string> {
  const fromEvent = event.clipboardData?.getData('text/plain') ?? ''
  if (fromEvent) return fromEvent
  try {
    return (await navigator.clipboard.readText()) ?? ''
  } catch {
    return ''
  }
}

function pastePlainAtCursor(ta: HTMLTextAreaElement, plain: string) {
  const { next, cursor } = insertTextIntoTextarea(ta, textareaInsertBase(), plain)
  if (props.collapseEmbeddedImages) {
    applyFullMarkdown(expandEmbeddedImages(next, embedStore.value), cursor)
  } else {
    content.value = next
    focusTa(ta, cursor)
  }
}

async function applyImageFile(file: File) {
  const ta = textareaRef.value
  if (!ta) return
  const dataUrl = await readImageFileAsDataUrl(file)
  if (!dataUrl) {
    ElMessage.error('图片读取失败，请换一张图或稍后重试。')
    return
  }

  if (props.collapseEmbeddedImages) {
    const { next, cursor } = insertTextIntoTextarea(
      ta,
      editorText.value,
      buildMarkdownImageLine(dataUrl, '图片'),
    )
    applyFullMarkdown(expandEmbeddedImages(next, embedStore.value), cursor)
  } else {
    const next = await insertMarkdownImageAtTextarea(ta, content.value, file)
    if (!next) {
      ElMessage.error('图片读取失败，请换一张图或稍后重试。')
      return
    }
    content.value = next
  }
  ElMessage.success('已插入图片')
}

function focusTa(ta: HTMLTextAreaElement, pos: number) {
  ta.focus()
  ta.selectionStart = pos
  ta.selectionEnd = pos
}

async function onPaste(event: ClipboardEvent) {
  if (pasting.value) return
  const ta = textareaRef.value
  if (!ta) return

  const interceptImage = shouldInterceptMarkdownPaste(event)
  const interceptAll = props.collapseEmbeddedImages
  if (interceptAll || interceptImage) {
    event.preventDefault()
    event.stopPropagation()
  }

  pasting.value = true
  try {
    const result = await processMarkdownEditorPaste(event, ta, textareaInsertBase())
    if (result.handled && result.nextContent != null) {
      if (props.collapseEmbeddedImages) {
        const pos = ta.selectionStart ?? editorText.value.length
        applyFullMarkdown(expandEmbeddedImages(result.nextContent, embedStore.value), pos)
      } else {
        content.value = result.nextContent
      }
      if (result.message) {
        if (result.message.includes('失败') || result.message.includes('无法')) {
          ElMessage.warning(result.message)
        } else {
          ElMessage.success(result.message)
        }
      }
      return
    }

    if (interceptAll || interceptImage) {
      const plain = await readPlainFromClipboard(event)
      if (plain) {
        pastePlainAtCursor(ta, plain)
      } else if (interceptImage) {
        ElMessage.warning('未能读取剪贴板图片，请重试或改用「插入图片」')
      }
    }
  } finally {
    pasting.value = false
  }
}

function onInsertImageClick() {
  imageInputRef.value?.click()
}

function onImageInputChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void applyImageFile(file)
}

async function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (!file?.type.startsWith('image/')) return
  event.preventDefault()
  await applyImageFile(file)
}

function onDragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes('Files')) {
    event.preventDefault()
  }
}

/** 展开内嵌图，行结构与左侧 textarea 一致，供预览逐行渲染 */
function getSyncExpandedMarkdown(): string {
  const collapsed = props.collapseEmbeddedImages ? editorText.value : content.value
  return props.collapseEmbeddedImages
    ? expandEmbeddedImages(collapsed, embedStore.value)
    : collapsed
}

defineExpose({
  getScrollElement: (): HTMLElement | null => textareaRef.value,
  /** 与 textarea 显示一致的文本（折叠内嵌图时用于滚动联动） */
  getSyncSourceText: (): string =>
    props.collapseEmbeddedImages ? editorText.value : content.value,
  getSyncExpandedMarkdown,
})
</script>

<template>
  <div class="md-source-editor" :class="{ 'md-source-editor--fill': fillHeight }">
    <div class="md-source-editor__toolbar">
      <el-button type="primary" plain size="small" @click="onInsertImageClick">插入图片</el-button>
      <span class="md-source-editor__hint">
        <template v-if="collapseEmbeddedImages">
          内嵌图片在左侧显示为短标记（如 ![图片](:embed:0)），右侧预览仍为完整图片。
        </template>
        <template v-else>
          粘贴截图；或从豆包/网页复制含图内容后 Ctrl+V（将尽量把图片嵌进 Markdown）。
        </template>
      </span>
      <input
        ref="imageInputRef"
        type="file"
        class="md-source-editor__file-input"
        accept="image/*"
        @change="onImageInputChange"
      />
    </div>
    <textarea
      ref="textareaRef"
      v-model="textareaModel"
      class="md-source-editor__textarea"
      :class="{ 'is-collapsed-embed': collapseEmbeddedImages }"
      :style="fillHeight ? undefined : { minHeight }"
      spellcheck="false"
      :placeholder="placeholder"
      @paste.capture="onPaste"
      @drop="onDrop"
      @dragover="onDragOver"
    />
    <ul v-if="embedChips.length" class="md-source-editor__embed-chips">
      <li v-for="chip in embedChips" :key="chip.index" class="md-source-editor__embed-chip">
        {{ chip.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.md-source-editor {
  display: grid;
  gap: 8px;
}

.md-source-editor--fill {
  height: 100%;
  min-height: 200px;
  grid-template-rows: auto minmax(0, 1fr) auto;
  box-sizing: border-box;
}

.md-source-editor--fill .md-source-editor__textarea {
  height: 100%;
  min-height: 160px;
  resize: none;
  overflow-x: auto;
  overflow-y: auto;
  white-space: pre;
  word-wrap: normal;
  overflow-wrap: normal;
  scrollbar-gutter: stable;
  box-sizing: border-box;
}

.md-source-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.md-source-editor__hint {
  font-size: 12px;
  color: var(--app-text-muted);
  line-height: 1.45;
  max-width: 520px;
}

.md-source-editor__file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.md-source-editor__textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--app-handout-font-size, 14px);
  line-height: var(--app-handout-line-height, 1.55);
  background: var(--app-surface);
  color: inherit;
  box-sizing: border-box;
}

.md-source-editor__textarea.is-collapsed-embed {
  font-family: inherit;
}

.md-source-editor__textarea:focus {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 1px;
}

.md-source-editor__embed-chips {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.md-source-editor__embed-chip {
  font-size: 12px;
  line-height: 1.4;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-5);
}
</style>
