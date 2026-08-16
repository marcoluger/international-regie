-- office_supplier_search_index.sql (KORREKTUR - Duplikat-Indexe entfernen)
-- Hintergrund: office_datanorm.sql legt die Suchindexe fuer die Katalogsuche
--   (pg_trgm-GIN auf short_text und article_no) BEREITS an:
--   office_supplier_articles_txt_idx und office_supplier_articles_no_idx.
--   Eine fruehere Version dieser Datei hat versehentlich zwei DUPLIKATE angelegt
--   (..._st_trgm / ..._no_trgm). Doppelte Indexe bringen nichts, kosten Platz und
--   bremsen jeden Import. Diese Datei entfernt die Duplikate wieder.
-- Idempotent: kann mehrfach ausgefuehrt werden (auch wenn die Duplikate nie angelegt wurden).

drop index if exists public.office_supplier_articles_st_trgm;
drop index if exists public.office_supplier_articles_no_trgm;

-- Kontrolle: muss GENAU 2 Zeilen zeigen (txt_idx und no_idx - die Original-Suchindexe)
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename  = 'office_supplier_articles'
  and (indexname like '%trgm%' or indexname like '%txt_idx' or indexname like '%no_idx')
order by indexname;
