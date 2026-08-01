-- Obermodul "Büro" freischaltbar machen. In Supabase -> SQL Editor ausführen (idempotent).
alter table public.company_features
  add column if not exists office_enabled boolean not null default false;
