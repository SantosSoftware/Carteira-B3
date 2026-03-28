-- ============================================================
-- CarteiraB3 — Schema do banco de dados (Supabase / PostgreSQL)
-- Executar no SQL Editor do Supabase
-- ============================================================

-- Perfis de usuário (complementa auth.users)
create table profiles (
  id uuid references auth.users primary key,
  nome text,
  email text,
  plano text default 'free',
  created_at timestamptz default now()
);

-- Carteiras
create table carteiras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  nome text not null default 'Minha Carteira',
  created_at timestamptz default now()
);

-- Importações (registro de cada planilha importada)
create table importacoes (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid references carteiras(id) on delete cascade,
  nome_arquivo text,
  data_posicao date,
  status text default 'ok',
  created_at timestamptz default now()
);

-- Posições (snapshot de cada importação)
create table posicoes (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid references importacoes(id) on delete cascade,
  carteira_id uuid references carteiras(id) on delete cascade,
  ticker text not null,
  nome_ativo text,
  tipo_ativo text,
  quantidade numeric(18,6),
  preco_medio numeric(18,6),
  preco_atual numeric(18,6),
  valor_investido numeric(18,2),
  valor_atual numeric(18,2),
  rentabilidade_percentual numeric(10,4),
  data_posicao date,
  created_at timestamptz default now()
);

-- Dividendos
create table dividendos (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid references carteiras(id) on delete cascade,
  ticker text not null,
  tipo text,
  valor numeric(18,2),
  data_pagamento date,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table profiles enable row level security;
alter table carteiras enable row level security;
alter table importacoes enable row level security;
alter table posicoes enable row level security;
alter table dividendos enable row level security;

create policy "user_own_profile" on profiles
  using (id = auth.uid());

create policy "user_own_carteiras" on carteiras
  using (user_id = auth.uid());

create policy "user_own_importacoes" on importacoes
  using (carteira_id in (
    select id from carteiras where user_id = auth.uid()
  ));

create policy "user_own_posicoes" on posicoes
  using (carteira_id in (
    select id from carteiras where user_id = auth.uid()
  ));

create policy "user_own_dividendos" on dividendos
  using (carteira_id in (
    select id from carteiras where user_id = auth.uid()
  ));

-- ============================================================
-- Políticas de INSERT (necessárias para o app gravar dados)
-- ============================================================

create policy "user_insert_carteiras" on carteiras
  for insert with check (user_id = auth.uid());

create policy "user_insert_importacoes" on importacoes
  for insert with check (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

create policy "user_insert_posicoes" on posicoes
  for insert with check (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

create policy "user_insert_dividendos" on dividendos
  for insert with check (
    carteira_id in (select id from carteiras where user_id = auth.uid())
  );

-- ============================================================
-- Trigger: cria perfil automaticamente no cadastro
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
