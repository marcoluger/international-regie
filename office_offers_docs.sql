-- office_offers_docs.sql (Stufe 6a)
-- Zweck: Dokument-Workflow Angebot -> Auftragsbestaetigung -> Rechnung.
--   doc_type   'angebot' | 'ab' | 'rechnung' (bestehende Zeilen bleiben 'angebot')
--   parent_id  Quelldokument (Angebot bei AB, Angebot/AB bei Rechnung)
--   doc_date   Belegdatum fuer AB/Rechnung (offer_date bleibt das Angebotsdatum)
--   leistung_von/leistung_bis  Leistungszeitraum (Rechnung)
--   zahlungsziel_tage          Zahlungsziel in Tagen (Rechnung)
-- Idempotent: kann mehrfach ausgefuehrt werden.

alter table public.office_offers
  add column if not exists doc_type          text not null default 'angebot',
  add column if not exists parent_id         uuid,
  add column if not exists doc_date          date,
  add column if not exists leistung_von      date,
  add column if not exists leistung_bis      date,
  add column if not exists zahlungsziel_tage int;

create index if not exists office_offers_doctype_idx on public.office_offers(company_id, doc_type);
create index if not exists office_offers_parent_idx  on public.office_offers(parent_id);

-- Kontrolle
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'office_offers'
  and column_name in ('doc_type','parent_id','doc_date','leistung_von','leistung_bis','zahlungsziel_tage')
order by column_name;
