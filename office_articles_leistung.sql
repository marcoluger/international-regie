-- office_articles_leistung.sql (Stufe 7a)
-- Zweck: Trennung Leistungen / Artikel im Stamm.
--   art         'leistung' (mit Arbeitszeit, wie bisher) | 'artikel' (reines Material)
--               Bestehende Zeilen werden automatisch 'leistung' (sie enthalten Arbeitszeit).
--   components  Stueckliste einer Leistung als JSON-Array:
--               [{id, source:'own'|'datanorm', article_id?, supplier_id?, number,
--                 short_text, unit, qty, ek, preiseinheit, kupfer_kg}]
--               Preise sind beim Einfuegen eingefroren; Knopf "Preise aktualisieren" in der App.
-- Idempotent: kann mehrfach ausgefuehrt werden.

alter table public.office_articles
  add column if not exists art        text not null default 'leistung',
  add column if not exists components jsonb;

create index if not exists office_articles_art_idx on public.office_articles(company_id, art);

-- Kontrolle: muss 2 Zeilen zeigen (art/text, components/jsonb)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'office_articles'
  and column_name in ('art', 'components')
order by column_name;
