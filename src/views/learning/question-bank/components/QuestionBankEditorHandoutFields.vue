<script setup lang="ts">
import { ref, watch } from 'vue'
import MarkdownSplitEditor from '@/components/MarkdownSplitEditor.vue'
import {
  HANDOUT_GENERAL_COUNT_DEFAULT,
  HANDOUT_GENERAL_COUNT_MAX,
  HANDOUT_GENERAL_COUNT_MIN,
  HANDOUT_JUDGMENT_COUNT_DEFAULT,
  HANDOUT_JUDGMENT_COUNT_MAX,
  HANDOUT_JUDGMENT_COUNT_MIN,
  HANDOUT_MCQ_COUNT_DEFAULT,
  HANDOUT_MCQ_COUNT_MAX,
  HANDOUT_MCQ_COUNT_MIN,
  clampHandoutGeneralCount,
  clampHandoutJudgmentCount,
  clampHandoutMcqCount,
} from '@/utils/handoutQuestion'

const content = defineModel<string>('content', { required: true })
const handoutAutoMcq = defineModel<boolean>('handoutAutoMcq', { required: true })
const handoutMcqCount = defineModel<number>('handoutMcqCount', { required: true })
const handoutAutoGeneral = defineModel<boolean>('handoutAutoGeneral', { required: true })
const handoutGeneralCount = defineModel<number>('handoutGeneralCount', { required: true })
const handoutAutoJudgment = defineModel<boolean>('handoutAutoJudgment', { required: true })
const handoutJudgmentCount = defineModel<number>('handoutJudgmentCount', { required: true })

watch(handoutMcqCount, (v) => {
  const c = clampHandoutMcqCount(v)
  if (c !== v) handoutMcqCount.value = c
})

watch(handoutGeneralCount, (v) => {
  const c = clampHandoutGeneralCount(v)
  if (c !== v) handoutGeneralCount.value = c
})

watch(handoutJudgmentCount, (v) => {
  const c = clampHandoutJudgmentCount(v)
  if (c !== v) handoutJudgmentCount.value = c
})

const onHandoutAutoMcqChange = (v: boolean) => {
  handoutAutoMcq.value = v
  if (v && !handoutMcqCount.value) {
    handoutMcqCount.value = HANDOUT_MCQ_COUNT_DEFAULT
  }
}

const onHandoutAutoGeneralChange = (v: boolean) => {
  handoutAutoGeneral.value = v
  if (v && !handoutGeneralCount.value) {
    handoutGeneralCount.value = HANDOUT_GENERAL_COUNT_DEFAULT
  }
}

const onHandoutAutoJudgmentChange = (v: boolean) => {
  handoutAutoJudgment.value = v
  if (v && !handoutJudgmentCount.value) {
    handoutJudgmentCount.value = HANDOUT_JUDGMENT_COUNT_DEFAULT
  }
}

const titleFromImportedFileName = (fileName: string) => {
  const raw = fileName.trim()
  if (!raw) return ''
  const noExt = raw.replace(/\.[^./\\]+$/i, '').trim()
  return noExt || raw
}

const emit = defineEmits<{
  (e: 'import-title', name: string): void
}>()

const importInputRef = ref<HTMLInputElement | null>(null)
const splitEditorRef = ref<InstanceType<typeof MarkdownSplitEditor> | null>(null)

function triggerImport() {
  importInputRef.value?.click()
}

const onMarkdownFileImport = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    content.value = String(reader.result ?? '')
    emit('import-title', titleFromImportedFileName(file.name))
    input.value = ''
  }
  reader.readAsText(file, 'UTF-8')
}

defineExpose({
  flushContentForSave: () => splitEditorRef.value?.flushContentForSave() ?? content.value,
})
</script>

<template>
  <div class="handout-editor">
    <section class="handout-panel handout-panel--settings">
      <h4 class="handout-panel-title">测验出题</h4>
      <p class="handout-panel-desc">
        可单独或同时勾选；均未勾选时讲义仅用于阅读，不参与测验抽题。计算题会更换数值考查同一方法；判断题会生成易混淆的对错陈述。
      </p>
      <div class="handout-mode-block">
        <el-checkbox
          :model-value="handoutAutoMcq"
          @update:model-value="onHandoutAutoMcqChange"
        >
          自动生成选择题
        </el-checkbox>
        <div v-if="handoutAutoMcq" class="handout-count-row">
          <span class="handout-count-label">出题数量</span>
          <el-input-number
            v-model="handoutMcqCount"
            :min="HANDOUT_MCQ_COUNT_MIN"
            :max="HANDOUT_MCQ_COUNT_MAX"
            :step="1"
            controls-position="right"
          />
          <span class="handout-count-hint">可设 {{ HANDOUT_MCQ_COUNT_MIN }}～{{ HANDOUT_MCQ_COUNT_MAX }} 道</span>
        </div>
      </div>
      <div class="handout-mode-block">
        <el-checkbox
          :model-value="handoutAutoGeneral"
          @update:model-value="onHandoutAutoGeneralChange"
        >
          自动生成计算题（作答题）
        </el-checkbox>
        <div v-if="handoutAutoGeneral" class="handout-count-row">
          <span class="handout-count-label">出题数量</span>
          <el-input-number
            v-model="handoutGeneralCount"
            :min="HANDOUT_GENERAL_COUNT_MIN"
            :max="HANDOUT_GENERAL_COUNT_MAX"
            :step="1"
            controls-position="right"
          />
          <span class="handout-count-hint">可设 {{ HANDOUT_GENERAL_COUNT_MIN }}～{{ HANDOUT_GENERAL_COUNT_MAX }} 道</span>
        </div>
      </div>
      <div class="handout-mode-block">
        <el-checkbox
          :model-value="handoutAutoJudgment"
          @update:model-value="onHandoutAutoJudgmentChange"
        >
          自动生成判断题
        </el-checkbox>
        <div v-if="handoutAutoJudgment" class="handout-count-row">
          <span class="handout-count-label">出题数量</span>
          <el-input-number
            v-model="handoutJudgmentCount"
            :min="HANDOUT_JUDGMENT_COUNT_MIN"
            :max="HANDOUT_JUDGMENT_COUNT_MAX"
            :step="1"
            controls-position="right"
          />
          <span class="handout-count-hint">可设 {{ HANDOUT_JUDGMENT_COUNT_MIN }}～{{ HANDOUT_JUDGMENT_COUNT_MAX }} 道</span>
        </div>
      </div>
    </section>

    <MarkdownSplitEditor ref="splitEditorRef" v-model="content">
      <template #source-actions>
        <input
          ref="importInputRef"
          type="file"
          class="handout-file-input"
          accept=".md,.txt,text/markdown,text/plain"
          @change="onMarkdownFileImport"
        />
        <el-button type="primary" plain size="small" @click="triggerImport">导入 .md</el-button>
      </template>
    </MarkdownSplitEditor>
  </div>
</template>

<style scoped>
.handout-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.handout-panel {
  flex-shrink: 0;
  border: 1px solid var(--app-border-soft);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--app-surface-alt);
  display: grid;
  gap: 10px;
}

.handout-panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
}

.handout-panel-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.handout-mode-block {
  display: grid;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--app-border-soft);
}

.handout-mode-block:first-of-type {
  border-top: none;
  padding-top: 0;
}

.handout-count-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding-left: 24px;
}

.handout-count-label {
  font-size: 13px;
  color: var(--app-text-muted);
}

.handout-count-hint {
  font-size: 12px;
  color: var(--app-text-muted);
}

.handout-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
