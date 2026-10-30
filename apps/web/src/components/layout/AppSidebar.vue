<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { ProjectSummary } from '@nexa/schema'
import AppLogo from '@/components/ui/AppLogo.vue'
import Icon from '@/components/ui/Icon.vue'
import { getAiKey, setAiKey } from '@/lib/aiKey'
import { toast } from '@/lib/toast'
import { listProjects } from '@/services/projects'
import { listDatasets } from '@/services/datasets'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(
  defineProps<{
    active?: 'home' | 'datasources' | 'drafts' | 'templates'
    draftCount?: number
    templateCount?: number
  }>(),
  { draftCount: 0, templateCount: 3 },
)
const emit = defineEmits<{ (e: 'new-canvas'): void }>()
const auth = useAuthStore()
const router = useRouter()

const displayName = computed(() => auth.user?.displayName ?? '陈默')
const initial = computed(() => displayName.value.slice(0, 1))

const accountOpen = ref(false)
const loggingOut = ref(false)

function closeAccount() {
  accountOpen.value = false
}

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await auth.logout()
    await router.replace('/login')
  } catch {
    toast('退出登录失败，请稍后重试')
  } finally {
    loggingOut.value = false
    closeAccount()
  }
}

onMounted(() => document.addEventListener('click', closeAccount))
onBeforeUnmount(() => document.removeEventListener('click', closeAccount))

const aiKey = ref('')
const aiKeyDraft = ref('')
const aiKeyOpen = ref(false)
const recentProjects = ref<ProjectSummary[]>([])
const dataSourceCount = ref(0)

async function refreshRecent() {
  try {
    recentProjects.value = await listProjects({ type: 'draft', limit: 3 })
  } catch {
    recentProjects.value = []
  }
}

onMounted(async () => {
  aiKey.value = getAiKey()
  await refreshRecent()
  try {
    dataSourceCount.value = (await listDatasets()).length
  } catch {
    dataSourceCount.value = 0
  }
})

const hasAiKey = computed(() => aiKey.value.length > 0)
const maskedAiKey = computed(() => {
  if (!aiKey.value) return '尚未配置 API Key'
  if (aiKey.value.length <= 8) return '••••••••'
  return `${aiKey.value.slice(0, 4)}••••${aiKey.value.slice(-4)}`
})

function openAiConfig() {
  aiKeyDraft.value = aiKey.value
  aiKeyOpen.value = true
}

function saveAiKey() {
  const value = aiKeyDraft.value.trim()
  if (!value) {
    toast('请输入 API Key')
    return
  }
  setAiKey(value)
  aiKey.value = value
  aiKeyOpen.value = false
  toast('AI Key 已保存')
}

function clearAiKey() {
  setAiKey('')
  aiKey.value = ''
  aiKeyDraft.value = ''
  aiKeyOpen.value = false
  toast('已清除 AI Key')
}

defineExpose({ openAiConfig, refreshRecent })
</script>

<template>
  <aside class="sidebar">
    <AppLogo />

    <div class="workspace-account" @click.stop>
      <button class="workspace-switch" :class="{ 'is-open': accountOpen }" type="button" title="账户与工作台"
        @click="accountOpen = !accountOpen">
        <span class="workspace-avatar">{{ initial }}</span>
        <span class="workspace-meta">
          <span class="workspace-name">{{ displayName }}</span>
          <span class="workspace-plan">个人工作台 · FREE</span>
        </span>
        <Icon name="chevron-down" :size="14" />
      </button>

      <div v-if="accountOpen" class="account-menu">
        <div class="account-head">
          <span class="account-name">{{ displayName }}</span>
          <span class="account-mail">{{ auth.user?.email ?? '本地演示账号' }}</span>
        </div>
        <div class="account-row">
          <Icon name="star" :size="13" />
          <span>个人工作台 · 免费版</span>
        </div>
        <button class="account-item" type="button" :disabled="loggingOut" @click="logout">
          <Icon name="logout" :size="13" />
          {{ loggingOut ? '退出中…' : '退出登录' }}
        </button>
      </div>
    </div>

    <button class="btn btn-primary new-canvas-btn" type="button" @click="emit('new-canvas')">
      <Icon name="plus" :size="15" />
      新建画布
    </button>

    <div class="nav-section">
      <div class="nav-label">Workspace</div>
      <nav class="nav-list">
        <RouterLink class="nav-item" :class="{ 'is-active': props.active === 'home' }" to="/home">
          <Icon name="grid" /><span>工作台</span>
        </RouterLink>
        <RouterLink class="nav-item" :class="{ 'is-active': props.active === 'drafts' }" to="/drafts">
          <Icon name="file" /><span>我的草稿</span><span class="nav-count">{{ props.draftCount }}</span>
        </RouterLink>
        <RouterLink class="nav-item" :class="{ 'is-active': props.active === 'templates' }" to="/templates">
          <Icon name="layout" /><span>模板广场</span><span class="nav-count">{{ props.templateCount }}</span>
        </RouterLink>
        <RouterLink class="nav-item" :class="{ 'is-active': props.active === 'datasources' }" to="/data-sources">
          <Icon name="database" /><span>数据源</span><span class="nav-count">{{ dataSourceCount }}</span>
        </RouterLink>
      </nav>
    </div>

    <div class="nav-section" style="margin-top: 18px">
      <div class="nav-label">最近打开 <span class="nav-count" style="letter-spacing: 0">{{
        String(recentProjects.length).padStart(2, '0') }}</span></div>
      <div class="recent-list">
        <RouterLink v-for="project in recentProjects" :key="project.id" class="recent-item"
          :to="`/editor/${project.id}`">
          <span class="dot" /><span>{{ project.name }}</span>
        </RouterLink>
        <div v-if="!recentProjects.length" class="recent-empty">暂无最近编辑的草稿</div>
      </div>
    </div>

    <div class="side-bottom">
      <div class="usage-card ai-card">
        <div class="ai-card-head">
          <span class="ai-card-title">
            <Icon name="sparkles" :size="14" /> AI 能力
          </span>
          <span class="ai-state" :class="{ 'is-on': hasAiKey }"><span class="dot" />{{ hasAiKey ? '已配置' : '未配置'
          }}</span>
        </div>
        <div class="ai-key-value">{{ maskedAiKey }}</div>
        <div class="ai-card-foot">配置硅基流动 API Key 后即可使用 AI 生成与改写大屏</div>
        <button class="btn btn-ai ai-config-btn" type="button" @click="openAiConfig">
          <Icon name="sliders" :size="13" /> {{ hasAiKey ? '管理 AI Key' : '配置 AI Key' }}
        </button>
      </div>
    </div>

    <div v-if="aiKeyOpen" class="overlay is-open" @click.self="aiKeyOpen = false">
      <div class="modal ai-key-modal">
        <div class="modal-head">
          <div>
            <div class="eyebrow">AI SETTINGS</div>
            <h3>配置 AI Key</h3>
            <p>用于 AI 生成与改写大屏，仅保存在当前浏览器。</p>
          </div>
          <button class="icon-btn" type="button" @click="aiKeyOpen = false">
            <Icon name="x" />
          </button>
        </div>
        <div class="modal-body">
          <div class="ai-key-source">
            <span>
              <Icon name="sparkles" :size="13" /> 还没有 Key？前往硅基流动获取
            </span>
            <a href="https://cloud.siliconflow.cn/account/ak" target="_blank" rel="noopener noreferrer">
              硅基流动控制台
              <Icon name="arrow-up-right" :size="11" />
            </a>
          </div>
          <div class="field">
            <label class="field-label">API Key</label>
            <div class="input-wrap">
              <Icon name="lock" :size="14" />
              <input v-model="aiKeyDraft" class="input" type="password" placeholder="sk-..." autocomplete="off" />
            </div>
          </div>
          <div class="ai-key-hint">
            <Icon name="info" :size="12" /> Key 仅保存在当前浏览器、不会上传到服务器；请勿在公共电脑上保存。
          </div>
        </div>
        <div class="modal-foot">
          <button v-if="hasAiKey" class="btn btn-quiet ai-key-clear" type="button" @click="clearAiKey">清除配置</button>
          <span v-else class="hint">
            <Icon name="lock" :size="12" /> 本地存储
          </span>
          <div class="row gap-8">
            <button class="btn btn-quiet" type="button" @click="aiKeyOpen = false">取消</button>
            <button class="btn btn-primary" type="button" @click="saveAiKey">保存</button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.workspace-account {
  position: relative;
}

