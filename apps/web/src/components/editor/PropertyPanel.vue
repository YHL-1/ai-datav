<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { CanvasComponent, ComponentFrame, ComponentStyle, ComponentVariant } from '@nexa/schema'
import Icon from '@/components/ui/Icon.vue'
import type { DatasetSummary } from '@/services/datasets'
import { listMapPresets } from '@/lib/maps'
import { uploadImage } from '@/services/uploads'
import {
  DEFAULT_TONE,
  TONE_PRESETS,
  VARIANT_PRESETS,
  toneStyle,
  variantPreview,
  variantStyle,
} from '@/lib/componentStyles'

const props = defineProps<{ component: CanvasComponent | null; datasets?: DatasetSummary[] }>()
const emit = defineEmits<{
  (e: 'update', patch: { frame?: ComponentFrame; style?: ComponentStyle; props?: Record<string, unknown>; locked?: boolean; binding?: CanvasComponent['binding'] }): void
  (e: 'apply'): void
  (e: 'reset'): void
}>()

const form = reactive({ x: 0, y: 0, w: 0, h: 0, radius: 0, fill: '', opacity: 100 })

watch(
  () => props.component,
  (component) => {
    if (!component) return
    form.x = component.frame.x
    form.y = component.frame.y
    form.w = component.frame.w
    form.h = component.frame.h
    form.radius = component.style?.radius ?? 0
    form.fill = component.style?.fill ?? ''
    form.opacity = Math.round((component.style?.opacity ?? 1) * 100)
  },
  { immediate: true },
)

const typeLabels: Record<string, string> = {
  metric: '指标卡',
  'chart.line': '折线图',
  'chart.bar': '柱状图',
  'chart.pie': '环形图',
  'chart.area': '面积图',
  'map.geo': '地图',
  table: '数据表格',
  text: '富文本',
  image: '图片',
  decor: '装饰',
}

const typeLabel = computed(() => (props.component ? typeLabels[props.component.type] ?? props.component.type : ''))

const contentFields = computed(() => {
  const type = props.component?.type
  if (type === 'metric') return [
    { key: 'label', label: '指标名称' },
    { key: 'value', label: '指标数值' },
    { key: 'unit', label: '单位' },
  ]
  if (type === 'text') return [
    { key: 'text', label: '文本内容' },
    { key: 'subtitle', label: '副标题' },
  ]
  if (type === 'table' || type === 'map.geo' || type?.startsWith('chart')) return [{ key: 'title', label: '标题' }]
  if (type === 'image') return [{ key: 'alt', label: '图片描述' }]
  return []
})

function propValue(key: string): string {
  const value = props.component?.props?.[key]
  return typeof value === 'string' ? value : ''
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function emitFrame() {
  if (!props.component) return
  const maxW = 1920 - form.x
  const maxH = 1080 - form.y
  emit('update', {
    frame: {
      x: clamp(Number.isFinite(form.x) ? form.x : 0, 0, 1920),
      y: clamp(Number.isFinite(form.y) ? form.y : 0, 0, 1080),
      w: clamp(Number.isFinite(form.w) ? form.w : 40, 40, Math.max(40, maxW)),
      h: clamp(Number.isFinite(form.h) ? form.h : 24, 24, Math.max(24, maxH)),
    },
  })
}

function emitStyle(patch: ComponentStyle) {
  if (!props.component) return
  emit('update', { style: { ...props.component.style, ...patch } })
}

function emitOpacity() {
  emitStyle({ opacity: clamp(form.opacity, 0, 100) / 100 })
}

function emitFill() {
  if (!props.component) return
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(form.fill)) return
  emitStyle({ fill: form.fill })
}

function emitProp(key: string, value: string) {
  if (!props.component) return
  emit('update', { props: { ...props.component.props, [key]: value } })
}

/* ---------- 图片组件：本地压缩后以 data URL 存进 props.src，不经服务器 ---------- */
const imageSrc = computed(() => propValue('src'))
const imageFit = computed(() => propValue('fit') || 'cover')
const imageBusy = ref(false)
const imageError = ref('')
const imageInput = ref<HTMLInputElement | null>(null)

const FIT_OPTIONS = [
  { value: 'cover', label: '裁切填满' },
  { value: 'contain', label: '完整显示' },
  { value: 'fill', label: '拉伸铺满' },
]

