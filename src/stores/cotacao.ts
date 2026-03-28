import { defineStore } from 'pinia'
import { ref } from 'vue'
import { buscarCotacoes } from '@/services/brapi'

const TTL_MS = 5 * 60 * 1000 // 5 minutos

interface CacheEntry {
  preco: number
  variacaoDia: number
  nome: string
  timestamp: number
}

export const useCotacaoStore = defineStore('cotacao', () => {
  const cache = ref<Record<string, CacheEntry>>({})
  const carregando = ref(false)
  const erro = ref<string | null>(null)

  function isCacheValido(ticker: string): boolean {
    const entry = cache.value[ticker]
    if (!entry) return false
    return Date.now() - entry.timestamp < TTL_MS
  }

  async function buscar(tickers: string[]): Promise<void> {
    const tickersParaBuscar = tickers.filter((t) => !isCacheValido(t))
    if (!tickersParaBuscar.length) return

    carregando.value = true
    erro.value = null

    try {
      const resultados = await buscarCotacoes(tickersParaBuscar)
      for (const r of resultados) {
        cache.value[r.ticker] = {
          preco: r.preco,
          variacaoDia: r.variacaoDia,
          nome: r.nome,
          timestamp: Date.now(),
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao buscar cotações'
      erro.value = msg
      console.warn('[cotacaoStore]', msg)
    } finally {
      carregando.value = false
    }
  }

  function getPreco(ticker: string): number | null {
    return cache.value[ticker]?.preco ?? null
  }

  function getVariacaoDia(ticker: string): number | null {
    return cache.value[ticker]?.variacaoDia ?? null
  }

  return { cache, carregando, erro, buscar, getPreco, getVariacaoDia }
})
