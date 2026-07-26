-- site_agb.sql
-- Fügt die AGB-Spalte hinzu und legt einen Startinhalt an (im Admin editierbar).
alter table public.site_legal add column if not exists agb text;
insert into public.site_legal (id, agb) values ('main', $agb$
Allgemeine Geschäftsbedingungen (AGB)
für die Nutzung der Software „Regie International" (Software as a Service)

Hinweis: Muster-Entwurf mit Platzhaltern, keine Rechtsberatung. Vor Verwendung anwaltlich prüfen lassen. Platzhalter in [eckigen Klammern] ausfüllen.

§ 1 Geltungsbereich und Vertragsgegenstand
(1) Diese AGB gelten für alle Verträge über die Bereitstellung und Nutzung der webbasierten Software „Regie International" (nachfolgend „Software" oder „App") zwischen [Anbieter, Rechtsform], [Straße, PLZ Ort] (nachfolgend „Anbieter") und dem Kunden.
(2) Die Software dient der Erstellung und Verwaltung von Arbeitsanweisungen, Regieberichten sowie der Betriebsverwaltung (u. a. Projekte, Mitarbeiter, Material, Fahrzeuge und Werkzeuge, Abwesenheiten, Auswertungen).
(3) Das Angebot richtet sich ausschließlich an Unternehmer, juristische Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen. Verbraucher sind ausgeschlossen.
(4) Abweichende Geschäftsbedingungen des Kunden werden nur Vertragsbestandteil, wenn der Anbieter ihrer Geltung ausdrücklich schriftlich zustimmt.

§ 2 Vertragsschluss und Registrierung
(1) Die Darstellung der Software stellt kein bindendes Angebot dar. Der Vertrag kommt durch Freischaltung des Kundenzugangs oder durch ausdrückliche Auftragsbestätigung zustande.
(2) Der Kunde erhält ein Firmenkonto (Owner) und legt weitere Nutzer (Admin, Projektleiter, Mitarbeiter) eigenverantwortlich an. Er stellt sicher, dass diese die AGB einhalten.
(3) Der Kunde macht bei der Registrierung wahrheitsgemäße und vollständige Angaben und hält sie aktuell.

§ 3 Leistungsumfang
(1) Der Anbieter stellt die Software über das Internet in der jeweils aktuellen Version bereit (Software as a Service). Eine Installation beim Kunden erfolgt nicht.
(2) Der Funktionsumfang ergibt sich aus dem gebuchten Leistungspaket (Grundversion) sowie den zusätzlich gebuchten Modulen und Sprachen gemäß Angebot bzw. Preisliste.
(3) Die Software umfasst optional eine automatische, KI-gestützte Übersetzung von Inhalten; hierzu gilt § 8.
(4) Der Anbieter darf die Software fortentwickeln und Funktionen ändern, soweit der vertragliche Kernnutzen erhalten bleibt und dies zumutbar ist.

§ 4 Preise und Zahlungsbedingungen
(1) Es gelten die im Angebot bzw. in der Preisliste genannten Preise: Grundpreis je Betriebsgrößenstufe zzgl. der Preise für gebuchte Module und zusätzliche Sprachen.
(2) Alle Preise verstehen sich netto zzgl. der gesetzlichen Umsatzsteuer von derzeit 19 %.
(3) Die Vergütung ist – sofern nicht anders vereinbart – monatlich im Voraus fällig. Bei jährlicher Vorauszahlung wird ein Monatsbeitrag erlassen (12 Monate zum Preis von 11).
(4) Rechnungen sind innerhalb von [14] Tagen ohne Abzug fällig.
(5) Unterjährig hinzugebuchte Module/Kontingente werden anteilig berechnet; Reduzierungen wirken zur nächsten Abrechnungsperiode.
(6) Bei Zahlungsverzug kann der Anbieter den Zugang nach Ankündigung sperren.

§ 5 Laufzeit und Kündigung
(1) Der Vertrag läuft auf unbestimmte Zeit und ist bei monatlicher Zahlung mit einer Frist von [einem Monat] zum Monatsende kündbar.
(2) Bei jährlicher Vorauszahlung beträgt die Laufzeit zwölf Monate und verlängert sich um jeweils zwölf Monate, wenn nicht mit einer Frist von [einem Monat] zum Laufzeitende gekündigt wird.
(3) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.
(4) Kündigungen bedürfen der Textform.
(5) Nach Vertragsende besteht für [30] Tage die Möglichkeit zum Datenexport; danach werden die Daten nach Maßgabe gesetzlicher Pflichten gelöscht.

§ 6 Pflichten des Kunden
(1) Der Kunde schützt seine Zugangsdaten vor unbefugtem Zugriff.
(2) Der Kunde ist für die eingegebenen Inhalte und deren Rechtmäßigkeit verantwortlich und stellt sicher, dass die erforderlichen Einwilligungen vorliegen.
(3) Der Kunde nutzt die Software nicht rechtswidrig.
(4) Der Kunde stellt den Anbieter von Ansprüchen Dritter aus rechtswidriger Nutzung frei.

