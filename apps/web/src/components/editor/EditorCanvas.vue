<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { CanvasComponent, CanvasSchema } from '@nexa/schema'
import EChart from '@/components/screen/EChart.vue'
import Icon from '@/components/ui/Icon.vue'
import {
  C,
  donutOption,
  map3DOption,
  mapOption,
  miniBarOption,
  sparkOption,
  trendOption,
} from '@/lib/chartOptions'
import { resolveMapKey } from '@/lib/maps'
import type { DatasetData } from '@/services/datasets'

const props = withDefaults(
  defineProps<{
    canvas: CanvasSchema
    selectedId: string | null
    interactive?: boolean
    datasets?: Record<string, DatasetData>
  }>(),
  { interactive: true, datasets: () => ({}) },
)

const emit = defineEmits<{
  (e: 'select', id: string | null): void
  (e: 'move', payload: { id: string; x: number; y: number }): void
}>()

const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1080

const root = ref<HTMLDivElement | null>(null)

interface DragState {
  id: string
  pointerX: number
  pointerY: number
  originX: number
  originY: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  scale: number
}

let drag: DragState | null = null
const draggingId = ref<string | null>(null)

function onNodeMouseDown(event: MouseEvent, component: CanvasComponent) {
  if (!props.interactive) return
  event.stopPropagation()
  event.preventDefault()
  emit('select', component.id)
  if (event.button !== 0 || component.locked || !root.value) return

  const rect = root.value.getBoundingClientRect()
  drag = {
    id: component.id,
    pointerX: event.clientX,
    pointerY: event.clientY,
    originX: component.frame.x,
    originY: component.frame.y,
    minX: 0,
    minY: 0,
    maxX: CANVAS_WIDTH - component.frame.w,
    maxY: CANVAS_HEIGHT - component.frame.h,
    scale: rect.width / CANVAS_WIDTH || 1,
  }
  draggingId.value = component.id
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('mouseup', onPointerUp)
}

function onPointerMove(event: MouseEvent) {
  if (!drag) return
  const dx = (event.clientX - drag.pointerX) / drag.scale
  const dy = (event.clientY - drag.pointerY) / drag.scale
  const x = Math.round(Math.min(drag.maxX, Math.max(drag.minX, drag.originX + dx)))
  const y = Math.round(Math.min(drag.maxY, Math.max(drag.minY, drag.originY + dy)))
  emit('move', { id: drag.id, x, y })
}

function onPointerUp() {
  drag = null
  draggingId.value = null
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  document.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('mouseup', onPointerUp)
}

onBeforeUnmount(onPointerUp)

function onRootMouseDown() {
  if (!props.interactive) return
  emit('select', null)
}

/** 主题色的透明度变体，样式模板的渐变 / 描边 / 光晕都取自这组变量 */
function accentAlpha(color: string, alpha: string): string {
  const hex = /^#([0-9a-fA-F]{6})$/.test(color) ? color.slice(1, 7) : C.mint.slice(1, 7)
  return `#${hex}${alpha}`
}

function nodeStyle(component: CanvasComponent) {
  const style = component.style ?? {}
  const tone = typeof style.color === 'string' ? style.color : C.mint
  return {
    left: `${component.frame.x}px`,
    top: `${component.frame.y}px`,
    width: `${component.frame.w}px`,
    height: `${component.frame.h}px`,
    zIndex: component.zIndex,
    // 用 backgroundColor 而非 background 简写，避免覆盖样式模板的渐变层
    backgroundColor: style.fill ?? 'transparent',
    borderRadius: style.radius === undefined ? '0' : `${style.radius}px`,
    opacity: style.opacity ?? 1,
    color: style.color,
    border: style.border,
    // 舱体模板的渐变、外壳、角标与动画都通过这组变量跟随主题色
    '--node-accent': tone,
    '--nx-a06': accentAlpha(tone, '0F'),
    '--nx-a12': accentAlpha(tone, '1F'),
    '--nx-a20': accentAlpha(tone, '33'),
    '--nx-a32': accentAlpha(tone, '52'),
    '--nx-a45': accentAlpha(tone, '73'),
    '--nx-a60': accentAlpha(tone, '99'),
    '--nx-a80': accentAlpha(tone, 'CC'),
  }
}

