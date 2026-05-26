<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onBeforeUnmount, onMounted } from 'vue'
import { useBackgroundMusicStore } from '@/stores/background-music'
import { BGM_HOUR_FEE, BGM_HOUR_SECONDS } from '@/services/background-music-billing'
import { MUSIC_PLAY_MODE_OPTIONS, normalizeMusicPlayMode } from '@/utils/music-catalog'
import { formatSecondsAsZh } from '@/utils/formatDuration'

const bgm = useBackgroundMusicStore()
const {
  treeData,
  hasTracks,
  selectedTrackId,
  selectedTrack,
  playMode,
  isPlaying,
  canPlayPrevious,
  canPlayNext,
  balance,
  billingStatus,
} = storeToRefs(bgm)

let uiTick: ReturnType<typeof setInterval> | null = null

const onPlayModeChange = (v: string | number | boolean | undefined) => {
  bgm.setPlayMode(normalizeMusicPlayMode(v))
}

onMounted(() => {
  bgm.ensureInitialized()
  bgm.refreshBalance()
  bgm.refreshBilling()
  uiTick = window.setInterval(() => bgm.refreshBilling(), 1000)
})

onBeforeUnmount(() => {
  if (uiTick != null) {
    clearInterval(uiTick)
    uiTick = null
  }
})
</script>

<template>
  <section class="settings-page bgm-section">
    <header class="page-hero bgm-hero">
      <span class="page-kicker">系统 02</span>
      <h2 class="page-title">背景音乐</h2>
      <ul class="bgm-intro">
        <li>曲目来自 <code>src/assets/music</code>，按子文件夹分类选择。</li>
        <li>播放时计时，每满 {{ BGM_HOUR_SECONDS / 3600 }} 小时扣 {{ BGM_HOUR_FEE }} 元（余额足够时扣费；不足时不扣费，仍可播放）。</li>
        <li>「当前类型随机」在同文件夹内抽曲；「所有类型随机」在整库抽曲；顺序 / 上一首 / 下一首按当前模式切换；换页不中断，关标签页自动暂停。</li>
      </ul>
    </header>

    <div v-if="!hasTracks" class="bgm-empty">
      <p>暂未扫描到音乐文件。请将 mp3、wav、ogg 等放入 <code>src/assets/music</code> 子目录后重新运行或刷新开发服务。</p>
    </div>

    <div v-else class="bgm-body">
      <section class="bgm-block" aria-labelledby="bgm-pick-title">
        <h3 id="bgm-pick-title" class="bgm-block-title">选择曲目</h3>
        <div class="bgm-field">
          <label class="bgm-label" for="bgm-track-select">音乐文件</label>
          <el-tree-select
            id="bgm-track-select"
            :model-value="selectedTrackId"
            class="bgm-tree-select"
            :data="treeData"
            node-key="id"
            check-strictly
            filterable
            clearable
            placeholder="展开文件夹后选择曲目"
            :render-after-expand="false"
            @update:model-value="bgm.setSelectedTrackId($event ?? null)"
          />
        </div>
        <p v-if="selectedTrack" class="bgm-current">
          <span class="bgm-current-label">已选</span>
          <span class="bgm-current-name">{{ selectedTrack.label }}</span>
          <span v-if="selectedTrack.folder" class="bgm-current-folder">{{ selectedTrack.folder }}</span>
        </p>
      </section>

      <section class="bgm-block" aria-labelledby="bgm-mode-title">
        <h3 id="bgm-mode-title" class="bgm-block-title">播放方式</h3>
        <el-radio-group
          class="bgm-mode-group"
          :model-value="playMode"
          @update:model-value="onPlayModeChange"
        >
          <el-radio-button
            v-for="opt in MUSIC_PLAY_MODE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
        <p class="bgm-mode-hint">
          循环：自动重播当前曲；顺序：同文件夹内依次播放；两种随机：文件夹内 / 全库随机；下一首在随机模式下会重新抽曲。
        </p>
      </section>

      <section class="bgm-block bgm-block--play" aria-labelledby="bgm-play-title">
        <h3 id="bgm-play-title" class="bgm-block-title">播放与计费</h3>
        <dl class="bgm-status">
          <div class="bgm-status-item">
            <dt>当前余额</dt>
            <dd><strong>{{ balance }}</strong> 元</dd>
          </div>
          <div class="bgm-status-item">
            <dt>距下次扣款</dt>
            <dd>
              <strong>{{ formatSecondsAsZh(billingStatus.secondsUntilNextCharge) }}</strong>
            </dd>
          </div>
          <div class="bgm-status-item">
            <dt>播放状态</dt>
            <dd>
              <span
                class="bgm-status-badge"
                :class="{ 'bgm-status-badge--on': billingStatus.isRunning }"
              >
                {{ billingStatus.isRunning ? '计时中' : '未播放' }}
              </span>
            </dd>
          </div>
        </dl>
        <div class="bgm-actions">
          <el-button
            type="primary"
            size="large"
            :disabled="!selectedTrackId"
            @click="bgm.togglePlayback()"
          >
            {{ isPlaying ? '暂停' : '播放' }}
          </el-button>
          <el-button
            size="large"
            :disabled="!canPlayPrevious"
            @click="bgm.playPreviousTrack()"
          >
            上一首
          </el-button>
          <el-button
            size="large"
            :disabled="!canPlayNext"
            @click="bgm.playNextTrack()"
          >
            下一首
          </el-button>
        </div>
      </section>

      <p class="bgm-footnote">
        不设宵禁与余额门槛；播放满 1 小时且余额 ≥ {{ BGM_HOUR_FEE }} 元时扣费，否则继续播放不扣费。
      </p>
    </div>
  </section>
