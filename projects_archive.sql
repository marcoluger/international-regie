-- Projekt-Archiv: Spalte "archived" zur Tabelle projects hinzufügen.
-- In Supabase -> SQL Editor ausführen (idempotent, gefahrlos mehrfach ausführbar).
alter table public.projects
  add column if not exists archived boolean not null default false;
