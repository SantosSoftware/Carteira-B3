-- ============================================================
-- CarteiraB3 — Proventos (Dividendos, JCP, Rendimentos FII)
-- Executar no SQL Editor do Supabase
-- ============================================================

create table proventos (
  id             uuid primary key default gen_random_uuid(),
  carteira_id    uuid references carteiras(id) on delete cascade,
  ticker         text not null,
  nome_ativo     text,
  tipo_provento  text not null,  -- 'Dividendo' | 'JCP' | 'Rendimento'
  tipo_ativo     text not null,  -- 'Acao' | 'FII' | 'ETF' | 'Outro'
  data_pagamento date not null,
  quantidade     numeric(18,6),
  valor_unitario numeric(18,6),
  valor_total    numeric(18,2) not null,
  instituicao    text,
  created_at     timestamptz default now()
);

-- Índices para consultas frequentes
create index proventos_carteira_idx on proventos (carteira_id);
create index proventos_data_idx     on proventos (carteira_id, data_pagamento);
create index proventos_ticker_idx   on proventos (carteira_id, ticker);

-- RLS
alter table proventos enable row level security;

create policy "user_select_proventos" on proventos
  using (carteira_id in (select id from carteiras where user_id = auth.uid()));

create policy "user_insert_proventos" on proventos
  for insert with check (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

create policy "user_delete_proventos" on proventos
  for delete using (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );
