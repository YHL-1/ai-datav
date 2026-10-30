<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toPng } from 'html-to-image'
import { createEmptyCanvas, type CanvasComponent, type CanvasSchema, type ComponentType, type ProjectDetail, type ProjectSummary } from '@nexa/schema'
import AppLogo from '@/components/ui/AppLogo.vue'
import Icon from '@/components/ui/Icon.vue'
import ComponentLibrary from '@/components/editor/ComponentLibrary.vue'
import AIPanel from '@/components/editor/AIPanel.vue'
import PropertyPanel from '@/components/editor/PropertyPanel.vue'
import GeoJsonModal from '@/components/editor/GeoJsonModal.vue'
import EditorCanvas from '@/components/editor/EditorCanvas.vue'
import { hasAiKey } from '@/lib/aiKey'
import type { CustomMapSubmitPayload } from '@/lib/customMaps'
import { OFFICIAL_TEMPLATES } from '@/lib/officialTemplates'
import { toast } from '@/lib/toast'
import { ApiError } from '@/services/api'
import { AiError, generateCanvas, type AiChatMessage } from '@/services/ai'
import { getProject, createProject, listProjects, saveProject } from '@/services/projects'
import { getDatasetData, listDatasets, type DatasetData, type DatasetSummary } from '@/services/datasets'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => String(route.params.id || 'demo'))
const panel = ref<'ai' | 'props'>(route.query.panel === 'props' ? 'props' : 'ai')
const leftCollapsed = ref(false)
const rightCollapsed = ref(false)
const zoom = ref(50)
const mode = ref<'select' | 'hand'>('select')
const pan = reactive({ x: 0, y: 0 })
const panning = ref(false)
const geoOpen = ref(false)
const project = ref<ProjectDetail | null>(null)
const canvas = ref<CanvasSchema>(createEmptyCanvas())
const selectedId = ref<string | null>(null)
const saveState = ref<'saved' | 'dirty' | 'saving' | 'error'>('saved')
const savedAt = ref('')
const datasets = ref<DatasetSummary[]>([])
const datasetFrames = ref<Record<string, DatasetData>>({})
const gridVisible = ref(true)
const exporting = ref(false)
const screenRef = ref<HTMLDivElement | null>(null)
const aiMessages = ref<AiChatMessage[]>([])
const aiBusy = ref(false)
const lastAiPrompt = ref('')
let aiMessageSeq = 0

const projectName = computed(() => project.value?.name ?? '未命名智慧屏')

const renamingName = ref(false)
const nameDraft = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

function setNameInput(el: unknown) {
  nameInput.value = (el as HTMLInputElement | null) ?? null
}

async function startRenameName() {
  if (!project.value) return
  renamingName.value = true
  nameDraft.value = project.value.name
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function cancelRenameName() {
  renamingName.value = false
  nameDraft.value = ''
}

function commitRenameName() {
  if (!renamingName.value || !project.value) return
  const name = nameDraft.value.trim()
  if (!name || name === project.value.name) return cancelRenameName()
  if (name.length > 80) {
    toast('草稿名称最多 80 个字符', 2600)
    nameInput.value?.focus()
    return
  }
  project.value = { ...project.value, name }
  renamingName.value = false
  nameDraft.value = ''
  ensureTab(project.value.id, name)
  markDirty()
  toast(`已改名为「${name}」`)
}

/** 顶栏打开中的草稿标签，仅存本机，最多 8 个 */
const TABS_KEY = 'nexa.editorTabs'
const tabs = ref<{ id: string; name: string }[]>([])
const tabMenuOpen = ref(false)
const tabPicks = ref<ProjectSummary[]>([])
const tabBusy = ref(false)

function readStoredTabs(): { id: string; name: string }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TABS_KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter(
        (item): item is { id: string; name: string } =>
          Boolean(item) && typeof (item as { id?: unknown }).id === 'string',
      )
      .map((item) => ({
        id: item.id,
        name: typeof item.name === 'string' && item.name ? item.name : '未命名智慧屏',
      }))
      .slice(-8)
  } catch {
    return []
  }
}

function writeTabs() {
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs.value))
}

function ensureTab(id: string, name: string) {
  const hit = tabs.value.find((tab) => tab.id === id)
  if (hit) {
    if (hit.name !== name) {
      hit.name = name
      writeTabs()
    }
    return
  }
  tabs.value = [...tabs.value, { id, name }].slice(-8)
  writeTabs()
}

async function flushCurrent(): Promise<boolean> {
  window.clearTimeout(saveTimer)
  if (saveState.value === 'dirty') await persist()
  return saveState.value !== 'error'
}

async function switchTab(id: string) {
  tabMenuOpen.value = false
  if (id === projectId.value) return
  if (!(await flushCurrent())) return
  await router.push(`/editor/${id}`)
}

