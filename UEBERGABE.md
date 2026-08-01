# Übergabe – Projekt „Regie International" (regiebericht-translator)

Dieses Dokument ist die vollständige Übergabe, damit ein neuer Chat **nahtlos genauso weiterarbeiten** kann. Bitte am Anfang eines neuen Chats komplett lesen.

---

## 1. Was ist das Projekt

Mehrsprachige Web-App (SaaS) für Elektro-/Baubetriebe. Kernfunktionen:
- **Arbeitsanweisungen** (work instructions) mit Arbeitsschritten, Kommentaren, Fotos, Zuweisung an Mitarbeiter/Projektleiter/Owner/Admin.
- **Regieberichte** (daywork reports): Stunden, Pause, Fahrzeit, km pro Tag – erfassen, übersetzen, als PDF/E-Mail ausgeben, archivieren.
- **Module** (pro Firma in der Admin-Seite freischaltbar): Fahrzeuge & Werkzeuge, Materialstamm/Bestellungen, Stundenexport, Urlaub & Abwesenheit, Live-Übersetzer, Kommentar-Chat, Fotos, Unterschriften, E-Mail, **Telefonliste**, KI-Mehrsprachigkeit.
- **17 Sprachen** komplett übersetzt (feste Labels) + **Live-KI-Übersetzung** der frei eingegebenen Texte (Kommentare, Notizen, Beschreibungen).

**Tech:** Next.js 16 (Turbopack), React 19, TypeScript, Supabase (DB/Auth, service_role in API-Routen), OpenAI gpt-4o-mini (Übersetzung, mit `translation_cache`), jsPDF, Resend (E-Mail), QRCode. Deployment: Vercel (`international-regie.vercel.app`).

**Rollen:** `owner`, `admin`, `project_manager`, `employee` (+ `read_only`-Flag).

---

## 2. Arbeitsweise / Workflow (WICHTIG – genau so beibehalten)

Der Nutzer (Marco) hat den Code lokal unter **`D:\regiebericht-translator`** (Windows, Desktop-App verbunden über die `mcp__remote-devices__*`-Bridge). Diese lokale Kopie ist die **verlässliche Quelle**.

Der übliche Zyklus für JEDE Änderung:
1. Bei Bedarf aktuellen Stand vom Rechner holen: `mcp__remote-devices__device_stage_files` mit `D:\regiebericht-translator\app\page.tsx` → landet unter `/mnt/user-data/uploads/...`. **Achtung:** Kann beim ersten Versuch eine veraltete/abgeschnittene Kopie liefern – Größe prüfen (echte `page.tsx` ist ~9300 Zeilen / >600 KB). Bei Abweichung: staged-Datei löschen und neu stagen.
2. Im Cloud-Ordner **`/root/rb/`** editieren (Read/Edit/Write).
3. Bauen: `cd /root/rb && npm run build` – **muss grün sein**, bevor ausgeliefert wird.
4. Ausliefern: `SendUserFile` mit der geänderten Datei.
5. Zurückschreiben auf den Rechner: `mcp__remote-devices__device_commit_files` (fileUuid aus SendUserFile) nach `D:\regiebericht-translator\...`.
6. Dem Nutzer die **git-Befehle** geben (er pusht selbst):
   ```
   git add -A
   git commit -m "..."
   git push
   ```

**Build-Workaround (nur lokal in `/root/rb`, NIE zurückschreiben):**
- Google-Fonts-Fetch schlägt in der Sandbox fehl → in `app/layout.tsx` `next/font/google` lokal ersetzt. **Diese layout.tsx niemals per commit_files zurückschreiben.**
- Für den Build braucht es Supabase-Env: eine Dummy-`.env.local` in `/root/rb` (nur lokal).

**Sandbox-Reset-Falle:** Der Cloud-Ordner `/root/rb` kann zwischen Sessions zurückgesetzt werden. Passiert das mitten in der Arbeit, gehen dort ungespeicherte Änderungen verloren → **immer vom Rechner (`D:\...`) neu stagen** und von dort weiterarbeiten. In dieser Session sind dadurch einmal Teile verloren gegangen und mussten neu gebaut werden – deshalb: nach jeder fertigen Änderung sofort zurückschreiben.

