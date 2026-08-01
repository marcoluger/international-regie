-- Büro-Bereich: passwortgeschützter Tab mit separater Mitarbeiterliste.
-- In Supabase -> SQL Editor ausführen (idempotent).

-- Bereichs-Passwort pro Firma
create table if not exists public.office_settings (
  company_id uuid primary key,
  office_password text,
  updated_at timestamptz not null default now()
);

-- Separate Büro-Mitarbeiterliste (reine Datensätze, keine Logins)
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
