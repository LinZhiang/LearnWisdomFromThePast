<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import MarkdownProsePreview from '@/components/MarkdownProsePreview.vue'
import MarkdownSourceEditor from '@/components/MarkdownSourceEditor.vue'
import { markdownToSafeHtml } from '@/utils/markdownToHtml'
import {
  PREVIEW_DOCUMENT_ACCEPT,
  readPreviewDocumentFile,
} from '@/utils/readPreviewDocument'

const sourceMd = ref('')
const loadedFileName = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const previewHtml = computed(() => markdownToSafeHtml(sourceMd.value))

const hasPreview = computed(() => Boolean(previewHtml.value))

function triggerUpload() {
  fileInputRef.value?.click()
}

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await readPreviewDocumentFile(file)
    sourceMd.value = text
    loadedFileName.value = file.name
    ElMessage.success(`已载入：${file.name}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '读取文件失败'
    ElMessage.error(msg)
  }
}

function clearAll() {
  sourceMd.value = ''
  loadedFileName.value = ''
}

async function copyMarkdown() {
  const text = sourceMd.value
  if (!text.trim()) {
    ElMessage.warning('当前没有可复制的内容。')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制 Markdown / 文本')
  } catch {
    ElMessage.error('复制失败，请手动全选复制。')
  }
}
</script>

<template>
  <section class="md-preview-page">
    <header class="page-hero">
      <span class="page-kicker">工具 03</span>
      <h2 class="page-title">Markdown 预览</h2>
      <p class="page-subtitle">
        在左侧输入或粘贴 Markdown，也可上传 <strong>.md / .txt / .docx</strong> 文件（旧版
        <strong>.doc</strong> 请先另存为 docx）。右侧实时显示渲染效果；纯文本会按段落显示，可在左侧补上
        <code>#</code> 标题等 Markdown 语法。
      </p>
    </header>

    <div class="md-preview-grid">
      <div class="md-preview-panel">
        <header class="md-preview-panel-head">
          <h3 class="md-preview-panel-title">源文本</h3>
          <p v-if="loadedFileName" class="md-preview-file-tag">已载入：{{ loadedFileName }}</p>
          <p v-else class="md-preview-panel-hint">支持直接编辑、粘贴截图；上传后内容会显示在下方。</p>
        </header>
        <div class="md-preview-panel-body">
          <MarkdownSourceEditor
            v-model="sourceMd"
            class="md-preview-source"
            min-height="100%"
          />
        </div>
        <footer class="md-preview-panel-foot">
          <input
            ref="fileInputRef"
            type="file"
            class="md-preview-file-input"
            :accept="PREVIEW_DOCUMENT_ACCEPT"
            @change="onFileChange"
          />
          <el-button type="primary" plain @click="triggerUpload">上传文件</el-button>
          <el-button plain :disabled="!sourceMd.trim()" @click="copyMarkdown">复制文本</el-button>
          <el-button plain :disabled="!sourceMd && !loadedFileName" @click="clearAll">清空</el-button>
        </footer>
      </div>

      <div class="md-preview-panel">
        <header class="md-preview-panel-head">
          <h3 class="md-preview-panel-title">预览</h3>
          <p class="md-preview-panel-hint">由 Markdown 渲染；无内容时显示占位说明。</p>
        </header>
        <div class="md-preview-panel-body md-preview-panel-body--preview">
          <MarkdownProsePreview v-if="hasPreview" class="md-preview-render" :html="previewHtml" />
          <p v-else class="md-preview-empty">在左侧输入内容或上传文件后，这里会显示预览。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.md-preview-page {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 4px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.page-hero {
  flex-shrink: 0;
}

.page-subtitle {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.page-subtitle code {
  font-size: 0.92em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--app-surface-alt);
}

.md-preview-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: stretch;
  overflow: hidden;
}

@media (max-width: 960px) {
  .md-preview-grid {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }
}

.md-preview-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface);
  min-width: 0;
}

.md-preview-panel-head {
  flex-shrink: 0;
  margin-bottom: 12px;
}

.md-preview-panel-title {
  margin: 0 0 6px;
  font-size: 1.05rem;
  font-weight: 600;
}

.md-preview-panel-hint,
.md-preview-file-tag {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.md-preview-file-tag {
  color: var(--el-color-primary);
  font-weight: 500;
}

.md-preview-panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.md-preview-source {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.md-preview-source :deep(.md-source-editor) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.md-preview-source :deep(.md-source-editor__textarea) {
  flex: 1;
  min-height: 120px;
  height: 100%;
  resize: none;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.md-preview-panel-body--preview {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 14px 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  background: var(--app-surface-alt);
}

.md-preview-empty {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-muted);
  line-height: 1.6;
}

.md-preview-render {
  font-size: var(--app-handout-font-size, 14px);
  line-height: var(--app-handout-line-height, 1.65);
  color: var(--app-text);
  word-break: break-word;
}

.md-preview-render.prose :deep(h1),
.md-preview-render.prose :deep(h2),
.md-preview-render.prose :deep(h3),
.md-preview-render.prose :deep(h4) {
  margin: 0.75em 0 0.4em;
  line-height: 1.35;
}

.md-preview-render.prose :deep(h1) {
  font-size: 1.5rem;
}

.md-preview-render.prose :deep(h2) {
  font-size: 1.25rem;
}

.md-preview-render.prose :deep(p),
.md-preview-render.prose :deep(li) {
  margin: 0.4em 0;
}

.md-preview-render.prose :deep(ul),
.md-preview-render.prose :deep(ol) {
  padding-left: 1.4em;
}

.md-preview-render.prose :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.25em 0 0.25em 12px;
  border-left: 3px solid var(--el-color-primary);
  color: var(--app-text-muted);
}

.md-preview-render.prose :deep(code) {
  font-size: 0.9em;
  padding: 0.12em 0.35em;
  border-radius: 4px;
  background: var(--app-surface);
}

.md-preview-render.prose :deep(pre) {
  margin: 0.6em 0;
  padding: 0.65em 0.85em;
  overflow: auto;
  border-radius: 8px;
  background: var(--app-surface);
  font-size: 1em;
  line-height: 1.55;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace;
  white-space: pre;
}

.md-preview-render.prose :deep(pre code) {
  font-size: inherit;
  padding: 0;
  background: transparent;
}

.md-preview-render.prose :deep(a) {
  color: var(--el-color-primary);
}

.md-preview-render.prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.6em 0;
  font-size: 1em;
}

.md-preview-render.prose :deep(th),
.md-preview-render.prose :deep(td) {
  border: 1px solid var(--app-border-soft);
  padding: 0.45em 0.65em;
  font-size: inherit;
  line-height: 1.5;
}

.md-preview-render.prose :deep(strong) {
  font-weight: 700;
}

.md-preview-panel-foot {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border-soft);
}

.md-preview-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