**Antworten:** kurz, auf Deutsch, mit den git-Befehlen. Bei SQL-Änderungen immer darauf hinweisen, dass die SQL **zuerst in Supabase** ausgeführt werden muss.

---

## 3. Technischer Aufbau

- **`app/page.tsx`** (~9300 Zeilen): die gesamte Haupt-App (eine große Client-Komponente). Enthält:
  - `texts` – Objekt mit den 17 Sprach-Blöcken (Haupt-UI-Strings), Zugriff über `const t = texts[uiLanguage]`.
  - `EXTRA_LABELS` – zweites 17-Sprachen-Objekt (Zusatz-Labels), Zugriff über `const tx = EXTRA_LABELS[uiLanguage] || EXTRA_LABELS.Deutsch`. **Aktuell 72 Schlüssel je Sprache, alle 17 identisch, keine Leerwerte** (verifiziert).
  - `pdfTexts` – Labels für PDFs.
- **`app/admin/page.tsx`**: Admin-Seite (Firmen, Module-Toggles, Preisrechner, AGB, Bedienungsanleitung).
- **`app/api/*/route.ts`**: Server-Routen mit **service_role-Key** (umgehen RLS, prüfen aber Anmeldung/Rolle). Wichtig: `reports` (list_mine/list_all/list_team/save/archive/delete), `instruction-times`, `absences`, `update-task-comment`, `equipment`, `create/update/delete-employee`, `admin-data`, `translate`, `send-report`, `material-*`.

**Labels in allen 17 Sprachen hinzufügen (bewährtes Muster):** Ein Node-Skript, das den `EXTRA_LABELS`-Block Zeile für Zeile parst, je Sprache den neuen Key einfügt und `changed === 17` prüft. (Beispiele: `/tmp/addlabels*.js` in der Historie.) Für das `texts`-Objekt: gezielt nach jeder `msgNoTitle:`-Zeile einfügen bzw. bei den 3 JSON-Sprachen (Philippinisch/Vietnamesisch/Indisch) inline. **Nie** deutsche Strings hart in die UI schreiben – immer `t.*`/`tx.*`.

**Sprachen:** Deutsch, Englisch, Kroatisch, Slowenisch, Polnisch, Rumänisch, Ukrainisch, Ungarisch, Bulgarisch, Tschechisch, Türkisch, Italienisch, Serbisch, Spanisch, Philippinisch (Tagalog), Vietnamesisch, Indisch (Hindi).

**Übersetzung von Freitext:** `refreshCommentTranslations` (läuft automatisch bei Sprachwechsel und wenn sich Kommentare ändern, via `commentSignature`-useEffect) füllt `instructionTranslations`. Anzeige über `getTranslated`, `getTranslatedTask`, `getTranslatedComment`, `getTranslatedMaterial`. Regiebericht-Tage über `day.translation`/`ex.translation`, Team-Ansicht über `teamTrans`. PDFs übersetzen inline via `tr()`.

**RLS:** Auf `reports` kann RLS eingeschaltet werden – alle Zugriffe laufen über `/api/reports`. Andere Tabellen laufen aktuell teils direkt über den Client (RLS dort aus). `work_instruction_times` läuft über `/api/instruction-times`.

**Auto-Aktualisierung:** `refreshActiveTab()` lädt beim Tab-Wechsel und bei Browser-Fokus die Daten des Bereichs neu. **Ausgenommen: `regiebericht` und `tag`** (dort werden Daten eingegeben → kein Überschreiben).

**Autosave Regiebericht:** `reportDirty`-Flag; bereits gespeicherter Bericht wird ~2 s nach der letzten Änderung leise gespeichert (`autosaveReport`); `beforeunload`-Warnung bei ungespeicherten Änderungen.

