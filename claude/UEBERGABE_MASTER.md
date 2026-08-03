# ÜBERGABE – „Regie International" (regiebericht-translator)

**Stand: 03.08.2026** · Konsolidiert aus `claude/UEBERGABE.md` (Regie-App), der Büro-Übergabe
(Stufe 5c) und der Sitzung vom 03.08.2026.

> **Für den neuen Chat:** Diese Datei zuerst vollständig lesen. Sie ist die maßgebliche Quelle.
> Abschnitt 2 (Arbeitsweise) entscheidet, wie gearbeitet werden kann – zuerst prüfen, welche
> Werkzeuge verfügbar sind.

---

## 1. Was ist das Projekt

Mehrsprachige SaaS-Web-App für Elektro- und Bauunternehmen. Zielkunde: **Elektrotechnik Luger**
(slug `elluger`, `company_id` `16903bea-ee2b-41e7-962f-982a9e9d738f`), Testfirma **TestLuger**
(slug `ttluger`). Ziel: verkaufbares Mehrmandanten-Produkt.

**Zwei Bereiche:**

| Bereich | Route | Zweck |
|---|---|---|
| **Regie-App** | `/` | Arbeitsanweisungen, Regieberichte, Module (Baustellenbetrieb) |
| **Büro-App** | `/buero` | Angebote, Artikelstamm, DATANORM-Kataloge (kaufmännisch) |

**Kernfunktionen Regie-App**
- **Arbeitsanweisungen** mit Arbeitsschritten, Kommentaren, Fotos, Zuweisung an Mitarbeiter/
  Projektleiter/Owner/Admin; Umfang „Ein Tag" oder „Ganze Woche" (KW-Dropdown).
- **Regieberichte**: Stunden, Pause, Fahrzeit, km pro Tag – erfassen, übersetzen, als PDF/E-Mail
  ausgeben, archivieren; Autosave; Unterschriften.
- **Zeiterfassung je Anweisung** („⏱️ Meine Zeiten", Tagesansicht) mit Autosave und Übernahme in
  den Regiebericht.
- **Module** (je Firma im Admin freischaltbar): Fahrzeuge & Werkzeuge, Materialstamm/Bestellungen,
  Stundenexport, Urlaub & Abwesenheit, Live-Übersetzer, Kommentar-Chat, Fotos, Unterschriften,
  E-Mail, Telefonliste, KI-Mehrsprachigkeit, Büro.
- **17 Sprachen** vollständig übersetzt + Live-KI-Übersetzung freier Texte.

**Tech-Stack**
Next.js 16 (App Router, Turbopack), React 19, TypeScript, Supabase (DB/Auth, `service_role` in
API-Routen), OpenAI `gpt-4o-mini` (mit `translation_cache`), jsPDF ^4.2.1, Resend, QRCode,
Upstash Redis (Rate-Limit). PWA. Deployment: Vercel → `international-regie.vercel.app`.
Repo: `github.com/marcoluger/international-regie`, lokal `D:\regiebericht-translator`.
Supabase-Projekt: `rrgmmuxkzxjsneuakrde`. E-Mail-Domain `regie-international.eu`.
Interne Auth-Adressen: `{slug}.{username}@regie-internal.app`.

**Umgebung Marco:** Windows, PowerShell, VS Code, Firefox (private Fenster zum Testen nach Deploy).
**Alle Kommunikation und Codeauslieferung auf Deutsch.** Marco will ehrliche Risikoeinschätzung
statt Beschwichtigung.

---

## 2. Arbeitsweise – ZUERST PRÜFEN, WAS VERFÜGBAR IST

Es gab bisher **zwei unterschiedliche Arbeitsmodi**. Welcher gilt, hängt von den Werkzeugen im
jeweiligen Chat ab. Das zu Beginn klären, sonst entstehen falsche Zusagen.

### Modus A – mit Geräte-Bridge (`mcp__remote-devices__*`)
Wenn diese Werkzeuge vorhanden sind, gilt der Zyklus aus den alten Übergaben:
1. Quellen von `D:\regiebericht-translator\...` per `device_stage_files` nach
   `/mnt/user-data/uploads/regiebericht-translator/` holen. **Größe prüfen** – die erste Kopie ist
   manchmal veraltet/abgeschnitten. `app/page.tsx` ist ~9.390 Zeilen / ~696 KB.
2. Cloud-Build-Ordner `/root/rb` aufbauen (Root-Configs + `app/**` + `lib/rateLimit.ts`,
   **ohne** `node_modules`/`.next`), `npm install`.
3. Editieren, dann **`npx tsc --noEmit` grün** UND **`npm run build` grün** (25/25 static pages).
4. `SendUserFile`, danach `device_commit_files` zurück nach `D:\...` (Pfade doppelt prüfen).
5. Verifizieren: gestagte Kopie löschen, neu stagen, per `cmp` gegen `/root/rb` prüfen
   (Bridge-Schreibverzögerung + Mount-Cache).
6. Marco bekommt: **1) ggf. SQL zuerst in Supabase**, **2) Git-Befehle**, **3) nach Deploy PWA neu starten.**

