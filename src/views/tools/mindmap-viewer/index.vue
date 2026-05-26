<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, ref, watch } from 'vue'
import MarkmapSvgPreview from '@/views/learning/question-bank/components/MarkmapSvgPreview.vue'
import { isAiChatConfigured, requestMindmapMarkdownFromSourceText } from '@/services/deepseek'
import { hashForAiCache, rememberAiResponse } from '@/utils/aiResponseCache'
import {
  extractLeadingThemeFromSource,
  extractMarkdownH1Title,
  extractSegmentThemeTitle,
  inferSegmentThemeFromSource,
  normalizeSegmentMindmapMarkdown,
  sanitizeTxtFilename,
} from '@/utils/mindmapTheme'
import { splitSourceTextIntoParts } from '@/utils/splitSourceText'

const MINDMAP_GENERATE_MAX = 5

type MindmapVariant = {
  id: string
  label: string
  markdown: string
  /** 本段知识板块主题，用于 Tab 与下载 txt 文件名 */
  themeTitle: string
  /** 本段对应的原文（用于展示/下载说明） */
  sourcePart: string
}

const sourceText = ref('')
const generateCount = ref(1)
const variants = ref<MindmapVariant[]>([])
const activeVariantId = ref<string | null>(null)
const generating = ref(false)
const generateProgress = ref('')
const previewRef = ref<InstanceType<typeof MarkmapSvgPreview> | null>(null)
/** 全书总标题（若有），用于识别 AI 是否误把全书名当作本段 `#` */
const documentThemeTitleRef = ref<string | null>(null)

const activeVariant = computed(() =>
  variants.value.find((v) => v.id === activeVariantId.value) ?? null,
)

const mindmapMd = computed({
  get: () => activeVariant.value?.markdown ?? '',
  set: (value: string) => {
    const v = activeVariant.value
    if (v) v.markdown = value
  },
})

const canUseAi = () => isAiChatConfigured()

watch(activeVariantId, async () => {
  await nextTick()
  previewRef.value?.draw()
})

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

  const count = Math.min(MINDMAP_GENERATE_MAX, Math.max(1, Math.round(generateCount.value) || 1))
  generateCount.value = count

  if (count > 1) {
    try {
      await ElMessageBox.confirm(
        `将拆分为 ${count} 段，并调用 ${count} 次 Pro 模型生成导图（费用约为 1 段的 ${count} 倍）。确定继续？`,
        '多段生成确认',
        { type: 'warning', confirmButtonText: '继续生成', cancelButtonText: '取消' },
      )
    } catch {
      return
    }
  }

  const documentThemeLine = extractLeadingThemeFromSource(src)
  const documentThemeTitle = documentThemeLine
    ? extractMarkdownH1Title(documentThemeLine)
    : null
  documentThemeTitleRef.value = documentThemeTitle
  const parts = splitSourceTextIntoParts(src, count)
  if (parts.length === 0) {
    ElMessage.warning('无法拆分文本，请检查内容。')
    return
  }

  generating.value = true
  generateProgress.value = ''
  const nextVariants: MindmapVariant[] = []

  try {
    for (let i = 0; i < parts.length; i += 1) {
      generateProgress.value =
        parts.length === 1
          ? '正在生成导图…'
          : `已拆分 ${parts.length} 段，正在生成第 ${i + 1} 段导图…`
      const segmentThemeHint = inferSegmentThemeFromSource(parts[i]!, documentThemeTitle)
      const cacheKey = `mindmap-md:${hashForAiCache(
        [
          parts[i]!,
          String(i),
          String(parts.length),
          documentThemeTitle ?? '',
          segmentThemeHint ?? '',
        ].join('\0'),
      )}`
      let md = await rememberAiResponse(cacheKey, () =>
        requestMindmapMarkdownFromSourceText(parts[i]!, {
          partIndex: i,
          partTotal: parts.length,
          documentThemeTitle,
          segmentThemeTitle: segmentThemeHint,
        }),
      )
      md = normalizeSegmentMindmapMarkdown(md, {
        documentThemeTitle,
        segmentThemeHint: segmentThemeHint ?? undefined,
      })
      const themeTitle =
        extractSegmentThemeTitle(md, documentThemeTitle) ??
        segmentThemeHint ??
        `第 ${i + 1} 段`
      const tabLabel =
        themeTitle.length > 28 ? `${themeTitle.slice(0, 26)}…` : themeTitle
      nextVariants.push({
        id: `mindmap-${Date.now()}-${i}`,
        label: tabLabel,
        markdown: md,
        themeTitle,
        sourcePart: parts[i]!,
      })
    }
    variants.value = nextVariants
    activeVariantId.value = nextVariants[0]?.id ?? null
    await nextTick()
    previewRef.value?.draw()
    ElMessage.success(
      parts.length === 1
        ? '导图已生成，可在右侧编辑后渲染或下载 txt。'
        : `全文已拆成 ${parts.length} 段，每段各生成一张导图，可切换查看。`,
    )
  } catch (e) {
    if (nextVariants.length > 0) {
      variants.value = nextVariants
      activeVariantId.value = nextVariants[0]?.id ?? null
      ElMessage.warning(
        `已完成 ${nextVariants.length} 个，后续失败：${e instanceof Error ? e.message : '生成失败'}`,
      )
    } else {
      const msg = e instanceof Error ? e.message : '生成失败'
      ElMessage.error(msg)
    }
  } finally {
    generating.value = false
    generateProgress.value = ''
  }
}