async function closeTab(id: string) {
  const index = tabs.value.findIndex((tab) => tab.id === id)
  if (index < 0) return
  if (id === projectId.value && !(await flushCurrent())) return
  tabs.value = tabs.value.filter((tab) => tab.id !== id)
  writeTabs()
  if (id !== projectId.value) return
  const next = tabs.value[index] ?? tabs.value[index - 1]
  await router.push(next ? `/editor/${next.id}` : '/home')
}

async function toggleTabMenu() {
  tabMenuOpen.value = !tabMenuOpen.value
  if (!tabMenuOpen.value) return
  try {
    const list = await listProjects({ limit: 20 })
    tabPicks.value = list.filter((item) => !tabs.value.some((tab) => tab.id === item.id))
  } catch {
    tabPicks.value = []
  }
}

async function createTab() {
  if (tabBusy.value) return
  tabBusy.value = true
  tabMenuOpen.value = false
  try {
    if (!(await flushCurrent())) return
    const created = await createProject({ name: '未命名智慧屏' })
    ensureTab(created.id, created.name)
    await router.push(`/editor/${created.id}`)
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '新建草稿失败，请稍后重试')
  } finally {
    tabBusy.value = false
  }
}

function closeTabMenu() {
  tabMenuOpen.value = false
}

let saveTimer = 0
let canvasVersion = 0

const boundDatasetIds = computed(() =>
  Array.from(
    new Set(
      canvas.value.components
        .map((component) => component.binding?.sourceId)
        .filter((id): id is string => Boolean(id)),
    ),
  ),
)

/** API 数据源按各自的刷新间隔轮询最新数据 */
const lastLiveFetch = new Map<string, number>()
let liveTimer: number | undefined

async function refreshLiveDatasets() {
  const now = Date.now()
  for (const id of boundDatasetIds.value) {
    const meta = datasets.value.find((item) => item.id === id)
    if (!meta || meta.kind !== 'api') continue
    const interval = Math.max(5, meta.refreshSeconds || 30) * 1000
    if (now - (lastLiveFetch.get(id) ?? 0) < interval) continue
    lastLiveFetch.set(id, now)
    try {
      const data = await getDatasetData(id)
      datasetFrames.value = { ...datasetFrames.value, [id]: data }
    } catch {
      // 接口暂时不可用时保留上一次数据
    }
  }
}

watch(
  boundDatasetIds,
  (ids) => {
    ids.forEach(async (id) => {
      if (datasetFrames.value[id]) return
      try {
        const data = await getDatasetData(id)
        lastLiveFetch.set(id, Date.now())
        datasetFrames.value = { ...datasetFrames.value, [id]: data }
      } catch {
        // 数据文件被删除时保留示例数据渲染
      }
    })
  },
  { immediate: true },
)

let loadToken = 0

async function loadProject(id: string) {
  loadToken += 1
  const token = loadToken
  window.clearTimeout(saveTimer)
  selectedId.value = null
  past.value = []
  future.value = []
  canvasVersion = 0
  saveState.value = 'saved'
  savedAt.value = ''
  renamingName.value = false
  zoom.value = 50
  pan.x = 0
  pan.y = 0

  try {
    project.value = await getProject(id)
    canvas.value = project.value.canvas
    ensureTab(project.value.id, project.value.name)
  } catch {
    // 草稿不存在或无权访问时展示官方示例画布，仍可本地操作
    project.value = null
    canvas.value = JSON.parse(JSON.stringify(OFFICIAL_TEMPLATES[0].canvas)) as CanvasSchema
    ensureTab(id, id === 'demo' ? '示例画布' : '未命名智慧屏')
  }
  if (token !== loadToken) return
}

onMounted(async () => {
  tabs.value = readStoredTabs()
  if (route.query.modal === 'geo') geoOpen.value = true

  await loadProject(projectId.value)

  try {
    datasets.value = await listDatasets()
  } catch {
    datasets.value = []
  }

  // 清理已被删除草稿留下的标签
  try {
    const list = await listProjects({ limit: 20 })
    const existing = new Set(list.map((item) => item.id))
    tabs.value = tabs.value.filter((tab) => existing.has(tab.id) || tab.id === projectId.value)
    writeTabs()
  } catch {
    // 列表拉取失败时保留本机标签
  }
})

watch(projectId, (id) => {
  if (id && id !== project.value?.id) void loadProject(id)
})

onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  window.removeEventListener('keydown', onKeydown)
  endPan()
  if (saveState.value === 'dirty') void persist()
})

interface PanDrag {
  pointerX: number
  pointerY: number
  originX: number
  originY: number
}

let panDrag: PanDrag | null = null

function onPanStart(event: MouseEvent) {
  if (mode.value !== 'hand' || event.button !== 0) return
  event.preventDefault()
  panDrag = { pointerX: event.clientX, pointerY: event.clientY, originX: pan.x, originY: pan.y }
  panning.value = true
  window.addEventListener('mousemove', onPanMove)
  window.addEventListener('mouseup', endPan)
  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', endPan)
}