---

## 4. SQL-Migrationen (in Supabase → SQL-Editor ausführen)

Diese .sql-Dateien liegen im Projektordner. Falls beim Nutzer noch nicht ausgeführt, nachholen (alle idempotent):
- `equipment_plan.sql`, `equipment_km.sql` – Fahrzeug-/Werkzeug-Planung & km (Start/Ende).
- `app_pricing.sql` – zentrale Preis-Konfiguration (Admin-Preisrechner).
- `site_agb.sql` – AGB-Text (Route `/agb`).
- `work_instruction_times.sql` – Spalte `work_instructions.scope` (Tag/Woche) + Tabelle `work_instruction_times` (Mitarbeiter-Zeiten je Anweisung/Tag) + RLS aus.
- `work_instructions_address2.sql` – 2. Adresse (nur Navigation): `address2`, `address2_desc`, `address2_name`, `address2_street`, `address2_zip`, `address2_city`.
- `reports_archive.sql` – `reports.archived` (Archiv).
- `absences_reject_reason.sql` – `absences.reject_reason` (Ablehnungs-Grund).
- `phonelist_module.sql` – `company_features.phonelist_enabled` (Modul Telefonliste).

---

## 5. In dieser Session gebaut (Stand heute)

- **Regiebericht-PDF:** Gesamtstunden/km/Fahrzeit werden über ALLE gedruckten Tage summiert (inkl. Zusatzeinträge).
- **Mitarbeiter-Berichte:** Dropdown zur Mitarbeiter-Auswahl; standardmäßig **zugeklappt** laden; Archiv (auto beim Drucken + manuell, sortiert nach Mitarbeiter/KW); Zusatzeinträge werden übersetzt.
- **Arbeitsanweisung – Umfang Tag/Woche:** Auswahl „Ein Tag / Ganze Woche"; bei Woche **KW-Dropdown**; ohne Datum kein Speichern (Meldung in 17 Sprachen).
- **Zeiterfassung je Anweisung („Meine Zeiten"):** Mitarbeiter trägt Stunden/Pause/Fahrzeit/km pro Tag ein (wie Regiebericht), **Autosave**; beim „In Regiebericht übernehmen" fließt es in den/die passenden Tag(e).
- **Übernahme-Logik:** Bei Tages-Anweisung mit Projekt: wenn Bericht dieser KW existiert und Tag leer → Nachfrage „in vorhandenen eintragen oder neuen erstellen". Volle Tage werden **nicht überschrieben**, sondern als **Zusatzeintrag** angehängt (zweiter Arbeitsschritt mit eigener Zeit/Fahrzeit/km) – in Eingabe, Summen, PDF, Team-Ansicht, Export.
- **Wochen-Anweisung:** erscheint an allen Tagen (Tages-/Wochen-/Monatsansicht); schreibt alle Arbeitsschritte (inkl. „Erledigt") in jeden Tag.
- **Rechte/Sichtbarkeit:** Owner/Admin als Projektleiter auswählbar (Projekt-Dropdown UND im Zuweisungs-Block der Anweisung – Blöcke „Projektleiter" und „Owner/Admin" wurden zu EINEM zusammengeführt); Lesehaken auch für Owner/Admin; Nur-Lese-Mitarbeiter sehen Fahrzeuge/Bestellungen/Materialstamm nicht; Materialstamm nur für Manager.
- **Tab-Leiste:** Mitarbeiter sehen nur Dashboard/Tag/Woche/Monat/Übersetzer + „Mehr"-Umschalter; Manager sehen alles. Alle klappbaren Gruppen laden zugeklappt.
- **Archiv (Berichte):** in „Bericht speichern/laden"; auto beim Drucken/Versenden + manuell; Mitarbeiter/Projektleiter nur eigenes, Owner/Admin alle (RLS-sicher über `/api/reports`). Eigene Berichte laden/speichern/löschen ebenfalls über `/api/reports`.
- **2. Adresse (Navigation):** aufklappbar mit Beschreibung/Name/Straße/PLZ/Ort, unter Datum/Umfang; zweiter „🧭 Navigation"-Button (Google Maps), Button-Text = Beschreibung.
- **Urlaub:** Ablehnungs-Grund-Feld (übersetzt); Validierung (Ende ≥ Start, keine Vergangenheit, keine Überschneidung).
- **Foolproofing:** Kommentar/Status/Notiz/Fotos bleiben beim Bearbeiten einer Anweisung erhalten (kein delete-and-recreate-Verlust mehr); automatischer Pausen-Vorschlag (>6 h → 30, >9 h → 45); Warnung „Ende vor Anfang"; End-km im Fahrzeug-Rückgabe-Dialog + Plausibilität (≥ Start, < 5000 km Differenz).
- **Übersetzungslücken geschlossen:** Aufgaben-Notiz (PDF/Übernahme), `employee_note`, Ablehnungs-Grund.
- **Bilder:** Antippen öffnet Vollbild-Lightbox.
- **Anmeldeseite** für Passwort-Manager optimiert (autocomplete/ids); „Passwort ändern" mit `new-password`.
- **Automatische Aktualisierung** bei Tab-Wechsel/Fokus (außer Regiebericht + Tagesansicht).
- **Telefonliste:** neues, **freischaltbares Modul** (`phonelist_enabled`); Tab „📞 Telefonliste", **nach Projekten gruppiert und aufklappbar** – zeigt je Projekt die in dessen Arbeitsanweisungen zugewiesenen Mitarbeiter (kann in mehreren Projekten vorkommen), Telefonnummer als `tel:`-Link. Admin-Toggle + im Preisrechner.
- Löschen einer Arbeitsanweisung fragt vorher nach.

---

## 6. Offene Punkte / angeboten, noch nicht umgesetzt

- „Weniger Klicks / Auto-Ausfüllen": Mitarbeitername fest aus Login (nach „Neuer Bericht" leer → Tippfehler zersplittern Stundenexport, der nach Name gruppiert); vor PDF/Versand automatisch speichern; Pflichtfeld-Prüfung (Projekt, ≥1 Tag mit Stunden) vor Speichern/PDF; doppelte Berichtsnamen im normalen Speichern verhindern (nur `saveAsNewReport` prüft).
- **Fest verdrahtete deutsche Texte** auf Admin-/Login-Bildschirmen (Mitarbeiter sehen sie nicht): Login/„Passwort ändern" (Firmenkürzel, Benutzername, Neues Passwort, Passwort bestätigen), Firmendaten-Formular (Firmenname, Straße, Ort, Telefon, E-Mail, Webseite, UID/Steuernummer), „Mitarbeiter anlegen" (Vollständiger Name, Benutzername, Passwort, Telefonnummer, Hinweis-Satz). Bei Bedarf noch in 17 Sprachen ziehen (Login an Browser-/App-Sprache ausrichten).
- Weitere Ideen: AVV/Datenschutzerklärung, in-App-Bedienungsanleitung in alle 17 Sprachen, Angebot-PDF-Verknüpfung, RLS auch für die restlichen Direkt-Client-Zugriffe absichern.

---

## 7. Bekannte Stolpersteine

- **Node-Skripte in Sandbox:** `Date.now()`/`new Date()` sind in **Workflow-Skripten** verboten, aber in **App-Code (page.tsx) erlaubt** – dort normal nutzen.
- **`Edit`-Fehler „File has been modified":** Datei kurz erneut `Read`en, dann Edit wiederholen (Linter/Harness ändert Zeilennummern).
- **Zwei Footer / mehrere Render-Stellen:** Manche UI-Elemente kommen doppelt vor (z. B. Anweisungs-Karten in mehreren Ansichten). Bei Änderungen prüfen, ob alle Stellen betroffen sind.
- **Nach Sandbox-Reset:** immer vom Rechner neu stagen, sonst arbeitet man auf altem Stand weiter (ist in dieser Session einmal passiert).
