export const metadata = { title: "Datenschutzerklärung – Regie International" };

export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-black overflow-x-hidden">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <a href="/" className="text-blue-700 underline text-sm">← Zurück zur App</a>

        <div className="bg-white border rounded p-6 mt-4 space-y-6">
          <h1 className="text-2xl font-bold">Datenschutzerklärung</h1>

          {/* ----------------------------------------------------------------
              HINWEIS: VORLAGE mit Platzhaltern, KEINE Rechtsberatung. Vor dem
              kommerziellen Einsatz von einem Anwalt / einer Datenschutz-Beratung
              prüfen und vervollständigen lassen. Besonders die Auftragsverarbeiter
              (Supabase, Vercel, Resend, OpenAI) und die Drittland-Übermittlung
              (USA) müssen geprüft und ggf. mit AVV abgesichert werden.
          ---------------------------------------------------------------- */}
          <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800">
            ⚠️ Vorlage mit Platzhaltern – bitte ausfüllen und rechtlich prüfen
            lassen. Dies ist keine Rechtsberatung.
          </div>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">1. Verantwortlicher</h2>
            <p>
              [FIRMENNAME / NAME]<br />
              [ANSCHRIFT]<br />
              E-Mail: [E-MAIL-ADRESSE]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">2. Welche Daten wir verarbeiten</h2>
            <p>
              Im Rahmen der Nutzung von Regie International verarbeiten wir u. a.:
              Konto-/Anmeldedaten (Name, Benutzername, E-Mail), von Ihnen erfasste
              Arbeitsanweisungen und Regieberichte, hochgeladene Fotos sowie
              technische Nutzungsdaten. [Bitte konkretisieren/ergänzen.]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">3. Zwecke und Rechtsgrundlagen</h2>
            <p>
              Die Verarbeitung erfolgt zur Bereitstellung und Erfüllung des
              Vertrags (Art. 6 Abs. 1 lit. b DSGVO), aufgrund berechtigter
              Interessen (lit. f) und – soweit erforderlich – auf Grundlage Ihrer
              Einwilligung (lit. a). [Bitte den jeweiligen Zweck zuordnen.]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">4. Empfänger / Auftragsverarbeiter</h2>
            <p>
              Zur Bereitstellung des Dienstes setzen wir Dienstleister ein, mit
              denen Auftragsverarbeitungsverträge (AVV) bestehen [PRÜFEN/ABSCHLIESSEN]:
            </p>
            <ul className="list-disc ml-5">
              <li>Hosting / Datenbank: Supabase [Anbieter, Sitz, AVV, Datenschutz-Link]</li>
              <li>Hosting / Auslieferung: Vercel [Anbieter, Sitz, AVV, Datenschutz-Link]</li>
              <li>E-Mail-Versand: Resend [Anbieter, Sitz, AVV, Datenschutz-Link]</li>
              <li>Übersetzung: OpenAI [Anbieter, Sitz, AVV, Datenschutz-Link]</li>
            </ul>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">5. Übermittlung in Drittländer</h2>
            <p>
              [Einige Dienstleister können Daten in Drittländern (z. B. USA)
              verarbeiten. Bitte Rechtsgrundlage – etwa Standardvertragsklauseln –
              und die konkreten Anbieter prüfen und beschreiben.]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">6. Speicherdauer</h2>
            <p>
              [Beschreiben Sie, wie lange die Daten gespeichert werden bzw. nach
              welchen Kriterien die Speicherdauer bestimmt wird.]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">7. Ihre Rechte</h2>
            <p>
              Sie haben das Recht auf Auskunft, Berichtigung, Löschung,
              Einschränkung der Verarbeitung, Datenübertragbarkeit sowie
              Widerspruch. Eine erteilte Einwilligung können Sie jederzeit mit
              Wirkung für die Zukunft widerrufen.
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">8. Beschwerderecht</h2>
            <p>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu
              beschweren. [Zuständige Behörde / Land ergänzen.]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">9. Kontakt Datenschutz</h2>
            <p>E-Mail: [DATENSCHUTZ-KONTAKT]</p>
          </section>

          <p className="text-xs text-gray-400 pt-2">
            Stand: [DATUM]
          </p>
        </div>
      </div>
    </main>
  );
}