function onPanMove(event: MouseEvent) {
  if (!panDrag) return
  pan.x = Math.round(panDrag.originX + event.clientX - panDrag.pointerX)
  pan.y = Math.round(panDrag.originY + event.clientY - panDrag.pointerY)
}

function endPan() {
  panDrag = null
  panning.value = false
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', endPan)
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', endPan)
}

const boardStyle = computed(() => ({
  width: `${Math.round(1920 * zoom.value / 100)}px`,
  height: `${Math.round(1080 * zoom.value / 100)}px`,
}))

const boardWrapStyle = computed(() => ({
  ...boardStyle.value,
  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
}))

const selectedComponent = computed(
  () => canvas.value.components.find((item) => item.id === selectedId.value) ?? null,
)

const saveLabel = computed(() => {
  if (saveState.value === 'saving') return '保存中…'
  if (saveState.value === 'dirty') return '未保存'
  if (saveState.value === 'error') return '保存失败'
  return savedAt.value ? `已自动保存 ${savedAt.value}` : '已自动保存'
})

const past = ref<CanvasSchema[]>([])
const future = ref<CanvasSchema[]>([])
const clipboard = ref<CanvasComponent | null>(null)
const canUndo = computed(() => past.value.length > 0)
const canRedo = computed(() => future.value.length > 0)

let lastMoveId: string | null = null
let lastMoveAt = 0
let lastPropAt = 0

function markDirty() {
  canvasVersion += 1
  saveState.value = 'dirty'
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void persist(), 700)
}

function pushHistory() {
  past.value.push(JSON.parse(JSON.stringify(canvas.value)) as CanvasSchema)
  if (past.value.length > 50) past.value.shift()
  future.value = []
}

function onCanvasMove(payload: { id: string; x: number; y: number }) {
  const now = Date.now()
  if (lastMoveId !== payload.id || now - lastMoveAt > 500) pushHistory()
  lastMoveId = payload.id
  lastMoveAt = now
  canvas.value = {
    ...canvas.value,
    components: canvas.value.components.map((component) =>
      component.id === payload.id
        ? { ...component, frame: { ...component.frame, x: payload.x, y: payload.y } }
        : component,
    ),
  }
  markDirty()
}

function undo() {
  const previous = past.value.pop()
  if (!previous) return
  future.value.push(JSON.parse(JSON.stringify(canvas.value)) as CanvasSchema)
  canvas.value = previous
  selectedId.value = previous.components.some((item) => item.id === selectedId.value) ? selectedId.value : null
  markDirty()
}

function redo() {
  const next = future.value.pop()
  if (!next) return
  past.value.push(JSON.parse(JSON.stringify(canvas.value)) as CanvasSchema)
  canvas.value = next
  selectedId.value = next.components.some((item) => item.id === selectedId.value) ? selectedId.value : null
  markDirty()
}

function deleteSelected() {
  if (!selectedId.value) return
  pushHistory()
  canvas.value = {
    ...canvas.value,
    components: canvas.value.components.filter((item) => item.id !== selectedId.value),
  }
  selectedId.value = null
  markDirty()
  toast('已删除组件')
}

function copySelected() {
  const component = selectedComponent.value
  if (!component) return
  clipboard.value = JSON.parse(JSON.stringify(component)) as CanvasComponent
  toast(`已复制「${component.name}」`)
}

function pasteComponent() {
  const source = clipboard.value
  if (!source) return
  pushHistory()
  const maxZ = canvas.value.components.reduce((max, item) => Math.max(max, item.zIndex), 0)
  const x = Math.min(1920 - source.frame.w, source.frame.x + 24)
  const y = Math.min(1080 - source.frame.h, source.frame.y + 24)
  const component: CanvasComponent = {
    ...JSON.parse(JSON.stringify(source)) as CanvasComponent,
    id: `c_${Date.now().toString(36)}`,
    frame: { ...source.frame, x, y },
    zIndex: maxZ + 1,
    locked: false,
  }
  canvas.value = { ...canvas.value, components: [...canvas.value.components, component] }
  selectedId.value = component.id
  markDirty()
  toast(`已粘贴「${component.name}」`)
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

  const mod = event.ctrlKey || event.metaKey
  if (mod && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
  } else if (mod && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    redo()
  } else if (mod && event.key.toLowerCase() === 'c') {
    if (!selectedId.value) return
    event.preventDefault()
    copySelected()
  } else if (mod && event.key.toLowerCase() === 'v') {
    event.preventDefault()
    pasteComponent()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    if (!selectedId.value) return
    event.preventDefault()
    deleteSelected()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('click', closeTabMenu)
  liveTimer = window.setInterval(() => void refreshLiveDatasets(), 5000)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeTabMenu)
  window.clearInterval(liveTimer)
})

