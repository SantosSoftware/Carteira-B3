<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Tooltip, Legend,
  type TooltipItem,
} from 'chart.js'
import { useProventosStore }  from '@/stores/proventos'
import { useCarteiraStore }   from '@/stores/carteira'
import { parsearProventos }   from '@/services/proventosParser'
import { formatarMoeda, formatarData } from '@/utils/formatters'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const store         = useProventosStore()
const carteiraStore = useCarteiraStore()

onMounted(async () => {
  if (carteiraStore.carteira?.id) await store.carregar(carteiraStore.carteira.id)
})

// ── Filtros de tabela ──────────────────────────────────────────────────────
const buscaTicker    = ref('')
const filtroTipoAtivo = ref<'Todos' | 'Acao' | 'FII' | 'ETF' | 'Outro'>('Todos')

const proventosFiltrados = computed(() => {
  let lista = store.proventosAno
  if (filtroTipoAtivo.value !== 'Todos') {
    lista = lista.filter((p) => p.tipo_ativo === filtroTipoAtivo.value)
  }
  if (buscaTicker.value.trim()) {
    const q = buscaTicker.value.toUpperCase()
    lista = lista.filter((p) => p.ticker.includes(q) || p.nome_ativo?.toUpperCase().includes(q))
  }
  return lista
})

// ── Importação ─────────────────────────────────────────────────────────────
const importando    = ref(false)
const erroImport    = ref('')
const sucessoImport = ref('')
const arrastando    = ref(false)
const fileInputRef  = ref<HTMLInputElement | null>(null)
const preview       = ref<ReturnType<typeof parsearProventos> | null>(null)
const mostraPreview = ref(false)

function onDragOver(e: DragEvent) {
  e.preventDefault(); arrastando.value = true
}
function onDragLeave()   { arrastando.value = false }
function onDrop(e: DragEvent) {
  e.preventDefault(); arrastando.value = false
  const file = e.dataTransfer?.files[0]
  if (file) processarArquivo(file)
}

async function processarArquivo(file: File) {
  erroImport.value    = ''
  sucessoImport.value = ''
  preview.value       = null

  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    erroImport.value = 'Selecione um arquivo Excel (.xlsx ou .xls).'
    return
  }

  importando.value = true
  try {
    const buffer = await file.arrayBuffer()
    const parsed = parsearProventos(buffer)
    if (!parsed.length) {
      erroImport.value = 'Nenhum provento encontrado no arquivo. Verifique se é a planilha de Movimentação da B3.'
      return
    }
    preview.value       = parsed
    mostraPreview.value = true
  } catch (e: unknown) {
    erroImport.value = (e as { message?: string })?.message ?? 'Erro ao processar o arquivo.'
  } finally {
    importando.value = false
  }
}

async function confirmarImportacao() {
  if (!preview.value || !carteiraStore.carteira?.id) return
  importando.value = true
  erroImport.value = ''
  try {
    const qtd = await store.importar(carteiraStore.carteira.id, preview.value)
    sucessoImport.value = `${qtd} proventos importados com sucesso!`
    preview.value       = null
    mostraPreview.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  } catch (e: unknown) {
    erroImport.value = (e as { message?: string })?.message ?? 'Erro ao salvar proventos.'
  } finally {
    importando.value = false
  }
}