function textProp(component: CanvasComponent, key: string, fallback = ''): string {
  const value = component.props?.[key]
  return typeof value === 'string' ? value : fallback
}

/** 图片组件：props.src 支持 https 地址或属性面板上传后的 data URL */
function imageSrc(component: CanvasComponent): string {
  const value = component.props?.src
  return typeof value === 'string' ? value : ''
}

function imageFit(component: CanvasComponent): 'cover' | 'contain' | 'fill' {
  const value = component.props?.fit
  return value === 'contain' || value === 'fill' ? value : 'cover'
}

function numberProp(component: CanvasComponent, key: string): number | undefined {
  const value = component.props?.[key]
  return typeof value === 'number' ? value : undefined
}

function accent(component: CanvasComponent): string {
  return typeof component.style?.color === 'string' ? component.style.color : C.mint
}

function toNumber(value: string | undefined): number {
  if (!value) return 0
  const cleaned = value.replace(/[%¥$,，\s]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function bindingRows(component: CanvasComponent): { category: string; value: number }[] | null {
  const binding = component.binding
  if (!binding) return null
  const dataset = props.datasets[binding.sourceId]
  if (!dataset) return null
  const categoryKey = binding.fields.category || dataset.columns[0]
  const valueKey = binding.fields.value || dataset.columns[1] || dataset.columns[0]
  return dataset.rows
    .slice(0, 24)
    .map((row) => ({ category: row[categoryKey] ?? '', value: toNumber(row[valueKey]) }))
}

function boundTable(component: CanvasComponent) {
  const binding = component.binding
  if (!binding) return null
  const dataset = props.datasets[binding.sourceId]
  if (!dataset) return null
  const columns = dataset.columns.slice(0, 5)
  const size = numberProp(component, 'pageSize') ?? 6
  const rows = dataset.rows.slice(0, Math.max(1, Math.min(12, size)))
  return { columns, rows }
}

function metricDisplay(component: CanvasComponent): string {
  const binding = component.binding
  if (!binding) return textProp(component, 'value', '—')
  const dataset = props.datasets[binding.sourceId]
  if (!dataset || !dataset.rows.length) return textProp(component, 'value', '—')
  const valueKey = binding.fields.value || dataset.columns[1] || dataset.columns[0]
  return dataset.rows[0][valueKey] || '—'
}

function metricSpark(component: CanvasComponent) {
  const rows = bindingRows(component)
  if (rows && rows.length > 1) return sparkOption(rows.map((row) => row.value), accent(component))
  return sparkOption([12, 18, 16, 24, 22, 30, 28, 36], accent(component))
}

function boundChartOption(component: CanvasComponent, rows: { category: string; value: number }[]) {
  const color = accent(component)
  const axisLabel = { color: '#647a8c', fontSize: 11 }
  const splitLine = { lineStyle: { color: 'rgba(255,255,255,0.06)' } }

  if (component.type === 'chart.pie') {
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      series: [{ type: 'pie', radius: ['45%', '70%'], label: { color: '#cfe0ea', fontSize: 11 }, itemStyle: { borderWidth: 0 }, data: rows.map((row) => ({ name: row.category, value: row.value })) }],
    }
  }

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: rows.map((row) => row.category), axisLabel, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel, splitLine },
    series: [{
      type: component.type === 'chart.bar' ? 'bar' : (component.type === 'chart.area' ? 'line' : 'line'),
      smooth: true,
      symbolSize: 5,
      data: rows.map((row) => row.value),
      itemStyle: { color },
      lineStyle: { color, width: 2 },
      areaStyle: component.type === 'chart.area' ? { color: 'rgba(94,242,194,0.18)' } : undefined,
      barMaxWidth: 22,
    }],
  }
}