async function persist() {
  if (!project.value || saveState.value === 'saving') return
  const token = loadToken
  const version = canvasVersion
  saveState.value = 'saving'
  try {
    const updated = await saveProject(project.value.id, {
      revision: project.value.revision,
      name: project.value.name,
      canvas: canvas.value,
    })
    // 切换标签后，旧草稿的保存结果不再回写当前编辑器
    if (token !== loadToken) return
    project.value = updated
    ensureTab(updated.id, updated.name)
    if (canvasVersion !== version) {
      saveState.value = 'dirty'
      window.setTimeout(() => void persist(), 0)
      return
    }
    canvas.value = updated.canvas
    saveState.value = 'saved'
    const date = new Date()
    savedAt.value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  } catch (error) {
    if (token !== loadToken) return
    saveState.value = 'error'
    toast(error instanceof ApiError ? error.message : '画布保存失败，请稍后重试')
  }
}

const panelTitle = computed(() => (panel.value === 'props' ? '属性' : 'AI 助手'))

watch(
  () => route.query.panel,
  (value) => {
    panel.value = value === 'props' ? 'props' : 'ai'
  },
)

function setPanel(next: 'ai' | 'props') {
  panel.value = next
  router.replace({ query: { ...route.query, panel: next } })
}

function changeZoom(delta: number | 'fit') {
  if (delta === 'fit') {
    zoom.value = 50
    pan.x = 0
    pan.y = 0
  } else {
    zoom.value = Math.min(200, Math.max(25, zoom.value + delta))
  }
}

async function goPreview() {
  if (saveState.value === 'dirty') await persist()
  // 草稿无后端记录（如示例画布）时，预览页从这里取当前画布
  sessionStorage.setItem(`nexa.preview.${projectId.value}`, JSON.stringify(canvas.value))
  router.push(`/preview/${projectId.value}`)
}

function exportCanvas() {
  if (exporting.value) return
  const node = screenRef.value
  if (!node) return
  exporting.value = true
  const previousSelection = selectedId.value
  const previousGrid = gridVisible.value
  selectedId.value = null
  gridVisible.value = false
  toast('正在导出画布图片…')
  void (async () => {
    try {
      await nextTick()
      // 画布当前可能处于缩放状态，导出时按 1920×1080 原始尺寸渲染
      const dataUrl = await toPng(node, {
        width: 1920,
        height: 1080,
        pixelRatio: 1,
        style: { transform: 'none' },
      })
      const date = new Date()
      const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
      const name = `${project.value?.name ?? '未命名智慧屏'}-${stamp}.png`
      const link = document.createElement('a')
      link.download = name
      link.href = dataUrl
      link.click()
      toast(`画布已导出：${name}`)
    } catch {
      toast('画布导出失败，请稍后重试')
    } finally {
      selectedId.value = previousSelection
      gridVisible.value = previousGrid
      exporting.value = false
    }
  })()
}

function backHome() {
  router.push('/home')
}

function requireAiKey(): boolean {
  if (hasAiKey()) return true
  toast('请先在右侧「AI 生成」面板中填写硅基流动 API Key', 3600)
  return false
}

function onSend(text: string) {
  if (!requireAiKey()) return
  lastAiPrompt.value = text
  aiMessages.value.push({ id: ++aiMessageSeq, role: 'user', text, time: timeLabel() })
  void runAi(text)
}

function timeLabel(): string {
  const date = new Date()
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

async function runAi(prompt: string) {
  aiBusy.value = true
  try {
    const result = await generateCanvas({ prompt, canvas: canvas.value, datasets: datasets.value })
    applyAi(result)
    aiMessages.value.push({
      id: ++aiMessageSeq,
      role: 'ai',
      text: result.message,
      time: timeLabel(),
      status: 'done',
      applied: {
        mode: result.mode,
        count: result.components.length,
        theme: themeLabel(result.theme?.preset),
        warnings: result.warnings,
      },
    })
  } catch (error) {
    const message = error instanceof AiError ? error.message : 'AI 生成失败，请稍后重试'
    aiMessages.value.push({ id: ++aiMessageSeq, role: 'ai', text: message, time: timeLabel(), status: 'error' })
    toast(message, 3200)
  } finally {
    aiBusy.value = false
  }
}

function themeLabel(preset?: string): string {
  const labels: Record<string, string> = {
    'deep-space': '深空青',
    amber: '琥珀金',
    ocean: '深海蓝',
    violet: '星云紫',
  }
  return preset ? labels[preset] ?? preset : canvas.value.theme.preset
}

function applyAi(result: Awaited<ReturnType<typeof generateCanvas>>) {
  pushHistory()
  const stamp = Date.now().toString(36)
  let components = result.components.map((component) => JSON.parse(JSON.stringify(component)) as CanvasComponent)

  if (result.mode === 'append') {
    const existingIds = new Set(canvas.value.components.map((item) => item.id))
    const maxZ = canvas.value.components.reduce((max, item) => Math.max(max, item.zIndex), 0)
    components = components.map((component, index) => ({
      ...component,
      id: existingIds.has(component.id) ? `${component.id}_${stamp}${index}` : component.id,
      zIndex: maxZ + component.zIndex,
    }))
    components = [...canvas.value.components, ...components]
  }

  canvas.value = {
    ...canvas.value,
    theme: result.theme ? result.theme : canvas.value.theme,
    components,
  }
  selectedId.value = null
  markDirty()
  toast(`AI 已${result.mode === 'append' ? '追加' : '应用'} ${result.components.length} 个组件到画布`)
}

function onAiAction(name: string) {
  if (name === 'undo') {
    undo()
    toast('已撤销本次 AI 应用')
    return
  }
  if (name === 'regen') {
    if (!requireAiKey()) return
    if (!lastAiPrompt.value) {
      toast('还没有可重新生成的需求')
      return
    }
    if (aiBusy.value) return
    aiMessages.value.push({ id: ++aiMessageSeq, role: 'user', text: `重新生成：${lastAiPrompt.value}`, time: timeLabel() })
    void runAi(lastAiPrompt.value)
    return
  }

  const counts = canvas.value.components.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1
    return acc
  }, {})
  const summary = Object.entries(counts)
    .map(([type, count]) => `${type} ×${count}`)
    .join(' · ')
  toast(`Schema 摘要：${canvas.value.components.length} 个组件${summary ? ` · ${summary}` : ''}`, 3200)
}

