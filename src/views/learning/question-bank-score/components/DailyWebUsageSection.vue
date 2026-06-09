<script setup lang="ts">
defineProps<{
  todayKey: string
  todayLabel: string
}>()
</script>

<template>
  <div class="score-section">
    <h3 class="score-section-title">今日网页学习时长</h3>
    <p class="score-muted">
      仅统计前台标签页<strong>可见</strong>且停留在<strong>学习类菜单</strong>（学习类型编辑、学习题库、题库收藏、答题日志、错题本、思维导图、资料整理）时的累计时长；在学习分数、金钱消费、分数排名、设置等页面不计入。切换后台、离开上述菜单或关闭页时会落盘，约每 30 秒也会自动保存一次。同一套时长每累计满
      <strong>30 分钟</strong>，会为<strong>文分 +20</strong>（余数滚入下次，与「学习分数」页文武分同源存储）。
    </p>
    <p class="score-today-value">{{ todayLabel }}</p>
    <p class="score-muted score-date-tag">日期：{{ todayKey }}</p>
  </div>
</template>
