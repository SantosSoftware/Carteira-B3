import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { parsearNegociacaoOpcoes, type NegociacaoOpcaoLinha } from '@/services/negociacaoOpcoesParser'

export interface NegociacaoOpcaoRegistro extends NegociacaoOpcaoLinha {
  id: string
  nome_arquivo: string | null
  created_at: string
}

export const useNegociacoesOpcaoStore = defineStore('negociacoesOpcao', () => {
  const linhas = ref<NegociacaoOpcaoRegistro[]>([])
  const carregando = ref(false)
  const erro = ref<string | null>(null)
  const ultimaImportacao = ref<{ totalArquivo: number; opcoes: number; nomeAba: string } | null>(null)

  async function carregar(carteiraId: string): Promise<void> {
    carregando.value = true
    erro.value = null
    try {
      const { data, error: err } = await supabase
        .from('negociacoes_opcao')
        .select('*')
        .eq('carteira_id', carteiraId)
        .order('data_negocio', { ascending: false })

      if (err) throw err

      linhas.value = (data ?? []).map((row) => ({
        id: row.id,
        data_negocio: row.data_negocio,
        tipo_movimentacao: row.tipo_movimentacao as 'Compra' | 'Venda',
        mercado: row.mercado,
        codigo_negociacao: row.codigo_negociacao,
        ticker_base: row.ticker_base,
        quantidade: Number(row.quantidade),
        preco: Number(row.preco ?? 0),
        valor: Number(row.valor),
        prazo_vencimento: row.prazo_vencimento,
        instituicao: row.instituicao,
        nome_arquivo: row.nome_arquivo,
        created_at: row.created_at,
      }))
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Erro ao carregar negociações em opções.'
      erro.value = msg
      console.warn('[negociacoesOpcao]', msg)
    } finally {
      carregando.value = false
    }
  }

  async function importarSubstituindo(
    arquivo: File,
    carteiraId: string,
  ): Promise<{ totalArquivo: number; opcoes: number; nomeAba: string }> {
    const buffer = await arquivo.arrayBuffer()
    const { linhasOpcoes, totalLinhasArquivo, nomeAba } = parsearNegociacaoOpcoes(buffer)

    carregando.value = true
    erro.value = null

    try {
      const { error: delErr } = await supabase
        .from('negociacoes_opcao')
        .delete()
        .eq('carteira_id', carteiraId)

      if (delErr) throw delErr

      if (linhasOpcoes.length) {
        const payload = linhasOpcoes.map((l) => ({
          carteira_id: carteiraId,
          data_negocio: l.data_negocio,
          tipo_movimentacao: l.tipo_movimentacao,
          mercado: l.mercado,
          codigo_negociacao: l.codigo_negociacao,
          ticker_base: l.ticker_base,
          quantidade: l.quantidade,
          preco: l.preco,
          valor: l.valor,
          prazo_vencimento: l.prazo_vencimento,
          instituicao: l.instituicao,
          nome_arquivo: arquivo.name,
        }))

        const { error: insErr } = await supabase.from('negociacoes_opcao').insert(payload)
        if (insErr) throw insErr
      }

      ultimaImportacao.value = {
        totalArquivo: totalLinhasArquivo,
        opcoes: linhasOpcoes.length,
        nomeAba,
      }

      await carregar(carteiraId)

      return {
        totalArquivo: totalLinhasArquivo,
        opcoes: linhasOpcoes.length,
        nomeAba,
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Erro ao importar arquivo de negociação.'
      erro.value = msg
      throw e
    } finally {
      carregando.value = false
    }
  }

  function limparEstado() {
    linhas.value = []
    ultimaImportacao.value = null
    erro.value = null
  }

  return {
    linhas,
    carregando,
    erro,
    ultimaImportacao,
    carregar,
    importarSubstituindo,
    limparEstado,
  }
})
