<script setup lang="ts">
import { ref } from 'vue'
import { useCarteiraStore } from '@/stores/carteira'
import { formatarMoeda, formatarData } from '@/utils/formatters'
import ModalImportacao from '@/components/importacao/ModalImportacao.vue'

const store = useCarteiraStore()
const modalAberto = ref(false)
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
        <h1 class="page-title">Extrato de importações</h1>
        <p class="page-sub">{{ store.importacoes.length }} importação(ões) registrada(s)</p>
      </div>
      <button class="btn-importar" type="button" @click="modalAberto = true">
        <i class="pi pi-upload" />
        Importar planilha
      </button>
    </div>

    <div class="instrucao-card">
      <div class="instrucao-icon">
        <i class="pi pi-info-circle" />
      </div>
      <div>
        <p class="instrucao-titulo">Extrato completo da B3</p>
        <p class="instrucao-desc">
          No portal B3: <strong>Extrato de Custódia</strong> → data de referência → <strong>Exportar</strong> (<em>.xlsx</em>).
          Envie o arquivo aqui: o sistema importa as abas de posição e, no mesmo arquivo, a aba
          <strong>Negociação</strong> para alimentar a tela <strong>Derivativos</strong> (opções).
          Várias importações são <strong>unidas</strong> na carteira: para cada ativo, vale a linha da importação mais recente.
        </p>
      </div>
    </div>

    <div class="dropzone-cta" role="button" tabindex="0" @click="modalAberto = true" @keydown.enter.prevent="modalAberto = true">
      <i class="pi pi-upload dropzone-icon" />
      <p class="dropzone-titulo">Arraste ou clique para importar</p>
      <p class="dropzone-sub">Formatos aceitos: <strong>.xlsx</strong></p>
    </div>

    <div v-if="!store.importacoes.length" class="empty-state">
      <i class="pi pi-file" style="font-size:32px;color:var(--color-border)" />
      <p>Nenhuma importação ainda. Use o botão acima ou a área tracejada.</p>
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
                ? formatarMoeda(store.patrimoniosPorImportacao[imp.id] ?? 0)
                : '—' }}
            </td>
            <td class="align-right muted">
              {{ formatarData(imp.created_at.substring(0, 10)) }}
            </td>
            <td class="acoes-cell">
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

    <ModalImportacao v-if="modalAberto" @fechar="modalAberto = false" />
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.25rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.page-title { font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0 0 0.2rem; }
.page-sub { font-size: 13px; color: var(--color-text-muted); margin: 0; }

.btn-importar {
  display: flex; align-items: center; gap: 0.4rem;
  background-color: var(--color-primary); color: #fff; border: none;
  border-radius: 9px; padding: 0.5rem 1.1rem; font-size: 14px;
  font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.15s;
}
.btn-importar:hover { background-color: var(--color-primary-hover); }

.instrucao-card {
  display: flex; align-items: flex-start; gap: 1rem;
  background: #f3eeff; border: 1px solid #d4c5f0;
  border-radius: 12px; padding: 1rem 1.25rem;
}
.instrucao-icon { color: var(--color-primary); font-size: 18px; flex-shrink: 0; margin-top: 2px; }
.instrucao-titulo { font-size: 13px; font-weight: 600; color: var(--color-primary); margin: 0 0 0.25rem; }
.instrucao-desc { font-size: 12px; color: #4a3080; margin: 0; line-height: 1.6; }

.dropzone-cta {
  border: 2px dashed var(--color-border); border-radius: 14px;
  padding: 2rem; text-align: center; cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
}
.dropzone-cta:hover { border-color: var(--color-primary); background: #f3eeff; }
.dropzone-icon { font-size: 28px; color: var(--color-primary); margin-bottom: 0.25rem; }
.dropzone-titulo { font-size: 15px; font-weight: 600; color: var(--color-text); margin: 0; }
.dropzone-sub { font-size: 12px; color: var(--color-text-muted); margin: 0; }

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
  min-height: 120px; gap: 0.75rem; text-align: center;
  background: var(--color-surface); border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); color: var(--color-text-muted); font-size: 13px;
}
</style>
