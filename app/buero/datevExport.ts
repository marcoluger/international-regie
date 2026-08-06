// DATEV-Buchungsstapel-Export (DATEV-Format EXTF 700, Kategorie 21, Formatversion 13).
// Erzeugt eine CSV-Datei im ANSI-Zeichensatz (CP1252), die im DATEV-Rechnungswesen
// ueber "Stapelverarbeitung -> Importieren -> DATEV-Format" eingelesen werden kann.
// Eine Buchungszeile je Ausgangsrechnung: Brutto an Debitor (Soll), Gegenkonto = Erloeskonto.

const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;

// Betrag im DATEV-Format: Komma als Dezimaltrenner, kein Tausendertrenner, immer 2 Stellen.
function amt(n: number) {
  return (Math.round(Math.abs(n) * 100) / 100).toFixed(2).replace(".", ",");
}
function pad2(n: number) { return String(n).padStart(2, "0"); }

// Belegfeld 1: max. 36 Zeichen, nur Ziffern/Buchstaben und $ & % * + - /
function belegfeld(s: any) {
  return String(s ?? "").replace(/[^0-9A-Za-z$&%*+\-/]/g, "").slice(0, 36);
}
// Textfelder: Anfuehrungszeichen raus, Laenge begrenzen.
function txt(s: any, max: number) {
  return String(s ?? "").replace(/"/g, "'").replace(/[\r\n;]+/g, " ").trim().slice(0, max);
}
function yyyymmdd(d: Date) { return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; }

// CP1252-Bytes aus einem String (Umlaute/ß direkt, Euro-Zeichen auf 0x80, Rest '?').
export function toCp1252(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i] = c <= 0xff ? c : c === 0x20ac ? 0x80 : 0x3f; // 0x3f = '?'
  }
  return out;
}

// Offizielle Spaltenueberschriften des Buchungsstapel-Formats (125 Spalten, Version 13).
const COLS = [
  "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz",
  "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto",
  "Buchungstext", "Postensperre", "Diverse Adressnummer", "Geschäftspartnerbank", "Sachverhalt", "Zinssperre",
  "Beleglink",
  "Beleginfo - Art 1", "Beleginfo - Inhalt 1", "Beleginfo - Art 2", "Beleginfo - Inhalt 2",
  "Beleginfo - Art 3", "Beleginfo - Inhalt 3", "Beleginfo - Art 4", "Beleginfo - Inhalt 4",
  "Beleginfo - Art 5", "Beleginfo - Inhalt 5", "Beleginfo - Art 6", "Beleginfo - Inhalt 6",
  "Beleginfo - Art 7", "Beleginfo - Inhalt 7", "Beleginfo - Art 8", "Beleginfo - Inhalt 8",
  "KOST1 - Kostenstelle", "KOST2 - Kostenstelle", "Kost-Menge", "EU-Land u. UStID (Bestimmung)",
  "EU-Steuersatz (Bestimmung)", "Abw. Versteuerungsart", "Sachverhalt L+L", "Funktionsergänzung L+L",
  "BU 49 Hauptfunktionstyp", "BU 49 Hauptfunktionsnummer", "BU 49 Funktionsergänzung",
  "Zusatzinformation - Art 1", "Zusatzinformation- Inhalt 1", "Zusatzinformation - Art 2", "Zusatzinformation- Inhalt 2",
  "Zusatzinformation - Art 3", "Zusatzinformation- Inhalt 3", "Zusatzinformation - Art 4", "Zusatzinformation- Inhalt 4",
  "Zusatzinformation - Art 5", "Zusatzinformation- Inhalt 5", "Zusatzinformation - Art 6", "Zusatzinformation- Inhalt 6",
  "Zusatzinformation - Art 7", "Zusatzinformation- Inhalt 7", "Zusatzinformation - Art 8", "Zusatzinformation- Inhalt 8",
  "Zusatzinformation - Art 9", "Zusatzinformation- Inhalt 9", "Zusatzinformation - Art 10", "Zusatzinformation- Inhalt 10",
  "Zusatzinformation - Art 11", "Zusatzinformation- Inhalt 11", "Zusatzinformation - Art 12", "Zusatzinformation- Inhalt 12",
  "Zusatzinformation - Art 13", "Zusatzinformation- Inhalt 13", "Zusatzinformation - Art 14", "Zusatzinformation- Inhalt 14",
  "Zusatzinformation - Art 15", "Zusatzinformation- Inhalt 15", "Zusatzinformation - Art 16", "Zusatzinformation- Inhalt 16",
  "Zusatzinformation - Art 17", "Zusatzinformation- Inhalt 17", "Zusatzinformation - Art 18", "Zusatzinformation- Inhalt 18",
  "Zusatzinformation - Art 19", "Zusatzinformation- Inhalt 19", "Zusatzinformation - Art 20", "Zusatzinformation- Inhalt 20",
  "Stück", "Gewicht", "Zahlweise", "Forderungsart", "Veranlagungsjahr", "Zugeordnete Fälligkeit", "Skontotyp",
  "Auftragsnummer", "Buchungstyp", "USt-Schlüssel (Anzahlungen)", "EU-Land (Anzahlungen)", "Sachverhalt L+L (Anzahlungen)",
  "EU-Steuersatz (Anzahlungen)", "Erlöskonto (Anzahlungen)", "Herkunft-Kz", "Buchungs GUID", "KOST-Datum",
  "SEPA-Mandatsreferenz", "Skontosperre", "Gesellschaftername", "Beteiligtennummer", "Identifikationsnummer",
  "Zeichnernummer", "Postensperre bis", "Bezeichnung SoBil-Sachverhalt", "Kennzeichen SoBil-Buchung", "Festschreibung",
  "Leistungsdatum", "Datum Zuord. Steuerperiode", "Fälligkeit", "Generalumkehr (GU)", "Steuersatz", "Land",
  "Abrechnungsreferenz", "BVV-Position", "EU-Land u. UStID (Ursprung)", "EU-Steuersatz (Ursprung)", "Abw. Skontokonto",
];

