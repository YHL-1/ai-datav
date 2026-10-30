<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '@/components/ui/AppLogo.vue'
import Icon from '@/components/ui/Icon.vue'
import DashboardScreen from '@/components/screen/DashboardScreen.vue'
import { ApiError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

type Mode = 'login' | 'register'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const mode = ref<Mode>(route.query.mode === 'register' ? 'register' : 'login')
const submitting = ref(false)
const errorMessage = ref('')
const showLoginPassword = ref(false)
const showRegisterPassword = ref(false)

const codeSending = ref(false)
const codeCooldown = ref(0)
const codeHint = ref('')
let cooldownTimer: ReturnType<typeof setInterval> | undefined

const form = reactive({
  email: 'demo@nexa.studio',
  password: 'nexa2026',
  confirm: '',
  registerEmail: '',
  registerPassword: '',
  registerConfirm: '',
  registerCode: '',
  agreed: true,
})

const canSubmit = computed(() => !submitting.value)
const sendCodeLabel = computed(() => {
  if (codeSending.value) return '发送中…'
  if (codeCooldown.value > 0) return `${codeCooldown.value}s 后重发`
  return '获取验证码'
})

function setMode(next: Mode) {
  mode.value = next
  errorMessage.value = ''
}

function startCooldown() {
  codeCooldown.value = 60
  cooldownTimer && clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    codeCooldown.value -= 1
    if (codeCooldown.value <= 0) {
      clearInterval(cooldownTimer)
      cooldownTimer = undefined
    }
  }, 1000)
}

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

async function sendRegisterCode() {
  if (codeSending.value || codeCooldown.value > 0) return

  errorMessage.value = ''
  codeHint.value = ''

  const email = form.registerEmail.trim()
  if (!email) {
    errorMessage.value = '请先填写邮箱地址，再获取验证码。'
    return
  }

  codeSending.value = true
  try {
    const res = await auth.sendCode(email)
    codeHint.value = res.devCode
      ? `开发环境验证码：${res.devCode}（未配置 SMTP，已打印到后端控制台）`
      : '验证码已发送，请查收邮箱（含垃圾邮件箱）。'
    startCooldown()
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '验证码发送失败，请稍后重试。'
  } finally {
    codeSending.value = false
  }
}

