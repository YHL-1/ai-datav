<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { getAiKey, setAiKey } from '@/lib/aiKey'
import { toast } from '@/lib/toast'
import type { AiChatMessage } from '@/services/ai'

const props = defineProps<{
  messages: AiChatMessage[]
  busy: boolean
  projectName: string
  componentCount: number
  datasetCount: number
}>()

const emit = defineEmits<{
  (e: 'send', text: string): void
  (e: 'action', name: string): void
}>()

const input = ref('')
const suggestions = ['换成琥珀金', '加区域排行', '做一个经营驾驶舱']
const aiReady = ref(getAiKey().length > 0)
const keyDraft = ref('')
const keyInput = ref<HTMLInputElement | null>(null)

function send() {
  if (!aiReady.value) {
    toast('请先配置硅基流动 API Key，才能让 AI 生成大屏', 2600)
    keyInput.value?.focus()
    return
  }
  const text = input.value.trim()
  if (!text || props.busy) return
  emit('send', text)
  input.value = ''
}

function applySuggestion(text: string) {
  input.value = text
}

function saveKey() {
  const value = keyDraft.value.trim()
  if (!value) {
    toast('请输入 API Key')
    keyInput.value?.focus()
    return
  }
  setAiKey(value)
  aiReady.value = true
  keyDraft.value = ''
  toast('AI Key 已保存，现在可以直接让 AI 生成大屏了')
}
</script>

