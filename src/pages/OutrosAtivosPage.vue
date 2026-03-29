<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAtivosManualStore, CATEGORIAS, getCategoriaInfo, type AtivoManual, type Categoria, type LancamentoManual } from '@/stores/ativosManual'
import { useCarteiraStore } from '@/stores/carteira'
import { buscarCotacaoUSD } from '@/services/brapi'
import { formatarMoeda, formatarData } from '@/utils/formatters'

const store         = useAtivosManualStore()
const carteiraStore = useCarteiraStore()

onMounted(async () => {
  if (carteiraStore.carteira?.id) await store.carregar(carteiraStore.carteira.id)
})

// ── Filtro de categoria ────────────────────────────────────────────────────
const filtroCategoria = ref<Categoria | 'Todos'>('Todos')
const ativosFiltrados = computed(() =>
  filtroCategoria.value === 'Todos'
    ? store.ativos
    : store.ativos.filter((a) => a.categoria === filtroCategoria.value),
)

// ── Modal de Ativo (criar / editar) ───────────────────────────────────────
const modalAtivo = ref(false)
const ativoEditando = ref<AtivoManual | null>(null)
const formAtivo = ref({ nome: '', categoria: 'PrevidenciaPrivada' as Categoria, simbolo: '', moeda: 'BRL' as 'BRL' | 'USD', observacao: '' })
const salvandoAtivo = ref(false)
const erroAtivo = ref('')

function abrirModalNovoAtivo() {
  ativoEditando.value = null
  formAtivo.value     = { nome: '', categoria: 'PrevidenciaPrivada', simbolo: '', moeda: 'BRL', observacao: '' }
  erroAtivo.value     = ''
  modalAtivo.value    = true
}

function abrirModalEditarAtivo(ativo: AtivoManual) {
  ativoEditando.value  = ativo
  formAtivo.value      = { nome: ativo.nome, categoria: ativo.categoria, simbolo: ativo.simbolo ?? '', moeda: ativo.moeda, observacao: ativo.observacao ?? '' }
  erroAtivo.value      = ''
  modalAtivo.value     = true
}

async function salvarAtivo() {
  if (!formAtivo.value.nome.trim()) { erroAtivo.value = 'Informe um nome.'; return }
  if (!carteiraStore.carteira?.id) { erroAtivo.value = 'Carteira não carregada. Aguarde e tente novamente.'; return }
  salvandoAtivo.value = true
  erroAtivo.value     = ''
  try {
    const dados = { nome: formAtivo.value.nome.trim(), categoria: formAtivo.value.categoria, simbolo: formAtivo.value.simbolo || null, moeda: formAtivo.value.moeda, observacao: formAtivo.value.observacao || null, ativo: true }
    if (ativoEditando.value) {
      await store.editarAtivo(ativoEditando.value.id, carteiraStore.carteira.id, dados)
    } else {
      await store.criarAtivo(carteiraStore.carteira.id, dados)
    }
    modalAtivo.value = false
  } catch (e: unknown) {
    erroAtivo.value = (e as { message?: string })?.message ?? 'Erro ao salvar.'
  } finally {
    salvandoAtivo.value = false
  }
}

// ── Confirmação de exclusão de ativo ──────────────────────────────────────
const confirmandoExclusaoAtivo = ref<string | null>(null)
const excluindoAtivo = ref(false)
async function excluirAtivo(id: string) {
  if (!carteiraStore.carteira?.id) return
  excluindoAtivo.value = true
  await store.excluirAtivo(id, carteiraStore.carteira.id)
  confirmandoExclusaoAtivo.value = null
  excluindoAtivo.value = false
}

// ── Drawer de lançamentos ─────────────────────────────────────────────────
const ativoSelecionado = ref<AtivoManual | null>(null)
const drawerAberto     = ref(false)

function abrirDrawer(ativo: AtivoManual) {
  ativoSelecionado.value = ativo
  drawerAberto.value     = true
  formLanc.value         = { valor: '', data_lancamento: new Date().toISOString().substring(0, 10), cotacao_usd: '', observacao: '' }
  erroLanc.value         = ''
}

const lancamentosAtivo = computed(() =>
  ativoSelecionado.value
    ? (store.lancamentos[ativoSelecionado.value.id] ?? [])
    : [],
)

