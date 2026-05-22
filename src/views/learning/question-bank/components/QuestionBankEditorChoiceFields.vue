<script setup lang="ts">
import { inject } from 'vue'
import { questionBankEditorChoicePayloadKey } from './questionBankEditorInject'

const choicePayload = inject(questionBankEditorChoicePayloadKey)
if (!choicePayload) {
  throw new Error('QuestionBankEditorChoiceFields 须在提供 questionBankEditorChoicePayloadKey 的父级内使用')
}

const addChoiceAnswer = () => {
  choicePayload.correctAnswers.push('')
}

const removeChoiceAnswer = (idx: number) => {
  if (choicePayload.correctAnswers.length <= 1) return
  choicePayload.correctAnswers.splice(idx, 1)
}
</script>

<template>
  <div class="choice-fields">
    <div class="choice-field-row">
      <span class="field-label">选项类型</span>
      <div class="choice-radio-wrap">
        <el-radio-group v-model="choicePayload.mode" class="choice-radio-group">
          <el-radio value="single">单选</el-radio>
          <el-radio value="multiple">多选</el-radio>
        </el-radio-group>
      </div>
    </div>
    <div class="choice-answers-section">
      <span class="field-label">正确答案（仅填写正确项）</span>
      <template v-if="choicePayload.mode === 'single'">
        <el-input
          v-model="choicePayload.correctAnswers[0]"
          placeholder="请输入唯一正确答案"
        />
      </template>
      <template v-else>
        <div
          v-for="(_item, idx) in choicePayload.correctAnswers"
          :key="idx"
          class="choice-answer-row"
        >
          <el-input
            v-model="choicePayload.correctAnswers[idx]"
            :placeholder="`正确答案 ${idx + 1}`"
          />
          <el-button
            v-if="choicePayload.correctAnswers.length > 1"
            text
            type="danger"
            @click="removeChoiceAnswer(idx)"
          >
            删除
          </el-button>
        </div>
        <el-button type="primary" link @click="addChoiceAnswer">添加正确答案</el-button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.field-label {
  color: var(--app-text-muted);
  font-size: 13px;
}

.choice-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.choice-field-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  width: 100%;
}

.choice-field-row .field-label {
  line-height: 1.4;
  flex-shrink: 0;
}

.choice-radio-wrap {
  width: 100%;
  display: flex;
  align-items: center;
}

.choice-radio-group {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 1.5rem;
  row-gap: 0.5rem;
}

.choice-radio-group :deep(.el-radio) {
  margin-right: 0;
  margin-bottom: 0;
  height: auto;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
}

.choice-radio-group :deep(.el-radio__input) {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.choice-radio-group :deep(.el-radio__label) {
  line-height: 1.5;
  padding-left: 8px;
}

.choice-answers-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  align-items: stretch;
}

.choice-answers-section > .field-label {
  flex-shrink: 0;
}

.choice-answer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.choice-answer-row :deep(.el-input) {
  flex: 1;
  min-width: 0;
}
</style>
