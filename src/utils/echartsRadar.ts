import type { ECharts } from 'echarts/core'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { RadarComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([RadarComponent, TooltipComponent, RadarChart, CanvasRenderer])

export type { ECharts }

export async function initRadarChart(el: HTMLElement) {
  return echarts.init(el)
}

export { echarts }
