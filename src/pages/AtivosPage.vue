<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCarteiraStore } from '@/stores/carteira'
import { useCotacaoStore } from '@/stores/cotacao'
import BadgeTipoAtivo from '@/components/ui/BadgeTipoAtivo.vue'
import { formatarMoeda, formatarNumero, sinalPercentual } from '@/utils/formatters'
import { isDerivativo } from '@/utils/calculos'
import type { AtivoCalculado } from '@/utils/calculos'

const store = useCarteiraStore()
const cotacaoStore = useCotacaoStore()

const filtroTipo = ref('Todos')
const busca = ref('')
const colOrdem = ref<keyof AtivoCalculado>('valor_atual')
const ordemAsc = ref(false)
const atualizando = ref(false)

const TIPOS = computed(() => {
  const set = new Set(store.ativos.map((a) => a.tipo_ativo))
  return ['Todos', ...Array.from(set)]
})

const ativosFiltrados = computed(() => {
  let lista = store.ativos

  if (filtroTipo.value !== 'Todos') {
    lista = lista.filter((a) => a.tipo_ativo === filtroTipo.value)
  }

  if (busca.value.trim()) {
    const q = busca.value.trim().toUpperCase()
    lista = lista.filter(
      (a) => a.ticker.includes(q) || a.nome_ativo.toUpperCase().includes(q),
    )
  }

  return [...lista].sort((a, b) => {
    const va = a[colOrdem.value] as number | string
    const vb = b[colOrdem.value] as number | string
    if (va < vb) return ordemAsc.value ? -1 : 1
    if (va > vb) return ordemAsc.value ? 1 : -1
    return 0
  })
})

const temOpcoes = computed(() =>
  store.ativos.some((a) => isDerivativo(a.tipo_ativo)),
)

const totaisFiltrados = computed(() => {
  const lista = ativosFiltrados.value
  if (!lista.length) return null

  // Derivativos não somam nos totais da linha de resumo
  const listaPatrimonio = lista.filter((a) => !isDerivativo(a.tipo_ativo))
  const valorInvestido  = listaPatrimonio.reduce((s, a) => s + a.valor_investido, 0)
  const valorAtual      = listaPatrimonio.reduce((s, a) => s + a.valor_atual, 0)
  const rentabilidade   = valorInvestido > 0 ? ((valorAtual - valorInvestido) / valorInvestido) * 100 : 0
  const temDerivativo   = lista.some((a) => isDerivativo(a.tipo_ativo))

  return { valorInvestido, valorAtual, rentabilidade, temDerivativo }
})

const mostrarTotais = computed(
  () => filtroTipo.value !== 'Todos' || busca.value.trim() !== '',
)

function ordenarPor(col: keyof AtivoCalculado) {
  if (colOrdem.value === col) {
    ordemAsc.value = !ordemAsc.value
  } else {
    colOrdem.value = col
    ordemAsc.value = false
  }
}

function iconeOrdem(col: keyof AtivoCalculado) {
  if (colOrdem.value !== col) return 'pi pi-sort'
  return ordemAsc.value ? 'pi pi-sort-up' : 'pi pi-sort-down'
}

