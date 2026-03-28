import * as XLSX from 'xlsx'

export type TipoProvento = 'Dividendo' | 'JCP' | 'Rendimento'
export type TipoAtivoProvento = 'Acao' | 'FII' | 'ETF' | 'Outro'

export interface ProventoParseado {
  ticker: string
  nome_ativo: string
  tipo_provento: TipoProvento
  tipo_ativo: TipoAtivoProvento
  data_pagamento: string   // ISO: YYYY-MM-DD
  quantidade: number
  valor_unitario: number
  valor_total: number
  instituicao: string
}

// Tipos de movimentação que representam proventos (exclui Resgate e outros)
const TIPOS_PROVENTO: Record<string, TipoProvento> = {
  'dividendo':                   'Dividendo',
  'rendimento':                  'Rendimento',
  'juros sobre capital próprio': 'JCP',
  'juros sobre capital proprio': 'JCP',
}

function inferirTipoAtivo(ticker: string, nomeProduto: string): TipoAtivoProvento {
  const nome = nomeProduto.toUpperCase()
  const t    = ticker.toUpperCase()

  // FII: nome contém "FII" ou "FDO INV IMOB"
  if (nome.includes('FII') || nome.includes('FDO INV IMOB') || nome.includes('FUNDO DE INVESTIMENTO IMOBILIÁRIO')) {
    return 'FII'
  }
  // ETF: nome contém "FUNDO DE ÍNDICE", "INDEX", "ETF", "BUENA VISTA" (SPYI11) etc.
  if (nome.includes('ÍNDICE') || nome.includes('INDICE') || nome.includes('INDEX') || nome.includes('ETF') || nome.includes('FUNDO DE') && t.endsWith('11')) {
    return 'ETF'
  }
  // Termina em 11 mas não identificado como FII → ETF
  if (/\d{2}$/.test(t) && t.endsWith('11')) {
    return 'ETF'
  }
  // Padrão de ação brasileira: 4 letras + 1-2 dígitos
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) {
    return 'Acao'
  }
  return 'Outro'
}

function parsearData(dataBr: string): string {
  // Formato esperado: "DD/MM/YYYY"
  const [dia, mes, ano] = dataBr.split('/')
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
}

function extrairTicker(produto: string): { ticker: string; nome: string } {
  // Formato: "TICKER - NOME DA EMPRESA"
  const idx = produto.indexOf(' - ')
  if (idx > 0) {
    return {
      ticker: produto.slice(0, idx).trim().toUpperCase(),
      nome:   produto.slice(idx + 3).trim(),
    }
  }
  return { ticker: produto.trim().toUpperCase(), nome: produto.trim() }
}

export function parsearProventos(buffer: ArrayBuffer): ProventoParseado[] {
  const wb   = XLSX.read(buffer, { type: 'array' })
  const ws   = wb.Sheets['Movimentação'] ?? wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })

  if (!rows.length) return []

  // Linha 0 = cabeçalho
  const dados = rows.slice(1) as Array<[string, string, string, string, string, number, number, number]>

  const proventos: ProventoParseado[] = []

  for (const row of dados) {
    const [entradaSaida, data, movimentacao, produto, instituicao, quantidade, valorUnitario, valorTotal] = row

    // Somente créditos
    if (!entradaSaida || String(entradaSaida).toLowerCase() !== 'credito') continue

    const movKey = String(movimentacao).toLowerCase().trim()
    const tipoProvento = TIPOS_PROVENTO[movKey]

    // Ignora tipos que não são proventos (ex: Resgate, Transferência)
    if (!tipoProvento) continue

    // Ignora linhas sem produto ou valor
    if (!produto || !valorTotal || Number(valorTotal) <= 0) continue

    const { ticker, nome } = extrairTicker(String(produto))
    const tipoAtivo = inferirTipoAtivo(ticker, String(produto))

    proventos.push({
      ticker,
      nome_ativo:     nome,
      tipo_provento:  tipoProvento,
      tipo_ativo:     tipoAtivo,
      data_pagamento: parsearData(String(data)),
      quantidade:     Number(quantidade) || 0,
      valor_unitario: Number(valorUnitario) || 0,
      valor_total:    Number(valorTotal),
      instituicao:    String(instituicao).trim(),
    })
  }

  // Ordena por data decrescente
  return proventos.sort((a, b) => b.data_pagamento.localeCompare(a.data_pagamento))
}
