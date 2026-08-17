-- office_supplier_search_index.sql (v3 - REPARATUR: Suchindexe sicherstellen)
-- Befund 17.08.: Die Katalogsuche bricht mit "canceling statement due to statement timeout"
-- ab - die Datenbank durchsucht offenbar alle 253.000+ Katalogzeilen OHNE Index.
-- Diese Datei stellt die beiden pg_trgm-Suchindexe sicher (egal, was vorher lief),
-- entfernt eventuelle Duplikate und frischt die Planer-Statistik nach dem Grossimport auf.
-- Idempotent: kann mehrfach ausgefuehrt werden.
-- ACHTUNG: Das Anlegen der Indexe kann 1-2 Minuten dauern - warten, nicht abbrechen.

create extension if not exists pg_trgm;

create index if not exists office_supplier_articles_txt_idx
  on public.office_supplier_articles using gin (short_text gin_trgm_ops);

create index if not exists office_supplier_articles_no_idx
  on public.office_supplier_articles using gin (article_no gin_trgm_ops);

drop index if exists public.office_supplier_articles_st_trgm;
drop index if exists public.office_supplier_articles_no_trgm;

analyze public.office_supplier_articles;

-- Kontrolle 1: muss GENAU 2 Zeilen zeigen (..._txt_idx und ..._no_idx)
select indexname
from pg_indexes
where schemaname = 'public' and tablename = 'office_supplier_articles'
  and (indexname like '%txt\_idx' escape '\' or indexname like '%no\_idx' escape '\' or indexname like '%trgm%')
order by indexname;

-- Kontrolle 2: Testsuche - muss in deutlich unter 1 Sekunde ein Ergebnis liefern.
-- Dauert sie mehrere Sekunden, greifen die Indexe nicht -> bitte melden.
select count(*) as treffer_steckdose
from public.office_supplier_articles
where short_text ilike '%steckdose%';
