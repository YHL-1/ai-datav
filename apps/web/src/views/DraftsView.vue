<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ProjectSummary } from '@nexa/schema'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import TopBar from '@/components/layout/TopBar.vue'
import NewCanvasModal from '@/components/home/NewCanvasModal.vue'
import DraftThumb from '@/components/home/DraftThumb.vue'
import Icon from '@/components/ui/Icon.vue'
import { draftVariant, formatClock, formatRelative } from '@/lib/projectFormat'
import { toast } from '@/lib/toast'
import { ApiError } from '@/services/api'
import { createProject, deleteProject, listProjects } from '@/services/projects'

const router = useRouter()
const search = ref('')
const newCanvasOpen = ref(false)
const projects = ref<ProjectSummary[]>([])
const loading = ref(true)
const pendingId = ref<string | null>(null)
const deleting = ref(false)

onMounted(load)

async function load() {
  loading.value = true
  try {
    projects.value = await listProjects({ type: 'draft', limit: 100 })
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '草稿加载失败，请刷新重试')
  } finally {
    loading.value = false
  }
}

const drafts = computed(() =>
  projects.value.map((project) => ({
    id: project.id,
    variant: draftVariant(project.id),
    label: 'DRAFT · NEXA',
    clock: formatClock(project.updatedAt),
    title: project.name,
    components: project.componentCount,
    updated: formatRelative(project.updatedAt),
  })),
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return drafts.value
  return drafts.value.filter((draft) => draft.title.toLowerCase().includes(q))
})

const pendingProject = computed(
  () => projects.value.find((project) => project.id === pendingId.value) ?? null,
)

function openDraft(id: string) {
  router.push(`/editor/${id}`)
}

function askRemove(id: string) {
  pendingId.value = id
}

async function confirmRemove() {
  const target = pendingProject.value
  if (!target || deleting.value) return
  deleting.value = true
  try {
    await deleteProject(target.id)
    toast(`已删除「${target.name}」`)
    pendingId.value = null
    await load()
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '删除失败，请稍后重试')
  } finally {
    deleting.value = false
  }
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
      <AppSidebar active="drafts" :draft-count="drafts.length" @new-canvas="newCanvasOpen = true" />

      <main class="main">
        <TopBar v-model:search="search" crumb="我的草稿" placeholder="搜索草稿名称" />

        <div class="content">
          <section class="home-view">
            <div class="ds-head">
              <div>
                <div class="eyebrow">MY DRAFTS</div>
                <h1>我的草稿</h1>
                <p>所有草稿仅本人可见，按最近编辑排序。打开后可继续编辑，保存时自动带上版本号。</p>
              </div>
              <div class="ds-head-actions">
                <span class="chip chip--mint"><Icon name="file" :size="13" /> {{ drafts.length }} 块草稿</span>
                <button class="btn btn-primary" type="button" @click="newCanvasOpen = true">
                  <Icon name="plus" :size="14" /> 新建画布
                </button>
              </div>
            </div>

            <div class="section-head">
              <div class="section-title">
                全部草稿 <span class="count">{{ filtered.length }}</span>
                <span class="section-sub">按最近编辑排序</span>
              </div>
              <span class="section-link" @click="load">
                <Icon name="refresh" :size="12" /> 刷新
              </span>
            </div>

            <div class="draft-grid">
              <article v-for="draft in filtered" :key="draft.id" class="draft-card" @click="openDraft(draft.id)">
                <DraftThumb :variant="draft.variant" :label="draft.label" :time="draft.clock" />
                <button class="draft-remove" type="button" title="删除草稿" @click.stop="askRemove(draft.id)">
                  <Icon name="trash" :size="13" />
                </button>
                <div class="draft-info">
                  <div class="draft-title-row">
                    <span class="draft-title">{{ draft.title }}</span>
                    <span class="draft-open">
                      <Icon name="arrow-up-right" :size="13" />
                    </span>
                  </div>
                  <div class="draft-meta">
                    <span>草稿</span><span class="dot" /><span>{{ draft.components }} 个组件</span><span
                      class="dot" /><span>{{ draft.updated }}</span>
                  </div>
                </div>
              </article>
            </div>

            <div v-if="!filtered.length" class="empty-state">
              {{ loading ? '草稿加载中…' : search.trim() ? '没有找到匹配的草稿' : '还没有草稿，点击右上角「新建画布」开始创作' }}
            </div>
          </section>
        </div>
      </main>
    </div>

    <NewCanvasModal :open="newCanvasOpen" @close="newCanvasOpen = false" @create="createCanvas" />

    <div v-if="pendingId" class="overlay is-open" @click.self="pendingId = null">
      <div class="modal confirm-modal">
        <div class="modal-head">
          <div>
            <div class="eyebrow">DELETE DRAFT</div>
            <h3>删除「{{ pendingProject?.name }}」？</h3>
            <p>删除后无法恢复，画布与组件配置将一并移除。</p>
          </div>
          <button class="icon-btn" type="button" @click="pendingId = null"><Icon name="x" /></button>
        </div>
        <div class="modal-foot">
          <span class="hint"><Icon name="warning" :size="12" /> 此操作不可撤销</span>
          <div class="row gap-8">
            <button class="btn btn-quiet" type="button" @click="pendingId = null">取消</button>
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
.empty-state {
  padding: 28px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  color: var(--dim);
  text-align: center;
  font-size: 12px;
}

.draft-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(5, 11, 15, 0.72);
  color: #6c7f91;
  opacity: 0;
  transition: all 0.18s var(--ease);
  backdrop-filter: blur(6px);
}

.draft-card:hover .draft-remove {
  opacity: 1;
}

.draft-remove:hover {
  border-color: rgba(255, 122, 138, 0.35);
  color: var(--coral);
  background: rgba(255, 122, 138, 0.1);
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

.section-link {
  cursor: pointer;
}
</style>
