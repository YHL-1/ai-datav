<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { CanvasSchema, ProjectSummary } from '@nexa/schema'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import TopBar from '@/components/layout/TopBar.vue'
import NewCanvasModal from '@/components/home/NewCanvasModal.vue'
import DraftThumb from '@/components/home/DraftThumb.vue'
import Icon from '@/components/ui/Icon.vue'
import { OFFICIAL_TEMPLATES, type OfficialTemplate } from '@/lib/officialTemplates'
import { draftVariant, formatClock, formatRelative } from '@/lib/projectFormat'
import { toast } from '@/lib/toast'
import { ApiError } from '@/services/api'
import { createProject, getProject, listProjects } from '@/services/projects'

const router = useRouter()
const search = ref('')
const newCanvasOpen = ref(false)
const officialTemplates = OFFICIAL_TEMPLATES
const privateTemplates = ref<ProjectSummary[]>([])
const draftCount = ref(0)
const loading = ref(true)
const usingId = ref<string | null>(null)

onMounted(loadPrivate)

async function loadPrivate() {
  loading.value = true
  try {
    const [drafts, templates] = await Promise.all([
      listProjects({ type: 'draft', limit: 100 }),
      listProjects({ type: 'template', limit: 100 }),
    ])
    draftCount.value = drafts.length
    privateTemplates.value = templates
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '模板加载失败，请刷新重试')
  } finally {
    loading.value = false
  }
}

const templateCount = computed(() => officialTemplates.length + privateTemplates.value.length)

const officialFiltered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return officialTemplates
  return officialTemplates.filter((tpl) => `${tpl.name} ${tpl.desc}`.toLowerCase().includes(q))
})

const privateFiltered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return privateTemplates.value
  return privateTemplates.value.filter((tpl) => tpl.name.toLowerCase().includes(q))
})

/** 模板卡片舱体主题色：与缩略图配色一一对应（薄荷 / 湖蓝 / 琥珀 / 紫罗兰） */
const TEMPLATE_TONES = ['#5ef2c2', '#54c8e8', '#f6c37a', '#a78bfa']

function withAlpha(color: string, alpha: string): string {
  const hex = /^#([0-9a-fA-F]{6})$/.test(color) ? color.slice(1) : '5ef2c2'
  return `#${hex}${alpha}`
}

/** 舱体外壳：四角角标、内框线、扫描层统一由这几个变量驱动 */
function templateShell(variant: number): Record<string, string> {
  const index = ((Math.abs(variant) - 1) % TEMPLATE_TONES.length + TEMPLATE_TONES.length) % TEMPLATE_TONES.length
  const tone = TEMPLATE_TONES[index]!
  return {
    '--tpl-accent': tone,
    '--tpl-a10': withAlpha(tone, '1A'),
    '--tpl-a18': withAlpha(tone, '2E'),
    '--tpl-a32': withAlpha(tone, '52'),
    '--tpl-a55': withAlpha(tone, '8C'),
    '--tpl-a80': withAlpha(tone, 'CC'),
  }
}

/** 不同模板对应不同整卡动效：v1 竖向扫描 / v2 横向流光 / v3 呼吸脉冲 / v4 极光漂移 */
function shellVariant(variant: number): string {
  const index = ((Math.abs(variant) - 1) % 4 + 4) % 4
  return `shell-v${index + 1}`
}

function cloneCanvas(canvas: CanvasSchema): CanvasSchema {
  return JSON.parse(JSON.stringify(canvas)) as CanvasSchema
}

async function useOfficial(template: OfficialTemplate) {
  if (usingId.value) return
  usingId.value = template.id
  try {
    const project = await createProject({ name: template.name, canvas: cloneCanvas(template.canvas) })
    toast(`已用「${template.name}」创建草稿`)
    await router.push(`/editor/${project.id}`)
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '使用模板失败，请稍后重试')
  } finally {
    usingId.value = null
  }
}

