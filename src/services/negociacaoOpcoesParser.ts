import * as XLSX from 'xlsx'

export interface NegociacaoOpcaoLinha {
  data_negocio: string // ISO date YYYY-MM-DD
  tipo_movimentacao: 'Compra' | 'Venda'
  mercado: string
  codigo_negociacao: string
  ticker_base: string
  quantidade: number
  preco: number
  valor: number
  prazo_vencimento: string | null
  instituicao: string | null
}

export interface ResultadoParseNegociacaoOpcoes {
  linhasOpcoes: NegociacaoOpcaoLinha[]
  totalLinhasArquivo: number
  nomeAba: string
}

function semAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizarChave(str: string): string {
  return semAcentos(str.toString().toLowerCase().trim())
}

/** Primeiros 4 caracteres do código (subjacente típico B3). */
export function tickerBase(codigo: string): string {
  const t = codigo.trim().toUpperCase()
  if (t.length <= 4) return t
  return t.slice(0, 4)
}

function mercadoEhOpcao(mercado: string): boolean {
  return semAcentos(mercado).includes('opcao')
}

function parsearDataBr(s: string): string | null {
  const t = String(s ?? '').trim()
  if (!t || t === '-') return null
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = m[1]!.padStart(2, '0')
  const mo = m[2]!.padStart(2, '0')
  const y = m[3]!
  return `${y}-${mo}-${d}`
}

function parsearNumero(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  if (typeof valor === 'string') {
    const limpo = valor.replace(/\./g, '').replace(',', '.').trim()
    const num = parseFloat(limpo)
    return Number.isNaN(num) ? 0 : num
  }
  return 0
}

function resolverColuna(headers: string[], candidatos: string[]): string | null {
  const norm = headers.map(normalizarChave)
  for (const c of candidatos) {
    const i = norm.indexOf(normalizarChave(c))
    if (i !== -1) return headers[i] ?? null
  }
  return null
}

/**
 * Lê a planilha de negociação B3 e retorna apenas linhas cujo Mercado indica opções.
 */
export function parsearNegociacaoOpcoes(buffer: ArrayBuffer): ResultadoParseNegociacaoOpcoes {
  const workbook = XLSX.read(buffer, { type: 'array' })

  const nomeAba =
    workbook.SheetNames.find((n) => normalizarChave(n).includes('negociacao')) ??
    workbook.SheetNames[0] ??
    ''

  const sheet = workbook.Sheets[nomeAba]
  if (!sheet) {
    throw new Error('Nenhuma aba encontrada no arquivo.')
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const totalLinhasArquivo = rows.length

  if (!rows.length) {
    return { linhasOpcoes: [], totalLinhasArquivo: 0, nomeAba }
  }

  const headers = Object.keys(rows[0] ?? {})
  const colData = resolverColuna(headers, ['Data do Negócio', 'Data do negocio'])
  const colTipo = resolverColuna(headers, ['Tipo de Movimentação', 'Tipo de movimentacao'])
  const colMercado = resolverColuna(headers, ['Mercado'])
  const colCodigo = resolverColuna(headers, ['Código de Negociação', 'Codigo de Negociacao'])
  const colQtd = resolverColuna(headers, ['Quantidade'])
  const colPreco = resolverColuna(headers, ['Preço', 'Preco'])
  const colValor = resolverColuna(headers, ['Valor'])
  const colPrazo = resolverColuna(headers, ['Prazo/Vencimento', 'Prazo/vencimento'])
  const colInst = resolverColuna(headers, ['Instituição', 'Instituicao'])

  if (!colMercado || !colCodigo || !colTipo) {
    throw new Error(
      'Colunas obrigatórias não encontradas (Mercado, Código de Negociação, Tipo de Movimentação).',
    )
  }

  const linhasOpcoes: NegociacaoOpcaoLinha[] = []

  for (const row of rows) {
    const mercado = String(row[colMercado] ?? '')
    if (!mercadoEhOpcao(mercado)) continue

    const codigo = String(row[colCodigo] ?? '').trim()
    if (!codigo) continue

    const tipoRaw = String(row[colTipo] ?? '').trim()
    const tipoLower = normalizarChave(tipoRaw)
    let tipo_movimentacao: 'Compra' | 'Venda'
    if (tipoLower.startsWith('compra')) tipo_movimentacao = 'Compra'
    else if (tipoLower.startsWith('venda')) tipo_movimentacao = 'Venda'
    else continue

    const dataStr = colData ? String(row[colData] ?? '') : ''
    const dataIso = parsearDataBr(dataStr)
    if (!dataIso) continue

    const quantidade = colQtd ? parsearNumero(row[colQtd]) : 0
    const preco = colPreco ? parsearNumero(row[colPreco]) : 0
    const valor = colValor ? parsearNumero(row[colValor]) : 0
    const prazo = colPrazo ? String(row[colPrazo] ?? '').trim() : ''
    const inst = colInst ? String(row[colInst] ?? '').trim() : ''

    linhasOpcoes.push({
      data_negocio: dataIso,
      tipo_movimentacao,
      mercado,
      codigo_negociacao: codigo,
      ticker_base: tickerBase(codigo),
      quantidade,
      preco,
      valor,
      prazo_vencimento: prazo && prazo !== '-' ? prazo : null,
      instituicao: inst || null,
    })
  }

  return { linhasOpcoes, totalLinhasArquivo, nomeAba }
}
