-- Zweite Adresse (nur für die Navigation) in der Arbeitsanweisung.
-- In Supabase → SQL Editor ausführen.
alter table work_instructions
  add column if not exists address2 text;
