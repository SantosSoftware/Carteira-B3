<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCarteiraStore } from '@/stores/carteira'
import { useAtivosManualStore, CATEGORIAS, getCategoriaInfo } from '@/stores/ativosManual'
import MetricaCard from '@/components/carteira/MetricaCard.vue'
import GraficoDonut from '@/components/carteira/GraficoDonut.vue'
import GraficoHistorico from '@/components/carteira/GraficoHistorico.vue'
import { formatarMoeda, formatarPercentual, sinalPercentual, formatarData } from '@/utils/formatters'

const store       = useCarteiraStore()
const manualStore = useAtivosManualStore()

onMounted(async () => {
  if (store.carteira?.id && !manualStore.ativos.length) {
    await manualStore.carregar(store.carteira.id)
  }
})

const mesReferencia = computed(() => {
  const data = store.importacaoMaisRecente?.data_posicao
  if (!data) return undefined
  const [ano, mes] = data.split('-')
  return `${mes}/${ano}`
})

// Patrimônio consolidado = B3 + outros ativos manuais
const patrimonioConsolidado = computed(() => store.patrimonioTotal + manualStore.totalGeral)
const resultadoConsolidado  = computed(() => patrimonioConsolidado.value - store.valorInvestido)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Resumo da Carteira</h1>
        <p v-if="store.importacaoMaisRecente" class="page-sub">
          Posição de {{ formatarData(store.importacaoMaisRecente.data_posicao) }}
        </p>
      </div>
    </div>

    <!-- Estado vazio -->
    <div v-if="store.carregando" class="empty-state">
      <i class="pi pi-spin pi-spinner" style="font-size:28px;color:var(--color-primary)" />
      <p>Carregando carteira...</p>
    </div>

    <template v-else-if="!store.ativos.length">
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <i class="pi pi-upload" style="font-size:28px;color:var(--color-primary)" />
        </div>
        <h2 class="empty-title">Nenhuma posição importada</h2>
        <p class="empty-desc">
          Clique em <strong>Importar Planilha</strong> na barra superior para começar.
        </p>
      </div>
    </template>

    <template v-else>
      <!-- Cards de métricas -->
      <div class="metricas-grid">
        <MetricaCard
          titulo="Patrimônio Total"
          :valor="formatarMoeda(patrimonioConsolidado)"
          icone="pi pi-wallet"
          cor-icone="#6C3FC5"
          :subtitulo="manualStore.totalGeral > 0 ? 'B3 + outros ativos' : 'valor de mercado'"
        />
        <MetricaCard
          titulo="Valor Investido"
          :valor="formatarMoeda(store.valorInvestido)"
          icone="pi pi-money-bill"
          cor-icone="#3B82F6"
          subtitulo="custo total B3"
        />
        <MetricaCard
          titulo="Rentabilidade"
          :valor="sinalPercentual(store.rentabilidadeGlobal)"
          icone="pi pi-chart-line"
          :cor-icone="store.rentabilidadeGlobal >= 0 ? '#00C9A7' : '#E74C3C'"
          :variacao="store.rentabilidadeGlobal"
          subtitulo="sobre o custo B3"
        />
        <MetricaCard
          titulo="Resultado"
          :valor="formatarMoeda(resultadoConsolidado)"
          icone="pi pi-trending-up"
          :cor-icone="resultadoConsolidado >= 0 ? '#00C9A7' : '#E74C3C'"
          subtitulo="lucro / prejuízo"
        />
      </div>

      <!-- Gráficos -->
      <div class="graficos-grid">
        <GraficoDonut
          :alocacao="store.alocacaoPorTipo"
          :patrimonio-total="store.patrimonioTotal"
          :mes-referencia="mesReferencia"
        />
        <GraficoHistorico :historico="store.historicoPatrimonio" />
      </div>

      <!-- Outros Ativos -->
      <div v-if="manualStore.ativos.length" class="card outros-ativos-section">
        <div class="section-header">
          <h3 class="section-title">Outros Ativos</h3>
          <span class="section-total">{{ formatarMoeda(manualStore.totalGeral) }}</span>
        </div>
        <div class="outros-grid">
          <div v-for="cat in CATEGORIAS.filter(c => manualStore.totalPorCategoria[c.value])" :key="cat.value" class="outro-item">
            <div class="outro-icone" :style="{ background: cat.cor + '22', color: cat.cor }">
              <i :class="cat.icone" />
            </div>
            <div class="outro-info">
              <span class="outro-label">{{ cat.label }}</span>
              <span class="outro-valor">{{ formatarMoeda(manualStore.totalPorCategoria[cat.value] ?? 0) }}</span>
            </div>
          </div>
        </div>
        <RouterLink to="/outros-ativos" class="link-gerenciar">
          <i class="pi pi-external-link" /> Gerenciar outros ativos
        </RouterLink>
      </div>

      <!-- Top 5 ativos -->
      <div class="card top-ativos">
        <h3 class="section-title">Maiores Posições</h3>
        <table class="mini-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Tipo</th>
              <th class="align-right">Valor Atual</th>
              <th class="align-right">% Carteira</th>
              <th class="align-right">Rentab.</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ativo in [...store.ativos]
                .sort((a, b) => b.valor_atual - a.valor_atual)
                .slice(0, 5)"
              :key="ativo.ticker"
            >
              <td><strong>{{ ativo.ticker }}</strong></td>
              <td>
                <span class="tipo-badge" :class="`tipo-${ativo.tipo_ativo}`">
                  {{ ativo.tipo_ativo === 'Acao' ? 'Ação' : ativo.tipo_ativo === 'RendaFixa' ? 'Renda Fixa' : ativo.tipo_ativo }}
                </span>
              </td>
              <td class="align-right">{{ formatarMoeda(ativo.valor_atual) }}</td>
              <td class="align-right muted">
                {{ formatarPercentual(patrimonioConsolidado > 0 ? (ativo.valor_atual / patrimonioConsolidado) * 100 : 0) }}
              </td>
              <td
                class="align-right"
                :class="ativo.rentabilidade_percentual >= 0 ? 'positivo' : 'negativo'"
              >
                {{ sinalPercentual(ativo.rentabilidade_percentual) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.25rem; }

.page-header { display: flex; align-items: flex-start; justify-content: space-between; }

.page-title {
  font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0 0 0.2rem;
}

.page-sub { font-size: 13px; color: var(--color-text-muted); margin: 0; }

.metricas-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 1100px) { .metricas-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .metricas-grid { grid-template-columns: 1fr; } }