// ── Modal de novo lançamento ──────────────────────────────────────────────
const formLanc      = ref({ valor: '', data_lancamento: new Date().toISOString().substring(0, 10), cotacao_usd: '', observacao: '' })
const salvandoLanc  = ref(false)
const erroLanc      = ref('')
const buscandoCotacao = ref(false)

// Calcula o equivalente em BRL para exibição em tempo real
const equivalenteBRL = computed(() => {
  if (ativoSelecionado.value?.moeda !== 'USD') return null
  const v = parseFloat(formLanc.value.valor.replace(',', '.'))
  const c = parseFloat(formLanc.value.cotacao_usd.replace(',', '.'))
  if (isNaN(v) || isNaN(c) || v <= 0 || c <= 0) return null
  return v * c
})

// Busca cotação automaticamente ao abrir drawer de ativo USD
async function buscarCotacaoAtual() {
  if (ativoSelecionado.value?.moeda !== 'USD') return
  buscandoCotacao.value = true
  try {
    const cotacao = await buscarCotacaoUSD()
    formLanc.value.cotacao_usd = cotacao.toFixed(4)
  } catch {
    // Deixa o campo em branco para o usuário preencher manualmente
  } finally {
    buscandoCotacao.value = false
  }
}

watch(ativoSelecionado, (novoAtivo) => {
  if (novoAtivo?.moeda === 'USD') buscarCotacaoAtual()
})

async function salvarLancamento() {
  if (!formLanc.value.valor || isNaN(Number(formLanc.value.valor.replace(',', '.')))) {
    erroLanc.value = 'Informe um valor válido.'
    return
  }
  if (ativoSelecionado.value?.moeda === 'USD' && !formLanc.value.cotacao_usd) {
    erroLanc.value = 'Informe a cotação do dólar para converter o valor em BRL.'
    return
  }
  if (!ativoSelecionado.value || !carteiraStore.carteira?.id) return
  salvandoLanc.value = true
  erroLanc.value     = ''
  try {
    await store.adicionarLancamento(ativoSelecionado.value.id, carteiraStore.carteira.id, {
      valor:           parseFloat(formLanc.value.valor.replace(',', '.')),
      data_lancamento: formLanc.value.data_lancamento,
      cotacao_usd:     formLanc.value.cotacao_usd ? parseFloat(formLanc.value.cotacao_usd.replace(',', '.')) : null,
      observacao:      formLanc.value.observacao || null,
    })
    ativoSelecionado.value = store.ativos.find((a) => a.id === ativoSelecionado.value!.id) ?? ativoSelecionado.value
    formLanc.value = { valor: '', data_lancamento: new Date().toISOString().substring(0, 10), cotacao_usd: formLanc.value.cotacao_usd, observacao: '' }
  } catch (e: unknown) {
    erroLanc.value = (e as { message?: string })?.message ?? 'Erro ao salvar lançamento.'
  } finally {
    salvandoLanc.value = false
  }
}

const confirmandoExclusaoLanc = ref<string | null>(null)
async function excluirLancamento(lanc: LancamentoManual) {
  if (!carteiraStore.carteira?.id) return
  await store.excluirLancamento(lanc.id, carteiraStore.carteira.id)
  ativoSelecionado.value = store.ativos.find((a) => a.id === ativoSelecionado.value?.id) ?? ativoSelecionado.value
  confirmandoExclusaoLanc.value = null
}
</script>

