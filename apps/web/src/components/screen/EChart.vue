<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { echarts, ensureChinaMap } from '@/lib/echarts'

const props = withDefaults(
  defineProps<{
    option: any
    autoResize?: boolean
  }>(),
  { autoResize: true },
)

const el = ref<HTMLDivElement | null>(null)
let chart: ReturnType<typeof echarts.init> | null = null
let ro: ResizeObserver | null = null
let lastMapKey: string | null = null

function currentMapKey(): string | null {
  const series = (props.option?.series ?? []) as Array<{ type?: string; map?: string }>
  const mapSeries = series.find((item) => item.type === 'map3D')
  if (mapSeries?.map) return mapSeries.map
  const geo = props.option?.geo as { map?: string } | { map?: string }[] | undefined
  const geoOption = Array.isArray(geo) ? geo[0] : geo
  return geoOption?.map ?? null
}

function createChart() {
  if (!el.value) return
  ensureChinaMap()
  chart = echarts.init(el.value, null, {
    renderer: 'canvas',
    devicePixelRatio: Math.min(2, window.devicePixelRatio || 1),
  })
  chart.setOption(props.option, { notMerge: true, lazyUpdate: false })
}

function render() {
  if (!chart || !el.value) return
  const mapKey = currentMapKey()
  // ECharts GL 的 map3D 切换 map 时不会重建区域轮廓缓存，旧底图的边线会残留，
  // 因此底图变化时销毁实例重新初始化。
  if (mapKey && lastMapKey && mapKey !== lastMapKey) {
    chart.dispose()
    chart = null
    lastMapKey = null
    createChart()
    return
  }
  lastMapKey = mapKey
  chart.setOption(props.option, { notMerge: true, lazyUpdate: false })
}

onMounted(async () => {
  await nextTick()
  if (!el.value) return
  lastMapKey = currentMapKey()
  createChart()
  if (props.autoResize) {
    ro = new ResizeObserver(() => chart?.resize())
    ro.observe(el.value)
    window.addEventListener('resize', onWindowResize)
  }
})

function onWindowResize() {
  chart?.resize()
}

watch(
  () => props.option,
  () => render(),
  { deep: true },
)

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', onWindowResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="echart-host" />
</template>

<style scoped>
.echart-host {
  width: 100%;
  height: 100%;
  min-width: 1px;
  min-height: 1px;
}
</style>