**Build-Hürden in der Sandbox (nur lokal, NIE committen):**
- `app/layout.tsx` lädt `Geist`/`Geist_Mono` über `next/font/google` → Sandbox erreicht Google Fonts
  nicht → Build bricht ab. Temporär auf Offline-Layout umstellen, bauen, **Original wiederherstellen**.
- `.env.local` wird für „Collecting page data" gebraucht; von der Platte kopieren, nach dem Build löschen.
- **Supabase ist aus der Sandbox nicht erreichbar** (nicht in der Egress-Allowlist) → keine Live-DB-Tests.

### Modus B – ohne Bridge (Sitzung vom 03.08.2026)
Keine `mcp__remote-devices__*`-Werkzeuge, kein `/root/rb`, kein `node_modules`. Dann:
1. **Marco lädt die betroffenen Dateien hoch.** Bei `page.tsx` reicht oft eine gezielte
   `Select-String`-Trefferliste statt der ganzen 696-KB-Datei.
2. **Kein Build-Gate in der Cloud.** Ehrlich sagen: `npm run build` bei Marco lokal ist die einzige
   Absicherung vor dem Push.
3. Auslieferung nach `/mnt/user-data/outputs/` **und `present_files` aufrufen** – ohne diesen Aufruf
   hat Marco keinen Download-Link (ist in dieser Sitzung einmal schiefgegangen).
4. **Bei kleinen Änderungen ist ein In-Place-Patch besser als die komplette Datei** (s. Abschnitt 7,
   Zeilenenden).

### Antwortstil
Kurz, auf Deutsch, mit den Git-Befehlen. Bei SQL-Änderungen immer darauf hinweisen, dass die SQL
**zuerst in Supabase** ausgeführt werden muss. Klar trennen zwischen „das ist SQL zum Ausführen"
und „das ist das erwartete Ergebnis" – ist in dieser Sitzung einmal verwechselt worden.

### PowerShell-Deploy-Sequenz (getrennte Zeilen, kein `&&`)
```
npm run build
git add -A
git commit -m "..."
git push
```

---

## 3. Technischer Aufbau

### Dateien
- **`app/page.tsx`** – ~9.390 Zeilen, die gesamte Regie-App als eine große Client-Komponente:
  - `texts` – 17 Sprachblöcke (Haupt-UI-Strings), Zugriff `const t = texts[uiLanguage]`
  - `EXTRA_LABELS` – zweites 17-Sprachen-Objekt (Zusatzlabels), Zugriff
    `const tx = EXTRA_LABELS[uiLanguage] || EXTRA_LABELS.Deutsch`; 72 Schlüssel je Sprache,
    alle 17 identisch, keine Leerwerte (verifiziert)
  - `pdfTexts` – Labels für PDFs
