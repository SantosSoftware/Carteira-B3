import type { AtivoImportado } from '@/services/b3Parser'

export interface AtivoCalculado extends AtivoImportado {
  preco_atual: number
  valor_investido: number
  rentabilidade_percentual: number
}

// Tipos excluídos dos cálculos de patrimônio (derivativos)
export const TIPOS_EXCLUIDOS_PATRIMONIO = ['Opcao'] as const

export function isDerivativo(tipo_ativo: string): boolean {
  return (TIPOS_EXCLUIDOS_PATRIMONIO as readonly string[]).includes(tipo_ativo)
}

/**
 * BrAPI cobre ações (PETR4), FII/ETF (XXXX11), BDR (*34/*35). Opções B3 usam
 * códigos longos (ex.: PETRE308) e retornam 404 — não devem ser consultados.
 */
export function tickerFormatoComCotacaoBrapi(ticker: string): boolean {
  const t = ticker.trim().toUpperCase()
  if (t.length < 7) return true
  if (/^[A-Z]{4}\d$/.test(t)) return true
  if (/^[A-Z]{4,6}11(B)?$/.test(t)) return true
  if (/^[A-Z]{4}(3[24]|35)$/.test(t)) return true
  return false
}

export function deveBuscarCotacaoBrapi(ativo: { tipo_ativo: string; ticker: string }): boolean {
  if (ativo.tipo_ativo === 'RendaFixa' || ativo.tipo_ativo === 'FundoInvestimento') return false
  if (isDerivativo(ativo.tipo_ativo)) return false
  return tickerFormatoComCotacaoBrapi(ativo.ticker)
}

export function calcularAtivo(ativo: AtivoImportado & { preco_atual?: number }): AtivoCalculado {
  const preco_atual     = ativo.preco_atual ?? ativo.valor_atual / (ativo.quantidade || 1)
  const valor_investido = ativo.quantidade * ativo.preco_medio
  const valor_atual     = ativo.quantidade * preco_atual

  const rentabilidade_percentual =
    valor_investido > 0 ? ((valor_atual - valor_investido) / valor_investido) * 100 : 0

  return { ...ativo, preco_atual, valor_investido, valor_atual, rentabilidade_percentual }
}

export function calcularPatrimonioTotal(ativos: AtivoCalculado[]): number {
  return ativos
    .filter((a) => !isDerivativo(a.tipo_ativo))
    .reduce((acc, a) => acc + a.valor_atual, 0)
}

export function calcularValorInvestido(ativos: AtivoCalculado[]): number {
  return ativos
    .filter((a) => !isDerivativo(a.tipo_ativo))
    .reduce((acc, a) => acc + a.valor_investido, 0)
}

export function calcularRentabilidadeGlobal(ativos: AtivoCalculado[]): number {
  const patrimonioTotal = calcularPatrimonioTotal(ativos)
  const valorInvestido  = calcularValorInvestido(ativos)
  if (valorInvestido === 0) return 0
  return ((patrimonioTotal - valorInvestido) / valorInvestido) * 100
}

export interface AlocacaoPorTipo {
  tipo: string
  valor: number
  percentual: number
}

export function calcularAlocacaoPorTipo(ativos: AtivoCalculado[]): AlocacaoPorTipo[] {
  // Derivativos não entram na alocação
  const ativosPatrimonio = ativos.filter((a) => !isDerivativo(a.tipo_ativo))
  const patrimonioTotal  = calcularPatrimonioTotal(ativosPatrimonio)
  const grupos: Record<string, number> = {}

  for (const ativo of ativosPatrimonio) {
    grupos[ativo.tipo_ativo] = (grupos[ativo.tipo_ativo] ?? 0) + ativo.valor_atual
  }

  return Object.entries(grupos).map(([tipo, valor]) => ({
    tipo,
    valor,
    percentual: patrimonioTotal > 0 ? (valor / patrimonioTotal) * 100 : 0,
  }))
}
