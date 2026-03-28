<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCarteiraStore } from '@/stores/carteira'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import ModalImportacao from '@/components/importacao/ModalImportacao.vue'

const authStore = useAuthStore()
const carteiraStore = useCarteiraStore()

const modalImportacaoAberto = ref(false)

onMounted(async () => {
  if (authStore.user) {
    await carteiraStore.carregarCarteira(authStore.user.id)
  }
})
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