- **`app/admin/page.tsx`** – Admin-Seite (Firmen, Modul-Toggles, Preisrechner, AGB, Bedienungsanleitung)
- **`app/buero/*`** – Büro-Bereich: `page.tsx`, `Angebote.tsx` (Hauptdatei), `angebotPdf.ts`,
  `efbPdf.ts`, `lugerLogo.ts`, `gaebImport.ts`, `gaebExport.ts`, `Artikel.tsx`, `datanormParse.ts`
- **`app/api/*/route.ts`** – Server-Routen mit `service_role`-Key. **Ordner + Datei**, nie flach.
- **`lib/rateLimit.ts`** – Rate-Limiting (greift nur bei konfiguriertem Upstash)

`next.config.ts` ist leer. ESLint ist **kein** Build-Gate (Next 16), **TypeScript-Typfehler schon.**

### Tabellenzugriffe aus `page.tsx` (Client-direkt, Stand 03.08.2026)
```
company_users (10) · work_instructions (9) · projects (6) · work_instruction_tasks (5)
company_settings (3) · user_guides (2) · instruction_reads (2) · companies (2)
reports (1) · company_features (1)
```
Alles andere läuft über API-Routen.

### API-Routen (Auswahl)
`reports` (list_mine/list_all/list_team/save/archive/delete), `instruction-times`, `absences`,
`update-task-comment`, `equipment`, `create/update/delete-employee`, `admin-data`, `translate`,
`send-report`, `material-*`.

### Übersetzung von Freitext
`refreshCommentTranslations` läuft automatisch bei Sprachwechsel und bei Kommentaränderungen
(`commentSignature`-useEffect), füllt `instructionTranslations`. Anzeige über `getTranslated`,
`getTranslatedTask`, `getTranslatedComment`, `getTranslatedMaterial`. Regiebericht-Tage über
`day.translation`/`ex.translation`, Team-Ansicht über `teamTrans`. PDFs übersetzen inline via `tr()`.

**Sprachen (17):** Deutsch, Englisch, Kroatisch, Slowenisch, Polnisch, Rumänisch, Ukrainisch,
Ungarisch, Bulgarisch, Tschechisch, Türkisch, Italienisch, Serbisch, Spanisch, Philippinisch
(Tagalog), Vietnamesisch, Indisch (Hindi).

**Neue Labels in allen 17 Sprachen:** Node-Skript, das den `EXTRA_LABELS`-Block zeilenweise parst,
je Sprache den Key einfügt und **`changed === 17`** prüft. Für `texts`: nach jeder `msgNoTitle:`-Zeile
einfügen; bei den 3 JSON-Sprachen (Philippinisch/Vietnamesisch/Indisch) inline.
**Nie deutsche Strings hart in die UI schreiben** – immer `t.*` / `tx.*`.

### Weitere Mechanik
- **Auto-Aktualisierung:** `refreshActiveTab()` lädt bei Tab-Wechsel und Browser-Fokus neu.
  **Ausgenommen: `regiebericht` und `tag`** (dort wird eingegeben).
- **Autosave Regiebericht:** `reportDirty`-Flag, ~2 s nach letzter Änderung leises Speichern
  (`autosaveReport`), `beforeunload`-Warnung.
- **Autosave Zeiten:** `setInstrTimeField` speichert 1200 ms nach der letzten Änderung still.
- **Pausen-Vorschlag:** >6 h → 30 min, >9 h → 45 min.

---

## 4. Rollen & Rechte

**Rollen:** `owner`, `admin`, `project_manager`, `employee` — plus **Flag `read_only`** auf
`company_users`.

