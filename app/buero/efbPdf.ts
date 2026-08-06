// EFB-Preis-Formblätter (VHB Bund) 221 / 222 / 223 als PDF.
// Isoliert im Büro-Bereich, nutzt jsPDF. Wird nur von Angebote.tsx importiert.
//
// 221  Preisermittlung bei Zuschlagskalkulation
//      -> Verrechnungslohn + Zuschlagssätze je Kostenart + Angebotssumme
// 222  Preisermittlung bei Kalkulation über die Endsumme
//      -> Kalkulationslohn + Einzelkosten der Teilleistungen + Umlage (€)
// 223  Aufgliederung der Einheitspreise
//      -> je Position: Zeitansatz + Lohn / Stoffe / Geräte / Sonstiges = Einheitspreis
//
// Datenquelle ist dieselbe Kalkulation wie in Angebote.tsx / angebotPdf.ts.
import { LUGER_LOGO, LUGER_LOGO_ASPECT } from "./lugerLogo";

// ── Helfer (identisch zur Kalkulation in Angebote.tsx) ──────────────
const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const fmt = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt3 = (n: number) =>
  (Math.round(n * 1000) / 1000).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const pct = (n: number) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtDate(iso: string) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : String(iso);
}

// Kostenbestandteile je Position (pro Einheit), Rabatt der Position auf die
// Vk-Anteile eingerechnet, damit die Summe = Einheitspreis ergibt.
function calcParts(it: any, del: number = 0) {
  const disc = 1 - num(it.discount_pct) / 100;
  const pe = num(it.preiseinheit) || 1;
  const versch = num(it.verschnitt) || 1;
  // Kupfer zählt als Stoffkosten (Material) — pro Einheit, über Preiseinheit heruntergeteilt.
  const kupferEkE = num(it.kupfer_kg) * del / pe;                          // Kupfer-EK je Einheit
  const kupferVkE = kupferEkE * (num(it.kupfer_multi) || 1);               // Kupfer-VK je Einheit
  const matEkE = num(it.mat_ek) * versch / pe + kupferEkE;                 // Stoff-EK je Einheit (inkl. Kupfer)
  const matVk = num(it.mat_ek) * (num(it.mat_multi) || 1) * versch / pe + kupferVkE; // Stoff-VK je Einheit (inkl. Kupfer)
  const lohnEk = it.lohn_ek !== undefined && it.lohn_ek !== "" ? num(it.lohn_ek) : num(it.std_lohn);
  const lohnSatzVk = lohnEk * (num(it.lohn_multi) || 1);
  const zeit = num(it.minutes) / 60;                 // Zeitansatz je Einheit (Std)
  const lohnVk = lohnSatzVk * zeit;                  // Lohn-Vk je Einheit
  const lohnEkE = lohnEk * zeit;                     // Lohn-EK je Einheit
  // Fester E-Preis (ep_fix, wie in Angebote.tsx): Differenz wird den Stoffkosten zugeschlagen,
  // damit die EFB-Summen den Angebotspreis ergeben. (Clamp bei 0, falls fix < Lohn+Fremd+Gerät.)
  const fixed = it.ep_fix !== undefined && it.ep_fix !== null && String(it.ep_fix).trim() !== "";
  const matVkEff = fixed ? Math.max(0, num(it.ep_fix) - lohnVk - num(it.fremd_vk) - num(it.geraet_vk)) : matVk;
  const ep = (matVkEff + lohnVk + num(it.fremd_vk) + num(it.geraet_vk)) * disc;
  return {
    zeit,
    matEk: matEkE,
    matVk: matVkEff * disc,
    lohnEk: lohnEkE,
    lohnVk: lohnVk * disc,
    geraet: num(it.geraet_vk) * disc,
    fremd: num(it.fremd_vk) * disc,
    ep,
  };
}

type Agg = {
  hours: number;
  lohnEk: number; lohnVk: number;
  matEk: number; matVk: number;
  geraet: number; fremd: number;
  net: number;
};

