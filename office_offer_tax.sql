-- Angebots-Einstellungen: Rabatt/Skonto-Standards + Steuerfaelle (PV 0%, §13b). Idempotent, in Supabase ausfuehren.
alter table public.office_offer_settings add column if not exists def_rabatt_pct numeric default 0;
alter table public.office_offer_settings add column if not exists def_nachlass numeric default 0;
alter table public.office_offer_settings add column if not exists def_skonto_pct numeric default 0;
alter table public.office_offer_settings add column if not exists def_skonto_tage int default 0;
alter table public.office_offer_settings add column if not exists pv_text text;
alter table public.office_offer_settings add column if not exists b13_text text;
alter table public.office_offers add column if not exists tax_mode text default 'standard';
alter table public.office_offers add column if not exists tax_note text;
