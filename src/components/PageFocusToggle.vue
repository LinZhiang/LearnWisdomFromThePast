<script setup lang="ts">
import { FullScreen, Close } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { usePageFocusStore } from '@/stores/page-focus'

const props = withDefaults(
  defineProps<{
    size?: 'small' | 'default' | 'large'
    iconOnly?: boolean
    /** browser：顶栏仅网页全屏；stretch：查看/测验仅内页拉伸 */
    variant?: 'browser' | 'stretch'
  }>(),
  {
    size: 'default',
    iconOnly: false,
    variant: 'browser',
  },
)

const pageFocus = usePageFocusStore()
const { isStretch, isBrowserFullscreen } = storeToRefs(pageFocus)

const isOn = computed(() =>
  props.variant === 'stretch' ? isStretch.value : isBrowserFullscreen.value,
)

const label = computed(() => (isOn.value ? '退出全屏' : '全屏'))

const tip = computed(() => {
  if (props.variant === 'stretch') {
    return isOn.value
      ? '退出全屏（Esc）：恢复顶栏与常规边距'
      : '内页全屏：隐藏站点顶栏，题目区域铺满窗口（不进入浏览器全屏）'
  }
  return isOn.value
    ? '退出网页全屏（Esc）'
    : '网页全屏：浏览器全屏显示本页（Esc 退出）'
})

function onClick() {
  if (props.variant === 'stretch') pageFocus.toggleStretch()
  else void pageFocus.toggleBrowserFullscreen()
}
</script>

<template>
  <el-tooltip
    :content="tip"
    placement="bottom"
    :teleported="false"
    :show-after="400"
    class="page-focus-toggle-wrap"
  >
    <el-button
      :size="size"
      plain
      :type="isOn ? 'primary' : 'default'"
      :aria-pressed="isOn"
      :aria-label="label"
      class="page-focus-toggle-btn"
      @click="onClick"
    >
      <el-icon v-if="isOn" class="page-focus-toggle__icon"><Close /></el-icon>
      <el-icon v-else class="page-focus-toggle__icon"><FullScreen /></el-icon>
      <span v-if="!iconOnly" class="page-focus-toggle__text">{{ label }}</span>
    </el-button>
  </el-tooltip>
</template>

<style scoped>
.page-focus-toggle-wrap {
  display: inline-flex;
  vertical-align: middle;
}

.page-focus-toggle-btn {
  vertical-align: middle;
}

.page-focus-toggle__icon {
  font-size: 1em;
}

.page-focus-toggle__text {
  margin-left: 6px;
}
</style>
