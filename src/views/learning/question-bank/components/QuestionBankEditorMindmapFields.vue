<script setup lang="ts">
import { nextTick, ref } from 'vue'
import MarkmapSvgPreview from './MarkmapSvgPreview.vue'

const content = defineModel<string>('content', { required: true })
const title = defineModel<string>('title', { required: true })

const markmapPreviewRef = ref<InstanceType<typeof MarkmapSvgPreview> | null>(null)

const redrawMindmap = () => {
  void nextTick(() => markmapPreviewRef.value?.draw())
}

/** 去掉常见扩展名，用作题目名称 */
const titleFromImportedFileName = (fileName: string) => {
  const raw = fileName.trim()
  if (!raw) return ''
  const noExt = raw.replace(/\.[^./\\]+$/i, '').trim()
  return noExt || raw
}

const onMindmapTxtImport = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    content.value = String(reader.result ?? '')
    title.value = titleFromImportedFileName(file.name)
    input.value = ''
    redrawMindmap()
  }
  reader.readAsText(file, 'UTF-8')
}

defineExpose({ draw: redrawMindmap })
</script>

<template>
  <div class="mindmap-import-block">
    <span class="field-label">思维导图文件导入（.txt）</span>
    <input
      type="file"
      class="mindmap-file-input"
      accept=".txt,text/plain"
      @change="onMindmapTxtImport"
    />
    <p class="field-hint">
      选择 UTF-8 文本文件后将覆盖下方「思维导图文字」，并把「题目名称」设为该文件名（不含扩展名）。
    </p>
  </div>
  <label>
    <span>思维导图文字</span>
    <textarea
      v-model="content"
      class="mindmap-textarea"
      spellcheck="false"
      placeholder="使用 Markdown 标题层级（#、##、###）描述节点结构，与「思维导图」工具一致"
    />
  </label>
  <div class="mindmap-render-block">
    <div class="mindmap-render-head">
      <span class="field-label">思维导图渲染预览</span>
      <el-button type="primary" plain size="small" @click="redrawMindmap">渲染思维导图</el-button>
    </div>
    <MarkmapSvgPreview ref="markmapPreviewRef" :markdown="content" :live="false" />
  </div>
</template>

<style scoped>
.field-label {
  color: var(--app-text-muted);
  font-size: 13px;
}

.field-hint {
  margin: 0;
  font-size: 12px;
  color: var(--app-text-muted);
}

.mindmap-import-block {
  display: grid;
  gap: 8px;
}

.mindmap-file-input {
  font-size: 13px;
}

.mindmap-textarea {
  width: 100%;
  min-height: 200px;
  resize: vertical;
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  background: var(--app-surface);
  color: inherit;
  box-sizing: border-box;
}

.mindmap-render-block {
  display: grid;
  gap: 10px;
}

.mindmap-render-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