const COMPONENT_PRESETS: Record<
  string,
  { type: ComponentType; w: number; h: number; props: Record<string, unknown>; style?: { fontSize?: number; fontWeight?: number; color?: string } }
> = {
  指标卡: { type: 'metric', w: 300, h: 150, props: { label: '核心指标', value: '128.6', unit: '万' }, style: { fontSize: 30, color: '#5ef2c2' } },
  折线图: { type: 'chart.line', w: 460, h: 300, props: { title: '趋势分析' } },
  柱状图: { type: 'chart.bar', w: 460, h: 300, props: { title: '对比分析' } },
  环形图: { type: 'chart.pie', w: 380, h: 300, props: { title: '占比分析' } },
  '3D 地图': { type: 'map.geo', w: 560, h: 520, props: { title: '区域分布', view: '3d', autoRotate: 'true', map: 'china' } },
  '2D 地图': { type: 'map.geo', w: 560, h: 480, props: { title: '区域分布', view: '2d', map: 'china' } },
  数据表格: { type: 'table', w: 600, h: 320, props: { title: '明细数据', pageSize: 6 } },
  富文本: { type: 'text', w: 460, h: 90, props: { text: '文本内容', subtitle: 'TEXT' }, style: { fontSize: 26 } },
  '图片 / 装饰': { type: 'image', w: 320, h: 180, props: { alt: '图片', fit: 'cover' } },
}

function reorderLayer(position: 'front' | 'back') {
  const id = selectedId.value
  if (!id) return
  pushHistory()
  const ordered = [...canvas.value.components].sort((a, b) => a.zIndex - b.zIndex)
  const target = ordered.find((item) => item.id === id)
  if (!target) return
  const rest = ordered.filter((item) => item.id !== id)
  const next = position === 'front' ? [...rest, target] : [target, ...rest]
  const zMap = new Map(next.map((item, index) => [item.id, index + 1]))
  canvas.value = {
    ...canvas.value,
    components: canvas.value.components.map((item) => ({ ...item, zIndex: zMap.get(item.id) ?? item.zIndex })),
  }
  markDirty()
  toast(position === 'front' ? `「${target.name}」已置于顶层` : `「${target.name}」已置于底层`)
}

function addBoundComponent(datasetId: string) {
  const dataset = datasets.value.find((item) => item.id === datasetId)
  if (!dataset) return
  const preset = COMPONENT_PRESETS['柱状图']
  const index = canvas.value.components.length
  const maxZ = canvas.value.components.reduce((max, item) => Math.max(max, item.zIndex), 0)
  const component: CanvasComponent = {
    id: `c_${Date.now().toString(36)}`,
    type: preset.type,
    name: '柱状图',
    frame: {
      x: Math.min(1920 - preset.w, 80 + (index % 6) * 48),
      y: Math.min(1080 - preset.h, 140 + (index % 6) * 40),
      w: preset.w,
      h: preset.h,
    },
    zIndex: maxZ + 1,
    locked: false,
    visible: true,
    props: { ...preset.props, title: dataset.name },
    style: {
      fill: 'rgba(9, 15, 24, 0.72)',
      border: '1px solid rgba(255, 255, 255, 0.07)',
      radius: 10,
      ...preset.style,
    },
    binding: {
      sourceId: dataset.id,
      path: '',
      refresh: 0,
      fields: {
        category: dataset.columns[0] ?? '',
        value: dataset.columns[1] ?? dataset.columns[0] ?? '',
      },
    },
  }
  canvas.value = { ...canvas.value, components: [...canvas.value.components, component] }
  selectedId.value = component.id
  markDirty()
  toast(`已添加「${dataset.name}」柱状图`)
}