function aggregate(o: any): Agg {
  const items: any[] = Array.isArray(o.items) ? o.items : [];
  const a: Agg = { hours: 0, lohnEk: 0, lohnVk: 0, matEk: 0, matVk: 0, geraet: 0, fremd: 0, net: 0 };
  for (const raw of items) {
    if (raw.kind !== "position") continue;
    const q = num(raw.qty);
    const p = calcParts(raw, num(o.del_preis));
    a.hours += p.zeit * q;
    a.lohnEk += p.lohnEk * q;
    a.lohnVk += p.lohnVk * q;
    a.matEk += p.matEk * q;
    a.matVk += p.matVk * q;
    a.geraet += p.geraet * q;
    a.fremd += p.fremd * q;
    a.net += p.ep * q;
  }
  return a;
}

// Globaler Rabatt/Nachlass des Angebots (auf die Angebotssumme)
function globalNachlass(o: any, net: number) {
  const rabatt = net * (num(o.rabatt_pct) / 100);
  const nachlass = num(o.nachlass);
  return rabatt + nachlass;
}

// ── PDF-Erzeugung ───────────────────────────────────────────────────
export async function generateEfbPdf(o: any, opts: { customerNo?: string; sheets?: ("221" | "222" | "223")[] } = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const sheets = opts.sheets && opts.sheets.length ? opts.sheets : ["221", "222", "223"];

  const mL = 18, mR = 192;
  const a = aggregate(o);
  const nachlass = globalNachlass(o, a.net);
  const angebotssumme = Math.max(0, a.net - nachlass);

  const black = () => doc.setTextColor(0, 0, 0);
  const link = () => doc.setTextColor(30, 80, 160);
  let firstPage = true;

  function footer() {
    const fy = 274;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    black();
    doc.text("Bankverbindung:", mL, fy);
    doc.setFont("helvetica", "normal");
    doc.text("Marco Luger        Raiffeisenbank Chiemgau-Nord - Obing eG", mL, fy + 4);
    doc.text("IBAN: DE76 7016 9165 0001 8893 03    · BIC: GENODEF1SBC", mL, fy + 8);
    doc.text("USt-ID: DE 255 670 812", mR, fy + 8, { align: "right" });
  }

  // Kopf jeder Formblatt-Seite: Logo, Formblatt-Titel, Infoblock (Bieter/AG/Baumaßnahme)
  function head(code: string, title: string): number {
    if (!firstPage) doc.addPage();
    firstPage = false;
    footer();
    const lw = 42, lh = lw / LUGER_LOGO_ASPECT;
    doc.addImage(LUGER_LOGO, "PNG", mR - lw, 12, lw, lh);
    // Formblatt-Kennung + Titel
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    black();
    doc.text(code, mL, 16);
    doc.setFontSize(11);
    doc.text(title, mL, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Ergänzende Vertragsbedingungen – Preis (VHB Bund)", mL, 27);
    // Infoblock
    let iy = 40;
    const lx = mL, vx = 60;
    doc.setFontSize(9.5);
    const info: [string, string][] = [
      ["Bieter:", "Luger Elektrotechnik, Poststraße 22, 83119 Obing"],
      ["Auftraggeber:", [o.customer_name, [o.customer_zip, o.customer_city].filter(Boolean).join(" ")].filter(Boolean).join(", ")],
      ["Baumaßnahme:", String(o.subject || "")],
      ["Angebot:", `Nr. ${o.number || "—"}   vom ${fmtDate(o.offer_date) || "—"}`],
    ];
    for (const [k, v] of info) {
      doc.setFont("helvetica", "bold");
      doc.text(k, lx, iy);
      doc.setFont("helvetica", "normal");
      for (const wl of doc.splitTextToSize(v || "—", mR - vx)) { doc.text(wl, vx, iy); iy += 4.6; }
      iy += 0.6;
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(mL, iy + 1, mR, iy + 1);
    return iy + 8;
  }

  // Zeile: Label links, Wert rechtsbündig, optional Einheit
  function row(y: number, label: string, value: string, opt: { bold?: boolean; unit?: string; indent?: number; valX?: number } = {}) {
    doc.setFont("helvetica", opt.bold ? "bold" : "normal");
    doc.setFontSize(9.5);
    black();
    doc.text(label, mL + (opt.indent || 0), y);
    const vX = opt.valX ?? mR;
    doc.text(value, vX, y, { align: "right" });
    if (opt.unit) doc.text(opt.unit, vX + 2, y);
    return y + 5.4;
  }
  function rule(y: number, x1 = mL, x2 = mR, w = 0.2) {
    doc.setDrawColor(0); doc.setLineWidth(w); doc.line(x1, y - 3.6, x2, y - 3.6);
    return y;
  }
  function section(y: number, t: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    black();
    doc.text(t, mL, y);
    return y + 6.5;
  }

  // ── Formblatt 221 ─────────────────────────────────────────────────
  function sheet221() {
    let y = head("221", "Preisermittlung bei Zuschlagskalkulation");
    const kalkLohn = a.hours > 0 ? a.lohnEk / a.hours : 0;
    const verrLohn = a.hours > 0 ? a.lohnVk / a.hours : 0;
    const zLohn = kalkLohn > 0 ? (verrLohn / kalkLohn - 1) * 100 : 0;
    const zMat = a.matEk > 0 ? (a.matVk / a.matEk - 1) * 100 : 0;

    y = section(y, "1. Angaben zum Verrechnungslohn");
    y = row(y, "Kalkulationslohn (Mittellohn, Einzelkosten)", fmt(kalkLohn), { unit: "€/h", indent: 4, valX: 150 });
    y = row(y, `Zuschlag auf Lohn (BGK, AGK, Wagnis + Gewinn)  ${pct(zLohn)} %`, fmt(verrLohn - kalkLohn), { unit: "€/h", indent: 4, valX: 150 });
    y = rule(y, mL + 4, 152);
    y = row(y, "Verrechnungslohn (Angebotslohn)", fmt(verrLohn), { unit: "€/h", bold: true, indent: 4, valX: 150 });
    y += 3;

    y = section(y, "2. Zuschläge auf die Einzelkosten der Teilleistungen");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text("Die Zuschläge decken Baustellengemeinkosten, Allgemeine Geschäftskosten sowie Wagnis und Gewinn.", mL + 4, y - 1);
    y += 4;
    // kleine Tabelle Kostenart | Zuschlag %
    const zx = 150;
    y = row(y, "Löhne", pct(zLohn) + " %", { indent: 4, valX: zx });
    y = row(y, "Stoffkosten (Material)", pct(zMat) + " %", { indent: 4, valX: zx });
    y = row(y, "Gerätekosten", pct(0) + " %", { indent: 4, valX: zx });
    y = row(y, "Sonstige Kosten", pct(0) + " %", { indent: 4, valX: zx });
    y = row(y, "Nachunternehmerleistungen", pct(0) + " %", { indent: 4, valX: zx });
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.6); doc.setTextColor(90, 90, 90);
    doc.text("Geräte, Sonstige Kosten und Nachunternehmerleistungen werden als Endpreise (ohne separaten Zuschlag) kalkuliert.", mL + 4, y - 1);
    black();
    y += 4;

    y = section(y, "3. Ermittlung der Angebotssumme");
    const vx = 150;
    y = row(y, `Lohnkosten (Verrechnungslohn × ${fmt(a.hours)} h)`, fmt(a.lohnVk), { unit: "€", indent: 4, valX: vx });
    y = row(y, "Stoffkosten (mit Zuschlag)", fmt(a.matVk), { unit: "€", indent: 4, valX: vx });
    y = row(y, "Gerätekosten", fmt(a.geraet), { unit: "€", indent: 4, valX: vx });
    y = row(y, "Sonstige Kosten / Nachunternehmerleistungen", fmt(a.fremd), { unit: "€", indent: 4, valX: vx });
    y = rule(y, mL + 4, vx + 2);
    y = row(y, "Summe der Teilleistungen (netto)", fmt(a.net), { unit: "€", bold: true, indent: 4, valX: vx });
    if (nachlass > 0) {
      y = row(y, "abzüglich Nachlass / Rabatt", "-" + fmt(nachlass), { unit: "€", indent: 4, valX: vx });
    }
    y = rule(y, mL + 4, vx + 2, 0.4);
    y = row(y, "Angebotssumme (netto)", fmt(angebotssumme), { unit: "€", bold: true, indent: 4, valX: vx });
  }

  // ── Formblatt 222 ─────────────────────────────────────────────────
  function sheet222() {
    let y = head("222", "Preisermittlung bei Kalkulation über die Endsumme");
    const kalkLohn = a.hours > 0 ? a.lohnEk / a.hours : 0;
    const summeEk = a.lohnEk + a.matEk + a.geraet + a.fremd;
    const umlage = angebotssumme - summeEk;

    y = section(y, "1. Angaben zum Kalkulationslohn");
    y = row(y, "Kalkulationslohn (Mittellohn, Einzelkosten)", fmt(kalkLohn), { unit: "€/h", indent: 4, valX: 150 });
    y = row(y, `Gesamte Lohnstunden`, fmt(a.hours), { unit: "h", indent: 4, valX: 150 });
    y += 3;

    y = section(y, "2. Einzelkosten der Teilleistungen (ohne Umlagen)");
    const vx = 150;
    y = row(y, "Lohnkosten (Einzelkosten)", fmt(a.lohnEk), { unit: "€", indent: 4, valX: vx });
    y = row(y, "Stoffkosten (Einzelkosten)", fmt(a.matEk), { unit: "€", indent: 4, valX: vx });
    y = row(y, "Gerätekosten", fmt(a.geraet), { unit: "€", indent: 4, valX: vx });
    y = row(y, "Sonstige Kosten / Nachunternehmerleistungen", fmt(a.fremd), { unit: "€", indent: 4, valX: vx });
    y = rule(y, mL + 4, vx + 2);
    y = row(y, "Summe Einzelkosten der Teilleistungen", fmt(summeEk), { unit: "€", bold: true, indent: 4, valX: vx });
    y += 3;

    y = section(y, "3. Umlage und Angebotssumme");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text("Umlage auf die Einzelkosten für Baustellengemeinkosten, Allgemeine Geschäftskosten sowie Wagnis und Gewinn.", mL + 4, y - 1);
    y += 4;
    y = row(y, "Summe Einzelkosten der Teilleistungen", fmt(summeEk), { unit: "€", indent: 4, valX: vx });
    y = row(y, "Umlage (BGK + AGK + Wagnis + Gewinn)", fmt(umlage), { unit: "€", indent: 4, valX: vx });
    y = rule(y, mL + 4, vx + 2, 0.4);
    y = row(y, "Angebotssumme (netto)", fmt(angebotssumme), { unit: "€", bold: true, indent: 4, valX: vx });
  }

  // ── Formblatt 223 ─────────────────────────────────────────────────
  function sheet223() {
    const items: any[] = Array.isArray(o.items) ? o.items : [];
    // Spalten (Zahlen rechtsbündig an x, ~15 mm Spaltenbreite)
    const cOZ = mL;             // Ordnungszahl
    const cBez = mL + 11;       // Bezeichnung
    const bezRight = 86;        // Bezeichnung Umbruch bis hier
    const cMenge = 97;          // Menge (r)
    const cME = 99;             // Einheit (l)
    const cZeit = 115;          // Zeitansatz (r)
    const cLohn = 130;          // Löhne €/E (r)
    const cStoff = 145;         // Stoffe €/E (r)
    const cGer = 160;           // Geräte €/E (r)
    const cSonst = 175;         // Sonstiges €/E (r)
    const cEP = mR;             // EP €/E (r)
    const contentBottom = 262;
    const LH = 4.4;

    let y = head("223", "Aufgliederung der Einheitspreise");
    let page223 = 1;

    function colHead(atY: number) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      black();
      doc.setDrawColor(0); doc.setLineWidth(0.2);
      doc.line(mL, atY - 3.4, mR, atY - 3.4);
      doc.text("OZ", cOZ, atY);
      doc.text("Bezeichnung", cBez, atY);
      doc.text("Menge", cMenge, atY, { align: "right" });
      doc.text("ME", cME + 2, atY);
      doc.text("Zeit h/E", cZeit, atY, { align: "right" });
      doc.text("Lohn", cLohn, atY, { align: "right" });
      doc.text("Stoffe", cStoff, atY, { align: "right" });
      doc.text("Geräte", cGer, atY, { align: "right" });
      doc.text("Sonst.", cSonst, atY, { align: "right" });
      doc.text("EP €/E", cEP, atY, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.6); doc.setTextColor(90, 90, 90);
      doc.text("(je Einheit, € netto)", cBez, atY + 3);
      black();
      doc.line(mL, atY + 4.4, mR, atY + 4.4);
    }

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.4);
    doc.text("Aufgliederung der Einheitspreise in ihre Bestandteile (je Mengeneinheit, Beträge netto in €).", mL, y - 2);
    y += 3;
    colHead(y); y += 8;

    function ensure(h: number) {
      if (y + h > contentBottom) {
        page223++;
        y = head("223", "Aufgliederung der Einheitspreise");
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.4);
        doc.text(`Fortsetzung – Seite ${page223}`, mR, y - 2, { align: "right" });
        y += 3;
        colHead(y); y += 8;
      }
    }

    let anyPos = false;
    for (const it of items) {
      if (it.kind === "titel") {
        ensure(LH + 3);
        y += 1.5;
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.4); black();
        const tt = [it.oz, it.title].filter(Boolean).join("  ");
        for (const wl of doc.splitTextToSize(tt || "(Titel)", mR - cOZ)) { doc.text(wl, cOZ, y); y += LH; }
        y += 1;
        continue;
      }
      if (it.kind !== "position") continue;
      anyPos = true;
      const p = calcParts(it, num(o.del_preis));
      const bez = doc.splitTextToSize(String(it.short_text || it.long_text || "").split("\n")[0] || "", bezRight - cBez);
      const nLines = Math.max(1, bez.length);
      ensure(nLines * LH + 1.5);
      doc.setFontSize(7.4);
      for (let i = 0; i < nLines; i++) {
        doc.setFont("helvetica", "normal"); black();
        if (i === 0) {
          if (it.oz) doc.text(String(it.oz), cOZ, y);
          doc.text(fmt(num(it.qty)), cMenge, y, { align: "right" });
          doc.text(String(it.unit || ""), cME + 2, y);
          doc.text(fmt3(p.zeit), cZeit, y, { align: "right" });
          doc.text(fmt(p.lohnVk), cLohn, y, { align: "right" });
          doc.text(fmt(p.matVk), cStoff, y, { align: "right" });
          doc.text(fmt(p.geraet), cGer, y, { align: "right" });
          doc.text(fmt(p.fremd), cSonst, y, { align: "right" });
          doc.setFont("helvetica", "bold");
          doc.text(fmt(p.ep), cEP, y, { align: "right" });
          doc.setFont("helvetica", "normal");
        }
        if (bez[i]) doc.text(bez[i], cBez, y);
        y += LH;
      }
      y += 0.8;
    }
    if (!anyPos) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); black();
      doc.text("Keine Positionen im Angebot vorhanden.", cOZ, y);
    }
  }

  // ── Ablauf ────────────────────────────────────────────────────────
  for (const s of sheets) {
    if (s === "221") sheet221();
    else if (s === "222") sheet222();
    else if (s === "223") sheet223();
  }

  doc.save(`EFB_221-223_${(o.number || "Entwurf").toString().replace(/[^\w.-]+/g, "_")}.pdf`);
}
