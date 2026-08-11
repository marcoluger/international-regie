-- office_number_ranges.sql (Nummernkreise je Dokumentart)
-- Zweck: Neue Dokumente ohne manuell eingetragene Nummer bekommen beim ersten Speichern
--   automatisch die naechste Nummer ihrer Dokumentart. Die Vergabe passiert atomar in der
--   Datenbank (eine Anweisung) - keine Doppelvergabe, auch nicht bei zwei Browsern gleichzeitig.
--   next_number = die Nummer, die als NAECHSTES vergeben wird (in den ⚙️-Einstellungen aenderbar).
-- Startwerte (7-stellig, an der ersten Ziffer erkennbar):
--   Angebote ab 1000001 · Auftragsbestaetigungen ab 2000001 · Rechnungen ab 3000001
-- Idempotent: kann mehrfach ausgefuehrt werden.

create table if not exists public.office_number_ranges (
  company_id  uuid not null,
  doc_type    text not null,               -- 'angebot' | 'ab' | 'rechnung'
  next_number bigint not null,             -- naechste zu vergebende Nummer
  updated_at  timestamptz not null default now(),
  primary key (company_id, doc_type)
);

alter table public.office_number_ranges enable row level security;
drop policy if exists office_number_ranges_rw on public.office_number_ranges;
create policy office_number_ranges_rw on public.office_number_ranges for all
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_number_ranges.company_id and cu.role in ('owner','admin')))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = office_number_ranges.company_id and cu.role in ('owner','admin')));

-- Atomare Vergabe: legt den Kreis beim ersten Aufruf mit dem Startwert an, sonst zaehlt er hoch.
-- Gibt die vergebene Nummer zurueck. security invoker: RLS gilt (nur owner/admin der Firma).
create or replace function public.office_next_number(p_company uuid, p_doc_type text)
returns bigint
language sql
security invoker
as $$
  insert into public.office_number_ranges as r (company_id, doc_type, next_number)
  values (
    p_company, p_doc_type,
    1 + case p_doc_type when 'angebot' then 1000001 when 'ab' then 2000001 when 'rechnung' then 3000001 else 1000001 end
  )
  on conflict (company_id, doc_type)
  do update set next_number = r.next_number + 1, updated_at = now()
  returning next_number - 1;
$$;

grant execute on function public.office_next_number(uuid, text) to authenticated;

-- Kontrolle: muss 2 Zeilen zeigen (Spalte next_number/bigint, Funktion -> bigint)
select 'Tabelle office_number_ranges' as objekt, data_type as typ
from information_schema.columns
where table_schema = 'public' and table_name = 'office_number_ranges' and column_name = 'next_number'
union all
select 'Funktion office_next_number', pg_get_function_result(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'office_next_number';