/** 最长边压到 1600px 再上传，避免大图拖慢画布与预览 */
function compressImage(file: File): Promise<{ blob: Blob; name: string }> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      resolve({ blob: file, name: file.name })
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('图片格式无法解析'))
      image.onload = () => {
        const maxSide = 1600
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('当前浏览器不支持画布压缩'))
          return
        }
        context.drawImage(image, 0, 0, width, height)
        const keepPng = file.type === 'image/png'
        const extension = keepPng ? '.png' : '.jpg'
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片压缩失败'))
              return
            }
            const base = file.name.includes('.') ? file.name.slice(0, file.name.lastIndexOf('.')) : file.name
            resolve({ blob, name: `${base}${extension}` })
          },
          keepPng ? 'image/png' : 'image/jpeg',
          0.85,
        )
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

async function pickImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  imageError.value = ''
  if (!file.type.startsWith('image/')) {
    imageError.value = '请选择图片文件（PNG / JPG / WebP / SVG）'
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    imageError.value = '图片不能超过 8 MB'
    return
  }
  imageBusy.value = true
  try {
    const { blob, name } = await compressImage(file)
    const uploaded = await uploadImage(blob, name)
    emitProp('src', uploaded.url)
  } catch (error) {
    imageError.value = error instanceof Error ? error.message : '图片上传失败'
  } finally {
    imageBusy.value = false
  }
}

const mapView = computed(() => (propValue('view') === '3d' ? '3d' : '2d'))
const mapAutoRotate = computed(() => propValue('autoRotate') !== 'false')
/** 自定义底图可随时新增，用函数而非 computed，保证每次渲染都读最新列表 */
function mapPresets() {
  return listMapPresets()
}
const mapKey = computed(() => propValue('map') || listMapPresets()[0].key)

function setMapView(view: '2d' | '3d') {
  emitProp('view', view)
}

function setMapKey(event: Event) {
  emitProp('map', (event.target as HTMLSelectElement).value)
}

function toggleMapRotate() {
  emitProp('autoRotate', mapAutoRotate.value ? 'false' : 'true')
}

const activeVariant = computed(() => props.component?.style?.variant ?? '')
const activeTone = computed(() => (props.component?.style?.color ?? DEFAULT_TONE).toLowerCase())
const customTone = computed(() => {
  const color = props.component?.style?.color
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_TONE
})

function applyVariant(key: ComponentVariant | 'custom') {
  if (!props.component) return
  const base = { ...props.component.style }
  delete base.variant
  const style =
    key === 'custom'
      ? base
      : { ...base, ...variantStyle(key, props.component.style?.color ?? DEFAULT_TONE) }
  emit('update', { style })
}

function applyTone(color: string) {
  if (!props.component) return
  emit('update', { style: toneStyle({ ...props.component.style }, color) })
}

function applyCustomTone(event: Event) {
  applyTone((event.target as HTMLInputElement).value)
}

const bindable = computed(() => {
  const type = props.component?.type
  return Boolean(type && (type.startsWith('chart') || type === 'metric' || type === 'table'))
})

const availableDatasets = computed(() => props.datasets ?? [])

const boundDataset = computed(() => {
  const sourceId = props.component?.binding?.sourceId
  return sourceId ? availableDatasets.value.find((item) => item.id === sourceId) ?? null : null
})

function applyBinding(datasetId: string) {
  if (!props.component) return
  if (!datasetId) {
    emit('update', { binding: undefined })
    return
  }
  const dataset = availableDatasets.value.find((item) => item.id === datasetId)
  const columns = dataset?.columns ?? []
  const current = props.component.binding
  const fields = current?.sourceId === datasetId ? current.fields : {}
  emit('update', {
    binding: {
      sourceId: datasetId,
      path: current?.path ?? '',
      refresh: current?.refresh ?? 0,
      fields: {
        category: fields.category || columns[0] || '',
        value: fields.value || columns[1] || columns[0] || '',
        ...fields,
      },
    },
  })
}

function applyBindingField(key: 'category' | 'value', column: string) {
  if (!props.component?.binding) return
  emit('update', {
    binding: {
      ...props.component.binding,
      fields: { ...props.component.binding.fields, [key]: column },
    },
  })
}
</script>

