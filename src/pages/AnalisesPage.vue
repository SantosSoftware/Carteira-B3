<script setup lang="ts">
import { computed } from 'vue'
import { Pie, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
} from 'chart.js'
import { useCarteiraStore } from '@/stores/carteira'
import { formatarMoeda, formatarPercentual } from '@/utils/formatters'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const store = useCarteiraStore()

const COR_TIPO: Record<string, string> = {
  Acao: '#6C3FC5', FII: '#F4A623', BDR: '#3B82F6',
  ETF: '#10B981', RendaFixa: '#F59E0B', Outro: '#94A3B8',
}

// Pizza — alocação por tipo
const pieData = computed(() => ({
  labels: store.alocacaoPorTipo.map((a) =>
    a.tipo === 'Acao' ? 'Ações' : a.tipo === 'RendaFixa' ? 'Renda Fixa' : a.tipo,
  ),
  datasets: [{
    data: store.alocacaoPorTipo.map((a) => a.percentual),
    backgroundColor: store.alocacaoPorTipo.map((a) => COR_TIPO[a.tipo] ?? COR_TIPO.Outro),
    borderWidth: 2,
    borderColor: '#fff',
  }],
}))

const pieOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { position: 'right' as const, labels: { font: { size: 12 }, padding: 16 } },
    tooltip: { callbacks: { label: (ctx: { label: string; raw: unknown }) => ` ${ctx.label}: ${(ctx.raw as number).toFixed(1)}%` } },
  },
}

// Barras horizontais — top 10 por valor atual
const top10 = computed(() =>
  [...store.ativos].sort((a, b) => b.valor_atual - a.valor_atual).slice(0, 10),
)

const barData = computed(() => ({
  labels: top10.value.map((a) => a.ticker),
  datasets: [{
    label: 'Valor Atual',
    data: top10.value.map((a) => a.valor_atual),
    backgroundColor: top10.value.map((a) => COR_TIPO[a.tipo_ativo] ?? COR_TIPO.Outro),
    borderRadius: 6,
  }],
}))

const barOptions = {
  indexAxis: 'y' as const,
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx: { raw: unknown }) => ` ${formatarMoeda(ctx.raw as number)}` } },
  },
  scales: {
    x: { grid: { color: '#F0F0F5' }, ticks: { callback: (v: unknown) => formatarMoeda(v as number), font: { size: 11 }, color: '#8492A6' } },
    y: { grid: { display: false }, ticks: { font: { size: 12, weight: '600' as const }, color: '#1A1A2E' } },
  },
}

// Rentabilidade por tipo
const rentabPorTipo = computed(() => {
  const mapa: Record<string, { somaInv: number; somaAtual: number }> = {}
  for (const a of store.ativos) {
    if (!mapa[a.tipo_ativo]) mapa[a.tipo_ativo] = { somaInv: 0, somaAtual: 0 }
    mapa[a.tipo_ativo].somaInv += a.valor_investido
    mapa[a.tipo_ativo].somaAtual += a.valor_atual
  }
  return Object.entries(mapa).map(([tipo, v]) => ({
    tipo,
    rentabilidade: v.somaInv > 0 ? ((v.somaAtual - v.somaInv) / v.somaInv) * 100 : 0,
    valorAtual: v.somaAtual,
  }))
})

const rentabBarData = computed(() => ({
  labels: rentabPorTipo.value.map((r) =>
    r.tipo === 'Acao' ? 'Ações' : r.tipo === 'RendaFixa' ? 'Renda Fixa' : r.tipo,
  ),
  datasets: [{
    label: 'Rentabilidade (%)',
    data: rentabPorTipo.value.map((r) => r.rentabilidade),
    backgroundColor: rentabPorTipo.value.map((r) =>
      r.rentabilidade >= 0 ? '#00C9A7' : '#E74C3C',
    ),
    borderRadius: 6,
  }],
}))

const rentabBarOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx: { raw: unknown }) => ` ${(ctx.raw as number).toFixed(2)}%` } },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#1A1A2E' } },
    y: {
      grid: { color: '#F0F0F5' },
      ticks: { callback: (v: unknown) => `${(v as number).toFixed(0)}%`, font: { size: 11 }, color: '#8492A6' },
    },
  },
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">Análises</h1>

    <div v-if="!store.ativos.length" class="empty-state">
      <i class="pi pi-chart-bar" style="font-size:32px;color:var(--color-border)" />
      <p>Importe uma planilha para visualizar as análises.</p>
    </div>

    <template v-else>
      <!-- Linha 1: pizza + barras horizontais -->
      <div class="grid-2">
        <div class="card">
          <h3 class="card-titulo">Alocação por Tipo (%)</h3>
          <div class="chart-pie-wrap">
            <Pie :data="pieData" :options="pieOptions" />
          </div>
        </div>

        <div class="card">
          <h3 class="card-titulo">Top 10 Ativos por Valor Atual</h3>
          <div class="chart-bar-wrap">
            <Bar :data="barData" :options="barOptions" />
          </div>
        </div>
      </div>

      <!-- Linha 2: rentabilidade por tipo + sumário -->
      <div class="grid-2">
        <div class="card">
          <h3 class="card-titulo">Rentabilidade por Tipo (%)</h3>
          <div class="chart-rentab-wrap">
            <Bar :data="rentabBarData" :options="rentabBarOptions" />
          </div>
        </div>

        <div class="card">
          <h3 class="card-titulo">Sumário por Tipo</h3>
          <table class="sumario-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th class="align-right">Investido</th>
                <th class="align-right">Atual</th>
                <th class="align-right">Rentab.</th>
                <th class="align-right">% Carteira</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in rentabPorTipo" :key="item.tipo">
                <td>
                  <span class="tipo-dot" :style="{ background: COR_TIPO[item.tipo] ?? '#94A3B8' }" />
                  {{ item.tipo === 'Acao' ? 'Ações' : item.tipo === 'RendaFixa' ? 'Renda Fixa' : item.tipo }}
                </td>
                <td class="align-right muted">
                  {{ formatarMoeda(store.ativos.filter(a => a.tipo_ativo === item.tipo).reduce((s, a) => s + a.valor_investido, 0)) }}
                </td>
                <td class="align-right">{{ formatarMoeda(item.valorAtual) }}</td>
                <td
                  class="align-right"
                  :class="item.rentabilidade >= 0 ? 'positivo' : 'negativo'"
                >
                  {{ item.rentabilidade >= 0 ? '+' : '' }}{{ item.rentabilidade.toFixed(2).replace('.', ',') }}%
                </td>
                <td class="align-right muted">
                  {{ formatarPercentual(store.patrimonioTotal > 0 ? (item.valorAtual / store.patrimonioTotal) * 100 : 0) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.25rem; }
.page-title { font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }

.card { background: var(--color-surface); border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 1.5rem; }
.card-titulo { font-size: 12px; font-weight: 500; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 1.25rem; }

.chart-pie-wrap  { height: 260px; }
.chart-bar-wrap  { height: 260px; }
.chart-rentab-wrap { height: 220px; }

.sumario-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sumario-table th { text-align: left; font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; padding: 0 0.5rem 0.6rem; }
.sumario-table td { padding: 0.6rem 0.5rem; border-top: 1px solid var(--color-border); }
.align-right { text-align: right !important; }
.muted { color: var(--color-text-muted); }
.positivo { color: var(--color-accent); font-weight: 600; }
.negativo { color: var(--color-danger); font-weight: 600; }
.tipo-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 240px; gap: 0.75rem; text-align: center;
  background: var(--color-surface); border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); color: var(--color-text-muted); font-size: 13px;
}
</style>
