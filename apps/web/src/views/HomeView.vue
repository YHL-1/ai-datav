<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ProjectSummary } from '@nexa/schema'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import TopBar from '@/components/layout/TopBar.vue'
import NewCanvasModal from '@/components/home/NewCanvasModal.vue'
import DraftThumb from '@/components/home/DraftThumb.vue'
import Icon from '@/components/ui/Icon.vue'
import EChart from '@/components/screen/EChart.vue'
import { hasAiKey } from '@/lib/aiKey'
import { C, miniBarOption, sparkOption } from '@/lib/chartOptions'
import { draftVariant, formatClock, formatRelative } from '@/lib/projectFormat'
import { toast } from '@/lib/toast'
import { ApiError } from '@/services/api'
import { createProject, deleteProject, listProjects, saveProject } from '@/services/projects'
import { listDatasets, type DatasetSummary } from '@/services/datasets'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const search = ref('')
const aiPrompt = ref('')
const newCanvasOpen = ref(false)
const sidebarRef = ref<InstanceType<typeof AppSidebar> | null>(null)
const projectList = ref<ProjectSummary[]>([])
const draftsLoading = ref(true)
const datasets = ref<DatasetSummary[]>([])
const datasetsLoading = ref(true)

onMounted(async () => {
  if (route.query.modal === 'new') newCanvasOpen.value = true
  await Promise.all([loadProjects(), loadDatasets()])
})

async function loadDatasets() {
  datasetsLoading.value = true
  try {
    datasets.value = await listDatasets()
  } catch {
    datasets.value = []
  } finally {
    datasetsLoading.value = false
  }
}

async function loadProjects() {
  draftsLoading.value = true
  try {
    projectList.value = await listProjects({ type: 'draft', limit: 50 })
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '草稿加载失败，请刷新重试')
  } finally {
    draftsLoading.value = false
  }
}

const stats = computed(() => {
  const drafts = projectList.value
  const sources = datasets.value
  const componentTotal = drafts.reduce((sum, project) => sum + project.componentCount, 0)
  const rowTotal = sources.reduce((sum, dataset) => sum + dataset.rowCount, 0)

  // 近 7 天每天的草稿编辑数
  const daySeries = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - (6 - index))
    const key = day.toDateString()
    return drafts.filter((project) => new Date(project.updatedAt).toDateString() === key).length
  })

  const items = [
    {
      label: '我的草稿',
      value: drafts.length ? String(drafts.length).padStart(2, '0') : '00',
      unit: '块',
      delta: draftsLoading.value ? '加载中' : drafts.length ? `近 7 天编辑 ${daySeries.reduce((a, b) => a + b, 0)} 次` : '暂无草稿',
      color: C.mint,
      chart: 'line' as const,
      series: daySeries,
    },
    {
      label: '画布组件',
      value: String(componentTotal),
      unit: '个',
      delta: drafts.length ? `平均 ${Math.round(componentTotal / drafts.length)} 个/块` : '等待创建草稿',
      color: C.cyan,
      chart: 'bar' as const,
      series: drafts.slice(0, 8).map((project) => project.componentCount),
    },
    {
      label: '数据源',
      value: sources.length ? String(sources.length).padStart(2, '0') : '00',
      unit: '个',
      delta: datasetsLoading.value ? '加载中' : sources.length ? `合计 ${rowTotal} 行数据` : '还没有上传数据文件',
      color: C.amber,
      chart: 'line' as const,
      series: sources.slice(0, 8).map((dataset) => dataset.rowCount),
    },
    {
      label: '数据行数',
      value: String(rowTotal),
      unit: '行',
      delta: sources.length ? `平均每源 ${Math.round(rowTotal / sources.length)} 行` : '在数据源页上传后可用于绑定组件',
      color: C.violet,
      chart: 'bar' as const,
      series: sources.slice(0, 8).map((dataset) => dataset.columns.length),
    },
  ]

  return items.map(({ chart, series, ...stat }) => ({
    ...stat,
    type: chart,
    option:
      chart === 'line'
        ? sparkOption(series.length ? series : [0], stat.color)
        : miniBarOption(series.length ? series : [0], stat.color),
  }))
})

