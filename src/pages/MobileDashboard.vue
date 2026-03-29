<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { useCarteiraStore }  from '@/stores/carteira'
import { useAuthStore }      from '@/stores/auth'
import { useCotacaoStore }   from '@/stores/cotacao'
import { useProventosStore } from '@/stores/proventos'
import { isDerivativo }      from '@/utils/calculos'
import { formatarMoeda, sinalPercentual, formatarData } from '@/utils/formatters'

ChartJS.register(ArcElement, Tooltip)

const carteiraStore  = useCarteiraStore()
const authStore      = useAuthStore()
const cotacaoStore   = useCotacaoStore()
const proventosStore = useProventosStore()

// Safety net: garante o carregamento da carteira mesmo que AppLayout
// ainda não tenha terminado (timing em mobile / primeiro acesso)
watch(
  () => authStore.user,
  async (user) => {
    if (user && !carteiraStore.carteira && !carteiraStore.carregando) {
      await carteiraStore.carregarCarteira(user.id)
    }
  },
  { immediate: true },
)

// Carrega proventos quando a carteira estiver pronta
watch(
  () => carteiraStore.carteira?.id,
  async (id) => { if (id && !proventosStore.proventos.length) await proventosStore.carregar(id) },
  { immediate: true },
)

// Indicador de inicialização — mostra spinner enquanto a carteira não estiver
// carregada OU o carregamento estiver em andamento
const inicializando = computed(
  () => carteiraStore.carregando || (!carteiraStore.carteira && !authStore.user),
)

// ── Abas da bottom nav ─────────────────────────────────────────────────────
type Aba = 'resumo' | 'ativos' | 'proventos'
const abaAtiva = ref<Aba>('resumo')

// ── Atualizar cotações ─────────────────────────────────────────────────────
const atualizando = ref(false)
async function atualizarCotacoes() {
  const tickers = carteiraStore.ativos
    .filter((a) => /^[A-Z]{3,6}\d{1,2}$/.test(a.ticker))
    .map((a) => a.ticker)
  if (!tickers.length) return
  atualizando.value = true
  await cotacaoStore.buscar(tickers)
  atualizando.value = false
}

// ── Métricas ───────────────────────────────────────────────────────────────
const patrimonioTotal = computed(() => carteiraStore.patrimonioTotal)
const rentabilidade   = computed(() => carteiraStore.rentabilidadeGlobal)
const resultado       = computed(() => carteiraStore.patrimonioTotal - carteiraStore.valorInvestido)

// Variação média ponderada do dia (via cotação cache)
const variacaoDia = computed(() => {
  const ativos = carteiraStore.ativos.filter((a) => !isDerivativo(a.tipo_ativo))
  const total  = ativos.reduce((s, a) => s + a.valor_atual, 0)
  if (!total) return 0
  let soma = 0
  for (const a of ativos) {
    const v = cotacaoStore.getVariacaoDia(a.ticker)
    if (v !== null) soma += v * (a.valor_atual / total)
  }
  return soma
})

// ── Donut chart ────────────────────────────────────────────────────────────
const COR_TIPO: Record<string, string> = {
  Acao: '#6C3FC5', FII: '#F4A623', BDR: '#3B82F6',
  ETF: '#10B981', RendaFixa: '#F59E0B', Outro: '#94A3B8',
}
const COR_FALLBACK = '#94A3B8'

const donutData = computed(() => ({
  labels: carteiraStore.alocacaoPorTipo.map((a) =>
    a.tipo === 'Acao' ? 'Ações' : a.tipo === 'RendaFixa' ? 'Renda Fixa' : a.tipo,
  ),
  datasets: [{
    data: carteiraStore.alocacaoPorTipo.map((a) => parseFloat(a.percentual.toFixed(1))),
    backgroundColor: carteiraStore.alocacaoPorTipo.map((a) => COR_TIPO[a.tipo] ?? COR_FALLBACK),
    borderWidth: 2,
    borderColor: '#fff',
  }],
}))

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { label: string; raw: unknown }) =>
          ` ${ctx.label}: ${(ctx.raw as number).toFixed(1)}%`,
      },
    },
  },
}