async function submitLogin() {
  if (!canSubmit.value) return
  errorMessage.value = ''
  submitting.value = true
  try {
    await auth.login(form.email, form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'
    await router.replace(redirect)
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '登录失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
}

async function submitRegister() {
  if (!canSubmit.value) return
  if (!form.agreed) {
    errorMessage.value = '请先阅读并同意服务条款与隐私政策。'
    return
  }
  if (form.registerPassword !== form.registerConfirm) {
    errorMessage.value = '两次输入的密码不一致。'
    return
  }
  if (!form.registerCode.trim()) {
    errorMessage.value = '请填写邮箱验证码。'
    return
  }
  errorMessage.value = ''
  submitting.value = true
  try {
    await auth.register({
      email: form.registerEmail.trim(),
      password: form.registerPassword,
      code: form.registerCode.trim(),
    })
    await router.replace('/home')
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '注册失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
}

async function enterDemo() {
  await auth.login('demo@nexa.studio', 'nexa2026')
  await router.replace('/home')
}
</script>

<template>
  <div class="login-page" :data-mode="mode" :class="{ 'is-register': mode === 'register' }">
    <div class="atmosphere" />
    <div class="noise" />

    <main class="login-shell">
      <section class="login-visual">
        <header class="visual-top">
          <AppLogo />
          <div class="visual-badge"><span class="dot dot--live" />AI NATIVE · V1.0</div>
        </header>

        <div class="visual-copy">
          <div class="eyebrow">AI-DRIVEN SMART SCREEN</div>
          <h1>把想法，<br /><span>点亮成屏。</span></h1>
          <p>用一句话生成智慧大屏，也可以从空白画布开始，把每一处数据与光，放到它该在的位置。</p>
        </div>

        <div class="showcase">
          <div class="showcase-glow" />
          <div class="screen-3d">
            <div class="screen-frame">
              <div class="login-dash-scale">
                <DashboardScreen />
              </div>
            </div>
          </div>

          <div class="float-tag tag-ai">
            <Icon name="sparkles" :size="15" />
            <span><b>AI 已生成</b> 9 个组件</span>
          </div>
          <div class="float-tag tag-theme">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #5ef2c2; box-shadow: 0 0 12px #5ef2c2" />
            主题 · 深空青
          </div>
          <div class="float-tag tag-save">
            <Icon name="check" :size="15" />
            草稿已自动保存
          </div>

          <div class="schema-peek">
            <div class="schema-peek-head"><span>COMPONENT SCHEMA</span><span style="color: #5ef2c2">VALID</span></div>
            <pre><span class="k">"type"</span>: <span class="v">"chart.map"</span>,
<span class="k">"frame"</span>: { <span class="k">"w"</span>: 520,
  <span class="k">"h"</span>: 330 },
<span class="k">"binding"</span>: {
  <span class="k">"source"</span>: <span class="v">"ds_east"</span>,
  <span class="k">"field"</span>: <span class="v">"province"</span>
}</pre>
          </div>
        </div>

        <footer class="visual-foot">
          <div class="foot-item"><b>12+</b><span>可编辑组件</span></div>
          <span class="sep" />
          <div class="foot-item"><b>1920×1080</b><span>固定画板</span></div>
          <span class="sep" />
          <div class="foot-item"><b>AI → Schema</b><span>结构标准化</span></div>
          <span class="sep" />
          <div class="foot-item" style="margin-left: auto; color: #405264">© 2026 NEXA STUDIO</div>
        </footer>
      </section>

      <aside class="login-aside">
        <div class="aside-top">
          <span class="login-only">还没有账号？</span>
          <span class="register-only">已经有账号？</span>
          <a href="#" class="login-only" @click.prevent="setMode('register')">免费创建</a>
          <a href="#" class="register-only" @click.prevent="setMode('login')">直接登录</a>
        </div>

        <div class="auth-wrap">
          <div class="auth-card">
            <div class="auth-head login-only">
              <div class="eyebrow">WELCOME BACK</div>
              <h2>欢迎回来</h2>
              <p>登录后继续编辑你的智慧大屏。所有草稿、数据源与模板，只属于你。</p>
            </div>
            <div class="auth-head register-only">
              <div class="eyebrow">CREATE WORKSPACE</div>
              <h2>创建你的工作台</h2>
              <p>用邮箱即可开始。无需手机号，注册后自动进入你的第一块画布。</p>
            </div>

            <div class="auth-tabs">
              <button type="button" class="auth-tab" :class="{ 'is-active': mode === 'login' }" @click="setMode('login')">登录</button>
              <button type="button" class="auth-tab" :class="{ 'is-active': mode === 'register' }" @click="setMode('register')">注册</button>
            </div>

            <form v-if="mode === 'login'" class="auth-form login-only" @submit.prevent="submitLogin">
              <div class="field">
                <label class="field-label" for="loginEmail">邮箱地址</label>
                <div class="input-wrap">
                  <Icon name="mail" :size="16" />
                  <input id="loginEmail" v-model="form.email" class="input" type="email" placeholder="you@company.com" autocomplete="email" />
                </div>
              </div>
              <div class="field">
                <label class="field-label" for="loginPassword">
                  登录密码
                  <a class="text-link" href="#" style="font-weight: 400; font-size: 11px">忘记密码？</a>
                </label>
                <div class="input-wrap">
                  <Icon name="lock" :size="16" />
                  <input id="loginPassword" v-model="form.password" class="input" :type="showLoginPassword ? 'text' : 'password'" placeholder="输入至少 8 位密码" autocomplete="current-password" />
                  <button type="button" class="input-action" aria-label="显示密码" @click="showLoginPassword = !showLoginPassword">
                    <Icon :name="showLoginPassword ? 'eye' : 'eye-off'" :size="16" />
                  </button>
                </div>
              </div>
              <div v-if="errorMessage" class="form-error show" style="display: flex; align-items: center; gap: 6px; color: var(--coral); font-size: 11px; margin-top: -5px">
                <Icon name="warning" :size="14" /><span>{{ errorMessage }}</span>
              </div>
              <div class="auth-row">
                <label class="checkbox"><input type="checkbox" checked /> 保持登录</label>
                <span class="field-hint">加密传输 · 仅本人可见</span>
              </div>
              <button class="btn btn-primary btn-block auth-submit" type="submit" :disabled="submitting">
                {{ submitting ? '处理中…' : '进入工作台' }}
                <Icon name="arrow-right" :size="15" />
              </button>
            </form>

            <form v-else class="auth-form register-only" @submit.prevent="submitRegister">
              <div class="field">
                <label class="field-label" for="regEmail">邮箱地址</label>
                <div class="input-wrap">
                  <Icon name="mail" :size="16" />
                  <input id="regEmail" v-model="form.registerEmail" class="input" type="email" placeholder="name@company.com" autocomplete="email" />
                </div>
                <span class="field-hint">建议使用 QQ 邮箱，后续用于找回账号</span>
              </div>
              <div class="field">
                <label class="field-label" for="regCode">邮箱验证码</label>
                <div class="code-row">
                  <div class="input-wrap">
                    <Icon name="mail" :size="16" />
                    <input
                      id="regCode"
                      v-model="form.registerCode"
                      class="input"
                      type="text"
                      inputmode="numeric"
                      maxlength="6"
                      placeholder="6 位数字验证码"
                      autocomplete="one-time-code"
                    />
                  </div>
                  <button
                    type="button"
                    class="code-btn"
                    :disabled="codeSending || codeCooldown > 0"
                    @click="sendRegisterCode"
                  >
                    {{ sendCodeLabel }}
                  </button>
                </div>
                <span v-if="codeHint" class="field-hint">{{ codeHint }}</span>
              </div>
              <div class="field">
                <label class="field-label" for="regPassword">设置密码</label>
                <div class="input-wrap">
                  <Icon name="lock" :size="16" />
                  <input id="regPassword" v-model="form.registerPassword" class="input" :type="showRegisterPassword ? 'text' : 'password'" placeholder="至少 8 位，含字母与数字" autocomplete="new-password" />
                  <button type="button" class="input-action" aria-label="显示密码" @click="showRegisterPassword = !showRegisterPassword">
                    <Icon :name="showRegisterPassword ? 'eye' : 'eye-off'" :size="16" />
                  </button>
                </div>
                <div class="strength" aria-hidden="true"><i class="on" /><i class="on" /><i class="mid" /><i /></div>
                <span class="field-hint">密码强度：中等 · 再加一个符号会更安全</span>
              </div>
              <div class="field">
                <label class="field-label" for="regConfirm">确认密码</label>
                <div class="input-wrap">
                  <Icon name="lock" :size="16" />
                  <input id="regConfirm" v-model="form.registerConfirm" class="input" type="password" placeholder="再次输入密码" autocomplete="new-password" />
                </div>
              </div>
              <label class="checkbox" style="align-items: flex-start; line-height: 1.7; margin-top: -2px">
                <input v-model="form.agreed" type="checkbox" style="margin-top: 3px" />
                <span>我已阅读并同意 <a href="#" style="color: #a8bfcd">服务条款</a> 与 <a href="#" style="color: #a8bfcd">隐私政策</a></span>
              </label>
              <div
                v-if="errorMessage"
                class="form-error show"
                style="display: flex; align-items: center; gap: 6px; color: var(--coral); font-size: 11px; margin-top: -5px"
              >
                <Icon name="warning" :size="14" /><span>{{ errorMessage }}</span>
              </div>
              <button class="btn btn-primary btn-block auth-submit" type="submit" :disabled="submitting" style="margin-top: 4px">
                {{ submitting ? '处理中…' : '创建账号并开始' }}
                <Icon name="sparkles" :size="15" />
              </button>
            </form>

            <div class="auth-divider">快速体验</div>
            <div class="demo-box">
              <div class="demo-label">
                <Icon name="zap" :size="15" />
                <div>
                  <div style="color: #b9cbd8; font-size: 11px; font-weight: 600">使用演示工作区</div>
                  <div class="demo-mail">demo@nexa.studio</div>
                </div>
              </div>
              <a href="#" class="demo-link" @click.prevent="enterDemo">直接进入 <Icon name="arrow-right" :size="14" /></a>
            </div>

            <p class="auth-fineprint login-only">登录即代表你同意 NEXA 的服务条款与隐私政策。<br />你的数据与其他用户完全隔离，不参与任何共享。</p>
            <p class="auth-fineprint register-only">注册即代表你同意 NEXA 的服务条款与隐私政策。<br />账号创建后，可在工作台内管理全部私有草稿与数据源。</p>
          </div>
        </div>

        <footer class="aside-footer">
          <span>© 2026 NEXA · 轻量 AI 大屏工作台</span>
          <span class="secure"><Icon name="lock" :size="13" /> 数据隔离 · 安全连接</span>
        </footer>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  overflow: hidden;
}

.login-dash-scale {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  transform: scale(0.365);
  transform-origin: top left;
}

.auth-head.register-only {
  display: none;
}

.login-page[data-mode='register'] .auth-head.login-only {
  display: none;
}

.login-page[data-mode='register'] .auth-head.register-only {
  display: block;
}

.login-page.is-register .auth-tabs {
  display: none !important;
}

.strength {
  display: flex;
  gap: 5px;
  margin-top: 2px;
}

.strength i {
  height: 2px;
  flex: 1;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
}

.strength i.on {
  background: var(--mint);
}

.strength i.mid {
  background: var(--amber);
}

.code-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.code-row .input-wrap {
  flex: 1;
  min-width: 0;
}

.code-btn {
  flex: 0 0 auto;
  height: 44px;
  padding: 0 14px;
  border: 1px solid rgba(94, 242, 194, 0.24);
  border-radius: 9px;
  background: rgba(94, 242, 194, 0.07);
  color: var(--mint);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.18s var(--ease);
}

.code-btn:hover:not(:disabled) {
  background: rgba(94, 242, 194, 0.13);
}

.code-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.form-error {
  display: none;
}
</style>
