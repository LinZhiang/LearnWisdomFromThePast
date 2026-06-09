<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MarkmapSvgPreview from '@/views/learning/question-bank/components/MarkmapSvgPreview.vue'
import {
  countLearningTypeChartNodes,
  learningTypeMarkmapExpandLevel,
  learningTypeTreeToMarkmap,
  type LearningTypeChartNode,
} from '@/utils/learningTypeTreeMarkmap'

const props = defineProps<{
  data: LearningTypeChartNode[]
}>()

const panelRef = ref<HTMLDivElement | null>(null)
const previewRef = ref<InstanceType<typeof MarkmapSvgPreview> | null>(null)

const markdown = computed(() => learningTypeTreeToMarkmap(props.data))

const initialExpandLevel = computed(() =>
  learningTypeMarkmapExpandLevel(countLearningTypeChartNodes(props.data)),
)

const redraw = () => {
  void previewRef.value?.draw()
}

watch(markdown, () => redraw())

watch(initialExpandLevel, () => redraw())

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!panelRef.value) return
  resizeObserver = new ResizeObserver(() => redraw())
  resizeObserver.observe(panelRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div ref="panelRef" class="type-mindmap-panel">
    <p class="type-mindmap-hint">
      思维导图预览：拖动画布平移，滚轮缩放；点击节点可展开或收起子级。
    </p>
    <MarkmapSvgPreview
      ref="previewRef"
      class="type-mindmap-preview"
      :markdown="markdown"
      :live="true"
      fill-parent
      :initial-expand-level="initialExpandLevel"
    />
  </div>
</template>

<style scoped>
.type-mindmap-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 8px;
  overflow: hidden;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px;
  background: var(--app-surface);
  box-sizing: border-box;
}

.type-mindmap-hint {
  flex-shrink: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.type-mindmap-preview {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
