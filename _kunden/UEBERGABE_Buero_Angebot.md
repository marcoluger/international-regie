# ÜBERGABE — Büro-Bereich / Modul „Angebot" (Stand: 02.08.2026, nach Stufe 5c: Kupferzuschlag)

> Diese Datei ist die vollständige Übergabe für den **nächsten Chat**. Sie enthält alles,
> um nahtlos weiterzumachen. Bitte im neuen Chat zuerst **diese Datei** lesen.
> (Ein separates `Angebot_Lastenheft.md` existiert im Repo NICHT — diese Datei ist die maßgebliche Quelle.)

---

## 0. Wichtigste Grundprinzipien (unbedingt einhalten)

1. **Regie-App bleibt sauber.** „bitte verändere nur das nötigste in der regie app … die büro app
   soll nur später hinzu kommen wenn die auch sauber läuft." → **Alles Neue isoliert** im Route
   `/buero` und in eigenen `office_*`-Tabellen. `app/page.tsx` (Regie-App, ~687 KB) so gut wie nicht anfassen.
2. **In Stufen bauen.** Jede Stufe läuft sauber (Build grün), bevor die nächste kommt.
3. **Workflow pro Änderung (immer gleich):**
   - Im Cloud-Build-Ordner `/root/rb` editieren (muss pro Session neu aufgebaut werden, s. Abschnitt 1).
   - **`npx tsc --noEmit` grün** (kein Netz nötig) UND **`npm run build` grün** (25/25 static pages).
   - Dateien mit **SendUserFile** liefern, dann mit **device_commit_files** auf Platte schreiben —
     Zielpfad-Präfix `D:\regiebericht-translator\...` (Pfade doppelt prüfen!).
   - Marco die Schritte geben: **1) ggf. SQL in Supabase (zuerst!)**, **2) Git** (Marco führt Git selbst aus), **3) nach Vercel-Deploy PWA neu starten.**

⚠️ **Wichtige Lehren:**
- **Google-Fonts-Sandbox:** `app/layout.tsx` lädt `Geist`/`Geist_Mono` über `next/font/google`. Die
  Cloud-Sandbox erreicht Google Fonts NICHT → `npm run build` bricht ab. Zur Verifikation `layout.tsx`
  temporär auf ein Offline-Layout (ohne `next/font/google`) umstellen, bauen, **danach Original
  wiederherstellen — NIE die Offline-Variante committen.** Zusätzlich `npx tsc --noEmit` als Typ-Gate.
- **`.env.local` für den Build:** Ohne `NEXT_PUBLIC_SUPABASE_URL` etc. bricht `next build` beim
  „Collecting page data" ab. `.env.local` von der Platte nach `/root/rb` kopieren, **nie committen**
  (nach dem Build löschen). Liegt gestaged unter `/mnt/user-data/uploads/regiebericht-translator/.env.local`.
- **„Module not found" durch nicht-committete Importe:** Grüner Cloud-Build ≠ grüner Vercel-Build,
  wenn eine **neu importierte** Datei nie in Git committet wurde. Bei neuen Dateien Marco `git status` prüfen lassen.
- **Bridge-Schreib-Verzögerung + Mount-Cache:** Nach `device_commit_files` verifizieren: gestagte Kopie
  in `/mnt/user-data/uploads/...` **löschen**, neu stagen, per `cmp` gegen die `/root/rb`-Kopie prüfen.
- **Supabase aus der Sandbox NICHT erreichbar** (Host nicht in Egress-Allowlist) → keine Live-DB-Tests.
  Falls nötig: Logik per esbuild-Bundle in Node testen (danach `npm remove esbuild`).

## 1. Projekt / Umgebung

- **Repo (Marco lokal):** `D:\regiebericht-translator` — Next.js 16 (App Router, Turbopack) + Supabase + Vercel, PWA. React 19.
- **Cloud-Build-Ordner `/root/rb`** — pro Session neu aufbauen: Quelldateien von `D:\...` per
  `device_stage_files` nach `/mnt/user-data/uploads/regiebericht-translator/` holen, nach `/root/rb`
  kopieren, `npm install`. `node_modules`/`.next` NICHT stagen. Zu stagen: Root-Configs (`package.json`,
  `package-lock.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`,
  `eslint.config.mjs`) + `app/**` (inkl. `app/api/*/route.ts`, `app/admin`, `app/buero`, `app/layout.tsx`,
  `app/globals.css`, `app/manifest.ts`, `app/page.tsx`) + `lib/rateLimit.ts`.
