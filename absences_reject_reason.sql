-- Grund der Ablehnung bei Urlaubsanträgen. In Supabase → SQL Editor ausführen.
alter table absences
  add column if not exists reject_reason text;
