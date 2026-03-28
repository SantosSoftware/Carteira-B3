# SPEC — CarteiraB3 App
> Documento de especificação para desenvolvimento via Cursor AI  
> Stack: Vue 3 + Vite + Supabase | Idioma: Português (BR)

---

## 1. Visão Geral do Produto

Aplicação web SaaS para gestão de carteira de investimentos na B3. O usuário importa planilhas Excel geradas pela B3 (Extrato de Custódia / Posição Consolidada) e visualiza sua carteira com gráficos, métricas e histórico de patrimônio. A aplicação deve ser acessível de qualquer dispositivo via browser.

**Fase atual (MVP):** Usuário único, sem cobrança.  
**Fase futura (não implementar agora):** Multi-tenant, assinatura via cartão de crédito, onboarding de novos clientes.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | Vue 3 + Vite + Composition API |
| UI Components | PrimeVue ou Shadcn-Vue |
| Gráficos | Chart.js com vue-chartjs |
| Estilização | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Leitura de Excel | SheetJS (xlsx) |
| Cotações em tempo real | brapi.dev (API pública, gratuita) |
| Deploy | Vercel ou Netlify |

---

## 3. Design Visual (inspirado no Kinvo)

### 3.1 Paleta de Cores
```
--color-bg:           #F5F6FA       /* fundo geral cinza claro */
--color-surface:      #FFFFFF       /* cards e painéis */
--color-primary:      #6C3FC5       /* roxo principal (ações, destaques) */
--color-secondary:    #F4A623      /* laranja (FIIs, segundo anel) */
--color-accent:       #00C9A7       /* verde água (positivo) */
--color-danger:       #E74C3C       /* vermelho (negativo) */
--color-text:         #1A1A2E       /* texto principal */
--color-text-muted:   #8492A6       /* texto secundário */
--color-border:       #E8ECF0       /* bordas e divisores */
```

### 3.2 Tipografia
- Fonte principal: **Inter** (Google Fonts)
- Títulos de cards: 13px, `font-weight: 500`, cor muted
- Valores monetários: 22–28px, `font-weight: 700`, cor text
- Variações positivas: cor accent (verde)
- Variações negativas: cor danger (vermelho)

### 3.3 Layout Geral
- **Sidebar esquerda fixa** com largura de 72px (apenas ícones + label), fundo branco, borda direita sutil
- **Topbar** com nome da carteira ativa, botões de ação (importar planilha, dark mode)
- **Área de conteúdo** com tabs: Resumo | Ativos | Análises | Extrato | Importações
- **Cards** com `border-radius: 16px`, sombra suave `box-shadow: 0 2px 12px rgba(0,0,0,0.06)`
- **Grid responsivo**: 4 colunas em desktop, 2 em tablet, 1 em mobile

### 3.4 Sidebar — Itens de Navegação
```
📊  Carteira       → /carteira
📋  Ativos         → /ativos
📈  Análises       → /analises
📄  Extrato        → /extrato
📥  Importações    → /importacoes
⚙️  Configurações  → /configuracoes
```

---

## 4. Estrutura do Banco de Dados (Supabase)

### 4.1 Tabela: `users`
Gerenciada pelo Supabase Auth. Campos adicionais em `profiles`:

```sql
create table profiles (
  id uuid references auth.users primary key,
  nome text,
  email text,
  plano text default 'free',  -- 'free' | 'pro' (uso futuro)
  created_at timestamptz default now()
);
```

### 4.2 Tabela: `carteiras`
```sql
create table carteiras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  nome text not null default 'Minha Carteira',
  created_at timestamptz default now()
);
```

### 4.3 Tabela: `importacoes`
Registro de cada planilha importada.
```sql
create table importacoes (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid references carteiras(id) on delete cascade,
  nome_arquivo text,
  data_posicao date,          -- data de referência da posição (extraída da planilha)
  status text default 'ok',   -- 'ok' | 'erro'
  created_at timestamptz default now()
);
```

### 4.4 Tabela: `posicoes`
Snapshot da posição em cada importação.
```sql
create table posicoes (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid references importacoes(id) on delete cascade,
  carteira_id uuid references carteiras(id) on delete cascade,
  ticker text not null,                -- ex: 'PETR4', 'KNRI11'
  nome_ativo text,
  tipo_ativo text,                     -- 'Acao' | 'FII' | 'BDR' | 'ETF' | 'RendaFixa'
  quantidade numeric(18,6),
  preco_medio numeric(18,6),
  preco_atual numeric(18,6),           -- preenchido via API de cotação ao importar
  valor_investido numeric(18,2),       -- quantidade * preco_medio
  valor_atual numeric(18,2),           -- quantidade * preco_atual
  rentabilidade_percentual numeric(10,4),
  data_posicao date,
  created_at timestamptz default now()
);
```

