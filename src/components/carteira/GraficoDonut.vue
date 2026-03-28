<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { AlocacaoPorTipo } from '@/utils/calculos'
import { formatarMoeda, formatarPercentual } from '@/utils/formatters'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  alocacao: AlocacaoPorTipo[]
  patrimonioTotal: number
  mesReferencia?: string
}>()

const COR_TIPO: Record<string, string> = {
  Acao:      '#6C3FC5',
  FII:       '#F4A623',
  BDR:       '#3B82F6',
  ETF:       '#10B981',
  RendaFixa: '#F59E0B',
  Outro:     '#94A3B8',
}

const chartData = computed(() => ({
  labels: props.alocacao.map((a) => a.tipo),
  datasets: [
    {
      data: props.alocacao.map((a) => a.valor),
      backgroundColor: props.alocacao.map((a) => COR_TIPO[a.tipo] ?? COR_TIPO.Outro),
      borderWidth: 3,
      borderColor: '#ffffff',
      hoverBorderWidth: 3,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { label: string; raw: unknown; dataset: { data: number[] }; dataIndex: number }) => {
          const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0)
          const pct = total > 0 ? ((ctx.raw as number) / total) * 100 : 0
          return ` ${ctx.label}: ${formatarMoeda(ctx.raw as number)} (${pct.toFixed(1)}%)`
        },
      },
    },
  },
}))
</script>

<template>
  <div class="donut-card">
    <h3 class="card-titulo">Alocação por Tipo</h3>

    <div v-if="alocacao.length" class="donut-wrap">
      <!-- Gráfico -->
      <div class="chart-container">
        <Doughnut :data="chartData" :options="chartOptions" />
        <!-- Centro -->
        <div class="chart-center">
          <span class="center-label">{{ mesReferencia ?? 'Total' }}</span>
          <span class="center-valor">{{ formatarMoeda(patrimonioTotal) }}</span>
        </div>
      </div>

      <!-- Legenda -->
      <ul class="legenda">
        <li v-for="item in alocacao" :key="item.tipo" class="legenda-item">
          <span class="legenda-cor" :style="{ background: COR_TIPO[item.tipo] ?? COR_TIPO.Outro }" />
          <div class="legenda-info">
            <span class="legenda-tipo">{{ item.tipo === 'Acao' ? 'Ações' : item.tipo === 'RendaFixa' ? 'Renda Fixa' : item.tipo }}</span>
            <span class="legenda-valor">{{ formatarMoeda(item.valor) }}</span>
          </div>
          <span class="legenda-pct">{{ formatarPercentual(item.percentual) }}</span>
        </li>
      </ul>
    </div>

    <div v-else class="empty">
      <i class="pi pi-chart-pie" style="font-size:28px;color:var(--color-border)" />
      <p>Sem dados de alocação</p>
    </div>
  </div>
</template>

<style scoped>
.donut-card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 1.5rem;
  height: 100%;
}

.card-titulo {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 1.25rem;
}

.donut-wrap {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.chart-container {
  position: relative;
  height: 200px;
  width: 200px;
  margin: 0 auto;
}

.chart-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  gap: 2px;
}

.center-label {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.center-valor {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.legenda {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.legenda-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.legenda-cor {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legenda-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.legenda-tipo {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.legenda-valor {
  font-size: 11px;
  color: var(--color-text-muted);
}

.legenda-pct {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
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
}
</style>
