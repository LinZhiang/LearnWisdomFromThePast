<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { markdownToSafeHtml } from '@/utils/markdownToHtml'
import RichTextEditor from '@/views/learning/question-bank/components/RichTextEditor.vue'
import { isAiChatConfigured, requestLectureNotesFromMaterial } from '@/services/deepseek'
import { hashForAiCache, rememberAiResponse } from '@/utils/aiResponseCache'

const sourceHtml = ref('')
const lectureMd = ref('')
const generating = ref(false)
const generateProgress = ref('')
const showPreview = ref(true)

const lectureHtml = computed(() => markdownToSafeHtml(lectureMd.value))

const generateLecture = async () => {
  const html = sourceHtml.value.trim()
  if (!html || html === '<p><br></p>') {
    ElMessage.warning('请先在左侧粘贴或输入资料（文字、图片、视频链接等）。')
    return
  }
  if (!isAiChatConfigured()) {
    ElMessage.error('当前环境未配置 AI 代理，请查看 docs/ENV-说明.md 并启动 server。')
    return
  }
  generating.value = true
  generateProgress.value = '准备中…'
  try {
    lectureMd.value = await rememberAiResponse(
      `lecture:${hashForAiCache(sourceHtml.value)}`,
      () =>
        requestLectureNotesFromMaterial(sourceHtml.value, {
          onProgress: (msg) => {
            generateProgress.value = msg
          },
        }),
    )
    showPreview.value = true
    ElMessage.success('讲义已生成：图片文字已识别并整理，重点已加粗标出。')
  } catch (e) {
    const msg = e instanceof Error ? e.message : '生成失败'
    ElMessage.error(msg)
  } finally {
    generating.value = false
    generateProgress.value = ''
  }
}

const copyLecture = async () => {
  const text = lectureMd.value
  if (!text.trim()) {
    ElMessage.warning('当前没有可复制的内容。')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('讲义 Markdown 已复制')
  } catch {
    ElMessage.error('复制失败，请手动全选复制。')
  }
}
</script>

<template>
  <section class="material-page">
    <header class="page-hero">
      <span class="page-kicker">工具 02</span>
      <h2 class="page-title">资料整理</h2>
      <p class="page-subtitle">
        粘贴截图或文字，识别后整理成带重点标记的讲义（需联网）。
      </p>
    </header>

    <div class="material-grid">
      <div class="material-panel">
        <header class="material-panel-head">
          <h3 class="material-panel-title">原始资料</h3>
          <p class="material-panel-hint">
            请直接 Ctrl+V 粘贴讲义或 PPT 截图（可多张），也可补充文字说明。
          </p>
        </header>
        <div class="material-panel-body material-panel-body--rich">
          <RichTextEditor
            v-model="sourceHtml"
            class="material-rich-editor"
            placeholder="在此粘贴笔记、网页摘录、讲义草稿…"
            :enable-media-paste="true"
            :enable-video-embed="true"
          />
        </div>
      </div>

      <div class="material-panel">
        <header class="material-panel-head">
          <h3 class="material-panel-title">整理讲义</h3>
          <p class="material-panel-hint">
            先 OCR 图中文字再生成讲义；<strong>**加粗**</strong> 为重点。可编辑或预览。
          </p>
        </header>
        <div class="material-panel-body material-panel-body--split">
          <el-input
            v-model="lectureMd"
            type="textarea"
            :rows="10"
            placeholder="点击「生成讲义」后，整理结果将显示在此…"
            class="material-md-input"
            spellcheck="false"
          />
          <div v-show="showPreview && lectureMd.trim()" class="material-preview-wrap">
            <div class="material-preview-label">重点预览</div>
            <div class="material-preview prose" v-html="lectureHtml" />
          </div>
        </div>
        <footer class="material-panel-foot">
          <el-button
            class="material-panel-btn"
            type="primary"
            :loading="generating"
            :disabled="generating"
            @click="generateLecture"
          >
            {{
              generating && generateProgress
                ? generateProgress
                : '识别图片并生成讲义'
            }}
          </el-button>
          <el-button
            class="material-panel-btn"
            plain
            :disabled="!lectureMd.trim()"
            @click="showPreview = !showPreview"
          >
            {{ showPreview ? '隐藏预览' : '显示预览' }}
          </el-button>
          <el-button class="material-panel-btn" plain :disabled="!lectureMd.trim()" @click="copyLecture">
            复制 Markdown
          </el-button>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
.material-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 4px 24px;
  box-sizing: border-box;
}

.page-subtitle {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.material-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: stretch;
}

@media (max-width: 960px) {
  .material-grid {
    grid-template-columns: 1fr;
  }

  .material-panel {
    min-height: 0;
  }
}

.material-panel {
  display: flex;
  flex-direction: column;
  min-height: 560px;
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface);
  min-width: 0;
}

.material-panel-head {
  flex-shrink: 0;
  margin-bottom: 12px;
}

.material-panel-title {
  margin: 0 0 6px;
  font-size: 1.05rem;
  font-weight: 600;
}

.material-panel-hint {
  margin: 0;
  min-height: 2.5em;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.material-panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-bottom: 12px;
}

.material-panel-body--rich {
  overflow: hidden;
}

.material-rich-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 420px;
}

.material-rich-editor :deep(.rich-editor-wrap) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.material-rich-editor :deep(.ql-container.ql-snow) {
  flex: 1;
  min-height: 320px;
}

.material-rich-editor :deep(.ql-editor) {
  min-height: 300px;
  max-height: min(52vh, 480px);
  overflow-y: auto;
}

.material-panel-body--split {
  gap: 12px;
}

.material-md-input {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.material-md-input :deep(.el-textarea) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.material-md-input :deep(textarea) {
  flex: 1;
  min-height: 200px;
  height: 100% !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  resize: none;
}

.material-preview-wrap {
  flex-shrink: 0;
  max-height: min(28vh, 240px);
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  background: var(--app-surface-alt);
}

.material-preview-label {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.material-preview.prose {
  font-size: var(--app-handout-font-size, 14px);
  line-height: var(--app-handout-line-height, 1.65);
  color: var(--app-text);
}

.material-preview.prose :deep(h1),
.material-preview.prose :deep(h2),
.material-preview.prose :deep(h3) {
  margin: 0.6em 0 0.35em;
  line-height: 1.35;
}

.material-preview.prose :deep(p),
.material-preview.prose :deep(li) {
  margin: 0.35em 0;
}

.material-preview.prose :deep(strong) {
  color: var(--el-color-primary);
  font-weight: 700;
}

.material-panel-foot {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border-soft);
}

.material-panel-foot :deep(.material-panel-btn) {
  height: 32px;
  margin: 0;
  border-radius: 6px;
}
</style>
