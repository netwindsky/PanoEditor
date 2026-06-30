import { createRouter, createWebHistory } from 'vue-router'
import { perf } from '@/utils/performanceMonitor'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/editor',
      name: 'editor',
      component: () => import('@/views/EditorView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/editor/:projectId',
      name: 'editor-project',
      component: () => import('@/views/EditorView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      redirect: '/editor',
    },
  ],
})

router.beforeEach((to) => {
  perf.mark(`route-${to.name?.toString() || to.path}-start`, {
    path: to.path,
    params: to.params,
  })
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    return { name: 'login' }
  }
  if (to.name === 'login' && token) {
    return { name: 'editor' }
  }
})

router.afterEach((to) => {
  perf.markEnd(`route-${to.name?.toString() || to.path}-start`, {
    path: to.path,
  })
})

export default router