export type DatevSettings = {
  kontenrahmen?: string;     // 'SKR03' | 'SKR04' (nur informativ im Header)
  berater_nr?: string;
  mandant_nr?: string;
  sachkonto_len?: number;
};

export type DatevRow = {
  brutto: number;        // Umsatz (positiv; Gutschriften: negativ uebergeben -> H-Buchung)
  debitor: string;       // Konto (Debitorennummer)
  gegenkonto: string;    // Erloeskonto
  bu?: string;           // BU-Schluessel (leer bei Automatikkonten)
  belegdatum: string;    // ISO yyyy-mm-dd
  belegnr: string;       // Belegfeld 1 (Rechnungsnummer)
  text: string;          // Buchungstext (z. B. Kundenname)
};

// Baut die komplette EXTF-CSV. von/bis als ISO-Daten (yyyy-mm-dd).
export function buildDatevCsv(rows: DatevRow[], s: DatevSettings, vonIso: string, bisIso: string, bezeichnung: string) {
  const now = new Date();
  const erzeugt = `${yyyymmdd(now)}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}000`;
  const von = vonIso.replace(/-/g, "");
  const bis = bisIso.replace(/-/g, "");
  const wj = `${vonIso.slice(0, 4)}0101`; // Wirtschaftsjahresbeginn = 01.01. des Exportjahres
  const skr = String(s.kontenrahmen || "SKR03").replace(/\D/g, "") || "03";

  // Header (31 Felder): EXTF;700;21;"Buchungsstapel";13;erzeugt;;Herkunft;exportiert von;;Berater;Mandant;
  // WJ-Beginn;Sachkontenlaenge;von;bis;Bezeichnung;Diktatkuerzel;Buchungstyp(1=FiBu);
  // Rechnungslegungszweck(0);Festschreibung(0);WKZ;;;;;SKR;;;;
  const header = [
    '"EXTF"', "700", "21", '"Buchungsstapel"', "13", erzeugt, "", '"RE"', '"Regie"', "",
    String(s.berater_nr || "").replace(/\D/g, "") || "0",
    String(s.mandant_nr || "").replace(/\D/g, "") || "0",
    wj, String(s.sachkonto_len || 4), von, bis, `"${txt(bezeichnung, 30)}"`, '""', "1", "0", "0", '"EUR"',
    "", "", "", "", `"${skr}"`, "", "", "", "",
  ].join(";");

  const lines: string[] = [header, COLS.join(";")];

  for (const r of rows) {
    const cells = new Array(COLS.length).fill("");
    const brutto = num(r.brutto);
    const d = new Date(String(r.belegdatum).slice(0, 10) + "T00:00:00");
    cells[0] = amt(brutto);
    cells[1] = brutto >= 0 ? '"S"' : '"H"';          // Rechnung: Soll an Debitor; Gutschrift: Haben
    cells[2] = '"EUR"';
    cells[6] = String(r.debitor || "").replace(/\D/g, "");
    cells[7] = String(r.gegenkonto || "").replace(/\D/g, "");
    cells[8] = r.bu ? `"${txt(r.bu, 4)}"` : '""';
    cells[9] = isNaN(d.getTime()) ? "" : `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}`; // TTMM
    cells[10] = `"${belegfeld(r.belegnr)}"`;
    cells[13] = `"${txt(r.text, 60)}"`;
    cells[113] = "0";                                 // Festschreibung: 0 = nicht festgeschrieben
    lines.push(cells.join(";"));
  }

  return lines.join("\r\n") + "\r\n";
}

// Dateiname nach DATEV-Konvention: EXTF_<frei>.csv
export function datevFileName(vonIso: string, bisIso: string) {
  return `EXTF_Buchungsstapel_${vonIso.replace(/-/g, "")}_${bisIso.replace(/-/g, "")}.csv`;
}
