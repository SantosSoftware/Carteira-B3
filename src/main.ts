import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'

import App from './App.vue'
import router from './router'
import './assets/main.css'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(PrimeVue, { ripple: true })

// Inicializa sessão do Supabase antes de montar
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore()
authStore.init().then(() => {
  app.mount('#app')
})
