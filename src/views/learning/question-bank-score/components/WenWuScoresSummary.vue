<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { resolveWenTitle, resolveWuTitle } from '../rank-data'
import { loadWenWuUserScores, WEN_WU_SCORES_CHANGED_EVENT } from '../wen-wu-user-scores'
import {
  applyDailyStudyingPenaltyIfNeeded,
  loadStudyMode,
  saveStudyMode,
  type StudyMode,
} from '../wen-wu-study-mode'

const props = withDefaults(
  defineProps<{
    /** 为 true 时在卡片内显示「文武品阶」入口 */
    showRankEntry?: boolean
    /** 为 true 时在卡片内显示「学习中 / 放松中」切换 */
    showStudyModeToggle?: boolean
  }>(),
  { showRankEntry: false, showStudyModeToggle: false },
)

const emit = defineEmits<{
  openRank: []
}>()

const wenScore = ref(0)
const wuScore = ref(0)
const money = ref(0)
const studyMode = ref<StudyMode>(loadStudyMode())

const refresh = () => {
  const s = loadWenWuUserScores()
  wenScore.value = s.wenScore
  wuScore.value = s.wuScore
  money.value = s.money
}

const onScoresChanged = () => {
  refresh()
}

onMounted(() => {
  studyMode.value = loadStudyMode()
  if (props.showStudyModeToggle) {
    applyDailyStudyingPenaltyIfNeeded()
  }
  refresh()
  window.addEventListener(WEN_WU_SCORES_CHANGED_EVENT, onScoresChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener(WEN_WU_SCORES_CHANGED_EVENT, onScoresChanged)
})

watch(studyMode, (m) => {
  if (!props.showStudyModeToggle) return
  saveStudyMode(m)
  applyDailyStudyingPenaltyIfNeeded()
  refresh()
})

const setMode = (m: StudyMode) => {
  if (!props.showStudyModeToggle) return
  if (studyMode.value === m) return
  studyMode.value = m
}

defineExpose({ refresh })

const wenTitle = computed(() => resolveWenTitle(wenScore.value))
const wuTitle = computed(() => resolveWuTitle(wuScore.value))
</script>

<template>
  <div class="score-section wen-summary">
    <h3 class="score-section-title">我的文武累计分</h3>
    <p class="score-muted">
      分数由学习行为与每日状态规则自动变化，不可手动修改；数据仅保存在本机浏览器。
    </p>

    <div v-if="showStudyModeToggle" class="wen-study-mode" role="group" aria-label="学习模式">
      <span class="wen-study-mode-label">学习模式</span>
      <div class="wen-study-mode-toggle">
        <button
          type="button"
          class="wen-study-mode-btn"
          :class="{ 'wen-study-mode-btn--active': studyMode === 'studying' }"
          @click="setMode('studying')"
        >
          学习中
        </button>
        <button
          type="button"
          class="wen-study-mode-btn"
          :class="{ 'wen-study-mode-btn--active': studyMode === 'relaxing' }"
          @click="setMode('relaxing')"
        >
          放松中
        </button>
      </div>
      <p v-if="studyMode === 'studying'" class="wen-study-mode-hint">
        学习中：每个自然日在该模式下会固定扣除文分 100、武分 100（各自然日于该模式下最多扣一次）。
      </p>
      <p v-else class="wen-study-mode-hint">
        放松中：每个自然日在该模式下不扣文分，武分固定扣除 80（各自然日于该模式下最多扣一次）。
      </p>
    </div>

    <dl class="wen-summary-grid">
      <div class="wen-summary-item">
        <dt>文（累计分）</dt>
        <dd class="wen-summary-num">{{ wenScore }}</dd>
        <dd class="wen-summary-tier">文职品阶：{{ wenTitle }}</dd>
      </div>
      <div class="wen-summary-item">
        <dt>武（累计分）</dt>
        <dd class="wen-summary-num">{{ wuScore }}</dd>
        <dd class="wen-summary-tier">武职品阶：{{ wuTitle }}</dd>
      </div>
      <div class="wen-summary-item">
        <dt>金钱（累计）</dt>
        <dd class="wen-summary-num">{{ money }}</dd>
        <dd class="wen-summary-tier">本机记录，初始为 0</dd>
      </div>
    </dl>
    <div v-if="showRankEntry" class="wen-summary-actions">
      <el-button type="primary" plain @click="emit('openRank')">文武品阶</el-button>
    </div>
  </div>
</template>

<style scoped>
.wen-study-mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--app-border-soft);
}

.wen-study-mode-label {
  font-size: 12px;
  color: var(--app-text-muted);
  font-weight: 500;
}

.wen-study-mode-toggle {
  display: inline-flex;
  border-radius: 10px;
  border: 1px solid var(--app-border-soft);
  overflow: hidden;
  background: var(--app-surface-alt);
  width: fit-content;
}

.wen-study-mode-btn {
  border: none;
  margin: 0;
  padding: 8px 18px;
  font-size: 14px;
  cursor: pointer;
  background: transparent;
  color: var(--app-text-muted);
  transition: background 0.15s ease, color 0.15s ease;
}

.wen-study-mode-btn:hover {
  color: var(--app-text);
  background: rgba(0, 0, 0, 0.04);
}

:global(.app-shell.theme-dark) .wen-study-mode-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.wen-study-mode-btn--active {
  color: var(--app-primary);
  font-weight: 600;
  background: var(--app-primary-soft);
}

.wen-study-mode-hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
  max-width: 36rem;
}

.wen-summary-actions {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--app-border-soft);
}

.wen-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 16px 24px;
  margin: 0;
}

.wen-summary-item {
  margin: 0;
}

.wen-summary-item dt {
  font-size: 12px;
  color: var(--app-text-muted);
  font-weight: 500;
  margin: 0 0 6px;
}

.wen-summary-num {
  margin: 0 0 6px;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--app-primary, #2563eb);
  letter-spacing: 0.02em;
}

.wen-summary-tier {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-muted);
  line-height: 1.45;
}
</style>
