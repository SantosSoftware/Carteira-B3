const BASE_URL = 'https://brapi.dev/api'
const token = import.meta.env.VITE_BRAPI_TOKEN as string | undefined

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

export async function buscarCotacoes(tickers: string[]): Promise<CotacaoResult[]> {
  if (!tickers.length) return []

  const params = new URLSearchParams()
  if (token) params.set('token', token)

  const url = `${BASE_URL}/quote/${tickers.join(',')}?${params}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`brapi.dev retornou status ${response.status}`)
  }

  const data = await response.json()
  const results = data.results as Array<{
    symbol: string
    regularMarketPrice: number
    regularMarketChangePercent: number
    shortName: string
  }>

  return results.map((r) => ({
    ticker: r.symbol,
    preco: r.regularMarketPrice ?? 0,
    variacaoDia: r.regularMarketChangePercent ?? 0,
    nome: r.shortName ?? r.symbol,
  }))
}
