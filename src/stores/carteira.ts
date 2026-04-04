import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import {
  calcularAtivo,
  calcularPatrimonioTotal,
  calcularValorInvestido,
  calcularRentabilidadeGlobal,
  calcularAlocacaoPorTipo,
  type AtivoCalculado,
} from '@/utils/calculos'

export interface Carteira {
  id: string
  nome: string
  created_at: string
}

export interface Importacao {
  id: string
  carteira_id: string
  nome_arquivo: string
  data_posicao: string
  status: string
  created_at: string
}

export const useCarteiraStore = defineStore('carteira', () => {
  const carteira = ref<Carteira | null>(null)
  const importacoes = ref<Importacao[]>([])
  const ativos = ref<AtivoCalculado[]>([])
  const patrimoniosPorImportacao = ref<Record<string, number>>({})
  const carregando = ref(false)

  const patrimonioTotal = computed(() => calcularPatrimonioTotal(ativos.value))
  const valorInvestido = computed(() => calcularValorInvestido(ativos.value))
  const rentabilidadeGlobal = computed(() => calcularRentabilidadeGlobal(ativos.value))
  const alocacaoPorTipo = computed(() => calcularAlocacaoPorTipo(ativos.value))

  const importacaoMaisRecente = computed(() =>
    importacoes.value.length
      ? [...importacoes.value].sort((a, b) => b.data_posicao.localeCompare(a.data_posicao))[0]
      : null,
  )

  // Patrimônio agrupado por data (soma todas as importações do mesmo dia)
  // Usado pelo gráfico de histórico
  const historicoPatrimonio = computed(() => {
    const mapa: Record<string, number> = {}
    for (const [id, valor] of Object.entries(patrimoniosPorImportacao.value)) {
      const imp = importacoes.value.find((i) => i.id === id)
      if (imp) mapa[imp.data_posicao] = (mapa[imp.data_posicao] ?? 0) + valor
    }
    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, patrimonio]) => ({ data, patrimonio }))
  })

  async function carregarCarteira(userId: string) {
    carregando.value = true

    let { data: carteiraData } = await supabase
      .from('carteiras')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!carteiraData) {
      const { data: nova } = await supabase
        .from('carteiras')
        .insert({ user_id: userId, nome: 'Minha Carteira' })
        .select()
        .single()
      carteiraData = nova
    }

    carteira.value = carteiraData

    if (carteiraData?.id) {
      await carregarImportacoes(carteiraData.id)
    }

    carregando.value = false
  }

  async function carregarImportacoes(carteiraId: string) {
    const { data } = await supabase
      .from('importacoes')
      .select('*')
      .eq('carteira_id', carteiraId)
      .order('data_posicao', { ascending: false })

    importacoes.value = data ?? []

    if (importacoes.value.length) {
      // Mescla posições de todas as importações: import mais recente (created_at)
      // vence em caso de mesmo ticker+tipo; importações parciais continuam somando ativos.
      const ids = importacoes.value.map((i) => i.id)
      await carregarPosicoesMultiplas(ids)
      await carregarPatrimoniosPorImportacao(ids)
    }
  }

  async function carregarPatrimoniosPorImportacao(ids: string[]) {
    const { data } = await supabase
      .from('posicoes')
      .select('importacao_id, valor_atual')
      .in('importacao_id', ids)

    const mapa: Record<string, number> = {}
    for (const row of data ?? []) {
      mapa[row.importacao_id] = (mapa[row.importacao_id] ?? 0) + (row.valor_atual ?? 0)
    }
    patrimoniosPorImportacao.value = mapa
  }

  async function carregarPosicoesMultiplas(ids: string[]) {
    const { data } = await supabase
      .from('posicoes')
      .select('*')
      .in('importacao_id', ids)

    const mapaImport = new Map(importacoes.value.map((i) => [i.id, i]))

    // Ordenar: importação mais recente (created_at) primeiro; depois posição mais recente.
    const ordenadas = [...(data ?? [])].sort((a, b) => {
      const ca = mapaImport.get(a.importacao_id)?.created_at ?? ''
      const cb = mapaImport.get(b.importacao_id)?.created_at ?? ''
      const cmp = cb.localeCompare(ca)
      if (cmp !== 0) return cmp
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })

    // Deduplicar por ticker+tipo: mantém a primeira ocorrência (= import mais recente com aquele ativo)
    const vistos = new Set<string>()
    const posicoesSemDuplicata = ordenadas.filter((p) => {
      const chave = `${p.ticker}__${p.tipo_ativo}`
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })

    ativos.value = posicoesSemDuplicata.map((p) =>
      calcularAtivo({
        ticker:      p.ticker,
        nome_ativo:  p.nome_ativo,
        tipo_ativo:  p.tipo_ativo,
        quantidade:  p.quantidade,
        preco_medio: p.preco_medio,
        valor_atual: p.valor_atual,
        preco_atual: p.preco_atual,
      }),
    )
  }

  async function carregarPosicoes(importacaoId: string) {
    await carregarPosicoesMultiplas([importacaoId])
  }

  async function salvarImportacao(params: {
    nomeArquivo: string
    dataPosicao: string
    ativos: AtivoCalculado[]
  }) {
    if (!carteira.value) throw new Error('Carteira não carregada')

    const { data: importacao, error: errImportacao } = await supabase
      .from('importacoes')
      .insert({
        carteira_id: carteira.value.id,
        nome_arquivo: params.nomeArquivo,
        data_posicao: params.dataPosicao,
        status: 'ok',
      })
      .select()
      .single()

    if (errImportacao) throw errImportacao

    const posicoes = params.ativos.map((a) => ({
      importacao_id: importacao.id,
      carteira_id: carteira.value!.id,
      ticker: a.ticker,
      nome_ativo: a.nome_ativo,
      tipo_ativo: a.tipo_ativo,
      quantidade: a.quantidade,
      preco_medio: a.preco_medio,
      preco_atual: (a as AtivoCalculado).preco_atual,
      valor_investido: a.valor_investido,
      valor_atual: a.valor_atual,
      rentabilidade_percentual: a.rentabilidade_percentual,
      data_posicao: params.dataPosicao,
    }))

    const { error: errPosicoes } = await supabase.from('posicoes').insert(posicoes)
    if (errPosicoes) throw errPosicoes

    await carregarImportacoes(carteira.value!.id)
  }

  async function excluirImportacao(importacaoId: string) {
    await supabase.from('posicoes').delete().eq('importacao_id', importacaoId)
    await supabase.from('importacoes').delete().eq('id', importacaoId)
    if (carteira.value) await carregarImportacoes(carteira.value.id)
  }

  return {
    carteira,
    importacoes,
    ativos,
    patrimoniosPorImportacao,
    carregando,
    patrimonioTotal,
    valorInvestido,
    rentabilidadeGlobal,
    alocacaoPorTipo,
    importacaoMaisRecente,
    historicoPatrimonio,
    carregarCarteira,
    carregarImportacoes,
    carregarPosicoes,
    salvarImportacao,
    excluirImportacao,
  }
})
