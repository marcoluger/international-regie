-- Artikelstamm (eigene Artikel/Leistungen) fuer den Buero-Bereich. In Supabase -> SQL Editor ausfuehren (idempotent).
create table if not exists public.office_articles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  number text,
  category text,
  short_text text,
  long_text text,
  unit text default 'St',
  mat_ek numeric,
  lohn_ek numeric,
  minutes numeric,
  mat_multi numeric,
  lohn_multi numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Falls die Tabelle schon existierte (aus einem frueheren Lauf), Spalten nachziehen:
alter table public.office_articles add column if not exists number text;
alter table public.office_articles add column if not exists category text;
alter table public.office_articles add column if not exists short_text text;
alter table public.office_articles add column if not exists long_text text;
alter table public.office_articles add column if not exists unit text default 'St';
alter table public.office_articles add column if not exists mat_ek numeric;
alter table public.office_articles add column if not exists lohn_ek numeric;
alter table public.office_articles add column if not exists minutes numeric;
alter table public.office_articles add column if not exists mat_multi numeric;
alter table public.office_articles add column if not exists lohn_multi numeric;
alter table public.office_articles add column if not exists updated_at timestamptz not null default now();

create index if not exists office_articles_company_idx on public.office_articles(company_id);
create index if not exists office_articles_category_idx on public.office_articles(company_id, category);

alter table public.office_articles enable row level security;
drop policy if exists office_articles_rw on public.office_articles;
create policy office_articles_rw on public.office_articles for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_articles.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_articles.company_id and cu.role in ('owner','admin')));
