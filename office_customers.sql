-- Kunden/Adressen-Tabelle fuer den Buero-Bereich. In Supabase -> SQL Editor ausfuehren (idempotent).
create table if not exists public.office_customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  taifun_guid text,
  matchcode text,
  customer_no text,
  kind text default 'debitor',
  debitor text,
  kreditor text,
  name text,
  name_addon text,
  street text,
  zip text,
  city text,
  phone text,
  mobile text,
  fax text,
  email text,
  website text,
  uid text,
  note text,
  internal_no text,
  created_at timestamptz not null default now()
);
-- Falls die Tabelle schon existierte (aus einem frueheren Lauf), Spalten nachziehen:
alter table public.office_customers add column if not exists debitor text;
alter table public.office_customers add column if not exists kreditor text;

create unique index if not exists office_customers_guid_uidx on public.office_customers(company_id, taifun_guid);
create index if not exists office_customers_company_idx on public.office_customers(company_id);

alter table public.office_customers enable row level security;
drop policy if exists office_customers_rw on public.office_customers;
create policy office_customers_rw on public.office_customers for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_customers.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_customers.company_id and cu.role in ('owner','admin')));
