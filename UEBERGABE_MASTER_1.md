# ÜBERGABE – „Regie International" (regiebericht-translator)

**Stand: 06.08.2026** · Ersetzt die Übergabe vom 03.08.2026. Konsolidiert aus der alten
Master-Übergabe + der Sitzung vom 06.08.2026 (Dashboard-Fix, Reparatur Büro-Dateien, Stufe 6a).

> **Für den neuen Chat:** Diese Datei zuerst vollständig lesen. Abschnitt 2 (Arbeitsweise +
> PC-Verbindung) zuerst klären. Danach Abschnitt 9 („SOFORT PRÜFEN") abarbeiten, dann Abschnitt 8.

---

## 1. Was ist das Projekt

Mehrsprachige SaaS-Web-App für Elektro- und Bauunternehmen. Zielkunde: **Elektrotechnik Luger**
(slug `elluger`, `company_id` `16903bea-ee2b-41e7-962f-982a9e9d738f`), Testfirma **TestLuger**
(slug `ttluger`). Ziel: verkaufbares Mehrmandanten-Produkt.

| Bereich | Route | Zweck |
|---|---|---|
| **Regie-App** | `/` | Arbeitsanweisungen, Regieberichte, Module (Baustellenbetrieb) |
| **Büro-App** | `/buero` | Angebote → AB → Rechnung, Artikelstamm, DATANORM (kaufmännisch) |

**Tech-Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Supabase (DB/Auth,
`service_role` in API-Routen), OpenAI `gpt-4o-mini` (`translation_cache`), jsPDF, Resend, QRCode,
Upstash Redis. PWA. Vercel → `international-regie.vercel.app`.
Repo `github.com/marcoluger/international-regie`, lokal `D:\regiebericht-translator`.
Supabase-Projekt `rrgmmuxkzxjsneuakrde`. E-Mail-Domain `regie-international.eu`.
Interne Auth-Adressen `{slug}.{username}@regie-internal.app`.

**Umgebung Marco:** Windows, PowerShell, VS Code, Firefox (private Fenster zum Testen nach Deploy).
**Alle Kommunikation und Codeauslieferung auf Deutsch.** Marco will ehrliche Risikoeinschätzung.
17 UI-Sprachen; Freitexte werden live übersetzt.

---

## 2. Arbeitsweise + PC-Verbindung (ZUERST KLÄREN)

### Modus A – mit Geräte-Bridge (`mcp__remote-devices__*`) — Standard, wenn verfügbar
So wurde am 06.08. gearbeitet. Ablauf im neuen Chat:
1. **Verbindung aufbauen:** `device_list_dir` auf `D:\regiebericht-translator` liefert erst nur ein
   Namens-Skelett → `device_request_folder_access` mit diesem Pfad → Marco bestätigt am PC.
   Danach voller Zugriff (stage/commit) für die Sitzung.
2. Quellen per `device_stage_files` nach `/mnt/user-data/uploads/regiebericht-translator/` holen.
3. Cloud-Build-Ordner `/root/rb` aufbauen: Root-Configs (`package.json`, `package-lock.json`,
   `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`,
   `.env.local`) + `app/**` + `lib/rateLimit.ts`, **ohne** `node_modules`/`.next`; `npm install`;
   `chmod -R u+w /root/rb` (gestagte Dateien kommen read-only an).
4. Editieren, dann **`npx tsc --noEmit` grün** UND **`npm run build` grün** (Stand 06.08.: **27/27**
   static pages, nicht mehr 25).
5. `SendUserFile`, dann `device_commit_files` zurück nach `D:\...` (gern mit `expectedMtimeMs`).
6. **Verifizieren (Pflicht, Mount-Cache!):** gestagte Kopie im Container **löschen** (`rm`), neu
   stagen, per `cmp` gegen `/root/rb` prüfen. Am 06.08. lieferte die Bridge einmal eine alte
   64-kB-Kopie, obwohl die neue 16-kB-Datei längst auf der Platte lag.
7. Marco bekommt: **1) SQL zuerst in Supabase**, **2) Git-Befehle einzeln**, **3) nach Deploy
   Vercel-Grün abwarten + PWA neu starten + privates Firefox-Fenster.**