.graficos-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 900px) { .graficos-grid { grid-template-columns: 1fr; } }

.card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 1.5rem;
}

.section-title {
  font-size: 12px; font-weight: 500; color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 1rem;
}

.mini-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.mini-table th {
  text-align: left; font-size: 11px; font-weight: 600; color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.04em; padding: 0 0.75rem 0.6rem;
}
.mini-table td { padding: 0.6rem 0.75rem; border-top: 1px solid var(--color-border); }
.align-right { text-align: right !important; }
.muted { color: var(--color-text-muted); }
.positivo { color: var(--color-accent); font-weight: 600; }
.negativo { color: var(--color-danger); font-weight: 600; }

.tipo-badge {
  display: inline-block; padding: 2px 8px; border-radius: 99px;
  font-size: 10px; font-weight: 600;
}
.tipo-Acao      { background:#ede9f8; color:#6c3fc5; }
.tipo-FII       { background:#fff4e0; color:#c47a00; }
.tipo-BDR       { background:#e0f0ff; color:#2563eb; }
.tipo-ETF       { background:#e6faf5; color:#059669; }
.tipo-RendaFixa { background:#fef3c7; color:#92400e; }
.tipo-Outro     { background:#f3f4f6; color:#6b7280; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 320px; gap: 0.75rem; text-align: center;
  background: var(--color-surface); border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.outros-ativos-section { display: flex; flex-direction: column; gap: 1rem; }
.section-header { display: flex; align-items: center; justify-content: space-between; }
.section-total  { font-size: 15px; font-weight: 700; color: var(--color-text); }
.outros-grid    { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.outro-item     { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.9rem; background: var(--color-bg); border-radius: 10px; border: 1px solid var(--color-border); }
.outro-icone    { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.outro-label    { font-size: 11px; color: var(--color-text-muted); display: block; }
.outro-valor    { font-size: 13px; font-weight: 700; color: var(--color-text); display: block; }
.link-gerenciar { font-size: 12px; color: var(--color-primary); text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; }
.link-gerenciar:hover { opacity: 0.75; }

.empty-icon-wrap {
  width: 64px; height: 64px; border-radius: 18px; background: #ede9f8;
  display: flex; align-items: center; justify-content: center;
}
.empty-title { font-size: 17px; font-weight: 600; color: var(--color-text); margin: 0; }
.empty-desc  { font-size: 13px; color: var(--color-text-muted); margin: 0; max-width: 320px; }
</style>