// ── Gráfico ────────────────────────────────────────────────────────────────
const chartData = computed(() => ({
  labels: store.graficoPorMes.labels,
  datasets: [
    {
      label: 'Ações',
      data: store.graficoPorMes.acoes,
      backgroundColor: '#6C3FC5',
      borderRadius: 4,
    },
    {
      label: 'FIIs',
      data: store.graficoPorMes.fiis,
      backgroundColor: '#F59E0B',
      borderRadius: 4,
    },
    {
      label: 'ETFs',
      data: store.graficoPorMes.etfs,
      backgroundColor: '#10B981',
      borderRadius: 4,
    },
    {
      label: 'Outros',
      data: store.graficoPorMes.outros,
      backgroundColor: '#94A3B8',
      borderRadius: 4,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { boxWidth: 12, font: { size: 11 } },
    },
    tooltip: {
      callbacks: {
        label: (ctx: TooltipItem<'bar'>) =>
          ` ${ctx.dataset.label ?? ''}: ${formatarMoeda(ctx.parsed.y ?? 0)}`,
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      grid: { display: false },
      ticks: { font: { size: 11 } },
    },
    y: {
      stacked: true,
      ticks: {
        font: { size: 11 },
        callback: (v: number | string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      },
      grid: { color: 'rgba(0,0,0,0.05)' },
    },
  },
}

// Etiqueta de tipo de ativo para exibição
const TIPO_LABELS: Record<string, string> = {
  Acao: 'Ação', FII: 'FII', ETF: 'ETF', Outro: 'Outro',
}
const TIPO_PROVENTO_LABELS: Record<string, string> = {
  Dividendo: 'Dividendo', JCP: 'JCP', Rendimento: 'Rendimento',
}
</script>

<template>
  <div class="page">
    <!-- Cabeçalho -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Proventos</h1>
        <p class="page-sub">Dividendos, JCP e rendimentos recebidos</p>
      </div>

      <!-- Seletor de ano -->
      <div class="ano-selector">
        <button
          v-for="ano in store.anosDisponiveis"
          :key="ano"
          class="ano-btn"
          :class="{ 'ano-btn--ativo': store.anoFiltro === ano }"
          @click="store.anoFiltro = ano"
        >{{ ano }}</button>
      </div>
    </div>

    <!-- Cards do dashboard -->
    <div class="cards-grid">
      <!-- Total no ano -->
      <div class="card card-destaque">
        <div class="card-icone card-icone--roxo"><i class="pi pi-money-bill" /></div>
        <div class="card-info">
          <span class="card-label">Total Recebido {{ store.anoFiltro }}</span>
          <span class="card-valor">{{ formatarMoeda(store.totalAno) }}</span>
          <span class="card-sub">Média: {{ formatarMoeda(store.mediasMensais) }}/mês</span>
        </div>
      </div>

      <!-- Ações -->
      <div class="card">
        <div class="card-icone card-icone--roxo2"><i class="pi pi-chart-bar" /></div>
        <div class="card-info">
          <span class="card-label">Ações</span>
          <span class="card-valor card-valor--md">{{ formatarMoeda(store.totalAcoes) }}</span>
          <span class="card-sub">
            Dividendos + JCP ·
            {{ store.totalAno > 0 ? ((store.totalAcoes / store.totalAno) * 100).toFixed(1) : 0 }}%
          </span>
        </div>
      </div>

      <!-- FIIs -->
      <div class="card">
        <div class="card-icone card-icone--amarelo"><i class="pi pi-building" /></div>
        <div class="card-info">
          <span class="card-label">Fundos Imobiliários</span>
          <span class="card-valor card-valor--md">{{ formatarMoeda(store.totalFIIs) }}</span>
          <span class="card-sub">
            Rendimentos ·
            {{ store.totalAno > 0 ? ((store.totalFIIs / store.totalAno) * 100).toFixed(1) : 0 }}%
          </span>
        </div>
      </div>

      <!-- ETFs -->
      <div class="card">
        <div class="card-icone card-icone--verde"><i class="pi pi-chart-line" /></div>
        <div class="card-info">
          <span class="card-label">ETFs</span>
          <span class="card-valor card-valor--md">{{ formatarMoeda(store.totalETFs) }}</span>
          <span class="card-sub">
            Rendimentos ·
            {{ store.totalAno > 0 ? ((store.totalETFs / store.totalAno) * 100).toFixed(1) : 0 }}%
          </span>
        </div>
      </div>
    </div>

    <!-- Gráfico + Top pagadores -->
    <div class="graficos-row" v-if="store.proventosAno.length">
      <!-- Gráfico mensal empilhado -->
      <div class="card grafico-card">
        <h3 class="section-title">Recebimentos por Mês — {{ store.anoFiltro }}</h3>
        <div class="grafico-wrap">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Top pagadores -->
      <div class="card top-card">
        <h3 class="section-title">Top Pagadores</h3>
        <div class="top-lista">
          <div v-for="item in store.topPagadores" :key="item.ticker" class="top-item">
            <div class="top-ticker-wrap">
              <span class="top-ticker">{{ item.ticker }}</span>
              <span class="badge" :class="`badge--${item.tipo_ativo.toLowerCase()}`">
                {{ TIPO_LABELS[item.tipo_ativo] }}
              </span>
            </div>
            <div class="top-barra-wrap">
              <div
                class="top-barra"
                :class="`top-barra--${item.tipo_ativo.toLowerCase()}`"
                :style="{ width: store.totalAno > 0 ? `${(item.total / store.totalAno) * 100}%` : '0%' }"
              />
            </div>
            <span class="top-valor">{{ formatarMoeda(item.total) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Zona de importação -->
    <div class="card import-card">
      <div class="import-header">
        <div>
          <h3 class="section-title" style="margin:0 0 0.2rem">Importar Planilha de Movimentação</h3>
          <p class="import-desc">Exporte a planilha de <strong>Movimentação</strong> no portal da B3 (ou CEI) e importe aqui.</p>
        </div>
        <button v-if="store.proventos.length" class="btn-limpar" @click="store.excluirTodos(carteiraStore.carteira!.id)">
          <i class="pi pi-trash" /> Limpar tudo
        </button>
      </div>

      <div
        class="dropzone"
        :class="{ 'dropzone--ativo': arrastando }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
        @click="fileInputRef?.click()"
      >
        <input ref="fileInputRef" type="file" accept=".xlsx,.xls" style="display:none" @change="e => { const f=(e.target as HTMLInputElement).files?.[0]; if(f) processarArquivo(f) }" />
        <i class="pi pi-upload dropzone-icone" />
        <span class="dropzone-texto">Arraste o arquivo ou <u>clique para selecionar</u></span>
        <span class="dropzone-hint">movimentacao-XXXX-XX-XX.xlsx</span>
      </div>

      <div v-if="importando" class="import-status"><i class="pi pi-spin pi-spinner" /> Processando...</div>
      <div v-if="erroImport"    class="alert alert-error"><i class="pi pi-exclamation-circle" />{{ erroImport }}</div>
      <div v-if="sucessoImport" class="alert alert-ok"><i class="pi pi-check-circle" />{{ sucessoImport }}</div>
    </div>

    <!-- Preview antes de confirmar -->
    <div v-if="mostraPreview && preview" class="card">
      <div class="preview-header">
        <h3 class="section-title" style="margin:0">
          Preview — {{ preview.length }} proventos encontrados
        </h3>
        <div class="preview-acoes">
          <button class="btn-cancelar" @click="mostraPreview = false; preview = null">Cancelar</button>
          <button class="btn-primary" :disabled="importando" @click="confirmarImportacao">
            <i v-if="importando" class="pi pi-spin pi-spinner" /><i v-else class="pi pi-check" />
            Confirmar Importação
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tabela">
          <thead>
            <tr>
              <th>Data</th><th>Ticker</th><th>Tipo Ativo</th><th>Tipo Provento</th><th>Qtd</th><th class="align-right">Valor Unit.</th><th class="align-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in preview.slice(0, 50)" :key="i">
              <td class="muted">{{ formatarData(p.data_pagamento) }}</td>
              <td><strong>{{ p.ticker }}</strong></td>
              <td><span class="badge" :class="`badge--${p.tipo_ativo.toLowerCase()}`">{{ TIPO_LABELS[p.tipo_ativo] }}</span></td>
              <td><span class="badge badge--provento">{{ TIPO_PROVENTO_LABELS[p.tipo_provento] }}</span></td>
              <td class="muted">{{ p.quantidade.toLocaleString('pt-BR') }}</td>
              <td class="align-right muted">{{ formatarMoeda(p.valor_unitario) }}</td>
              <td class="align-right"><strong>{{ formatarMoeda(p.valor_total) }}</strong></td>
            </tr>
          </tbody>
        </table>
        <p v-if="preview.length > 50" class="muted" style="font-size:12px;padding:0.5rem 0.75rem">
          ... e mais {{ preview.length - 50 }} registros.
        </p>
      </div>
    </div>

    <!-- Estado vazio -->
    <div v-if="!store.carregando && !store.proventos.length && !mostraPreview" class="empty-state">
      <div class="empty-icon-wrap"><i class="pi pi-money-bill" style="font-size:28px;color:var(--color-primary)" /></div>
      <h2 class="empty-title">Nenhum provento importado</h2>
      <p class="empty-desc">Importe a planilha de Movimentação da B3 acima para visualizar seus proventos.</p>
    </div>

    <!-- Tabela de proventos -->
    <div v-if="store.proventosAno.length" class="card">
      <div class="tabela-header">
        <h3 class="section-title" style="margin:0">Lançamentos — {{ store.anoFiltro }}</h3>
        <div class="tabela-filtros">
          <input v-model="buscaTicker" class="field-input" placeholder="Buscar ticker..." style="width:160px" />
          <div class="tipo-pills">
            <button v-for="t in ['Todos','Acao','FII','ETF','Outro']" :key="t" class="tipo-btn" :class="{ 'tipo-btn--ativo': filtroTipoAtivo === t }" @click="filtroTipoAtivo = t as typeof filtroTipoAtivo">
              {{ t === 'Todos' ? 'Todos' : t === 'Acao' ? 'Ações' : t }}
            </button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Ticker</th>
              <th>Ativo</th>
              <th>Tipo</th>
              <th>Provento</th>
              <th class="align-right">Qtd</th>
              <th class="align-right">Unit.</th>
              <th class="align-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in proventosFiltrados" :key="p.id">
              <td class="muted nowrap">{{ formatarData(p.data_pagamento) }}</td>
              <td><strong>{{ p.ticker }}</strong></td>
              <td class="muted nome-col">{{ p.nome_ativo }}</td>
              <td><span class="badge" :class="`badge--${p.tipo_ativo.toLowerCase()}`">{{ TIPO_LABELS[p.tipo_ativo] }}</span></td>
              <td><span class="badge badge--provento">{{ TIPO_PROVENTO_LABELS[p.tipo_provento] }}</span></td>
              <td class="align-right muted">{{ p.quantidade.toLocaleString('pt-BR') }}</td>
              <td class="align-right muted">{{ formatarMoeda(p.valor_unitario) }}</td>
              <td class="align-right"><strong class="positivo">{{ formatarMoeda(p.valor_total) }}</strong></td>
            </tr>
          </tbody>
          <!-- Linha de total filtrado -->
          <tfoot v-if="proventosFiltrados.length">
            <tr class="total-row">
              <td colspan="7" class="total-label">Total filtrado</td>
              <td class="align-right total-valor">
                {{ formatarMoeda(proventosFiltrados.reduce((s, p) => s + p.valor_total, 0)) }}
              </td>
            </tr>
          </tfoot>
        </table>
        <div v-if="!proventosFiltrados.length" class="empty-table">Nenhum registro para os filtros selecionados.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.25rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.page-title  { font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0 0 0.2rem; }
.page-sub    { font-size: 13px; color: var(--color-text-muted); margin: 0; }

/* Seletor de ano */
.ano-selector { display: flex; gap: 4px; }
.ano-btn { padding: 0.3rem 0.85rem; border: 1px solid var(--color-border); border-radius: 7px; background: none; font-size: 13px; font-family: inherit; color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; }
.ano-btn--ativo, .ano-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: #f3eeff; }

/* Cards */
.cards-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 1rem; }
@media (max-width: 1100px) { .cards-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px)  { .cards-grid { grid-template-columns: 1fr; } }

/* Card base — sempre block */
.card { background: var(--color-surface); border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 1.25rem; display: block; }

/* Somente cards de métricas (dentro do grid 4 colunas) usam flex */
.cards-grid .card { display: flex; align-items: center; gap: 1rem; }

.card-destaque { background: linear-gradient(135deg, #4a2a9a, #6c3fc5); color: #fff; }
.card-destaque .card-label { color: rgba(255,255,255,0.75); }
.card-destaque .card-valor { color: #fff; }
.card-destaque .card-sub   { color: rgba(255,255,255,0.65); }
.card-icone {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.card-icone--roxo   { background: rgba(108,63,197,0.15); color: #6c3fc5; }
.card-icone--roxo2  { background: rgba(108,63,197,0.15); color: #6c3fc5; }
.card-icone--amarelo{ background: rgba(245,158,11,0.15);  color: #f59e0b; }
.card-icone--verde  { background: rgba(16,185,129,0.15);  color: #10b981; }
.card-destaque .card-icone { background: rgba(255,255,255,0.2); color: #fff; }

.card-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.card-label { font-size: 11px; font-weight: 500; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.card-valor { font-size: 22px; font-weight: 700; color: var(--color-text); line-height: 1.2; }
.card-valor--md { font-size: 18px; }
.card-sub   { font-size: 11px; color: var(--color-text-muted); }

/* Gráfico + top */
.graficos-row { display: grid; grid-template-columns: 1fr 340px; gap: 1rem; align-items: start; }
@media (max-width: 1000px) { .graficos-row { grid-template-columns: 1fr; } }

.section-title { font-size: 12px; font-weight: 500; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 1rem; }
.grafico-wrap  { height: 240px; }

.top-lista { display: flex; flex-direction: column; gap: 0.6rem; }
.top-item  { display: flex; align-items: center; gap: 0.6rem; }
.top-ticker-wrap { display: flex; align-items: center; gap: 0.35rem; width: 90px; flex-shrink: 0; }
.top-ticker { font-size: 12px; font-weight: 700; color: var(--color-text); }
.top-barra-wrap { flex: 1; height: 8px; background: var(--color-border); border-radius: 99px; overflow: hidden; }
.top-barra { height: 100%; border-radius: 99px; transition: width 0.4s; }
.top-barra--acao  { background: #6c3fc5; }
.top-barra--fii   { background: #f59e0b; }
.top-barra--etf   { background: #10b981; }
.top-barra--outro { background: #94a3b8; }
.top-valor { font-size: 12px; font-weight: 600; color: var(--color-text); width: 90px; text-align: right; flex-shrink: 0; }

/* Importação */
.import-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; gap: 1rem; }
.import-desc   { font-size: 13px; color: var(--color-text-muted); margin: 0; }
.btn-limpar    { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.9rem; border: 1px solid var(--color-danger); border-radius: 8px; background: none; font-size: 12px; color: var(--color-danger); font-family: inherit; cursor: pointer; white-space: nowrap; }
.btn-limpar:hover { background: #fdf2f2; }

.dropzone {
  border: 2px dashed var(--color-border); border-radius: 12px; padding: 1.75rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  cursor: pointer; transition: all 0.15s; background: var(--color-bg);
}
.dropzone:hover, .dropzone--ativo { border-color: var(--color-primary); background: #f3eeff; }
.dropzone-icone { font-size: 28px; color: var(--color-primary); }
.dropzone-texto { font-size: 14px; color: var(--color-text); }
.dropzone-hint  { font-size: 12px; color: var(--color-text-muted); }
.import-status  { display: flex; align-items: center; gap: 0.5rem; font-size: 13px; color: var(--color-text-muted); margin-top: 0.75rem; }

/* Alerts */
.alert { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1rem; border-radius: 9px; font-size: 13px; margin-top: 0.75rem; }
.alert-error { background: #fdf2f2; color: var(--color-danger); border: 1px solid #fcd5d5; }
.alert-ok    { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }

/* Preview */
.preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem; }
.preview-acoes  { display: flex; gap: 0.75rem; align-items: center; }

/* Botões */
.btn-primary { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--color-primary); color: #fff; border: none; border-radius: 9px; padding: 0.5rem 1.1rem; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.15s; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }
.btn-cancelar { padding: 0.5rem 1.25rem; background: none; border: 1px solid var(--color-border); border-radius: 9px; font-size: 14px; font-family: inherit; cursor: pointer; color: var(--color-text-muted); }

/* Tabela */
.tabela-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
.tabela-filtros { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.tipo-pills { display: flex; gap: 3px; }
.tipo-btn { padding: 0.28rem 0.7rem; border: 1px solid var(--color-border); border-radius: 6px; background: none; font-size: 12px; font-family: inherit; color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; }
.tipo-btn--ativo, .tipo-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: #f3eeff; }

.table-wrap { overflow-x: auto; }
.tabela { width: 100%; border-collapse: collapse; font-size: 13px; }
.tabela th { text-align: left; font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; padding: 0 0.75rem 0.6rem; white-space: nowrap; }
.tabela td { padding: 0.6rem 0.75rem; border-top: 1px solid var(--color-border); }
.tabela tbody tr:hover { background: var(--color-bg); }

.total-row { background: var(--color-bg); }
.total-label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.total-valor { font-size: 15px; font-weight: 700; color: var(--color-text); text-align: right; }

.align-right { text-align: right !important; }
.muted       { color: var(--color-text-muted); }
.nowrap      { white-space: nowrap; }
.nome-col    { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.positivo    { color: var(--color-accent); }
.empty-table { font-size: 13px; color: var(--color-text-muted); text-align: center; padding: 2rem; }

/* Badges */
.badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
.badge--acao    { background: #ede9f8; color: #6c3fc5; }
.badge--fii     { background: #fff4e0; color: #c47a00; }
.badge--etf     { background: #e6faf5; color: #059669; }
.badge--outro   { background: #f3f4f6; color: #6b7280; }
.badge--provento{ background: #e0f0ff; color: #2563eb; }

/* Campo */
.field-input { height: 36px; padding: 0 0.75rem; border: 1px solid var(--color-border); border-radius: 8px; font-size: 13px; font-family: inherit; color: var(--color-text); background: var(--color-surface); outline: none; transition: border-color 0.15s; }
.field-input:focus { border-color: var(--color-primary); }

/* Empty state */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; gap: 0.75rem; text-align: center; background: var(--color-surface); border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.empty-icon-wrap { width: 64px; height: 64px; border-radius: 18px; background: #ede9f8; display: flex; align-items: center; justify-content: center; }
.empty-title { font-size: 17px; font-weight: 600; color: var(--color-text); margin: 0; }
.empty-desc  { font-size: 13px; color: var(--color-text-muted); margin: 0; max-width: 340px; }
</style>
