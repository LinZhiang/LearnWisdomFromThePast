<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppearanceStore } from '@/stores/appearance'
import { renderMindmap } from '@/utils/mindmap'

const { themeStyle } = storeToRefs(useAppearanceStore())
/** markmap 内置 .markmap-dark .markmap 变量，避免深色面板上仍用 #333 正文 */
const markmapDarkChrome = computed(() => themeStyle.value === 'dark')

const props = withDefaults(
  defineProps<{
    markdown: string
    /** 为 true 时随 markdown 变化自动重绘（详情页）；编辑页用 false + 手动 draw */
    live?: boolean
    /** 为 true 时在父级 flex 布局中尽量占满剩余高度（详情查看） */
    fillParent?: boolean
    /** 仅初始展开到指定层级；不传则按 markmap 默认行为 */
    initialExpandLevel?: number
  }>(),
  { live: false, fillParent: false, initialExpandLevel: undefined },
)

const svgRef = ref<SVGSVGElement | null>(null)

const draw = async () => {
  await nextTick()
  if (!svgRef.value) return
  svgRef.value.innerHTML = ''
  const md = props.markdown?.trim() ? props.markdown : '# '
  renderMindmap(svgRef.value, md, { initialExpandLevel: props.initialExpandLevel })
}

watch(
  () => props.markdown,
  () => {
    if (props.live) void draw()
  },
)

onMounted(() => {
  void draw()
})

defineExpose({ draw })
</script>

<template>
  <div
    class="markmap-preview-box"
    :class="{
      'markmap-preview-box--fill': fillParent,
      'markmap-dark': markmapDarkChrome,
    }"
  >
    <svg ref="svgRef" class="markmap-svg" />
  </div>
</template>

<style scoped>
.markmap-preview-box {
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  background: var(--app-surface);
  overflow: auto;
  min-height: 280px;
}

.markmap-preview-box--fill {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  align-self: stretch;
}

.markmap-svg {
  display: block;
  width: 100%;
  min-height: 280px;
}

.markmap-preview-box--fill .markmap-svg {
  min-height: 100%;
  min-width: 100%;
  height: 100%;
}

/*
 * 深色主题：正文与加粗等统一纯白，不加 text-shadow / stroke（避免「黑字白边」脏感）。
 * 链接同为白字，用下划线区分；代码块白字 + 略深半透明底。
 */
.markmap-preview-box.markmap-dark :deep(svg.markmap) {
  --markmap-text-color: #ffffff;
  --markmap-font: 500 16px/22px system-ui, -apple-system, 'Segoe UI', sans-serif;
  --markmap-a-color: #ffffff;
  --markmap-a-hover-color: #ffffff;
  --markmap-code-color: #ffffff;
  --markmap-code-bg: rgba(15, 23, 42, 0.55);
  --markmap-highlight-bg: rgba(255, 255, 255, 0.2);
  --markmap-circle-open-bg: #e5e7eb;
}

.markmap-preview-box.markmap-dark :deep(.markmap-foreign) {
  color: #ffffff;
  -webkit-text-fill-color: #ffffff;
  text-shadow: none;
  -webkit-text-stroke: 0 transparent;
}

.markmap-preview-box.markmap-dark :deep(.markmap-foreign p),
.markmap-preview-box.markmap-dark :deep(.markmap-foreign li),
.markmap-preview-box.markmap-dark :deep(.markmap-foreign em),
.markmap-preview-box.markmap-dark :deep(.markmap-foreign strong) {
  color: #ffffff;
  -webkit-text-fill-color: #ffffff;
  text-shadow: none;
  -webkit-text-stroke: 0 transparent;
}

.markmap-preview-box.markmap-dark :deep(.markmap-foreign strong) {
  font-weight: 700;
}

.markmap-preview-box.markmap-dark :deep(.markmap-foreign a) {
  color: #ffffff;
  -webkit-text-fill-color: #ffffff;
  text-decoration: underline;
  text-underline-offset: 0.15em;
  text-shadow: none;
  -webkit-text-stroke: 0 transparent;
}

.markmap-preview-box.markmap-dark :deep(.markmap-foreign a:hover) {
  opacity: 0.92;
}

.markmap-preview-box.markmap-dark :deep(.markmap-foreign code) {
  color: #ffffff;
  -webkit-text-fill-color: #ffffff;
  text-shadow: none;
  -webkit-text-stroke: 0 transparent;
}

.markmap-preview-box.markmap-dark :deep(.markmap-foreign mark) {
  color: #ffffff;
  -webkit-text-fill-color: #ffffff;
  text-shadow: none;
  -webkit-text-stroke: 0 transparent;
}
</style>
