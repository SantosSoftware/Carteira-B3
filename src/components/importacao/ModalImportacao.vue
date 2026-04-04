<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { listarAbas, parsearPlanilhaB3 } from '@/services/b3Parser'
import { useImportacaoStore, type AtivoPreview } from '@/stores/importacao'
import { useCarteiraStore } from '@/stores/carteira'
import { useCotacaoStore } from '@/stores/cotacao'
import { useNegociacoesOpcaoStore } from '@/stores/negociacoesOpcao'
import { calcularAtivo, deveBuscarCotacaoBrapi } from '@/utils/calculos'
import { formatarData } from '@/utils/formatters'
import DropzoneUpload from './DropzoneUpload.vue'
import PreviewImportacao from './PreviewImportacao.vue'

const emit = defineEmits<{ fechar: [] }>()

const router        = useRouter()
const store         = useImportacaoStore()
const carteiraStore = useCarteiraStore()
const cotacaoStore  = useCotacaoStore()
const negociacoesOpcaoStore = useNegociacoesOpcaoStore()

store.reset()

// ── Passo 1: arquivo → listar abas ────────────────────────────────────────
async function onArquivo(file: File) {
  store.reset()
  store.nomeArquivo = file.name
  store.status      = 'lendo'

  try {
    const buffer        = await file.arrayBuffer()
    store.bufferArquivo = buffer
    const abas          = listarAbas(buffer)

    if (!abas.length) {
      store.setErro('Nenhuma aba com dados encontrada no arquivo.')
      return
    }

    store.abasDisponiveis = abas
    store.selecionarTodas()           // pré-seleciona todas
    store.status = 'selecionandoAba'
  } catch (e: unknown) {
    store.setErro(e instanceof Error ? e.message : 'Erro ao ler o arquivo.')
  }
}

// ── Passo 2: confirmar seleção → parsear todas + buscar cotações ──────────
const progressoAba = ref('')

async function processarSelecionadas() {
  if (!store.bufferArquivo || !store.totalSelecionadas) return

  store.status = 'buscandoCotacoes'

  const abasSel = store.abasDisponiveis.filter((a) =>
    store.isAbaSelecionada(a.nome),
  )

  const ativosPorAba: Record<string, AtivoPreview[]> = {}
  let todosOsTickers: string[] = []

  try {
    // 1. Parsear todas as abas selecionadas
    for (const aba of abasSel) {
      progressoAba.value = `Lendo "${aba.nome}"...`
      const { ativos, data_posicao } = parsearPlanilhaB3(store.bufferArquivo, aba.nome)
      if (!store.dataPosicao) store.dataPosicao = data_posicao

      // Ativos provisórios (sem preço atual ainda)
      ativosPorAba[aba.nome] = ativos.map((a) => ({
        ...a,
        preco_atual: 0,
        valor_investido: a.quantidade * a.preco_medio,
        rentabilidade_percentual: 0,
        _aba: aba.nome,
      }))

      const tickersDaAba = ativos.filter(deveBuscarCotacaoBrapi).map((a) => a.ticker)

      todosOsTickers = [...new Set([...todosOsTickers, ...tickersDaAba])]
    }

    // 2. Buscar cotações de todos os tickers de uma vez
    progressoAba.value = 'Buscando cotações...'
    await cotacaoStore.buscar(todosOsTickers)

    // 3. Calcular métricas com preços atualizados
    for (const [nomeAba, ativos] of Object.entries(ativosPorAba)) {
      ativosPorAba[nomeAba] = ativos.map((ativo) => {
        const precoAtual =
          cotacaoStore.getPreco(ativo.ticker) ??
          (ativo.quantidade > 0 ? ativo.valor_atual / ativo.quantidade : 0)
        const calc = calcularAtivo({ ...ativo, preco_atual: precoAtual })
        return { ...calc, preco_atual: precoAtual, _aba: ativo._aba }
      })
    }

    store.ativosPorAba   = ativosPorAba
    store.ativosPreview  = Object.values(ativosPorAba).flat()
    store.status         = 'preview'
    progressoAba.value   = ''
  } catch (e: unknown) {
    store.setErro(e instanceof Error ? e.message : 'Erro ao processar as abas selecionadas.')
    progressoAba.value = ''
  }
}

