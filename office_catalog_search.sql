-- office_catalog_search.sql (Katalogsuche als Datenbank-Funktion mit Index-Garantie)
-- Befund 17.08.: Die Suchindexe existieren und sind schnell (16 ms im Editor), aber bei den
-- App-Abfragen (Firmen-Filter + limit 10) entscheidet sich der Planer manchmal doch fuer den
-- langsamen Komplett-Scan -> statement timeout. Diese Funktion ERZWINGT den Index
-- (enable_seqscan = off gilt nur innerhalb der Funktion) - damit ist die Suche garantiert schnell.
-- RLS bleibt wirksam (security invoker). Idempotent.

create or replace function public.office_catalog_search(p_company uuid, p_pattern text, p_limit int default 10)
returns table (supplier_id uuid, article_no text, short_text text, unit text, ek numeric, net_ek numeric)
language sql
stable
security invoker
set enable_seqscan = off
as $$
  select a.supplier_id, a.article_no, a.short_text, a.unit, a.ek, a.net_ek
  from public.office_supplier_articles a
  where a.company_id = p_company
    and (a.short_text ilike p_pattern or a.article_no ilike p_pattern)
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

grant execute on function public.office_catalog_search(uuid, text, int) to authenticated;

-- Kontrolle: muss 1 Zeile zeigen (Funktion existiert, Rueckgabe = Tabelle)
select p.proname as funktion, pg_get_function_result(p.oid) as rueckgabe
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'office_catalog_search';
