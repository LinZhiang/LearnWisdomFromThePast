<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { resolveWenTitle, resolveWuTitle } from '@/views/learning/question-bank-score/rank-data'
import { buildWenWuRankings, type RankRow } from './ranking-data'
import { scrollRankTableToSelf } from './scroll-table-to-self'

type Row = RankRow & { rank: number }

const wenTable = ref<Row[]>([])
const wuTable = ref<Row[]>([])

const wenTableInst = ref<ComponentPublicInstance | null>(null)
const wuTableInst = ref<ComponentPublicInstance | null>(null)

const scrollToSelf = async () => {
  await nextTick()
  await nextTick()
  requestAnimationFrame(() => {
    scrollRankTableToSelf(wenTableInst.value)
    scrollRankTableToSelf(wuTableInst.value)
  })
}

const reload = async () => {
  const { wenTable: w, wuTable: u } = buildWenWuRankings()
  wenTable.value = w
  wuTable.value = u
  await scrollToSelf()
}

onMounted(() => {
  void reload()
})

const rowClassName = ({ row }: { row: Row }) => {
  if (row.isSelf) return 'rank-row-self'
  if (row.isFixed) return 'rank-row-fixed'
  return ''
}

const selfWenRow = computed(() => wenTable.value.find((r) => r.isSelf))
const selfWuRow = computed(() => wuTable.value.find((r) => r.isSelf))
</script>

<template>
  <div class="rank-page-root">
    <section class="rank-page-inner">
      <header class="page-hero">
        <span class="page-kicker">智学 05</span>
        <h2 class="page-title">分数排名</h2>
        <p class="page-subtitle">
          随机 500 名中文姓名选手 + 固定历史人物 +「我」（当前文武分）。<strong>文职榜</strong>按文分降序，<strong>武职榜</strong>按武分降序。每名选手的文、武分各自独立分层：恰好
          3%（15 人）在 -1500～0；86%（430 人）在 0～10000（幂分布，越高越稀）；1%（5 人）在 10000～35000（幂分布，越高越稀）；并在高段各指定 1 人文、武分为
          35000。随机角色在<strong>文、武各自 0～8000 分</strong>区间内<strong>互不重复</strong>（超出后顺移到 8001～10000 等未占用分）。
        </p>
        <p class="rank-actions">
          <el-button type="primary" plain @click="reload">重新随机</el-button>
          <el-button type="primary" @click="scrollToSelf">跳转到我的位置</el-button>
        </p>
      </header>

      <aside v-if="selfWenRow && selfWuRow" class="rank-self-highlight" aria-label="当前角色概况">
        <div class="rank-self-highlight-head">
          <span class="rank-self-badge">当前角色</span>
          <h3 class="rank-self-name">我</h3>
        </div>
        <dl class="rank-self-grid">
          <div class="rank-self-cell rank-self-cell--num">
            <dt>文分</dt>
            <dd>{{ selfWenRow.wenScore }}</dd>
          </div>
          <div class="rank-self-cell rank-self-cell--num">
            <dt>武分</dt>
            <dd>{{ selfWuRow.wuScore }}</dd>
          </div>
          <div class="rank-self-cell">
            <dt>文职品阶</dt>
            <dd>{{ resolveWenTitle(selfWenRow.wenScore) }}</dd>
          </div>
          <div class="rank-self-cell">
            <dt>武职品阶</dt>
            <dd>{{ resolveWuTitle(selfWuRow.wuScore) }}</dd>
          </div>
          <div class="rank-self-cell rank-self-cell--rank">
            <dt>文职榜排名</dt>
            <dd>第 <strong>{{ selfWenRow.rank }}</strong> 名</dd>
          </div>
          <div class="rank-self-cell rank-self-cell--rank">
            <dt>武职榜排名</dt>
            <dd>第 <strong>{{ selfWuRow.rank }}</strong> 名</dd>
          </div>
        </dl>
        <p class="rank-self-foot">共 {{ wenTable.length }} 人参与排名（含随机选手与固定名单）。</p>
      </aside>

      <div class="rank-tables">
        <div class="rank-table-block">
          <h3 class="rank-table-title">文职榜（按文分）</h3>
          <el-table
            ref="wenTableInst"
            class="rank-el-table"
            :data="wenTable"
            stripe
            border
            size="small"
            :max-height="520"
            :row-class-name="rowClassName"
          >
            <el-table-column prop="rank" label="排名" width="72" align="center" />
            <el-table-column prop="name" label="姓名" min-width="100" />
            <el-table-column prop="wenScore" label="文分" width="100" align="right" />
            <el-table-column label="文职品阶" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">
                {{ resolveWenTitle(row.wenScore) }}
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="rank-table-block">
          <h3 class="rank-table-title">武职榜（按武分）</h3>
          <el-table
            ref="wuTableInst"
            class="rank-el-table"
            :data="wuTable"
            stripe
            border
            size="small"
            :max-height="520"
            :row-class-name="rowClassName"
          >
            <el-table-column prop="rank" label="排名" width="72" align="center" />
            <el-table-column prop="name" label="姓名" min-width="100" />
            <el-table-column prop="wuScore" label="武分" width="100" align="right" />
            <el-table-column label="武职品阶" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">
                {{ resolveWuTitle(row.wuScore) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.rank-page-root {
  width: 100%;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.rank-page-inner {
  width: 100%;
  max-width: min(96vw, 72rem);
  padding: 0 8px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rank-actions {
  margin: 10px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.rank-self-highlight {
  border: 2px solid var(--app-primary);
  border-radius: 14px;
  padding: 16px 18px 14px;
  background: linear-gradient(
    145deg,
    var(--app-primary-soft, #dbeafe) 0%,
    var(--app-surface, #fff) 42%,
    var(--app-surface-alt, #f8fafc) 100%
  );
  box-shadow: 0 6px 22px rgba(37, 99, 235, 0.12);
}

.rank-self-highlight-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.rank-self-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fff;
  background: var(--app-primary, #2563eb);
}

.rank-self-name {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.rank-self-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 14px 18px;
  margin: 14px 0 0;
}

.rank-self-cell {
  margin: 0;
}

.rank-self-cell dt {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-muted);
  letter-spacing: 0.02em;
}

.rank-self-cell dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  font-weight: 600;
  color: var(--app-text);
  word-break: break-word;
}

.rank-self-cell--num dd {
  font-size: 1.65rem;
  font-weight: 800;
  color: var(--app-primary, #2563eb);
  letter-spacing: 0.02em;
}

.rank-self-cell--rank strong {
  font-size: 1.25rem;
  color: var(--app-primary, #2563eb);
}

.rank-self-foot {
  margin: 14px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--app-border-soft);
  font-size: 12px;
  color: var(--app-text-muted);
}

.rank-tables {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 960px) {
  .rank-tables {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    align-items: start;
  }
}

.rank-table-title {
  margin: 0 0 10px;
  font-size: 1.05rem;
  font-weight: 600;
}

.rank-table-block {
  min-width: 0;
}

.rank-el-table {
  width: 100%;
}
</style>

<style>
/* el-table 行类名挂在表格内部，需非 scoped */
.rank-el-table .rank-row-self > td {
  background-color: var(--app-primary-soft, #dbeafe) !important;
  font-weight: 600;
}

.rank-el-table .rank-row-fixed > td {
  background-color: rgba(250, 204, 21, 0.12) !important;
}
</style>