const drafts = computed(() =>
  projectList.value.map((project) => ({
    id: project.id,
    revision: project.revision,
    variant: draftVariant(project.id),
    label: project.type === 'template' ? 'PRIVATE TEMPLATE' : 'DRAFT · NEXA',
    clock: formatClock(project.updatedAt),
    title: project.name,
    status: project.type === 'template' ? '模板' : '草稿',
    components: project.componentCount,
    updated: formatRelative(project.updatedAt),
  })),
)

const renamingId = ref<string | null>(null)
const renameDraftValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

function setRenameInput(el: unknown) {
  renameInput.value = (el as HTMLInputElement | null) ?? null
}

async function startRenameDraft(draft: { id: string; title: string }) {
  renamingId.value = draft.id
  renameDraftValue.value = draft.title
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

function cancelRenameDraft() {
  renamingId.value = null
  renameDraftValue.value = ''
}

async function commitRenameDraft(draft: { id: string; revision: number; title: string }) {
  if (renamingId.value !== draft.id) return
  const name = renameDraftValue.value.trim()
  const current = draft.title
  if (!name || name === current) return cancelRenameDraft()
  if (name.length > 80) {
    toast('草稿名称最多 80 个字符', 2600)
    renameInput.value?.focus()
    return
  }

  try {
    const updated = await saveProject(draft.id, { revision: draft.revision, name })
    projectList.value = projectList.value.map((item) =>
      item.id === draft.id ? { ...item, name: updated.name, revision: updated.revision } : item,
    )
    toast(`已改名为「${updated.name}」`)
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '改名失败，请稍后重试')
  } finally {
    renamingId.value = null
    renameDraftValue.value = ''
  }
}

const deleteId = ref<string | null>(null)
const deleting = ref(false)
const deleteTarget = computed(() => drafts.value.find((draft) => draft.id === deleteId.value) ?? null)

function askRemove(id: string) {
  deleteId.value = id
}

/** 删除草稿时同步移除本机编辑器标签，避免留下失效入口 */
function dropStoredTab(id: string) {
  try {
    const raw = JSON.parse(localStorage.getItem('nexa.editorTabs') ?? '[]') as unknown
    if (!Array.isArray(raw)) return
    localStorage.setItem(
      'nexa.editorTabs',
      JSON.stringify(raw.filter((tab) => (tab as { id?: unknown }).id !== id)),
    )
  } catch {
    // 本地标签数据损坏时忽略，不影响删除流程
  }
}

async function confirmRemove() {
  const target = deleteTarget.value
  if (!target || deleting.value) return
  deleting.value = true
  try {
    await deleteProject(target.id)
    projectList.value = projectList.value.filter((item) => item.id !== target.id)
    dropStoredTab(target.id)
    deleteId.value = null
    toast(`已删除「${target.title}」`)
    await sidebarRef.value?.refreshRecent?.()
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '删除失败，请稍后重试')
  } finally {
    deleting.value = false
  }
}

const templates = [
  {
    name: '城市运行指挥中心',
    desc: '地图 + 指标 + 事件流',
    icon: 'map',
    badge: 'OFFICIAL · 官方',
  },
  {
    name: '零售经营周报',
    desc: '趋势 + 渠道 + 排行',
    icon: 'chart-bar',
    badge: 'OFFICIAL · 官方',
  },
  {
    name: '园区能耗监测',
    desc: '能耗趋势 + 异常告警',
    icon: 'zap',
    badge: 'OFFICIAL · 官方',
  },
]

/** 总览页每块内容最多展示的条数 */
const recentTemplates = templates.slice(0, 3)
const recentDataSources = computed(() => datasets.value.slice(0, 4))

