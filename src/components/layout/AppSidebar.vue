<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { label: 'Carteira',  icon: 'pi pi-chart-bar',  to: '/carteira' },
  { label: 'Ativos',    icon: 'pi pi-list',        to: '/ativos' },
  { label: 'Proventos', icon: 'pi pi-dollar',       to: '/proventos' },
  { label: 'Outros',   icon: 'pi pi-plus-circle',  to: '/outros-ativos' },
  { label: 'Análises', icon: 'pi pi-chart-line',   to: '/analises' },
  { label: 'Extrato',   icon: 'pi pi-file',        to: '/extrato' },
  { label: 'Importar',  icon: 'pi pi-upload',      to: '/importacoes' },
  { label: 'Config.',   icon: 'pi pi-cog',         to: '/configuracoes' },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-icon">B3</div>
    </div>

    <!-- Navegação -->
    <nav class="sidebar-nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ 'nav-item--active': isActive(item.to) }"
      >
        <i :class="item.icon" class="nav-icon" />
        <span class="nav-label">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 72px;
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0;
  z-index: 100;
  gap: 0.25rem;
}

.sidebar-logo {
  margin-bottom: 1.5rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background-color: var(--color-primary);
  color: #fff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  text-decoration: none;
  color: var(--color-text-muted);
  transition: background 0.15s, color 0.15s;
  gap: 3px;
}

.nav-item:hover {
  background-color: var(--color-bg);
  color: var(--color-primary);
}

.nav-item--active {
  background-color: #ede9f8;
  color: var(--color-primary);
}

.nav-icon {
  font-size: 18px;
}

.nav-label {
  font-size: 9.5px;
  font-weight: 500;
  line-height: 1;
  text-align: center;
}
</style>