<template>
  <div class="props-panel" style="display: flex; flex-direction: column; min-height: 0; flex: 1">
    <div v-if="!component" class="prop-empty">
      <Icon name="cursor" :size="20" />
      <b>未选中组件</b>
      <span>在画布中点击一个组件，即可在此查看和编辑它的属性。</span>
    </div>

    <template v-else>
      <div class="prop-scroll">
        <div class="prop-selected">
          <span class="prop-selected-icon">
            <Icon name="grid" :size="14" />
          </span>
          <span class="prop-selected-meta"><b>{{ component.name }}</b><span>{{ typeLabel }} · {{ component.id
              }}</span></span>
          <span class="prop-mini-actions">
            <button class="icon-btn" type="button" :title="component.locked ? '解锁' : '锁定'"
              @click="emit('update', { locked: !component.locked })">
              <Icon name="lock" />
            </button>
          </span>
        </div>

        <div v-if="contentFields.length" class="prop-section">
          <div class="prop-section-head"><span>内容</span>
            <Icon name="text" :size="11" />
          </div>
          <div v-for="field in contentFields" :key="field.key" class="prop-field" style="margin-bottom: 6px">
            <span class="prop-label">{{ field.label }}</span>
            <div class="prop-input">
              <input :value="propValue(field.key)"
                @input="emitProp(field.key, ($event.target as HTMLInputElement).value)" />
            </div>
          </div>
        </div>

        <div v-if="component.type === 'image'" class="prop-section">
          <div class="prop-section-head"><span>图片</span>
            <Icon name="image" :size="11" />
          </div>
          <div class="image-drop" :class="{ 'is-busy': imageBusy }" @click="imageInput?.click()">
            <span v-if="imageSrc" class="image-thumb"><img :src="imageSrc" alt="" /></span>
            <span class="image-drop-text">
              <b>{{ imageBusy ? '正在处理…' : (imageSrc ? '更换图片' : '上传图片') }}</b>
              <span>PNG / JPG / WebP / SVG，≤ 8 MB，自动压到 1600px</span>
            </span>
          </div>
          <input ref="imageInput" type="file" accept="image/*" hidden @change="pickImage" />
          <div v-if="imageError" class="image-error">{{ imageError }}</div>
          <div class="prop-field" style="margin-top: 8px">
            <span class="prop-label">图片地址</span>
            <div class="prop-input">
              <input :value="imageSrc" placeholder="https:// 或留空使用上传图"
                @change="emitProp('src', ($event.target as HTMLInputElement).value.trim())" />
            </div>
          </div>
          <div class="prop-field" style="margin-top: 6px">
            <span class="prop-label">填充方式</span>
            <select class="binding-select" :value="imageFit"
              @change="emitProp('fit', ($event.target as HTMLSelectElement).value)">
              <option v-for="item in FIT_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <button v-if="imageSrc" class="image-clear" type="button" @click="emitProp('src', '')">清除图片</button>
        </div>

        <div v-if="component.type === 'map.geo'" class="prop-section">
          <div class="prop-section-head"><span>地图视图</span>
            <Icon name="globe" :size="11" />
          </div>
          <div class="prop-field" style="margin-bottom: 6px">
            <span class="prop-label">底图</span>
            <select class="binding-select" :value="mapKey" @change="setMapKey">
              <option v-for="preset in mapPresets()" :key="preset.key" :value="preset.key">{{ preset.name }}{{
                preset.custom ? '（自定义）' : '' }}</option>
            </select>
          </div>
          <div class="map-view-tabs">
            <button class="map-view-tab" :class="{ 'is-active': mapView === '2d' }" type="button"
              @click="setMapView('2d')">2D 平面</button>
            <button class="map-view-tab" :class="{ 'is-active': mapView === '3d' }" type="button"
              @click="setMapView('3d')">3D 立体</button>
          </div>
          <div v-if="mapView === '3d'" class="toggle-row" style="margin-top: 8px">
            <span>自动旋转</span>
            <button class="switch" :class="{ 'is-on': mapAutoRotate }" type="button"
              :title="mapAutoRotate ? '关闭自动旋转' : '开启自动旋转'" @click="toggleMapRotate" />
          </div>
        </div>

        <div class="prop-section">
          <div class="prop-section-head"><span>布局与尺寸</span>
            <Icon name="move" :size="11" />
          </div>
          <div class="prop-grid-2">
            <div class="prop-field"><span class="prop-label">X</span>
              <div class="prop-input"><input v-model.number="form.x" type="number" @change="emitFrame" /><span
                  class="unit">px</span></div>
            </div>
            <div class="prop-field"><span class="prop-label">Y</span>
              <div class="prop-input"><input v-model.number="form.y" type="number" @change="emitFrame" /><span
                  class="unit">px</span></div>
            </div>
            <div class="prop-field"><span class="prop-label">宽度</span>
              <div class="prop-input"><input v-model.number="form.w" type="number" @change="emitFrame" /><span
                  class="unit">px</span></div>
            </div>
            <div class="prop-field"><span class="prop-label">高度</span>
              <div class="prop-input"><input v-model.number="form.h" type="number" @change="emitFrame" /><span
                  class="unit">px</span></div>
            </div>
          </div>
        </div>

        <div class="prop-section">
          <div class="prop-section-head"><span>样式模板</span>
            <Icon name="dotgrid" :size="11" />
          </div>
          <div class="variant-grid">
            <button v-for="preset in VARIANT_PRESETS" :key="preset.key" class="variant-chip"
              :class="{ 'is-active': activeVariant === preset.key }" type="button" :title="preset.hint"
              @click="applyVariant(preset.key)">
              <span class="variant-preview" :style="variantPreview(preset.key, activeTone)" />
              <span class="variant-name">{{ preset.name }}</span>
            </button>
            <button class="variant-chip" :class="{ 'is-active': !activeVariant }" type="button"
              title="保留当前填充与圆角，仅去掉模板标记" @click="applyVariant('custom')">
              <span class="variant-preview is-custom" />
              <span class="variant-name">自定义</span>
            </button>
          </div>
        </div>

        <div class="prop-section">
          <div class="prop-section-head"><span>主题色</span>
            <Icon name="palette" :size="11" />
          </div>
          <div class="tone-row">
            <button v-for="tone in TONE_PRESETS" :key="tone.key" class="tone-dot"
              :class="{ 'is-active': activeTone === tone.color.toLowerCase() }" type="button"
              :style="{ background: tone.color }" :title="tone.name" @click="applyTone(tone.color)" />
            <label class="tone-custom" title="自定义主题色">
              <input type="color" :value="customTone" @input="applyCustomTone" />
              <Icon name="plus" :size="10" />
            </label>
          </div>
        </div>

        <div class="prop-section">
          <div class="prop-section-head"><span>外观</span>
            <Icon name="sliders" :size="11" />
          </div>
          <div class="prop-grid-2">
            <div class="prop-field">
              <span class="prop-label">填充</span>
              <div class="prop-input"><input v-model="form.fill" placeholder="#081016" @change="emitFill" /></div>
            </div>
            <div class="prop-field"><span class="prop-label">圆角</span>
              <div class="prop-input"><input v-model.number="form.radius" type="number" min="0" max="200"
                  @change="emitStyle({ radius: clamp(form.radius, 0, 200) })" /><span class="unit">px</span></div>
            </div>
            <div class="prop-field" style="grid-column: span 2">
              <span class="prop-label">不透明度</span>
              <div class="range-row">
                <input v-model.number="form.opacity" type="range" min="0" max="100" style="flex: 1"
                  @input="emitOpacity" />
                <span class="range-value">{{ Math.round(form.opacity) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="bindable" class="prop-section">
          <div class="prop-section-head"><span>数据绑定</span>
            <Icon name="database" :size="11" />
          </div>
          <div class="prop-field">
            <span class="prop-label">数据文件</span>
            <select class="binding-select" :value="component.binding?.sourceId ?? ''"
              @change="applyBinding(($event.target as HTMLSelectElement).value)">
              <option value="">未绑定</option>
              <option v-for="item in availableDatasets" :key="item.id" :value="item.id">
                {{ item.name }} · {{ item.rowCount }} 行
              </option>
            </select>
          </div>

          <div v-if="boundDataset && component.type !== 'table'" class="prop-grid-2" style="margin-top: 6px">
            <div class="prop-field">
              <span class="prop-label">类目字段</span>
              <select class="binding-select" :value="component.binding?.fields.category ?? ''"
                @change="applyBindingField('category', ($event.target as HTMLSelectElement).value)">
                <option v-for="column in boundDataset.columns" :key="column" :value="column">{{ column }}</option>
              </select>
            </div>
            <div class="prop-field">
              <span class="prop-label">数值字段</span>
              <select class="binding-select" :value="component.binding?.fields.value ?? ''"
                @change="applyBindingField('value', ($event.target as HTMLSelectElement).value)">
                <option v-for="column in boundDataset.columns" :key="column" :value="column">{{ column }}</option>
              </select>
            </div>
          </div>

          <div v-if="boundDataset" class="binding-meta">
            <Icon name="check" :size="10" /> 已绑定 · 共 {{ boundDataset.rowCount }} 行
            <span>{{ component.type === 'table' ? '展示前 5 列' : '图表取前 24 行' }}</span>
          </div>
          <button v-if="component.binding" class="binding-clear" type="button" @click="applyBinding('')">
            解除绑定
          </button>
          <div v-else-if="!availableDatasets.length" class="binding-tip">
            还没有数据文件，先到「数据源」页上传 CSV / JSON。
          </div>
        </div>

        <div class="prop-hint">
          <Icon name="info" :size="10" /><span>修改会实时写入画布并自动保存；颜色仅支持 Hex 格式。</span>
        </div>
      </div>

      <div class="prop-footer">
        <button class="btn btn-quiet" type="button" style="flex: 1" @click="emit('reset')">重置样式</button>
        <button class="btn btn-primary" type="button" style="flex: 1" @click="emit('apply')">应用属性</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.binding-select {
  width: 100%;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  color: #b6c7d4;
  font-size: 9px;
  outline: none;
}

.binding-select:focus {
  border-color: rgba(94, 242, 194, 0.4);
}

.binding-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 7px;
  color: #6fbfa5;
  font-size: 8px;
}

.binding-meta span {
  margin-left: auto;
  color: #546879;
}

.binding-clear {
  margin-top: 6px;
  padding: 0;
  border: none;
  background: none;
  color: #8a6a6a;
  font-size: 8px;
  cursor: pointer;
}

.binding-clear:hover {
  color: #d99a9a;
}

.binding-tip {
  margin-top: 7px;
  color: #5c7082;
  font-size: 8px;
  line-height: 1.6;
}

.variant-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.variant-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 7px 4px 6px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.02);
  color: #7d8fa0;
  font-size: 8.5px;
  cursor: pointer;
  transition: border-color 0.16s var(--ease), background 0.16s var(--ease);
}