// ── Passo 3: confirmar → salvar uma importação por aba ────────────────────
const salvando     = ref(false)
const progressoSalvar = ref('')

async function confirmar() {
  if (!store.ativosPreview.length) return
  salvando.value = true
  store.status   = 'salvando'

  try {
    const abas = Object.keys(store.ativosPorAba)

    for (const nomeAba of abas) {
      progressoSalvar.value = `Salvando "${nomeAba}"...`
      await carteiraStore.salvarImportacao({
        nomeArquivo: `${store.nomeArquivo} — ${nomeAba}`,
        dataPosicao: store.dataPosicao,
        ativos:      store.ativosPorAba[nomeAba] ?? [],
      })
    }

    if (store.bufferArquivo && carteiraStore.carteira?.id) {
      progressoSalvar.value = 'Sincronizando negociações em opções…'
      try {
        await negociacoesOpcaoStore.sincronizarDoBuffer(
          carteiraStore.carteira.id,
          store.bufferArquivo,
          store.nomeArquivo,
        )
      } catch {
        /* erro já em negociacoesOpcaoStore.erro — custódia já foi salva */
      }
    }

    store.status = 'sucesso'
    setTimeout(() => { emit('fechar'); router.push('/extrato') }, 1200)
  } catch (e: unknown) {
    store.setErro(e instanceof Error ? e.message : 'Erro ao salvar importação.')
  } finally {
    salvando.value        = false
    progressoSalvar.value = ''
  }
}

function voltar() {
  if (store.bufferArquivo && store.abasDisponiveis.length) {
    store.status        = 'selecionandoAba'
    store.ativosPreview = []
    store.ativosPorAba  = {}
    store.erro          = null
  } else {
    store.reset()
  }
}

const todasSelecionadas = computed(
  () => store.totalSelecionadas > 0 && store.totalSelecionadas === store.abasDisponiveis.length,
)

// Cores e labels por tipo
const COR_TIPO: Record<string, string> = {
  Acao: '#6C3FC5', ETF: '#10B981', FII: '#F4A623',
  BDR: '#3B82F6', FundoInvestimento: '#8B5CF6',
  RendaFixa: '#F59E0B', Opcao: '#EF4444', Outro: '#94A3B8',
}
const LABEL_TIPO: Record<string, string> = {
  Acao: 'Ações', ETF: 'ETF', FII: 'FIIs', BDR: 'BDRs',
  FundoInvestimento: 'Fundos de Investimento',
  RendaFixa: 'Renda Fixa / Tesouro', Opcao: 'Opções', Outro: 'Outros',
}

// Resumo por aba no preview
const resumoPorAba = computed(() =>
  Object.entries(store.ativosPorAba).map(([nome, ativos]) => ({
    nome,
    count: ativos.length,
    tipo: ativos[0]?.tipo_ativo ?? 'Outro',
  })),
)
</script>