function addComponent(name: string) {
  if (name === '自定义地图') {
    geoOpen.value = true
    return
  }
  const preset = COMPONENT_PRESETS[name]
  if (!preset) return

  const index = canvas.value.components.length
  const maxZ = canvas.value.components.reduce((max, item) => Math.max(max, item.zIndex), 0)
  const x = Math.min(1920 - preset.w, 80 + (index % 6) * 48)
  const y = Math.min(1080 - preset.h, 140 + (index % 6) * 40)
  const component: CanvasComponent = {
    id: `c_${Date.now().toString(36)}`,
    type: preset.type,
    name,
    frame: { x, y, w: preset.w, h: preset.h },
    zIndex: maxZ + 1,
    locked: false,
    visible: true,
    props: preset.props,
    style: {
      fill: 'rgba(9, 15, 24, 0.72)',
      border: '1px solid rgba(255, 255, 255, 0.07)',
      radius: 10,
      ...preset.style,
    },
  }

  canvas.value = { ...canvas.value, components: [...canvas.value.components, component] }
  selectedId.value = component.id
  saveState.value = 'dirty'
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void persist(), 700)
  toast(`已添加「${name}」到画布`)
}

function onPropertyUpdate(
  patch: Partial<Pick<CanvasComponent, 'frame' | 'style' | 'props' | 'locked' | 'binding'>>,
) {
  const id = selectedId.value
  if (!id) return
  if (Date.now() - lastPropAt > 500) pushHistory()
  lastPropAt = Date.now()
  canvas.value = {
    ...canvas.value,
    components: canvas.value.components.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  }
  markDirty()
}

function resetSelectedStyle() {
  const id = selectedId.value
  if (!id) return
  pushHistory()
  canvas.value = {
    ...canvas.value,
    components: canvas.value.components.map((item) => (item.id === id ? { ...item, style: {} } : item)),
  }
  markDirty()
  toast('已重置组件样式')
}

function applyProperties() {
  void persist()
  toast('组件属性已应用')
}

function addGeo(payload: CustomMapSubmitPayload) {
  geoOpen.value = false
  const width = 560
  const height = payload.view === '3d' ? 520 : 480
  const index = canvas.value.components.length
  const maxZ = canvas.value.components.reduce((max, item) => Math.max(max, item.zIndex), 0)
  const component: CanvasComponent = {
    id: `c_${Date.now().toString(36)}`,
    type: 'map.geo',
    name: payload.mapName,
    frame: {
      x: Math.min(1920 - width, 80 + (index % 6) * 48),
      y: Math.min(1080 - height, 140 + (index % 6) * 40),
      w: width,
      h: height,
    },
    zIndex: maxZ + 1,
    locked: false,
    visible: true,
    props: {
      title: payload.mapName,
      view: payload.view,
      autoRotate: payload.view === '3d' ? 'true' : 'false',
      map: payload.mapKey,
    },
    style: {
      fill: 'rgba(9, 15, 24, 0.72)',
      border: '1px solid rgba(255, 255, 255, 0.07)',
      radius: 10,
      color: '#5ef2c2',
    },
    binding: payload.dataset
      ? {
        sourceId: payload.dataset.id,
        path: '',
        refresh: 0,
        fields: { category: payload.dataset.categoryField, value: payload.dataset.valueField },
      }
      : undefined,
  }

  canvas.value = { ...canvas.value, components: [...canvas.value.components, component] }
  selectedId.value = component.id
  markDirty()
  if (payload.dataset) {
    void listDatasets()
      .then((list) => {
        datasets.value = list
      })
      .catch(() => { })
  }
  toast(`已生成${payload.view === '3d' ? ' 3D ' : ' 2D '}地图「${payload.mapName}」`)
}
</script>

