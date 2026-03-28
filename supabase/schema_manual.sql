-- ============================================================
-- CarteiraB3 — Ativos Manuais (Previdência, Caixa, Dólar, Crypto)
-- Executar no SQL Editor do Supabase
-- ============================================================

create table ativos_manuais (
  id          uuid primary key default gen_random_uuid(),
  carteira_id uuid references carteiras(id) on delete cascade,
  nome        text not null,
  categoria   text not null,   -- 'PrevidenciaPrivada' | 'Caixa' | 'Dolar' | 'Crypto' | 'Outro'
  simbolo     text,            -- ex: 'BTC', 'ETH', 'USDT' (para crypto/dólar)
  moeda       text default 'BRL', -- 'BRL' | 'USD'
  observacao  text,
  ativo       boolean default true,
  created_at  timestamptz default now()
);

create table lancamentos_manuais (
  id              uuid primary key default gen_random_uuid(),
  ativo_manual_id uuid references ativos_manuais(id) on delete cascade,
  carteira_id     uuid references carteiras(id) on delete cascade,
  valor           numeric(18,2) not null,
  cotacao_usd     numeric(18,4),   -- cotação do dólar se moeda = 'USD' (opcional)
  data_lancamento date not null default current_date,
  observacao      text,
  created_at      timestamptz default now()
);

-- RLS
alter table ativos_manuais    enable row level security;
alter table lancamentos_manuais enable row level security;

-- Políticas SELECT
create policy "user_own_ativos_manuais" on ativos_manuais
  using (carteira_id in (select id from carteiras where user_id = auth.uid()));

create policy "user_own_lancamentos_manuais" on lancamentos_manuais
  using (carteira_id in (select id from carteiras where user_id = auth.uid()));

-- Políticas INSERT
create policy "user_insert_ativos_manuais" on ativos_manuais
  for insert with check (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

create policy "user_insert_lancamentos_manuais" on lancamentos_manuais
  for insert with check (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

-- Políticas UPDATE
create policy "user_update_ativos_manuais" on ativos_manuais
  for update using (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

-- Políticas DELETE
create policy "user_delete_ativos_manuais" on ativos_manuais
  for delete using (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

create policy "user_delete_lancamentos_manuais" on lancamentos_manuais
  for delete using (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );
