import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AtivoImportado, AbaInfo } from '@/services/b3Parser'

export type StatusImportacao =
  | 'idle'
  | 'lendo'
  | 'selecionandoAba'
  | 'buscandoCotacoes'
  | 'preview'
  | 'salvando'
  | 'sucesso'
  | 'erro'

export interface AtivoPreview extends AtivoImportado {
  preco_atual: number
  valor_investido: number
  rentabilidade_percentual: number
  _aba?: string // aba de origem (para salvar separado por importação)
}

export const useImportacaoStore = defineStore('importacao', () => {
  const status        = ref<StatusImportacao>('idle')
  const nomeArquivo   = ref('')
  const dataPosicao   = ref('')
  const ativosPreview = ref<AtivoPreview[]>([])
  const erro          = ref<string | null>(null)

  // Seleção de abas (multi)
  const abasDisponiveis  = ref<AbaInfo[]>([])
  const abasSelecionadas = ref<string[]>([])
  const bufferArquivo    = ref<ArrayBuffer | null>(null)

  // Ativos agrupados por aba (para salvar uma importação por aba)
  const ativosPorAba = ref<Record<string, AtivoPreview[]>>({})

  const totalSelecionadas = computed(() => abasSelecionadas.value.length)

  function isAbaSelecionada(nome: string) {
    return abasSelecionadas.value.includes(nome)
  }

  function toggleAba(nome: string) {
    const idx = abasSelecionadas.value.indexOf(nome)
    if (idx === -1) {
      abasSelecionadas.value = [...abasSelecionadas.value, nome]
    } else {
      abasSelecionadas.value = abasSelecionadas.value.filter((n) => n !== nome)
    }
  }

  function selecionarTodas() {
    abasSelecionadas.value = abasDisponiveis.value.map((a) => a.nome)
  }

  function limparSelecao() {
    abasSelecionadas.value = []
  }

  function reset() {
    status.value           = 'idle'
    nomeArquivo.value      = ''
    dataPosicao.value      = ''
    ativosPreview.value    = []
    erro.value             = null
    abasDisponiveis.value  = []
    abasSelecionadas.value = []
    bufferArquivo.value    = null
    ativosPorAba.value     = {}
  }

  function setErro(msg: string) {
    erro.value   = msg
    status.value = 'erro'
  }

  return {
    status, nomeArquivo, dataPosicao, ativosPreview, erro,
    abasDisponiveis, abasSelecionadas, totalSelecionadas,
    bufferArquivo, ativosPorAba,
    isAbaSelecionada, toggleAba, selecionarTodas, limparSelecao, reset, setErro,
  }
})
