-- office_supplier_search_index.sql (Suchindex fuer grosse Lieferanten-Kataloge)
-- Zweck: Die Katalogsuche (📦-Picker, 💡-Kandidaten aus DATANORM) sucht mit ILIKE '%...%'
--   in office_supplier_articles.short_text und article_no. Ab ~100.000 Artikeln wird das
--   ohne Index spuerbar langsam (kompletter Tabellendurchlauf je Suche).
--   pg_trgm-GIN-Indexe beschleunigen genau diese Teilwort-Suchen.
-- Idempotent: kann mehrfach ausgefuehrt werden. (Anlegen kann bei vollen Katalogen
-- eine Minute dauern - einfach warten.)

create extension if not exists pg_trgm;

create index if not exists office_supplier_articles_st_trgm
  on public.office_supplier_articles using gin (short_text gin_trgm_ops);

create index if not exists office_supplier_articles_no_trgm
  on public.office_supplier_articles using gin (article_no gin_trgm_ops);

-- Kontrolle: muss 2 Zeilen zeigen (die beiden _trgm-Indexe)
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename  = 'office_supplier_articles'
  and indexname like '%\_trgm' escape '\'
order by indexname;