<template>
  <div class="page">
    <!-- Cabeçalho -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Outros Ativos</h1>
        <p class="page-sub">Previdência, caixa, dólar, crypto e outros investimentos</p>
      </div>
      <button class="btn-primary" @click="abrirModalNovoAtivo">
        <i class="pi pi-plus" /> Novo Ativo
      </button>
    </div>

    <!-- Cards de resumo por categoria -->
    <div v-if="store.ativos.length" class="resumo-grid">
      <div
        v-for="cat in CATEGORIAS"
        :key="cat.value"
        class="resumo-card"
        :class="{ 'resumo-card--ativo': filtroCategoria === cat.value }"
        @click="filtroCategoria = filtroCategoria === cat.value ? 'Todos' : cat.value"
      >
        <div class="resumo-icone" :style="{ background: cat.cor + '22', color: cat.cor }">
          <i :class="cat.icone" />
        </div>
        <div class="resumo-info">
          <span class="resumo-label">{{ cat.label }}</span>
          <span class="resumo-valor">{{ formatarMoeda(store.totalPorCategoria[cat.value] ?? 0) }}</span>
        </div>
      </div>
    </div>

    <!-- Filtros rápidos -->
    <div v-if="store.ativos.length" class="filtros">
      <button class="tipo-btn" :class="{ 'tipo-btn--ativo': filtroCategoria === 'Todos' }" @click="filtroCategoria = 'Todos'">Todos</button>
      <button
        v-for="cat in CATEGORIAS"
        :key="cat.value"
        class="tipo-btn"
        :class="{ 'tipo-btn--ativo': filtroCategoria === cat.value }"
        @click="filtroCategoria = filtroCategoria === cat.value ? 'Todos' : cat.value"
      >
        {{ cat.label }}
      </button>
    </div>

    <!-- Estado vazio -->
    <div v-if="store.carregando" class="empty-state">
      <i class="pi pi-spin pi-spinner" style="font-size:28px;color:var(--color-primary)" />
    </div>

    <div v-else-if="!store.ativos.length" class="empty-state">
      <div class="empty-icon-wrap"><i class="pi pi-plus-circle" style="font-size:28px;color:var(--color-primary)" /></div>
      <h2 class="empty-title">Nenhum ativo cadastrado</h2>
      <p class="empty-desc">Adicione previdência, caixa, dólar ou crypto para consolidar seu patrimônio.</p>
      <button class="btn-primary" @click="abrirModalNovoAtivo"><i class="pi pi-plus" /> Novo Ativo</button>
    </div>

    <!-- Grid de ativos -->
    <div v-else class="ativos-grid">
      <div
        v-for="ativo in ativosFiltrados"
        :key="ativo.id"
        class="ativo-card"
      >
        <div class="ativo-card-top">
          <div class="ativo-icone" :style="{ background: getCategoriaInfo(ativo.categoria).cor + '22', color: getCategoriaInfo(ativo.categoria).cor }">
            <i :class="getCategoriaInfo(ativo.categoria).icone" />
          </div>
          <div class="ativo-acoes">
            <button class="btn-icon" title="Editar" @click="abrirModalEditarAtivo(ativo)"><i class="pi pi-pencil" /></button>
            <template v-if="confirmandoExclusaoAtivo === ativo.id">
              <button class="btn-sim" :disabled="excluindoAtivo" @click="excluirAtivo(ativo.id)">
                <i v-if="excluindoAtivo" class="pi pi-spin pi-spinner" /><span v-else>Excluir</span>
              </button>
              <button class="btn-nao" @click="confirmandoExclusaoAtivo = null">Cancelar</button>
            </template>
            <button v-else class="btn-icon btn-icon--danger" title="Excluir" @click="confirmandoExclusaoAtivo = ativo.id"><i class="pi pi-trash" /></button>
          </div>
        </div>

        <div class="ativo-nome">{{ ativo.nome }}</div>
        <div v-if="ativo.simbolo" class="ativo-simbolo">{{ ativo.simbolo }}</div>

        <div class="ativo-valor">{{ formatarMoeda(ativo.valor_atual ?? 0) }}</div>

        <div class="ativo-meta">
          <span class="ativo-cat-badge" :style="{ background: getCategoriaInfo(ativo.categoria).cor + '22', color: getCategoriaInfo(ativo.categoria).cor }">
            {{ getCategoriaInfo(ativo.categoria).label }}
          </span>
          <span v-if="ativo.data_ultimo_lancamento" class="ativo-data">
            Atualizado em {{ formatarData(ativo.data_ultimo_lancamento) }}
          </span>
          <span v-else class="ativo-data muted">Sem lançamentos</span>
        </div>

        <button class="btn-lancamento" @click="abrirDrawer(ativo)">
          <i class="pi pi-history" /> Ver histórico / Novo lançamento
        </button>
      </div>
    </div>
  </div>

  <!-- ── Modal: criar / editar ativo ─────────────────────────────────── -->
  <div v-if="modalAtivo" class="modal-overlay" @click.self="modalAtivo = false">
    <div class="modal-box modal-box--sm">
      <div class="modal-header">
        <h2 class="modal-title">{{ ativoEditando ? 'Editar Ativo' : 'Novo Ativo' }}</h2>
        <button class="btn-fechar" @click="modalAtivo = false"><i class="pi pi-times" /></button>
      </div>
      <div class="modal-body">
        <div v-if="erroAtivo" class="alert alert-error"><i class="pi pi-exclamation-circle" />{{ erroAtivo }}</div>

        <div class="field">
          <label class="field-label">Nome *</label>
          <input v-model="formAtivo.nome" class="field-input" placeholder="Ex: PGBL XP, Conta Itaú, Bitcoin..." />
        </div>

        <div class="field">
          <label class="field-label">Categoria *</label>
          <div class="cat-grid">
            <button
              v-for="cat in CATEGORIAS"
              :key="cat.value"
              type="button"
              class="cat-btn"
              :class="{ 'cat-btn--ativo': formAtivo.categoria === cat.value }"
              :style="formAtivo.categoria === cat.value ? { background: cat.cor + '22', borderColor: cat.cor, color: cat.cor } : {}"
              @click="formAtivo.categoria = cat.value"
            >
              <i :class="cat.icone" />
              {{ cat.label }}
            </button>
          </div>
        </div>

        <div class="fields-row">
          <div class="field">
            <label class="field-label">Símbolo (opcional)</label>
            <input v-model="formAtivo.simbolo" class="field-input" placeholder="BTC, ETH, USD..." />
          </div>
          <div class="field">
            <label class="field-label">Moeda</label>
            <select v-model="formAtivo.moeda" class="field-input">
              <option value="BRL">BRL — Real</option>
              <option value="USD">USD — Dólar</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label class="field-label">Observação (opcional)</label>
          <input v-model="formAtivo.observacao" class="field-input" placeholder="Instituição, detalhes..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancelar" @click="modalAtivo = false">Cancelar</button>
        <button class="btn-primary" :disabled="salvandoAtivo" @click="salvarAtivo">
          <i v-if="salvandoAtivo" class="pi pi-spin pi-spinner" />
          <span v-else>{{ ativoEditando ? 'Salvar alterações' : 'Criar ativo' }}</span>
        </button>
      </div>
    </div>
  </div>

  <!-- ── Drawer: histórico + novo lançamento ─────────────────────────── -->
  <div v-if="drawerAberto" class="drawer-overlay" @click.self="drawerAberto = false">
    <div class="drawer">
      <div class="drawer-header">
        <div>
          <h2 class="drawer-title">{{ ativoSelecionado?.nome }}</h2>
          <span
            class="ativo-cat-badge"
            :style="ativoSelecionado ? { background: getCategoriaInfo(ativoSelecionado.categoria).cor + '22', color: getCategoriaInfo(ativoSelecionado.categoria).cor } : {}"
          >
            {{ ativoSelecionado ? getCategoriaInfo(ativoSelecionado.categoria).label : '' }}
          </span>
        </div>
        <button class="btn-fechar" @click="drawerAberto = false"><i class="pi pi-times" /></button>
      </div>

      <div class="drawer-body">
        <!-- Valor atual -->
        <div class="valor-atual-box">
          <span class="valor-atual-label">Valor Atual</span>
          <span class="valor-atual">{{ formatarMoeda(ativoSelecionado?.valor_atual ?? 0) }}</span>
          <span v-if="ativoSelecionado?.data_ultimo_lancamento" class="valor-atual-data">
            Posição de {{ formatarData(ativoSelecionado.data_ultimo_lancamento) }}
          </span>
        </div>

        <!-- Formulário novo lançamento -->
        <div class="lanc-form-card">
          <h3 class="lanc-form-title"><i class="pi pi-plus-circle" /> Novo Lançamento</h3>

          <div v-if="erroLanc" class="alert alert-error"><i class="pi pi-exclamation-circle" />{{ erroLanc }}</div>

          <!-- Ativo em BRL -->
          <template v-if="ativoSelecionado?.moeda !== 'USD'">
            <div class="fields-row">
              <div class="field">
                <label class="field-label">Valor (R$) *</label>
                <input v-model="formLanc.valor" class="field-input" placeholder="0,00" inputmode="decimal" />
              </div>
              <div class="field">
                <label class="field-label">Data *</label>
                <input v-model="formLanc.data_lancamento" type="date" class="field-input" />
              </div>
            </div>
          </template>

          <!-- Ativo em USD -->
          <template v-else>
            <div class="fields-row">
              <div class="field">
                <label class="field-label">Valor em dólares (US$) *</label>
                <div class="input-prefix-wrap">
                  <span class="input-prefix">US$</span>
                  <input v-model="formLanc.valor" class="field-input field-input--prefixed" placeholder="0.00" inputmode="decimal" />
                </div>
              </div>
              <div class="field">
                <label class="field-label">Data *</label>
                <input v-model="formLanc.data_lancamento" type="date" class="field-input" />
              </div>
            </div>

            <div class="field">
              <div class="cotacao-header">
                <label class="field-label">Cotação USD/BRL *</label>
                <button class="btn-atualizar-cotacao" :disabled="buscandoCotacao" @click="buscarCotacaoAtual">
                  <i :class="buscandoCotacao ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" />
                  {{ buscandoCotacao ? 'Buscando...' : 'Atualizar cotação' }}
                </button>
              </div>
              <div class="input-prefix-wrap">
                <span class="input-prefix">R$</span>
                <input v-model="formLanc.cotacao_usd" class="field-input field-input--prefixed" placeholder="Ex: 5.8500" inputmode="decimal" />
              </div>
            </div>

            <!-- Preview do equivalente em BRL -->
            <div v-if="equivalenteBRL !== null" class="equivalente-brl">
              <i class="pi pi-arrow-right-arrow-left" />
              Equivale a <strong>{{ formatarMoeda(equivalenteBRL) }}</strong>
            </div>
          </template>

          <div class="field">
            <label class="field-label">Observação (opcional)</label>
            <input v-model="formLanc.observacao" class="field-input" placeholder="Aporte, resgate, atualização de saldo..." />
          </div>

          <button class="btn-primary btn-full" :disabled="salvandoLanc" @click="salvarLancamento">
            <i v-if="salvandoLanc" class="pi pi-spin pi-spinner" /><i v-else class="pi pi-check" />
            {{ salvandoLanc ? 'Salvando...' : 'Registrar Lançamento' }}
          </button>
        </div>

        <!-- Histórico -->
        <div class="historico">
          <h3 class="historico-titulo">Histórico de Lançamentos</h3>

          <div v-if="!lancamentosAtivo.length" class="historico-vazio">
            Nenhum lançamento registrado ainda.
          </div>

          <div v-else class="historico-lista">
            <div
              v-for="lanc in lancamentosAtivo"
              :key="lanc.id"
              class="lanc-item"
            >
              <div class="lanc-data">
                <i class="pi pi-calendar" />
                {{ formatarData(lanc.data_lancamento) }}
              </div>
              <div class="lanc-info">
                <!-- Se ativo USD: mostra US$ + equivalente BRL -->
                <template v-if="ativoSelecionado?.moeda === 'USD' && lanc.cotacao_usd">
                  <span class="lanc-valor">{{ formatarMoeda(lanc.valor_brl ?? lanc.valor) }}</span>
                  <span class="lanc-cotacao">US$ {{ lanc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }} · cotação R$ {{ Number(lanc.cotacao_usd).toLocaleString('pt-BR', { minimumFractionDigits: 4 }) }}</span>
                </template>
                <template v-else>
                  <span class="lanc-valor">{{ formatarMoeda(lanc.valor) }}</span>
                </template>
                <span v-if="lanc.observacao" class="lanc-obs">{{ lanc.observacao }}</span>
              </div>
              <div class="lanc-acoes">
                <template v-if="confirmandoExclusaoLanc === lanc.id">
                  <button class="btn-sim" @click="excluirLancamento(lanc)">Excluir</button>
                  <button class="btn-nao" @click="confirmandoExclusaoLanc = null">Não</button>
                </template>
                <button v-else class="btn-icon btn-icon--danger" @click="confirmandoExclusaoLanc = lanc.id">
                  <i class="pi pi-trash" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.25rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.page-title { font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0 0 0.2rem; }