- **Firma Elektrotechnik Luger `company_id`:** `16903bea-ee2b-41e7-962f-982a9e9d738f`.
- **Zeilenenden:** `app/page.tsx` = LF, `app/admin/page.tsx` = CRLF, `app/buero/*` = LF. Je Datei beibehalten.
- **Supabase:** client-direkt mit RLS + `auth.uid()`-Policies.
- **RLS-Muster für alle `office_*`-Tabellen:**
  ```sql
  exists (select 1 from public.company_users cu
          where cu.user_id = auth.uid()
            and cu.company_id = <tabelle>.company_id
            and cu.role in ('owner','admin'))
  ```
- **next.config.ts ist LEER.** ESLint ist KEIN Build-Gate (Next 16); **TypeScript-Typfehler dagegen schon.**
  deps u. a.: `jspdf` ^4.2.1, `@supabase/supabase-js`, `openai`, next 16.2.6, react 19.2.4.

## 2. FERTIG & DEPLOYED — Stufen 1–5c

Alle Dateien gebaut, verifiziert, geliefert, auf Platte geschrieben. Marco committet/pusht selbst.
Büro-Dateien in `app/buero/`: `page.tsx`, `Angebote.tsx` (Hauptdatei), `angebotPdf.ts`, `efbPdf.ts`,
`lugerLogo.ts`, `gaebImport.ts`, `gaebExport.ts`, `Artikel.tsx`, `datanormParse.ts`.

- **Stufen 1–4b:** Angebotsmodul (list/edit/settings), Kopf/Bindefrist, Standard-Multiplikatoren,
  Kunden-Picker, Vor-/Nachtext + Textbaustein-Bibliothek (`office_offer_texts`), Positionen
  (Titel/Position/Textposition), Steuer-Modi (Standard 19 % / PV 0 % §12 / §13b), Summen,
  Zahlungsbedingungen, **📄 Angebots-PDF** (Luger-Layout), **⬆ GAEB X83 Import**, **⬇ GAEB X84 Export**,
  **📑 EFB-Preisformblätter 221/222/223** (`efbPdf.ts`, `generateEfbPdf(o,{customerNo?,sheets?})`).
- **Stufe 5 — eigener Artikelstamm:** `office_articles.sql`. Büro-Reiter **„📦 Artikel"** (in `page.tsx`
  `BUERO_TABS` zwischen `kunden` und `angebote`; rendert `<Artikel supabase companyId/>`). `Artikel.tsx`
  mit zwei Ansichten (Umschalter): **„Eigene Artikel"** (CRUD, Suche, Kategorie) und **„Lieferanten-
  Kataloge (DATANORM)"** (s. Stufe 5a). Im Angebot Knopf **„📦 aus Artikelstamm"** → Picker.
- **Stufe 5a — DATANORM Lieferanten-Kataloge:** `office_datanorm.sql` (3 Tabellen `office_suppliers`,
  `office_supplier_articles`, `office_supplier_discounts` + RLS + `create extension pg_trgm` + GIN-trgm-
  Indexe). `datanormParse.ts` (Parser, Abschnitt 3). In der Ansicht „🏭 Lieferanten-Kataloge": Lieferant
  anlegen/löschen, DATANORM-Dateien hochladen → Vorschau → **Batch-Import (1000er)** mit Fortschritt.
  **Reine Rabattdateien (nur R-Sätze) eigenständig importierbar, ohne Artikel zu löschen.**
- **Stufe 5b — Picker durchsucht Kataloge:** In `Angebote.tsx` hat der Positions-Picker **Quell-Tabs**
  (Eigene Artikel + je Lieferant). Eigene = In-Memory; Katalog = **serverseitige Suche**
  (`.or(short_text.ilike.*q*,article_no.ilike.*q*)`, `limit 50`, 300 ms entprellt; **Platzhalter „\*"
  nicht „%"** — „%" wird in der URL fehlinterpretiert). `cart` hält Objekte `{qty, art}`. `articleToItem`
  erkennt Katalogzeilen an Feld `ek` → Netto-EK → `mat_ek`. Statuszeile zeigt Katalog-Größe/Fehler.
- **Stufe 5c — Kupferzuschlag (DEL) + Preiseinheit + Verschnitt:** siehe Abschnitt 3b. `office_offer_kupfer.sql`.
- **DATANORM → Artikel-Übernahme:** In der „Neuen Artikel anlegen"-Maske (Artikel.tsx) Knopf
  **„🏭 aus Lieferanten-Katalog übernehmen"** → Picker (Lieferant/alle + serverseitige Suche) → füllt
  `number, short_text, long_text, unit, mat_ek(=ek)`; Multis/Lohn bleiben. (Suche vorbelegt mit `f.number`.)

