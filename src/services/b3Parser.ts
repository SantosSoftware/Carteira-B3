import * as XLSX from 'xlsx'

export interface AtivoImportado {
  ticker: string
  nome_ativo: string
  tipo_ativo: string
  quantidade: number
  preco_medio: number
  valor_atual: number
}

export interface ResultadoParser {
  ativos: AtivoImportado[]
  data_posicao: string
}

export interface AbaInfo {
  nome: string
  tipoDetectado: string
  numLinhas: number
}

// Mapeamento nome da aba → tipo interno
// A busca é feita por .includes(), então "extrato de ações" vai bater em "ações"
const TIPO_POR_ABA: Record<string, string> = {
  'ações':                   'Acao',
  'acoes':                   'Acao',
  'acao':                    'Acao',
  'bovespa':                 'Acao',   // formato antigo B3
  'acoes a vista':           'Acao',
  'etf':                     'ETF',
  'fundo de indice':         'ETF',
  'fundo de índice':         'ETF',
  'bdr':                     'BDR',
  'brazilian depositary':    'BDR',
  'fii':                     'FII',
  'fundos imobiliários':     'FII',
  'fundos imobiliarios':     'FII',
  'fundo imobiliário':       'FII',
  'fundo imobiliario':       'FII',
  'fundo de investimento':   'FundoInvestimento',
  'fundos de investimento':  'FundoInvestimento',
  'opções':                  'Opcao',
  'opcoes':                  'Opcao',
  'derivativos':             'Opcao',
  'renda fixa':              'RendaFixa',
  'tesouro direto':          'RendaFixa',
  'tesouro':                 'RendaFixa',
}

const COLUMN_MAP: Record<string, string[]> = {
  ticker:     ['código de negociação', 'codigo de negociacao', 'ticker', 'código', 'codigo',
               'código do ativo', 'nome resumido'],
  nome_ativo: ['produto', 'nome', 'ativo', 'nome do ativo', 'descrição', 'descricao',
               'nome do investimento'],
  tipo_ativo: ['tipo', 'tipo de ativo', 'classe', 'tipo do ativo'],
  quantidade: ['quantidade', 'qtd', 'quantidade disponível', 'quantidade disponivel',
               'qtde disponível', 'qtde disponivel'],
  preco_medio:['preço médio', 'preco medio', 'custo médio', 'custo medio', 'pm',
               'preço médio de compra', 'preco medio de compra', 'custo médio de compra'],
  valor_atual:['valor atualizado', 'valor atual', 'saldo', 'valor de mercado',
               'valor bruto', 'valor financeiro'],
}

const TIPO_MAP: Record<string, string> = {
  acao:                    'Acao',
  'ações':                 'Acao',
  acoes:                   'Acao',
  fii:                     'FII',
  'fundo imobiliário':     'FII',
  'fundo imobiliario':     'FII',
  bdr:                     'BDR',
  etf:                     'ETF',
  'fundo de investimento': 'FundoInvestimento',
  'fundo invest':          'FundoInvestimento',
  opcao:                   'Opcao',
  'opções':                'Opcao',
  'renda fixa':            'RendaFixa',
  tesouro:                 'RendaFixa',
  cdb:                     'RendaFixa',
  lci:                     'RendaFixa',
  lca:                     'RendaFixa',
  cri:                     'RendaFixa',
  cra:                     'RendaFixa',
  debenture:               'RendaFixa',
  debênture:               'RendaFixa',
}

