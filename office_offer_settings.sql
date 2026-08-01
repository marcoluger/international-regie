-- Angebots-Einstellungen (firmenweit) + Bindefrist am Angebot. In Supabase -> SQL Editor ausfuehren (idempotent).
create table if not exists public.office_offer_settings (
  company_id uuid primary key,
  def_mat_multi numeric default 1.28,
  def_lohn_multi numeric default 1.28,
  binde_weeks int default 4,
  vat_rate numeric default 19,
  updated_at timestamptz not null default now()
);
alter table public.office_offers add column if not exists binde_weeks int;

alter table public.office_offer_settings enable row level security;
drop policy if exists office_offer_settings_rw on public.office_offer_settings;
create policy office_offer_settings_rw on public.office_offer_settings for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_offer_settings.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_offer_settings.company_id and cu.role in ('owner','admin')));
