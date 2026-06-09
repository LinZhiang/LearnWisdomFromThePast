<script setup lang="ts">
import { useRouter } from 'vue-router'
import { APP_NAME } from '@/constants/branding'
import { markGuideWelcomeSeen } from '@/utils/appGuidePrefs'

const visible = defineModel<boolean>({ required: true })

const router = useRouter()

function dismiss() {
  markGuideWelcomeSeen()
  visible.value = false
}

function startReading() {
  dismiss()
  void router.push('/guide')
}
</script>

<template>
  <el-dialog
    v-model="visible"
    class="guide-welcome-dialog"
    width="min(520px, 92vw)"
    :close-on-click-modal="false"
    append-to-body
    @close="dismiss"
  >
    <template #header>
      <span class="guide-welcome-dialog__title">欢迎使用 {{ APP_NAME }}</span>
    </template>
    <div class="guide-welcome-dialog__body">
      <p class="guide-welcome-dialog__lead">
        这是你的本地学习助手：建知识点、录题库、AI 测验、错题复习与成绩记录。需要详细步骤时可打开顶栏「操作说明」。
      </p>
      <ol class="guide-welcome-dialog__steps">
        <li>在「学习类型编辑」建好目录树</li>
        <li>在「学习题库」录入讲义 / 导图 / 题目</li>
        <li>点「测验」开始练习，错题会自动进入错题本</li>
        <li>到期错题可在顶栏提示处一键复习</li>
      </ol>
    </div>
    <template #footer>
      <el-button @click="dismiss">稍后再看</el-button>
      <el-button type="primary" @click="startReading">开始阅读说明</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.guide-welcome-dialog__title {
  font-size: 1.05rem;
  font-weight: 700;
}

.guide-welcome-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--app-text);
}

.guide-welcome-dialog__lead {
  margin: 0;
}

.guide-welcome-dialog__steps {
  margin: 0;
  padding-left: 1.25rem;
}

.guide-welcome-dialog__steps li {
  margin: 0.35em 0;
}
</style>