const redrawMindmap = async () => {
  await nextTick()
  previewRef.value?.draw()
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function resolveVariantThemeTitle(v: MindmapVariant): string {
  return (
    extractSegmentThemeTitle(v.markdown, documentThemeTitleRef.value) ??
    v.themeTitle ??
    v.label
  )
}

const downloadCurrentMindmapTxt = () => {
  const v = activeVariant.value
  if (!v?.markdown.trim()) {
    ElMessage.warning('当前段暂无导图内容可下载。')
    return
  }
  const name = sanitizeTxtFilename(resolveVariantThemeTitle(v))
  downloadTextFile(`${name}.txt`, v.markdown)
  ElMessage.success(`已下载 ${name}.txt`)
}

const downloadAllMindmapsTxt = () => {
  if (variants.value.length === 0) {
    ElMessage.warning('请先生成导图。')
    return
  }
  const body = variants.value
    .map((v) => {
      const theme = resolveVariantThemeTitle(v)
      const header = `======== ${theme}（${v.label}）========`
      const srcNote =
        v.sourcePart.trim().length > 0
          ? `\n【本段原文摘要】${v.sourcePart.trim().slice(0, 200)}${v.sourcePart.length > 200 ? '…' : ''}\n`
          : ''
      return `${header}${srcNote}\n${v.markdown.trim()}`
    })
    .join('\n\n\n')
  const base =
    variants.value.length === 1
      ? sanitizeTxtFilename(resolveVariantThemeTitle(variants.value[0]!))
      : `${sanitizeTxtFilename(resolveVariantThemeTitle(variants.value[0]!))}-全部${variants.value.length}段`
  downloadTextFile(`${base}.txt`, body)
  ElMessage.success(`已下载 ${base}.txt`)
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
        分层拆细；**同级最多 4 分支**（超出自动用 #### 归类）；单条 ≤40 字；通俗子项。
        可拆分最多
        {{ MINDMAP_GENERATE_MAX }} 段分别生成；每段文首为概括性主题（无序号），下载 txt 以该主题命名。
      </p>
    </header>

    <div class="mindmap-tool-grid">
      <div class="mindmap-panel mindmap-panel--source">
        <header class="mindmap-panel-head">
          <h3 class="mindmap-panel-title">原始材料</h3>
          <p class="mindmap-panel-hint">
            支持较长文本；「拆分份数」表示把全文切成几段，每段各生成一张导图（非多种风格）。单段超约 1.8 万字会截断。
          </p>
        </header>
        <div class="mindmap-panel-body">
          <el-input
            v-model="sourceText"
            type="textarea"
            :rows="16"
            placeholder="在此粘贴讲义、笔记、文章等纯文本…"
            class="mindmap-el-textarea"
            spellcheck="false"
          />
        </div>
        <footer class="mindmap-panel-foot mindmap-panel-foot--generate">
          <label class="mindmap-generate-count">
            <span class="mindmap-generate-count-label">拆分份数</span>
            <el-input-number
              v-model="generateCount"
              :min="1"
              :max="MINDMAP_GENERATE_MAX"
              :step="1"
              step-strictly
              controls-position="right"
              :disabled="generating"
            />
            <span class="mindmap-generate-count-hint">默认 1 段；每增 1 段多 1 次 Pro 请求</span>
          </label>
          <el-button
            class="mindmap-panel-btn"
            type="primary"
            :loading="generating"
            :disabled="generating"
            @click="generateFromDeepseek"
          >
            {{ generating && generateProgress ? generateProgress : '用 DeepSeek 生成导图 Markdown' }}
          </el-button>
        </footer>
      </div>

      <div class="mindmap-panel mindmap-panel--md">
        <header class="mindmap-panel-head">
          <h3 class="mindmap-panel-title">导图 Markdown（可编辑）</h3>
          <p class="mindmap-panel-hint">
            每段对应一张导图；Tab 显示本段主题名，下载 txt 以该主题命名。
          </p>
        </header>
        <div v-if="variants.length > 1" class="mindmap-variant-tabs">
          <el-radio-group v-model="activeVariantId" size="small">
            <el-radio-button v-for="v in variants" :key="v.id" :value="v.id">
              {{ v.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
        <div class="mindmap-panel-body">
          <el-input
            v-model="mindmapMd"
            type="textarea"
            :rows="16"
            placeholder="生成后的 Markdown 将出现在这里，也可自行粘贴 # / ## / ### 结构"
            class="mindmap-el-textarea mindmap-el-textarea--mono"
            spellcheck="false"
          />
        </div>
        <footer class="mindmap-panel-foot">
          <el-button class="mindmap-panel-btn" plain @click="copyMindmapMarkdown">复制 Markdown</el-button>
          <el-button class="mindmap-panel-btn" plain @click="redrawMindmap">渲染导图</el-button>
          <el-button
            class="mindmap-panel-btn"
            plain
            :disabled="!mindmapMd.trim()"
            @click="downloadCurrentMindmapTxt"
          >
            下载当前 txt
          </el-button>
          <el-button
            v-if="variants.length > 1"
            class="mindmap-panel-btn"
            plain
            @click="downloadAllMindmapsTxt"
          >
            下载全部 txt
          </el-button>
        </footer>
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

  .mindmap-panel {
    min-height: 0;
  }
}

.mindmap-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface);
  min-width: 0;
  min-height: 520px;
}

.mindmap-panel-head {
  flex-shrink: 0;
  margin-bottom: 12px;
}

.mindmap-panel-title {
  margin: 0 0 6px;
  font-size: 1.05rem;
  font-weight: 600;
}

.mindmap-panel-hint {
  margin: 0;
  min-height: 2.5em;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.mindmap-panel-body {
  flex: 1;
  display: flex;
  min-height: 0;
  margin-bottom: 12px;
}

.mindmap-el-textarea {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.mindmap-el-textarea :deep(.el-textarea) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mindmap-el-textarea :deep(textarea) {
  flex: 1;
  min-height: 100%;
  height: 100% !important;
  resize: none;
  font-family: inherit;
  line-height: 1.55;
  border-radius: 8px;
}

.mindmap-el-textarea--mono :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}

.mindmap-panel-foot {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border-soft);
}

.mindmap-panel-foot :deep(.mindmap-panel-btn) {
  height: 32px;
  margin: 0;
  border-radius: 6px;
}

.mindmap-panel-foot--generate {
  align-items: center;
  gap: 12px;
}

.mindmap-generate-count {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

.mindmap-generate-count-hint {
  font-size: 12px;
  color: var(--app-text-muted);
  white-space: nowrap;
}

.mindmap-generate-count-label {
  font-size: 13px;
  color: var(--app-text-muted);
  white-space: nowrap;
}

.mindmap-generate-count :deep(.el-input-number) {
  width: 108px;
}

.mindmap-generate-count :deep(.el-input__wrapper) {
  min-height: 32px;
}

.mindmap-variant-tabs {
  flex-shrink: 0;
  margin-bottom: 10px;
}

.mindmap-variant-tabs :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
