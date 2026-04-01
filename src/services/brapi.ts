const BASE_URL = 'https://brapi.dev/api'
const token = import.meta.env.VITE_BRAPI_TOKEN as string | undefined

/** Pausa entre requisições de cotação (um ticker por chamada) para reduzir risco de rate limit. */
const PAUSA_ENTRE_REQUISICOES_MS = 150

export async function buscarCotacaoUSD(): Promise<number> {
  const params = new URLSearchParams({ currency: 'USD-BRL' })
  if (token) params.set('token', token)
  const response = await fetch(`${BASE_URL}/v2/currency?${params}`)
  if (!response.ok) throw new Error(`Erro ao buscar câmbio: ${response.status}`)
  const data = await response.json()
  const bid = data?.currency?.[0]?.bidPrice
  if (!bid) throw new Error('Cotação USD/BRL não encontrada.')
  return parseFloat(bid)
}

export interface CotacaoResult {
  ticker: string
  preco: number
  variacaoDia: number
  nome: string
}

type QuoteRow = {
  symbol: string
  regularMarketPrice: number
  regularMarketChangePercent: number
  shortName: string
}

function parseUmResultado(r: QuoteRow): CotacaoResult {
  return {
    ticker: r.symbol,
    preco: r.regularMarketPrice ?? 0,
    variacaoDia: r.regularMarketChangePercent ?? 0,
    nome: r.shortName ?? r.symbol,
  }
}

export async function buscarCotacoes(tickers: string[]): Promise<CotacaoResult[]> {
  if (!tickers.length) return []

  const unicos = [...new Set(tickers.map((t) => t.trim()).filter(Boolean))]
  const params = new URLSearchParams()
  if (token) params.set('token', token)

  const resultados: CotacaoResult[] = []

  for (let i = 0; i < unicos.length; i++) {
    const ticker = unicos[i]
    if (!ticker) continue

    const url = `${BASE_URL}/quote/${encodeURIComponent(ticker)}?${params}`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.warn(`[brapi] ${ticker}: status ${response.status}`)
        continue
      }
      const data = await response.json()
      const rows = data.results as QuoteRow[] | undefined
      const first = rows?.[0]
      if (!first) {
        console.warn(`[brapi] ${ticker}: sem resultados`)
        continue
      }
      resultados.push(parseUmResultado(first))
    } catch (e) {
      console.warn(`[brapi] ${ticker}:`, e)
    }

    if (i < unicos.length - 1 && PAUSA_ENTRE_REQUISICOES_MS > 0) {
      await new Promise((r) => setTimeout(r, PAUSA_ENTRE_REQUISICOES_MS))
    }
  }

  if (resultados.length === 0 && unicos.length > 0) {
    throw new Error('brapi.dev não retornou cotações para nenhum ativo')
  }

  return resultados
}