.variant-chip:hover {
  border-color: var(--line-strong);
  background: rgba(255, 255, 255, 0.045);
}

.variant-chip.is-active {
  border-color: rgba(94, 242, 194, 0.42);
  background: rgba(94, 242, 194, 0.07);
  color: #c7eadd;
}

.variant-preview {
  width: 100%;
  height: 22px;
  box-sizing: border-box;
  background: rgba(9, 15, 24, 0.72);
}

.variant-preview.is-custom {
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 3px;
  background: transparent;
}

.variant-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.tone-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.tone-dot {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.14s var(--ease), box-shadow 0.14s var(--ease);
}

.tone-dot:hover {
  transform: scale(1.08);
}

.tone-dot.is-active {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.16);
}

.tone-custom {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px dashed rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  color: #7d8fa0;
  cursor: pointer;
  overflow: hidden;
}

.tone-custom:hover {
  color: #c7d7e2;
  border-color: rgba(255, 255, 255, 0.4);
}

.tone-custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.map-view-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.map-view-tab {
  padding: 7px 4px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.02);
  color: #7d8fa0;
  font-size: 8.5px;
  cursor: pointer;
  transition: border-color 0.16s var(--ease), background 0.16s var(--ease);
}

.map-view-tab:hover {
  border-color: var(--line-strong);
  background: rgba(255, 255, 255, 0.045);
}