### Datenmodell Angebot (in `Angebote.tsx`)
- **Offer `o`** (blankOffer): `id, number, status, subject, offer_date, valid_until, customer_*,
  vat_rate, rabatt_pct, nachlass, skonto_pct, skonto_tage, def_mat_multi, def_lohn_multi, binde_weeks,
  tax_mode ('standard'|'pv'|'b13'), tax_note, vortext, nachtext, pay1_pct, pay2_pct, pay3_pct,
  **del_preis**, items[]`.
- **Item** `kind`: `titel | text | position`. **position**: `{id, kind, oz, rno?, short_text, long_text,
  qty, unit, mat_ek, mat_multi, lohn_ek, lohn_multi, minutes, fremd_vk, geraet_vk, discount_pct,
  preiseinheit, verschnitt, kupfer_kg, kupfer_multi}`.
- **Kalkulation (calcItem(it, del)):** `pe = preiseinheit||1`, `versch = verschnitt||1`.
  `Mat-Vk = mat_ek × mat_multi × versch / pe` · `Lohn-Vk = lohn_ek × lohn_multi × minutes/60` ·
  `Kupfer-Vk = kupfer_kg × del × kupfer_multi / pe` · `EP = Mat-Vk + Lohn-Vk + Kupfer-Vk + fremd_vk + geraet_vk` ·
  `GP = EP × qty × (1 − discount_pct/100)`. `del = num(o.del_preis)`.
- offerTotals/titleSum reichen `del` durch. Alt-Positionen ohne pe/verschnitt/kupfer → Defaults 1/1/0 → unverändert.

## 3. DATANORM — Datenfakten & Parser (`datanormParse.ts`)

- **Zeichensatz CP850** (feste 128er-Tabelle im Parser; Browser-`TextDecoder` kann kein cp850).
- **`parseDatanormFiles(files: {name, data: Uint8Array}[])`** → `{version, currency, supplierHint,
  catalogDate, articles[], discounts[], stats, warnings}`. Artikeldateien zuerst (Text/Einheit/Listenpreis
  + `peCode`), dann Preisdateien (P → `net_ek` via `peCode`), dann Rabatte (R). Phantom-Filter: wenn eine
  Artikeldatei dabei ist, werden reine Preis-Einträge ohne `short_text` verworfen. `ek = net_ek ?? list_ek`.
- **Preis-Skalierung:** `€ = Preis_int / 100 / Preiseinheit`. v4: Preiseinheit = **Code** (0→1,1→10,2→100,3→1000).
  v5: Preiseinheit = **Zahl direkt** (z. B. 100).
- **P-Satz:** `P;kennung;` + Gruppen à **9 Feldern** (`artno;preiskz;preis` + 6 leer). **Stride 9!**
- **R-Satz:** `R;;gruppe;kz;rabatt;bezeichnung` — Rabatt xxxx = xx,xx %.

