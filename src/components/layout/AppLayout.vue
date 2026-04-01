<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCarteiraStore } from '@/stores/carteira'
import { useIsMobile } from '@/composables/useIsMobile'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import ModalImportacao from '@/components/importacao/ModalImportacao.vue'
import MobileDashboard from '@/pages/MobileDashboard.vue'

const authStore = useAuthStore()
const carteiraStore = useCarteiraStore()
const route = useRoute()
const { isMobile } = useIsMobile()

const modalImportacaoAberto = ref(false)

// Reage ao usuário assim que ele estiver disponível (inclusive se já estiver no momento do mount)
watch(
  () => authStore.user,
  async (user) => {
    if (user && !carteiraStore.carteira && !carteiraStore.carregando) {
      await carteiraStore.carregarCarteira(user.id)
    }
  },
  { immediate: true },
)
</script>

<template>
  <!-- Mobile: tela cheia para rotas fora do shell do dashboard (ex.: derivativos) -->
  <div v-if="isMobile && route.name === 'derivativos'" class="mobile-route-shell">
    <header class="mobile-route-head">
      <RouterLink to="/carteira" class="mobile-route-back" aria-label="Voltar">
        <i class="pi pi-arrow-left" />
      </RouterLink>
      <span class="mobile-route-title">Negociação em opções</span>
    </header>
    <main class="mobile-route-body">
      <RouterView />
    </main>
  </div>

  <!-- Mobile: dashboard nativo sem sidebar/topbar -->
  <MobileDashboard v-else-if="isMobile" />

  <!-- Desktop: layout padrão com sidebar e topbar -->
  <div v-else class="app-shell">
    <AppSidebar />
    <AppTopbar @importar="modalImportacaoAberto = true" />

    <main class="app-content">
      <RouterView />
    </main>

    <ModalImportacao
      v-if="modalImportacaoAberto"
      @fechar="modalImportacaoAberto = false"
    />
  </div>
</template>

<style scoped>
.mobile-route-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}
.mobile-route-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.mobile-route-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: var(--color-text);
  text-decoration: none;
  border: 1px solid var(--color-border);
}
.mobile-route-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}
.mobile-route-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.app-shell {
  min-height: 100vh;
  background-color: var(--color-bg);
}

.app-content {
  margin-left: 72px;
  margin-top: 60px;
  padding: 1.5rem;
  min-height: calc(100vh - 60px);
}
</style>