### Was „Nur lesen" (`read_only`) bedeutet — Definition seit 03.08.2026
| Bereich | Nur-Lese-Konto |
|---|---|
| Tagesansicht „⏱️ Meine Zeiten": Stunden, Pause, Fahrzeit, km | **darf schreiben + speichern** |
| Regiebericht speichern/laden | darf |
| Kommentare / Chat je Arbeitsschritt | gesperrt (UI + Route + RLS) |
| Status „Erledigt", Notiz am Arbeitsschritt | gesperrt (UI + RLS) |
| Materialstamm, Bestellungen, Fahrzeuge, Feedback | gesperrt (Tabs ausgeblendet) |
| Urlaubsantrag stellen | gesperrt |

⚠️ **Diese Unterscheidung nicht versehentlich zurückbauen.** „Nur lesen" heißt ausdrücklich *nicht*,
dass der Mitarbeiter seine eigenen Stunden nicht erfassen darf — das ist sein Kerngeschäft.

### Wo `read_only` erzwungen wird
| Ort | Prüfung |
|---|---|
| `page.tsx`, `readOnlyUser` (Zeile ~4031) | UI-Sichtbarkeit, 16 Stellen |
| `/api/update-task-comment` | serverseitig, 403 „Dieses Konto darf nur lesen." |
| RLS-Policy `work_instruction_tasks` | seit `tasks_readonly_policy.sql` |
| `/api/reports` | **keine** Prüfung (Absicht: eigene Berichte erlaubt) |
| `/api/instruction-times` | **keine** Prüfung (Absicht: eigene Zeiten erlaubt) |

### RLS-Stand
- `work_instruction_tasks`: **RLS an**, zwei Policies
  - `Users can read work instruction tasks` (SELECT) – nur Firmenzugehörigkeit
  - `Users can manage work instruction tasks` (ALL) – Firmenzugehörigkeit + Rollenliste
    (alle 4 Rollen, filtert faktisch nichts) + **`NOT COALESCE(read_only, false)`**
- `reports`: alle Zugriffe über `/api/reports`, RLS kann an sein
- Alle Tabellen haben laut Audit RLS aktiv
- **RLS-Muster für `office_*`-Tabellen:**
  ```sql
  exists (select 1 from public.company_users cu
          where cu.user_id = auth.uid()
            and cu.company_id = <tabelle>.company_id
            and cu.role in ('owner','admin'))
  ```

### Offene Rechte-Lücke
`updateTaskStatus` (`page.tsx` ~6616) schreibt **direkt über den Client**:
```js
await supabase.from("work_instruction_tasks").update({ status }).eq("id", taskId);
```
Nur nach `id` gefiltert, keine Route. Seit `tasks_readonly_policy.sql` fängt die RLS das ab —
vorher war es offen. Sauberer wäre eine `/api/update-task-status`-Route. Nicht dringend.

---

## 5. SQL-Migrationen

Liegen im Repo-Wurzelverzeichnis, alle idempotent, **Marco führt sie selbst in Supabase aus**
(SQL-Editor). Vor Codeänderungen, die darauf aufbauen.

**Regie-App**
`absences_reject_reason.sql` · `app_pricing.sql` · `equipment_km.sql` · `equipment_plan.sql` ·
`phonelist_module.sql` · `projects_archive.sql` · `reports_archive.sql` · `site_agb.sql` ·
`tasks_readonly_policy.sql` *(neu 03.08.2026)* · `work_instruction_times.sql` ·
`work_instructions_address2.sql` · `work_instructions_foreman.sql`

**Büro**
`office_area.sql` · `office_articles.sql` · `office_customers.sql` · `office_customers_import.sql` ·
`office_datanorm.sql` (inkl. `create extension pg_trgm`) · `office_module.sql` ·
`office_offer_kupfer.sql` · `office_offer_settings.sql` · `office_offer_tax.sql` ·
`office_offer_texts.sql` · `office_offer_texts_lib.sql` · `office_offers.sql` · `office_offers_multi.sql`

---

## 6. Funktionsstand

### Regie-App – fertig & deployed
- **Regiebericht:** Gesamtstunden/km/Fahrzeit über alle gedruckten Tage summiert (inkl. Zusatzeinträge);
  Archiv (auto beim Drucken/Versenden + manuell); Signaturen gespeichert und beim Laden angezeigt.