<template>
  <div class="editor-page" :class="panel === 'props' ? 'body-panel-props' : 'body-panel-ai'">
    <div class="ed-shell">
      <header class="ed-topbar">
        <div class="ed-brand">
          <AppLogo small compact />
          <span class="ed-brand-name">NEXA</span>
        </div>
        <button class="icon-btn ed-back" type="button" title="返回工作台" @click="backHome">
          <Icon name="chevron-left" />
        </button>
        <div class="ed-title-wrap">
          <template v-if="renamingName">
            <input :ref="setNameInput" v-model="nameDraft" class="ed-title-input" maxlength="80"
              @keydown.enter.prevent="commitRenameName" @keydown.esc.prevent="cancelRenameName"
              @blur="commitRenameName" />
          </template>
          <button v-else-if="project" class="ed-title ed-title-btn" type="button" title="点击重命名草稿"
            @click="startRenameName">
            {{ projectName }}
            <Icon name="edit" :size="10" class="ed-title-edit" />
          </button>
          <span v-else class="ed-title">{{ projectName }}</span>
          <span class="ed-badge">{{ project?.type === 'template' ? '模板' : '草稿' }}</span>
          <span class="save-state" :class="{ 'is-dirty': saveState === 'dirty', 'is-error': saveState === 'error' }">
            <Icon :name="saveState === 'error' ? 'warning' : 'check'" :size="12" /> {{ saveLabel }}
          </span>
        </div>

        <div class="ed-page-tabs" @click.stop>
          <div class="page-tab-list">
            <button v-for="tab in tabs" :key="tab.id" class="page-tab" type="button"
              :class="{ 'is-active': tab.id === projectId }" :title="tab.name" @click="switchTab(tab.id)">
              <span class="dot" />
              <span class="page-tab-label">{{ tab.name }}</span>
              <span class="page-tab-close" title="关闭标签" @click.stop="closeTab(tab.id)">
                <Icon name="x" :size="9" />
              </span>
            </button>
          </div>
          <button class="page-add" type="button" title="打开其他草稿或新建" @click="toggleTabMenu">
            <Icon name="plus" :size="14" />
          </button>

          <div v-if="tabMenuOpen" class="tab-menu">
            <div class="tab-menu-head">打开草稿</div>
            <div v-if="!tabPicks.length" class="tab-menu-empty">没有其他草稿了，可新建一个</div>
            <button v-for="pick in tabPicks.slice(0, 6)" :key="pick.id" class="tab-menu-item" type="button"
              @click="switchTab(pick.id)">
              <span class="tab-menu-name">{{ pick.name }}</span>
              <span class="tab-menu-meta">{{ pick.componentCount }} 个组件</span>
            </button>
            <button class="tab-menu-item is-create" type="button" :disabled="tabBusy" @click="createTab">
              <span>
                <Icon name="plus" :size="12" /> 新建空白草稿
              </span>
              <span class="tab-menu-meta">自动保存</span>
            </button>
          </div>
        </div>

        <div class="ed-actions">
          <button class="icon-btn" type="button" title="撤销 Ctrl+Z" :style="{ opacity: canUndo ? 1 : 0.35 }"
            @click="undo">
            <Icon name="undo" />
          </button>
          <button class="icon-btn" type="button" title="重做 Ctrl+Shift+Z" :style="{ opacity: canRedo ? 1 : 0.35 }"
            @click="redo">
            <Icon name="redo" />
          </button>
          <span class="ed-divider" />
          <button class="icon-btn" :class="{ 'is-on': gridVisible }" type="button"
            :title="gridVisible ? '隐藏网格' : '显示网格'" @click="gridVisible = !gridVisible">
            <Icon name="dotgrid" />
          </button>
          <button class="icon-btn" type="button" :title="exporting ? '正在导出…' : '导出画布图片'" :disabled="exporting"
            :style="{ opacity: exporting ? 0.4 : 1 }" @click="exportCanvas">
            <Icon name="download" />
          </button>
          <button class="btn btn-ghost preview-btn" type="button" @click="goPreview">
            <Icon name="monitor" :size="13" /> 预览
          </button>
          <button class="btn btn-primary publish-btn" type="button" @click="goPreview">全屏预览
            <Icon name="maximize" :size="14" />
          </button>
        </div>
      </header>

      <div class="ed-main">
        <ComponentLibrary :collapsed="leftCollapsed" :datasets="datasets" @toggle="leftCollapsed = !leftCollapsed"
          @add="addComponent" @add-bound="addBoundComponent" @manage="router.push('/data-sources')" />

        <main class="ed-canvas-area" :class="{ 'is-hand': mode === 'hand', 'is-panning': panning }">
          <div v-if="gridVisible" class="canvas-grid" />

          <div class="canvas-status">
            <b>{{ selectedComponent ? selectedComponent.name : '画布 1' }}</b><span class="sep" /><span>1920 ×
              1080</span><span class="sep" /><span class="live"><span class="dot dot--live" /> {{ mode === 'hand'
                ? '抓手模式 · 拖动画布' : selectedComponent
                  ? '已选中 · 拖动调整位置' : '自动保存已开启' }}</span>
          </div>
          <div class="canvas-top-right">
            <span class="canvas-chip" :class="{ 'is-on': gridVisible }" role="button" tabindex="0"
              :title="gridVisible ? '隐藏网格' : '显示网格'" @click="gridVisible = !gridVisible">
              <Icon name="dotgrid" :size="12" /> {{ gridVisible ? '8px 网格' : '网格已隐藏' }}
            </span>
            <button class="canvas-chip" :class="{ 'is-on': mode === 'select' }" type="button" @click="mode = 'select'">
              <Icon name="mouse-pointer" :size="12" /> 选择
            </button>
            <button class="canvas-chip" :class="{ 'is-on': mode === 'hand' }" type="button" @click="mode = 'hand'">
              <Icon name="hand" :size="12" /> 抓手
            </button>
          </div>

          <div class="board-wrap" :style="boardWrapStyle" @mousedown="onPanStart">
            <div class="board-shadow" />
            <div class="board" :style="boardStyle">
              <div ref="screenRef" class="screen-scale" :style="{ transform: `scale(${zoom / 100})` }">
                <EditorCanvas :canvas="canvas" :selected-id="selectedId" :interactive="mode === 'select'"
                  :datasets="datasetFrames" @select="selectedId = $event" @move="onCanvasMove" />
                <div v-if="gridVisible" class="board-grid" />
              </div>
            </div>
            <div class="board-tag"><b>CANVAS</b> 页面 1 · 深空青主题</div>
            <div class="board-size">1920 × 1080 · {{ zoom }}%</div>
          </div>

          <div class="canvas-tools">
            <button class="ctool" :class="{ 'is-on': mode === 'select' }" type="button" title="选择"
              @click="mode = 'select'">
              <Icon name="cursor" />
            </button>
            <button class="ctool" :class="{ 'is-on': mode === 'hand' }" type="button" title="抓手 / 平移"
              @click="mode = 'hand'">
              <Icon name="hand" />
            </button>
            <span class="ctool-sep" />
            <button class="ctool" type="button" @click="changeZoom(-10)">
              <Icon name="zoom-out" />
            </button>
            <span class="zoom-value">{{ zoom }}%</span>
            <button class="ctool" type="button" @click="changeZoom(10)">
              <Icon name="zoom-in" />
            </button>
            <button class="ctool" type="button" title="适应画布" @click="changeZoom('fit')">
              <Icon name="fit" />
            </button>
            <span class="ctool-sep" />
            <button class="ctool" type="button" title="置于顶层" :disabled="!selectedComponent"
              @click="reorderLayer('front')">
              <Icon name="bring-front" />
            </button>
            <button class="ctool" type="button" title="置于底层" :disabled="!selectedComponent"
              @click="reorderLayer('back')">
              <Icon name="send-back" />
            </button>
          </div>

          <div class="canvas-hint"><kbd>Space</kbd> 拖动画布 <span style="opacity: 0.5">·</span> <kbd>⌘</kbd><kbd>滚轮</kbd>
            缩放 <span style="opacity: 0.5">·</span> <kbd>⇧</kbd> 多选</div>

          <div class="canvas-minimap">
            <span class="mini-label">MINIMAP</span>
            <div class="mini-board" />
          </div>
        </main>

        <aside class="ed-right" :class="{ 'is-collapsed': rightCollapsed }">
          <div class="panel-head">
            <div class="panel-head-title">
              <Icon name="sparkles" :size="14" /><span>{{ panelTitle }}</span>
            </div>
            <div class="panel-head-actions">
              <button class="icon-btn" type="button" title="AI 历史记录">
                <Icon name="clock" />
              </button>
              <button class="icon-btn" type="button" title="收起面板" @click="rightCollapsed = true">
                <Icon name="panel-right" />
              </button>
            </div>
          </div>

          <div class="right-tabs">
            <button class="right-tab ai-tab" :class="{ 'is-active': panel === 'ai' }" type="button"
              @click="setPanel('ai')">
              <Icon name="sparkles" :size="12" /> AI 生成
            </button>
            <button class="right-tab" :class="{ 'is-active': panel === 'props' }" type="button"
              @click="setPanel('props')">
              <Icon name="sliders" :size="12" /> 属性
            </button>
          </div>

          <div class="right-content">
            <AIPanel v-show="panel === 'ai'" :messages="aiMessages" :busy="aiBusy" :project-name="projectName"
              :component-count="canvas.components.length" :dataset-count="datasets.length" @send="onSend"
              @action="onAiAction" />
            <PropertyPanel v-show="panel === 'props'" :component="selectedComponent" :datasets="datasets"
              @update="onPropertyUpdate" @apply="applyProperties" @reset="resetSelectedStyle" />
          </div>

          <button class="panel-collapse" type="button" :title="rightCollapsed ? '展开面板' : '收起面板'"
            @click="rightCollapsed = !rightCollapsed">
            <Icon :name="rightCollapsed ? 'chevron-left' : 'chevron-right'" :size="11" />
          </button>
        </aside>
      </div>
    </div>

    <GeoJsonModal :open="geoOpen" @close="geoOpen = false" @submit="addGeo" />
  </div>
</template>

<style scoped>
.board-grid {
  position: absolute;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(120, 205, 190, 0.16) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(120, 205, 190, 0.16) 1px, transparent 1px),
    radial-gradient(rgba(130, 225, 205, 0.22) 0.6px, transparent 0.8px);
  background-size: 80px 80px, 80px 80px, 8px 8px;
}

.ed-actions .icon-btn.is-on {
  color: #a7c7bf;
}

.canvas-chip[role='button'] {
  cursor: pointer;
}

.save-state.is-dirty {
  color: #f6c37a;
}

.save-state.is-error {
  color: var(--coral);
}

.ed-canvas-area.is-hand,
.ed-canvas-area.is-hand .board-wrap {
  cursor: grab;
}

.ed-canvas-area.is-panning,
.ed-canvas-area.is-panning .board-wrap {
  cursor: grabbing;
}

.board-wrap {
  transition: transform 0.12s var(--ease);
}

.ed-canvas-area.is-panning .board-wrap {
  transition: none;
}
</style>
