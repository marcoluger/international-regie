export const metadata = { title: "Impressum – Regie International" };

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-black overflow-x-hidden">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <a href="/" className="text-blue-700 underline text-sm">← Zurück zur App</a>

        <div className="bg-white border rounded p-6 mt-4 space-y-6">
          <h1 className="text-2xl font-bold">Impressum</h1>

          {/* ----------------------------------------------------------------
              HINWEIS: Dies ist eine VORLAGE mit Platzhaltern. Die Inhalte sind
              KEINE Rechtsberatung. Vor dem kommerziellen Einsatz unbedingt von
              einem Anwalt / einer IT-Recht-Beratung prüfen und vervollständigen
              lassen. Platzhalter in [ECKIGEN KLAMMERN] ersetzen.
          ---------------------------------------------------------------- */}
          <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800">
            ⚠️ Vorlage mit Platzhaltern – bitte alle Felder in [eckigen Klammern]
            ausfüllen und den Text rechtlich prüfen lassen. Dies ist keine
            Rechtsberatung.
          </div>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">Angaben gemäß § 5 DDG (Deutschland) bzw. § 5 ECG (Österreich)</h2>
            <p>
              [FIRMENNAME / NAME]<br />
              [RECHTSFORM, z. B. Einzelunternehmen / GmbH]<br />
              [STRASSE UND HAUSNUMMER]<br />
              [PLZ ORT]<br />
              [LAND]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">Kontakt</h2>
            <p>
              Telefon: [TELEFONNUMMER]<br />
              E-Mail: [E-MAIL-ADRESSE]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">Vertretungsberechtigte/r bzw. Inhaber/in</h2>
            <p>[VOR- UND NACHNAME]</p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">Umsatzsteuer-Identifikationsnummer / UID</h2>
            <p>[UST-IDNR. / UID, falls vorhanden]</p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">Firmenbuch / Handelsregister</h2>
            <p>
              [REGISTERGERICHT / FIRMENBUCHGERICHT]<br />
              [REGISTER-/FIRMENBUCHNUMMER, falls vorhanden]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">Verantwortlich für den Inhalt</h2>
            <p>
              [VOR- UND NACHNAME]<br />
              [ANSCHRIFT, falls abweichend]
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-lg font-bold">Streitschlichtung</h2>
            <p className="text-sm text-gray-600">
              [Optionaler Hinweis zur EU-Streitschlichtungsplattform und/oder
              Verbraucherschlichtung – bitte je nach Land/Pflicht ergänzen.]
            </p>
          </section>

          <p className="text-xs text-gray-400 pt-2">
            Stand: [DATUM]
          </p>
        </div>
      </div>
    </main>
  );
}