### 4.5 Tabela: `dividendos`
```sql
create table dividendos (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid references carteiras(id) on delete cascade,
  ticker text not null,
  tipo text,           -- 'Dividendo' | 'JCP' | 'Rendimento'
  valor numeric(18,2),
  data_pagamento date,
  created_at timestamptz default now()
);
```

### 4.6 Row Level Security (RLS)
Habilitar RLS em todas as tabelas. Política padrão:
```sql
-- Exemplo para tabela posicoes
alter table posicoes enable row level security;
create policy "user_own_data" on posicoes
  using (carteira_id in (
    select id from carteiras where user_id = auth.uid()
  ));
```
Replicar para `carteiras`, `importacoes`, `dividendos`.

---

## 5. Funcionalidade: Importação de Planilha B3

### 5.1 Formato da Planilha (Extrato de Custódia B3)
A B3 gera um arquivo `.xlsx` com as seguintes colunas relevantes:

| Coluna B3 | Campo no sistema |
|---|---|
| Produto | `ticker` + `nome_ativo` |
| Instituição | (ignorar por ora) |
| Conta | (ignorar por ora) |
| Código de Negociação | `ticker` |
| Tipo | `tipo_ativo` |
| Escriturador | (ignorar) |
| Quantidade | `quantidade` |
| Quantidade Disponível | (usar como `quantidade` se Quantidade ausente) |
| Preço Médio | `preco_medio` |
| Valor Atualizado | `valor_atual` |

> ⚠️ **Nota:** O layout da planilha da B3 pode variar. O parser deve ser flexível, buscando as colunas por nome (case-insensitive) e não por índice fixo.

### 5.2 Fluxo de Importação

1. Usuário clica em **"Importar Planilha"** (topbar ou página Importações)
2. Modal abre com drag-and-drop ou botão de seleção de arquivo (`.xlsx`)
3. Frontend lê o arquivo com **SheetJS** (100% client-side, sem upload do arquivo bruto)
4. Parser extrai as linhas e monta array de ativos
5. Para cada ticker identificado, busca cotação atual via **brapi.dev**:
   ```
   GET https://brapi.dev/api/quote/{ticker}
   ```
6. Calcula `valor_investido`, `valor_atual`, `rentabilidade_percentual`
7. Exibe **preview** da tabela para o usuário revisar antes de confirmar
8. Ao confirmar:
   - Cria registro em `importacoes`
   - Insere todas as linhas em `posicoes`
9. Toast de sucesso e redirect para tela de Resumo

### 5.3 Tratamento de Importações Incrementais
- Cada importação é um **snapshot independente** com `data_posicao`
- A tela de Resumo sempre exibe a **importação mais recente**
- O histórico de patrimônio é construído a partir de todos os snapshots acumulados
- Nunca sobrescrever dados antigos — apenas inserir novos

### 5.4 Validações
- Arquivo deve ser `.xlsx`
- Tamanho máximo: 10MB
- Ao menos 1 ativo deve ser identificado
- Exibir erros amigáveis se colunas esperadas não forem encontradas

---

## 6. Telas e Componentes

### 6.1 Tela: Login / Cadastro (`/auth`)
- Formulário simples com email + senha
- Login com Google via Supabase Auth (opcional, mas recomendado)
- Após login, redirecionar para `/carteira`

### 6.2 Tela: Resumo da Carteira (`/carteira`)

#### Cards de Métricas (linha superior — 4 cards)
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Patrimônio Total│ │ Valor Investido │ │ Rentabilidade   │ │ Dividendos      │
│ R$ 00.000,00    │ │ R$ 00.000,00    │ │ +0,00%          │ │ R$ 0.000,00     │
│                 │ │                 │ │ (vs. CDI/IBOV)  │ │ (últimos 12m)   │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

#### Gráfico de Alocação (coluna esquerda)
- Gráfico de **donut** (estilo Kinvo) com anéis concêntricos por tipo de ativo
- Anel externo: Ações (roxo `#6C3FC5`)
- Anel do meio: FIIs (laranja `#F4A623`)
- Anel interno: Outros (azul `#3B82F6`)
- Centro: mês/ano de referência + valor total + variação vs CDI
- Legenda abaixo com cor, tipo, valor e percentual

