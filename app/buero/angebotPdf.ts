// Angebots-PDF im Luger-Layout (Briefkopf, Positions-Tabelle, Ueberträge,
// Titel-Zusammenstellung, Fußzeile). Isoliert im Buero-Bereich, nutzt jsPDF.
import { LUGER_LOGO, LUGER_LOGO_ASPECT } from "./lugerLogo";

// ── Helfer (identisch zur Kalkulation in Angebote.tsx) ──────────────
const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const fmt = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtDate(iso: string) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : String(iso);
}
function addWeeks(dateStr: string, weeks: number) {
  if (!dateStr || !weeks) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d.toISOString().slice(0, 10);
}
function calcItem(it: any, del: number = 0) {
  if (it.kind !== "position") return { ...it, ep: 0, gp: 0 };
  const pe = num(it.preiseinheit) || 1;
  const versch = num(it.verschnitt) || 1;
  const matVk = num(it.mat_ek) * (num(it.mat_multi) || 1) * versch / pe;
  const lohnEk = it.lohn_ek !== undefined && it.lohn_ek !== "" ? num(it.lohn_ek) : num(it.std_lohn);
  const lohnSatzVk = lohnEk * (num(it.lohn_multi) || 1);
  const lohnVk = lohnSatzVk * (num(it.minutes) / 60);
  const kupferVk = num(it.kupfer_kg) * del * (num(it.kupfer_multi) || 1) / pe;
  const ep = matVk + lohnVk + kupferVk + num(it.fremd_vk) + num(it.geraet_vk);
  const gp = ep * num(it.qty) * (1 - num(it.discount_pct) / 100);
  return { ...it, ep, gp };
}
function offerTotals(items: any[], o: any) {
  let net = 0;
  const del = num(o.del_preis);
  for (const raw of items) if (raw.kind === "position") net += calcItem(raw, del).gp;
  const rabatt = net * (num(o.rabatt_pct) / 100);
  const nachlass = num(o.nachlass);
  const netAfter = Math.max(0, net - rabatt - nachlass);
  const vat = netAfter * (num(o.vat_rate) / 100);
  const gross = netAfter + vat;
  const skonto = netAfter * (num(o.skonto_pct) / 100);
  return { net, rabatt, nachlass, netAfter, vat, gross, skonto };
}
function titleSum(items: any[], idx: number, del: number = 0) {
  let s = 0;
  for (let i = idx + 1; i < items.length; i++) {
    if (items[i].kind === "titel") break;
    if (items[i].kind === "position") s += calcItem(items[i], del).gp;
  }
  return s;
}

// ── PDF-Erzeugung ───────────────────────────────────────────────────
// Gemeinsamer Generator für Angebot (und ab Stufe 6b: Auftragsbestätigung).
// cfg steuert die dokumentart-spezifischen Unterschiede; Layout/Kalkulation
// sind identisch (gleiche calcItem-/Kupferlogik wie Angebote.tsx).
type DocPdfConfig = {
  title: string;        // Kopfzeile, z. B. "A N G E B O T"
  filePrefix: string;   // Dateiname, z. B. "Angebot"
  docDate: string;      // Belegdatum (ISO) für den Infoblock
  refLine?: string;     // Bezugszeile unter der Titelzeile (Seite 1)
  showBindefrist: boolean;   // Gültigkeits-Satz (nur Angebot)
  showSignature: boolean;    // "Auftrag erteilt"-Block (nur Angebot)
  closingText?: string;      // Schlusssatz (z. B. Dank bei AB)
};

