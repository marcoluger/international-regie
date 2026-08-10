-- office_efb_zuschlaege.sql (EFB-Formblatt 221 - einstellbare Zuschlaege wie in Taifun)
-- Je Kostenart (Lohn, Material/Stoffe, Geraete, Fremdleistung/Sonstige):
--   efb_bgk_*   Baustellengemeinkosten in % (Zeile 2.1), fester Satz
--   efb_agk_*   Allgemeine Geschaeftskosten in % (Zeile 2.2), fester Satz
-- Wagnis und Gewinn (Zeilen 2.3.1-2.3.3) = Rest (Gesamtzuschlag - BGK - AGK),
-- aufgeteilt nach Anteilen (efb_anteil_*, zusammen 100 %).
-- Lohn-Tabelle 1: efb_lohnzusatz (Zeile 1.2) und efb_lohnneben (Zeile 1.3) in % auf ML;
-- Zeile 1.5 ist der Rest, damit der Verrechnungslohn exakt der Kalkulation entspricht.
-- Vorbelegung = Marcos Taifun-Einstellungen (Screenshots 10.08.2026).
-- Idempotent: kann mehrfach ausgefuehrt werden. (Evtl. vorhandene Spalten efb_bgk/efb_gewinn/
-- efb_wagnis_betrieb/efb_wagnis_leistung aus einer Zwischenversion bleiben ungenutzt stehen.)

alter table public.office_offer_settings
  add column if not exists efb_bgk_lohn           numeric default 5,
  add column if not exists efb_agk_lohn           numeric default 5,
  add column if not exists efb_bgk_mat            numeric default 5,
  add column if not exists efb_agk_mat            numeric default 5,
  add column if not exists efb_bgk_geraet         numeric default 0,
  add column if not exists efb_agk_geraet         numeric default 0,
  add column if not exists efb_bgk_fremd          numeric default 0,
  add column if not exists efb_agk_fremd          numeric default 0,
  add column if not exists efb_anteil_gewinn      numeric default 50,
  add column if not exists efb_anteil_wagnis_betrieb  numeric default 25,
  add column if not exists efb_anteil_wagnis_leistung numeric default 25,
  add column if not exists efb_lohnzusatz         numeric default 15.19,
  add column if not exists efb_lohnneben          numeric default 16;

-- Kontrolle: muss 13 Zeilen zeigen
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'office_offer_settings'
  and column_name like 'efb\_%' escape '\'
  and column_name in ('efb_bgk_lohn','efb_agk_lohn','efb_bgk_mat','efb_agk_mat','efb_bgk_geraet',
    'efb_agk_geraet','efb_bgk_fremd','efb_agk_fremd','efb_anteil_gewinn',
    'efb_anteil_wagnis_betrieb','efb_anteil_wagnis_leistung','efb_lohnzusatz','efb_lohnneben')
order by column_name;
