import { computed } from 'vue'
import { useCarteiraStore } from '@/stores/carteira'
import { useCotacaoStore } from '@/stores/cotacao'
import {
  calcularAtivo,
  calcularPatrimonioTotal,
  calcularRentabilidadeGlobal,
  calcularAlocacaoPorTipo,
  deveBuscarCotacaoBrapi,
  type AtivoCalculado,
} from '@/utils/calculos'

/**
 * Mescla preços do cache da BrAPI sobre as posições da carteira (Supabase)
 * para exibir valor atual e rentabilidade alinhados às cotações ao vivo.
 */
export function useAtivosComCotacao() {
  const carteira = useCarteiraStore()
  const cotacao = useCotacaoStore()

  const ativosComCotacao = computed((): AtivoCalculado[] => {
    return carteira.ativos.map((a) => {
      if (!deveBuscarCotacaoBrapi(a)) return a
      const p = cotacao.getPreco(a.ticker)
      if (p === null) return a
      return calcularAtivo({ ...a, preco_atual: p })
    })
  })

  const patrimonioB3ComCotacao = computed(() =>
    calcularPatrimonioTotal(ativosComCotacao.value),
  )

  const rentabilidadeGlobalComCotacao = computed(() =>
    calcularRentabilidadeGlobal(ativosComCotacao.value),
  )

  const alocacaoPorTipoComCotacao = computed(() =>
    calcularAlocacaoPorTipo(ativosComCotacao.value),
  )

  return {
    ativosComCotacao,
    patrimonioB3ComCotacao,
    rentabilidadeGlobalComCotacao,
    alocacaoPorTipoComCotacao,
  }
}