async function generateDocPdf(o: any, opts: { customerNo?: string } = {}, cfg: DocPdfConfig) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Seiten-/Spaltenmaße (mm)
  const mL = 18, mR = 192;
  const contentBottom = 256;
  const uebertragY = 262;
  const cxPos = mL;          // OZ / Position
  const cxMengeR = 44;       // Menge (rechtsbündig)
  const cxEinh = 47;         // Einheit
  const cxBez = 62;          // Bezeichnung (links)
  const bezRight = 150;      // Bezeichnung Umbruchbreite bis hier
  const bezW = bezRight - cxBez;
  const cxEP_R = 168;        // E-Preis (rechtsbündig)
  const cxGP_R = mR;         // G-Preis (rechtsbündig)
  const LH = 4.2;            // Zeilenhöhe Tabelle
  const items: any[] = Array.isArray(o.items) ? o.items : [];

  let page = 0;
  let y = 0;
  let carry = 0; // laufender Übertrag (Summe G-Preise)

  const link = () => doc.setTextColor(30, 80, 160);
  const black = () => doc.setTextColor(0, 0, 0);

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

  function senderRight(topY: number, withCompany: boolean) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    black();
    let sy = topY;
    const lines = withCompany
      ? ["Luger Elektrotechnik", "Poststraße 22", "D-83119 Obing", "+49 / 8624 / 891 69 42"]
      : ["Poststraße 22", "D-83119 Obing", "+49 / 8624 / 891 69 42"];
    for (const l of lines) { doc.text(l, mR, sy, { align: "right" }); sy += 4; }
    link();
    doc.text("info@elektrotechnik-luger.de", mR, sy, { align: "right" }); sy += 4;
    doc.text("www.elektrotechnik-luger.de", mR, sy, { align: "right" }); sy += 4;
    black();
    return sy;
  }

  function letterheadFirst() {
    const lw = 55, lh = lw / LUGER_LOGO_ASPECT;
    doc.addImage(LUGER_LOGO, "PNG", mR - lw, 12, lw, lh);
    senderRight(12 + lh + 5, true);
    // Empfänger links
    let ry = 42;
    const rec = [o.customer_name, o.customer_street, [o.customer_zip, o.customer_city].filter(Boolean).join(" ")]
      .filter((x) => x && String(x).trim());
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    black();
    for (const l of rec) { doc.text(String(l), mL, ry); ry += 5; }
    // Belegkopf-Infoblock rechts
    let iy = 66;
    doc.setFontSize(9.5);
    const ix = 128, ic = 152, iv = 158;
    doc.text("Seite", ix, iy); doc.text(":", ic, iy); doc.text("1", iv, iy); iy += 5;
    doc.text("Datum", ix, iy); doc.text(":", ic, iy); doc.text(fmtDate(cfg.docDate) || "", iv, iy); iy += 5;
    if (opts.customerNo) { doc.text("Kunden-Nr.", ix, iy); doc.text(":", ic, iy); doc.text(String(opts.customerNo), iv, iy); iy += 5; }
    // Dokument-Titel + Nr. links
    doc.setFontSize(11);
    doc.text(`${cfg.title} - Nr.: ${o.number || ""}`, mL, 72);
    if (cfg.refLine) {
      doc.setFontSize(9);
      doc.text(String(cfg.refLine), mL, 77.5);
    }
  }

  function letterheadCont() {
    const lw = 48, lh = lw / LUGER_LOGO_ASPECT;
    doc.addImage(LUGER_LOGO, "PNG", mL, 12, lw, lh);
    senderRight(14, false);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    black();
    doc.text(`${cfg.title} - Nr.: ${o.number || ""}`, mL, 44);
    doc.setFontSize(9.5);
    doc.text("Seite:", 160, 44);
    doc.text(String(page + 1), mR, 44, { align: "right" });
  }

  function colHeader(atY: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    black();
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(mL, atY - 3.5, mR, atY - 3.5);
    doc.text("Position", cxPos, atY);
    doc.text("Menge", cxMengeR, atY, { align: "right" });
    doc.text("Einh.", cxEinh, atY);
    doc.text("Bezeichnung", cxBez, atY);
    doc.text("E-Preis", cxEP_R, atY, { align: "right" });
    doc.text("G-Preis", cxGP_R, atY, { align: "right" });
    doc.line(mL, atY + 1.8, mR, atY + 1.8);
  }

  function drawTopCarry() {
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(cxEP_R + 2, y - 3.5, cxGP_R, y - 3.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Übertrag:", 132, y);
    doc.text(fmt(carry), cxGP_R, y, { align: "right" });
    y += 6.5;
  }

  function drawBottomCarry() {
    const ly = uebertragY;
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(cxEP_R + 2, ly - 3.5, cxGP_R, ly - 3.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    black();
    doc.text("Übertrag:", 132, ly);
    doc.text(fmt(carry), cxGP_R, ly, { align: "right" });
  }

  function startFirstPage() {
    page = 0;
    footer();
    letterheadFirst();
    let py = 84;
    if (o.subject) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      black();
      for (const wl of doc.splitTextToSize(String(o.subject), mR - mL)) { doc.text(wl, mL, py); py += 5; }
      py += 1;
    }
    if (o.vortext) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      for (const wl of doc.splitTextToSize(String(o.vortext), mR - mL)) { doc.text(wl, mL, py); py += 4.6; }
      py += 4;
    }
    const headY = py + 4;
    colHeader(headY);
    y = headY + 5;
  }

  function newContentPage() {
    drawBottomCarry();
    page++;
    doc.addPage();
    footer();
    letterheadCont();
    colHeader(52);
    y = 57;
    if (carry > 0) drawTopCarry();
  }

  function newPlainPage() {
    page++;
    doc.addPage();
    footer();
    letterheadCont();
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(mL, 49, mR, 49);
    y = 57;
  }

  function ensureLine() {
    if (y + LH > contentBottom) newContentPage();
  }
  function ensureSpace(h: number) {
    if (y + h > contentBottom) newContentPage();
  }
  function ensurePlain(h: number) {
    if (y + h > contentBottom) newPlainPage();
  }

  function bezLines(it: any): { t: string; bold: boolean }[] {
    const out: { t: string; bold: boolean }[] = [];
    if (it.short_text) for (const wl of doc.splitTextToSize(String(it.short_text), bezW)) out.push({ t: wl, bold: true });
    if (it.long_text) {
      for (const para of String(it.long_text).split("\n")) {
        if (para.trim() === "") out.push({ t: "", bold: false });
        else for (const wl of doc.splitTextToSize(para, bezW)) out.push({ t: wl, bold: false });
      }
    }
    if (out.length === 0) out.push({ t: String(it.short_text || ""), bold: true });
    return out;
  }

  function drawTitel(it: any) {
    ensureSpace(LH + 4);
    y += 2.5;
    doc.setFontSize(9.5);
    black();
    if (it.oz) { doc.setFont("helvetica", "normal"); doc.text(String(it.oz), cxPos, y); }
    doc.setFont("helvetica", "bold");
    for (const wl of doc.splitTextToSize(String(it.title || ""), bezRight - cxBez)) { doc.text(wl, cxBez, y); y += LH; }
    y += 1.5;
  }

  function drawTitelSum(title: string, sum: number) {
    ensureSpace(LH + 3);
    y += 1.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    black();
    doc.text(String(title || ""), cxBez, y);
    doc.text(fmt(sum), cxGP_R, y, { align: "right" });
    y += LH + 2.5;
  }

  function drawText(it: any) {
    const lines = bezLines(it);
    y += 1.5;
    for (let i = 0; i < lines.length; i++) {
      ensureLine();
      if (i === 0 && it.oz) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); black(); doc.text(String(it.oz), cxPos, y); }
      doc.setFont("helvetica", lines[i].bold ? "bold" : "normal");
      doc.setFontSize(9);
      black();
      if (lines[i].t) doc.text(lines[i].t, cxBez, y);
      y += LH;
    }
  }

  function drawPosition(it: any) {
    const c = calcItem(it, num(o.del_preis));
    const lines = bezLines(it);
    y += 1.5;
    for (let i = 0; i < lines.length; i++) {
      ensureLine();
      const first = i === 0, last = i === lines.length - 1;
      if (first) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        black();
        if (it.oz) doc.text(String(it.oz), cxPos, y);
        doc.text(fmt(num(it.qty)), cxMengeR, y, { align: "right" });
        doc.text(String(it.unit || ""), cxEinh, y);
      }
      doc.setFont("helvetica", lines[i].bold ? "bold" : "normal");
      doc.setFontSize(9);
      black();
      if (lines[i].t) doc.text(lines[i].t, cxBez, y);
      if (last) {
        doc.setFont("helvetica", "normal");
        doc.text(fmt(c.ep), cxEP_R, y, { align: "right" });
        doc.text(fmt(c.gp), cxGP_R, y, { align: "right" });
      }
      y += LH;
    }
    carry += c.gp;
  }

  function drawZusammenstellung() {
    const titels = items.filter((x) => x.kind === "titel");
    const needed = 24 + titels.length * 5 + 55;
    if (y + needed > contentBottom) newPlainPage();
    else y += 10;
    // Überschrift mit Linien
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(mL, y - 4, mR, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    black();
    doc.text("Titel-Zusammenstellung", mL, y);
    doc.line(mL, y + 2, mR, y + 2);
    y += 9;
    // Titel + Summen
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "titel") {
        doc.text(String(items[i].title || ""), cxBez, y);
        doc.text(fmt(titleSum(items, i, num(o.del_preis))), cxGP_R, y, { align: "right" });
        y += 5;
      }
    }
    y += 5;
    const t = offerTotals(items, o);
    const labelX = 92, euroX = 150, valR = cxGP_R;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    if (t.rabatt > 0) { doc.text(`Rabatt ${fmt(num(o.rabatt_pct))} %`, labelX, y); doc.text("€", euroX, y); doc.text("-" + fmt(t.rabatt), valR, y, { align: "right" }); y += 5; }
    if (t.nachlass > 0) { doc.text("Nachlass", labelX, y); doc.text("€", euroX, y); doc.text("-" + fmt(t.nachlass), valR, y, { align: "right" }); y += 5; }
    doc.text("Netto-Summe", labelX, y); doc.text("€", euroX, y); doc.text(fmt(t.netAfter), valR, y, { align: "right" }); y += 5;
    doc.text(`${fmt(num(o.vat_rate))} % USt.`, labelX, y); doc.text("€", euroX, y); doc.text(fmt(t.vat), valR, y, { align: "right" }); y += 6;
    doc.setLineWidth(0.2);
    doc.line(labelX, y - 4, valR, y - 4);
    doc.setFont("helvetica", "bold");
    doc.text("Gesamt-Betrag", labelX, y); doc.text("€", euroX, y); doc.text(fmt(t.gross), valR, y, { align: "right" });
    doc.setLineWidth(0.4);
    doc.line(labelX, y + 2.5, valR, y + 2.5);
    doc.line(labelX, y + 3.1, valR, y + 3.1);
    doc.setLineWidth(0.2);
    y += 12;
    // Steuerhinweis
    if (o.tax_note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const wl of doc.splitTextToSize(String(o.tax_note), mR - mL)) { ensurePlain(6); doc.text(wl, mL, y); y += 4.4; }
      y += 3;
    }
    // Bindefrist (nur Angebot)
    if (cfg.showBindefrist) {
      const valid = o.binde_weeks && o.offer_date ? addWeeks(o.offer_date, num(o.binde_weeks)) : o.valid_until;
      if (valid) {
        ensurePlain(8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text(`Bitte beachten Sie, dass das vorliegende Angebot nur bis zum ${fmtDate(valid)} gültig ist.`, mL, y);
        y += 9;
      }
    }
    // Nachtext
    if (o.nachtext) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      for (const wl of doc.splitTextToSize(String(o.nachtext), mR - mL)) { ensurePlain(6); doc.text(wl, mL, y); y += 4.6; }
      y += 4;
    }
    // Zahlungsbedingungen
    const p1 = num(o.pay1_pct), p2 = num(o.pay2_pct), p3 = num(o.pay3_pct);
    if (p1 || p2 || p3) {
      ensurePlain(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Zahlungsbedingungen:", mL, y); y += 5;
      doc.setFont("helvetica", "normal");
      const zb = `${fmt(p1)} % bei Auftragserteilung, ${fmt(p2)} % bei Auftragsbeginn, ${fmt(p3)} % bei Auftragsabschluss.`;
      for (const wl of doc.splitTextToSize(zb, mR - mL)) { ensurePlain(6); doc.text(wl, mL, y); y += 4.6; }
      if (num(o.skonto_pct) > 0) { ensurePlain(6); doc.text(`Zahlbar innerhalb ${num(o.skonto_tage)} Tagen mit ${fmt(num(o.skonto_pct))} % Skonto.`, mL, y); y += 5; }
      y += 4;
    }
    // Schlusssatz (z. B. Dank bei AB)
    if (cfg.closingText) {
      ensurePlain(10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      for (const wl of doc.splitTextToSize(String(cfg.closingText), mR - mL)) { ensurePlain(6); doc.text(wl, mL, y); y += 4.6; }
      y += 4;
    }
    // Auftrag erteilt / Unterschrift (nur Angebot)
    if (cfg.showSignature) {
      ensurePlain(26);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Auftrag erteilt:", mL, y); y += 9;
      doc.setFont("helvetica", "normal");
      doc.text("Ort, Datum, Unterschrift: ______________________________________________", mL, y); y += 8;
      doc.text("Bitte um Rücksendung an E-Mail: marco@elektrotechnik-luger.de", mL, y);
    }
  }

  // ── Ablauf ────────────────────────────────────────────────────────
  startFirstPage();
  let lastTitel = -1;
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    if (it.kind === "titel") {
      if (lastTitel >= 0) drawTitelSum(items[lastTitel].title, titleSum(items, lastTitel, num(o.del_preis)));
      drawTitel(it);
      lastTitel = idx;
    } else if (it.kind === "text") {
      drawText(it);
    } else {
      drawPosition(it);
    }
  }
  if (lastTitel >= 0) drawTitelSum(items[lastTitel].title, titleSum(items, lastTitel, num(o.del_preis)));
  drawZusammenstellung();

  doc.save(`${cfg.filePrefix}_${(o.number || "Entwurf").toString().replace(/[^\w.-]+/g, "_")}.pdf`);
}

// ── Öffentliche Einstiege je Dokumentart ────────────────────────────
export async function generateAngebotPdf(o: any, opts: { customerNo?: string } = {}) {
  return generateDocPdf(o, opts, {
    title: "A N G E B O T",
    filePrefix: "Angebot",
    docDate: o.offer_date,
    showBindefrist: true,
    showSignature: true,
  });
}

// Stufe 6b: Auftragsbestätigungs-PDF im gleichen Luger-Layout.
// parentInfo z. B. "Angebot Nr. 1234567 vom 05.08.2026" (Bezugszeile Seite 1).
export async function generateAbPdf(o: any, opts: { customerNo?: string; parentInfo?: string } = {}) {
  return generateDocPdf(o, { customerNo: opts.customerNo }, {
    title: "A U F T R A G S B E S T Ä T I G U N G",
    filePrefix: "AB",
    docDate: o.doc_date || o.offer_date,
    refLine: opts.parentInfo ? `Bezug: ${opts.parentInfo}` : undefined,
    showBindefrist: false,
    showSignature: false,
    closingText: "Wir bedanken uns für Ihren Auftrag und bestätigen die Ausführung der oben aufgeführten Leistungen.",
  });
}
