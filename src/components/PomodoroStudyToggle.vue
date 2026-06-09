<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  POMODORO_DEFAULTS,
  POMODORO_SESSIONS_BEFORE_LONG_BREAK,
  usePomodoroStore,
} from '@/stores/pomodoro'

const pomodoro = usePomodoroStore()
const { enabled, settings, remainingLabel, phaseLabel } = storeToRefs(pomodoro)

const onTomatoClick = (e: MouseEvent) => {
  e.stopPropagation()
  pomodoro.toggle()
}

const onStudyMinutes = (v: number | undefined) => {
  if (v == null) return
  pomodoro.updateSettings({ studyMinutes: v })
}

const onBreakMinutes = (v: number | undefined) => {
  if (v == null) return
  pomodoro.updateSettings({ breakMinutes: v })
}

const onLongBreakMinutes = (v: number | undefined) => {
  if (v == null) return
  pomodoro.updateSettings({ longBreakMinutes: v })
}
</script>

<template>
  <el-popover
    placement="bottom-start"
    :width="300"
    trigger="hover"
    :show-after="120"
    :hide-after="160"
    popper-class="pomodoro-settings-popper"
  >
    <template #reference>
      <button
        type="button"
        class="pomodoro-study"
        :class="{ 'is-on': enabled }"
        :aria-pressed="enabled"
        aria-label="番茄学习模式"
        @click="onTomatoClick"
      >
        <span class="pomodoro-study__icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" class="pomodoro-study__svg">
            <ellipse cx="24" cy="27" rx="17" ry="16" fill="currentColor" />
            <path
              d="M24 6c-2 0-4 2-4.5 4.5-.3 1.5.2 3 1.2 4 1.2 1.2 2.8 1.8 4.3 1.5 1-.2 1.8-.8 2.5-1.5.8-.8 1.2-1.8 1.2-2.9C28.7 8.5 26.6 6 24 6z"
              fill="#4ade80"
            />
            <ellipse cx="18" cy="24" rx="3" ry="5" fill="rgba(255,255,255,.22)" />
          </svg>
        </span>
        <span class="pomodoro-study__text">番茄学习模式</span>
        <span v-if="enabled && remainingLabel" class="pomodoro-study__timer">
          {{ phaseLabel }} {{ remainingLabel }}
        </span>
      </button>
    </template>

    <div class="pomodoro-settings">
      <h4 class="pomodoro-settings__title">番茄钟设置</h4>
      <p class="pomodoro-settings__hint">悬停打开设置；点击番茄图标开启/关闭模式。</p>
      <label class="pomodoro-settings__row">
        <span>学习时间（分钟）</span>
        <el-input-number
          :model-value="settings.studyMinutes"
          :min="1"
          :max="180"
          :step="1"
          controls-position="right"
          size="small"
          @update:model-value="onStudyMinutes"
        />
      </label>
      <label class="pomodoro-settings__row">
        <span>休息时间（分钟）</span>
        <el-input-number
          :model-value="settings.breakMinutes"
          :min="1"
          :max="60"
          :step="1"
          controls-position="right"
          size="small"
          @update:model-value="onBreakMinutes"
        />
      </label>
      <label class="pomodoro-settings__row">
        <span>长休息（分钟）</span>
        <el-input-number
          :model-value="settings.longBreakMinutes"
          :min="1"
          :max="90"
          :step="1"
          controls-position="right"
          size="small"
          @update:model-value="onLongBreakMinutes"
        />
      </label>
      <p class="pomodoro-settings__note">
        连续学习 {{ POMODORO_SESSIONS_BEFORE_LONG_BREAK }} 次后长休息；默认
        {{ POMODORO_DEFAULTS.studyMinutes }} / {{ POMODORO_DEFAULTS.breakMinutes }} /
        {{ POMODORO_DEFAULTS.longBreakMinutes }} 分钟。
      </p>
    </div>
  </el-popover>
</template>

<style scoped>
.pomodoro-study {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin: 0;
  padding: 4px 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  color: #94a3b8;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    transform 0.15s ease;
  flex-shrink: 0;
}

.pomodoro-study:hover {
  background: var(--app-primary-soft, rgba(37, 99, 235, 0.08));
  color: #ef4444;
}

.pomodoro-study.is-on {
  color: #ef4444;
}

.pomodoro-study.is-on .pomodoro-study__icon {
  filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.45));
}

.pomodoro-study:active {
  transform: scale(0.96);
}

.pomodoro-study__icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pomodoro-study__svg {
  width: 34px;
  height: 34px;
}

.pomodoro-study__text {
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.pomodoro-study__timer {
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--app-primary, #2563eb);
  font-variant-numeric: tabular-nums;
}

.pomodoro-settings__title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
}

.pomodoro-settings__hint,
.pomodoro-settings__note {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--app-text-muted);
}

.pomodoro-settings__note {
  margin-bottom: 0;
  margin-top: 4px;
}

.pomodoro-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 13px;
}

.pomodoro-settings__row span {
  flex: 1;
  min-width: 0;
}
</style>

<style>
.pomodoro-settings-popper {
  border-radius: 10px !important;
}
</style>
