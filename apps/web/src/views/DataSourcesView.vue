<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import TopBar from '@/components/layout/TopBar.vue'
import NewCanvasModal from '@/components/home/NewCanvasModal.vue'
import Icon from '@/components/ui/Icon.vue'
import { toast } from '@/lib/toast'
import { formatRelative } from '@/lib/projectFormat'
import { ApiError } from '@/services/api'
import { deleteDataset, createApiDataset, listDatasets, uploadDataset, type DatasetSummary } from '@/services/datasets'

const router = useRouter()
const newCanvasOpen = ref(false)
const search = ref('')
const datasets = ref<DatasetSummary[]>([])
const loading = ref(true)
const uploading = ref(false)
const selectedId = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(loadDatasets)

async function loadDatasets() {
  loading.value = true
  try {
    datasets.value = await listDatasets()
    if (!selectedId.value) selectedId.value = datasets.value[0]?.id ?? ''
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '数据文件加载失败')
  } finally {
    loading.value = false
  }
}

const selected = computed(() => datasets.value.find((item) => item.id === selectedId.value) ?? null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return datasets.value
  return datasets.value.filter((item) => `${item.name} ${item.fileName}`.toLowerCase().includes(q))
})

const totals = computed(() => ({
  count: datasets.value.length,
  rows: datasets.value.reduce((sum, item) => sum + item.rowCount, 0),
  latest: datasets.value[0] ? formatRelative(datasets.value[0].createdAt) : '暂无',
}))

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function extensionOf(item: DatasetSummary): string {
  if (item.kind === 'api') return 'API'
  return item.fileName.toLowerCase().endsWith('.json') ? 'JSON' : 'CSV'
}

const apiOpen = ref(false)
const apiName = ref('')
const apiUrl = ref('')
const apiRefresh = ref(30)
const apiBusy = ref(false)

function openApiModal() {
  apiOpen.value = true
  apiName.value = ''
  apiUrl.value = ''
  apiRefresh.value = 30
}

async function submitApi() {
  if (apiBusy.value) return
  const url = apiUrl.value.trim()
  if (!url) {
    toast('请填写接口地址')
    return
  }
  apiBusy.value = true
  try {
    const dataset = await createApiDataset({
      name: apiName.value.trim(),
      url,
      refreshSeconds: Number(apiRefresh.value) || 30,
    })
    toast(`已接入「${dataset.name}」· ${dataset.rowCount} 行 · 每 ${dataset.refreshSeconds} 秒刷新`)
    apiOpen.value = false
    await loadDatasets()
    selectedId.value = dataset.id
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '接口接入失败，请检查地址')
  } finally {
    apiBusy.value = false
  }
}

function pickFile() {
  fileInput.value?.click()
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const dataset = await uploadDataset(file)
    toast(`已上传「${dataset.fileName}」· ${dataset.rowCount} 行`)
    await loadDatasets()
    selectedId.value = dataset.id
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '上传失败，请稍后重试')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function removeDataset(item: DatasetSummary) {
  if (!window.confirm(`删除数据集「${item.name}」？文件会同时从服务器本地移除。`)) return
  try {
    await deleteDataset(item.id)
    if (selectedId.value === item.id) selectedId.value = ''
    toast('数据集已删除')
    await loadDatasets()
  } catch (error) {
    toast(error instanceof ApiError ? error.message : '删除失败')
  }
}

function createCanvas() {
  newCanvasOpen.value = false
  router.push('/home#drafts')
}
</script>

