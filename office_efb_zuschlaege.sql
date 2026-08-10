-- office_efb_zuschlaege.sql (EFB-Formblatt 221, Tabelle 2)
-- Zweck: Aufteilung der Gesamtzuschlaege auf die amtlichen Zeilen des Formblatts 221:
--   efb_bgk             Baustellengemeinkosten (Zeile 2.1), fester Satz in %
--   efb_gewinn          Gewinn (Zeile 2.3.1), fester Satz in %
--   efb_wagnis_betrieb  betriebsbezogenes Wagnis (Zeile 2.3.2), fester Satz in %
--   efb_wagnis_leistung leistungsbezogenes Wagnis (Zeile 2.3.3), fester Satz in %
--   Allgemeine Geschaeftskosten (Zeile 2.2) = Rest (Gesamtzuschlag minus feste Saetze,
--   kann auch negativ sein) -> Summe stimmt immer mit der echten Kalkulation ueberein.
-- Vorbelegung = Werte aus Marcos Taifun-Formblatt vom 21.05.2026.
-- Idempotent: kann mehrfach ausgefuehrt werden.

alter table public.office_offer_settings
  add column if not exists efb_bgk             numeric default 10,
  add column if not exists efb_gewinn          numeric default 4.45,
  add column if not exists efb_wagnis_betrieb  numeric default 2.22,
  add column if not exists efb_wagnis_leistung numeric default 2.22;

-- Kontrolle: muss 4 Zeilen zeigen
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'office_offer_settings'
  and column_name in ('efb_bgk', 'efb_gewinn', 'efb_wagnis_betrieb', 'efb_wagnis_leistung')
order by column_name;
