<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

type Modo = 'login' | 'cadastro'

const modo = ref<Modo>('login')
const email = ref('')
const senha = ref('')
const senhaConfirm = ref('')
const carregando = ref(false)
const erro = ref('')
const sucesso = ref('')
const mostrarSenha = ref(false)

const titulo = computed(() => (modo.value === 'login' ? 'Entrar na conta' : 'Criar conta'))
const textoBotao = computed(() => (modo.value === 'login' ? 'Entrar' : 'Criar conta'))

function alternarModo() {
  modo.value = modo.value === 'login' ? 'cadastro' : 'login'
  erro.value = ''
  sucesso.value = ''
  senha.value = ''
  senhaConfirm.value = ''
}

async function submeter() {
  erro.value = ''
  sucesso.value = ''

  if (!email.value || !senha.value) {
    erro.value = 'Preencha e-mail e senha.'
    return
  }

  if (modo.value === 'cadastro') {
    if (senha.value.length < 6) {
      erro.value = 'A senha deve ter ao menos 6 caracteres.'
      return
    }
    if (senha.value !== senhaConfirm.value) {
      erro.value = 'As senhas não coincidem.'
      return
    }
  }

  carregando.value = true

  try {
    if (modo.value === 'login') {
      await authStore.login(email.value, senha.value)
      router.push('/carteira')
    } else {
      await authStore.cadastrar(email.value, senha.value)
      sucesso.value = 'Conta criada! Verifique seu e-mail para confirmar o cadastro.'
      modo.value = 'login'
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Ocorreu um erro. Tente novamente.'
    if (msg.includes('Invalid login credentials')) {
      erro.value = 'E-mail ou senha incorretos.'
    } else if (msg.includes('User already registered')) {
      erro.value = 'Este e-mail já está cadastrado.'
    } else if (msg.includes('Email not confirmed')) {
      erro.value = 'Confirme seu e-mail antes de entrar.'
    } else {
      erro.value = msg
    }
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <!-- Painel esquerdo decorativo -->
    <div class="auth-panel-left" aria-hidden="true">
      <div class="panel-content">
        <div class="brand-logo">B3</div>
        <h1 class="panel-title">Sua carteira de investimentos em um só lugar</h1>
        <p class="panel-desc">
          Importe sua posição da B3, acompanhe sua rentabilidade e visualize sua alocação com gráficos interativos.
        </p>

        <ul class="feature-list">
          <li>
            <i class="pi pi-check-circle feature-icon" />
            <span>Importação automática via planilha B3</span>
          </li>
          <li>
            <i class="pi pi-check-circle feature-icon" />
            <span>Cotações em tempo real via brapi.dev</span>
          </li>
          <li>
            <i class="pi pi-check-circle feature-icon" />
            <span>Histórico de patrimônio e rentabilidade</span>
          </li>
          <li>
            <i class="pi pi-check-circle feature-icon" />
            <span>Análise por tipo de ativo (Ações, FIIs, BDRs)</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Formulário -->
    <div class="auth-panel-right">
      <div class="auth-form-wrapper">
        <div class="auth-brand-mobile">
          <div class="brand-logo-sm">B3</div>
          <span>CarteiraB3</span>
        </div>

        <h2 class="form-title">{{ titulo }}</h2>
        <p class="form-subtitle">
          {{
            modo === 'login'
              ? 'Bem-vindo de volta! Entre com sua conta.'
              : 'Crie sua conta gratuita agora.'
          }}
        </p>

        <!-- Alerta de erro -->
        <div v-if="erro" class="alert alert-error">
          <i class="pi pi-exclamation-circle" />
          {{ erro }}
        </div>

        <!-- Alerta de sucesso -->
        <div v-if="sucesso" class="alert alert-success">
          <i class="pi pi-check-circle" />
          {{ sucesso }}
        </div>

        <form @submit.prevent="submeter" novalidate>
          <!-- E-mail -->
          <div class="field">
            <label class="field-label">E-mail</label>
            <div class="field-input-wrapper">
              <i class="pi pi-envelope field-icon" />
              <input
                v-model="email"
                type="email"
                class="field-input"
                placeholder="seu@email.com"
                autocomplete="email"
                :disabled="carregando"
              />
            </div>
          </div>

          <!-- Senha -->
          <div class="field">
            <label class="field-label">Senha</label>
            <div class="field-input-wrapper">
              <i class="pi pi-lock field-icon" />
              <input
                v-model="senha"
                :type="mostrarSenha ? 'text' : 'password'"
                class="field-input field-input--has-toggle"
                placeholder="••••••••"
                :autocomplete="modo === 'login' ? 'current-password' : 'new-password'"
                :disabled="carregando"
              />
              <button
                type="button"
                class="toggle-senha"
                @click="mostrarSenha = !mostrarSenha"
              >
                <i :class="mostrarSenha ? 'pi pi-eye-slash' : 'pi pi-eye'" />
              </button>
            </div>
          </div>

          <!-- Confirmar Senha (só no cadastro) -->
          <div v-if="modo === 'cadastro'" class="field">
            <label class="field-label">Confirmar Senha</label>
            <div class="field-input-wrapper">
              <i class="pi pi-lock field-icon" />
              <input
                v-model="senhaConfirm"
                :type="mostrarSenha ? 'text' : 'password'"
                class="field-input"
                placeholder="••••••••"
                autocomplete="new-password"
                :disabled="carregando"
              />
            </div>
          </div>

          <!-- Botão principal -->
          <button type="submit" class="btn-submit" :disabled="carregando">
            <i v-if="carregando" class="pi pi-spin pi-spinner" />
            <span>{{ carregando ? 'Aguarde...' : textoBotao }}</span>
          </button>
        </form>

        <!-- Alternância entre modos -->
        <p class="toggle-modo">
          {{
            modo === 'login' ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'
          }}
          <button class="toggle-modo-btn" @click="alternarModo">
            {{ modo === 'login' ? 'Criar conta' : 'Entrar' }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  min-height: 100vh;
  background-color: var(--color-bg);
}

/* Painel esquerdo */
.auth-panel-left {
  flex: 1;
  background: linear-gradient(135deg, #4a2a9a 0%, #6c3fc5 60%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  display: none;
}

@media (min-width: 900px) {
  .auth-panel-left {
    display: flex;
  }
}

.panel-content {
  max-width: 420px;
  color: #fff;
}

.brand-logo {
  width: 52px;
  height: 52px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  margin-bottom: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.panel-title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 1rem;
}

.panel-desc {
  font-size: 15px;
  opacity: 0.85;
  line-height: 1.6;
  margin: 0 0 2rem;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feature-list li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 14px;
  opacity: 0.9;
}

.feature-icon {
  color: #a3e6d4;
  font-size: 16px;
  flex-shrink: 0;
}

/* Painel direito */
.auth-panel-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
}

@media (min-width: 900px) {
  .auth-panel-right {
    max-width: 480px;
  }
}

.auth-form-wrapper {
  width: 100%;
  max-width: 400px;
}

.auth-brand-mobile {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 2rem;
  font-weight: 700;
  font-size: 16px;
  color: var(--color-text);
}

@media (min-width: 900px) {
  .auth-brand-mobile {
    display: none;
  }
}

.brand-logo-sm {
  width: 36px;
  height: 36px;
  background-color: var(--color-primary);
  color: #fff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 13px;
}

.form-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.35rem;
}

.form-subtitle {
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0 0 1.75rem;
}

/* Alertas */
.alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 1.25rem;
}

.alert-error {
  background-color: #fdf2f2;
  color: var(--color-danger);
  border: 1px solid #fcd5d5;
}

.alert-success {
  background-color: #f0fdf9;
  color: #059669;
  border: 1px solid #a7f3d0;
}

/* Campos */
.field {
  margin-bottom: 1rem;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 0.4rem;
}

.field-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 0.85rem;
  color: var(--color-text-muted);
  font-size: 14px;
  pointer-events: none;
}

.field-input {
  width: 100%;
  height: 44px;
  padding: 0 0.9rem 0 2.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text);
  background-color: var(--color-surface);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input--has-toggle {
  padding-right: 2.75rem;
}

.field-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(108, 63, 197, 0.12);
}

.field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-senha {
  position: absolute;
  right: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 15px;
  padding: 0.2rem;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.toggle-senha:hover {
  color: var(--color-primary);
}

/* Botão submit */
.btn-submit {
  width: 100%;
  height: 46px;
  background-color: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  transition: background 0.15s, transform 0.1s;
}

.btn-submit:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.btn-submit:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Toggle de modo */
.toggle-modo {
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 1.25rem;
}

.toggle-modo-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  padding: 0 0.2rem;
  font-family: inherit;
  transition: opacity 0.15s;
}

.toggle-modo-btn:hover {
  opacity: 0.8;
}
</style>