**Bridge-Abrisse (am 06.08. mehrfach passiert):**
- Fehlerbild: „The device this session is bound to is not connected to the bridge" oder die
  `device_*`-Tools verschwinden ganz aus der Tool-Liste.
- Reihenfolge: `RefreshMcpTools` für `remote-devices` → Tools per ToolSearch neu laden → 1× erneut
  versuchen. **Nicht in Schleife hämmern.**
- **Eine laufende Cloud-Sitzung bekommt die Verbindung u. U. auch nach App-Neustart NICHT wieder**
  (so am Ende der 06.08.-Sitzung). Dann Fallback Modus B. Ein **neuer Chat** verbindet sich
  normalerweise wieder sauber (deshalb diese Übergabe).
- Falls es dauerhaft klemmt: Marco kann eine neue Cowork-Aufgabe direkt „auf dem Computer" starten
  (Desktop-App, „Run this task"-Auswahl oben rechts beim Anlegen).

### Modus B – ohne Bridge (Fallback)
1. Auslieferung als Chat-Download (`SendUserFile`), Marco kopiert selbst.
2. **Download-Falle (am 06.08. wieder passiert):** Im Chat liegen mehrere Versionen derselben Datei!
   Immer NUR die neueste nehmen; vorher `Remove-Item "$env:USERPROFILE\Downloads\<name>*"`;
   nach dem Kopieren mit `Select-String` + Zeilenzahl verifizieren (Referenzwerte s. Abschnitt 3).
   VS Code vorher schließen (alter Editor-Puffer kann die Kopie wieder überschreiben).
3. Kein Cloud-Build-Gate möglich → ehrlich sagen; `npm run build` bei Marco ist die Absicherung.

**Build-Hürden in der Sandbox (nur lokal, NIE committen):**
- `app/layout.tsx` lädt Geist-Fonts über `next/font/google` → Sandbox erreicht Google nicht →
  temporär Offline-Layout einsetzen, bauen, **Original wiederherstellen**.
- `.env.local` von der Platte für „Collecting page data", nach dem Build löschen.
- Supabase ist aus der Sandbox nicht erreichbar → keine Live-DB-Tests, immer dazusagen.

### Antwortstil
Kurz, Deutsch, Git-Befehle **einzeln** (PowerShell bricht Blöcke um, kein `&&`). SQL immer klar als
„zuerst in Supabase ausführen" markieren. Deploy-Sequenz:
```
npm run build
git add -A
git commit -m "..."
git push
```
`git add -A` ist seit 06.08. wieder gefahrlos: `.gitignore` enthält jetzt **`/Datanorm/`**
(555-MB-Rexel-Datei kann nicht mehr ins Repo rutschen). Bei `git gc`-Meldung
„Unlink of file ... .idx failed (y/n)": y versuchen, sonst n – harmlos, Commit ist davon unabhängig.

---

## 3. Technischer Aufbau + Referenzwerte (Stand 06.08.)

### Dateien (mit Prüfwerten zum Verifizieren nach Kopien)
- **`app/page.tsx`** – **9.443 Zeilen / 690.623 Bytes**, jetzt **reine LF-Datei (0 CR, kein BOM)** –
  die alte CRLF-Warnung ist überholt; byte-genaues Zurückschreiben aus der Cloud ist ok.
  Enthält die gesamte Regie-App: `texts` (17 Sprachblöcke), `EXTRA_LABELS` (72 Schlüssel je Sprache),
  `pdfTexts`. Zugriff `const t = texts[uiLanguage]`, `const tx = EXTRA_LABELS[uiLanguage] || EXTRA_LABELS.Deutsch`.
- **`app/buero/Angebote.tsx`** – **887 Zeilen / 72.411 Bytes**, `function uid()` in Zeile 12
  (md5 `78db2022a566397986ad08de23fa1c30`). Dokument-Workflow s. Abschnitt 6.
- **`app/buero/page.tsx`** – 547 Zeilen; Reiter `angebote`/`ab`/`rechnung` rendern alle
  `<Angebote doc="angebot|ab|rechnung">` (Platzhalter entfernt).
- **`app/api/update-task-status/route.ts`** – **neu 06.08.**, 163 Zeilen; s. Abschnitt 4.
- Weitere Büro-Dateien: `angebotPdf.ts` (16.674 Bytes, **wiederhergestellt**, s. Abschnitt 7),
  `efbPdf.ts`, `gaebImport/Export.ts`, `Artikel.tsx` (mit Preiseinheit/Kupfer-Feldern + 
  Lieferanten-Warnung beim Import), `datanormParse.ts`, `lugerLogo.ts`.
- `app/api/*/route.ts` – Ordner + Datei, nie flach. `lib/rateLimit.ts`.
- ESLint ist kein Build-Gate, **TypeScript-Fehler schon**. Vor Auslieferung Klammerbilanz prüfen.

### Regie-App-Mechanik (unverändert wichtig)
- `refreshActiveTab()` lädt bei Tab-Wechsel + Browser-Fokus; **ausgenommen `regiebericht` und `tag`**.
- Autosave Regiebericht (~2 s, `reportDirty`), Autosave Zeiten (1200 ms), Pausen-Vorschlag >6 h/9 h.
- Übersetzung: `refreshCommentTranslations`, `getTranslated*`, PDFs übersetzen zur Erzeugungszeit.
- Neue Labels in 17 Sprachen: Node-Skript, `changed === 17` prüfen. Nie deutsche Strings hart in die UI.

---

## 4. Rollen, Rechte, Status-Logik (Regie)

Rollen `owner/admin/project_manager/employee` + Flag `read_only`. Definition „Nur lesen":
eigene Stunden/Zeiten/Berichte **erlaubt**, Kommentare/Status/Material/Urlaub gesperrt
(UI + Routen + RLS). **Nicht zurückbauen.**

### Arbeitsschritt-Status (neu seit 06.08.)
- **`/api/update-task-status`** (POST `{taskId, status}`): erlaubte Status
  `open|in_progress|completed|stopped`. Prüfungen: Bearer-Token, Firmenzugehörigkeit,
  `read_only` → 403, Rolle Manager ODER Bauleiter (`foreman_user_ids`).
- **Erledigt-Propagation:** Bei `completed` werden im selben Projekt (project_id, sonst
  Projekt-Text) alle **älteren** Kopien desselben Schritts (Textvergleich normalisiert:
  trim/lowercase/Mehrfach-Leerzeichen; `work_date <= Stichtag`) mit auf `completed` gesetzt.
  Hintergrund: „Schritte aus Anweisung übernehmen" kopiert nur Text → unverknüpfte Duplikate.
  Antwort enthält `propagated` (Anzahl).
- `updateTaskStatus` in `page.tsx` ruft die Route (Muster wie `deleteTaskComment`: `tokenRef`,
  `withTimeout` 15 s). Der frühere Client-Direktzugriff ist weg → Rechte-Lücke geschlossen.
- Einmalige Alt-Bereinigung: `tasks_complete_older_copies.sql` (**ausgeführt am 06.08.**).

### Dashboard (neu seit 06.08.)
- Eine Anweisung ist „relevant", wenn sie im Zeitfenster liegt ODER überfällige offene Schritte hat.
  Von relevanten Anweisungen zählen **alle** Schritte in „x / y fertig" (vorher fielen erledigte
  überfällige ersatzlos raus → Zähler blieb 0).
