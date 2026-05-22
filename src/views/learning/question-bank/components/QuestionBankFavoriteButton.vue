<script setup lang="ts">
import { Star, StarFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref, watch } from 'vue'
import type { QuestionFavoriteTarget } from '@/services/favorite-question-helpers'
import {
  findFavoriteMatch,
  toggleFavorite,
} from '@/services/favorite-question-helpers'

const props = defineProps<{
  learningTypeId: number | null
  target: QuestionFavoriteTarget | null
  /** 为 true 时使用纯文字样式（如详情顶栏） */
  plain?: boolean
}>()

const emit = defineEmits<{
  (e: 'removed'): void
}>()

const busy = ref(false)
const favorited = ref(false)

async function refresh() {
  const tid = props.learningTypeId
  const t = props.target
  if (tid == null || !t) {
    favorited.value = false
    return
  }
  const row = await findFavoriteMatch(tid, t)
  favorited.value = row != null
}

watch(
  () => [props.learningTypeId, props.target] as const,
  () => {
    void refresh()
  },
  { deep: true },
)

onMounted(() => {
  void refresh()
})

async function onClick() {
  const tid = props.learningTypeId
  const t = props.target
  if (tid == null || !t) {
    ElMessage.warning('缺少学习类型，无法收藏。')
    return
  }
  busy.value = true
  try {
    const r = await toggleFavorite(tid, t)
    favorited.value = r === 'added'
    ElMessage.success(r === 'added' ? '已加入题库收藏。' : '已取消收藏。')
    if (r === 'removed') emit('removed')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    busy.value = false
  }
}

defineExpose({ refresh })
</script>

<template>
  <el-button
    v-if="target != null && learningTypeId != null"
    :type="favorited ? 'warning' : 'default'"
    :plain="plain"
    :loading="busy"
    :icon="favorited ? StarFilled : Star"
    @click="onClick"
  >
    {{ favorited ? '已收藏' : '收藏题目' }}
  </el-button>
</template>