#### Gráfico de Histórico (coluna direita)
- Gráfico de **área** (Chart.js) com linha do patrimônio ao longo do tempo
- Filtros de período: No ano | 12 meses | 24 meses | Do início
- Toggle: Patrimônio / Rentabilidade
- Linha de comparação com IBOV e CDI (buscar via brapi.dev ou BACEN API)

### 6.3 Tela: Ativos (`/ativos`)
- Tabela com todos os ativos da posição mais recente
- Colunas: Ticker | Nome | Tipo | Quantidade | Preço Médio | Preço Atual | Valor Investido | Valor Atual | Rentabilidade (%) | Variação do Dia
- Filtro por tipo (Ações / FIIs / BDRs / ETFs / Renda Fixa)
- Ordenação clicável em todas as colunas
- Linha colorida por desempenho (verde/vermelho)
- Badge colorido por tipo de ativo

### 6.4 Tela: Análises (`/analises`)
- **Gráfico de pizza**: alocação por tipo de ativo (%)
- **Gráfico de barras horizontais**: top 10 ativos por valor atual
- **Gráfico de barras**: dividendos recebidos por mês (últimos 12 meses)
- **Card comparativo**: Rentabilidade carteira vs CDI vs IBOV (período selecionável)

### 6.5 Tela: Extrato (`/extrato`)
- Listagem cronológica de todas as importações realizadas
- Para cada importação: data, nome do arquivo, número de ativos, patrimônio total naquela data
- Botão para visualizar detalhes de uma importação específica
- Botão para excluir uma importação (com confirmação)

### 6.6 Tela: Importações (`/importacoes`)
- Botão principal de importação (drag-and-drop)
- Histórico de arquivos importados
- Status de cada importação
- Opção de re-importar ou deletar

### 6.7 Componente: Modal de Importação
```
┌──────────────────────────────────────────────┐
│  Importar Posição B3                      [X] │
│                                               │
│  ┌──────────────────────────────────────────┐ │
│  │   📁 Arraste o arquivo aqui              │ │
│  │   ou clique para selecionar              │ │
│  │   Formatos aceitos: .xlsx                │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  [Preview da tabela após leitura]             │
│                                               │
│  [Cancelar]              [Confirmar Importação]│
└──────────────────────────────────────────────┘
```

---

## 7. Integração com API de Cotações (brapi.dev)

### 7.1 Endpoint de Cotação
```
GET https://brapi.dev/api/quote/{tickers}
```
- `tickers`: string com tickers separados por vírgula (ex: `PETR4,KNRI11,BOVA11`)
- Retorna: `regularMarketPrice`, `regularMarketChangePercent`, `shortName`

### 7.2 Estratégia de Uso
- Buscar cotações **apenas no momento da importação**
- Adicionar botão **"Atualizar Cotações"** na tela de Ativos para refresh manual
- Cache local (Pinia store) com timestamp — não rebuscar se < 5 minutos
- Para ativos de Renda Fixa: não buscar cotação, usar valor da planilha

### 7.3 Fallback
- Se a API falhar, manter o valor da planilha e exibir aviso
- Nunca bloquear a importação por falha de cotação

---

## 8. Gerenciamento de Estado (Pinia)

### Stores necessárias:
```
useAuthStore       → usuário logado, session
useCarteiraStore   → carteira ativa, posições, métricas calculadas
useImportStore     → estado da importação em andamento
useCotacaoStore    → cache de cotações com TTL
```

---

## 9. Estrutura de Pastas do Projeto

```
/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppSidebar.vue
│   │   │   ├── AppTopbar.vue
│   │   │   └── AppLayout.vue
│   │   ├── carteira/
│   │   │   ├── MetricaCard.vue
│   │   │   ├── GraficoDonut.vue
│   │   │   ├── GraficoHistorico.vue
│   │   │   └── TabelaAtivos.vue
│   │   ├── importacao/
│   │   │   ├── ModalImportacao.vue
│   │   │   ├── DropzoneUpload.vue
│   │   │   └── PreviewImportacao.vue
│   │   └── ui/
│   │       ├── BadgeTipoAtivo.vue
│   │       └── ToastNotification.vue
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.vue
│   │   ├── CarteiraSummary.vue
│   │   ├── AtivosPage.vue
│   │   ├── AnalisesPage.vue
│   │   ├── ExtratoPage.vue
│   │   └── ImportacoesPage.vue
│   ├── stores/
│   │   ├── auth.js
│   │   ├── carteira.js
│   │   ├── importacao.js
│   │   └── cotacao.js
│   ├── services/
│   │   ├── supabase.js         ← client Supabase
│   │   ├── brapi.js            ← wrapper da API de cotações
│   │   └── b3Parser.js         ← parser da planilha B3 com SheetJS
│   ├── router/
│   │   └── index.js
│   ├── utils/
│   │   ├── formatters.js       ← formatação de moeda, %, datas
│   │   └── calculos.js         ← rentabilidade, patrimônio total
│   ├── App.vue
│   └── main.js
├── .env
├── vite.config.js
└── package.json
```