<template>
  <div class="ai-panel" style="display: flex; flex-direction: column; min-height: 0; flex: 1">
    <div class="ai-context">
      <span class="ai-context-icon">
        <Icon name="sparkles" :size="14" />
      </span>
      <div class="ai-context-meta">
        <b>正在编辑：{{ projectName }}</b>
        <span v-if="aiReady"><span class="dot dot--live" /> {{ componentCount }} 个组件 · {{ datasetCount }} 个数据源 ·
          已同步上下文</span>
        <span v-else class="is-unready"><span class="dot" /> AI 未配置 · 请先填写 API Key</span>
      </div>
      <span class="model-chip">
        <Icon name="zap" :size="10" /> DeepSeek V3
      </span>
    </div>

    <div v-if="!aiReady" class="ai-key-guard">
      <span class="ai-key-guard-icon">
        <Icon name="sparkles" :size="18" />
      </span>
      <b>还差一步，就能让 AI 帮你画大屏</b>
      <p>填入硅基流动 API Key 后即可使用 AI 生成与改写大屏。Key 仅保存在当前浏览器，不会上传到服务器。</p>
      <label class="ai-key-input">
        <Icon name="lock" :size="13" />
        <input ref="keyInput" v-model="keyDraft" type="password" placeholder="sk-..." autocomplete="off"
          @keydown.enter.exact.prevent="saveKey" />
      </label>
      <button class="btn btn-primary ai-key-save" type="button" @click="saveKey">
        <Icon name="check" :size="12" /> 保存并启用 AI
      </button>
      <a class="ai-key-link" href="https://cloud.siliconflow.cn/account/ak" target="_blank" rel="noopener noreferrer">
        <Icon name="arrow-up-right" :size="10" /> 还没有 Key？前往硅基流动控制台获取
      </a>
    </div>

    <div v-else class="ai-thread">
      <div class="ai-msg">
        <div class="ai-msg-label"><span class="ai-avatar">
            <Icon name="sparkles" :size="9" />
          </span> NEXA AI</div>
        <div class="ai-bubble">告诉我你想<b>生成</b>或<b>修改</b>什么。我会输出标准组件 Schema，先校验，再落到画布。</div>
      </div>

      <template v-for="message in messages" :key="message.id">
        <div v-if="message.role === 'user'" class="ai-msg user">
          <div class="ai-msg-label"><span class="time">{{ message.time }}</span> 你</div>
          <div class="ai-user">{{ message.text }}</div>
        </div>

        <div v-else class="ai-msg">
          <div class="ai-msg-label"><span class="ai-avatar">
              <Icon name="sparkles" :size="9" />
            </span> NEXA AI <span class="time">{{ message.time }}</span></div>
          <div class="ai-bubble" :class="{ 'is-error': message.status === 'error' }">{{ message.text }}</div>

          <div v-if="message.applied" class="ai-result">
            <div class="ai-result-head">
              <Icon name="check" :size="12" /> {{ message.applied.mode === 'append' ? '已追加' : '已应用' }}到画布
              <span class="ok">SCHEMA VALID</span>
            </div>
            <div v-if="message.applied.warnings.length" class="ai-result-warn">
              <Icon name="clock" :size="10" /> {{ message.applied.warnings[0] }}
            </div>
            <div class="ai-result-foot">
              <span class="tag">{{ message.applied.theme }}</span>
              <span class="tag">1920×1080</span>
              <span style="margin-left: auto">{{ message.applied.count }} 组件</span>
            </div>
            <div class="ai-result-actions">
              <button class="btn btn-ghost" type="button" @click="emit('action', 'undo')">
                <Icon name="undo" :size="11" /> 撤销应用
              </button>
              <button class="btn btn-ghost" type="button" @click="emit('action', 'regen')">
                <Icon name="refresh" :size="11" /> 重新生成
              </button>
            </div>
          </div>
          <button v-if="message.applied" class="ai-schema-link" type="button" @click="emit('action', 'schema')">
            <Icon name="code" :size="10" /> 查看组件 Schema 摘要 <span>⌄</span>
          </button>
        </div>
      </template>

      <div v-if="busy" class="ai-msg">
        <div class="ai-msg-label"><span class="ai-avatar">
            <Icon name="sparkles" :size="9" />
          </span> NEXA AI</div>
        <div class="ai-bubble is-loading">
          <span class="ai-dots"><i /><i /><i /></span> 正在理解需求并生成组件 Schema…
        </div>
      </div>
    </div>

    <div class="ai-composer">
      <div class="ai-suggest">
        <button v-for="item in suggestions" :key="item" class="chip" type="button" @click="applySuggestion(item)">{{
          item }}</button>
      </div>
      <div class="ai-box">
        <textarea v-model="input" :placeholder="aiReady ? '继续描述修改，例如：把配色改成琥珀金，指标卡改为 2×2…' : '先在上方填写 API Key，即可开始生成…'"
          @keydown.enter.exact.prevent="send" />
        <div class="ai-box-foot">
          <button class="icon-btn" type="button" title="添加附件">
            <Icon name="paperclip" />
          </button>
          <span class="ai-context-chip">
            <Icon name="database" :size="10" /> {{ datasetCount }} 个数据源
          </span>
          <span class="ai-count">{{ input.length }} / 500</span>
          <button class="ai-send" type="button" :title="busy ? 'AI 生成中…' : '发送'" :disabled="busy" @click="send">
            <Icon :name="busy ? 'refresh' : 'send'" :size="13" />
          </button>
        </div>
      </div>
      <div class="ai-enter-hint">Enter 发送 · Shift + Enter 换行</div>
    </div>
  </div>
</template>

<style scoped>
.ai-context-meta .is-unready {
  color: #b08a6a;
}

.ai-context-meta .is-unready .dot {
  background: #d9a05b;
}

.ai-key-guard {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 9px;
  padding: 20px 16px;
}

.ai-key-guard-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(167, 139, 250, 0.24);
  background: rgba(167, 139, 250, 0.09);
  color: #c6b4fb;
}

.ai-key-guard b {
  color: #c3d2de;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
}

.ai-key-guard p {
  margin: 0;
  color: #62778a;
  font-size: 10px;
  line-height: 1.7;
}

.ai-key-input {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.18s var(--ease);
}

.ai-key-input:focus-within {
  border-color: rgba(167, 139, 250, 0.42);
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.06);
}

.ai-key-input .icon {
  flex: 0 0 auto;
  color: #6d8296;
}

.ai-key-input input {
  flex: 1;
  min-width: 0;
  height: 100%;
  color: #c2d3df;
  font-family: var(--font-mono);
  font-size: 11px;
  background: transparent;
}

.ai-key-input input::placeholder {
  color: #3f5263;
}

.ai-key-save {
  width: 100%;
  height: 32px;
  border-radius: 7px;
  font-size: 11px;
}

.ai-key-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #7f93a6;
  font-size: 9.5px;
}

.ai-key-link:hover {
  color: var(--mint);
}
</style>
