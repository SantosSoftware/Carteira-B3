<script setup lang="ts">
import type { AtivoPreview } from '@/stores/importacao'
import { formatarMoeda, formatarNumero, formatarPercentual, sinalPercentual } from '@/utils/formatters'

defineProps<{
  ativos: AtivoPreview[]
  dataPosicao: string
  buscandoCotacoes: boolean
}>()

const COR_TIPO: Record<string, { bg: string; color: string }> = {
  Acao:      { bg: '#ede9f8', color: '#6c3fc5' },
  FII:       { bg: '#fff4e0', color: '#c47a00' },
  BDR:       { bg: '#e0f0ff', color: '#2563eb' },
  ETF:       { bg: '#e6faf5', color: '#059669' },
  RendaFixa: { bg: '#fef3c7', color: '#92400e' },
  Outro:     { bg: '#f3f4f6', color: '#6b7280' },
}
const COR_FALLBACK = { bg: '#f3f4f6', color: '#6b7280' }

function corTipo(tipo: string) {
  return COR_TIPO[tipo] ?? COR_FALLBACK
}
</script>

<template>
  <div class="preview">
    <div class="preview-header">
      <div class="preview-info">
        <i class="pi pi-check-circle preview-ok-icon" />
        <span>
          <strong>{{ ativos.length }} ativos</strong> identificados
          <span v-if="dataPosicao"> · Posição: <strong>{{ dataPosicao }}</strong></span>
        </span>
      </div>
      <div v-if="buscandoCotacoes" class="preview-loading">
        <i class="pi pi-spin pi-spinner" />
        Buscando cotações...
      </div>
    </div>

    <div class="table-wrap">
      <table class="preview-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Nome</th>
            <th>Tipo</th>
            <th class="align-right">Qtd</th>
            <th class="align-right">Preço Médio</th>
            <th class="align-right">Preço Atual</th>
            <th class="align-right">Valor Investido</th>
            <th class="align-right">Valor Atual</th>
            <th class="align-right">Rentab.</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ativo in ativos" :key="ativo.ticker">
            <td class="ticker-cell">
              <strong>{{ ativo.ticker }}</strong>
            </td>
            <td class="nome-cell">{{ ativo.nome_ativo || '—' }}</td>
            <td>
              <span
                class="badge-tipo"
                :style="{ background: corTipo(ativo.tipo_ativo).bg, color: corTipo(ativo.tipo_ativo).color }"
              >
                {{ ativo.tipo_ativo }}
              </span>
            </td>
            <td class="align-right">{{ formatarNumero(ativo.quantidade) }}</td>
            <td class="align-right">{{ formatarMoeda(ativo.preco_medio) }}</td>
            <td class="align-right">
              <span v-if="ativo.preco_atual">{{ formatarMoeda(ativo.preco_atual) }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td class="align-right">{{ formatarMoeda(ativo.valor_investido) }}</td>
            <td class="align-right">{{ formatarMoeda(ativo.valor_atual) }}</td>
            <td
              class="align-right rentab-cell"
              :class="{
                'text-positive': ativo.rentabilidade_percentual >= 0,
                'text-negative': ativo.rentabilidade_percentual < 0,
              }"
            >
              {{ sinalPercentual(ativo.rentabilidade_percentual) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 13px;
  color: var(--color-text);
}

.preview-ok-icon {
  color: var(--color-accent);
  font-size: 16px;
}

.preview-loading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 12px;
  color: var(--color-text-muted);
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.preview-table th {
  background-color: var(--color-bg);
  padding: 0.6rem 0.9rem;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  border-bottom: 1px solid var(--color-border);
}

.preview-table td {
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  white-space: nowrap;
}

.preview-table tbody tr:last-child td {
  border-bottom: none;
}

.preview-table tbody tr:hover td {
  background-color: var(--color-bg);
}

.align-right {
  text-align: right !important;
}

.ticker-cell {
  font-family: monospace;
  font-size: 13px;
}

.nome-cell {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-tipo {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 600;
}

.muted {
  color: var(--color-text-muted);
}

.text-positive { color: var(--color-accent); font-weight: 600; }
.text-negative { color: var(--color-danger); font-weight: 600; }
</style>
