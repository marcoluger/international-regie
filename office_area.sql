-- Büro-Bereich: passwortgeschützter Tab mit separater Mitarbeiterliste.
-- In Supabase -> SQL Editor ausführen (idempotent, mehrfach ausführbar).

-- 1) Tabellen (falls noch nicht vorhanden)
create table if not exists public.office_settings (
  company_id uuid primary key,
  office_password text,
  updated_at timestamptz not null default now()
);
create table if not exists public.office_employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  name text not null,
  role text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists office_employees_company_idx on public.office_employees(company_id);

-- 2) RLS aktiv + Policies: nur Owner/Admin der EIGENEN Firma dürfen lesen/schreiben.
alter table public.office_settings  enable row level security;
alter table public.office_employees enable row level security;

drop policy if exists office_settings_rw on public.office_settings;
create policy office_settings_rw on public.office_settings
  for all
  using (exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = office_settings.company_id
      and cu.role in ('owner','admin')))
  with check (exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = office_settings.company_id
      and cu.role in ('owner','admin')));

drop policy if exists office_employees_rw on public.office_employees;
create policy office_employees_rw on public.office_employees
  for all
  using (exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = office_employees.company_id
      and cu.role in ('owner','admin')))
  with check (exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = office_employees.company_id
      and cu.role in ('owner','admin')));
