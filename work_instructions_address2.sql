-- Zweite Adresse (nur für die Navigation) in der Arbeitsanweisung.
-- Strukturiert: Name, Straße, PLZ, Ort. In Supabase → SQL Editor ausführen.
alter table work_instructions
  add column if not exists address2 text,
  add column if not exists address2_name text,
  add column if not exists address2_street text,
  add column if not exists address2_zip text,
  add column if not exists address2_city text;
