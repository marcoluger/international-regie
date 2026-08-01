-- Angebot: Vor-/Nachtext + Zahlungsbedingungen. Idempotent, in Supabase ausfuehren.
alter table public.office_offer_settings add column if not exists vortext text;
alter table public.office_offer_settings add column if not exists nachtext text;
alter table public.office_offer_settings add column if not exists pay1_pct numeric default 50;
alter table public.office_offer_settings add column if not exists pay2_pct numeric default 30;
alter table public.office_offer_settings add column if not exists pay3_pct numeric default 20;
alter table public.office_offers add column if not exists vortext text;
alter table public.office_offers add column if not exists nachtext text;
alter table public.office_offers add column if not exists pay1_pct numeric;
alter table public.office_offers add column if not exists pay2_pct numeric;
alter table public.office_offers add column if not exists pay3_pct numeric;
