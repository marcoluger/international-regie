-- Archiv für Regieberichte. In Supabase → SQL Editor ausführen.
alter table reports
  add column if not exists archived boolean not null default false;

create index if not exists idx_reports_archived on reports (archived);