---

## 10. Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_BRAPI_TOKEN=           # opcional, aumenta rate limit
```

---

## 11. Parser da Planilha B3 (`b3Parser.js`)

O parser deve:

1. Usar SheetJS para ler o arquivo: `XLSX.read(buffer, { type: 'array' })`
2. Pegar a primeira sheet com dados (pode ter sheets de capa)
3. Converter para JSON: `XLSX.utils.sheet_to_json(sheet, { defval: '' })`
4. Normalizar nomes de colunas (trim + lowercase)
5. Mapear para o modelo interno:

```javascript
// Mapeamento de colunas B3 → modelo interno
const COLUMN_MAP = {
  ticker: ['código de negociação', 'codigo de negociacao', 'ticker', 'código'],
  nome_ativo: ['produto', 'nome', 'ativo'],
  tipo_ativo: ['tipo', 'tipo de ativo', 'classe'],
  quantidade: ['quantidade', 'qtd', 'quantidade disponível'],
  preco_medio: ['preço médio', 'preco medio', 'custo médio', 'pm'],
  valor_atual: ['valor atualizado', 'valor atual', 'saldo'],
}

// Mapeamento de tipos B3 → tipos internos
const TIPO_MAP = {
  'acao': 'Acao',
  'ações': 'Acao',
  'fii': 'FII',
  'fundo imobiliário': 'FII',
  'bdr': 'BDR',
  'etf': 'ETF',
  'renda fixa': 'RendaFixa',
  'tesouro': 'RendaFixa',
}
```

6. Filtrar linhas inválidas (sem ticker ou quantidade = 0)
7. Retornar array tipado + `data_posicao` (tentar extrair da planilha, fallback para hoje)

---

## 12. Cálculos de Métricas

```javascript
// Patrimônio Total
patrimonioTotal = sum(posicoes.map(p => p.valor_atual))

// Valor Investido
valorInvestido = sum(posicoes.map(p => p.valor_investido))

// Rentabilidade Global (%)
rentabilidadeGlobal = ((patrimonioTotal - valorInvestido) / valorInvestido) * 100

// Rentabilidade por Ativo (%)
rentabilidade = ((preco_atual - preco_medio) / preco_medio) * 100

// Alocação por Tipo (%)
alocacaoPorTipo = group(posicoes, 'tipo_ativo')
  .map(group => ({ tipo, percentual: (somaGrupo / patrimonioTotal) * 100 }))
```

---

## 13. Roadmap Futuro (NÃO implementar agora — apenas arquitetar pensando nisso)

| Feature | Descrição |
|---|---|
| Multi-tenant | Tabelas já têm `user_id` — pronto para múltiplos usuários |
| Planos / Assinatura | Campo `plano` em `profiles`, integrar Stripe futuramente |
| Autenticação social | Google OAuth já suportado pelo Supabase |
| Limites por plano | Ex: plano free = 1 carteira, pro = ilimitado |
| Exportação PDF | Relatório da carteira em PDF |
| Alertas de preço | Notificação quando ativo sobe/cai X% |
| Conexão Open Finance | Importação automática via API (longo prazo) |

---

## 14. Checklist de Entrega do MVP

- [ ] Autenticação (login/logout/signup) com Supabase Auth
- [ ] Criação automática de carteira padrão no primeiro login
- [ ] Importação de planilha `.xlsx` da B3 com parser flexível
- [ ] Preview de dados antes de confirmar importação
- [ ] Busca de cotações via brapi.dev
- [ ] Tela de Resumo com 4 cards + gráfico donut + gráfico de histórico
- [ ] Tela de Ativos com tabela filtrável e ordenável
- [ ] Tela de Análises com gráficos de alocação e dividendos
- [ ] Tela de Extrato com histórico de importações
- [ ] Design fiel ao estilo Kinvo (sidebar, cards arredondados, cores definidas)
- [ ] Responsivo (mobile-friendly)
- [ ] RLS ativo no Supabase (dados isolados por usuário)
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy funcional (Vercel ou Netlify)

---

*Spec gerada em: Março/2026*  
*Versão: 1.0 — MVP*
