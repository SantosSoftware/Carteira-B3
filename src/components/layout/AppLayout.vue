<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCarteiraStore } from '@/stores/carteira'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import ModalImportacao from '@/components/importacao/ModalImportacao.vue'

const authStore = useAuthStore()
const carteiraStore = useCarteiraStore()

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
  <div class="app-shell">
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