function datasetMeta(dataset: DatasetSummary): string {
  const format = dataset.mimeType.includes('csv') ? 'CSV' : dataset.fileName.split('.').pop()?.toUpperCase() ?? 'FILE'
  return `${format} · ${dataset.rowCount} 行 · ${dataset.columns.length} 列`
}

const filteredDrafts = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = q ? drafts.value.filter((d) => d.title.toLowerCase().includes(q)) : drafts.value
  return list.slice(0, 4)
})

function openDraft(id: string) {
  router.push(`/editor/${id}`)
}

function openTemplate() {
  router.push('/templates')
}

function askAI() {
  if (!hasAiKey()) {
    toast('请先在左下角「AI 能力」中配置硅基流动 API Key', 3600)
    sidebarRef.value?.openAiConfig()
    return
  }
  router.push({
    name: 'editor',
    params: { id: 'demo' },
    query: { panel: 'ai', prompt: aiPrompt.value || '生成一个华东区域经营驾驶舱，深色科技风' },
  })
}

function usePrompt(prompt: string) {
  aiPrompt.value = `生成一个${prompt}大屏，深色科技风，中间地图，左侧指标，右侧趋势`
}

function createCanvas(payload: { name: string; mode: string; template?: string }) {
  newCanvasOpen.value = false
  void (async () => {
    try {
      const project = await createProject({ name: payload.name })
      toast(`已创建「${project.name}」`)
      await router.push(`/editor/${project.id}`)
    } catch (error) {
      toast(error instanceof ApiError ? error.message : '创建失败，请稍后重试')
    }
  })()
}
</script>

