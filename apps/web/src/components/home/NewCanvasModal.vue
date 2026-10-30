<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'create', payload: { name: string; mode: 'blank' | 'template'; template?: string }): void }>()

const mode = ref<'blank' | 'template'>('blank')
const name = ref('未命名智慧屏')
const picked = ref('城市运行')

const templates = [
  { key: '城市运行', label: '城市运行' },
  { key: '经营驾驶舱', label: '经营驾驶舱' },
  { key: '能耗监测', label: '能耗监测' },
]

function create() {
  emit('create', { name: name.value || '未命名智慧屏', mode: mode.value, template: mode.value === 'template' ? picked.value : undefined })
}
</script>

<template>
  <div v-if="open" class="overlay is-open" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="eyebrow">NEW CANVAS</div>
          <h3>新建一块智慧屏</h3>
          <p>固定画板 1920 × 1080，创建后可在编辑器中自由编排。</p>
        </div>
        <button class="icon-btn" type="button" @click="emit('close')"><Icon name="x" /></button>
      </div>
      <div class="modal-body">
        <div class="new-options">
          <button class="new-option" :class="{ 'is-selected': mode === 'blank' }" type="button" @click="mode = 'blank'">
            <span class="opt-icon"><Icon name="layout" :size="16" /></span>
            <span class="opt-check"><Icon name="check" :size="10" /></span>
            <h4>空白画布</h4>
            <p>从零开始，拖入组件，或用 AI 生成一整块屏幕。</p>
          </button>
          <button class="new-option" :class="{ 'is-selected': mode === 'template' }" type="button" @click="mode = 'template'">
            <span class="opt-icon"><Icon name="folder" :size="16" /></span>
            <span class="opt-check"><Icon name="check" :size="10" /></span>
            <h4>基于模板新建</h4>
            <p>从官方模板开始，保留布局与样式，替换成你的数据。</p>
          </button>
        </div>

        <div v-if="mode === 'template'" class="template-mini-row">
          <button
            v-for="(tpl, i) in templates"
            :key="tpl.key"
            class="template-mini"
            :class="{ 'is-picked': picked === tpl.key }"
            type="button"
            :style="{ background: ['radial-gradient(120px 70px at 20% 0%, rgba(94,242,194,.12), transparent), #070d13', 'radial-gradient(120px 70px at 80% 0%, rgba(246,195,122,.1), transparent), #070d13', 'radial-gradient(120px 70px at 50% 100%, rgba(167,139,250,.1), transparent), #070d13'][i] }"
            @click="picked = tpl.key"
          >
            <svg viewBox="0 0 118 58" style="position: absolute; inset: 0; width: 100%; height: 100%">
              <template v-if="i === 0">
                <path d="M22 34 L32 22 L44 26 L53 18 L66 23 L75 18 L88 27 L100 31 L96 40 L84 44 L72 40 L62 46 L50 41 L38 45 L29 39 Z" fill="#0c2028" stroke="#2b5d61" stroke-width=".7" />
                <circle cx="65" cy="31" r="1.5" fill="#5ef2c2" /><circle cx="65" cy="31" r="3.5" fill="none" stroke="#5ef2c2" opacity=".4" />
              </template>
              <template v-else-if="i === 1">
                <g fill="#f6c37a"><rect x="18" y="32" width="7" height="16" /><rect x="29" y="26" width="7" height="22" /><rect x="40" y="30" width="7" height="18" /><rect x="51" y="20" width="7" height="28" /></g>
                <circle cx="88" cy="34" r="12" fill="none" stroke="#17353b" stroke-width="5" />
                <circle cx="88" cy="34" r="12" fill="none" stroke="#5ef2c2" stroke-width="5" stroke-dasharray="40 75" transform="rotate(-90 88 34)" />
              </template>
              <template v-else>
                <path d="M14 45 C30 43, 34 28, 49 33 S71 18, 87 24 S102 15, 108 17" fill="none" stroke="#5ef2c2" stroke-width="1.3" />
                <path d="M14 45 C30 43, 34 28, 49 33 S71 18, 87 24 S102 15, 108 17 L108 50 L14 50 Z" fill="rgba(94,242,194,.07)" />
              </template>
            </svg>
            <span>{{ tpl.label }}</span>
          </button>
        </div>

        <div class="modal-form">
          <div class="field">
            <label class="field-label">画布名称</label>
            <div class="input-wrap"><input v-model="name" class="input" type="text" /></div>
          </div>
          <div class="field">
            <label class="field-label">画布尺寸</label>
            <div class="select-box">1920 × 1080 · 16:9 <Icon name="chevron-down" :size="12" /></div>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <span class="hint"><Icon name="info" :size="12" /> 创建后可随时重命名，自动保存草稿</span>
        <div class="row gap-8">
          <button class="btn btn-quiet" type="button" @click="emit('close')">取消</button>
          <button class="btn btn-primary" type="button" @click="create">创建并打开 <Icon name="arrow-right" :size="15" /></button>
        </div>
      </div>
    </div>
  </div>
</template>