// ── Lista de ativos ────────────────────────────────────────────────────────
const busca = ref('')
const ativosFiltrados = computed(() => {
  const lista = carteiraStore.ativos.filter((a) => !isDerivativo(a.tipo_ativo))
  if (!busca.value.trim()) return lista
  const q = busca.value.toUpperCase()
  return lista.filter((a) => a.ticker.includes(q) || a.nome_ativo.toUpperCase().includes(q))
})

// Labels de tipo
const TIPO_LABELS: Record<string, string> = {
  Acao: 'Ação', FII: 'FII', ETF: 'ETF', BDR: 'BDR',
  RendaFixa: 'R. Fixa', Outro: 'Outro',
}
const TIPO_COR_BG: Record<string, string> = {
  Acao: '#ede9f8', FII: '#fff4e0', BDR: '#e0f0ff',
  ETF: '#e6faf5', RendaFixa: '#fef3c7', Outro: '#f3f4f6',
}
const TIPO_COR_TEXT: Record<string, string> = {
  Acao: '#6c3fc5', FII: '#c47a00', BDR: '#2563eb',
  ETF: '#059669', RendaFixa: '#92400e', Outro: '#6b7280',
}

// ── Proventos mobile ───────────────────────────────────────────────────────
const totalProventosAno = computed(() => proventosStore.totalAno)
const proventosRecentes = computed(() =>
  proventosStore.proventosAno.slice(0, 20),
)

const PROVENTO_LABELS: Record<string, string> = {
  Dividendo: 'Dividendo', JCP: 'JCP', Rendimento: 'Rendimento',
}
</script>