.image-drop {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px dashed rgba(94, 242, 194, 0.24);
  border-radius: 7px;
  cursor: pointer;
  transition: border-color 0.16s var(--ease), background 0.16s var(--ease);
}

.image-drop:hover {
  border-color: rgba(94, 242, 194, 0.5);
  background: rgba(94, 242, 194, 0.06);
}

.image-drop.is-busy {
  pointer-events: none;
  opacity: 0.6;
}

.image-thumb {
  flex: 0 0 auto;
  width: 48px;
  height: 34px;
  overflow: hidden;
  border-radius: 4px;
  background: #0a1420;
}

.image-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-drop-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.image-drop-text b {
  color: #dfeaf2;
  font-size: 12px;
  font-weight: 600;
}

.image-drop-text span {
  color: #5f7182;
  font-size: 10px;
  line-height: 1.4;
}

.image-error {
  margin-top: 6px;
  color: #ff8a8a;
  font-size: 10px;
  line-height: 1.4;
}

.image-clear {
  margin-top: 8px;
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: transparent;
  color: #8ea3b5;
  font-size: 11px;
  cursor: pointer;
  transition: color 0.16s var(--ease), border-color 0.16s var(--ease);
}

.image-clear:hover {
  color: #ff9aa5;
  border-color: rgba(255, 140, 150, 0.4);
}
</style>
