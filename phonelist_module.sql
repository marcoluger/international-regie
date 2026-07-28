-- Modul "Telefonliste" freischaltbar machen. In Supabase → SQL Editor ausführen.
alter table company_features
  add column if not exists phonelist_enabled boolean not null default false;
