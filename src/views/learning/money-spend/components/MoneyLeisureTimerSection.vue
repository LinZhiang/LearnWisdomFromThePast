<script setup lang="ts">
import '../../question-bank-score/score-section.css'
import { useMoneyLeisureTimer } from '../composables/useMoneyLeisureTimer'
import '../money-spend-shared.css'

const {
  expanded,
  status,
  settling,
  onToggle,
  onPause,
  onSettle,
  formatQuota,
  isRunning,
} = useMoneyLeisureTimer()
</script>

<template>
  <section class="score-section money-spend-block" aria-labelledby="leisure-timer-title">
    <div class="money-section-head">
      <h3 id="leisure-timer-title" class="score-section-title money-section-title">
        玩游戏 / 看视频
      </h3>
      <button
        type="button"
        class="money-section-toggle"
        :aria-expanded="expanded"
        aria-controls="leisure-timer-panel"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起详情' : '展开详情' }}
      </button>
    </div>
    <p v-if="!expanded" class="score-muted money-section-collapsed-hint">
      每日游戏 30 分钟、视频 1 小时内免费；超额部分可在计时后一键结算扣款。
    </p>
    <div v-show="expanded" id="leisure-timer-panel" class="money-section-panel">
      <p class="score-muted leisure-intro">
        默认每日游戏 <strong>30 分钟</strong>、看视频 <strong>1 小时</strong> 不计费；超出部分按「玩游戏半小时
        −20 元 / 看视频一小时 −20 元」自动扣除（向上按整段计费）。支持开始/暂停计时。
      </p>
      <p v-if="status?.curfewActive" class="leisure-curfew">当前为宵禁时段，暂不可结算扣款。</p>

      <div v-if="status" class="leisure-grid">
        <article class="leisure-card">
          <header class="leisure-card-head">
            <h4 class="leisure-card-title">玩游戏</h4>
            <span
              class="leisure-badge"
              :class="{ 'leisure-badge--on': isRunning('game') }"
            >
              {{ isRunning('game') ? '计时中' : '未计时' }}
            </span>
          </header>
          <dl class="leisure-stats">
            <div>
              <dt>今日累计</dt>
              <dd>{{ formatQuota(status.game.totalSeconds) }}</dd>
            </div>
            <div>
              <dt>免费额度</dt>
              <dd>{{ formatQuota(status.game.freeSeconds) }}</dd>
            </div>
            <div>
              <dt>超额</dt>
              <dd>{{ formatQuota(status.game.excessSeconds) }}</dd>
            </div>
            <div>
              <dt>待结算扣款</dt>
              <dd :class="{ 'leisure-fee--warn': status.game.pendingFee < 0 }">
                {{ status.game.pendingFee }} 元
                <span v-if="status.game.pendingBlocks > 0" class="leisure-fee-sub">
                  （{{ status.game.pendingBlocks }} 段）
                </span>
              </dd>
            </div>
          </dl>
          <div class="leisure-actions">
            <el-button
              :type="isRunning('game') ? 'warning' : 'primary'"
              @click="onToggle('game')"
            >
              {{ isRunning('game') ? '暂停' : '开始计时' }}
            </el-button>
          </div>
        </article>

        <article class="leisure-card">
          <header class="leisure-card-head">
            <h4 class="leisure-card-title">看视频</h4>
            <span
              class="leisure-badge"
              :class="{ 'leisure-badge--on': isRunning('video') }"
            >
              {{ isRunning('video') ? '计时中' : '未计时' }}
            </span>
          </header>
          <dl class="leisure-stats">
            <div>
              <dt>今日累计</dt>
              <dd>{{ formatQuota(status.video.totalSeconds) }}</dd>
            </div>
            <div>
              <dt>免费额度</dt>
              <dd>{{ formatQuota(status.video.freeSeconds) }}</dd>
            </div>
            <div>
              <dt>超额</dt>
              <dd>{{ formatQuota(status.video.excessSeconds) }}</dd>
            </div>
            <div>
              <dt>待结算扣款</dt>
              <dd :class="{ 'leisure-fee--warn': status.video.pendingFee < 0 }">
                {{ status.video.pendingFee }} 元
                <span v-if="status.video.pendingBlocks > 0" class="leisure-fee-sub">
                  （{{ status.video.pendingBlocks }} 段）
                </span>
              </dd>
            </div>
          </dl>
          <div class="leisure-actions">
            <el-button
              :type="isRunning('video') ? 'warning' : 'primary'"
              @click="onToggle('video')"
            >
              {{ isRunning('video') ? '暂停' : '开始计时' }}
            </el-button>
          </div>
        </article>
      </div>

      <div v-if="status?.runningKind" class="leisure-running">
        当前「{{ status.runningKind === 'game' ? '玩游戏' : '看视频' }}」已计
        {{ formatQuota(status.runningElapsedSeconds) }}
      </div>

      <div class="leisure-settle-row">
        <el-button
          v-if="status?.runningKind"
          plain
          @click="onPause"
        >
          暂停当前计时
        </el-button>
        <el-button
          type="primary"
          :loading="settling"
          :disabled="status?.curfewActive || (status?.totalPendingFee === 0)"
          @click="onSettle"
        >
          自动结算超额扣款
        </el-button>
        <span v-if="status" class="leisure-settle-hint">
          <template v-if="status.totalPendingFee < 0">
            预计扣款 {{ status.totalPendingFee }} 元（仅结算尚未扣款的超额部分）
          </template>
          <template v-else>今日暂无超额待扣款</template>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.leisure-intro {
  margin: 0 0 14px;
  line-height: 1.55;
}

.leisure-intro strong {
  font-weight: 600;
}

.leisure-curfew {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #b45309;
}

.app-shell.theme-dark .leisure-curfew {
  color: #fbbf24;
}

.leisure-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.leisure-card {
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--app-border-soft);
  background: rgba(15, 23, 42, 0.03);
}

.app-shell.theme-dark .leisure-card {
  background: rgba(15, 23, 42, 0.35);
}

.leisure-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.leisure-card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.leisure-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.25);
  color: var(--app-text-muted);
}

.leisure-badge--on {
  background: rgba(34, 197, 94, 0.2);
  color: #15803d;
  font-weight: 600;
}

.app-shell.theme-dark .leisure-badge--on {
  color: #86efac;
}

.leisure-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin: 0 0 12px;
}

.leisure-stats > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.leisure-stats dt {
  margin: 0;
  color: var(--app-text-muted);
  font-weight: 500;
}

.leisure-stats dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.leisure-fee--warn {
  color: #b45309;
}

.app-shell.theme-dark .leisure-fee--warn {
  color: #fbbf24;
}

.leisure-fee-sub {
  font-weight: 500;
  font-size: 11px;
  color: var(--app-text-muted);
}

.leisure-actions {
  display: flex;
  gap: 8px;
}

.leisure-running {
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--app-primary, #2563eb);
  font-weight: 600;
}

.leisure-settle-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding-top: 4px;
}

.leisure-settle-hint {
  font-size: 12px;
  color: var(--app-text-muted);
}
</style>
