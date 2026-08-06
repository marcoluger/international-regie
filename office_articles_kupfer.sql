-- office_articles_kupfer.sql
-- Zweck: Eigene Artikel koennen Preiseinheit und Kupferwerte mitfuehren,
--        damit "aus Artikelstamm" uebernommene Positionen (articleToItem)
--        Preiseinheit/Kupfer korrekt vorbelegen (z. B. eigener Kabel-Artikel).
-- Idempotent: kann mehrfach ausgefuehrt werden.

alter table public.office_articles
  add column if not exists preiseinheit numeric,
  add column if not exists kupfer_kg    numeric,
  add column if not exists kupfer_multi numeric;

-- Kontrolle: Spalten vorhanden?
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'office_articles'
  and column_name in ('preiseinheit', 'kupfer_kg', 'kupfer_multi')
order by column_name;
