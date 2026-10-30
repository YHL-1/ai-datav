import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true, title: '工作台' },
    },
    {
      path: '/drafts',
      name: 'drafts',
      component: () => import('@/views/DraftsView.vue'),
      meta: { requiresAuth: true, title: '我的草稿' },
    },
    {
      path: '/templates',
      name: 'templates',
      component: () => import('@/views/TemplatesView.vue'),
      meta: { requiresAuth: true, title: '模板广场' },
    },
    {
      path: '/data-sources',
      name: 'data-sources',
      component: () => import('@/views/DataSourcesView.vue'),
      meta: { requiresAuth: true, title: '数据源' },
    },
    {
      path: '/editor/:id',
      name: 'editor',
      component: () => import('@/views/EditorView.vue'),
      meta: { requiresAuth: true, title: '编辑器' },
    },
    {
      path: '/preview/:id',
      name: 'preview',
      component: () => import('@/views/PreviewView.vue'),
      meta: { requiresAuth: true, title: '预览' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true

  const auth = useAuthStore()
  if (!auth.hydrated) await auth.fetchMe()
  if (auth.isAuthenticated) return true

  return { name: 'login', query: { redirect: to.fullPath } }
})

export default router