<template>
  <div class="modal-overlay" @click.self="emit('fechar')">
    <div class="modal-box">

      <!-- Cabeçalho -->
      <div class="modal-header">
        <div class="modal-header-left">
          <button
            v-if="['selecionandoAba', 'preview', 'erro'].includes(store.status)"
            class="btn-voltar"
            @click="voltar"
          >
            <i class="pi pi-arrow-left" />
          </button>
          <div>
            <h2 class="modal-title">Importar Posição B3</h2>
            <div class="steps">
              <span :class="['step', store.status !== 'idle' && store.status !== 'lendo' ? 'step--done' : 'step--active']">
                1. Arquivo
              </span>
              <i class="pi pi-chevron-right step-sep" />
              <span :class="['step', store.status === 'selecionandoAba' ? 'step--active' : ['buscandoCotacoes','preview','salvando','sucesso'].includes(store.status) ? 'step--done' : '']">
                2. Selecionar abas
              </span>
              <i class="pi pi-chevron-right step-sep" />
              <span :class="['step', ['preview','salvando','sucesso'].includes(store.status) ? 'step--active' : '']">
                3. Confirmar
              </span>
            </div>
          </div>
        </div>
        <button class="btn-fechar" @click="emit('fechar')">
          <i class="pi pi-times" />
        </button>
      </div>

      <!-- Corpo -->
      <div class="modal-body">

        <!-- idle -->
        <template v-if="store.status === 'idle'">
          <p class="modal-desc">
            Importe o <strong>Extrato de Custódia</strong> exportado pelo portal da B3 (<em>.xlsx</em>).
            Você poderá escolher quais abas importar.
          </p>
          <DropzoneUpload @arquivo="onArquivo" />
        </template>

        <!-- lendo -->
        <template v-else-if="store.status === 'lendo'">
          <div class="estado-loading">
            <i class="pi pi-spin pi-spinner loading-icon" />
            <p>Lendo <strong>{{ store.nomeArquivo }}</strong>...</p>
          </div>
        </template>

        <!-- selecionando abas -->
        <template v-else-if="store.status === 'selecionandoAba'">
          <div class="sel-header">
            <p class="modal-desc" style="margin:0">
              <strong>{{ store.abasDisponiveis.length }} abas</strong> encontradas em
              <strong>{{ store.nomeArquivo }}</strong>. Marque as que deseja importar:
            </p>
            <button
              class="btn-toggle-all"
              @click="todasSelecionadas ? store.limparSelecao() : store.selecionarTodas()"
            >
              {{ todasSelecionadas ? 'Desmarcar todas' : 'Selecionar todas' }}
            </button>
          </div>

          <div class="abas-grid">
            <label
              v-for="aba in store.abasDisponiveis"
              :key="aba.nome"
              class="aba-card"
              :class="{ 'aba-card--selecionada': store.isAbaSelecionada(aba.nome) }"
            >
              <input
                type="checkbox"
                class="aba-checkbox"
                :checked="store.isAbaSelecionada(aba.nome)"
                @change="store.toggleAba(aba.nome)"
              />
              <div
                class="aba-icone"
                :style="{ background: (COR_TIPO[aba.tipoDetectado] ?? '#94A3B8') + '22' }"
              >
                <i class="pi pi-table" :style="{ color: COR_TIPO[aba.tipoDetectado] ?? '#94A3B8' }" />
              </div>
              <div class="aba-info">
                <span class="aba-nome">{{ aba.nome }}</span>
                <span class="aba-meta">
                  {{ LABEL_TIPO[aba.tipoDetectado] ?? aba.tipoDetectado }}
                  · {{ aba.numLinhas }} linha{{ aba.numLinhas !== 1 ? 's' : '' }}
                </span>
              </div>
              <div
                class="aba-check-indicator"
                :class="{ checked: store.isAbaSelecionada(aba.nome) }"
              >
                <i class="pi pi-check" />
              </div>
            </label>
          </div>
        </template>

        <!-- buscando cotações -->
        <template v-else-if="store.status === 'buscandoCotacoes'">
          <div class="estado-loading">
            <i class="pi pi-spin pi-spinner loading-icon" />
            <p>{{ progressoAba || 'Processando...' }}</p>
            <div class="progresso-abas">
              <span
                v-for="aba in store.abasDisponiveis.filter(a => store.abasSelecionadas.includes(a.nome))"
                :key="aba.nome"
                class="progresso-badge"
              >
                {{ aba.nome }}
              </span>
            </div>
          </div>
        </template>

        <!-- preview -->
        <template v-else-if="store.status === 'preview'">
          <!-- Resumo por aba -->
          <div class="resumo-abas">
            <span
              v-for="r in resumoPorAba"
              :key="r.nome"
              class="resumo-badge"
              :style="{
                background: (COR_TIPO[r.tipo] ?? '#94A3B8') + '22',
                color: COR_TIPO[r.tipo] ?? '#94A3B8',
              }"
            >
              <i class="pi pi-table" />
              {{ r.nome }} ({{ r.count }})
            </span>
          </div>

          <PreviewImportacao
            :ativos="store.ativosPreview"
            :data-posicao="formatarData(store.dataPosicao)"
            :buscando-cotacoes="false"
          />

          <div v-if="cotacaoStore.erro" class="aviso-cotacao">
            <i class="pi pi-exclamation-triangle" />
            Cotações não disponíveis — usando valores da planilha.
          </div>
        </template>

        <!-- salvando -->
        <template v-else-if="store.status === 'salvando'">
          <div class="estado-loading">
            <i class="pi pi-spin pi-spinner loading-icon" />
            <p>{{ progressoSalvar || 'Salvando...' }}</p>
          </div>
        </template>

        <!-- sucesso -->
        <template v-else-if="store.status === 'sucesso'">
          <div class="estado-sucesso">
            <div class="sucesso-icon-wrap">
              <i class="pi pi-check sucesso-icon" />
            </div>
            <p>
              {{ Object.keys(store.ativosPorAba).length }} aba(s) importada(s) com sucesso!
            </p>
          </div>
        </template>

        <!-- erro -->
        <template v-else-if="store.status === 'erro'">
          <div class="estado-erro">
            <i class="pi pi-exclamation-circle erro-icon" />
            <p>{{ store.erro }}</p>
            <button class="btn-tentar-novamente" @click="voltar">Tentar novamente</button>
          </div>
        </template>

      </div>

      <!-- Rodapé -->
      <div class="modal-footer">
        <!-- Seleção de abas: botão Importar -->
        <template v-if="store.status === 'selecionandoAba'">
          <span class="footer-info">
            {{ store.totalSelecionadas }} aba(s) selecionada(s)
          </span>
          <button class="btn-cancelar" @click="emit('fechar')">Cancelar</button>
          <button
            class="btn-confirmar"
            :disabled="!store.totalSelecionadas"
            @click="processarSelecionadas"
          >
            <i class="pi pi-arrow-right" />
            Continuar
          </button>
        </template>

        <!-- Preview: botão Confirmar -->
        <template v-else-if="store.status === 'preview'">
          <span class="footer-info">
            {{ store.ativosPreview.length }} ativos no total
          </span>
          <button class="btn-cancelar" @click="emit('fechar')">Cancelar</button>
          <button class="btn-confirmar" :disabled="salvando" @click="confirmar">
            <i v-if="salvando" class="pi pi-spin pi-spinner" />
            <i v-else class="pi pi-check" />
            Confirmar Importação
          </button>
        </template>
      </div>

    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 500; padding: 1rem;
}
.modal-box {
  background: var(--color-surface); border-radius: 18px;
  width: 100%; max-width: 860px; max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 12px 48px rgba(0,0,0,0.18); overflow: hidden;
}

