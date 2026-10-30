<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { echarts } from '@/lib/echarts'
import { ensureMaps, invalidateMapPresets, listMapPresets } from '@/lib/maps'
import { saveCustomMap, type CustomMapSubmitPayload } from '@/lib/customMaps'
import { uploadDataset } from '@/services/datasets'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: CustomMapSubmitPayload): void
}>()

const MAX_GEO_BYTES = 2 * 1024 * 1024
const MAX_DATA_BYTES = 5 * 1024 * 1024
const MAX_FEATURES = 400

const geoInput = ref<HTMLInputElement | null>(null)
const dataInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

const geoRaw = ref<unknown>(null)
const geoFile = ref<{ name: string; size: number; features: string[] } | null>(null)
const mapName = ref('')
const view = ref<'2d' | '3d'>('2d')

const dataFile = ref<File | null>(null)
const dataRows = ref<Record<string, string>[]>([])
const dataColumns = ref<string[]>([])
const categoryField = ref('')
const valueField = ref('')

const error = ref('')
const busy = ref(false)
const custom = ref(listMapPresets().filter((item) => item.custom))

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function reset() {
  geoRaw.value = null
  geoFile.value = null
  mapName.value = ''
  view.value = '2d'
  dataFile.value = null
  dataRows.value = []
  dataColumns.value = []
  categoryField.value = ''
  valueField.value = ''
  error.value = ''
  busy.value = false
  custom.value = listMapPresets().filter((item) => item.custom)
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

async function pickGeo(file: File) {
  error.value = ''
  if (file.size > MAX_GEO_BYTES) {
    error.value = 'GeoJSON 文件不能超过 2 MB'
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    error.value = '文件不是合法的 JSON'
    return
  }
  const geo = parsed as { type?: string; features?: unknown[] }
  if (!geo || geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) {
    error.value = '需要标准的 GeoJSON FeatureCollection（含 features 数组）'
    return
  }
  if (!geo.features.length) {
    error.value = 'GeoJSON 里没有可用要素'
    return
  }
  const names = geo.features.map((item) => {
    const props = (item as { properties?: Record<string, unknown> }).properties ?? {}
    const name = props.name ?? props.NAME ?? props.Nm ?? ''
    return String(name).trim()
  })
  if (names.some((name) => !name)) {
    error.value = '部分要素缺少 properties.name，无法与数据匹配'
    return
  }
  if (geo.features.length > MAX_FEATURES) {
    error.value = `要素数量 ${geo.features.length} 个，超过 ${MAX_FEATURES} 个（3D 渲染会明显卡顿），请精简后再上传`
    return
  }
  geoRaw.value = parsed
  geoFile.value = { name: file.name, size: file.size, features: names }
  if (!mapName.value) {
    mapName.value = file.name.replace(/\.(geojson|json)$/i, '')
  }
  if (dataRows.value.length) autoPickFields(dataColumns.value)
}

function onGeoChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void pickGeo(file)
}

function onGeoDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void pickGeo(file)
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      cells.push(cell)
      cell = ''
    } else {
      cell += ch
    }
  }
  cells.push(cell)
  return cells
}

function parseData(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const trimmed = text.trim()
  if (trimmed.startsWith('[')) {
    const list = JSON.parse(trimmed) as Record<string, unknown>[]
    const columns = Array.from(new Set(list.flatMap((row) => Object.keys(row))))
    return {
      columns,
      rows: list.slice(0, 2000).map((row) => {
        const next: Record<string, string> = {}
        columns.forEach((key) => {
          next[key] = String(row[key] ?? '')
        })
        return next
      }),
    }
  }
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim())
  const columns = splitCsvLine(lines[0]).map((cell) => cell.trim())
  const rows = lines.slice(1, 2001).map((line) => {
    const cells = splitCsvLine(line)
    const row: Record<string, string> = {}
    columns.forEach((key, index) => {
      row[key] = (cells[index] ?? '').trim()
    })
    return row
  })
  return { columns, rows }
}