§ 7 Verfügbarkeit, Wartung und Support
(1) Der Anbieter bemüht sich um hohe Verfügbarkeit, schuldet aber keine ununterbrochene Verfügbarkeit (Ausnahmen: Wartung, Updates, Störungen außerhalb des Einflussbereichs).
(2) Wartungen werden möglichst in nutzungsschwache Zeiten gelegt.
(3) Support erfolgt im vereinbarten Umfang, sonst per E-Mail an [Support-E-Mail].

§ 8 KI-gestützte Übersetzung
(1) Automatische KI-Übersetzungen dienen der Verständigung und werden ohne Gewähr für Vollständigkeit und Richtigkeit bereitgestellt.
(2) Rechtlich verbindliche oder sicherheitsrelevante Inhalte prüft der Kunde eigenverantwortlich. Eine Haftung für inhaltliche Fehler automatischer Übersetzungen ist – soweit zulässig – ausgeschlossen.

§ 9 Nutzungsrechte und geistiges Eigentum
(1) Der Kunde erhält für die Vertragslaufzeit ein einfaches, nicht übertragbares Nutzungsrecht.
(2) Alle Rechte an Software, Quellcode, Gestaltung und Marken verbleiben beim Anbieter bzw. seinen Lizenzgebern.
(3) Vom Kunden eingegebene Inhalte bleiben Eigentum des Kunden und werden nur zur Vertragserfüllung verarbeitet.

§ 10 Datenschutz und Auftragsverarbeitung
(1) Der Anbieter verarbeitet personenbezogene Daten als Auftragsverarbeiter für den Kunden. Die Parteien schließen einen gesonderten Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO, der Vorrang vor diesen AGB hat.
(2) Eingesetzte Unterauftragsverarbeiter sind insbesondere: Supabase (Datenbank/Authentifizierung), Vercel (Hosting), OpenAI (KI-Übersetzung), Resend (E-Mail-Versand). Der Kunde stimmt deren Einsatz zu.
(3) Eine Verarbeitung kann in Drittländern (insbesondere USA) erfolgen; der Anbieter stellt geeignete Garantien nach Art. 44 ff. DSGVO sicher (z. B. Standardvertragsklauseln).
(4) Einzelheiten regeln die Datenschutzerklärung und der AVV.

§ 11 Gewährleistung
(1) Der Anbieter gewährleistet, dass die Software im Wesentlichen der Leistungsbeschreibung entspricht.
(2) Mängel sind unverzüglich anzuzeigen; der Anbieter behebt sie innerhalb angemessener Frist.

§ 12 Haftung
(1) Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit.
(2) Bei einfacher Fahrlässigkeit haftet der Anbieter nur bei Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht), begrenzt auf den vertragstypischen, vorhersehbaren Schaden.
(3) Im Übrigen ist die Haftung ausgeschlossen und – soweit zulässig – auf die in den zwölf Monaten vor dem Ereignis gezahlte Nettovergütung begrenzt.
(4) Für Datenverlust haftet der Anbieter nur im Umfang, der bei ordnungsgemäßer Datensicherung durch den Kunden entstanden wäre.
(5) Zwingende gesetzliche Haftung (z. B. Produkthaftungsgesetz) bleibt unberührt.

§ 13 Höhere Gewalt
Ereignisse höherer Gewalt befreien den Anbieter für die Dauer der Störung von der Leistungspflicht.

§ 14 Änderungen der AGB und Leistungen
(1) Der Anbieter darf AGB und Leistungsumfang aus triftigem Grund mit Wirkung für die Zukunft ändern, soweit dies den Kunden nicht unangemessen benachteiligt.
(2) Änderungen werden mit angemessener Frist in Textform mitgeteilt. Widerspricht der Kunde nicht innerhalb von [sechs Wochen] und nutzt die Software weiter, gelten sie als angenommen; hierauf wird hingewiesen. Bei fristgerechtem Widerspruch kann der Anbieter ordentlich kündigen.

§ 15 Preisanpassung
Preiserhöhungen werden mindestens [sechs Wochen] vorher in Textform mitgeteilt. Der Kunde kann in diesem Fall zum Zeitpunkt des Wirksamwerdens außerordentlich kündigen.

§ 16 Schlussbestimmungen
(1) Es gilt das Recht [der Bundesrepublik Deutschland / der Republik Österreich] unter Ausschluss des UN-Kaufrechts.
(2) Ausschließlicher Gerichtsstand ist – soweit zulässig – [Sitz des Anbieters].
(3) Änderungen dieses Vertrags bedürfen der Textform.
(4) Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam.

Anbieter: [Anbieter, Rechtsform] · [Straße, PLZ Ort] · [E-Mail]. Stand: [Datum].
$agb$)
on conflict (id) do update set agb = excluded.agb;