function chartOption(component: CanvasComponent) {
  const rows = bindingRows(component)
  const mapKey = resolveMapKey(textProp(component, 'map', 'china'))
  if (component.type === 'map.geo') {
    // 地图有绑定数据时按区域着色，不走通用柱状/折线渲染
    if (textProp(component, 'view') === '3d') {
      return map3DOption({
        rows: rows ?? undefined,
        color: accent(component),
        autoRotate: textProp(component, 'autoRotate', 'true') !== 'false',
        mapKey,
      }) as Record<string, unknown>
    }
    return mapOption(mapKey, rows ?? undefined, accent(component)) as Record<string, unknown>
  }
  if (rows && rows.length > 0) return boundChartOption(component, rows) as Record<string, unknown>

  let option: Record<string, unknown>
  switch (component.type) {
    case 'chart.pie':
      option = donutOption() as Record<string, unknown>
      break
    case 'chart.bar':
      option = miniBarOption([32, 45, 38, 52, 47, 61, 55, 70, 64, 78, 72, 86], accent(component)) as Record<string, unknown>
      break
    case 'chart.area':
    case 'chart.line':
    default:
      option = trendOption() as Record<string, unknown>
      break
  }

  return option
}

const tableRows = [
  ['东城一号店', '¥ 328,400', '同比 +12.4%'],
  ['滨江中心店', '¥ 291,600', '同比 +9.8%'],
  ['高新旗舰店', '¥ 264,200', '同比 +7.1%'],
  ['西溪生活店', '¥ 218,900', '同比 +5.6%'],
  ['钱塘社区店', '¥ 186,300', '同比 +3.2%'],
  ['临平新城店', '¥ 152,700', '同比 +1.9%'],
]

function tableColumns(component: CanvasComponent) {
  const size = numberProp(component, 'pageSize') ?? 6
  return tableRows.slice(0, Math.max(1, Math.min(tableRows.length, size)))
}
</script>

