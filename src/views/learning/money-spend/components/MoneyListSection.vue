<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import '../../question-bank-score/score-section.css'
import { moneyList } from '../../question-bank-score/hook'
import {
  isMoneyCurfewActive,
  MoneySettlementBlockedError,
  moneyCurfewMessage,
} from '@/services/money-rule-auto'
import { useUserMoney } from '../composables/useUserMoney'
import { formatMoneyDelta, moneyDeltaClass } from '../money-format'
import '../money-spend-shared.css'

const expanded = ref(false)
const { registerDelta } = useUserMoney()

function applyRow(row: { name: string; money: number }) {
  if (isMoneyCurfewActive()) {
    ElMessage.warning(moneyCurfewMessage())
    return
  }
  try {
    const balance = registerDelta(row.money)
    ElMessage.success(
      `已登记「${row.name}」${formatMoneyDelta(row.money)} 元，当前余额 ${balance} 元`,
    )
  } catch (e) {
    if (e instanceof MoneySettlementBlockedError) {
      ElMessage.warning(moneyCurfewMessage())
      return
    }
    ElMessage.error('登记失败，请重试')
  }
}
</script>

<template>
  <section class="score-section money-spend-block" aria-labelledby="money-list-title">
    <div class="money-section-head">
      <h3 id="money-list-title" class="score-section-title money-section-title">日常收支项目</h3>
      <button
        type="button"
        class="money-section-toggle"
        :aria-expanded="expanded"
        aria-controls="money-list-panel"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起详情' : '展开详情' }}
      </button>
    </div>
    <p v-if="!expanded" class="score-muted money-section-collapsed-hint">
      点击「展开详情」查看日常收支项目列表。
    </p>
    <div v-show="expanded" id="money-list-panel" class="money-section-panel">
      <p class="score-muted">
        下列为可登记或自动结算的金钱变动项；正数为收入，负数为支出（单位：元）。
      </p>
      <div class="score-table-wrap">
        <table class="score-table money-spend-table">
          <thead>
            <tr>
              <th>项目</th>
              <th class="money-col-amount">金额变动</th>
              <th class="money-col-action">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in moneyList" :key="idx">
              <td>{{ row.name }}</td>
              <td class="money-col-amount">
                <span :class="['money-delta', moneyDeltaClass(row.money)]">
                  {{ formatMoneyDelta(row.money) }}
                </span>
              </td>
              <td class="money-col-action">
                <el-button
                  type="primary"
                  plain
                  size="small"
                  :disabled="isMoneyCurfewActive()"
                  @click="applyRow(row)"
                >
                  登记
                </el-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