<template>
  <div class="mobile-shell">

    <!-- ── Header fixo ───────────────────────────────────────────────────── -->
    <header class="mobile-header">
      <div class="header-left">
        <span class="header-logo">B3</span>
        <span class="header-carteira">{{ carteiraStore.carteira?.nome ?? 'Minha Carteira' }}</span>
      </div>
      <button class="btn-refresh" :class="{ 'btn-refresh--spin': atualizando }" @click="atualizarCotacoes">
        <i class="pi pi-refresh" />
      </button>
    </header>

    <!-- ── Conteúdo scrollável ───────────────────────────────────────────── -->
    <div class="mobile-content">

      <!-- ══ ABA: RESUMO ══════════════════════════════════════════════════ -->
      <div v-show="abaAtiva === 'resumo'" class="aba-content">

        <!-- Loading / inicializando -->
        <div v-if="inicializando || carteiraStore.carregando" class="loading-center">
          <div class="loading-card">
            <i class="pi pi-spin pi-spinner" style="font-size:28px;color:#6C3FC5" />
            <p class="loading-txt">Carregando carteira...</p>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="!carteiraStore.ativos.length" class="empty-mobile">
          <div class="empty-icon"><i class="pi pi-upload" /></div>
          <p class="empty-txt">Nenhuma posição importada ainda.</p>
          <p class="empty-hint">Use o desktop para importar sua planilha B3.</p>
        </div>

        <template v-else>
          <!-- Card Patrimônio Total -->
          <div class="card card--hero">
            <p class="card-label">Patrimônio Total</p>
            <p class="card-big-value">{{ formatarMoeda(patrimonioTotal) }}</p>
            <div class="variacao-row">
              <span class="variacao-badge" :class="variacaoDia >= 0 ? 'pos' : 'neg'">
                <i :class="variacaoDia >= 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'" />
                {{ variacaoDia !== 0 ? `${variacaoDia.toFixed(2)}% hoje` : 'Variação do dia' }}
              </span>
              <span class="resultado-badge" :class="resultado >= 0 ? 'pos' : 'neg'">
                {{ resultado >= 0 ? '+' : '' }}{{ formatarMoeda(resultado) }}
              </span>
            </div>
          </div>

          <!-- Card Rentabilidade -->
          <div class="card card--rent">
            <div class="rent-row">
              <div class="rent-bloco">
                <p class="rent-label">Rentabilidade</p>
                <p class="rent-val" :class="rentabilidade >= 0 ? 'pos' : 'neg'">
                  {{ sinalPercentual(rentabilidade) }}
                </p>
              </div>
              <div class="rent-divider" />
              <div class="rent-bloco">
                <p class="rent-label">Resultado</p>
                <p class="rent-val" :class="resultado >= 0 ? 'pos' : 'neg'">
                  {{ resultado >= 0 ? '+' : '' }}{{ formatarMoeda(resultado) }}
                </p>
              </div>
              <div class="rent-divider" />
              <div class="rent-bloco">
                <p class="rent-label">Investido</p>
                <p class="rent-val rent-val--neutral">{{ formatarMoeda(carteiraStore.valorInvestido) }}</p>
              </div>
            </div>
          </div>

          <!-- Card Donut -->
          <div class="card card--donut" v-if="carteiraStore.alocacaoPorTipo.length">
            <p class="card-label" style="margin-bottom:0.75rem">Alocação por Tipo</p>
            <div class="donut-wrap">
              <div class="donut-chart">
                <Doughnut :data="donutData" :options="donutOptions" />
              </div>
              <div class="donut-legenda">
                <div
                  v-for="item in carteiraStore.alocacaoPorTipo"
                  :key="item.tipo"
                  class="legenda-item"
                >
                  <span class="legenda-dot" :style="{ background: COR_TIPO[item.tipo] ?? COR_FALLBACK }" />
                  <span class="legenda-tipo">{{ item.tipo === 'Acao' ? 'Ações' : item.tipo === 'RendaFixa' ? 'R.Fixa' : item.tipo }}</span>
                  <span class="legenda-pct">{{ item.percentual.toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Top 5 Ativos -->
          <div class="card card--top">
            <p class="card-label" style="margin-bottom:0.75rem">Maiores Posições</p>
            <div
              v-for="ativo in [...carteiraStore.ativos].filter(a => !isDerivativo(a.tipo_ativo)).sort((a,b) => b.valor_atual - a.valor_atual).slice(0, 5)"
              :key="ativo.ticker"
              class="top-ativo-row"
            >
              <div class="top-ativo-info">
                <span class="top-ticker">{{ ativo.ticker }}</span>
                <span
                  class="top-badge"
                  :style="{ background: TIPO_COR_BG[ativo.tipo_ativo] ?? '#f3f4f6', color: TIPO_COR_TEXT[ativo.tipo_ativo] ?? '#6b7280' }"
                >{{ TIPO_LABELS[ativo.tipo_ativo] ?? ativo.tipo_ativo }}</span>
              </div>
              <div class="top-ativo-vals">
                <span class="top-valor">{{ formatarMoeda(ativo.valor_atual) }}</span>
                <span
                  class="top-rent"
                  :class="ativo.rentabilidade_percentual >= 0 ? 'pos' : 'neg'"
                >
                  {{ sinalPercentual(ativo.rentabilidade_percentual) }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ══ ABA: ATIVOS ══════════════════════════════════════════════════ -->
      <div v-show="abaAtiva === 'ativos'" class="aba-content">
        <div class="busca-wrap">
          <i class="pi pi-search busca-icon" />
          <input v-model="busca" class="busca-input" placeholder="Buscar ticker ou nome..." />
        </div>

        <div v-if="!carteiraStore.ativos.length" class="empty-mobile">
          <div class="empty-icon"><i class="pi pi-list" /></div>
          <p class="empty-txt">Nenhum ativo encontrado.</p>
        </div>

        <div v-else class="ativos-lista">
          <div
            v-for="ativo in ativosFiltrados"
            :key="ativo.ticker"
            class="ativo-card"
          >
            <div class="ativo-left">
              <div class="ativo-ticker-wrap">
                <span class="ativo-ticker">{{ ativo.ticker }}</span>
                <span
                  class="ativo-badge"
                  :style="{ background: TIPO_COR_BG[ativo.tipo_ativo] ?? '#f3f4f6', color: TIPO_COR_TEXT[ativo.tipo_ativo] ?? '#6b7280' }"
                >{{ TIPO_LABELS[ativo.tipo_ativo] ?? ativo.tipo_ativo }}</span>
              </div>
              <span class="ativo-nome">{{ ativo.nome_ativo }}</span>
            </div>
            <div class="ativo-right">
              <span class="ativo-valor">{{ formatarMoeda(ativo.valor_atual) }}</span>
              <span
                class="ativo-rent"
                :class="ativo.rentabilidade_percentual >= 0 ? 'pos' : 'neg'"
              >
                {{ sinalPercentual(ativo.rentabilidade_percentual) }}
              </span>
            </div>
          </div>
          <div v-if="!ativosFiltrados.length" class="sem-resultado">Nenhum ativo para "{{ busca }}"</div>
        </div>
      </div>

      <!-- ══ ABA: PROVENTOS ═══════════════════════════════════════════════ -->
      <div v-show="abaAtiva === 'proventos'" class="aba-content">

        <!-- Resumo proventos -->
        <div class="card card--prov-resumo">
          <p class="card-label">Total {{ proventosStore.anoFiltro }}</p>
          <p class="prov-total">{{ formatarMoeda(totalProventosAno) }}</p>
          <div class="prov-breakdown">
            <div class="prov-item">
              <span class="prov-dot" style="background:#6c3fc5" />
              <span class="prov-tipo">Ações</span>
              <span class="prov-val">{{ formatarMoeda(proventosStore.totalAcoes) }}</span>
            </div>
            <div class="prov-item">
              <span class="prov-dot" style="background:#f59e0b" />
              <span class="prov-tipo">FIIs</span>
              <span class="prov-val">{{ formatarMoeda(proventosStore.totalFIIs) }}</span>
            </div>
            <div class="prov-item">
              <span class="prov-dot" style="background:#10b981" />
              <span class="prov-tipo">ETFs</span>
              <span class="prov-val">{{ formatarMoeda(proventosStore.totalETFs) }}</span>
            </div>
          </div>
        </div>

        <!-- Seletor de ano -->
        <div class="ano-pills">
          <button
            v-for="ano in proventosStore.anosDisponiveis"
            :key="ano"
            class="ano-pill"
            :class="{ 'ano-pill--ativo': proventosStore.anoFiltro === ano }"
            @click="proventosStore.anoFiltro = ano"
          >{{ ano }}</button>
        </div>

        <div v-if="!proventosRecentes.length" class="empty-mobile">
          <div class="empty-icon"><i class="pi pi-money-bill" /></div>
          <p class="empty-txt">Nenhum provento para {{ proventosStore.anoFiltro }}.</p>
        </div>

        <div v-else class="proventos-lista">
          <div
            v-for="p in proventosRecentes"
            :key="p.id"
            class="provento-card"
          >
            <div class="provento-left">
              <span class="provento-ticker">{{ p.ticker }}</span>
              <span class="provento-data">{{ formatarData(p.data_pagamento) }}</span>
            </div>
            <div class="provento-right">
              <span class="provento-valor">{{ formatarMoeda(p.valor_total) }}</span>
              <span class="provento-tipo-badge">{{ PROVENTO_LABELS[p.tipo_provento] ?? p.tipo_provento }}</span>
            </div>
          </div>
        </div>
      </div>

    </div><!-- /mobile-content -->

    <!-- ── Bottom Navigation ─────────────────────────────────────────────── -->
    <nav class="bottom-nav">
      <button
        v-for="tab in ([
          { id: 'resumo',    label: 'Resumo',   icon: 'pi pi-home' },
          { id: 'ativos',    label: 'Ativos',   icon: 'pi pi-list' },
          { id: 'proventos', label: 'Proventos',icon: 'pi pi-dollar' },
        ] as const)"
        :key="tab.id"
        class="nav-btn"
        :class="{ 'nav-btn--ativo': abaAtiva === tab.id }"
        @click="abaAtiva = tab.id"
      >
        <i :class="tab.icon" class="nav-icon" />
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>

  </div>
</template>

<style scoped>
/* ── Shell ──────────────────────────────────────────────────────────────── */
.mobile-shell {
  display: flex; flex-direction: column;
  height: 100dvh; /* dynamic viewport height — correto em mobile */
  background: #F5F6FA;
  font-family: 'Inter', sans-serif;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.mobile-header {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.875rem 1rem;
  background: #fff;
  box-shadow: 0 1px 0 #eee;
  flex-shrink: 0;
}
.header-left    { display: flex; align-items: center; gap: 0.6rem; }
.header-logo    { background: #6C3FC5; color: #fff; font-size: 12px; font-weight: 800; padding: 3px 7px; border-radius: 6px; letter-spacing: 0.05em; }
.header-carteira{ font-size: 15px; font-weight: 600; color: #1A1A2E; }
.btn-refresh    { background: none; border: 1.5px solid #e5e7eb; border-radius: 9px; padding: 0.4rem 0.55rem; font-size: 16px; color: #6C3FC5; cursor: pointer; transition: all 0.15s; }
.btn-refresh:hover { background: #f3eeff; }
.btn-refresh--spin i { animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Content área scrollável ────────────────────────────────────────────── */
.mobile-content {
  flex: 1; overflow-y: auto; padding: 1rem 1rem 0.5rem;
  display: flex; flex-direction: column;
}
.aba-content { display: flex; flex-direction: column; gap: 0.875rem; padding-bottom: 0.5rem; }

/* ── Cards base ─────────────────────────────────────────────────────────── */
.card {
  background: #fff; border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  padding: 1.1rem 1.15rem;
}
.card-label { font-size: 11px; font-weight: 500; color: #8492A6; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }

/* Hero — Patrimônio */
.card--hero { background: linear-gradient(135deg, #4a2a9a, #6c3fc5); color: #fff; text-align: center; }
.card--hero .card-label { color: rgba(255,255,255,0.75); margin-bottom: 0.35rem; }
.card-big-value { font-size: 32px; font-weight: 800; color: #fff; margin: 0.2rem 0 0.6rem; letter-spacing: -0.5px; }
.variacao-row { display: flex; justify-content: center; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.variacao-badge, .resultado-badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 12px; font-weight: 600;
}
.variacao-badge.pos, .resultado-badge.pos { background: rgba(0,201,167,0.2); color: #00e5c0; }
.variacao-badge.neg, .resultado-badge.neg { background: rgba(231,76,60,0.2); color: #ff7b6e; }

/* Rentabilidade */
.card--rent .rent-row { display: flex; align-items: center; }
.rent-bloco { flex: 1; text-align: center; }
.rent-label { font-size: 10px; font-weight: 500; color: #8492A6; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 0.2rem; }
.rent-val   { font-size: 15px; font-weight: 700; margin: 0; }
.rent-val--neutral { color: #1A1A2E; }
.rent-divider { width: 1px; height: 32px; background: #f0f0f5; }
.pos { color: #00C9A7; }
.neg { color: #E74C3C; }

/* Donut */
.card--donut .donut-wrap { display: flex; align-items: center; gap: 1rem; }
.donut-chart { width: 110px; height: 110px; flex-shrink: 0; }
.donut-legenda { flex: 1; display: flex; flex-direction: column; gap: 0.35rem; }
.legenda-item { display: flex; align-items: center; gap: 0.4rem; }
.legenda-dot  { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.legenda-tipo { font-size: 12px; color: #1A1A2E; flex: 1; }
.legenda-pct  { font-size: 12px; font-weight: 700; color: #1A1A2E; }

/* Top 5 */
.card--top {}
.top-ativo-row { display: flex; align-items: center; justify-content: space-between; padding: 0.55rem 0; border-bottom: 1px solid #f5f6fa; }
.top-ativo-row:last-child { border-bottom: none; }
.top-ativo-info { display: flex; align-items: center; gap: 0.5rem; }
.top-ticker { font-size: 13px; font-weight: 700; color: #1A1A2E; }
.top-badge  { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 99px; }
.top-ativo-vals { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
.top-valor { font-size: 13px; font-weight: 600; color: #1A1A2E; }
.top-rent  { font-size: 11px; font-weight: 600; }

/* ── Busca ──────────────────────────────────────────────────────────────── */
.busca-wrap  { position: relative; }
.busca-icon  { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 14px; color: #8492A6; pointer-events: none; }
.busca-input {
  width: 100%; height: 42px; padding: 0 0.85rem 0 2.25rem;
  border: 1px solid #e5e7eb; border-radius: 12px;
  font-size: 14px; font-family: inherit; color: #1A1A2E;
  background: #fff; outline: none; box-sizing: border-box;
}
.busca-input:focus { border-color: #6C3FC5; }

/* ── Ativos lista ───────────────────────────────────────────────────────── */
.ativos-lista { display: flex; flex-direction: column; gap: 0.5rem; }
.ativo-card {
  background: #fff; border-radius: 14px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
  padding: 0.875rem 1rem;
  display: flex; align-items: center; justify-content: space-between;
}
.ativo-left  { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.ativo-ticker-wrap { display: flex; align-items: center; gap: 0.4rem; }
.ativo-ticker { font-size: 14px; font-weight: 700; color: #1A1A2E; }
.ativo-badge  { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 99px; }
.ativo-nome   { font-size: 11px; color: #8492A6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.ativo-right  { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.ativo-valor  { font-size: 14px; font-weight: 700; color: #1A1A2E; }
.ativo-rent   { font-size: 12px; font-weight: 600; }
.sem-resultado{ font-size: 13px; color: #8492A6; text-align: center; padding: 1.5rem 0; }

/* ── Proventos ──────────────────────────────────────────────────────────── */
.card--prov-resumo { text-align: center; background: linear-gradient(135deg, #1e3a5f, #2563eb); }
.card--prov-resumo .card-label { color: rgba(255,255,255,0.75); margin-bottom: 0.35rem; }
.prov-total   { font-size: 28px; font-weight: 800; color: #fff; margin: 0.2rem 0 0.75rem; }
.prov-breakdown { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
.prov-item    { display: flex; align-items: center; gap: 0.35rem; }
.prov-dot     { width: 8px; height: 8px; border-radius: 50%; }
.prov-tipo    { font-size: 11px; color: rgba(255,255,255,0.8); }
.prov-val     { font-size: 12px; font-weight: 700; color: #fff; }

.ano-pills    { display: flex; gap: 0.4rem; }
.ano-pill     { padding: 0.3rem 0.9rem; border: 1px solid #e5e7eb; border-radius: 99px; background: #fff; font-size: 13px; font-family: inherit; color: #8492A6; cursor: pointer; }
.ano-pill--ativo { border-color: #6C3FC5; color: #6C3FC5; background: #f3eeff; font-weight: 600; }

.proventos-lista { display: flex; flex-direction: column; gap: 0.5rem; }
.provento-card {
  background: #fff; border-radius: 14px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
  padding: 0.8rem 1rem;
  display: flex; align-items: center; justify-content: space-between;
}
.provento-left   { display: flex; flex-direction: column; gap: 3px; }
.provento-ticker { font-size: 14px; font-weight: 700; color: #1A1A2E; }
.provento-data   { font-size: 11px; color: #8492A6; }
.provento-right  { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.provento-valor  { font-size: 14px; font-weight: 700; color: #00C9A7; }
.provento-tipo-badge { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 99px; background: #e0f0ff; color: #2563eb; }

/* ── Empty ──────────────────────────────────────────────────────────────── */
.loading-center { display: flex; justify-content: center; align-items: center; min-height: 300px; }
.loading-card   { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; background: #fff; border-radius: 16px; padding: 2rem 2.5rem; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.loading-txt    { font-size: 13px; color: #8492A6; margin: 0; }
.empty-mobile   { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 220px; gap: 0.6rem; text-align: center; }
.empty-icon     { width: 56px; height: 56px; border-radius: 16px; background: #ede9f8; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #6C3FC5; }
.empty-txt      { font-size: 15px; font-weight: 600; color: #1A1A2E; margin: 0; }
.empty-hint     { font-size: 13px; color: #8492A6; margin: 0; }

/* ── Bottom Navigation ──────────────────────────────────────────────────── */
.bottom-nav {
  display: flex; flex-shrink: 0;
  background: #fff;
  border-top: 1px solid #f0f0f5;
  box-shadow: 0 -2px 12px rgba(0,0,0,0.07);
  padding-bottom: env(safe-area-inset-bottom, 0px); /* iPhone home indicator */
}
.nav-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; padding: 0.6rem 0; background: none; border: none;
  cursor: pointer; transition: color 0.15s; color: #8492A6;
}
.nav-btn--ativo { color: #6C3FC5; }
.nav-icon  { font-size: 18px; }
.nav-label { font-size: 10px; font-weight: 600; font-family: inherit; }
</style>