<template>
  <div ref="root" class="ec-root" :class="{ 'is-pan-mode': !interactive }"
    :style="{ background: canvas.canvas.background }" @mousedown="onRootMouseDown">
    <div v-for="component in canvas.components" :key="component.id" class="ec-node" :class="{
      'is-selected': selectedId === component.id,
      'is-dragging': draggingId === component.id,
      'is-locked': component.locked,
      [`variant-${component.style?.variant}`]: Boolean(component.style?.variant),
    }" :style="nodeStyle(component)" @mousedown="onNodeMouseDown($event, component)">
      <div class="ec-content">
        <template v-if="component.type === 'text'">
          <div class="ec-text"
            :style="{ fontSize: `${component.style?.fontSize ?? 28}px`, fontWeight: component.style?.fontWeight ?? 600 }">
            {{ textProp(component, 'text', component.name) }}
          </div>
          <div class="ec-subtext">{{ textProp(component, 'subtitle') }}</div>
        </template>

        <template v-else-if="component.type === 'metric'">
          <div class="ec-metric-label">{{ textProp(component, 'label', component.name) }}</div>
          <div class="ec-metric-value" :style="{ fontSize: `${component.style?.fontSize ?? 28}px` }">
            {{ metricDisplay(component) }}<small>{{ textProp(component, 'unit') }}</small>
          </div>
          <div class="ec-metric-spark">
            <EChart :option="metricSpark(component)" />
          </div>
        </template>

        <template v-else-if="component.type === 'table'">
          <div class="ec-chart-title">{{ textProp(component, 'title', component.name) }}</div>
          <div v-if="boundTable(component)" class="ec-table">
            <div class="ec-table-head"
              :style="{ gridTemplateColumns: `repeat(${boundTable(component)!.columns.length}, minmax(0, 1fr))` }">
              <span v-for="column in boundTable(component)!.columns" :key="column">{{ column }}</span>
            </div>
            <div v-for="(row, index) in boundTable(component)!.rows" :key="index" class="ec-table-row"
              :style="{ gridTemplateColumns: `repeat(${boundTable(component)!.columns.length}, minmax(0, 1fr))` }">
              <span v-for="column in boundTable(component)!.columns" :key="column">{{ row[column] }}</span>
            </div>
          </div>
          <div v-else class="ec-table">
            <div class="ec-table-head"><span>名称</span><span>销售</span><span>环比</span></div>
            <div v-for="row in tableColumns(component)" :key="row[0]" class="ec-table-row">
              <span>{{ row[0] }}</span><span>{{ row[1] }}</span><span>{{ row[2] }}</span>
            </div>
          </div>
        </template>

        <template v-else-if="component.type === 'image'">
          <img v-if="imageSrc(component)" class="ec-image" :src="imageSrc(component)"
            :alt="textProp(component, 'alt', component.name)" :style="{ objectFit: imageFit(component) }"
            draggable="false" />
          <div v-else class="ec-placeholder">
            <Icon name="image" :size="20" />
            <span>未设置图片 · 在右侧属性面板上传</span>
          </div>
        </template>

        <template v-else-if="component.type === 'decor'">
          <div class="ec-decor" />
        </template>

        <template v-else>
          <div class="ec-chart-title">{{ textProp(component, 'title', component.name) }}</div>
          <div class="ec-chart">
            <EChart :option="chartOption(component)" />
          </div>
        </template>
      </div>

      <div v-if="selectedId === component.id" class="ec-tag">
        {{ component.name }} · {{ Math.round(component.frame.w) }} × {{ Math.round(component.frame.h) }}
      </div>
    </div>

    <div v-if="!canvas.components.length" class="ec-empty">
      <Icon name="layout" :size="22" />
      <b>画布还是空的</b>
      <span>从左侧组件库添加组件，或让右侧 AI 生成一版 Schema。</span>
    </div>
  </div>
</template>

<style scoped>
.ec-root {
  position: absolute;
  inset: 0;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background: var(--ec-bg, #05090f);
}

/* ========== 舱体样式模板 ==========
 * 只负责容器渐变 / 外壳装饰 / 交互动效 / 循环动画，
 * 颜色全部取自 --nx-a06…--nx-a80（由 nodeStyle 按主题色计算），换主题色即整体变色。
 */
.ec-node {
  --nx-accent: var(--node-accent);
  --nx-corner: 15px;
  position: absolute;
  box-sizing: border-box;
  padding: 18px;
  isolation: isolate;
  cursor: move;
  touch-action: none;
  user-select: none;
  transition:
    transform 0.24s cubic-bezier(0.22, 0.68, 0.32, 1),
    box-shadow 0.24s ease,
    filter 0.24s ease;
}

/* 外壳层：::before 画内框与纹理，::after 画四角 L 形角标，均不参与命中 */
.ec-node::before,
.ec-node::after {
  content: '';
  position: absolute;
  z-index: 0;
  pointer-events: none;
  border-radius: inherit;
}

.ec-node::before {
  inset: 5px;
  border: 1px solid var(--nx-a20);
  opacity: 0.75;
}

.ec-node::after {
  inset: 0;
  background:
    linear-gradient(var(--nx-a60) 0 0) left 0 top 0 / var(--nx-corner) 1.5px no-repeat,
    linear-gradient(var(--nx-a60) 0 0) left 0 top 0 / 1.5px var(--nx-corner) no-repeat,
    linear-gradient(var(--nx-a60) 0 0) right 0 top 0 / var(--nx-corner) 1.5px no-repeat,
    linear-gradient(var(--nx-a60) 0 0) right 0 top 0 / 1.5px var(--nx-corner) no-repeat,
    linear-gradient(var(--nx-a60) 0 0) left 0 bottom 0 / var(--nx-corner) 1.5px no-repeat,
    linear-gradient(var(--nx-a60) 0 0) left 0 bottom 0 / 1.5px var(--nx-corner) no-repeat,
    linear-gradient(var(--nx-a60) 0 0) right 0 bottom 0 / var(--nx-corner) 1.5px no-repeat,
    linear-gradient(var(--nx-a60) 0 0) right 0 bottom 0 / 1.5px var(--nx-corner) no-repeat;
}

/* 1. 深蓝舱体：主推款，深蓝渐变 + 内网格 + 顶部高光 */
.ec-node.variant-panel {
  background-image:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 42%),
    radial-gradient(125% 95% at 50% -12%, var(--nx-a32), transparent 64%),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 46px),
    linear-gradient(168deg, rgba(13, 32, 50, 0.6), rgba(5, 12, 21, 0.8));
  box-shadow:
    0 0 0 1px var(--nx-a45),
    inset 0 0 46px -14px var(--nx-a32),
    0 20px 44px -18px rgba(0, 0, 0, 0.8);
}