- Je Projekt aufklappbare Zeile „▸ ✅ n fertig" (`openDashDone`) mit durchgestrichenen erledigten
  Schritten. Projekte mit nur-erledigten relevanten Schritten werden angezeigt; komplett erledigte
  ALTE Anweisungen fallen weiterhin raus (nichts sammelt sich ewig an).

### RLS
- `work_instruction_tasks`: SELECT-Policy (Firma) + ALL-Policy (Firma + Rollen + `NOT read_only`,
  `tasks_readonly_policy.sql`).
- `office_*`: RLS-Muster `role in ('owner','admin')`. `company_features` niemals client-beschreibbar.

---

## 5. SQL-Migrationen

Alle idempotent, Repo-Wurzel, Marco führt sie im Supabase-SQL-Editor aus (VOR abhängigem Code).

**Regie:** `absences_reject_reason` · `app_pricing` · `equipment_km` · `equipment_plan` ·
`phonelist_module` · `projects_archive` · `reports_archive` · `site_agb` · `tasks_readonly_policy` ·
`work_instruction_times` · `work_instructions_address2` · `work_instructions_foreman` ·
**`tasks_complete_older_copies`** *(neu 06.08., einmalige Bereinigung, ausgeführt)*

**Büro:** `office_area` · `office_articles` · **`office_articles_kupfer`** *(neu 06.08., ausgeführt:
preiseinheit/kupfer_kg/kupfer_multi an office_articles)* · `office_customers(+import)` ·
`office_datanorm` · `office_module` · `office_offer_kupfer` · `office_offer_settings` ·
`office_offer_tax` · `office_offer_texts(+lib)` · `office_offers` · `office_offers_multi` ·
**`office_offers_docs`** *(neu 06.08., Stufe 6a: doc_type, parent_id, doc_date, leistung_von/bis,
zahlungsziel_tage + Indizes — Ausführung in Supabase im nächsten Chat VERIFIZIEREN, s. Abschnitt 9)*