</template>

<style scoped>
.bgm-section {
  margin-top: 0;
}

.bgm-hero {
  margin-bottom: 0;
}

.bgm-intro {
  margin: 12px 0 0;
  padding: 12px 14px 12px 28px;
  list-style: disc;
  font-size: 13px;
  line-height: 1.65;
  color: var(--app-text-muted);
  background: var(--app-surface-alt);
  border-radius: 8px;
  border: 1px solid var(--app-border-soft);
}

.bgm-intro code {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--app-surface);
}

.bgm-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 20px;
}

.bgm-block {
  padding: 18px 0;
  border-bottom: 1px solid var(--app-border-soft);
}

.bgm-block:first-child {
  padding-top: 0;
}

.bgm-block--play {
  border-bottom: none;
  padding-bottom: 8px;
}

.bgm-block-title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
  letter-spacing: 0.02em;
}

.bgm-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bgm-label {
  font-size: 13px;
  color: var(--app-text-muted);
}

.bgm-field :deep(.bgm-tree-select) {
  width: 100%;
}

.bgm-field :deep(.el-select__wrapper) {
  min-height: 40px;
  background-color: var(--app-surface-alt);
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.bgm-current {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin: 12px 0 0;
  padding: 10px 12px;
  font-size: 13px;
  border-radius: 8px;
  background: var(--app-surface-alt);
  border: 1px solid var(--app-border-soft);
}

.bgm-current-label {
  color: var(--app-text-muted);
}

.bgm-current-name {
  font-weight: 600;
  color: var(--app-text);
}

.bgm-current-folder {
  font-size: 12px;
  color: var(--app-text-muted);
}

.bgm-current-folder::before {
  content: '·';
  margin-right: 6px;
}

.bgm-mode-group {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
}

.bgm-mode-group :deep(.el-radio-button) {
  flex: 1;
  min-width: 72px;
}

.bgm-mode-group :deep(.el-radio-button__inner) {
  width: 100%;
  padding: 10px 16px;
}

.bgm-mode-hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.bgm-status {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 20px;
}

.bgm-status-item {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--app-surface-alt);
  border: 1px solid var(--app-border-soft);
}

.bgm-status-item dt {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: normal;
  color: var(--app-text-muted);
}

.bgm-status-item dd {
  margin: 0;
  font-size: 14px;
  color: var(--app-text);
}

.bgm-status-item strong {
  font-size: 16px;
  font-weight: 600;
}

.bgm-status-badge {
  display: inline-block;
  padding: 2px 10px;
  font-size: 13px;
  border-radius: 999px;
  background: var(--app-surface);
  color: var(--app-text-muted);
  border: 1px solid var(--app-border-soft);
}

.bgm-status-badge--on {
  color: var(--el-color-success);
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}

.bgm-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.bgm-actions .el-button {
  min-width: 100px;
  margin: 0;
}

.bgm-mode-group :deep(.el-radio-button) {
  flex: 1 1 calc(50% - 4px);
  min-width: 108px;
}

.bgm-footnote,
.bgm-empty {
  margin: 16px 0 0;
  padding-top: 14px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--app-text-muted);
  border-top: 1px solid var(--app-border-soft);
}

.bgm-empty {
  margin-top: 20px;
  padding: 16px;
  border: 1px dashed var(--app-border);
  border-radius: 8px;
  background: var(--app-surface-alt);
}

.bgm-empty code {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--app-surface);
}

@media (max-width: 560px) {
  .bgm-status {
    grid-template-columns: 1fr;
  }

  .bgm-mode-group :deep(.el-radio-button) {
    flex: 1 1 100%;
  }
}
</style>