**Marcos Lieferanten (`D:\...\Datanorm\<Lieferant>\`):**
- **BTI** — DATANORM 4. `DATANORM.001` (A+B) + `9944672400/DATPREIS.001` (P, Netto). **53.871 Artikel**, EAN.
- **Pferdekämpfer** — DATANORM 5. `DATANORM_5N_202509/DATANORM.001`. **12.589 Artikel**. 5A/5N preisgleich.
- **Rexel** — nur `Datpreis.001` (**267.439 Netto-Preise: NUR Nummer+Preis**, 7-stellige Nummern) +
  `Datanorm.Rab` (**7.097 Preisgruppen mit %**). **KEIN Artikelstamm** → keine Bezeichnungen/Einheit/Preiseinheit.

### 3b. Kupferzuschlag (Stufe 5c) — wichtige Fakten & Umsetzung
- **Rexel-Netto-Preis (Datpreis) = kupferFREIER Grundpreis**, i. d. R. **pro 100 m**. Der Kupferanteil
  kommt SEPARAT obendrauf und ist bei Kabeln oft **größer als der Grundpreis** (Rexel-Shop zeigt z. B.
  „441,81 €/100 m" + „KUPFER: 862,33 €"). Ohne Kupfer fehlt bei Kabeln der halbe Preis.
- **Kupfermenge:** `kg/100 m ≈ Σ(Adern × mm²) × 0,89` (Cu-Dichte 8,9 g/cm³). Helper `cuKgPer100m(text)`
  parst „5x16", „5X35RM", „3G2,5". DEL-Tageskurs ~11–12 €/kg (aus Rexel/TAIFUN abgeleitet).
- **TAIFUN-Modell (Vorbild):** Material (EK, Multi, Preiseinheit, Verschnitt) + eigener Rohstoff
  „Kupfer (DEL)" mit **eigenem Multiplikator**. Rechenprobe stimmt: NYY 5×35 → 3,25 €/m Material + 19,30 €/m Kupfer.
- **Umsetzung:** globaler Tages-Kupferpreis **`o.del_preis` (€/kg)** (Feld „🟠 Kupfer €/kg" neben den
  Standard-Multiplikatoren; Standard in Einstellungen `settings.del_preis` + `def_kupfer_multi`). Pro
  Position aufgeklappt: **Preiseinheit, Verschnitt, Kupfer kg (+ „Cu schätzen"), Kupfer-Multi (editierbar),
  Kupfer-Vk (read-only)**. „Cu schätzen" füllt `kupfer_kg` aus dem Querschnitt, umgerechnet auf die Preiseinheit.
- **Dieselbe Kupfer-Logik in `angebotPdf.ts` (calcItem), `efbPdf.ts` (calcParts, Kupfer = Stoffkosten),
  `gaebExport.ts` (calcItem)** — je über `o.del_preis`, damit PDF/EFB/GAEB inkl. Kupfer stimmen.

## 4. SQL — Stand (alle idempotent, Marco führt sie aus)
Neu in Stufe 5/5a/5c: **`office_articles.sql`**, **`office_datanorm.sql`** (inkl. `create extension pg_trgm`),
**`office_offer_kupfer.sql`** (settings.del_preis + def_kupfer_multi; offers.del_preis).
Positions-Felder (preiseinheit/verschnitt/kupfer_kg/kupfer_multi) liegen im JSON `items` → keine Spalte.
Übrige office_*.sql wie gehabt (area/module/customers/offers/offer_settings/offer_tax/offer_texts(_lib)).

## 5. Git — was committet werden muss (Marco committet selbst)
Zuletzt geliefert/zu committen (Stufe 5c + DATANORM→Artikel): `office_offer_kupfer.sql` (neu),
`app/buero/Angebote.tsx`, `app/buero/angebotPdf.ts`, `app/buero/efbPdf.ts`, `app/buero/gaebExport.ts`,
`app/buero/Artikel.tsx`. **Neue Dateien insgesamt** (müssen getrackt sein): `office_articles.sql`,
`office_datanorm.sql`, `office_offer_kupfer.sql`, `app/buero/Artikel.tsx`, `app/buero/datanormParse.ts`.
(`_kunden/` inkl. dieser Übergabe ist bewusst NICHT im Git.)

## 6. OFFEN — als Nächstes weitermachen
1. **Rexel-Artikeldatei (DATANORM.001 mit Bezeichnungen + Mengeneinheit + Preiseinheit)** aus dem
   Rexel-Portal exportieren. Fehlt → Rexel-Preise erscheinen „pro Stück" statt „pro 100 m", ohne Namen.
   Sobald zusammen mit `Datpreis.001` importiert, rechnet der Parser die Preiseinheit automatisch um
   (z. B. 441,81 €/100 m → 4,42 €/m) und bringt Bezeichnungen. Prüfen, ob die Datei eine **Kupferzahl** enthält.
2. **(Optional, Marco gefragt — offen):** `office_articles` um `preiseinheit`, `kupfer_kg`, `kupfer_multi`
   erweitern, damit ein als „Kabel" gespeicherter **eigener** Artikel diese Werte via `articleToItem`
   direkt ins Angebot mitbringt. Derzeit hat der eigene Artikel nur die Basisfelder; Kupfer/PE setzt man
   in der Angebotsposition.
3. **Idee (noch nicht gebaut):** In der Import-Vorschau warnen, wenn der Lieferantenname im Vorlauf
   (`supplierHint`) nicht zum gewählten Lieferanten passt (verhindert Datei-Verwechslungen — Marco hatte
   einmal die Pferdekämpfer-Datei in „Rexel" importiert; per Re-Import der korrekten `Datpreis.001` behoben).

## 7. Danach (Rest-Stufenplan)
- **Stufe 6:** Angebot → **Auftragsbestätigung** → **Rechnung** (Vorlagen/Duplizieren, eigene PDFs).
- Übernahme in Projekt / Nachkalkulation Soll-Ist (gegen Regie-App-Daten). KI-Vorschlag Preis/Zeit
  (vorhandene OpenAI-Anbindung). Aufmaß-Beleg. Nachtragsangebot.

## 8. Geparkt / offen
- **Angebotsnummer** 7-stellig fortlaufend — Startwert legt Marco später fest.
- CSV-Export der Stunden (Regie-App) — zurückgestellt.
- Debitor-Nummernkreis 10001–11012 (Ausreißer 1077, 99999); Kreditor 70001–70266; Auto-Increment schließt ≥90000 aus.

---
*Ende der Übergabe. Im neuen Chat: diese Datei lesen, `/root/rb` neu aufbauen, dann bei Abschnitt 6
(Rexel-Artikeldatei / eigener-Artikel-Kupfer) oder Stufe 6 weitermachen.*
