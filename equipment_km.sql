-- equipment_km.sql
-- Kilometerstand für Fahrzeuge im Modul "Fahrzeuge & Werkzeuge".
-- Einmalig im Supabase SQL-Editor ausführen.
-- start_km / end_km werden nur bei Fahrzeugen gesetzt; die gefahrenen km
-- (end_km - start_km) rechnet die App beim Anzeigen selbst aus.

alter table public.equipment
  add column if not exists start_km numeric,
  add column if not exists end_km   numeric;