.workspace-switch {
  width: 100%;
  text-align: left;
}

.workspace-meta {
  align-items: flex-start;
  text-align: left;
}

.workspace-switch .icon {
  transition: transform 0.18s var(--ease);
}

.workspace-switch.is-open {
  border-color: var(--line-strong);
  background: rgba(255, 255, 255, 0.042);
}

.workspace-switch.is-open .icon {
  transform: rotate(180deg);
}

.account-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 60;
  padding: 6px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: rgba(12, 20, 31, 0.98);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(14px);
}

.account-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px 9px;
  border-bottom: 1px solid var(--line-soft);
  margin-bottom: 4px;
}

.account-name {
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}

.account-mail {
  color: var(--dim);
  font-size: 10.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-row {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 10px;
  color: var(--muted);
  font-size: 11px;
}

.account-row .icon {
  color: var(--mint);
}

.account-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--muted);
  font-size: 11.5px;
}

.account-item:hover:not(:disabled) {
  color: var(--coral);
  background: rgba(255, 122, 138, 0.08);
}

.account-item:disabled {
  opacity: 0.6;
  cursor: progress;
}

.recent-empty {
  padding: 6px 2px;
  color: #4f6173;
  font-size: 9px;
  line-height: 1.6;
}

.ai-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ai-card-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #8192a4;
  font-size: 10px;
}

.ai-card-title .icon {
  color: #a78bfa;
}

.ai-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #5d716f;
  font-size: 8.5px;
}

.ai-state .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4b5f70;
}

.ai-state.is-on {
  color: #7fd4bd;
}

.ai-state.is-on .dot {
  background: var(--mint);
  box-shadow: 0 0 6px rgba(94, 242, 194, 0.5);
}

.ai-key-value {
  overflow: hidden;
  color: #8fa3b4;
  font-family: var(--font-mono);
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ai-card-foot {
  color: #4f6173;
  font-size: 8.5px;
  line-height: 1.55;
}

.ai-config-btn {
  height: 30px;
  margin-top: 2px;
  border-radius: 7px;
  font-size: 10px;
}

.ai-key-modal {
  width: 480px;
}

.ai-key-modal .modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ai-key-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #4e6376;
  font-size: 9px;
}

.ai-key-source {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 11px;
  border: 1px solid rgba(167, 139, 250, 0.18);
  border-radius: 8px;
  background: rgba(167, 139, 250, 0.06);
  font-size: 9.5px;
}

.ai-key-source span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #8d9cb0;
}

.ai-key-source .icon {
  color: #a78bfa;
}

.ai-key-source a {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--mint);
  font-size: 9.5px;
  white-space: nowrap;
}

.ai-key-source a:hover {
  text-decoration: underline;
}

.ai-key-hint .icon {
  color: #5b8078;
}

.ai-key-clear {
  color: var(--coral);
}

.ai-key-clear:hover {
  background: rgba(255, 122, 138, 0.08);
}
</style>
