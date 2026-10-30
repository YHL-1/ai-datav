<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createEmptyCanvas, type CanvasSchema, type ProjectDetail } from '@nexa/schema'
import EditorCanvas from '@/components/editor/EditorCanvas.vue'
import Icon from '@/components/ui/Icon.vue'
import { OFFICIAL_TEMPLATES } from '@/lib/officialTemplates'
import { getProject } from '@/services/projects'
import { getDatasetData, listDatasets, type DatasetData } from '@/services/datasets'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => String(route.params.id || 'demo'))
const scale = ref(1)
const project = ref<ProjectDetail | null>(null)
const canvas = ref<CanvasSchema>(createEmptyCanvas())
const datasetFrames = ref<Record<string, DatasetData>>({})
const loading = ref(true)

const title = computed(() => project.value?.name ?? '未命名智慧屏')

function fit() {
  scale.value = Math.max(0.1, Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
}

function exit() {
  router.push(`/editor/${projectId.value}`)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') exit()
}

async function load() {
  try {
    project.value = await getProject(projectId.value)
    canvas.value = project.value.canvas
  } catch {
    // 草稿没有后端记录时优先用编辑器跳转前缓存的画布，否则展示官方示例画布
    const cached = sessionStorage.getItem(`nexa.preview.${projectId.value}`)
    canvas.value = cached
      ? (JSON.parse(cached) as CanvasSchema)
      : (JSON.parse(JSON.stringify(OFFICIAL_TEMPLATES[0].canvas)) as CanvasSchema)
  }

  const boundIds = Array.from(
    new Set(
      canvas.value.components
        .map((component) => component.binding?.sourceId)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  await Promise.all(
    boundIds.map(async (id) => {
      try {
        datasetFrames.value = { ...datasetFrames.value, [id]: await getDatasetData(id) }
      } catch {
        // 数据文件被删除时保留示例数据渲染
      }
    }),
  )
  await loadLiveMeta(boundIds)
  loading.value = false
}

/** 实时接口数据源：记录刷新间隔，预览页按间隔轮询 */
const liveMeta = ref<Record<string, number>>({})
const lastFetch = new Map<string, number>()
let liveTimer: number | undefined

async function loadLiveMeta(ids: string[]) {
  try {
    const list = await listDatasets()
    const meta: Record<string, number> = {}
    list.forEach((item) => {
      if (item.kind === 'api' && ids.includes(item.id)) {
        meta[item.id] = Math.max(5, item.refreshSeconds || 30)
      }
    })
    liveMeta.value = meta
    ids.forEach((id) => lastFetch.set(id, Date.now()))
  } catch {
    liveMeta.value = {}
  }
}

async function pollLive() {
  const now = Date.now()
  for (const [id, seconds] of Object.entries(liveMeta.value)) {
    if (now - (lastFetch.get(id) ?? 0) < seconds * 1000) continue
    lastFetch.set(id, now)
    try {
      datasetFrames.value = { ...datasetFrames.value, [id]: await getDatasetData(id) }
    } catch {
      // 接口暂时不可用时保留上一次数据
    }
  }
}

onMounted(() => {
  fit()
  void load()
  window.addEventListener('resize', fit)
  window.addEventListener('keydown', onKeydown)
  liveTimer = window.setInterval(() => void pollLive(), 5000)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  window.removeEventListener('keydown', onKeydown)
  window.clearInterval(liveTimer)
})
</script>

<template>
  <div class="preview-page">
    <div class="preview-stage" :style="{ '--preview-scale': scale }">
      <EditorCanvas :canvas="canvas" :selected-id="null" :interactive="false" :datasets="datasetFrames" />
      <div v-if="loading" class="preview-loading">正在载入画布…</div>
    </div>

    <div class="preview-live">
      <span class="dot dot--live" /> {{ title }} · 1920 × 1080 · {{ Math.round(scale * 100) }}%
    </div>

    <div class="preview-exit">
      <kbd>ESC</kbd>
      <button class="btn" type="button" @click="exit">
        <Icon name="minimize" :size="14" /> 退出预览
      </button>
    </div>
  </div>
</template>

<style scoped>
.preview-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #6c8496;
  font-size: 13px;
  letter-spacing: 0.08em;
  background: rgba(3, 7, 11, 0.6);
}
</style>