<template>
  <div class="home-page">
    <div class="atmosphere" />
    <div class="noise" />

    <div class="app-shell">
      <AppSidebar active="datasources" :draft-count="0" @new-canvas="newCanvasOpen = true" />

      <main class="main">
        <TopBar v-model:search="search" crumb="数据源" placeholder="搜索数据文件名称" />

        <div class="content">
          <section class="ds-view">
            <div class="ds-head">
              <div>
                <div class="eyebrow">UPLOADED DATA</div>
                <h1>数据源</h1>
                <p>上传 CSV / JSON 数据文件，文件保存到服务器本地，解析后的行列结构与前 5 行预览会一并记录，仅本人可见。</p>
              </div>
              <div class="ds-head-actions">
                <span class="chip chip--mint">
                  <Icon name="upload-cloud" :size="13" /> 单文件 ≤ 10 MB
                </span>
                <button class="btn btn-ghost" type="button" @click="openApiModal">
                  <Icon name="globe" :size="14" /> 接入 API
                </button>
                <button class="btn btn-primary" type="button" :disabled="uploading" @click="pickFile">
                  <Icon name="upload-cloud" :size="14" /> {{ uploading ? '上传中…' : '上传数据' }}
                </button>
                <input ref="fileInput" type="file" accept=".csv,.json,text/csv,application/json" hidden
                  @change="onFileChange" />
              </div>
            </div>

            <div class="ds-stats">
              <div class="ds-stat"><span class="ds-stat-icon">
                  <Icon name="database" :size="15" />
                </span>
                <div><b>{{ totals.count }}</b><span>数据集总数</span></div>
              </div>
              <div class="ds-stat"><span class="ds-stat-icon">
                  <Icon name="table" :size="15" />
                </span>
                <div><b>{{ totals.rows }}</b><span>数据总行数</span></div>
              </div>
              <div class="ds-stat"><span class="ds-stat-icon">
                  <Icon name="clock" :size="15" />
                </span>
                <div><b style="font-size: 13px">{{ totals.latest }}</b><span>最近上传</span></div>
              </div>
            </div>

            <div class="ds-layout">
              <div class="ds-table-card">
                <div class="ds-toolbar">
                  <div class="search input-wrap">
                    <Icon name="search" :size="13" />
                    <input v-model="search" class="input" type="text" placeholder="搜索数据文件名称" />
                  </div>
                  <span class="ds-page-right-note">
                    <Icon name="lock" :size="12" /> 仅本人可见 · 本地存储
                  </span>
                </div>

                <table class="ds-table">
                  <thead>
                    <tr>
                      <th style="width: 34%">名称 / 文件</th>
                      <th style="width: 9%">格式</th>
                      <th style="width: 10%">行数</th>
                      <th style="width: 9%">列数</th>
                      <th style="width: 12%">大小</th>
                      <th style="width: 14%">上传时间</th>
                      <th style="width: 12%">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in filtered" :key="item.id" :class="{ 'is-selected': item.id === selectedId }"
                      @click="selectedId = item.id">
                      <td>
                        <div class="ds-name">
                          <span class="ds-logo">
                            <Icon
                              :name="item.kind === 'api' ? 'globe' : extensionOf(item) === 'JSON' ? 'file' : 'table'"
                              :size="14" />
                          </span>
                          <span><b>{{ item.name }}</b><span>{{ item.kind === 'api' ? item.sourceUrl : item.fileName
                          }}</span></span>
                        </div>
                      </td>
                      <td><span class="ds-method"
                          :style="item.kind === 'api' ? 'color:#7fd8f0;background:rgba(84,200,232,.1)' : extensionOf(item) === 'JSON' ? 'color:#b7a2ed;background:rgba(167,139,250,.09)' : ''">{{
                            extensionOf(item) }}</span></td>
                      <td>{{ item.rowCount }}</td>
                      <td>{{ item.columns.length }}</td>
                      <td>{{ item.kind === 'api' ? `每 ${item.refreshSeconds}s` : formatSize(item.size) }}</td>
                      <td>{{ formatRelative(item.createdAt) }}</td>
                      <td>
                        <div class="ds-actions" @click.stop>
                          <button class="icon-btn" type="button" title="预览" @click="selectedId = item.id">
                            <Icon name="eye" />
                          </button>
                          <button class="icon-btn" type="button" title="删除" @click="removeDataset(item)">
                            <Icon name="trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div v-if="!loading && !filtered.length" class="empty-search" style="padding: 36px 20px">
                  {{ search.trim() ? '没有找到匹配的数据文件' : '还没有数据文件，点击右上角「上传数据」导入 CSV / JSON' }}
                </div>
                <div v-else-if="loading" class="empty-search" style="padding: 36px 20px">正在加载数据文件…</div>
              </div>

              <aside class="ds-drawer">
                <div class="drawer-head">
                  <div>
                    <h3>{{ selected ? selected.name : '数据预览' }}</h3>
                    <p>{{ selected ? `${selected.rowCount} 行 · ${selected.columns.length} 列 ·
                      ${formatSize(selected.size)}` : '上传后在这里查看结构预览' }}</p>
                  </div>
                  <button class="icon-btn" type="button" @click="selectedId = ''">
                    <Icon name="x" />
                  </button>
                </div>

                <div class="drawer-body">
                  <div v-if="!selected" class="prop-empty" style="padding: 40px 12px">
                    <Icon name="database" :size="20" />
                    <b>未选择数据集</b>
                    <span>上传 CSV / JSON 后，点击左侧列表即可查看列结构与前 5 行预览。</span>
                  </div>
                  <template v-else>
                    <div class="drawer-preview">
                      <div class="drawer-preview-head">
                        <span>前 {{ selected.preview.length }} 行预览</span>
                        <span style="color: #6bc3a9">已解析</span>
                      </div>
                      <div class="preview-table">
                        <table>
                          <thead>
                            <tr>
                              <th v-for="column in selected.columns" :key="column">{{ column }}</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(row, index) in selected.preview" :key="index">
                              <td v-for="column in selected.columns" :key="column">{{ row[column] }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div class="drawer-warning">
                      <Icon name="info" :size="13" />
                      <span v-if="selected.kind === 'api'">该数据源为外部实时接口，编辑器和预览页会按 {{ selected.refreshSeconds }}
                        秒间隔通过服务器拉取最新数据；接口不可用时图表会保留上一次结果。</span>
                      <span v-else>文件保存在服务器本地，数据库只记录元数据与预览；删除数据集会同时移除本地文件。</span>
                    </div>
                    <div class="field">
                      <label class="field-label">{{ selected.kind === 'api' ? '接口地址' : '原始文件' }}</label>
                      <div class="input-wrap">
                        <Icon :name="selected.kind === 'api' ? 'globe' : 'file'" :size="13" /><input class="input"
                          type="text" :value="selected.kind === 'api' ? selected.sourceUrl ?? '' : selected.fileName"
                          readonly />
                      </div>
                    </div>
                    <div v-if="selected.kind === 'api'" class="field">
                      <label class="field-label">刷新间隔</label>
                      <div class="input-wrap">
                        <Icon name="clock" :size="13" /><input class="input" type="text"
                          :value="`每 ${selected.refreshSeconds} 秒`" readonly />
                      </div>
                    </div>
                    <div class="field">
                      <label class="field-label">{{ selected.kind === 'api' ? '接入时间' : '上传时间' }}</label>
                      <div class="input-wrap">
                        <Icon name="clock" :size="13" /><input class="input" type="text"
                          :value="new Date(selected.createdAt).toLocaleString('zh-CN')" readonly />
                      </div>
                    </div>
                  </template>
                </div>

                <div class="drawer-foot">
                  <button v-if="selected" class="btn btn-ghost" type="button" @click="removeDataset(selected)">
                    <Icon name="trash" :size="14" /> 删除数据集
                  </button>
                  <button class="btn btn-primary" type="button" :disabled="uploading" @click="pickFile">
                    <Icon name="upload-cloud" :size="14" /> 上传新文件
                  </button>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
    </div>

    <div class="overlay" :class="{ 'is-open': apiOpen }" @click.self="apiOpen = false">
      <div class="modal" style="width: 520px">
        <div class="modal-head">
          <div>
            <h3>接入 HTTP API 数据源</h3>
            <p>填写返回 JSON 数组（或 { data: [] }）的接口地址，服务器会定时拉取最新数据。</p>
          </div>
          <button class="icon-btn" type="button" @click="apiOpen = false">
            <Icon name="x" />
          </button>
        </div>
        <div class="modal-body">
          <div class="modal-form">
            <div class="field">
              <label class="field-label">数据源名称</label>
              <div class="input-wrap">
                <Icon name="database" :size="13" />
                <input v-model="apiName" class="input" type="text" placeholder="留空则使用域名，例如 实时销售" />
              </div>
            </div>
            <div class="field">
              <label class="field-label">接口地址</label>
              <div class="input-wrap">
                <Icon name="globe" :size="13" />
                <input v-model="apiUrl" class="input" type="text" placeholder="https://api.example.com/sales.json" />
              </div>
            </div>
            <div class="field">
              <label class="field-label">刷新间隔（秒）</label>
              <div class="input-wrap">
                <Icon name="clock" :size="13" />
                <input v-model.number="apiRefresh" class="input" type="number" min="5" max="3600" step="5" />
              </div>
            </div>
            <div class="drawer-warning">
              <Icon name="info" :size="13" />
              <span>接口需返回对象数组，如 [{"城市":"杭州","销量":120}]；只允许 http/https，超时 15 秒。</span>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <span class="hint">
            <Icon name="lock" :size="12" /> 数据经服务器代理拉取，不暴露给第三方
          </span>
          <button class="btn btn-ghost" type="button" @click="apiOpen = false">取消</button>
          <button class="btn btn-primary" type="button" :disabled="apiBusy" @click="submitApi">
            <Icon name="globe" :size="14" /> {{ apiBusy ? '连接中…' : '连接并保存' }}
          </button>
        </div>
      </div>
    </div>

    <NewCanvasModal :open="newCanvasOpen" @close="newCanvasOpen = false" @create="createCanvas" />
  </div>
</template>

<style scoped>
.preview-table {
  max-height: 220px;
  margin-top: 8px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.preview-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9px;
}

.preview-table th,
.preview-table td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  text-align: left;
  white-space: nowrap;
}

.preview-table th {
  color: #8ea3b6;
  background: rgba(255, 255, 255, 0.04);
  font-weight: 600;
}

.preview-table td {
  color: #9fb3c4;
}
</style>