---

## 6. Funktionsstand Büro-App

Stufen 1–5c wie gehabt (Angebote komplett, Angebots-PDF Luger-Layout, GAEB X83/X84, EFB 221/222/223,
Artikelstamm, DATANORM-Import mit Batch/Rabattdateien, Picker mit Katalog-Suche
(Platzhalter `*`, nicht `%`), Kupferzuschlag in Kalkulation/PDF/EFB/GAEB).

### Neu: Stufe 6a – Dokument-Workflow (06.08., Code fertig + grün gebaut)
- `office_offers.doc_type` `'angebot'|'ab'|'rechnung'`, `parent_id` (Quelle), `doc_date`,
  `leistung_von/bis`, `zahlungsziel_tage`.
- Büro-Reiter **📋 Auftragsbestätigung** und **💶 Rechnung** zeigen echte Listen (gleiche Komponente,
  `doc`-Prop). „＋ Neues Angebot" + ⚙️ Einstellungen nur im Angebote-Reiter.
- **„→ AB"** am Angebot, **„→ Rechnung"** an Angebot und AB — in der **Liste** und im
  **Editor-Kopf** (Editor-Knöpfe erst aktiv, wenn gespeichert). **„⧉ Duplizieren"** als Vorlage
  (ohne Nummer/Verweis). Kopien bekommen neue Item-IDs.
- Editor je Art: Titel, Belegdatum statt Bindefrist (AB/RE), Status-Auswahl je Art
  (Angebot: entwurf/versendet/beauftragt/abgelehnt · AB: …/bestätigt · Rechnung: …/bezahlt),
  Rechnung: Leistungszeitraum + Zahlungsziel mit „fällig am". Bezugszeile „Erstellt aus … [öffnen]".