async function pickData(file: File) {
  error.value = ''
  if (file.size > MAX_DATA_BYTES) {
    error.value = '数据文件不能超过 5 MB'
    return
  }
  try {
    const parsed = parseData(await file.text())
    if (!parsed.columns.length || !parsed.rows.length) {
      error.value = '数据文件里没有可用行列'
      return
    }
    dataFile.value = file
    dataColumns.value = parsed.columns
    dataRows.value = parsed.rows
    autoPickFields(parsed.columns)
  } catch {
    error.value = '数据文件解析失败，请使用 CSV 或 JSON 数组'
  }
}

/** 自动选中与底图区域名匹配度最高的列，以及第一个数值列 */
function autoPickFields(columns: string[]) {
  const names = new Set(geoFile.value?.features ?? [])
  let bestColumn = columns[0] ?? ''
  let bestHit = -1
  columns.forEach((column) => {
    const hit = dataRows.value.filter((row) => names.has(row[column])).length
    if (hit > bestHit) {
      bestHit = hit
      bestColumn = column
    }
  })
  categoryField.value = bestColumn
  const numeric = columns.find(
    (column) =>
      column !== bestColumn &&
      dataRows.value.some((row) => Number.isFinite(Number(row[column].replace(/[%¥$,，\s]/g, '')))),
  )
  valueField.value = numeric ?? columns.find((column) => column !== bestColumn) ?? bestColumn
}

function onDataChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void pickData(file)
}

const matched = computed(() => {
  if (!geoFile.value || !categoryField.value || !dataRows.value.length) return null
  const names = new Set(geoFile.value.features)
  const hit = new Set(
    dataRows.value.map((row) => row[categoryField.value]).filter((name) => names.has(name)),
  )
  return { hit: hit.size, total: geoFile.value.features.length }
})