function normalizarChave(str: string): string {
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function resolverColuna(headers: string[], candidatos: string[]): string | null {
  const normHeaders = headers.map(normalizarChave)
  for (const candidato of candidatos) {
    const idx = normHeaders.indexOf(normalizarChave(candidato))
    if (idx !== -1) return headers[idx] ?? null
  }
  return null
}

function inferirTipoPorTicker(ticker: string): string | null {
  // Ações BR: 4 letras + 1 dígito (PETR4, VALE3, ITUB4...)
  // BDR: 4 letras + 34 ou 32 (AAPL34, MSFT32...)
  // FII: 4 letras + 11 (KNRI11, HGLG11...)
  // ETF: 4-6 letras + 11 (BOVA11, IVVB11, SMAL11...)

  const t = ticker.trim().toUpperCase()

  if (/^[A-Z]{4}(3[24]|35)$/.test(t)) return 'BDR'
  if (/^[A-Z]{4,6}11[B]?$/.test(t)) {
    // ETFs comuns da B3
    const etfsConhecidos = ['BOVA11','SMAL11','IVVB11','XFIX11','SPXI11','GOLD11',
      'DIVO11','FIND11','MATB11','ISUS11','TECK11','HASH11']
    if (etfsConhecidos.includes(t)) return 'ETF'
    return 'FII' // 11 sem ser ETF conhecido → provavelmente FII
  }
  if (/^[A-Z]{3,4}[0-9]$/.test(t)) return 'Acao'

  return null
}

function resolverTipo(valor: string, tipoForcado?: string, ticker?: string): string {
  if (tipoForcado) return tipoForcado

  const chave = normalizarChave(valor)
  for (const [k, v] of Object.entries(TIPO_MAP)) {
    if (chave.includes(normalizarChave(k))) return v
  }

  // Fallback: infere pelo padrão do ticker
  if (ticker) {
    const inferido = inferirTipoPorTicker(ticker)
    if (inferido) return inferido
  }

  return 'Outro'
}

function parsearNumero(valor: unknown): number {
  if (typeof valor === 'number') return valor
  if (typeof valor === 'string') {
    const limpo = valor.replace(/\./g, '').replace(',', '.').trim()
    const num = parseFloat(limpo)
    return isNaN(num) ? 0 : num
  }
  return 0
}

function tipoDetectadoPorNomeAba(nomeAba: string): string | undefined {
  const norm = normalizarChave(nomeAba)
  // Busca da chave mais longa para a mais curta (evita match prematuro)
  const chaves = Object.keys(TIPO_POR_ABA).sort((a, b) => b.length - a.length)
  for (const k of chaves) {
    if (norm.includes(normalizarChave(k))) return TIPO_POR_ABA[k]
  }
  return undefined
}

function numLinhasAba(workbook: XLSX.WorkBook, nomeAba: string): number {
  const sheet = workbook.Sheets[nomeAba]
  if (!sheet || !sheet['!ref']) return 0
  const range = XLSX.utils.decode_range(sheet['!ref'])
  return range.e.r
}

/** Lista todas as abas do arquivo com metadados */
export function listarAbas(buffer: ArrayBuffer): AbaInfo[] {
  const workbook = XLSX.read(buffer, { type: 'array' })

  return workbook.SheetNames
    .map((nome) => ({
      nome,
      tipoDetectado: tipoDetectadoPorNomeAba(nome) ?? 'Outro',
      numLinhas: Math.max(0, numLinhasAba(workbook, nome) - 1), // -1 header
    }))
    .filter((a) => a.numLinhas > 0) // só abas com dados
}

/** Parseia uma aba específica do arquivo */
export function parsearPlanilhaB3(buffer: ArrayBuffer, nomeAba?: string): ResultadoParser {
  const workbook = XLSX.read(buffer, { type: 'array' })

  // Se não especificou aba, usa a primeira com dados
  const sheetName: string = nomeAba
    ?? workbook.SheetNames.find((n) => numLinhasAba(workbook, n) > 2)
    ?? workbook.SheetNames[0]
    ?? ''

  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new Error(`Aba "${sheetName}" não encontrada no arquivo.`)
  }

  // Tipo forçado pelo nome da aba (ex: aba "ETF" → tipo 'ETF')
  const tipoForcado = tipoDetectadoPorNomeAba(sheetName)

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!, { defval: '' })

  if (!rows.length) {
    throw new Error(`A aba "${sheetName}" está vazia ou não contém dados reconhecíveis.`)
  }

  const firstRow = rows[0]
  const headers = firstRow ? Object.keys(firstRow) : []

  const colMap: Record<string, string | null> = {}
  for (const [campo, candidatos] of Object.entries(COLUMN_MAP)) {
    colMap[campo] = resolverColuna(headers, candidatos)
  }

  // Para Renda Fixa/Tesouro, 'ticker' pode não existir — usa nome_ativo como fallback
  const camposObrigatorios = tipoForcado === 'RendaFixa'
    ? ['quantidade']
    : ['ticker', 'quantidade']

  const camposFaltando = camposObrigatorios.filter((campo) => colMap[campo] === null)

  if (camposFaltando.length) {
    throw new Error(
      `Colunas obrigatórias não encontradas na aba "${sheetName}": ${camposFaltando.join(', ')}. ` +
      'Verifique se o arquivo é o Extrato de Custódia da B3.',
    )
  }

  const ativos: AtivoImportado[] = []

  for (const row of rows) {
    const quantidade = parsearNumero(row[colMap.quantidade!])
    if (quantidade <= 0) continue

    // Ticker: usa coluna específica ou gera a partir do nome
    const tickerRaw = colMap.ticker
      ? String(row[colMap.ticker] ?? '').trim().toUpperCase()
      : ''
    const nomeRaw = colMap.nome_ativo
      ? String(row[colMap.nome_ativo] ?? '').trim()
      : ''

    // Para ativos sem código de negociação (Tesouro, Renda Fixa, Fundos),
    // gera um ticker normalizado a partir do nome para evitar duplicatas
    const ticker = tickerRaw
      || normalizarChave(nomeRaw)
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
          .toUpperCase()
          .slice(0, 40) // limita o tamanho
    if (!ticker) continue

    const preco_medio = colMap.preco_medio ? parsearNumero(row[colMap.preco_medio]) : 0
    const valor_atual = colMap.valor_atual ? parsearNumero(row[colMap.valor_atual]) : 0
    const nome_ativo = nomeRaw || ticker
    const tipo_raw   = colMap.tipo_ativo ? String(row[colMap.tipo_ativo] ?? '') : ''
    const tipo_ativo = resolverTipo(tipo_raw, tipoForcado, ticker)

    ativos.push({ ticker, nome_ativo, tipo_ativo, quantidade, preco_medio, valor_atual })
  }

  if (!ativos.length) {
    throw new Error(`Nenhum ativo válido encontrado na aba "${sheetName}".`)
  }

  return {
    ativos,
    data_posicao: new Date().toISOString().substring(0, 10),
  }
}