async function usePrivate(template: ProjectSummary) {
  if (usingId.value) return
  usingId.value = template.id
  try {
    const detail = await getProject(template.id)
    const project = await createProject({ name: detail.name, canvas: cloneCanvas(detail.canvas) })
    toast(`已用「${template.name}」创建草稿`)
    await router.push(`/editor/${project.id}`)
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '使用模板失败，请稍后重试')
  } finally {
    usingId.value = null
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
      <AppSidebar active="templates" :draft-count="draftCount" :template-count="templateCount"
        @new-canvas="newCanvasOpen = true" />

      <main class="main">
        <TopBar v-model:search="search" crumb="模板广场" placeholder="搜索模板名称或场景" />

        <div class="content">
          <section class="home-view">
            <div class="ds-head">
              <div>
                <div class="eyebrow">TEMPLATE GALLERY</div>
                <h1>模板广场</h1>
                <p>官方模板只读，使用后会复制成你的私有草稿，模板本身不会被修改；私有模板同样仅本人可见。</p>
              </div>
              <div class="ds-head-actions">
                <span class="chip chip--mint">
                  <Icon name="layout" :size="13" /> {{ templateCount }} 个模板
                </span>
                <button class="btn btn-primary" type="button" @click="newCanvasOpen = true">
                  <Icon name="plus" :size="14" /> 新建画布
                </button>
              </div>
            </div>

            <div class="section-head">
              <div class="section-title">
                官方模板 <span class="count">OFFICIAL {{ String(officialTemplates.length).padStart(2, '0') }}</span>
                <span class="section-sub">平台内置只读模板</span>
              </div>
            </div>

            <div class="showcase-grid">
              <article v-for="tpl in officialFiltered" :key="tpl.id" class="draft-card showcase-card tpl-shell"
                :class="shellVariant(tpl.variant)" :style="templateShell(tpl.variant)">
                <DraftThumb :variant="tpl.variant" label="OFFICIAL · 官方" :time="`${tpl.canvas.components.length} 组件`" />
                <div class="showcase-shell" aria-hidden="true" />
                <div class="showcase-info">
                  <span class="showcase-icon">
                    <Icon :name="tpl.icon" :size="14" />
                  </span>
                  <div class="showcase-meta">
                    <b>{{ tpl.name }}</b>
                    <span>{{ tpl.desc }}</span>
                  </div>
                  <button class="btn showcase-use" type="button" :disabled="usingId === tpl.id"
                    @click="useOfficial(tpl)">
                    <Icon :name="usingId === tpl.id ? 'clock' : 'copy'" :size="13" />
                    {{ usingId === tpl.id ? '生成中…' : '使用模板' }}
                  </button>
                </div>
              </article>
            </div>
            <div v-if="!officialFiltered.length" class="empty-state">没有找到匹配的官方模板</div>



            <div class="draft-grid">
              <article v-for="tpl in privateFiltered" :key="tpl.id" class="draft-card tpl-shell"
                :class="shellVariant(draftVariant(tpl.id))" :style="templateShell(draftVariant(tpl.id))">
                <DraftThumb :variant="draftVariant(tpl.id)" label="PRIVATE TEMPLATE"
                  :time="formatClock(tpl.updatedAt)" />
                <div class="showcase-shell" aria-hidden="true" />
                <div class="draft-info">
                  <div class="draft-title-row">
                    <span class="draft-title">{{ tpl.name }}</span>
                    <span class="draft-meta time-inline">{{ formatRelative(tpl.updatedAt) }}</span>
                    <button class="btn private-use" type="button" :disabled="usingId === tpl.id"
                      @click="usePrivate(tpl)">
                      {{ usingId === tpl.id ? '生成中…' : '使用模板' }}
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </main>
    </div>

    <NewCanvasModal :open="newCanvasOpen" @close="newCanvasOpen = false" @create="createCanvas" />
  </div>
</template>

<style scoped>
.showcase-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.showcase-card {
  cursor: default;
}

/* ===== 舱体外壳：内框线 + 四角角标 + 整卡动效层 ===== */
.tpl-shell {
  position: relative;
  isolation: isolate;
  transition: border-color 0.24s var(--ease), transform 0.24s var(--ease), box-shadow 0.24s var(--ease);
}

/* 内胆框线 */
.tpl-shell::before {
  content: '';
  position: absolute;
  inset: 6px;
  z-index: 3;
  border: 1px solid var(--tpl-a10);
  border-radius: 6px;
  pointer-events: none;
  transition: border-color 0.24s var(--ease), box-shadow 0.24s var(--ease);
}

.tpl-shell:hover::before {
  border-color: var(--tpl-a32);
  box-shadow: inset 0 0 18px -8px var(--tpl-a32);
}

.tpl-shell:hover {
  border-color: var(--tpl-a32);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.3), 0 0 24px -10px var(--tpl-a55);
}

.showcase-shell {
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  background: radial-gradient(120% 60% at 50% 0%, var(--tpl-a10), transparent 68%);
}

/* 四角 L 形角标 */
.showcase-shell::before {
  content: '';
  position: absolute;
  inset: 7px;
  background-image:
    linear-gradient(var(--tpl-a80) 0 0), linear-gradient(var(--tpl-a80) 0 0),
    linear-gradient(var(--tpl-a80) 0 0), linear-gradient(var(--tpl-a80) 0 0),
    linear-gradient(var(--tpl-a80) 0 0), linear-gradient(var(--tpl-a80) 0 0),
    linear-gradient(var(--tpl-a80) 0 0), linear-gradient(var(--tpl-a80) 0 0);
  background-repeat: no-repeat;
  background-size: 13px 1.5px, 1.5px 13px, 13px 1.5px, 1.5px 13px, 13px 1.5px, 1.5px 13px, 13px 1.5px, 1.5px 13px;
  background-position: left top, left top, right top, right top, left bottom, left bottom, right bottom, right bottom;
  opacity: 0.5;
  transition: opacity 0.24s var(--ease);
}

