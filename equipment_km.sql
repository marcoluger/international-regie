-- equipment_km.sql
-- Kilometerstand für Fahrzeuge im Modul "Fahrzeuge & Werkzeuge".
-- Einmalig im Supabase SQL-Editor ausführen (mehrfaches Ausführen ist gefahrlos).
--
-- start_km / end_km: aktuelle km-Stände des vergebenen Fahrzeugs (der zugewiesene
--   Mitarbeiter trägt sie ein). Gefahrene km = end_km - start_km, rechnet die App.
-- equipment_log.note: Textnotiz für den Verlauf, u. a. "Gefahren: X km" beim Zurückgeben.

alter table public.equipment
  add column if not exists start_km numeric,
  add column if not exists end_km   numeric;

alter table public.equipment_log
  add column if not exists note text;
