-- Bauleiter je Arbeitsanweisung: markierte Mitarbeiter dürfen Kommentare + Status schreiben.
-- In Supabase -> SQL Editor ausführen (idempotent, gefahrlos mehrfach ausführbar).
alter table public.work_instructions
  add column if not exists foreman_user_ids uuid[] not null default '{}';
