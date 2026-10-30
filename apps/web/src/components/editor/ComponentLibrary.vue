<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import type { DatasetSummary } from '@/services/datasets'

const props = withDefaults(defineProps<{ collapsed: boolean; datasets?: DatasetSummary[] }>(), {
  datasets: () => [],
})
const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'add', name: string): void
  (e: 'add-bound', datasetId: string): void
  (e: 'manage'): void
}>()

const tab = ref<'components' | 'data'>('components')
const search = ref('')

const components = [
  { name: '指标卡', en: 'METRIC', icon: 'chart-line' },
  { name: '折线图', en: 'LINE', icon: 'chart-line' },
  { name: '柱状图', en: 'BAR', icon: 'chart-bar' },
  { name: '环形图', en: 'DONUT', icon: 'chart-pie' },
  { name: '3D 地图', en: 'MAP3D', icon: 'globe' },
  { name: '2D 地图', en: 'MAP', icon: 'globe' },
  { name: '自定义地图', en: 'CUSTOM', icon: 'globe' },
  { name: '数据表格', en: 'TABLE', icon: 'table' },
  { name: '富文本', en: 'TEXT', icon: 'text' },
  { name: '图片 / 装饰', en: 'IMAGE', icon: 'image' },
]

const keyword = computed(() => search.value.trim().toLowerCase())

const filteredComponents = computed(() => {
  if (!keyword.value) return components
  return components.filter((item) => `${item.name} ${item.en}`.toLowerCase().includes(keyword.value))
})

const filteredDatasets = computed(() => {
  if (!keyword.value) return props.datasets
  return props.datasets.filter((item) => `${item.name} ${item.fileName}`.toLowerCase().includes(keyword.value))
})

const latestDataset = computed(() => props.datasets[0] ?? null)
</script>

<template>
  <aside class="ed-left" :class="{ 'is-collapsed': collapsed }">
    <div class="panel-head">
      <div class="panel-head-title">
        <Icon name="grid" :size="14" /><span>组件库</span>
      </div>
      <div class="panel-head-actions">
        <button class="icon-btn" type="button" title="收起面板" @click="emit('toggle')">
          <Icon name="panel-left" :size="14" />
        </button>
      </div>
    </div>

    <div class="lib-tabs">
      <button class="lib-tab" :class="{ 'is-active': tab === 'components' }" type="button" @click="tab = 'components'">
        <Icon name="grid" :size="12" />组件
      </button>
      <button class="lib-tab" :class="{ 'is-active': tab === 'data' }" type="button" @click="tab = 'data'">
        <Icon name="database" :size="12" />数据
      </button>
    </div>

    <div class="lib-search">
      <div class="input-wrap">
        <Icon name="search" :size="13" />
        <input v-model="search" class="input" type="text" :placeholder="tab === 'data' ? '搜索数据文件' : '搜索组件'" />
      </div>
    </div>

    <div class="lib-scroll">
      <template v-if="tab === 'components'">
        <div class="component-grid">
          <button v-for="item in filteredComponents" :key="item.name" class="component-tile" type="button"
            @click="emit('add', item.name)">
            <span class="ct-icon">
              <Icon :name="item.icon" :size="14" />
            </span>
            <span class="ct-name">{{ item.name }}</span>
            <span class="ct-en">{{ item.en }}</span>
          </button>
        </div>
        <div v-if="!filteredComponents.length" class="lib-empty">没有匹配的组件</div>

        <div class="lib-section">
          <div class="lib-section-head">
            <span>可用数据源 <i style="font-style: normal; color: #5c7082">{{ props.datasets.length }}</i></span>
            <button class="link" type="button" @click="emit('manage')">管理 →</button>
          </div>
          <button v-if="latestDataset" class="lib-ds lib-ds--action" type="button" @click="tab = 'data'">
            <Icon name="database" :size="13" />
            <b>{{ latestDataset.name }}</b>
            <span>{{ props.datasets.length }} 个文件 · {{ latestDataset.rowCount }} 行</span>
          </button>
          <button v-else class="lib-ds lib-ds--action" type="button" @click="emit('manage')">
            <Icon name="upload-cloud" :size="13" />
            <b>暂无数据文件</b>
            <span>上传 CSV / JSON 后即可绑定</span>
          </button>
        </div>
      </template>

      <template v-else>
        <div class="lib-section-head" style="padding: 0 2px">
          <span>我的数据文件</span>
          <button class="link" type="button" @click="emit('manage')">上传 →</button>
        </div>
        <div class="lib-data-list">
          <button v-for="item in filteredDatasets" :key="item.id" class="lib-ds lib-ds--action" type="button"
            :title="`添加绑定「${item.name}」的柱状图`" @click="emit('add-bound', item.id)">
            <Icon name="database" :size="13" />
            <b>{{ item.name }}</b>
            <span>{{ item.rowCount }} 行 · {{ item.columns.length }} 列</span>
            <span class="lib-ds-add">
              <Icon name="plus" :size="11" />
            </span>
          </button>
          <div v-if="!filteredDatasets.length" class="lib-empty">
            {{ keyword ? '没有匹配的数据文件' : '还没有数据文件，点击上方「上传」导入 CSV / JSON' }}
          </div>
        </div>
        <div class="lib-ds-tip">
          <Icon name="info" :size="11" />
          <span>点击数据文件会添加一个已绑定的柱状图；选中组件后可在右侧属性面板切换字段。</span>
        </div>
      </template>
    </div>

    <button class="panel-collapse" type="button" title="收起组件库" @click="emit('toggle')">
      <Icon name="chevron-left" :size="11" />
    </button>
  </aside>
</template>

<style scoped>
.lib-ds--action {
  width: 100%;
  text-align: left;
  cursor: pointer;
}

.lib-ds--action:hover {
  border-color: rgba(94, 242, 194, 0.28);
  background: rgba(94, 242, 194, 0.05);
}

.lib-data-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lib-ds-add {
  margin-left: auto;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  color: var(--mint);
  background: rgba(94, 242, 194, 0.1);
}

.lib-empty {
  padding: 18px 8px;
  color: #546879;
  font-size: 9px;
  text-align: center;
  line-height: 1.6;
}

.lib-ds-tip {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: #5c7082;
  font-size: 8.5px;
  line-height: 1.7;
}
</style>
