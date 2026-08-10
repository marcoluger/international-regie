-- office_price_archive.sql (Stufe 9b - Taifun-Preisarchiv)
-- Zweck: Alt-Angebote aus Taifun (Excel-Export je Angebot) als Preisgedaechtnis.
--   Jede Zeile = eine kalkulierte Position (Text, Mat-EK, Multi, Std.Lohn, Minuten, EP).
--   Genutzt vom Knopf "Preise vorschlagen" im Angebots-Editor (Textaehnlichkeit).
-- Idempotent: kann mehrfach ausgefuehrt werden.

create table if not exists public.office_price_archive (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  source     text,             -- Dateiname des Taifun-Exports (Herkunft)
  pos        text,             -- Positionsnummer im Alt-Angebot
  unit       text,
  text       text not null,    -- Beschreibung (bereinigt)
  norm_text  text,             -- normalisiert (Kleinbuchstaben, fuer Suche/Debug)
  mat_ek     numeric,
  mat_multi  numeric,
  lohn_ek    numeric,          -- Std.Lohn (EUR/h)
  minutes    numeric,
  fremd_vk   numeric,
  geraet_vk  numeric,
  ep         numeric,          -- E-Preis im Alt-Angebot (zur Plausibilitaet)
  created_at timestamptz not null default now()
);

create index if not exists office_price_archive_company_idx
  on public.office_price_archive(company_id, created_at desc);

alter table public.office_price_archive enable row level security;
drop policy if exists office_price_archive_rw on public.office_price_archive;
create policy office_price_archive_rw on public.office_price_archive for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_price_archive.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_price_archive.company_id and cu.role in ('owner','admin')));

-- Kontrolle: muss 1 Zeile zeigen (office_price_archive)
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'office_price_archive';
