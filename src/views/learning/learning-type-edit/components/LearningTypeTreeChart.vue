<script setup lang="ts">
import * as echarts from 'echarts'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppearanceStore } from '@/stores/appearance'

type ChartTreeNode = {
  name: string
  value: string
  children: ChartTreeNode[]
}

const props = defineProps<{
  data: ChartTreeNode[]
}>()

const { themeStyle } = storeToRefs(useAppearanceStore())
/** 与学习题库 markmap 深色纯白、浅色深字一致；并显式去掉 ECharts 默认描边/阴影 */
const chartTextColor = computed(() => {
  if (themeStyle.value === 'dark') return '#ffffff'
  if (themeStyle.value === 'soft') return '#3f3f46'
  return '#111827'
})

/** 各主题显式连线色；浅色/柔和下勿用 undefined，否则易退化成与雪景底接近的浅线而「看不见」 */
const chartLineColor = computed(() => {
  if (themeStyle.value === 'dark') return 'rgba(148, 163, 184, 0.75)'
  if (themeStyle.value === 'soft') return 'rgba(99, 102, 241, 0.5)'
  return 'rgba(51, 65, 85, 0.62)'
})

const chartFont =
  'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'

const chartRef = ref<HTMLDivElement | null>(null)
const chartInstance = ref<echarts.ECharts | null>(null)

const buildRich = (color: string) =>
  ({
    lv1: {
      color,
      fontFamily: chartFont,
      fontSize: 18,
      fontWeight: 700,
      lineHeight: 28,
      textBorderWidth: 0,
      textShadowBlur: 0,
      textShadowColor: 'transparent',
    },
    lv2: {
      color,
      fontFamily: chartFont,
      fontSize: 15,
      fontWeight: 650,
      lineHeight: 24,
      textBorderWidth: 0,
      textShadowBlur: 0,
      textShadowColor: 'transparent',
    },
    lvN: {
      color,
      fontFamily: chartFont,
      fontSize: 16,
      fontWeight: 500,
      lineHeight: 22,
      textBorderWidth: 0,
      textShadowBlur: 0,
      textShadowColor: 'transparent',
    },
  }) as const

/** 与 el-tree 的 node.level 一致：1=根、2=子、≥3=普通字重字号。tree 系列用 treeAncestors（含虚拟根），不是 treePathInfo。 */
const getTreeLevel = (params: {
  treeAncestors?: Array<unknown>
  treePathInfo?: Array<unknown>
}) => {
  const path = params.treeAncestors ?? params.treePathInfo
  const pathLength = path?.length ?? 0
  return Math.max(1, pathLength - 1)
}

const labelFormatter = (params: {
  name: string
  treeAncestors?: Array<unknown>
  treePathInfo?: Array<unknown>
}) => {
  const level = getTreeLevel(params)
  if (level === 1) return `{lv1|${params.name}}`
  if (level === 2) return `{lv2|${params.name}}`
  return `{lvN|${params.name}}`
}

const countNodes = (nodes: ChartTreeNode[]): number => {
  let count = 0
  const walk = (list: ChartTreeNode[]) => {
    list.forEach((node) => {
      count += 1
      if (node.children.length > 0) {
        walk(node.children)
      }
    })
  }
  walk(nodes)
  return count
}

const renderChart = async () => {
  await nextTick()
  if (!chartRef.value) return
  if (!chartInstance.value) {
    chartInstance.value = echarts.init(chartRef.value)
  }

  const data =
    props.data.length === 0
      ? [{ name: '暂无学习类型', value: '请先创建父类或子类', children: [] }]
      : props.data

  const totalNodes = countNodes(data)
  const panelHeight = chartRef.value.clientHeight || 620
  const overlapLikely = totalNodes > Math.floor(panelHeight / 24)
  const labelRotate = overlapLikely ? 90 : 0
  const labelOffset = overlapLikely ? [0, 8] : [0, 0]
  const leafLabelOffset = overlapLikely ? [0, 10] : [0, 0]
  const tooltipWrapStyle =
    'max-width: 260px; white-space: normal; overflow-wrap: anywhere; word-break: break-word;'

  const c = chartTextColor.value
  const lineC = chartLineColor.value
  const rich = buildRich(c)

  chartInstance.value.clear()
  chartInstance.value.setOption(
    {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: { data: { value?: string } }) => {
          const value = params.data.value || '无描述'
          return `<div style="${tooltipWrapStyle}">${value}</div>`
        },
      },
      series: [
        {
          type: 'tree',
          data,
          roam: true,
          scaleLimit: {
            min: 0.4,
            max: 1.4,
          },
          top: '5%',
          left: '7%',
          bottom: '5%',
          right: '20%',
          symbolSize: 8,
          nodeGap: 28,
          orient: 'LR',
          expandAndCollapse: true,
          initialTreeDepth: -1,
          emphasis: {
            focus: 'descendant',
            label: {
              color: c,
              textBorderWidth: 0,
              textShadowBlur: 0,
              rich,
            },
            lineStyle: {
              width: 2,
              color: lineC,
            },
          },
          label: {
            position: 'left',
            verticalAlign: 'middle',
            align: 'right',
            color: c,
            fontFamily: chartFont,
            fontSize: 16,
            lineHeight: 22,
            textBorderWidth: 0,
            textBorderColor: 'transparent',
            textShadowBlur: 0,
            textShadowColor: 'transparent',
            width: 120,
            overflow: 'break',
            rotate: labelRotate,
            offset: labelOffset,
            formatter: labelFormatter,
            rich,
          },
          leaves: {
            label: {
              position: 'right',
              verticalAlign: 'middle',
              align: 'left',
              color: c,
              fontFamily: chartFont,
              fontSize: 16,
              lineHeight: 22,
              textBorderWidth: 0,
              textBorderColor: 'transparent',
              textShadowBlur: 0,
              textShadowColor: 'transparent',
              width: 140,
              overflow: 'break',
              rotate: labelRotate,
              offset: leafLabelOffset,
              formatter: labelFormatter,
              rich,
            },
          },
          lineStyle: {
            width: 1.5,
            color: lineC,
            curveness: 0.5,
          },
        },
      ],
    },
    true,
  )
}

const onResize = () => {
  chartInstance.value?.resize()
}

watch(
  () => props.data,
  () => {
    void renderChart()
  },
  { deep: true },
)

watch(chartTextColor, () => {
  void renderChart()
})

onMounted(() => {
  window.addEventListener('resize', onResize)
  void renderChart()
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  chartInstance.value?.dispose()
  chartInstance.value = null
})
</script>

<template>
  <div ref="chartRef" class="type-chart" />
</template>

<style scoped>
.type-chart {
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  min-height: 620px;
}
</style>