async function atualizarCotacoes() {
  atualizando.value = true
  const tickers = store.ativos
    .filter((a) => a.tipo_ativo !== 'RendaFixa')
    .map((a) => a.ticker)

  // Limpa cache para forçar rebusca
  for (const t of tickers) delete cotacaoStore.cache[t]
  await cotacaoStore.buscar(tickers)
  atualizando.value = false
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Ativos</h1>
        <p class="page-sub">{{ store.ativos.length }} ativos na posição mais recente</p>
      </div>
      <button class="btn-atualizar" :disabled="atualizando" @click="atualizarCotacoes">
        <i :class="atualizando ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" />
        Atualizar Cotações
      </button>
    </div>

    <!-- Filtros -->
    <div class="filtros">
      <div class="search-wrap">
        <i class="pi pi-search search-icon" />
        <input
          v-model="busca"
          type="text"
          class="search-input"
          placeholder="Buscar por ticker ou nome..."
        />
      </div>
      <div class="tipo-filtros">
        <button
          v-for="tipo in TIPOS"
          :key="tipo"
          class="tipo-btn"
          :class="{ 'tipo-btn--ativo': filtroTipo === tipo }"
          @click="filtroTipo = tipo"
        >
          {{ tipo === 'Acao' ? 'Ações' : tipo === 'RendaFixa' ? 'Renda Fixa' : tipo }}
        </button>
      </div>
    </div>

    <!-- Aviso derivativos -->
    <div v-if="temOpcoes" class="aviso-derivativos">
      <i class="pi pi-info-circle" />
      <span>
        Opções são derivativos e <strong>não somam ao Patrimônio Total</strong>.
        Elas aparecem na tabela apenas para referência.
      </span>
    </div>

    <!-- Tabela -->
    <div v-if="store.ativos.length" class="card">
      <div class="table-wrap">
        <table class="ativos-table">
          <thead>
            <tr>
              <th @click="ordenarPor('ticker')">
                Ticker <i :class="iconeOrdem('ticker')" />
              </th>
              <th>Nome</th>
              <th>Tipo</th>
              <th class="align-right" @click="ordenarPor('quantidade')">
                Qtd <i :class="iconeOrdem('quantidade')" />
              </th>
              <th class="align-right" @click="ordenarPor('preco_medio')">
                Preço Médio <i :class="iconeOrdem('preco_medio')" />
              </th>
              <th class="align-right" @click="ordenarPor('preco_atual')">
                Preço Atual <i :class="iconeOrdem('preco_atual')" />
              </th>
              <th class="align-right" @click="ordenarPor('valor_investido')">
                Investido <i :class="iconeOrdem('valor_investido')" />
              </th>
              <th class="align-right" @click="ordenarPor('valor_atual')">
                Atual <i :class="iconeOrdem('valor_atual')" />
              </th>
              <th class="align-right" @click="ordenarPor('rentabilidade_percentual')">
                Rentab. <i :class="iconeOrdem('rentabilidade_percentual')" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ativo in ativosFiltrados"
              :key="ativo.ticker"
              :class="{ 'row-derivativo': isDerivativo(ativo.tipo_ativo) }"
            >
              <td class="ticker-cell">
                {{ ativo.ticker }}
                <span v-if="isDerivativo(ativo.tipo_ativo)" class="tag-derivativo" title="Não soma ao patrimônio">deriv.</span>
              </td>
              <td class="nome-cell">{{ ativo.nome_ativo || '—' }}</td>
              <td><BadgeTipoAtivo :tipo="ativo.tipo_ativo" /></td>
              <td class="align-right">{{ formatarNumero(ativo.quantidade) }}</td>
              <td class="align-right">{{ formatarMoeda(ativo.preco_medio) }}</td>
              <td class="align-right">{{ formatarMoeda(ativo.preco_atual) }}</td>
              <td class="align-right">{{ formatarMoeda(ativo.valor_investido) }}</td>
              <td class="align-right">{{ formatarMoeda(ativo.valor_atual) }}</td>
              <td
                class="align-right rentab"
                :class="ativo.rentabilidade_percentual >= 0 ? 'positivo' : 'negativo'"
              >
                {{ sinalPercentual(ativo.rentabilidade_percentual) }}
              </td>
            </tr>
            <tr v-if="!ativosFiltrados.length">
              <td colspan="9" class="sem-resultados">Nenhum ativo encontrado.</td>
            </tr>
          </tbody>

          <!-- Linha de totais (aparece quando há filtro ativo) -->
          <tfoot v-if="mostrarTotais && totaisFiltrados">
            <tr class="totais-row">
              <td colspan="4" class="totais-label">
                <i class="pi pi-calculator" />
                Total — {{ ativosFiltrados.length }} ativo{{ ativosFiltrados.length !== 1 ? 's' : '' }}
                <span v-if="filtroTipo !== 'Todos'" class="totais-filtro-badge">
                  {{ filtroTipo === 'Acao' ? 'Ações' : filtroTipo === 'RendaFixa' ? 'Renda Fixa' : filtroTipo }}
                </span>
                <span v-if="totaisFiltrados?.temDerivativo" class="totais-obs">
                  (derivativos excluídos)
                </span>
              </td>
              <td colspan="2" />
              <td class="align-right totais-valor">
                {{ formatarMoeda(totaisFiltrados.valorInvestido) }}
              </td>
              <td class="align-right totais-valor">
                {{ formatarMoeda(totaisFiltrados.valorAtual) }}
              </td>
              <td
                class="align-right totais-rentab"
                :class="totaisFiltrados.rentabilidade >= 0 ? 'positivo' : 'negativo'"
              >
                {{ sinalPercentual(totaisFiltrados.rentabilidade) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div v-else class="empty-state">
      <i class="pi pi-list" style="font-size:32px;color:var(--color-border)" />
      <p>Nenhum ativo disponível. Importe uma planilha primeiro.</p>
    </div>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.25rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.page-title { font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0 0 0.2rem; }
.page-sub { font-size: 13px; color: var(--color-text-muted); margin: 0; }

.btn-atualizar {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 1rem; border: 1px solid var(--color-border); border-radius: 9px;
  background: var(--color-surface); font-size: 13px; font-family: inherit;
  color: var(--color-text); cursor: pointer; transition: all 0.15s;
}
.btn-atualizar:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.btn-atualizar:disabled { opacity: 0.6; cursor: not-allowed; }

.filtros { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

.search-wrap { position: relative; flex: 1; min-width: 200px; }
.search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); font-size: 13px; }
.search-input {
  width: 100%; height: 38px; padding: 0 0.9rem 0 2.25rem;
  border: 1px solid var(--color-border); border-radius: 9px;
  font-size: 13px; font-family: inherit; color: var(--color-text);
  background: var(--color-surface); outline: none; transition: border-color 0.15s;
}
.search-input:focus { border-color: var(--color-primary); }

.tipo-filtros { display: flex; gap: 4px; flex-wrap: wrap; }
.tipo-btn {
  padding: 0.3rem 0.85rem; border: 1px solid var(--color-border); border-radius: 7px;
  background: none; font-size: 12px; font-family: inherit;
  color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.tipo-btn--ativo, .tipo-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: #f3eeff; }

.card { background: var(--color-surface); border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.table-wrap { overflow-x: auto; }

.ativos-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ativos-table th {
  text-align: left; padding: 0.7rem 1rem; background: var(--color-bg);
  font-size: 11px; font-weight: 600; color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;
  cursor: pointer; user-select: none; border-bottom: 1px solid var(--color-border);
}
.ativos-table th:hover { color: var(--color-primary); }
.ativos-table th i { margin-left: 4px; font-size: 10px; }
.ativos-table td { padding: 0.65rem 1rem; border-bottom: 1px solid var(--color-border); white-space: nowrap; }
.ativos-table tbody tr:last-child td { border-bottom: none; }
.ativos-table tbody tr:hover td { background: var(--color-bg); }

.align-right { text-align: right !important; }
.ticker-cell { font-weight: 600; font-size: 13px; }
.nome-cell { max-width: 180px; overflow: hidden; text-overflow: ellipsis; color: var(--color-text-muted); }
.rentab { font-weight: 600; }
.positivo { color: var(--color-accent); }
.negativo { color: var(--color-danger); }
.sem-resultados { text-align: center; padding: 2rem; color: var(--color-text-muted); }

.aviso-derivativos {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.65rem 1rem; border-radius: 10px;
  background: #fff8e6; border: 1px solid #fde68a;
  font-size: 13px; color: #92400e;
}
.aviso-derivativos i { flex-shrink: 0; font-size: 15px; }

.row-derivativo td { opacity: 0.7; font-style: italic; }
.tag-derivativo {
  display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase;
  padding: 1px 5px; border-radius: 4px; margin-left: 5px; vertical-align: middle;
  background: #fef3c7; color: #92400e; font-style: normal; letter-spacing: 0.03em;
}

.totais-obs { font-size: 11px; font-weight: 400; color: #92400e; margin-left: 4px; }

.totais-row td {
  padding: 0.75rem 1rem;
  background: #f3eeff;
  border-top: 2px solid var(--color-primary);
  font-size: 13px;
}
.totais-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-weight: 600; color: var(--color-primary);
}
.totais-filtro-badge {
  display: inline-block; padding: 1px 8px; border-radius: 99px;
  background: var(--color-primary); color: #fff;
  font-size: 10px; font-weight: 600;
}
.totais-valor { font-weight: 700; color: var(--color-text); }
.totais-rentab { font-weight: 700; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 240px; gap: 0.75rem; text-align: center;
  background: var(--color-surface); border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); color: var(--color-text-muted); font-size: 13px;
}
</style>
