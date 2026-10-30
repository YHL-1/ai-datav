import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { UNAUTHORIZED_EVENT } from './services/api'
import { useAuthStore } from './stores/auth'
import './styles/main.css'

const pinia = createPinia()
const app = createApp(App).use(pinia)

/**
 * 全局未登录拦截（接口层）：任何受保护接口返回 401 时，
 * 清空本地会话并跳转登录页，携带当前路径作为回跳地址。
 */
window.addEventListener(UNAUTHORIZED_EVENT, () => {
  const current = router.currentRoute.value
  if (current.name === 'login' || current.name === 'not-found') return

  useAuthStore(pinia).clearSession()
  void router.replace({ name: 'login', query: { redirect: current.fullPath } })
})

app.use(router).mount('#app')
