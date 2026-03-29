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
        <h1 class="page-title">Importações</h1>
        <p class="page-sub">Gerencie as planilhas importadas da B3</p>
      </div>
      <button class="btn-importar" @click="modalAberto = true">
        <i class="pi pi-upload" />
        Importar Planilha
      </button>
    </div>

    <!-- Card de instrução -->
    <div class="instrucao-card">
      <div class="instrucao-icon">
        <i class="pi pi-info-circle" />
      </div>
      <div>
        <p class="instrucao-titulo">Como exportar o arquivo da B3</p>
        <p class="instrucao-desc">
          Acesse o portal da B3 → <strong>Extrato de Custódia</strong> → escolha a data de referência →
          clique em <strong>Exportar</strong> e salve o arquivo <em>.xlsx</em>. Em seguida, clique em
          "Importar Planilha" acima.
        </p>
      </div>
    </div>

    <!-- Dropzone inline -->
    <div class="dropzone-cta" @click="modalAberto = true">
      <i class="pi pi-upload dropzone-icon" />
      <p class="dropzone-titulo">Arraste ou clique para importar</p>
      <p class="dropzone-sub">Formatos aceitos: <strong>.xlsx</strong></p>
    </div>

    <!-- Histórico -->
    <div v-if="store.importacoes.length" class="card">
      <h3 class="section-title">Histórico de Importações</h3>
      <div class="importacoes-lista">
        <div
          v-for="imp in store.importacoes"
          :key="imp.id"
          class="importacao-item"
        >
          <div class="item-icone">
            <i class="pi pi-file-excel" />
          </div>
          <div class="item-info">
            <span class="item-arquivo">{{ imp.nome_arquivo }}</span>
            <span class="item-meta">
              Posição: {{ formatarData(imp.data_posicao) }} ·
              Patrimônio:
              <strong>{{ store.patrimoniosPorImportacao[imp.id] !== undefined
                ? formatarMoeda(store.patrimoniosPorImportacao[imp.id] ?? 0)
                : '—' }}</strong>
            </span>
          </div>
          <span class="item-status" :class="`status-${imp.status}`">
            {{ imp.status === 'ok' ? 'Sucesso' : 'Erro' }}
          </span>
          <div class="item-acoes">
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
              class="btn-del"
              @click="confirmandoId = imp.id"
            >
              <i class="pi pi-trash" />
            </button>
          </div>
        </div>
      </div>
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

.card { background: var(--color-surface); border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 1.5rem; }
.section-title { font-size: 12px; font-weight: 500; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 1rem; }

.importacoes-lista { display: flex; flex-direction: column; gap: 0.75rem; }

.importacao-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.85rem 1rem; border: 1px solid var(--color-border);
  border-radius: 10px; background: var(--color-bg);
}
.item-icone {
  width: 36px; height: 36px; border-radius: 9px; background: #e6faf5;
  display: flex; align-items: center; justify-content: center;
  color: #059669; font-size: 16px; flex-shrink: 0;
}
.item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.item-arquivo { font-size: 13px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-meta { font-size: 12px; color: var(--color-text-muted); }

.item-status { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 99px; white-space: nowrap; }
.status-ok   { background: #e6faf5; color: #059669; }
.status-erro { background: #fdf2f2; color: var(--color-danger); }

.item-acoes { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.btn-del {
  background: none; border: 1px solid var(--color-border); border-radius: 7px;
  color: var(--color-text-muted); cursor: pointer; padding: 0.3rem 0.5rem;
  font-size: 13px; transition: all 0.15s;
}
.btn-del:hover { border-color: var(--color-danger); color: var(--color-danger); }

.confirm-text { font-size: 12px; color: var(--color-text-muted); }
.btn-sim, .btn-nao {
  padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 12px;
  font-family: inherit; cursor: pointer; border: none;
}
.btn-sim { background: var(--color-danger); color: #fff; }
.btn-sim:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-nao { background: var(--color-bg); color: var(--color-text-muted); border: 1px solid var(--color-border); }
</style>
