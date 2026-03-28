<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCarteiraStore } from '@/stores/carteira'
import { useRouter } from 'vue-router'

const emit = defineEmits<{
  importar: []
}>()

const authStore = useAuthStore()
const carteiraStore = useCarteiraStore()
const router = useRouter()

const menuAberto = ref(false)

async function sair() {
  await authStore.logout()
  router.push('/auth')
}
</script>

<template>
  <header class="topbar">
    <!-- Nome da carteira -->
    <div class="topbar-title">
      <span class="carteira-nome">{{ carteiraStore.carteira?.nome ?? 'Minha Carteira' }}</span>
    </div>

    <!-- Ações -->
    <div class="topbar-actions">
      <button class="btn-importar" @click="emit('importar')">
        <i class="pi pi-upload" />
        <span>Importar Planilha</span>
      </button>

      <!-- Avatar / Menu usuário -->
      <div class="user-menu">
        <button class="avatar-btn" @click="menuAberto = !menuAberto">
          <i class="pi pi-user" />
        </button>

        <div v-if="menuAberto" class="dropdown-menu">
          <div class="dropdown-email">{{ authStore.user?.email }}</div>
          <hr class="dropdown-divider" />
          <button class="dropdown-item" @click="sair">
            <i class="pi pi-sign-out" />
            Sair
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: fixed;
  top: 0;
  left: 72px;
  right: 0;
  height: 60px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  z-index: 90;
}

.carteira-nome {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-importar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background-color: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}

.btn-importar:hover {
  background-color: var(--color-primary-hover);
}

.user-menu {
  position: relative;
}

.avatar-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 15px;
  transition: border-color 0.15s;
}

.avatar-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 200px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 0.5rem 0;
  z-index: 200;
}

.dropdown-email {
  padding: 0.5rem 1rem;
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-divider {
  margin: 0.25rem 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background-color: var(--color-bg);
  color: var(--color-danger);
}
</style>