.ec-node.variant-panel::before {
  inset: 6px;
  border-color: var(--nx-a32);
  background-image: linear-gradient(90deg, var(--nx-a45), transparent 58%);
  background-size: 100% 1.5px;
  background-repeat: no-repeat;
  opacity: 0.9;
}

/* 2. 暗夜舱体：基础款，深色底 + 顶部高光 + 内框 + 角标 */
.ec-node.variant-card {
  background-image:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 54%),
    radial-gradient(100% 82% at 50% 0%, var(--nx-a20), transparent 64%),
    linear-gradient(180deg, rgba(10, 17, 27, 0.55), rgba(6, 11, 19, 0.75));
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 16px 34px -16px rgba(0, 0, 0, 0.7);
}

/* 3. 玻璃舱体：磨砂背景 + 斜向反光 + 亮边 */
.ec-node.variant-glass {
  background-image:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.02) 46%, rgba(255, 255, 255, 0.12)),
    radial-gradient(100% 80% at 0% 0%, var(--nx-a20), transparent 62%);
  backdrop-filter: blur(14px) saturate(150%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 16px 34px -16px rgba(0, 0, 0, 0.7);
}

/* 4. 科技描边：透明底 + 主题色描边 + 呼吸光晕 */
.ec-node.variant-outline {
  background-image: radial-gradient(110% 90% at 50% 0%, var(--nx-a12), transparent 62%);
  animation: nx-breathe 3.6s ease-in-out infinite;
}

.ec-node.variant-outline::before {
  inset: 4px;
  border-color: var(--nx-a32);
}

.ec-node.variant-outline::after {
  --nx-corner: 18px;
}

@keyframes nx-breathe {

  0%,
  100% {
    box-shadow:
      0 0 0 1px var(--nx-a20),
      0 0 16px -10px var(--nx-a20),
      inset 0 0 22px -12px var(--nx-a12);
  }

  50% {
    box-shadow:
      0 0 0 1px var(--nx-accent),
      0 0 30px -6px var(--nx-a60),
      inset 0 0 34px -6px var(--nx-a32);
  }
}

/* 5. 极简舱体：无底无框，只留角标与顶部短线 */
.ec-node.variant-minimal {
  padding: 10px;
  background-image: none;
  box-shadow: none;
}

.ec-node.variant-minimal::before {
  inset: 0;
  border: 0;
  background-image: linear-gradient(90deg, var(--nx-a60), transparent 65%);
  background-size: 34% 1px;
  background-repeat: no-repeat;
  opacity: 0.9;
}

.ec-node.variant-minimal::after {
  --nx-corner: 13px;
  opacity: 0.6;
}