/* Header */
.modal-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 1.1rem 1.5rem; border-bottom: 1px solid var(--color-border); flex-shrink: 0;
}
.modal-header-left { display: flex; align-items: flex-start; gap: 0.6rem; }
.modal-title { font-size: 16px; font-weight: 600; color: var(--color-text); margin: 0 0 4px; }
.steps { display: flex; align-items: center; gap: 4px; }
.step { font-size: 11px; color: var(--color-text-muted); }
.step--active { color: var(--color-primary); font-weight: 600; }
.step--done   { color: var(--color-accent); }
.step-sep { font-size: 9px; color: var(--color-border); }

.btn-fechar {
  background: none; border: none; cursor: pointer; color: var(--color-text-muted);
  font-size: 16px; padding: 0.3rem; border-radius: 6px; transition: color 0.15s;
  line-height: 1; flex-shrink: 0;
}
.btn-fechar:hover { color: var(--color-danger); }
.btn-voltar {
  background: none; border: 1px solid var(--color-border); cursor: pointer;
  color: var(--color-text-muted); font-size: 13px; padding: 0.3rem 0.5rem;
  border-radius: 7px; transition: all 0.15s; line-height: 1; flex-shrink: 0; margin-top: 2px;
}
.btn-voltar:hover { border-color: var(--color-primary); color: var(--color-primary); }

/* Body */
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
.modal-desc { font-size: 13px; color: var(--color-text-muted); margin: 0 0 1.25rem; line-height: 1.6; }

/* Seleção de abas */
.sel-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap;
}
.btn-toggle-all {
  font-size: 12px; color: var(--color-primary); background: none; border: none;
  cursor: pointer; font-family: inherit; padding: 0; white-space: nowrap;
  text-decoration: underline; text-underline-offset: 2px;
}
.btn-toggle-all:hover { opacity: 0.75; }