- **Mitarbeiter-Berichte:** Dropdown zur Auswahl, standardmäßig zugeklappt, Archiv sortiert nach
  Mitarbeiter/KW, Zusatzeinträge übersetzt.
- **Arbeitsanweisung:** Umfang Tag/Woche mit KW-Dropdown; ohne Datum kein Speichern (17 Sprachen);
  2. Adresse für Navigation (aufklappbar, eigener Google-Maps-Knopf); Löschen fragt nach.
- **Zeiterfassung je Anweisung:** Stunden/Pause/Fahrzeit/km pro Tag, Autosave, Übernahme in Regiebericht.
- **Übernahme-Logik:** Bei Tages-Anweisung mit Projekt – existiert ein Bericht der KW und der Tag ist
  leer, kommt die Rückfrage „in vorhandenen eintragen oder neuen erstellen". Volle Tage werden **nicht
  überschrieben**, sondern als **Zusatzeintrag** angehängt (eigene Zeit/Fahrzeit/km) – in Eingabe,
  Summen, PDF, Team-Ansicht, Export. Wochen-Anweisungen erscheinen an allen Tagen.
  Duplikate durch Block-ID-System verhindert.
- **Module:** Materialerfassung (Auto-Lern-Katalog, Einheiten in 17 Sprachen, Stamm nur für Manager),
  Materialbestellungen (nach KW/Projekt gruppiert, offen/bestellt/geliefert), Fahrzeuge & Werkzeuge
  (Zuweisungshistorie, km-Plausibilität ≥ Start und < 5000 km Differenz), Stundenexport (CSV, KW-Filter),
  Urlaub & Abwesenheit (Urlaub genehmigungspflichtig mit Ablehnungsgrund, Krankmeldung „Gemeldet",
  Validierung Ende ≥ Start / keine Vergangenheit / keine Überschneidung), Telefonliste (nach Projekten
  gruppiert, `tel:`-Links), Live-Übersetzer, Kommentar-Chat (privat vs. geteilt, eigene Beiträge
  bearbeiten/löschen, fließen bei Übernahme in den Regiebericht).
- **Sonstiges:** Bilder-Lightbox, AutoTextarea, Wochenansicht responsiv, Anmeldeseite für
  Passwort-Manager optimiert, Passwort-Reset je Mitarbeiter, Foto-Limit über
  `companyFeatures.max_photos` (0 = unbegrenzt), Projektleiter-Tausch mit additiver
  Sichtbarkeitsübertragung, Unicode-PDF über NotoSans in `public/fonts/`.
- **Tab-Leiste:** Mitarbeiter sehen Dashboard/Tag/Woche/Monat/Übersetzer + „Mehr"; Manager alles.
  Klappbare Gruppen laden zugeklappt.

### Büro-App – fertig & deployed (Stufen 1–5c)
- **1–4b:** Angebotsmodul (Liste/Bearbeiten/Einstellungen), Kopf/Bindefrist, Standard-Multiplikatoren,
  Kunden-Picker, Vor-/Nachtext + Textbausteinbibliothek, Positionen (Titel/Position/Textposition),
  Steuermodi (19 % / PV 0 % §12 / §13b), Summen, Zahlungsbedingungen, **Angebots-PDF** (Luger-Layout),
  **GAEB X83 Import**, **GAEB X84 Export**, **EFB-Preisformblätter 221/222/223**.
- **5 – Artikelstamm:** Reiter „📦 Artikel", zwei Ansichten (Eigene Artikel CRUD / Lieferanten-Kataloge).
  Im Angebot Knopf „📦 aus Artikelstamm".
- **5a – DATANORM:** Lieferanten anlegen/löschen, Dateien hochladen → Vorschau → Batch-Import (1000er)
  mit Fortschritt. Reine Rabattdateien eigenständig importierbar.
