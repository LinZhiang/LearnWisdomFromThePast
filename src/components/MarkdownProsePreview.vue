<script setup lang="ts">
defineProps<{
  html: string
}>()
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown-prose-preview" v-html="html" />
</template>

<style scoped>
.markdown-prose-preview {
  font-size: var(--app-handout-font-size, 14px);
  line-height: var(--app-handout-line-height, 1.65);
  color: var(--app-text);
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
  /* 内嵌图尺寸见 styles/markdown-embed-images.css */
}

.markdown-prose-preview :deep(p),
.markdown-prose-preview :deep(li),
.markdown-prose-preview :deep(.md-sync-line) {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
}

/* 逐行预览：一行源码对应一个块，供滚动联动测量真实高度 */
.markdown-prose-preview :deep(.md-sync-line) {
  margin: 0;
  padding: 0;
}

.markdown-prose-preview :deep(.md-sync-line > :first-child) {
  margin-top: 0.35em;
}

.markdown-prose-preview :deep(.md-sync-line > :last-child) {
  margin-bottom: 0.35em;
}

.markdown-prose-preview :deep(.md-sync-line:first-child > :first-child) {
  margin-top: 0;
}

.markdown-prose-preview :deep(.md-sync-empty-line) {
  display: block;
  height: 0;
  overflow: hidden;
  visibility: hidden;
}

.markdown-prose-preview :deep(h1),
.markdown-prose-preview :deep(h2),
.markdown-prose-preview :deep(h3),
.markdown-prose-preview :deep(h4) {
  margin: 0.75em 0 0.4em;
  line-height: 1.35;
  font-weight: 700;
}

.markdown-prose-preview :deep(h1) {
  font-size: 1.5em;
}

.markdown-prose-preview :deep(h2) {
  font-size: 1.25em;
}

.markdown-prose-preview :deep(h3) {
  font-size: 1.1em;
}

.markdown-prose-preview :deep(h4) {
  font-size: 1.02em;
}

.markdown-prose-preview :deep(p),
.markdown-prose-preview :deep(li) {
  margin: 0.4em 0;
}

.markdown-prose-preview :deep(ul),
.markdown-prose-preview :deep(ol) {
  padding-left: 1.4em;
}

.markdown-prose-preview :deep(ul ul),
.markdown-prose-preview :deep(ol ol),
.markdown-prose-preview :deep(ul ol),
.markdown-prose-preview :deep(ol ul) {
  margin: 0.2em 0;
}

.markdown-prose-preview :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.25em 0 0.25em 12px;
  border-left: 3px solid var(--el-color-primary);
  color: var(--app-text-muted);
}

.markdown-prose-preview :deep(code) {
  font-size: 0.95em;
  padding: 0.12em 0.35em;
  border-radius: 4px;
  background: var(--app-surface-alt);
}

.markdown-prose-preview :deep(pre) {
  margin: 0.6em 0;
  padding: 0.65em 0.85em;
  overflow: auto;
  border-radius: 8px;
  background: var(--app-surface-alt);
  font-size: 1em;
  line-height: 1.55;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace;
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
}

.markdown-prose-preview :deep(pre code) {
  font-size: inherit;
  padding: 0;
  background: transparent;
}

.markdown-prose-preview :deep(a) {
  color: var(--el-color-primary);
}

.markdown-prose-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.6em 0;
  font-size: 1em;
}

.markdown-prose-preview :deep(th),
.markdown-prose-preview :deep(td) {
  border: 1px solid var(--app-border-soft);
  padding: 0.45em 0.65em;
  font-size: inherit;
  line-height: 1.5;
}

.markdown-prose-preview :deep(strong) {
  font-weight: 700;
}

.markdown-prose-preview :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid var(--app-border-soft);
}

/* KaTeX：与豆包等一致的行内/块级公式 */
.markdown-prose-preview :deep(.katex) {
  font-size: 1.05em;
}

.markdown-prose-preview :deep(.katex-display) {
  display: block;
  margin: 0.65em 0;
  overflow-x: auto;
  overflow-y: hidden;
  text-align: center;
}
</style>
