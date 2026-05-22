<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { nextTick, ref } from 'vue'
import MarkmapSvgPreview from '@/views/learning/question-bank/components/MarkmapSvgPreview.vue'
import { isAiChatConfigured, requestMindmapMarkdownFromSourceText } from '@/services/deepseek'

const sourceText = ref('')
const mindmapMd = ref('')
const generating = ref(false)
const previewRef = ref<InstanceType<typeof MarkmapSvgPreview> | null>(null)

const canUseAi = () => isAiChatConfigured()

const generateFromDeepseek = async () => {
  const src = sourceText.value.trim()
  if (!src) {
    ElMessage.warning('请先在下框粘贴或输入一段较长的学习材料。')
    return
  }
  if (!canUseAi()) {
    ElMessage.error('当前环境未配置 AI 代理，请查看 docs/ENV-说明.md。')
    return
  }
  generating.value = true
  try {
    mindmapMd.value = await requestMindmapMarkdownFromSourceText(sourceText.value)
    await nextTick()
    previewRef.value?.draw()
    ElMessage.success('导图内容已生成，可在下方继续微调 Markdown 后点击「渲染导图」。')
  } catch (e) {
    const msg = e instanceof Error ? e.message : '生成失败'
    ElMessage.error(msg)
  } finally {
    generating.value = false
  }
}

const redrawMindmap = async () => {
  await nextTick()
  previewRef.value?.draw()
}

const copyMindmapMarkdown = async () => {
  const text = mindmapMd.value
  if (!text.trim()) {
    ElMessage.warning('当前没有可复制的内容。')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('导图 Markdown 已复制到剪贴板')
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      if (ok) ElMessage.success('导图 Markdown 已复制到剪贴板')
      else throw new Error('execCommand failed')
    } catch {
      ElMessage.error('复制失败，请手动在文本框中全选后复制。')
    }
  }
}
</script>

<template>
  <section class="mindmap-tool-page">
    <header class="page-hero">
      <span class="page-kicker">工具 01</span>
      <h2 class="page-title">思维导图</h2>
      <p class="page-subtitle">
        在下方粘贴长文，由 DeepSeek
        按「重新划分板块、细分层级、举例与背景、关键词解释、节点前
        emoji、重点加粗」生成 Markdown，并用 markmap 本地渲染。也可直接编辑中间框的 Markdown
        后手动渲染。
      </p>
    </header>

    <div class="mindmap-tool-grid">
      <div class="mindmap-panel mindmap-panel--source">
        <h3 class="mindmap-panel-title">原始材料</h3>
        <p class="mindmap-panel-hint">支持较长文本；超过约 1.8 万字符时会截断后再请求接口。</p>
        <el-input
          v-model="sourceText"
          type="textarea"
          :autosize="{ minRows: 14, maxRows: 28 }"
          placeholder="在此粘贴讲义、笔记、文章等纯文本…"
          class="mindmap-el-textarea"
          spellcheck="false"
        />
        <div class="mindmap-panel-actions">
          <el-button type="primary" :loading="generating" :disabled="generating" @click="generateFromDeepseek">
            用 DeepSeek 生成导图 Markdown
          </el-button>
        </div>
      </div>

      <div class="mindmap-panel mindmap-panel--md">
        <h3 class="mindmap-panel-title">导图 Markdown（可编辑）</h3>
        <p class="mindmap-panel-hint">
          生成结果在此；可一键复制；修改后请点击「渲染导图」刷新下方图形。
        </p>
        <el-input
          v-model="mindmapMd"
          type="textarea"
          :autosize="{ minRows: 12, maxRows: 24 }"
          placeholder="生成后的 Markdown 将出现在这里，也可自行粘贴 # / ## / ### 结构"
          class="mindmap-el-textarea mindmap-el-textarea--mono"
          spellcheck="false"
        />
        <div class="mindmap-panel-actions">
          <el-button plain @click="copyMindmapMarkdown">复制 Markdown</el-button>
          <el-button plain @click="redrawMindmap">渲染导图</el-button>
        </div>
      </div>
    </div>

    <div class="mindmap-preview-section">
      <h3 class="mindmap-panel-title">导图预览</h3>
      <MarkmapSvgPreview
        ref="previewRef"
        :markdown="mindmapMd"
        :live="false"
        :initial-expand-level="3"
        class="mindmap-markmap-stage"
      />
    </div>
  </section>
</template>

<style scoped>
.mindmap-tool-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
}

.page-hero .page-title {
  margin: 0 0 4px;
}

.page-subtitle {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.mindmap-tool-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: stretch;
}

@media (max-width: 960px) {
  .mindmap-tool-grid {
    grid-template-columns: 1fr;
  }
}

.mindmap-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface);
  min-width: 0;
}

.mindmap-panel-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.mindmap-panel-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.mindmap-panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.mindmap-el-textarea :deep(textarea) {
  font-family: inherit;
}

.mindmap-el-textarea--mono :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}

.mindmap-preview-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.mindmap-markmap-stage {
  min-height: min(58vh, 560px);
}

.mindmap-markmap-stage :deep(.markmap-svg) {
  min-height: min(58vh, 560px);
}
</style>