- **5b – Picker durchsucht Kataloge:** Quell-Tabs je Lieferant, serverseitige Suche
  (`.or(short_text.ilike.*q*,article_no.ilike.*q*)`, `limit 50`, 300 ms entprellt).
  **Platzhalter `*`, nicht `%`** – „%" wird in der URL fehlinterpretiert.
- **5c – Kupferzuschlag:** globaler Tageskurs `o.del_preis` (€/kg) + Preiseinheit, Verschnitt,
  `kupfer_kg`, `kupfer_multi` je Position; „Cu schätzen" aus dem Querschnitt.

#### Datenmodell Angebot (`Angebote.tsx`)
**Offer `o`:** `id, number, status, subject, offer_date, valid_until, customer_*, vat_rate,
rabatt_pct, nachlass, skonto_pct, skonto_tage, def_mat_multi, def_lohn_multi, binde_weeks,
tax_mode ('standard'|'pv'|'b13'), tax_note, vortext, nachtext, pay1_pct, pay2_pct, pay3_pct,
del_preis, items[]`

**Item `kind`:** `titel | text | position`. Position:
`{id, kind, oz, rno?, short_text, long_text, qty, unit, mat_ek, mat_multi, lohn_ek, lohn_multi,
minutes, fremd_vk, geraet_vk, discount_pct, preiseinheit, verschnitt, kupfer_kg, kupfer_multi}`

**Kalkulation `calcItem(it, del)`** mit `pe = preiseinheit||1`, `versch = verschnitt||1`:
```
Mat-Vk    = mat_ek × mat_multi × versch / pe
Lohn-Vk   = lohn_ek × lohn_multi × minutes/60
Kupfer-Vk = kupfer_kg × del × kupfer_multi / pe
EP        = Mat-Vk + Lohn-Vk + Kupfer-Vk + fremd_vk + geraet_vk
GP        = EP × qty × (1 − discount_pct/100)
```
`del = num(o.del_preis)`. Alt-Positionen ohne pe/verschnitt/kupfer → Defaults 1/1/0 → unverändert.
**Dieselbe Kupfer-Logik in `angebotPdf.ts`, `efbPdf.ts`, `gaebExport.ts`** – sonst stimmen PDF/EFB/GAEB nicht.

#### DATANORM-Fakten (`datanormParse.ts`)
- **Zeichensatz CP850** (feste 128er-Tabelle; `TextDecoder` kann kein cp850).
- `parseDatanormFiles(files)` → `{version, currency, supplierHint, catalogDate, articles[],
  discounts[], stats, warnings}`. Artikeldateien zuerst, dann Preisdateien (P), dann Rabatte (R).
- **Preis-Skalierung:** `€ = Preis_int / 100 / Preiseinheit`. v4: Preiseinheit = **Code**
  (0→1, 1→10, 2→100, 3→1000). v5: Preiseinheit = **Zahl direkt**.
- **P-Satz:** `P;kennung;` + Gruppen à **9 Feldern** – Stride 9!
- **R-Satz:** `R;;gruppe;kz;rabatt;bezeichnung`, Rabatt xxxx = xx,xx %.
- **Lieferanten:** BTI (DATANORM 4, 53.871 Artikel) · Pferdekämpfer (DATANORM 5, 12.589 Artikel) ·
  **Rexel (nur Preise: 267.439 Netto-Preise ohne Bezeichnungen + 7.097 Rabattgruppen, KEIN Artikelstamm)**
- **Kupfer:** Rexel-Netto-Preis ist **kupferFREI**, meist pro 100 m; der Kupferanteil kommt separat
  obendrauf und ist bei Kabeln oft größer als der Grundpreis.
  `kg/100 m ≈ Σ(Adern × mm²) × 0,89`. DEL-Tageskurs ~11–12 €/kg.

---

## 7. Bekannte Stolpersteine