<template>
  <div class="home-page">
    <div class="atmosphere" />
    <div class="noise" />

    <div class="app-shell">
      <AppSidebar ref="sidebarRef" active="home" :draft-count="drafts.length" @new-canvas="newCanvasOpen = true" />

      <main class="main">
        <TopBar v-model:search="search" crumb="总览" />

        <div class="content">
          <section class="home-view">
            <div class="greeting">
              <div class="greeting-left">
                <h1>晚上好，{{ auth.user?.displayName ?? '陈默' }}<em>。</em></h1>
                <div class="greeting-sub">2026 年 10 月 29 日 周四 · 上次编辑 8 分钟前</div>
              </div>
              <div class="greeting-right">
                <Icon name="clock" :size="13" />
                <span>本周已创作 4 块大屏</span>
                <span style="width: 1px; height: 14px; background: var(--line)" />
                <RouterLink class="section-link" to="/data-sources">数据源状态
                  <Icon name="arrow-up-right" :size="12" />
                </RouterLink>
              </div>
            </div>

            <div class="hero-ai">
              <div class="hero-spark">
                <Icon name="sparkles" :size="22" />
              </div>
              <div class="hero-body">
                <div class="hero-title-row">
                  <span class="hero-title">把一句话，变成一块<b>屏</b>。</span>
                  <span class="badge badge--mint">AI 生成</span>
                </div>
                <div class="hero-sub">描述场景、布局和数据，AI 输出可编辑的标准组件 Schema，直接落到画布。</div>
                <div class="hero-input-row">
                  <label class="hero-input">
                    <Icon name="wand" :size="15" />
                    <input v-model="aiPrompt" type="text" placeholder="例如：华东区域经营驾驶舱，中间中国地图，左侧四个指标，右侧趋势和渠道占比…" />
                  </label>
                  <button class="btn btn-ai hero-cta" type="button" @click="askAI">
                    <Icon name="sparkles" :size="15" /> AI 生成
                  </button>
                </div>
                <div class="hero-chips">
                  <span class="label">试试</span>
                  <button v-for="p in ['经营驾驶舱', '城市运行态势', '零售门店周报', '园区能耗监测']" :key="p" class="chip" type="button"
                    @click="usePrompt(p)">{{ p }}</button>
                </div>
              </div>
              <div class="hero-side">
                <span class="model-chip"><span class="dot" /> NEXA AI · DeepSeek V3</span>
                <span class="hero-note">结果可编辑、可撤销<br />不执行任意代码</span>
              </div>
            </div>

            <div class="stats">
              <div v-for="stat in stats" :key="stat.label" class="stat-card">
                <div class="stat-top"><span>{{ stat.label }}</span><span class="stat-icon">
                    <Icon :name="stat.type === 'line' ? 'file' : 'layout'" :size="14" />
                  </span></div>
                <div class="stat-main">
                  <div class="stat-value">{{ stat.value }}<span>{{ stat.unit }}</span><span class="stat-delta"
                      :class="{ dim: stat.delta.includes('额度') || stat.delta.includes('已应用') }">{{ stat.delta }}</span>
                  </div>
                  <div class="stat-chart">
                    <EChart :option="stat.option" />
                  </div>
                </div>
              </div>
            </div>

            <div id="drafts" class="section-head">
              <div class="section-title">最近草稿 <span class="count">{{ drafts.length }}</span><span
                  class="section-sub">按最近编辑排序</span></div>
              <RouterLink class="section-link" to="/drafts">查看全部
                <Icon name="arrow-right" :size="12" />
              </RouterLink>
            </div>

            <div class="draft-grid">
              <article v-for="draft in filteredDrafts" :key="draft.id" class="draft-card" @click="openDraft(draft.id)">
                <DraftThumb :variant="draft.variant" :label="draft.label" :time="draft.clock" />
                <div class="draft-info">
                  <div class="draft-title-row">
                    <template v-if="renamingId === draft.id">
                      <input :ref="setRenameInput" v-model="renameDraftValue" class="draft-rename-input" maxlength="80"
                        @click.stop @keydown.enter.prevent="commitRenameDraft(draft)"
                        @keydown.esc.prevent="cancelRenameDraft" @blur="commitRenameDraft(draft)" />
                    </template>
                    <template v-else>
                      <span class="draft-title">{{ draft.title }}</span>
                      <span class="draft-title-actions">
                        <button class="draft-rename-btn" type="button" title="重命名草稿"
                          @click.stop="startRenameDraft(draft)">
                          <Icon name="edit" :size="11" />
                        </button>
                        <button class="draft-rename-btn draft-delete-btn" type="button" title="删除草稿"
                          @click.stop="askRemove(draft.id)">
                          <Icon name="trash" :size="11" />
                        </button>
                        <span class="draft-open">
                          <Icon name="arrow-up-right" :size="13" />
                        </span>
                      </span>
                    </template>
                  </div>
                  <div class="draft-meta"><span>{{ draft.status }}</span><span class="dot" /><span>{{ draft.components
                      }} 个组件</span><span class="dot" /><span>{{ draft.updated }}</span></div>
                </div>
              </article>
            </div>
            <div v-if="!filteredDrafts.length" class="empty-search">
              {{ draftsLoading ? '草稿加载中…' : search.trim() ? '没有找到匹配的草稿' : '还没有草稿，点击左侧「新建画布」开始创作' }}
            </div>

            <div id="templates" class="section-head">
              <div class="section-title">模板广场 <span class="count">OFFICIAL 03</span><span
                  class="section-sub">平台内置只读模板，使用后生成你的私有草稿</span></div>
              <RouterLink class="section-link" to="/templates">进入模板广场
                <Icon name="arrow-right" :size="12" />
              </RouterLink>
            </div>

            <div class="bottom-grid">
              <div class="template-grid">
                <article v-for="(tpl, i) in recentTemplates" :key="tpl.name" class="template-card"
                  @click="openTemplate()">
                  <div class="template-visual">
                    <div class="thumb-grid" />
                    <span class="template-badge">{{ tpl.badge }}</span>
                    <div class="mini-screen">
                      <svg v-if="i === 0" viewBox="0 0 280 66" preserveAspectRatio="none">
                        <g fill="rgba(255,255,255,.1)">
                          <rect x="10" y="8" width="36" height="2" />
                          <rect x="10" y="14" width="24" height="2" />
                        </g>
                        <rect x="10" y="24" width="54" height="32" rx="2" fill="#0c2028" stroke="#245156"
                          stroke-width=".5" />
                        <path d="M16 49 L26 38 L36 42 L44 32 L57 36" fill="none" stroke="#5ef2c2" stroke-width="1" />
                        <rect x="72" y="24" width="54" height="32" rx="2" fill="#0c2028" stroke="#245156"
                          stroke-width=".5" />
                        <g fill="#54c8e8">
                          <rect x="78" y="44" width="4" height="8" />
                          <rect x="85" y="38" width="4" height="14" />
                          <rect x="92" y="41" width="4" height="11" />
                          <rect x="99" y="33" width="4" height="19" />
                          <rect x="106" y="36" width="4" height="16" />
                          <rect x="113" y="29" width="4" height="23" />
                        </g>
                        <rect x="134" y="24" width="64" height="32" rx="2" fill="#0c2028" stroke="#245156"
                          stroke-width=".5" />
                        <path d="M141 46 C154 43, 158 34, 170 37 S186 28, 192 30" fill="none" stroke="#a78bfa"
                          stroke-width="1" />
                        <g fill="rgba(255,255,255,.18)">
                          <rect x="208" y="28" width="38" height="2" />
                          <rect x="208" y="34" width="28" height="2" />
                          <rect x="208" y="40" width="34" height="2" />
                        </g>
                      </svg>
                      <svg v-else-if="i === 1" viewBox="0 0 280 66" preserveAspectRatio="none">
                        <g fill="rgba(255,255,255,.1)">
                          <rect x="10" y="8" width="32" height="2" />
                          <rect x="10" y="14" width="20" height="2" />
                        </g>
                        <g fill="#f6c37a">
                          <rect x="18" y="38" width="9" height="18" rx="1" />
                          <rect x="32" y="32" width="9" height="24" rx="1" />
                          <rect x="46" y="36" width="9" height="20" rx="1" />
                          <rect x="60" y="26" width="9" height="30" rx="1" />
                          <rect x="74" y="21" width="9" height="35" rx="1" />
                        </g>
                        <path d="M16 24 C38 22, 50 14, 70 17 S92 9, 104 12" fill="none" stroke="#5ef2c2"
                          stroke-width="1" />
                        <circle cx="152" cy="40" r="17" fill="none" stroke="#17353b" stroke-width="6" />
                        <circle cx="152" cy="40" r="17" fill="none" stroke="#5ef2c2" stroke-width="6"
                          stroke-dasharray="58 107" transform="rotate(-90 152 40)" />
                        <circle cx="152" cy="40" r="17" fill="none" stroke="#54c8e8" stroke-width="6"
                          stroke-dasharray="30 107" stroke-dashoffset="-58" transform="rotate(-90 152 40)" />
                        <g fill="rgba(255,255,255,.18)">
                          <rect x="184" y="24" width="52" height="2" />
                          <rect x="184" y="31" width="38" height="2" />
                          <rect x="184" y="38" width="46" height="2" />
                          <rect x="184" y="45" width="30" height="2" />
                        </g>
                      </svg>
                      <svg v-else viewBox="0 0 280 66" preserveAspectRatio="none">
                        <g fill="rgba(255,255,255,.1)">
                          <rect x="10" y="8" width="42" height="2" />
                          <rect x="10" y="14" width="26" height="2" />
                        </g>
                        <path
                          d="M12 52 C36 50, 42 32, 64 38 S93 20, 116 26 S146 13, 168 18 S203 10, 224 13 S254 5, 268 8"
                          fill="none" stroke="#5ef2c2" stroke-width="1.4" />
                        <path
                          d="M12 52 C36 50, 42 32, 64 38 S93 20, 116 26 S146 13, 168 18 S203 10, 224 13 S254 5, 268 8 L268 58 L12 58 Z"
                          fill="rgba(94,242,194,.07)" />
                        <g fill="rgba(255,255,255,.18)">
                          <rect x="12" y="62" width="30" height="1.5" />
                          <rect x="52" y="62" width="30" height="1.5" />
                          <rect x="92" y="62" width="30" height="1.5" />
                          <rect x="132" y="62" width="30" height="1.5" />
                          <rect x="172" y="62" width="30" height="1.5" />
                        </g>
                      </svg>
                    </div>
                  </div>
                  <div class="template-info">
                    <span class="template-icon">
                      <Icon :name="tpl.icon" :size="12" />
                    </span>
                    <span class="template-name"><b>{{ tpl.name }}</b><span>{{ tpl.desc }}</span></span>
                  </div>
                </article>
              </div>

              <div class="ds-rail">
                <div class="ds-rail-head">
                  <span class="title">
                    <Icon name="database" :size="13" /> 数据源
                  </span>
                  <RouterLink class="section-link" to="/data-sources">管理
                    <Icon name="arrow-right" :size="12" />
                  </RouterLink>
                </div>
                <div class="ds-rail-list">
                  <div v-for="source in recentDataSources" :key="source.id" class="ds-row">
                    <span class="ds-row-icon">
                      <Icon name="file" :size="13" />
                    </span>
                    <span class="ds-row-meta"><b>{{ source.name }}</b><span>{{ datasetMeta(source) }}</span></span>
                    <span class="ds-row-state">
                      <Icon name="check" :size="10" />{{ formatRelative(source.createdAt) }}
                    </span>
                  </div>
                  <div v-if="!recentDataSources.length" class="ds-empty">
                    {{ datasetsLoading ? '数据源加载中…' : '还没有数据文件，去数据源页上传 CSV / Excel' }}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>

    <NewCanvasModal :open="newCanvasOpen" @close="newCanvasOpen = false" @create="createCanvas" />

    <div v-if="deleteId" class="overlay is-open" @click.self="deleteId = null">
      <div class="modal confirm-modal">
        <div class="modal-head">
          <div>
            <div class="eyebrow">DELETE DRAFT</div>
            <h3>删除「{{ deleteTarget?.title }}」？</h3>
            <p>删除后无法恢复，画布与组件配置将一并移除。</p>
          </div>
          <button class="icon-btn" type="button" @click="deleteId = null">
            <Icon name="x" />
          </button>
        </div>
        <div class="modal-foot">
          <span class="hint">
            <Icon name="warning" :size="12" /> 此操作不可撤销
          </span>
          <div class="row gap-8">
            <button class="btn btn-quiet" type="button" @click="deleteId = null">取消</button>
            <button class="btn confirm-danger" type="button" :disabled="deleting" @click="confirmRemove">
              {{ deleting ? '删除中…' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ds-empty {
  padding: 14px 4px;
  color: var(--dim);
  font-size: 10px;
  line-height: 1.6;
}

.empty-search {
  padding: 28px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  color: var(--dim);
  text-align: center;
  font-size: 12px;
}

.template-visual .mini-screen {
  position: absolute;
  inset: 9px 11px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 4px;
  overflow: hidden;
  background: #060c12;
}

.template-visual .mini-screen .thumb-grid {
  opacity: 0.45;
}

.mini-screen svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.draft-card:hover .draft-delete-btn {
  color: var(--coral);
  background: rgba(255, 122, 138, 0.08);
}

.draft-delete-btn:hover {
  color: var(--coral);
  background: rgba(255, 122, 138, 0.16);
}

.confirm-modal {
  width: 420px;
}

.confirm-danger {
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(255, 122, 138, 0.32);
  border-radius: 7px;
  background: rgba(255, 122, 138, 0.12);
  color: var(--coral);
  font-size: 12px;
  transition: background 0.16s var(--ease);
}

.confirm-danger:hover:not(:disabled) {
  background: rgba(255, 122, 138, 0.2);
}

.confirm-danger:disabled {
  opacity: 0.6;
  cursor: progress;
}
</style>
