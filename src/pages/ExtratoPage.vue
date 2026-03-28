<script setup lang="ts">
import { ref } from 'vue'
import { useCarteiraStore } from '@/stores/carteira'
import { formatarMoeda, formatarData } from '@/utils/formatters'

const store = useCarteiraStore()
const confirmandoId = ref<string | null>(null)
const excluindo = ref(false)

async function excluir(id: string) {
  excluindo.value = true
  await store.excluirImportacao(id)
  confirmandoId.value = null
  excluindo.value = false
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Extrato de Importações</h1>
        <p class="page-sub">{{ store.importacoes.length }} importação(ões) registrada(s)</p>
      </div>
    </div>

    <div v-if="!store.importacoes.length" class="empty-state">
      <i class="pi pi-file" style="font-size:32px;color:var(--color-border)" />
      <p>Nenhuma importação encontrada. Importe uma planilha para começar.</p>
    </div>

    <div v-else class="card">
      <table class="extrato-table">
        <thead>
          <tr>
            <th>Data da Posição</th>
            <th>Arquivo</th>
            <th>Status</th>
            <th class="align-right">Patrimônio</th>
            <th class="align-right">Importado em</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="imp in store.importacoes" :key="imp.id">
            <td class="data-cell">
              <i class="pi pi-calendar" style="margin-right:6px;color:var(--color-text-muted)" />
              {{ formatarData(imp.data_posicao) }}
            </td>
            <td class="arquivo-cell">
              <i class="pi pi-file-excel" style="margin-right:6px;color:#059669" />
              {{ imp.nome_arquivo }}
            </td>
            <td>
              <span class="status-badge" :class="`status-${imp.status}`">
                {{ imp.status === 'ok' ? 'Sucesso' : 'Erro' }}
              </span>
            </td>
            <td class="align-right patrimonio-cell">
              {{ store.patrimoniosPorImportacao[imp.id] !== undefined
                ? formatarMoeda(store.patrimoniosPorImportacao[imp.id])
                : '—' }}
            </td>
            <td class="align-right muted">
              {{ formatarData(imp.created_at.split('T')[0]) }}
            </td>
            <td class="acoes-cell">
              <!-- Confirmação inline de exclusão -->
              <template v-if="confirmandoId === imp.id">
                <span class="confirm-text">Excluir?</span>
                <button class="btn-sim" :disabled="excluindo" @click="excluir(imp.id)">
                  <i v-if="excluindo" class="pi pi-spin pi-spinner" />
                  <span v-else>Sim</span>
                </button>
                <button class="btn-nao" @click="confirmandoId = null">Não</button>
              </template>
              <button
                v-else
                class="btn-excluir"
                title="Excluir importação"
                @click="confirmandoId = imp.id"
              >
                <i class="pi pi-trash" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.25rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; }
.page-title { font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0 0 0.2rem; }
.page-sub { font-size: 13px; color: var(--color-text-muted); margin: 0; }

.card { background: var(--color-surface); border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }

.extrato-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.extrato-table th {
  text-align: left; padding: 0.7rem 1rem; background: var(--color-bg);
  font-size: 11px; font-weight: 600; color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border); white-space: nowrap;
}
.extrato-table td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--color-border); }
.extrato-table tbody tr:last-child td { border-bottom: none; }
.extrato-table tbody tr:hover td { background: var(--color-bg); }

.align-right { text-align: right !important; }
.muted { color: var(--color-text-muted); font-size: 12px; }
.data-cell { font-weight: 600; white-space: nowrap; }
.arquivo-cell { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-muted); }
.patrimonio-cell { font-weight: 600; color: var(--color-text); }

.status-badge {
  display: inline-block; padding: 2px 9px; border-radius: 99px;
  font-size: 11px; font-weight: 600;
}
.status-ok  { background: #e6faf5; color: #059669; }
.status-erro { background: #fdf2f2; color: var(--color-danger); }

.acoes-cell { text-align: right; white-space: nowrap; }

.btn-excluir {
  background: none; border: 1px solid var(--color-border); border-radius: 7px;
  color: var(--color-text-muted); cursor: pointer; padding: 0.3rem 0.5rem;
  font-size: 13px; transition: all 0.15s;
}
.btn-excluir:hover { border-color: var(--color-danger); color: var(--color-danger); }

.confirm-text { font-size: 12px; color: var(--color-text-muted); margin-right: 6px; }
.btn-sim, .btn-nao {
  padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 12px;
  font-family: inherit; cursor: pointer; border: none; margin-left: 4px;
}
.btn-sim { background: var(--color-danger); color: #fff; }
.btn-sim:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-nao { background: var(--color-bg); color: var(--color-text-muted); border: 1px solid var(--color-border); }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 240px; gap: 0.75rem; text-align: center;
  background: var(--color-surface); border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); color: var(--color-text-muted); font-size: 13px;
}
</style>
