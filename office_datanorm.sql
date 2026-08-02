-- DATANORM / Lieferanten-Katalog fuer den Buero-Bereich. In Supabase -> SQL Editor ausfuehren (idempotent).
-- Drei Tabellen: Lieferanten, Katalog-Artikel, Rabattgruppen.

-- Fuer schnelle Textsuche (ILIKE) auf grossen Katalogen:
create extension if not exists pg_trgm;

-- 1) Lieferanten -------------------------------------------------------------
create table if not exists public.office_suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  name text not null,
  datanorm_version text,
  currency text,
  catalog_date text,
  article_count integer default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists office_suppliers_company_idx on public.office_suppliers(company_id);

alter table public.office_suppliers enable row level security;
drop policy if exists office_suppliers_rw on public.office_suppliers;
create policy office_suppliers_rw on public.office_suppliers for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_suppliers.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_suppliers.company_id and cu.role in ('owner','admin')));

-- 2) Katalog-Artikel ---------------------------------------------------------
create table if not exists public.office_supplier_articles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  supplier_id uuid not null,
  article_no text,
  short_text text,
  long_text text,
  unit text,
  ean text,
  discount_group text,
  list_ek numeric,
  net_ek numeric,
  ek numeric,
  created_at timestamptz not null default now()
);
create index if not exists office_supplier_articles_sup_idx on public.office_supplier_articles(company_id, supplier_id);
create index if not exists office_supplier_articles_txt_idx on public.office_supplier_articles using gin (short_text gin_trgm_ops);
create index if not exists office_supplier_articles_no_idx  on public.office_supplier_articles using gin (article_no gin_trgm_ops);

alter table public.office_supplier_articles enable row level security;
drop policy if exists office_supplier_articles_rw on public.office_supplier_articles;
create policy office_supplier_articles_rw on public.office_supplier_articles for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_supplier_articles.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_supplier_articles.company_id and cu.role in ('owner','admin')));

-- 3) Rabatt-/Preisgruppen ----------------------------------------------------
create table if not exists public.office_supplier_discounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  supplier_id uuid not null,
  discount_group text,
  discount_pct numeric,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists office_supplier_discounts_sup_idx on public.office_supplier_discounts(company_id, supplier_id);

alter table public.office_supplier_discounts enable row level security;
drop policy if exists office_supplier_discounts_rw on public.office_supplier_discounts;
create policy office_supplier_discounts_rw on public.office_supplier_discounts for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_supplier_discounts.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_supplier_discounts.company_id and cu.role in ('owner','admin')));