async function submit() {
  if (busy.value) return
  const name = mapName.value.trim()
  if (!geoRaw.value || !geoFile.value) {
    error.value = '请先上传 GeoJSON 底图'
    return
  }
  if (!name) {
    error.value = '请填写地图名称'
    return
  }
  if (dataFile.value && (!categoryField.value || !valueField.value)) {
    error.value = '请选择数据里的区域名称列和数值列'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const savedMap = saveCustomMap(name, geoRaw.value)
    invalidateMapPresets()
    ensureMaps(echarts)
    let dataset: CustomMapSubmitPayload['dataset']
    if (dataFile.value) {
      const uploaded = await uploadDataset(dataFile.value)
      dataset = {
        id: uploaded.id,
        categoryField: categoryField.value,
        valueField: valueField.value,
      }
    }
    emit('submit', { mapKey: savedMap.key, mapName: savedMap.name, view: view.value, dataset })
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '添加自定义地图失败，请稍后重试'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="open" class="overlay is-open" @click.self="emit('close')">
    <div class="geo-modal">
      <div class="modal-head">
        <div>
          <div class="eyebrow">CUSTOM GEOJSON</div>
          <h3>自定义地图</h3>
          <p>上传 GeoJSON 边界与对应区域数据，自动生成 2D / 3D 地图组件。</p>
        </div>
        <button class="icon-btn" type="button" @click="emit('close')">
          <Icon name="x" />
        </button>
      </div>

      <div class="geo-modal-body">
        <div v-if="!geoFile" class="geo-drop" :class="{ 'is-dragging': dragging }" role="button" tabindex="0"
          @click="geoInput?.click()" @keydown.enter="geoInput?.click()" @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false" @drop.prevent="onGeoDrop">
          <span class="upload-icon">
            <Icon name="upload-cloud" :size="16" />
          </span>
          <b>{{ dragging ? '松开即可上传' : '拖拽 GeoJSON 到这里，或点击选择' }}</b>
          <span>单个文件不超过 2 MB，最多 400 个要素</span>
          <div class="file-types"><i>.json</i><i>.geojson</i><i>properties.name 必填</i></div>
        </div>

        <div v-else class="geo-file">
          <span class="geo-file-icon">
            <Icon name="map" :size="13" />
          </span>
          <span class="geo-file-meta">
            <b>{{ geoFile.name }}</b>
            <span>{{ formatSize(geoFile.size) }} · {{ geoFile.features.length }} 个区域 · 解析完成</span>
          </span>
          <span class="geo-ok">
            <Icon name="check" :size="10" /> 校验通过
          </span>
          <button class="icon-btn" type="button" style="width: 22px; height: 22px" title="重新选择"
            @click="geoFile = null; geoRaw = null; geoInput?.click()">
            <Icon name="x" />
          </button>
        </div>

        <div class="geo-form">
          <div class="field">
            <label class="field-label">地图名称</label>
            <div class="input-wrap"><input v-model="mapName" class="input" placeholder="例如 杭州 · 行政区划" /></div>
          </div>
          <div class="field">
            <label class="field-label">展示形式</label>
            <div class="geo-view-tabs">
              <button class="geo-view-tab" :class="{ 'is-active': view === '2d' }" type="button" @click="view = '2d'">2D
                平面</button>
              <button class="geo-view-tab" :class="{ 'is-active': view === '3d' }" type="button" @click="view = '3d'">3D
                立体</button>
            </div>
          </div>
          <div class="field">
            <label class="field-label">区域数据（可选）</label>
            <button class="geo-upload" type="button" @click="dataInput?.click()">
              <Icon name="upload-cloud" />
              <span>
                <b>{{ dataFile ? dataFile.name : '上传 CSV / JSON 区域数据' }}</b>
                <span>{{ dataFile ? `${dataRows.length} 行 · ${dataColumns.length} 列` : '第一列为区域名称，数值列决定着色深浅' }}</span>
              </span>
            </button>
          </div>
          <template v-if="dataFile">
            <div class="field">
              <label class="field-label">区域名称列</label>
              <select v-model="categoryField" class="binding-select">
                <option v-for="column in dataColumns" :key="column" :value="column">{{ column }}</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">数值列</label>
              <select v-model="valueField" class="binding-select">
                <option v-for="column in dataColumns" :key="column" :value="column">{{ column }}</option>
              </select>
            </div>
            <p v-if="matched" class="geo-match" :class="{ 'is-warning': matched.hit === 0 }">
              <Icon name="info" :size="11" />
              已匹配 {{ matched.hit }} / {{ matched.total }} 个区域{{ matched.hit === 0 ? '，请检查区域名称是否与底图一致' : '' }}
            </p>
          </template>
        </div>

        <div v-if="custom.length" class="geo-saved">
          <span class="geo-saved-title">已保存的自定义底图</span>
          <div v-for="item in custom" :key="item.key" class="geo-saved-row">
            <Icon name="map" :size="12" />
            <span>{{ item.name }}</span>
          </div>
        </div>

        <p v-if="error" class="geo-error">{{ error }}</p>
      </div>

      <div class="geo-foot">
        <span class="hint">
          <Icon name="lock" :size="11" /> 底图保存在本机浏览器，数据文件会保存到数据源
        </span>
        <div class="row gap-8">
          <button class="btn btn-quiet" type="button" @click="emit('close')">取消</button>
          <button class="btn btn-primary" type="button" :disabled="busy" @click="submit">
            {{ busy ? '处理中…' : '生成地图组件' }}
          </button>
        </div>
      </div>

      <input ref="geoInput" class="geo-input" type="file" accept=".json,.geojson" @change="onGeoChange" />
      <input ref="dataInput" class="geo-input" type="file" accept=".csv,.json" @change="onDataChange" />
    </div>
  </div>
</template>

<style scoped>
.geo-input {
  display: none;
}

.geo-drop.is-dragging {
  border-color: rgba(94, 242, 194, 0.6);
  background: rgba(94, 242, 194, 0.06);
}

.geo-view-tabs {
  display: flex;
  gap: 4px;
}

.geo-view-tab {
  flex: 1;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  color: #7d91a3;
  font-size: 10px;
}

.geo-view-tab.is-active {
  border-color: rgba(94, 242, 194, 0.4);
  background: rgba(94, 242, 194, 0.1);
  color: #c4e2d9;
}

.geo-upload {
  width: 100%;
  text-align: left;
}

.geo-match {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 2px 0 0;
  color: #6c9a8f;
  font-size: 9px;
}

.geo-match.is-warning {
  color: #e8a86a;
}

.geo-saved {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.geo-saved-title {
  color: #5d7183;
  font-size: 8.5px;
  letter-spacing: 0.08em;
}

.geo-saved-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: #a8bbc9;
  font-size: 10px;
}

.geo-error {
  margin: 10px 0 0;
  color: #ff8a99;
  font-size: 10px;
  line-height: 1.6;
}
</style>