.abas-grid { display: flex; flex-direction: column; gap: 0.5rem; }

.aba-card {
  display: flex; align-items: center; gap: 0.9rem;
  padding: 0.8rem 1rem; border: 1.5px solid var(--color-border);
  border-radius: 12px; background: var(--color-bg);
  cursor: pointer; width: 100%; transition: all 0.15s;
}
.aba-card:hover { border-color: var(--color-primary); background: #f3eeff; }
.aba-card--selecionada { border-color: var(--color-primary); background: #f3eeff; }

.aba-checkbox { display: none; } /* usamos o label inteiro como toggle */

.aba-icone {
  width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.aba-info  { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.aba-nome  { font-size: 14px; font-weight: 600; color: var(--color-text); }
.aba-meta  { font-size: 12px; color: var(--color-text-muted); }

.aba-check-indicator {
  width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--color-border);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.15s;
  color: transparent; font-size: 11px;
}
.aba-check-indicator.checked {
  background: var(--color-primary); border-color: var(--color-primary); color: #fff;
}

/* Loading */
.estado-loading {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 3rem 1rem; gap: 1rem;
  color: var(--color-text-muted); font-size: 14px; text-align: center;
}
.loading-icon { font-size: 32px; color: var(--color-primary); }

.progresso-abas { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 0.25rem; }
.progresso-badge {
  font-size: 11px; padding: 2px 9px; border-radius: 99px;
  background: #ede9f8; color: var(--color-primary); font-weight: 500;
}

/* Resumo no preview */
.resumo-abas {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 0.75rem;
}
.resumo-badge {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 600;
}

/* Sucesso */
.estado-sucesso {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 3rem 1rem; gap: 1rem;
  color: var(--color-text); font-size: 15px; font-weight: 500;
}
.sucesso-icon-wrap {
  width: 60px; height: 60px; border-radius: 50%;
  background: #e6faf5; display: flex; align-items: center; justify-content: center;
}
.sucesso-icon { font-size: 28px; color: var(--color-accent); }

/* Erro */
.estado-erro {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 2.5rem 1rem; gap: 0.75rem; text-align: center;
}
.erro-icon { font-size: 36px; color: var(--color-danger); }
.estado-erro p { font-size: 14px; color: var(--color-text); max-width: 380px; line-height: 1.6; margin: 0; }
.btn-tentar-novamente {
  margin-top: 0.5rem; padding: 0.5rem 1.25rem; background: none;
  border: 1px solid var(--color-border); border-radius: 8px; font-size: 13px;
  font-family: inherit; cursor: pointer; color: var(--color-text); transition: all 0.15s;
}
.btn-tentar-novamente:hover { border-color: var(--color-primary); color: var(--color-primary); }

/* Aviso cotação */
.aviso-cotacao {
  display: flex; align-items: center; gap: 0.5rem; font-size: 12px;
  color: #92400e; background-color: #fef3c7; border: 1px solid #fde68a;
  border-radius: 8px; padding: 0.6rem 0.9rem; margin-top: 0.75rem;
}

/* Footer */
.modal-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;
  padding: 1rem 1.5rem; border-top: 1px solid var(--color-border); flex-shrink: 0;
  min-height: 64px;
}
.footer-info { flex: 1; font-size: 12px; color: var(--color-text-muted); }
.btn-cancelar {
  padding: 0.5rem 1.25rem; background: none; border: 1px solid var(--color-border);
  border-radius: 9px; font-size: 14px; font-family: inherit; cursor: pointer;
  color: var(--color-text-muted); transition: all 0.15s;
}
.btn-cancelar:hover { border-color: var(--color-text-muted); color: var(--color-text); }
.btn-confirmar {
  display: flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1.4rem;
  background-color: var(--color-primary); color: #fff; border: none;
  border-radius: 9px; font-size: 14px; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: background 0.15s;
}
.btn-confirmar:hover:not(:disabled) { background-color: var(--color-primary-hover); }
.btn-confirmar:disabled { opacity: 0.65; cursor: not-allowed; }
</style>