.page-sub   { font-size: 13px; color: var(--color-text-muted); margin: 0; }

.btn-primary {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: var(--color-primary); color: #fff; border: none;
  border-radius: 9px; padding: 0.5rem 1.1rem; font-size: 14px;
  font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }
.btn-full { width: 100%; justify-content: center; margin-top: 0.5rem; }

/* Resumo */
.resumo-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem;
}
@media (max-width: 1100px) { .resumo-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 640px)  { .resumo-grid { grid-template-columns: repeat(2, 1fr); } }

.resumo-card {
  background: var(--color-surface); border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 1rem;
  display: flex; align-items: center; gap: 0.75rem;
  cursor: pointer; border: 1.5px solid transparent; transition: all 0.15s;
}
.resumo-card:hover { border-color: var(--color-border); }
.resumo-card--ativo { border-color: var(--color-primary); background: #f3eeff; }

.resumo-icone {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.resumo-label { font-size: 11px; color: var(--color-text-muted); display: block; }
.resumo-valor { font-size: 14px; font-weight: 700; color: var(--color-text); display: block; }

/* Filtros */
.filtros { display: flex; gap: 4px; flex-wrap: wrap; }
.tipo-btn {
  padding: 0.3rem 0.85rem; border: 1px solid var(--color-border); border-radius: 7px;
  background: none; font-size: 12px; font-family: inherit; color: var(--color-text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.tipo-btn--ativo, .tipo-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: #f3eeff; }

/* Grid de ativos */
.ativos-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;
}
@media (max-width: 1200px) { .ativos-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px)  { .ativos-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 580px)  { .ativos-grid { grid-template-columns: 1fr; } }

.ativo-card {
  background: var(--color-surface); border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 1.25rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.ativo-card-top { display: flex; align-items: flex-start; justify-content: space-between; }
.ativo-icone {
  width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.ativo-acoes { display: flex; align-items: center; gap: 4px; }
.ativo-nome  { font-size: 15px; font-weight: 700; color: var(--color-text); line-height: 1.3; }
.ativo-simbolo { font-size: 12px; color: var(--color-text-muted); font-weight: 500; }
.ativo-valor { font-size: 22px; font-weight: 700; color: var(--color-text); margin: 0.25rem 0; }
.ativo-meta  { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.ativo-cat-badge {
  display: inline-block; padding: 2px 8px; border-radius: 99px;
  font-size: 11px; font-weight: 600;
}
.ativo-data  { font-size: 11px; color: var(--color-text-muted); }

.btn-lancamento {
  width: 100%; margin-top: 0.5rem; padding: 0.5rem;
  border: 1px solid var(--color-border); border-radius: 9px;
  background: var(--color-bg); font-size: 12px; font-family: inherit;
  color: var(--color-text-muted); cursor: pointer; display: flex;
  align-items: center; justify-content: center; gap: 0.4rem; transition: all 0.15s;
}
.btn-lancamento:hover { border-color: var(--color-primary); color: var(--color-primary); }

/* Botões utilitários */
.btn-icon {
  background: none; border: 1px solid var(--color-border); border-radius: 7px;
  cursor: pointer; color: var(--color-text-muted); padding: 0.28rem 0.5rem;
  font-size: 13px; transition: all 0.15s;
}
.btn-icon:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn-icon--danger:hover { border-color: var(--color-danger); color: var(--color-danger); }
.btn-sim { padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 12px; font-family: inherit; cursor: pointer; border: none; background: var(--color-danger); color: #fff; }
.btn-nao { padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 12px; font-family: inherit; cursor: pointer; background: var(--color-bg); color: var(--color-text-muted); border: 1px solid var(--color-border); }

/* Empty state */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 300px; gap: 0.75rem; text-align: center;
  background: var(--color-surface); border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.empty-icon-wrap { width: 64px; height: 64px; border-radius: 18px; background: #ede9f8; display: flex; align-items: center; justify-content: center; }
.empty-title { font-size: 17px; font-weight: 600; color: var(--color-text); margin: 0; }
.empty-desc  { font-size: 13px; color: var(--color-text-muted); margin: 0; max-width: 320px; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 500; padding: 1rem; }
.modal-box { background: var(--color-surface); border-radius: 18px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 12px 48px rgba(0,0,0,0.18); overflow: hidden; }
.modal-box--sm { max-width: 520px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.5rem; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
.modal-title  { font-size: 16px; font-weight: 600; color: var(--color-text); margin: 0; }
.modal-body   { padding: 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--color-border); flex-shrink: 0; }
.btn-fechar { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 16px; padding: 0.3rem; border-radius: 6px; transition: color 0.15s; }
.btn-fechar:hover { color: var(--color-danger); }
.btn-cancelar { padding: 0.5rem 1.25rem; background: none; border: 1px solid var(--color-border); border-radius: 9px; font-size: 14px; font-family: inherit; cursor: pointer; color: var(--color-text-muted); }

/* Campos */
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
.field-input { height: 40px; padding: 0 0.85rem; border: 1px solid var(--color-border); border-radius: 9px; font-size: 14px; font-family: inherit; color: var(--color-text); background: var(--color-surface); outline: none; transition: border-color 0.15s; }
.field-input:focus { border-color: var(--color-primary); }
.fields-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

/* Categorias */
.cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.cat-btn {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 0.85rem; border: 1.5px solid var(--color-border);
  border-radius: 9px; background: var(--color-bg); font-size: 13px;
  font-family: inherit; color: var(--color-text); cursor: pointer; transition: all 0.15s;
}
.cat-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.cat-btn--ativo { font-weight: 600; }

/* Alert */
.alert { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1rem; border-radius: 9px; font-size: 13px; }
.alert-error { background: #fdf2f2; color: var(--color-danger); border: 1px solid #fcd5d5; }

/* Drawer */
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 500; display: flex; justify-content: flex-end; }
.drawer { width: 100%; max-width: 480px; background: var(--color-surface); height: 100%; display: flex; flex-direction: column; box-shadow: -4px 0 32px rgba(0,0,0,0.12); overflow: hidden; }
.drawer-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-border); flex-shrink: 0; gap: 1rem; }
.drawer-title  { font-size: 16px; font-weight: 700; color: var(--color-text); margin: 0 0 0.4rem; }
.drawer-body   { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

.valor-atual-box { background: linear-gradient(135deg, #4a2a9a, #6c3fc5); border-radius: 14px; padding: 1.25rem 1.5rem; color: #fff; }
.valor-atual-label { font-size: 11px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em; display: block; }
.valor-atual       { font-size: 28px; font-weight: 700; display: block; margin: 0.25rem 0; }
.valor-atual-data  { font-size: 12px; opacity: 0.7; display: block; }

.lanc-form-card { background: var(--color-bg); border-radius: 12px; padding: 1.1rem; display: flex; flex-direction: column; gap: 0.75rem; border: 1px solid var(--color-border); }
.lanc-form-title { font-size: 13px; font-weight: 600; color: var(--color-text); margin: 0; display: flex; align-items: center; gap: 0.4rem; }

.input-prefix-wrap { position: relative; display: flex; align-items: center; }
.input-prefix { position: absolute; left: 0.75rem; font-size: 13px; font-weight: 600; color: var(--color-text-muted); pointer-events: none; z-index: 1; }
.field-input--prefixed { padding-left: 2.5rem; }

.cotacao-header { display: flex; align-items: center; justify-content: space-between; }
.btn-atualizar-cotacao {
  display: inline-flex; align-items: center; gap: 0.3rem; font-size: 11px;
  color: var(--color-primary); background: none; border: none; cursor: pointer;
  font-family: inherit; padding: 0; opacity: 0.85;
}
.btn-atualizar-cotacao:hover:not(:disabled) { opacity: 1; text-decoration: underline; }
.btn-atualizar-cotacao:disabled { opacity: 0.45; cursor: not-allowed; }

.equivalente-brl {
  display: flex; align-items: center; gap: 0.45rem;
  padding: 0.55rem 0.85rem; border-radius: 8px;
  background: #ecfdf5; color: #065f46; font-size: 13px;
  border: 1px solid #a7f3d0;
}

.historico-titulo { font-size: 13px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 0.75rem; }
.historico-vazio  { font-size: 13px; color: var(--color-text-muted); text-align: center; padding: 1.5rem 0; }
.historico-lista  { display: flex; flex-direction: column; gap: 0.5rem; }

.lanc-item {
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 0.75rem; border: 1px solid var(--color-border);
  border-radius: 10px; background: var(--color-surface);
}
.lanc-data  { font-size: 12px; color: var(--color-text-muted); display: flex; align-items: center; gap: 4px; white-space: nowrap; flex-shrink: 0; }
.lanc-info  { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lanc-valor { font-size: 14px; font-weight: 700; color: var(--color-text); }
.lanc-cotacao { font-size: 11px; color: var(--color-text-muted); }
.lanc-obs   { font-size: 12px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lanc-acoes { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.muted { color: var(--color-text-muted); }
</style>
