-- office_datev.sql (Stufe 8a - Buchhaltungs-Modul, Teil 1)
-- Zweck: DATEV-Export der Ausgangsrechnungen (Buchungsstapel im DATEV-Format, EXTF-CSV).
--   office_datev_settings  firmenweite Einstellungen (Kontenrahmen, Berater/Mandant,
--                          Erloeskonten + BU-Schluessel je Steuermodus, Standard-Debitor)
--   office_datev_exports   Protokoll der erzeugten Exporte (Zeitraum, Anzahl, Summe)
-- Idempotent: kann mehrfach ausgefuehrt werden.

create table if not exists public.office_datev_settings (
  company_id      uuid primary key,
  kontenrahmen    text not null default 'SKR03',      -- 'SKR03' | 'SKR04'
  berater_nr      text,                               -- DATEV-Beraternummer (Steuerbuero)
  mandant_nr      text,                               -- DATEV-Mandantennummer
  sachkonto_len   int  not null default 4,            -- Sachkontenlaenge (4-8)
  konto_erloes_19  text,                              -- Erloeskonto Standard 19 % (SKR03: 8400)
  konto_erloes_pv  text,                              -- Erloeskonto PV 0 % Par. 12 Abs. 3 (SKR03: 8290)
  konto_erloes_13b text,                              -- Erloeskonto Par. 13b UStG (SKR03: 8337)
  bu_19  text,                                        -- BU-Schluessel je Modus (leer = Automatikkonto)
  bu_pv  text,
  bu_13b text,
  debitor_default text,                               -- Sammel-Debitor, wenn Kunde keine Debitor-Nr. hat
  updated_at timestamptz not null default now()
);

create table if not exists public.office_datev_exports (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  von        date,
  bis        date,
  anzahl     int,
  summe      numeric,
  file_name  text,
  created_at timestamptz not null default now()
);

create index if not exists office_datev_exports_company_idx
  on public.office_datev_exports(company_id, created_at desc);

alter table public.office_datev_settings enable row level security;
drop policy if exists office_datev_settings_rw on public.office_datev_settings;
create policy office_datev_settings_rw on public.office_datev_settings for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_datev_settings.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_datev_settings.company_id and cu.role in ('owner','admin')));

alter table public.office_datev_exports enable row level security;
drop policy if exists office_datev_exports_rw on public.office_datev_exports;
create policy office_datev_exports_rw on public.office_datev_exports for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_datev_exports.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_datev_exports.company_id and cu.role in ('owner','admin')));

-- Kontrolle: muss 2 Zeilen zeigen
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('office_datev_settings','office_datev_exports')
order by table_name;
