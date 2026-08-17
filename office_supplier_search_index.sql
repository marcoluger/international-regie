-- office_supplier_search_index.sql (v4 - REPARATUR mit Zeit-Budget und Beweis)
-- Befund: Katalogsuche bricht weiter mit "statement timeout" ab. Moeglich ist, dass die
-- Index-Erstellung selbst abgebrochen wurde (der SQL-Editor bricht lange Anweisungen ab,
-- zwei GIN-Indexe ueber 253.000 Zeilen brauchen Zeit). Diese Version genehmigt sich selbst
-- ein grosses Zeit-Budget und MISST am Ende, ob die Suche wirklich schnell ist.
-- Idempotent. Bitte KOMPLETT laufen lassen - kann einige Minuten dauern, nicht abbrechen.

set statement_timeout = '15min';

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

-- Kontrolle 2: Testsuche wie sie die App stellt, MIT Zeitmessung.
-- Im Ergebnis unten auf die Zeile "Execution Time: ... ms" achten und mir den Wert nennen.
-- Unter ~200 ms = gut. Mehrere Sekunden = Index greift nicht -> Ausgabe komplett an mich.
explain analyze
select supplier_id, article_no, short_text, unit, ek, net_ek
from public.office_supplier_articles
where (short_text ilike '%steckdose%' or article_no ilike '%steckdose%')
limit 10;
