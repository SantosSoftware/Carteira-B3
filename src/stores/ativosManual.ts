import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'

export type Categoria = 'PrevidenciaPrivada' | 'Caixa' | 'Dolar' | 'Crypto' | 'Outro'
export type Moeda = 'BRL' | 'USD'

export interface AtivoManual {
  id: string
  carteira_id: string
  nome: string
  categoria: Categoria
  simbolo: string | null
  moeda: Moeda
  observacao: string | null
  ativo: boolean
  created_at: string
  // Calculado no client (lançamento mais recente)
  valor_atual?: number
  data_ultimo_lancamento?: string
}

export interface LancamentoManual {
  id: string
  ativo_manual_id: string
  carteira_id: string
  valor: number          // valor na moeda do ativo (USD ou BRL)
  cotacao_usd: number | null  // cotação BRL por 1 USD no dia do lançamento
  data_lancamento: string
  observacao: string | null
  created_at: string
  // Calculado no cliente
  valor_brl?: number
}

export const CATEGORIAS: { value: Categoria; label: string; icone: string; cor: string }[] = [
  { value: 'PrevidenciaPrivada', label: 'Previdência Privada', icone: 'pi pi-shield',     cor: '#6C3FC5' },
  { value: 'Caixa',             label: 'Saldo em Caixa',      icone: 'pi pi-wallet',      cor: '#3B82F6' },
  { value: 'Dolar',             label: 'Dólar / Câmbio',      icone: 'pi pi-dollar',      cor: '#10B981' },
  { value: 'Crypto',            label: 'Criptomoedas',        icone: 'pi pi-chart-pie',   cor: '#F59E0B' },
  { value: 'Outro',             label: 'Outros',              icone: 'pi pi-box',         cor: '#94A3B8' },
]

const CATEGORIA_FALLBACK = { value: 'Outro' as Categoria, label: 'Outros', icone: 'pi pi-box', cor: '#94A3B8' }

export function getCategoriaInfo(cat: Categoria) {
  return CATEGORIAS.find((c) => c.value === cat) ?? CATEGORIA_FALLBACK
}

export const useAtivosManualStore = defineStore('ativosManual', () => {
  const ativos      = ref<AtivoManual[]>([])
  const lancamentos = ref<Record<string, LancamentoManual[]>>({}) // por ativo_manual_id
  const carregando  = ref(false)

  const totalPorCategoria = computed(() => {
    const mapa: Record<string, number> = {}
    for (const ativo of ativos.value) {
      if (!ativo.ativo) continue
      const cat = ativo.categoria
      mapa[cat] = (mapa[cat] ?? 0) + (ativo.valor_atual ?? 0)
    }
    return mapa
  })

  const totalGeral = computed(() =>
    ativos.value
      .filter((a) => a.ativo)
      .reduce((s, a) => s + (a.valor_atual ?? 0), 0),
  )

  async function carregar(carteiraId: string) {
    carregando.value = true
    try {
      // Busca ativos + lançamento mais recente de cada um
      const { data: ativosData } = await supabase
        .from('ativos_manuais')
        .select('*')
        .eq('carteira_id', carteiraId)
        .order('created_at', { ascending: true })

      if (!ativosData?.length) {
        ativos.value = []
        carregando.value = false
        return
      }

      // Busca o lançamento mais recente de cada ativo
      const ids = ativosData.map((a) => a.id)
      const { data: lancData } = await supabase
        .from('lancamentos_manuais')
        .select('*')
        .in('ativo_manual_id', ids)
        .order('data_lancamento', { ascending: false })

      // Mapeia lançamentos por ativo, adicionando valor_brl calculado
      const lancMap: Record<string, LancamentoManual[]> = {}
      for (const rawL of lancData ?? []) {
        const ativoRef = ativosData.find((a) => a.id === rawL.ativo_manual_id)
        const l: LancamentoManual = {
          ...rawL,
          valor_brl: ativoRef?.moeda === 'USD' && rawL.cotacao_usd
            ? rawL.valor * rawL.cotacao_usd
            : rawL.valor,
        }
        const bucket = lancMap[l.ativo_manual_id]
        if (!bucket) {
          lancMap[l.ativo_manual_id] = [l]
        } else {
          bucket.push(l)
        }
      }
      lancamentos.value = lancMap

      // Enriquece ativos com valor atual (converte USD → BRL se necessário)
      ativos.value = ativosData.map((a) => {
        const hist = lancMap[a.id] ?? []
        const ultimo = hist[0] // já ordenado desc por data
        const valorBRL = ultimo
          ? a.moeda === 'USD' && ultimo.cotacao_usd
            ? ultimo.valor * ultimo.cotacao_usd
            : ultimo.valor
          : 0
        return {
          ...a,
          valor_atual:            valorBRL,
          data_ultimo_lancamento: ultimo?.data_lancamento ?? null,
        }
      })
    } finally {
      carregando.value = false
    }
  }

  async function criarAtivo(carteiraId: string, dados: Omit<AtivoManual, 'id' | 'carteira_id' | 'created_at' | 'valor_atual' | 'data_ultimo_lancamento'>) {
    const { data, error } = await supabase
      .from('ativos_manuais')
      .insert({ ...dados, carteira_id: carteiraId })
      .select()
      .single()
    if (error) throw error
    await carregar(carteiraId)
    return data
  }

  async function editarAtivo(id: string, carteiraId: string, dados: Partial<AtivoManual>) {
    const { error } = await supabase
      .from('ativos_manuais')
      .update(dados)
      .eq('id', id)
    if (error) throw error
    await carregar(carteiraId)
  }

  async function excluirAtivo(id: string, carteiraId: string) {
    const { error } = await supabase
      .from('ativos_manuais')
      .delete()
      .eq('id', id)
    if (error) throw error
    await carregar(carteiraId)
  }

  async function adicionarLancamento(
    ativoManualId: string,
    carteiraId: string,
    dados: { valor: number; data_lancamento: string; cotacao_usd?: number | null; observacao?: string | null },
  ) {
    const { error } = await supabase
      .from('lancamentos_manuais')
      .insert({ ...dados, ativo_manual_id: ativoManualId, carteira_id: carteiraId })
    if (error) throw error
    await carregar(carteiraId)
  }

  async function excluirLancamento(lancamentoId: string, carteiraId: string) {
    const { error } = await supabase
      .from('lancamentos_manuais')
      .delete()
      .eq('id', lancamentoId)
    if (error) throw error
    await carregar(carteiraId)
  }

  return {
    ativos, lancamentos, carregando,
    totalPorCategoria, totalGeral,
    carregar, criarAtivo, editarAtivo, excluirAtivo,
    adicionarLancamento, excluirLancamento,
  }
})