**Zeilenenden — heikel**
`app/page.tsx` liegt auf der Platte als **CRLF** (9.390 Zeilen, 0 lone LF), im Git aber als **LF**;
Git wandelt über `core.autocrlf` um und warnt dabei („LF will be replaced by CRLF"). Das ist normal.
**Konsequenz:** Eine komplette `page.tsx` aus der Cloud zurückzuschreiben ist riskant — passt die
Variante nicht, entsteht ein Diff über die ganze Datei. **Bei kleinen Änderungen deshalb einen
In-Place-Patch verwenden**, der nur den Textausschnitt ersetzt und Kodierung/Zeilenenden unangetastet
lässt. Muster (PowerShell, UTF-8 ohne BOM):
```powershell
$p = "D:\regiebericht-translator\app\page.tsx"
Copy-Item $p "$p.bak" -Force
$u = New-Object System.Text.UTF8Encoding($false)
$t = $u.GetString([System.IO.File]::ReadAllBytes($p))
$t = $t.Replace('ALT','NEU')
[System.IO.File]::WriteAllBytes($p, $u.GetBytes($t))
```
Danach mit `git diff --stat` prüfen: es darf nur die erwartete Zeilenzahl geändert sein.
**`page.tsx.bak` vor `git add -A` löschen**, sonst landet eine 700-KB-Kopie im Repo.
`app/admin/page.tsx` = CRLF, `app/buero/*` = LF. Je Datei beibehalten.

**Verwirrte Browser-Sitzungen** — häufigste Ursache für „die App lädt nicht mehr". Symptom: Manager
sieht nur die Mitarbeiter-Tabs, keine Projekte. Ursache: dieselbe App in einem zweiten Tab mit anderer
Rolle offen. **Erst danach fragen, bevor irgendetwas zurückgebaut wird.** `/api/admin-data` direkt
aufrufen: `{"error":"Nicht angemeldet."}` = Auth-Problem, kein Code-Problem.

**„Geht nicht"** heißt fast immer: noch nicht deployt oder veralteter React-State. Auf Vercel-Grün
warten, dann im privaten Firefox-Fenster testen.

**Weitere**
- **`git add -A` ist Pflicht**, wenn neue Route-Ordner dazukommen — `git add app/page.tsx` reicht nicht.
- **Grüner Cloud-Build ≠ grüner Vercel-Build**, wenn eine neu importierte Datei nie committet wurde.
  Bei neuen Dateien `git status` prüfen lassen.
- **Veraltete Downloads** sind eine Dauerfalle: vor jedem Download aufräumen
  (`Remove-Item "$env:USERPROFILE\Downloads\page*.tsx"`), danach mit `Select-String` verifizieren.
- **PowerShell-Mehrzeiler brechen beim Kopieren um** → lange Zeilen ungebrochen liefern,
  Befehle einzeln statt als Block.
- **Nie `import { randomBytes } from "crypto"`** in Next.js-Route-Handlern; für unkritische
  temporäre Werte `Math.random`.
- **PDF-Vorübersetzung muss zur Erzeugungszeit passieren** (`pdfDayText[]`); Laufzeit-Übersetzung
  führt zu unvollständigen PDFs.
- **`Date.now()`/`new Date()`** sind in Workflow-Skripten der Sandbox verboten, in App-Code erlaubt.
- **Mehrere Render-Stellen:** Manche UI-Elemente kommen doppelt vor. Vor einer Änderung mit `grep`
  prüfen, ob alle Stellen betroffen sind.
- **Sandbox-Reset:** `/root/rb` kann zwischen Sitzungen zurückgesetzt werden → nach jeder fertigen
  Änderung sofort zurückschreiben.

---

## 8. Offene Punkte

### Regie-App
- **Weniger Klicks:** Mitarbeitername fest aus dem Login übernehmen (nach „Neuer Bericht" ist er leer;
  Tippfehler zersplittern den Stundenexport, der nach Name gruppiert); vor PDF/Versand automatisch
  speichern; Pflichtfeldprüfung (Projekt, ≥1 Tag mit Stunden); doppelte Berichtsnamen auch im
  normalen Speichern verhindern (bisher prüft nur `saveAsNewReport`).
- **`/api/update-task-status`-Route** statt Client-Direktzugriff (s. Abschnitt 4).
- **Fest verdrahtete deutsche Texte** auf Admin-/Login-Bildschirmen (Mitarbeiter sehen sie nicht):
  Login und „Passwort ändern", Firmendaten-Formular, „Mitarbeiter anlegen". Bei Bedarf in 17 Sprachen
  ziehen, Login an Browser-/App-Sprache ausrichten.
- Passwort-Mindestlänge anheben; Klartext-Passwortanzeige im Admin härten.
- Rate-Limiting auf allen API-Routen.
- AVV / Datenschutzerklärung / GDPR-Papierkram.
- In-App-Bedienungsanleitung in 17 Sprachen; Angebot-PDF-Verknüpfung.
- Restliche Client-Direktzugriffe per RLS absichern.
- PDF-Mehrsprachigkeit: Unicode war einmal teilweise zurückgebaut und neu implementiert — über alle
  17 Sprachen nachvalidieren.

### Büro-App
1. **Rexel-Artikeldatei** (`DATANORM.001` mit Bezeichnungen, Mengeneinheit, Preiseinheit) aus dem
   Rexel-Portal exportieren. Fehlt sie, erscheinen Rexel-Preise „pro Stück" statt „pro 100 m" und
   ohne Namen. Zusammen mit `Datpreis.001` importiert rechnet der Parser die Preiseinheit automatisch
   um. Prüfen, ob die Datei eine Kupferzahl enthält.
2. **Optional:** `office_articles` um `preiseinheit`, `kupfer_kg`, `kupfer_multi` erweitern, damit ein
   eigener „Kabel"-Artikel diese Werte über `articleToItem` mitbringt.
3. **Idee:** In der Import-Vorschau warnen, wenn `supplierHint` nicht zum gewählten Lieferanten passt
   (Marco hat einmal die Pferdekämpfer-Datei in „Rexel" importiert).
4. **Stufe 6:** Angebot → Auftragsbestätigung → Rechnung (Vorlagen/Duplizieren, eigene PDFs).
5. Danach: Übernahme in Projekt / Nachkalkulation Soll-Ist gegen Regie-App-Daten; KI-Vorschlag für
   Preis/Zeit über die vorhandene OpenAI-Anbindung; Aufmaß-Beleg; Nachtragsangebot.

### Geparkt
- Angebotsnummer 7-stellig fortlaufend — Startwert legt Marco fest.
- Debitor-Nummernkreis 10001–11012 (Ausreißer 1077, 99999); Kreditor 70001–70266;
  Auto-Increment schließt ≥90000 aus.

---

## 9. Grundprinzipien

1. **Regie-App bleibt sauber.** Neues isoliert in `/buero` und eigenen `office_*`-Tabellen.
   `app/page.tsx` so wenig wie möglich anfassen.
2. **In Stufen bauen.** Jede Stufe läuft grün, bevor die nächste kommt.
3. **RLS ist die Sicherheitsgrundlage** — Client-Prüfungen allein reichen nie.
   `company_features` darf **niemals** client-beschreibbar sein (Selbst-Upgrade-Angriff).
4. **Cleaner Produktentscheidung vor minimalem Patch** (Beispiel: Sprachauswahl in der DB statt
   localStorage, Login-Sprachdropdown ganz entfernt).
5. **Ehrlich sein, was nicht geprüft werden konnte.** Wenn kein Build-Gate da ist, sagen. Wenn eine
   Datei fehlt, nachfordern statt raten.
6. **Klammerbilanz prüfen** vor jeder Auslieferung von `page.tsx` (rund/geschweift/eckig je 0).

---

*Ende der Übergabe. Im neuen Chat: diese Datei lesen, Abschnitt 2 klären (Bridge vorhanden?),
dann bei Abschnitt 8 weitermachen.*
