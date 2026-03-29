import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import type { ProventoParseado } from '@/services/proventosParser'

export interface Provento {
  id: string
  carteira_id: string
  ticker: string
  nome_ativo: string | null
  tipo_provento: 'Dividendo' | 'JCP' | 'Rendimento'
  tipo_ativo: 'Acao' | 'FII' | 'ETF' | 'Outro'
  data_pagamento: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  instituicao: string | null
  created_at: string
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export const useProventosStore = defineStore('proventos', () => {
  const proventos  = ref<Provento[]>([])
  const carregando = ref(false)
  const anoFiltro  = ref(new Date().getFullYear())

  // ── Filtrado pelo ano selecionado ───────────────────────────────────────
  const proventosAno = computed(() =>
    proventos.value.filter((p) => p.data_pagamento.startsWith(String(anoFiltro.value))),
  )

  // ── Totais ───────────────────────────────────────────────────────────────
  const totalAno = computed(() =>
    proventosAno.value.reduce((s, p) => s + p.valor_total, 0),
  )

  const totalAcoes = computed(() =>
    proventosAno.value
      .filter((p) => p.tipo_ativo === 'Acao')
      .reduce((s, p) => s + p.valor_total, 0),
  )

  const totalFIIs = computed(() =>
    proventosAno.value
      .filter((p) => p.tipo_ativo === 'FII')
      .reduce((s, p) => s + p.valor_total, 0),
  )

  const totalETFs = computed(() =>
    proventosAno.value
      .filter((p) => p.tipo_ativo === 'ETF')
      .reduce((s, p) => s + p.valor_total, 0),
  )

  const mediasMensais = computed(() => {
    const meses = proventosAno.value.map((p) => p.data_pagamento.slice(0, 7))
    const mesesUnicos = [...new Set(meses)].sort()
    const soma = mesesUnicos.reduce((s, m) => {
      return s + proventosAno.value.filter((p) => p.data_pagamento.startsWith(m)).reduce((acc, p) => acc + p.valor_total, 0)
    }, 0)
    return mesesUnicos.length ? soma / mesesUnicos.length : 0
  })

  // ── Dados para o gráfico mensal ─────────────────────────────────────────
  const graficoPorMes = computed(() => {
    const mapa: Record<string, { acoes: number; fiis: number; etfs: number; outros: number }> = {}

    for (let m = 1; m <= 12; m++) {
      const key = `${anoFiltro.value}-${String(m).padStart(2, '0')}`
      mapa[key] = { acoes: 0, fiis: 0, etfs: 0, outros: 0 }
    }

    for (const p of proventosAno.value) {
      const key = p.data_pagamento.slice(0, 7)
      if (!mapa[key]) continue
      if (p.tipo_ativo === 'Acao')  mapa[key].acoes  += p.valor_total
      else if (p.tipo_ativo === 'FII') mapa[key].fiis += p.valor_total
      else if (p.tipo_ativo === 'ETF') mapa[key].etfs += p.valor_total
      else                             mapa[key].outros += p.valor_total
    }

    return {
      labels: MESES,
      acoes:  Object.values(mapa).map((v) => parseFloat(v.acoes.toFixed(2))),
      fiis:   Object.values(mapa).map((v) => parseFloat(v.fiis.toFixed(2))),
      etfs:   Object.values(mapa).map((v) => parseFloat(v.etfs.toFixed(2))),
      outros: Object.values(mapa).map((v) => parseFloat(v.outros.toFixed(2))),
    }
  })

  // ── Top pagadores ────────────────────────────────────────────────────────
  const topPagadores = computed(() => {
    const mapa: Record<string, { ticker: string; nome: string; tipo_ativo: string; total: number; ocorrencias: number }> = {}
    for (const p of proventosAno.value) {
      if (!mapa[p.ticker]) {
        mapa[p.ticker] = { ticker: p.ticker, nome: p.nome_ativo ?? p.ticker, tipo_ativo: p.tipo_ativo, total: 0, ocorrencias: 0 }
      }
      const entry = mapa[p.ticker]!
      entry.total += p.valor_total
      entry.ocorrencias++
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total).slice(0, 8)
  })

  // ── Anos disponíveis ─────────────────────────────────────────────────────
  const anosDisponiveis = computed(() => {
    const anos = new Set(proventos.value.map((p) => parseInt(p.data_pagamento.slice(0, 4))))
    const atual = new Date().getFullYear()
    anos.add(atual)
    return [...anos].sort((a, b) => b - a)
  })

  // ── Supabase ─────────────────────────────────────────────────────────────
  async function carregar(carteiraId: string) {
    carregando.value = true
    try {
      const { data } = await supabase
        .from('proventos')
        .select('*')
        .eq('carteira_id', carteiraId)
        .order('data_pagamento', { ascending: false })
      proventos.value = data ?? []
    } finally {
      carregando.value = false
    }
  }

  async function importar(carteiraId: string, itens: ProventoParseado[]) {
    if (!itens.length) return 0

    const registros = itens.map((p) => ({ ...p, carteira_id: carteiraId }))

    // Upsert: evita duplicatas pelo mesmo ticker+tipo+data+instituição+valor
    const { error } = await supabase
      .from('proventos')
      .insert(registros)

    if (error) throw error

    await carregar(carteiraId)
    return itens.length
  }

  async function excluirTodos(carteiraId: string) {
    const { error } = await supabase
      .from('proventos')
      .delete()
      .eq('carteira_id', carteiraId)
    if (error) throw error
    proventos.value = []
  }

  async function excluirPorImportacao(carteiraId: string, dataInicio: string, dataFim: string) {
    const { error } = await supabase
      .from('proventos')
      .delete()
      .eq('carteira_id', carteiraId)
      .gte('data_pagamento', dataInicio)
      .lte('data_pagamento', dataFim)
    if (error) throw error
    await carregar(carteiraId)
  }

  return {
    proventos, carregando, anoFiltro,
    proventosAno, totalAno, totalAcoes, totalFIIs, totalETFs, mediasMensais,
    graficoPorMes, topPagadores, anosDisponiveis,
    carregar, importar, excluirTodos, excluirPorImportacao,
  }
})