.tpl-shell:hover .showcase-shell::before {
  opacity: 1;
}

.showcase-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0.9;
}

/* v1 城市运行：竖向扫描线 */
.shell-v1 .showcase-shell::after {
  background-image: linear-gradient(90deg, transparent 0%, var(--tpl-a10) 38%, var(--tpl-a32) 50%, var(--tpl-a10) 62%, transparent 100%);
  background-size: 42% 100%;
  background-repeat: no-repeat;
  background-position: -42% 0;
  animation: nx-shell-scan 6.4s linear infinite;
}

/* v2 零售周报：横向流光带 */
.shell-v2 .showcase-shell::after {
  background-image: linear-gradient(180deg, transparent 0%, var(--tpl-a10) 38%, var(--tpl-a32) 50%, var(--tpl-a10) 62%, transparent 100%);
  background-size: 100% 40%;
  background-repeat: no-repeat;
  background-position: 0 -40%;
  animation: nx-shell-sweep 5.6s linear infinite;
}

/* v3 能耗监测：整卡呼吸脉冲 */
.shell-v3 .showcase-shell::after {
  background: radial-gradient(78% 52% at 50% 102%, var(--tpl-a18), transparent 72%);
  animation: nx-shell-breathe 4.2s ease-in-out infinite;
}

/* v4 其他模板：极光漂移 */
.shell-v4 .showcase-shell::after {
  background:
    radial-gradient(46% 40% at 16% 10%, var(--tpl-a18), transparent 70%),
    radial-gradient(44% 38% at 84% 18%, var(--tpl-a10), transparent 72%),
    radial-gradient(56% 46% at 50% 100%, var(--tpl-a18), transparent 74%);
  background-size: 170% 170%;
  background-repeat: no-repeat;
  animation: nx-shell-aurora 16s ease-in-out infinite alternate;
}

@keyframes nx-shell-scan {
  0% {
    background-position: -42% 0;
  }

  100% {
    background-position: 142% 0;
  }
}

@keyframes nx-shell-sweep {
  0% {
    background-position: 0 -40%;
  }

  100% {
    background-position: 0 140%;
  }
}

@keyframes nx-shell-breathe {

  0%,
  100% {
    opacity: 0.25;
    box-shadow: inset 0 0 0 1px transparent;
  }

  50% {
    opacity: 0.95;
    box-shadow: inset 0 0 26px -4px var(--tpl-a32);
  }
}

@keyframes nx-shell-aurora {
  0% {
    background-position: 0% 0%, 100% 0%, 50% 100%;
  }

  100% {
    background-position: 64% 46%, 14% 62%, 44% 16%;
  }
}

.showcase-info {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 11px;
}

.draft-info {
  position: relative;
  z-index: 4;
}

.showcase-icon {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--tpl-a18);
  border-radius: 7px;
  background: var(--tpl-a10);
  color: var(--tpl-accent);
}

.showcase-meta {
  min-width: 0;
  flex: 1;
}

.showcase-meta b {
  display: block;
  color: #d1dfe8;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.showcase-meta span {
  display: block;
  margin-top: 2px;
  color: #4b5f71;
  font-size: 8.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.showcase-use {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--tpl-a32);
  border-radius: 7px;
  background: var(--tpl-a10);
  color: var(--tpl-accent);
  font-size: 10px;
  transition: background 0.16s var(--ease);
}

.showcase-use:hover:not(:disabled) {
  background: var(--tpl-a18);
}

.showcase-use:disabled,
.private-use:disabled {
  opacity: 0.6;
  cursor: progress;
}

.private-use {
  margin-left: auto;
  height: 24px;
  padding: 0 8px;
  border: 1px solid rgba(94, 242, 194, 0.2);
  border-radius: 6px;
  background: rgba(94, 242, 194, 0.06);
  color: var(--mint);
  font-size: 9px;
  transition: background 0.16s var(--ease);
}

.private-use:hover:not(:disabled) {
  background: rgba(94, 242, 194, 0.12);
}

.time-inline {
  margin-top: 0;
  font-size: 8px;
}

.empty-state {
  padding: 28px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  color: var(--dim);
  text-align: center;
  font-size: 12px;
}

.section-link {
  cursor: pointer;
}
</style>
