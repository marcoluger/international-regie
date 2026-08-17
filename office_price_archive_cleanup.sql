-- office_price_archive_cleanup.sql (OPTIONAL - KI-Testwerte aus dem Preisarchiv entfernen)
-- Hintergrund: Beim Speichern der Test-Angebote sind auch KI-geschaetzte Preise ins
-- Preisarchiv gewandert (z. B. Steckdose 6,40 EUR, Durchgangsklemmen 1,28 EUR). Diese
-- Eintraege liefern jetzt "Archiv 100 %"-Treffer mit falschen Preisen.
-- Unterscheidung: App-gespeicherte Angebote haben source_ref GESETZT, die guten
-- Taifun-Excel-Importe haben source_ref = NULL - die bleiben unberuehrt.
--
-- SCHRITT 1 (nur ansehen): Wie viele Eintraege kaemen weg?
select count(*) as app_angebots_eintraege_wuerden_geloescht
from public.office_price_archive
where source_ref is not null;
--
-- SCHRITT 2 (erst ausfuehren, wenn die Zahl plausibel ist - z. B. die Positionen deiner
-- Test-Angebote). Loescht NUR die aus App-Angeboten synchronisierten Eintraege:
-- delete from public.office_price_archive where source_ref is not null;
--
-- Hinweis: Nach dem Loeschen beim naechsten Speichern eines ECHTEN Angebots fuellt sich
-- das Archiv wieder korrekt. Wenn du einzelne Test-Leistungen auch aus dem 🔧-Stamm
-- entfernen willst (Kategorie "Aus Angebot"), geht das im Reiter Leistungen von Hand.