- Nummern: Freitext, bei Ableitung wird die Quellnummer als Vorschlag übernommen.
  **Nummernkreise bewusst verschoben** (Marco: „machen wir später").
- PDF/EFB-Knöpfe nur beim Angebot — **6b (AB-PDF)** und **6c (Rechnungs-PDF)** sind die nächsten Stufen.
- Wichtige interne Helfer in `Angebote.tsx`: `DOC_LABEL/DOC_ICON/DOC_STATUS`, `rowToState()`,
  `deriveDoc(row, typ)`, `duplicateDoc(row)`; `blankOffer()` um die 6a-Felder erweitert;
  `saveOffer()` speichert sie.

### Kalkulation (unverändert)
`calcItem`: Mat-Vk = mat_ek×mat_multi×verschnitt/pe · Lohn-Vk = lohn_ek×lohn_multi×min/60 ·
Kupfer-Vk = kupfer_kg×del×kupfer_multi/pe · GP = EP×qty×(1−rabatt). **Dieselbe Logik in
`angebotPdf.ts`, `efbPdf.ts`, `gaebExport.ts`** – bei 6b/6c-PDFs ebenfalls einhalten!
`articleToItem` übernimmt seit 06.08. auch `preiseinheit/kupfer_kg/kupfer_multi` eigener Artikel
(+ `settings.def_kupfer_multi` als Fallback).

### DATANORM / Rexel (Stand 06.08.)
- Kataloge: BTI (v4, 53.871 Artikel) · Pferdekämpfer (v5, 12.589) · Rexel nur Preise/Rabatte.
- **Rexel `DATANORM.089` (555 MB) ist NUR die Langtext-Datei**: V-Satz (Rexel Germany, v4, EUR)
  + 5,33 Mio. T-Sätze (~679k Artikel) + 679k A-Verknüpfungssätze (`A;A;<nr>;40;;;;;;;;;<nr>;`).
  **Keine Kurztexte, keine Mengen-/Preiseinheit, keine Preise, keine Artikel-Kupferzahl**
  („Cu-Basis 150,-/100 kg" ist nur die Preislisten-Basis). NICHT in der App importieren.
- **Nächster Schritt Rexel:** Mail an **Datanorm.support@Rexel.de** (Kundennr. **9418280**) mit
  Bitte um die DATANORM-4-**Artikelstammdatei** (Kurztexte, Mengen-/Preiseinheit). Alternativ in
  Taifun prüfen, woher dort Rexel-Bezeichnungen kommen (vermutlich Open Masterdata/Onlineabruf
  oder alter Katalogstamm — Taifun zaubert aus Preis+Rabatt allein auch keine Namen).
- Hilfsdateien in `Datanorm\Rexel\` (`rexel_samples.ps1`, `rexel_scan.ps1`, `SAMPLE_*.dat`,
  `REXEL_SCAN.txt`) können gelöscht werden; ganzer Ordner ist per `.gitignore` vom Repo ausgenommen.

---

## 7. Vorfall vom 03.08. (repariert, als Lehre dokumentiert)

Beim Sitzungsende 03.08. wurde die **neue Angebote-Komponente versehentlich nach
`app/buero/angebotPdf.ts` geschrieben** (PDF-Generator überschrieben) und so **committet + gepusht**
(Commit `1254157`) → Vercel-Build war rot, App lief auf letztem grünem Stand. Zusätzlich fehlte die
SQL für die neuen Artikelfelder. Reparatur am 06.08.:
`git restore --source=f551782 -- app/buero/angebotPdf.ts` (letzter guter Stand), gerettete
Komponente nach `Angebote.tsx`, `office_articles_kupfer.sql` nachgeliefert.
**Lehre:** Nach jeder Auslieferung Ziel-Pfade doppelt prüfen; nach Push Vercel-Status ansehen;
`git log --oneline -- <datei>` findet den letzten guten Stand.

---

## 8. Offene Punkte

### Büro-App (aktueller Fokus)
1. **Stufe 6b: AB-PDF** – Luger-Layout wie Angebots-PDF, Titel „Auftragsbestätigung", Bezug auf
   Angebotsnummer (parent), ohne Bindefrist. Gleiche Kupfer-/Kalkulationslogik.
2. **Stufe 6c: Rechnungs-PDF** – Rechnungsnr., Leistungszeitraum, Zahlungsziel/Fälligkeit, Skonto,
   Steuer-Ausweisung je Modus (19 % / PV 0 % §12 / §13b-Hinweis), Bezug auf AB/Angebot.
3. **Nummernkreise** (von Marco bewusst verschoben): je Dokumentart 7-stellig fortlaufend,
   Startwerte legt Marco fest. Geparkt außerdem: Debitor 10001–11012 (Ausreißer 1077, 99999),
   Kreditor 70001–70266, Auto-Increment ≥90000 ausschließen.
4. **Rexel-Artikelstamm** (s. Abschnitt 6, Mail an Rexel-Support).
5. Danach: Übernahme in Projekt / Nachkalkulation Soll-Ist gegen Regie-Daten; KI-Preis/Zeit-Vorschlag;
   Aufmaß-Beleg; Nachtragsangebot; Abschlagsrechnungen (Zahlungsplan) als eigene Stufe.

### Regie-App
- „Weniger Klicks": Mitarbeitername fest aus Login; Auto-Speichern vor PDF/Versand;
  Pflichtfeldprüfung; doppelte Berichtsnamen auch im normalen Speichern verhindern.
- Fest verdrahtete deutsche Texte auf Admin-/Login-Bildschirmen ggf. in 17 Sprachen.
- Passwort-Mindestlänge; Klartext-Passwortanzeige härten; Rate-Limiting auf allen Routen;
  AVV/Datenschutz; In-App-Anleitung 17 Sprachen; restliche Client-Direktzugriffe per RLS absichern;
  PDF-Unicode über alle 17 Sprachen nachvalidieren.
- Idee aus 06.08.: „Aufgabe gilt tagesübergreifend" statt Kopien beim Übernehmen (langfristig
  sauberer als Text-Matching der Propagation).

---

## 9. SOFORT PRÜFEN im neuen Chat (Sitzungsende 06.08. war nicht ganz bestätigt)

Die Sitzung endete, während Marco Stufe 6a lokal einspielte. Der letzte Stand:
1. Dashboard-Fix + Status-Route: committet (`a42e2cc`), gepusht, **Vercel grün, SQLs ausgeführt** ✓.
2. Stufe 6a: Dateien wurden per Bridge auf die Platte geschrieben und verifiziert
   (`Angebote.tsx`, `app/buero/page.tsx`, `office_offers_docs.sql`). Danach kam noch eine
   **letzte `Angebote.tsx`-Version** (Editor-Knöpfe „→ AB"/„→ Rechnung") — die Bridge war da tot,
   Marco hat sie **manuell kopiert**; sein erster Versuch erwischte eine falsche Datei
   (`Cannot find name 'uid'`). Die korrekte Version: **887 Zeilen, 72.411 Bytes,
   `function uid` in Zeile 12**.

**Checkliste Start neuer Chat:**
- [ ] Bridge aufbauen (Abschnitt 2), dann `git status` + `git log --oneline -3` zeigen lassen:
      Ist der 6a-Commit da und gepusht? Vercel grün?
- [ ] `Select-String -Path app\buero\Angebote.tsx -Pattern "function uid"` → 1 Treffer, Zeile 12;
      Zeilenzahl 887. Falls nicht: Datei liegt korrekt in HEAD, sonst neu ausliefern.
- [ ] In Supabase prüfen, ob `office_offers_docs.sql` gelaufen ist (Kontroll-SELECT am Dateiende
      muss 6 Spalten zeigen). Ohne diese SQL schlägt das Speichern von AB/Rechnung fehl!
- [ ] Kurztest: Angebot → „→ AB" → speichern → Reiter AB → „→ Rechnung" → Felder Leistungszeitraum/
      Zahlungsziel → speichern. Dashboard-Test Regie: Schritt „Erledigt" → ältere Kopien gehen mit.
- Danach weiter mit **Stufe 6b (AB-PDF)**.

---

## 10. Grundprinzipien

1. **Regie-App bleibt sauber** – Neues isoliert in `/buero` + `office_*`. `page.tsx` minimal anfassen.
2. **In Stufen bauen**, jede Stufe grün vor der nächsten.
3. **RLS ist die Sicherheitsgrundlage**; `company_features` nie client-beschreibbar.
4. **Cleane Produktentscheidung vor minimalem Patch.**
5. **Ehrlich sein, was nicht geprüft werden konnte** (kein DB-Zugriff aus der Sandbox!).
6. **Klammerbilanz + Referenz-Zeilenzahlen prüfen** vor jeder Auslieferung.
7. **Nach Auslieferung verifizieren** (re-stagen + cmp bzw. Select-String bei Handkopien).

*Ende der Übergabe. Im neuen Chat: Abschnitt 2 (Bridge), Abschnitt 9 (Checkliste), dann Stufe 6b.*
