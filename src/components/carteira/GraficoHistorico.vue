<script setup lang="ts">
import { computed, ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { formatarMoeda } from '@/utils/formatters'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export interface PontoHistorico {
  data: string
  patrimonio: number
}

const props = defineProps<{
  historico: PontoHistorico[]
}>()

type Periodo = '12m' | '24m' | 'tudo'
const periodo = ref<Periodo>('tudo')

const dadosFiltrados = computed(() => {
  const agora = new Date()
  const filtro: Record<Periodo, number> = { '12m': 12, '24m': 24, tudo: 9999 }
  const mesesAtras = filtro[periodo.value]

  return props.historico.filter(({ data }) => {
    const d = new Date(data + 'T00:00:00')
    const diffMeses =
      (agora.getFullYear() - d.getFullYear()) * 12 + (agora.getMonth() - d.getMonth())
    return diffMeses <= mesesAtras
  })
})

const labels = computed(() =>
  dadosFiltrados.value.map(({ data }) => {
    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
  }),
)

const valores = computed(() => dadosFiltrados.value.map(({ patrimonio }) => patrimonio))

const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: 'Patrimônio',
      data: valores.value,
      borderColor: '#6C3FC5',
      backgroundColor: 'rgba(108, 63, 197, 0.08)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#6C3FC5',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { raw: unknown }) => ` ${formatarMoeda(ctx.raw as number)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 }, color: '#8492A6' },
    },
    y: {
      grid: { color: '#F0F0F5' },
      ticks: {
        font: { size: 11 },
        color: '#8492A6',
        callback: (v: unknown) => formatarMoeda(v as number),
      },
    },
  },
}))
</script>

<template>
  <div class="historico-card">
    <div class="card-header">
      <h3 class="card-titulo">Histórico de Patrimônio</h3>
      <div class="periodos">
        <button
          v-for="p in (['12m', '24m', 'tudo'] as Periodo[])"
          :key="p"
          class="periodo-btn"
          :class="{ 'periodo-btn--ativo': periodo === p }"
          @click="periodo = p"
        >
          {{ p === '12m' ? '12 meses' : p === '24m' ? '24 meses' : 'Tudo' }}
        </button>
      </div>
    </div>

    <div v-if="dadosFiltrados.length >= 1" class="chart-wrap">
      <Line :data="chartData" :options="chartOptions" />
    </div>

    <div v-else class="empty">
      <i class="pi pi-chart-line" style="font-size:28px;color:var(--color-border)" />
      <p>Sem dados de histórico para o período selecionado</p>
    </div>
  </div>
</template>

<style scoped>
.historico-card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 1.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.card-titulo {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}

.periodos {
  display: flex;
  gap: 4px;
}

.periodo-btn {
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: none;
  font-size: 11px;
  font-family: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.periodo-btn--ativo,
.periodo-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: #f3eeff;
}

.chart-wrap {
  flex: 1;
  min-height: 200px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 0;
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
  flex: 1;
}
</style>
