-- Kupferzuschlag (DEL) für das Angebotsmodul. In Supabase -> SQL Editor ausfuehren (idempotent).
-- Globaler Tages-Kupferpreis (€/kg) + Standard-Kupfer-Multiplikator; pro Angebot der verwendete DEL-Preis.
-- Die Positions-Felder (preiseinheit, verschnitt, kupfer_kg, kupfer_multi) liegen im JSON `items` und brauchen keine Spalte.
alter table public.office_offer_settings add column if not exists del_preis numeric default 0;
alter table public.office_offer_settings add column if not exists def_kupfer_multi numeric default 1.05;
alter table public.office_offers add column if not exists del_preis numeric;