/* 6. 色块强调：主题色渐变块 + 斜纹肌理 + 内发光 */
.ec-node.variant-solid {
  background-image:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.055) 0 2px, transparent 2px 9px),
    linear-gradient(160deg, var(--nx-a45), var(--nx-a12) 68%, var(--nx-a06));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    inset 0 0 36px -6px var(--nx-a32),
    0 14px 30px -16px rgba(0, 0, 0, 0.6);
}

/* 7. 全息投影：青蓝渐变 + 网格纹理 + 循环扫描线 */
.ec-node.variant-holo {
  background-image:
    radial-gradient(120% 90% at 50% -18%, var(--nx-a45), transparent 62%),
    linear-gradient(180deg, rgba(8, 22, 32, 0.5), rgba(5, 14, 22, 0.75));
  box-shadow:
    0 0 0 1px var(--nx-a60),
    0 0 26px -8px var(--nx-a45),
    inset 0 0 34px -12px var(--nx-a32);
}

.ec-node.variant-holo::before {
  inset: 0;
  border: 0;
  background-image:
    linear-gradient(180deg, transparent 0%, var(--nx-a20) 42%, var(--nx-a45) 50%, transparent 62%),
    repeating-linear-gradient(0deg, var(--nx-a12) 0 1px, transparent 1px 6px);
  background-size: 100% 55%, 100% 100%;
  background-position: 0 -70%, 0 0;
  background-repeat: no-repeat, repeat;
  animation: nx-scan 5.2s linear infinite;
  opacity: 0.9;
}

@keyframes nx-scan {
  0% {
    background-position: 0 -70%, 0 0;
  }

  100% {
    background-position: 0 170%, 0 0;
  }
}

/* 8. 霓虹发光：深底 + 双层外发光 + 上下流光带 */
.ec-node.variant-neon {
  background-image:
    radial-gradient(120% 92% at 50% 0%, var(--nx-a20), transparent 60%),
    linear-gradient(180deg, rgba(7, 11, 19, 0.7), rgba(4, 7, 12, 0.88));
  box-shadow:
    0 0 0 1px var(--nx-a60),
    0 0 18px -2px var(--nx-a45),
    0 0 42px -10px var(--nx-a32),
    inset 0 0 26px -8px var(--nx-a20);
}

.ec-node.variant-neon::before {
  inset: 6px;
  border-color: var(--nx-a32);
  background-image:
    linear-gradient(90deg, transparent, var(--nx-a80), transparent),
    linear-gradient(90deg, transparent, var(--nx-a80), transparent);
  background-size: 42% 1.5px, 42% 1.5px;
  background-position: -60% 0, 160% 100%;
  background-repeat: no-repeat;
  animation: nx-neon-flow 4.6s linear infinite;
  opacity: 1;
}

@keyframes nx-neon-flow {
  0% {
    background-position: -60% 0, 160% 100%;
  }

  100% {
    background-position: 160% 0, -60% 100%;
  }
}

/* 9. 极光渐变：多层径向渐变缓慢流动 */
.ec-node.variant-aurora {
  --nx-corner: 16px;
  background-image:
    radial-gradient(55% 72% at 12% 0%, var(--nx-a45), transparent 62%),
    radial-gradient(52% 62% at 88% 12%, var(--nx-a32), transparent 66%),
    radial-gradient(72% 82% at 50% 112%, var(--nx-a20), transparent 72%),
    linear-gradient(180deg, rgba(8, 18, 26, 0.5), rgba(6, 12, 20, 0.78));
  background-size: 170% 170%, 160% 160%, 180% 180%, 100% 100%;
  background-position: 0 0, 100% 0, 50% 100%, 0 0;
  background-repeat: no-repeat;
  animation: nx-aurora-drift 18s ease-in-out infinite alternate;
  box-shadow:
    0 0 0 1px var(--nx-a20),
    inset 0 0 44px -16px var(--nx-a32),
    0 18px 40px -18px rgba(0, 0, 0, 0.75);
}

