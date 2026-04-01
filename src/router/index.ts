import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/carteira',
        },
        {
          path: 'carteira',
          name: 'carteira',
          component: () => import('@/pages/CarteiraSummary.vue'),
        },
        {
          path: 'ativos',
          name: 'ativos',
          component: () => import('@/pages/AtivosPage.vue'),
        },
        {
          path: 'analises',
          name: 'analises',
          component: () => import('@/pages/AnalisesPage.vue'),
        },
        {
          path: 'derivativos',
          name: 'derivativos',
          component: () => import('@/pages/DerivativosNegociacaoPage.vue'),
        },
        {
          path: 'extrato',
          name: 'extrato',
          component: () => import('@/pages/ExtratoPage.vue'),
        },
        {
          path: 'importacoes',
          name: 'importacoes',
          component: () => import('@/pages/ImportacoesPage.vue'),
        },
        {
          path: 'proventos',
          name: 'proventos',
          component: () => import('@/pages/ProventosPage.vue'),
        },
        {
          path: 'outros-ativos',
          name: 'outros-ativos',
          component: () => import('@/pages/OutrosAtivosPage.vue'),
        },
        {
          path: 'configuracoes',
          name: 'configuracoes',
          component: () => import('@/pages/ConfiguracoesPage.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/carteira',
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (authStore.loading) {
    await authStore.init()
  }

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'auth' }
  }

  if (to.meta.public && authStore.isLoggedIn) {
    return { name: 'carteira' }
  }
})

export default router
