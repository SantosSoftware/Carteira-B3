-- Negociações em opções (importação isolada do arquivo B3 "Negociação")
-- Executar no SQL Editor do Supabase após schema.sql

create table negociacoes_opcao (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid not null references carteiras(id) on delete cascade,
  data_negocio date not null,
  tipo_movimentacao text not null,
  mercado text not null,
  codigo_negociacao text not null,
  ticker_base text not null,
  quantidade numeric(18, 6) not null default 0,
  preco numeric(18, 6),
  valor numeric(18, 2) not null default 0,
  prazo_vencimento text,
  instituicao text,
  nome_arquivo text,
  created_at timestamptz default now()
);

create index idx_negociacoes_opcao_carteira on negociacoes_opcao(carteira_id);
create index idx_negociacoes_opcao_data on negociacoes_opcao(carteira_id, data_negocio);

alter table negociacoes_opcao enable row level security;

create policy "user_select_negociacoes_opcao" on negociacoes_opcao
  for select using (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

create policy "user_insert_negociacoes_opcao" on negociacoes_opcao
  for insert with check (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

create policy "user_delete_negociacoes_opcao" on negociacoes_opcao
  for delete using (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );
