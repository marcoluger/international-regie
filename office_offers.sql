-- Angebote (Stufe 1) + Anrede am Kunden. In Supabase -> SQL Editor ausfuehren (idempotent).

alter table public.office_customers add column if not exists anrede text;

create table if not exists public.office_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  number text,
  status text default 'entwurf',
  subject text,
  offer_date date,
  valid_until date,
  customer_id uuid,
  customer_name text,
  customer_anrede text,
  customer_street text,
  customer_zip text,
  customer_city text,
  vat_rate numeric default 19,
  rabatt_pct numeric default 0,
  nachlass numeric default 0,
  skonto_pct numeric default 0,
  skonto_tage int default 0,
  items jsonb not null default '[]'::jsonb,
  net_total numeric default 0,
  vat_total numeric default 0,
  gross_total numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists office_offers_company_idx on public.office_offers(company_id);

alter table public.office_offers enable row level security;
drop policy if exists office_offers_rw on public.office_offers;
create policy office_offers_rw on public.office_offers for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_offers.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_offers.company_id and cu.role in ('owner','admin')));