@keyframes nx-aurora-drift {
  0% {
    background-position: 0 0, 100% 0, 50% 100%, 0 0;
  }

  100% {
    background-position: 26% 24%, 74% 30%, 36% 78%, 0 0;
  }
}

/* 标题前的主题色小光条，呼应舱体标题栏 */
.ec-node.variant-panel .ec-chart-title::before,
.ec-node.variant-outline .ec-chart-title::before,
.ec-node.variant-neon .ec-chart-title::before,
.ec-node.variant-holo .ec-chart-title::before,
.ec-node.variant-aurora .ec-chart-title::before,
.ec-node.variant-solid .ec-chart-title::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 10px;
  margin-right: 7px;
  vertical-align: -1px;
  border-radius: 1px;
  background: var(--nx-accent);
  box-shadow: 0 0 8px var(--nx-a60);
}

/* 交互：悬停上浮 + 提亮 */
.ec-node:not(.is-dragging):hover {
  transform: translateY(-2px);
  filter: brightness(1.06) saturate(1.06);
  outline: 1px dashed var(--nx-a45);
  outline-offset: -1px;
}

.ec-node.is-selected,
.ec-node.is-dragging {
  animation: none;
  outline: 1.5px solid #5ef2c2;
  outline-offset: -1px;
  box-shadow: 0 0 0 1px rgba(5, 9, 15, 0.45), 0 0 26px rgba(94, 242, 194, 0.22);
}

.ec-node.is-dragging {
  cursor: grabbing;
  box-shadow: 0 0 0 1px rgba(5, 9, 15, 0.45), 0 0 36px rgba(94, 242, 194, 0.3);
}

.ec-node.is-locked {
  cursor: not-allowed;
}

.ec-root.is-pan-mode .ec-node {
  cursor: inherit;
}

.ec-root.is-pan-mode .ec-node:hover {
  outline: none;
  transform: none;
  filter: none;
}

.ec-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.ec-tag {
  position: absolute;
  z-index: 3;
  left: -1.5px;
  top: -24px;
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  background: #5ef2c2;
  color: #04130f;
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
}

.ec-text {
  color: #eaf2f8;
  line-height: 1.3;
}

.ec-subtext {
  margin-top: 4px;
  color: #5a6a7e;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.ec-metric-label {
  color: #7f93a7;
  font-size: 13px;
}

.ec-metric-value {
  margin-top: 8px;
  color: inherit;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.1;
}

.ec-metric-value small {
  margin-left: 5px;
  color: #5f7182;
  font-size: 11px;
  font-weight: 400;
}

.ec-metric-spark {
  flex: 1;
  min-height: 0;
  margin-top: 6px;
  opacity: 0.85;
}

.ec-chart-title {
  flex: 0 0 auto;
  margin-bottom: 8px;
  color: #9fb2c3;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.ec-chart {
  flex: 1;
  min-height: 0;
}

.ec-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  overflow: hidden;
  font-size: 11px;
}

.ec-table-head,
.ec-table-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 8px;
  padding: 4px 0;
}

.ec-table-head {
  color: #4f6274;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.ec-table-row {
  color: #8ea3b5;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.04);
}

.ec-table-row span:last-child {
  color: #5ef2c2;
}

.ec-image {
  display: block;
  flex: 1;
  width: 100%;
  min-height: 0;
  object-fit: cover;
  border-radius: inherit;
  pointer-events: none;
  -webkit-user-drag: none;
}

.ec-placeholder,
.ec-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #4f6274;
  font-size: 12px;
}

.ec-decor {
  width: 100%;
  height: 100%;
  border: 1px dashed rgba(94, 242, 194, 0.18);
  border-radius: 6px;
}

.ec-empty {
  position: absolute;
  inset: 0;
  gap: 8px;
}

.ec-empty b {
  color: #8ea3b5;
  font-size: 14px;
  font-weight: 600;
}

.ec-empty span {
  font-size: 11px;
}
</style>
