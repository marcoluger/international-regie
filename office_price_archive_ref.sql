-- office_price_archive_ref.sql
-- Zweck: In der App gespeicherte Angebote fliessen automatisch ins Preisarchiv.
--   source_ref = ID des Angebots (office_offers.id). Beim erneuten Speichern werden
--   die Archivzeilen dieses Angebots ersetzt (kein Duplizieren).
-- Idempotent: kann mehrfach ausgefuehrt werden.

alter table public.office_price_archive
  add column if not exists source_ref uuid;

create index if not exists office_price_archive_ref_idx
  on public.office_price_archive(company_id, source_ref);

-- Kontrolle: muss 1 Zeile zeigen (source_ref / uuid)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'office_price_archive'
  and column_name  = 'source_ref';
