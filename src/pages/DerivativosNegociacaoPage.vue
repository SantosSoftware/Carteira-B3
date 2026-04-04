<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { RouterLink } from 'vue-router'
import { useCarteiraStore } from '@/stores/carteira'
import { useNegociacoesOpcaoStore } from '@/stores/negociacoesOpcao'
import { formatarMoeda, formatarData, formatarNumero } from '@/utils/formatters'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const carteiraStore = useCarteiraStore()
const negStore = useNegociacoesOpcaoStore()

const arquivoInput = ref<HTMLInputElement | null>(null)
const importando = ref(false)
const tabelaExpandida = ref(false)
const arrastando = ref(false)

watch(
  () => carteiraStore.carteira?.id,
  async (id) => {
    if (id) await negStore.carregar(id)
    else negStore.limparEstado()
  },
  { immediate: true },
)

const mesesOrdenados = computed(() => {
  const set = new Set<string>()
  for (const l of negStore.linhas) {
    set.add(l.data_negocio.slice(0, 7))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

const totaisPorMes = computed(() => {
  const map = new Map<string, { compra: number; venda: number }>()
  for (const key of mesesOrdenados.value) {
    map.set(key, { compra: 0, venda: 0 })
  }
  for (const l of negStore.linhas) {
    const key = l.data_negocio.slice(0, 7)
    if (!map.has(key)) map.set(key, { compra: 0, venda: 0 })
    const e = map.get(key)!
    if (l.tipo_movimentacao === 'Compra') e.compra += l.valor
    else e.venda += l.valor
  }
  return map
})

function labelMes(ym: string): string {
  const [y, m] = ym.split('-')
  return `${m}/${y}`
}

const chartMes = computed(() => ({
  labels: mesesOrdenados.value.map(labelMes),
  datasets: [
    {
      label: 'Compras (R$)',
      data: mesesOrdenados.value.map((k) => totaisPorMes.value.get(k)?.compra ?? 0),
      backgroundColor: '#dc2626',
      borderRadius: 4,
    },
    {
      label: 'Vendas (R$)',
      data: mesesOrdenados.value.map((k) => totaisPorMes.value.get(k)?.venda ?? 0),
      backgroundColor: '#16a34a',
      borderRadius: 4,
    },
  ],
}))

const chartMesOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
          ` ${ctx.dataset.label ?? ''}: ${formatarMoeda(ctx.raw as number)}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      grid: { color: '#f0f0f5' },
      ticks: {
        callback: (v: string | number) =>
          formatarMoeda(typeof v === 'number' ? v : parseFloat(v)),
      },
    },
  },
}

const TOP_TICKERS = 15

const totaisPorTicker = computed(() => {
  const map = new Map<string, { compra: number; venda: number }>()
  for (const l of negStore.linhas) {
    const t = l.ticker_base
    if (!map.has(t)) map.set(t, { compra: 0, venda: 0 })
    const e = map.get(t)!
    if (l.tipo_movimentacao === 'Compra') e.compra += l.valor
    else e.venda += l.valor
  }
  return map
})

const tickersTop = computed(() => {
  const entries = [...totaisPorTicker.value.entries()].map(([ticker, v]) => ({
    ticker,
    compra: v.compra,
    venda: v.venda,
    total: v.compra + v.venda,
  }))
  entries.sort((a, b) => b.total - a.total)
  return entries.slice(0, TOP_TICKERS)
})

const chartTicker = computed(() => ({
  labels: tickersTop.value.map((x) => x.ticker),
  datasets: [
    {
      label: 'Compras (R$)',
      data: tickersTop.value.map((x) => x.compra),
      backgroundColor: '#dc2626',
      borderRadius: 4,
    },
    {
      label: 'Vendas (R$)',
      data: tickersTop.value.map((x) => x.venda),
      backgroundColor: '#16a34a',
      borderRadius: 4,
    },
  ],
}))

const chartTickerOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: chartMesOptions.plugins,
  scales: {
    x: {
      grid: { color: '#f0f0f5' },
      ticks: {
        callback: (v: string | number) =>
          formatarMoeda(typeof v === 'number' ? v : parseFloat(String(v))),
      },
    },
    y: { grid: { display: false } },
  },
}

const totalCompra = computed(() =>
  negStore.linhas.filter((l) => l.tipo_movimentacao === 'Compra').reduce((s, l) => s + l.valor, 0),
)
const totalVenda = computed(() =>
  negStore.linhas.filter((l) => l.tipo_movimentacao === 'Venda').reduce((s, l) => s + l.valor, 0),
)

async function processarArquivo(file: File | null) {
  if (!file || !carteiraStore.carteira?.id) return
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    alert('Envie um arquivo .xlsx exportado pela B3.')
    return
  }
  if (negStore.linhas.length) {
    const ok = window.confirm(
      'Já existem negociações importadas. Deseja substituir todos os dados pelo novo arquivo?',
    )
    if (!ok) return
  }
  importando.value = true
  negStore.erro = null
  try {
    await negStore.importarSubstituindo(file, carteiraStore.carteira.id)
  } catch {
    /* erro já em negStore.erro */
  } finally {
    importando.value = false
    if (arquivoInput.value) arquivoInput.value.value = ''
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  void processarArquivo(file)
}

function onDrop(e: DragEvent) {
  arrastando.value = false
  const file = e.dataTransfer?.files?.[0]
  void processarArquivo(file ?? null)
}

function abrirSeletor() {
  arquivoInput.value?.click()
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Negociação em opções</h1>
        <p class="page-sub">
          Use apenas o export <strong>Negociação</strong> (aba homônima). Não é o extrato de custódia.
        </p>
      </div>
    </div>

    <div class="card card--isolamento" role="note">
      <i class="pi pi-shield" aria-hidden="true" />
      <div>
        <p class="isolamento-titulo">Esta tela não altera sua posição em Ativos</p>
        <p class="isolamento-texto">
          A importação grava somente na tabela <strong>negociações em opções</strong> (análise de compra/venda).
          O app <strong>não</strong> grava em <code>importacoes</code> nem em <code>posicoes</code> a partir daqui.
          Se a carteira mudou, a causa foi outra (por exemplo importação pelo menu
          <RouterLink to="/importacoes">Importações</RouterLink>, ou cotações ao vivo na tela de Ativos).
        </p>
      </div>
    </div>

    <div
      class="dropzone"
      :class="{ 'dropzone--drag': arrastando }"
      @dragover.prevent="arrastando = true"
      @dragleave.prevent="arrastando = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="arquivoInput"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        class="sr-only"
        @change="onFileChange"
      />
      <i class="pi pi-upload dropzone-icon" />
      <p class="dropzone-text">
        Arraste o .xlsx aqui ou
        <button type="button" class="link-btn" :disabled="importando || !carteiraStore.carteira" @click="abrirSeletor">
          escolha o arquivo
        </button>
      </p>
      <p v-if="!carteiraStore.carteira" class="dropzone-warn">Carregue a carteira (faça login).</p>
      <p v-if="importando || negStore.carregando" class="dropzone-loading">
        <i class="pi pi-spin pi-spinner" /> Processando…
      </p>
    </div>

    <div v-if="negStore.ultimaImportacao" class="card card--info">
      <i class="pi pi-check-circle" />
      <span>
        Importado da aba <strong>{{ negStore.ultimaImportacao.nomeAba }}</strong> —
        {{ negStore.ultimaImportacao.opcoes }} linha(s) de opções de
        {{ negStore.ultimaImportacao.totalArquivo }} no arquivo.
      </span>
    </div>

    <div v-if="negStore.erro" class="card card--erro">
      <i class="pi pi-exclamation-triangle" />
      <div>
        <p>{{ negStore.erro }}</p>
        <p class="hint">
          Se a mensagem indicar que a tabela não existe, execute o script
          <code>supabase/schema_negociacoes_opcao.sql</code> no painel SQL do Supabase.
        </p>
      </div>
    </div>

    <template v-if="negStore.linhas.length">
      <div class="resumo-grid">
        <div class="card resumo">
          <span class="resumo-label">Total compras</span>
          <span class="resumo-val compra">{{ formatarMoeda(totalCompra) }}</span>
        </div>
        <div class="card resumo">
          <span class="resumo-label">Total vendas</span>
          <span class="resumo-val venda">{{ formatarMoeda(totalVenda) }}</span>
        </div>
        <div class="card resumo">
          <span class="resumo-label">Saldo (compra − venda)</span>
          <span
            class="resumo-val"
            :class="totalCompra - totalVenda >= 0 ? 'compra' : 'venda'"
          >
            {{ formatarMoeda(totalCompra - totalVenda) }}
          </span>
        </div>
      </div>

      <div class="grid-charts">
        <div class="card chart-card">
          <h2 class="card-titulo">Compras e vendas por mês (R$)</h2>
          <div class="chart-wrap">
            <Bar :data="chartMes" :options="chartMesOptions" />
          </div>
        </div>
        <div class="card chart-card">
          <h2 class="card-titulo">
            Por ticker subjacente (4 letras) — top {{ TOP_TICKERS }} por volume
          </h2>
          <div class="chart-wrap chart-wrap--h">
            <Bar :data="chartTicker" :options="chartTickerOptions" />
          </div>
        </div>
      </div>

      <div class="card tabela-card">
        <button
          type="button"
          class="tabela-toggle"
          @click="tabelaExpandida = !tabelaExpandida"
        >
          <span>
            Negócios importados ({{ negStore.linhas.length }})
            <span class="muted">— clique para {{ tabelaExpandida ? 'recolher' : 'expandir' }}</span>
          </span>
          <i :class="tabelaExpandida ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
        </button>
        <div v-show="tabelaExpandida" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Ticker</th>
                <th>Código</th>
                <th class="align-right">Qtd</th>
                <th class="align-right">Preço</th>
                <th class="align-right">Valor</th>
                <th>Mercado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in negStore.linhas" :key="row.id">
                <td>{{ formatarData(row.data_negocio) }}</td>
                <td>
                  <span class="tag" :class="row.tipo_movimentacao === 'Compra' ? 'tag--c' : 'tag--v'">
                    {{ row.tipo_movimentacao }}
                  </span>
                </td>
                <td><strong>{{ row.ticker_base }}</strong></td>
                <td class="mono">{{ row.codigo_negociacao }}</td>
                <td class="align-right">{{ formatarNumero(row.quantidade) }}</td>
                <td class="align-right">{{ formatarMoeda(row.preco) }}</td>
                <td class="align-right">{{ formatarMoeda(row.valor) }}</td>
                <td class="mercado-cell">{{ row.mercado }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else-if="!negStore.carregando && carteiraStore.carteira" class="empty-hint card">
      <i class="pi pi-info-circle" />
      <p>Nenhuma negociação em opções importada ainda. Envie o arquivo de negociação da B3 acima.</p>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 1200px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 0.25rem;
  color: var(--color-text);
}
.page-sub {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 52ch;
  line-height: 1.45;
}

.card--isolamento {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
}
.card--isolamento .pi-shield {
  font-size: 1.35rem;
  color: var(--color-primary);
  margin-top: 2px;
  flex-shrink: 0;
}
.isolamento-titulo {
  margin: 0 0 0.4rem;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}
.isolamento-texto {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-muted);
}
.isolamento-texto code {
  font-size: 12px;
}
.isolamento-texto :deep(a) {
  color: var(--color-primary);
  font-weight: 600;
}

.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  background: var(--color-surface);
  transition: border-color 0.15s, background 0.15s;
}
.dropzone--drag {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
}
.dropzone-icon {
  font-size: 2rem;
  color: var(--color-text-muted);
  display: block;
  margin-bottom: 0.75rem;
}
.dropzone-text {
  font-size: 14px;
  color: var(--color-text);
  margin: 0;
}
.dropzone-warn,
.dropzone-loading {
  font-size: 13px;
  color: var(--color-danger);
  margin: 0.75rem 0 0;
}
.dropzone-loading {
  color: var(--color-primary);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
.link-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
.link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  padding: 1.25rem;
}
.card--info {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  font-size: 13px;
  color: var(--color-text);
}
.card--info .pi {
  color: var(--color-accent);
  margin-top: 2px;
}
.card--erro {
  display: flex;
  gap: 0.75rem;
  font-size: 13px;
  color: var(--color-danger);
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.card--erro .pi {
  margin-top: 2px;
}
.hint {
  margin: 0.5rem 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
}
.hint code {
  font-size: 11px;
}

.resumo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.resumo {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.resumo-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}
.resumo-val {
  font-size: 18px;
  font-weight: 700;
}
.resumo-val.compra {
  color: #dc2626;
}
.resumo-val.venda {
  color: #16a34a;
}

.grid-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 960px) {
  .grid-charts {
    grid-template-columns: 1fr;
  }
}
.card-titulo {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin: 0 0 1rem;
}
.chart-wrap {
  height: 280px;
}
.chart-wrap--h {
  height: min(420px, 60vh);
}
.chart-card {
  min-width: 0;
}

.tabela-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  text-align: left;
}
.tabela-toggle:hover {
  color: var(--color-primary);
}
.muted {
  font-weight: 400;
  font-size: 13px;
  color: var(--color-text-muted);
}
.table-wrap {
  margin-top: 1rem;
  overflow-x: auto;
  max-height: 480px;
  overflow-y: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th,
.data-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}
.data-table th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
  position: sticky;
  top: 0;
  background: var(--color-surface);
  z-index: 1;
}
.align-right {
  text-align: right !important;
}
.mono {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.mercado-cell {
  max-width: 200px;
  font-size: 12px;
  color: var(--color-text-muted);
}
.tag {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.tag--c {
  background: #dbeafe;
  color: #1d4ed8;
}
.tag--v {
  background: #ffedd5;
  color: #c2410c;
}

.empty-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  font-size: 14px;
  color: var(--color-text-muted);
}
.empty-hint .pi {
  margin-top: 2px;
}
.empty-hint p {
  margin: 0;
}
</style>
