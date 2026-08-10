// EFB-Preis-Formblätter (VHB Bund) 221 / 222 / 223 als PDF — Layout nach den
// offiziellen Formblättern (Vorlage: Taifun-Ausdrucke von Marco, 08/2026).
//
// 221  Preisermittlung bei Zuschlagskalkulation
//      -> Tabelle 1 Verrechnungslohn, Tabelle 2 Zuschläge je Kostenart,
//         Tabelle 3 Ermittlung der Angebotssumme + Erläuterungen
// 222  Preisermittlung bei Kalkulation über die Endsumme (vereinfachte Darstellung)
// 223  Aufgliederung der Einheitspreise (10 Spalten: OZ, Kurzbezeichnung, Menge,
//      ME, Zeitansatz, Löhne, Stoffe, Geräte, Sonstiges, Einheitspreis) + Fußnoten
//
// Datenquelle ist dieselbe Kalkulation wie in Angebote.tsx / angebotPdf.ts:
// ep_fix (fester EP -> Differenz in Stoffe), Fremd/Gerät EK×Multi, Kupfer in Stoffe.

// ── Helfer (identisch zur Kalkulation in Angebote.tsx) ──────────────
const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const fmt = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtDate(iso: string) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : String(iso);
}

// Kostenbestandteile je Position (pro Einheit), Rabatt der Position eingerechnet.
function calcParts(it: any, del: number = 0) {
  const disc = 1 - num(it.discount_pct) / 100;
  const pe = num(it.preiseinheit) || 1;
  const versch = num(it.verschnitt) || 1;
  // Kupfer zählt als Stoffkosten (Material) — pro Einheit, über Preiseinheit heruntergeteilt.
  const kupferEkE = num(it.kupfer_kg) * del / pe;
  const kupferVkE = kupferEkE * (num(it.kupfer_multi) || 1);
  const matEkE = num(it.mat_ek) * versch / pe + kupferEkE;
  const matVk = num(it.mat_ek) * (num(it.mat_multi) || 1) * versch / pe + kupferVkE;
  const lohnEk = it.lohn_ek !== undefined && it.lohn_ek !== "" ? num(it.lohn_ek) : num(it.std_lohn);
  const lohnSatzVk = lohnEk * (num(it.lohn_multi) || 1);
  const zeit = num(it.minutes) / 60;                 // Zeitansatz je Einheit (Std)
  const lohnVk = lohnSatzVk * zeit;
  const lohnEkE = lohnEk * zeit;
  // Fremd/Gerät: EK×Multi wenn ein EK eingetragen ist, sonst direktes Vk-Feld — identisch zu Angebote.tsx.
  const fremdEkSet = it.fremd_ek !== undefined && it.fremd_ek !== null && String(it.fremd_ek) !== "";
  const geraetEkSet = it.geraet_ek !== undefined && it.geraet_ek !== null && String(it.geraet_ek) !== "";
  const fremdVkE = fremdEkSet ? num(it.fremd_ek) * (num(it.fremd_multi) || 1) : num(it.fremd_vk);
  const geraetVkE = geraetEkSet ? num(it.geraet_ek) * (num(it.geraet_multi) || 1) : num(it.geraet_vk);
  const fremdEkE = fremdEkSet ? num(it.fremd_ek) : num(it.fremd_vk);   // ohne EK: Vk = Ek (Zuschlag 0)
  const geraetEkE = geraetEkSet ? num(it.geraet_ek) : num(it.geraet_vk);
  // Fester E-Preis (ep_fix): Differenz wird den Stoffkosten zugeschlagen (Clamp bei 0).
  const fixed = it.ep_fix !== undefined && it.ep_fix !== null && String(it.ep_fix).trim() !== "";
  const matVkEff = fixed ? Math.max(0, num(it.ep_fix) - lohnVk - fremdVkE - geraetVkE) : matVk;
  const ep = (matVkEff + lohnVk + fremdVkE + geraetVkE) * disc;
  return {
    zeit,
    minutes: num(it.minutes),
    matEk: matEkE,
    matVk: matVkEff * disc,
    lohnEk: lohnEkE,
    lohnVk: lohnVk * disc,
    geraet: geraetVkE * disc,
    geraetEk: geraetEkE,
    fremd: fremdVkE * disc,
    fremdEk: fremdEkE,
    ep,
  };
}

type Agg = {
  hours: number;
  lohnEk: number; lohnVk: number;
  matEk: number; matVk: number;
  geraet: number; geraetEk: number;
  fremd: number; fremdEk: number;
  net: number;
};

function aggregate(o: any): Agg {
  const items: any[] = Array.isArray(o.items) ? o.items : [];
  const a: Agg = { hours: 0, lohnEk: 0, lohnVk: 0, matEk: 0, matVk: 0, geraet: 0, geraetEk: 0, fremd: 0, fremdEk: 0, net: 0 };
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
    a.geraetEk += p.geraetEk * q;
    a.fremd += p.fremd * q;
    a.fremdEk += p.fremdEk * q;
    a.net += p.ep * q;
  }
  return a;
}

function globalNachlass(o: any, net: number) {
  return net * (num(o.rabatt_pct) / 100) + num(o.nachlass);
}

// ── PDF-Erzeugung ───────────────────────────────────────────────────
// Einstellbare Zuschläge (wie Taifun): BGK/AGK je Kostenart [Lohn, Material, Geräte, Fremd],
// Wagnis+Gewinn = Rest nach BGK+AGK (aufgeteilt nach Anteilen), Lohn-Zeilen 1.2/1.3 in % auf ML.
export type EfbZuschlaege = {
  bgk: number[]; agk: number[];
  anteilGewinn: number; anteilWagnisBetrieb: number; anteilWagnisLeistung: number;
  lohnzusatz: number; lohnneben: number;
};

export async function generateEfbPdf(o: any, opts: { customerNo?: string; sheets?: ("221" | "222" | "223")[]; efb?: EfbZuschlaege } = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const sheets = opts.sheets && opts.sheets.length ? opts.sheets : ["221", "222", "223"];

  const mL = 20, mR = 190;
  const a = aggregate(o);
  const nachlass = globalNachlass(o, a.net);
  const angebotssumme = Math.max(0, a.net - nachlass);

  const black = () => doc.setTextColor(0, 0, 0);
  let firstPage = true;

  function line(x1: number, y1: number, x2: number, y2: number, w = 0.25) {
    doc.setDrawColor(0); doc.setLineWidth(w); doc.line(x1, y1, x2, y2);
  }
  function rect(x1: number, y1: number, x2: number, y2: number, w = 0.25) {
    doc.setDrawColor(0); doc.setLineWidth(w); doc.rect(x1, y1, x2 - x1, y2 - y1);
  }

  // Kopf jeder Formblatt-Seite nach amtlichem Layout:
  // rechts oben Formblatt-Nummer + Untertitel, darunter Kasten Bieter/Vergabenummer/Datum,
  // Baumaßnahme, Angebot für. Liefert y unterhalb des Kastens.
  function head(code: string, subtitle: string): number {
    if (!firstPage) doc.addPage();
    firstPage = false;
    black();
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(code, mR, 16, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(`(${subtitle})`, mR, 20.5, { align: "right" });

    const top = 24, xVerg = 108, xDat = 148;
    const r1 = top + 12, r2 = r1 + 15, r3 = r2 + 15;
    rect(mL, top, mR, r3, 0.3);
    line(xVerg, top, xVerg, r1); line(xDat, top, xDat, r1);
    line(mL, r1, mR, r1); line(mL, r2, mR, r2);
    doc.setFontSize(9);
    doc.text("Bieter", mL + 2, top + 4.5);
    doc.text("Vergabenummer", xVerg + 2, top + 4.5);
    doc.text("Datum", xDat + 2, top + 4.5);
    doc.setFontSize(9.5);
    doc.text("Marco Luger Elektrotechnik", mL + 12, top + 9.5);
    doc.text(String(o.number || "—"), xVerg + 2, top + 9.5);
    doc.text(fmtDate(o.offer_date) || "—", xDat + 2, top + 9.5);
    doc.setFontSize(9);
    doc.text("Baumaßnahme", mL + 2, r1 + 4.5);
    doc.setFontSize(9.5);
    doc.text(doc.splitTextToSize(String(o.subject || "—"), mR - mL - 16)[0] || "—", mL + 12, r1 + 10);
    doc.setFontSize(9);
    doc.text("Angebot für", mL + 2, r2 + 4.5);
    doc.setFontSize(9.5);
    const kunde = [o.customer_name, o.customer_street, [o.customer_zip, o.customer_city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    doc.text(doc.splitTextToSize(kunde || "—", mR - mL - 16)[0] || "—", mL + 12, r2 + 10);
    return r3 + 10;
  }

  // Kennzahlen für 221/222
  const ml = a.hours > 0 ? a.lohnEk / a.hours : 0;             // Mittellohn ML (EK)
  const vl = a.hours > 0 ? a.lohnVk / a.hours : 0;             // Verrechnungslohn VL
  const zLohn = ml > 0 ? (vl / ml - 1) * 100 : 0;
  const zMat = a.matEk > 0 ? (a.matVk / a.matEk - 1) * 100 : 0;
  const zGer = a.geraetEk > 0 ? (a.geraet / a.geraetEk - 1) * 100 : 0;
  const zSonst = a.fremdEk > 0 ? (a.fremd / a.fremdEk - 1) * 100 : 0;

  // ── Formblatt 221 ─────────────────────────────────────────────────
  function sheet221() {
    let y = head("221", "Preisermittlung bei Zuschlagskalkulation");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Angaben zur Kalkulation mit vorbestimmten Zuschlägen", mL, y);
    y += 6;

    const cfg: EfbZuschlaege = opts.efb || { bgk: [5, 5, 0, 0], agk: [5, 5, 0, 0], anteilGewinn: 50, anteilWagnisBetrieb: 25, anteilWagnisLeistung: 25, lohnzusatz: 15.19, lohnneben: 16 };
    // Tabelle 1: 1.2/1.3 als konfigurierte Sätze auf ML, 1.5 = Rest (VL bleibt exakt).
    const e12 = ml * cfg.lohnzusatz / 100;
    const e13 = ml * cfg.lohnneben / 100;
    const kl = ml + e12 + e13;
    const z15 = kl > 0 ? (vl / kl - 1) * 100 : 0;

    // Tabelle 1: Verrechnungslohn — Spalten: Nr | Text | Zuschlag % | €/h
    const xNr = mL, xTxt = mL + 13, xPz = 150, xEh = 171;
    type R1 = { nr: string; t1: string; t2?: string; z?: string; e?: string; bold?: boolean };
    const rows1: R1[] = [
      { nr: "1.", t1: "Angaben über den Verrechnungslohn", z: "Zuschlag\n%", e: "€/h", bold: true },
      { nr: "1.1", t1: "Mittellohn ML", t2: "einschl. Lohnzulagen u. Lohnerhöhungen, wenn keine Lohngleitklausel vereinbart wird.", e: fmt(ml), bold: true },
      { nr: "1.2", t1: "Lohnzusatzkosten", t2: "Sozialkosten, Soziallöhne und lohnbezogene Kosten, als Zuschlag auf ML", z: pct(cfg.lohnzusatz), e: fmt(e12) },
      { nr: "1.3", t1: "Lohnnebenkosten", t2: "Auslösung, Fahrgelder, als Zuschlag auf ML", z: pct(cfg.lohnneben), e: fmt(e13) },
      { nr: "1.4", t1: "Kalkulationslohn KL", t2: "(Summe 1.1 bis 1.3)", e: fmt(kl), bold: true },
      { nr: "1.5", t1: "Zuschläge auf Kalkulationslohn", t2: "(aus Zeile 2.4, Spalte 1)", z: pct(z15), e: fmt(vl - kl) },
      { nr: "1.6", t1: "Verrechnungslohn VL", t2: "(Summe aus 1.4 und 1.5)", e: fmt(vl), bold: true },
    ];
    const t1Top = y;
    for (let i = 0; i < rows1.length; i++) {
      const r = rows1[i];
      const h = i === 0 ? 10 : r.t2 ? 9.5 : 7;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(r.nr, xNr + 2, y + 4.6);
      doc.setFont("helvetica", r.bold || i === 0 ? "bold" : "bold"); // Zeilentitel immer fett (wie Vorlage)
      doc.text(r.t1, xTxt + 1, y + 4.6);
      if (r.t2) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.6); doc.text(doc.splitTextToSize(r.t2, xPz - xTxt - 3)[0], xTxt + 1, y + 8.2); }
      doc.setFontSize(9);
      if (i === 0) {
        doc.setFont("helvetica", "normal");
        doc.text("Zuschlag", (xPz + xEh) / 2, y + 4, { align: "center" });
        doc.text("%", (xPz + xEh) / 2, y + 8, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.text("€/h", (xEh + mR) / 2, y + 5.5, { align: "center" });
      } else {
        doc.setFont("helvetica", "normal");
        if (r.z !== undefined) doc.text(r.z, xEh - 2, y + 4.6, { align: "right" });
        doc.setFont("helvetica", r.bold ? "bold" : "normal");
        if (r.e !== undefined) doc.text(r.e, mR - 2, y + 4.6, { align: "right" });
      }
      y += h;
      line(mL, y, mR, y);
    }
    rect(mL, t1Top, mR, y, 0.3);
    line(xTxt, t1Top, xTxt, y); line(xPz, t1Top, xPz, y); line(xEh, t1Top, xEh, y);
    y += 8;

    // Tabelle 2: Zuschläge auf Einzelkosten — 5 Kostenarten-Spalten
    const c0 = mL, c1 = mL + 13, cCols = [84, 106, 127, 149, 170, mR]; // 5 Spalten zwischen 84..190
    const heads2 = ["Lohn", "Stoffkosten", "Geräte-\nkosten", "Sonstige\nKosten", "Nachunter-\nnehmer-\nleistungen"];
    const t2Top = y;
    // Kopfzeile
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("2.", c0 + 2, y + 4.6);
    doc.text("Zuschläge auf Einzelkosten der Teilleistungen = unmittelbare Herstellungskosten", c1 + 1, y + 4.6);
    y += 7; line(mL, y, mR, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("Zuschläge in % auf", (cCols[0] + mR) / 2, y + 3.6, { align: "center" });
    y += 5; line(cCols[0], y, mR, y);
    const headTop = y;
    doc.setFontSize(7.6);
    for (let k = 0; k < 5; k++) {
      const lines = heads2[k].split("\n");
      let hy = y + 3.4;
      for (const l of lines) { doc.text(l, (cCols[k] + cCols[k + 1]) / 2, hy, { align: "center" }); hy += 3.1; }
    }
    y += 12;
    line(mL, y, mR, y);
    // Datenzeilen — BGK/AGK je Kostenart fest (aus den ⚙️-Einstellungen, wie Taifun),
    // Wagnis und Gewinn = Rest (Gesamtzuschlag − BGK − AGK), aufgeteilt nach den Anteilen.
    // So entspricht Zeile 2.4 immer exakt der echten Kalkulation. Spalten ohne Zuschlag bleiben 0.
    const totals5 = [zLohn, zMat, zGer, zSonst, 0];
    const anteileSum = (cfg.anteilGewinn + cfg.anteilWagnisBetrieb + cfg.anteilWagnisLeistung) || 100;
    const sG = cfg.anteilGewinn / anteileSum, sWb = cfg.anteilWagnisBetrieb / anteileSum, sWl = cfg.anteilWagnisLeistung / anteileSum;
    const vBgk: number[] = [], vAgk: number[] = [], vGew: number[] = [], vWb: number[] = [], vWl: number[] = [];
    for (let k = 0; k < 5; k++) {
      const t = totals5[k];
      if (Math.abs(t) < 0.005) { vBgk.push(0); vAgk.push(0); vGew.push(0); vWb.push(0); vWl.push(0); continue; }
      const bgk = k < 4 ? num(cfg.bgk[k]) : 0;
      const agk = k < 4 ? num(cfg.agk[k]) : 0;
      const wg = t - bgk - agk; // Rest für Wagnis und Gewinn (kann negativ sein)
      vBgk.push(bgk); vAgk.push(agk);
      vGew.push(wg * sG); vWb.push(wg * sWb); vWl.push(wg * sWl);
    }
    type R2 = { nr: string; t: string; v?: number[]; cross?: boolean; bold?: boolean };
    const rows2: R2[] = [
      { nr: "2.1", t: "Baustellengemeinkosten", v: vBgk },
      { nr: "2.2", t: "Allgemeine Geschäftskosten", v: vAgk },
      { nr: "2.3", t: "Wagnis und Gewinn", cross: true },
      { nr: "2.3.1", t: "Gewinn", v: vGew },
      { nr: "2.3.2", t: "betriebsbezogenes Wagnis", v: vWb },
      { nr: "2.3.3", t: "leistungsbezogenes Wagnis", v: vWl },
      { nr: "2.4", t: "Gesamtzuschläge", v: totals5, bold: true },
    ];
    for (const r of rows2) {
      const h = 6.5;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.6);
      doc.text(r.nr, c0 + 2, y + 4.4);
      doc.text(r.t, c1 + 1, y + 4.4);
      if (r.cross) {
        line(cCols[0], y, mR, y + h, 0.2); line(cCols[0], y + h, mR, y, 0.2);
      } else if (r.v) {
        doc.setFont("helvetica", r.bold ? "bold" : "normal");
        for (let k = 0; k < 5; k++) doc.text(pct(r.v[k]), cCols[k + 1] - 2, y + 4.4, { align: "right" });
      }
      y += h; line(mL, y, mR, y);
    }
    rect(mL, t2Top, mR, y, 0.3);
    line(c1, t2Top, c1, y);
    for (let k = 0; k <= 5; k++) line(cCols[k], t2Top + 7, cCols[k], y);
    // vertikale Trenner im Spaltenkopf-Bereich nur unterhalb "Zuschläge in % auf"
    line(cCols[0], t2Top + 7, cCols[0], t2Top + 12);

    // ── Seite 2: Tabelle 3 Ermittlung der Angebotssumme ─────────────
    y = head("221", "Preisermittlung bei Zuschlagskalkulation");
    const d0 = mL, d1 = mL + 13, dEk = 108, dPz = 140, dSum = 162;
    const t3Top = y;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("3.", d0 + 2, y + 4.6);
    doc.text("Ermittlung der Angebotssumme", d1 + 1, y + 4.6);
    y += 7; line(mL, y, mR, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.4);
    const h3a = ["Einzelkosten d.", "Teilleistungen =", "unmittelbare", "Herstellungs-", "kosten", "", "€"];
    const h3b = ["Gesamt-", "zuschläge", "gem. 2.4", "", "", "", "%"];
    const h3c = ["Angebotssumme", "", "", "", "", "", "€"];
    let hy = y + 3.2;
    for (let i = 0; i < 7; i++) {
      if (h3a[i]) doc.text(h3a[i], (dEk + dPz) / 2, hy, { align: "center" });
      if (h3b[i]) doc.text(h3b[i], (dPz + dSum) / 2, hy, { align: "center" });
      if (h3c[i]) doc.text(h3c[i], (dSum + mR) / 2, hy, { align: "center" });
      hy += 3.0;
    }
    y += 23; line(mL, y, mR, y);
    type R3 = { nr: string; t1: string; t2?: string; t3?: string; ek?: number; z?: number; s?: number };
    const rows3: R3[] = [
      { nr: "3.1", t1: "Eigene Lohnkosten", t2: "Verrechnungslohn (1.6) x Gesamtstunden", t3: `${fmt(vl)} €/h x ${fmt(a.hours)} h`, s: a.lohnVk },
      { nr: "3.2", t1: "Stoffkosten", t2: "(einschl. Kosten für Hilfslohn)", ek: a.matEk, z: zMat, s: a.matVk },
      { nr: "3.3", t1: "Gerätekosten", t2: "(einschl. Kosten für Energie und Betriebsstoffe)", ek: a.geraetEk, z: zGer, s: a.geraet },
      { nr: "3.4", t1: "Sonstige Kosten", t2: "(vom Bieter zu erläutern)", ek: a.fremdEk, z: zSonst, s: a.fremd },
      { nr: "3.5", t1: "Nachunternehmerleistungen *", ek: 0, z: 0, s: 0 },
    ];
    for (const r of rows3) {
      const h = r.t3 ? 13 : 10;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.8);
      doc.text(r.nr, d0 + 2, y + 4.4);
      doc.text(r.t1, d1 + 1, y + 4.4);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.6);
      if (r.t2) doc.text(r.t2, d1 + 1, y + 7.8);
      if (r.t3) doc.text(r.t3, d1 + 1, y + 11.0);
      doc.setFontSize(8.8);
      if (r.ek !== undefined) doc.text(fmt(r.ek), dPz - 2, y + 4.4, { align: "right" });
      if (r.z !== undefined) doc.text(pct(r.z), dSum - 2, y + 4.4, { align: "right" });
      if (r.s !== undefined) doc.text(fmt(r.s), mR - 2, y + h - 2.4, { align: "right" });
      y += h; line(mL, y, mR, y);
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.2);
    doc.text("Angebotssumme ohne Umsatzsteuer", d0 + 2, y + 5);
    doc.text(fmt(a.net), mR - 2, y + 5, { align: "right" });
    y += 7.5;
    rect(mL, t3Top, mR, y, 0.3);
    line(d1, t3Top, d1, y - 7.5);
    line(dEk, t3Top + 7, dEk, y - 7.5); line(dPz, t3Top + 7, dPz, y - 7.5); line(dSum, t3Top + 7, dSum, y - 7.5);
    y += 8;

    // Erläuterungen (wie amtliche Vorlage + eigene Hinweise)
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.6);
    doc.text("Eventuelle Erläuterungen des Bieters:", mL, y); y += 6;
    const notes = [
      "1) Die Abweichung der Angebotssumme aus dem EFB zur Angebotssumme aus dem LV entsteht durch Run-\ndungsdifferenzen aufgrund unterschiedlicher Zusammenzählung der Einzelkosten.",
      "2) Evtl. Angaben zur Aufteilung des Zuschlagssatzes zu BGK in Zeile 2.1 nach bauzeitabhängigen und bauzeit-\nunabhängigen Anteilen.",
      "3) Evtl. Aufgliederung des Zuschlagssatzes in Zeile 2.3 zu W&G nach einem Anteil für Wagnis und einem Anteil\nfür Gewinn.",
      "4) BGK und AGK gemäß betrieblichen Sätzen je Kostenart; Wagnis und Gewinn (Zeile 2.3) als verbleibender\nAnteil, damit die Gesamtzuschläge (Zeile 2.4) der tatsächlichen Kalkulation entsprechen.",
    ];
    if (nachlass > 0) notes.push(`5) In der Angebotssumme lt. Angebot ist zusätzlich ein Nachlass/Rabatt von ${fmt(nachlass)} € berücksichtigt (Angebotssumme danach: ${fmt(angebotssumme)} €).`);
    doc.setFontSize(8.2);
    for (const n of notes) {
      for (const l of n.split("\n")) { doc.text(l, mL, y); y += 3.8; }
      y += 1.6;
    }
    y += 2;
    for (let i = 0; i < 3; i++) { doc.setLineDashPattern([0.6, 0.8], 0); line(mL, y, mR, y, 0.15); doc.setLineDashPattern([], 0); y += 6; }
    doc.setFontSize(7.4);
    doc.text("*  Auf Verlangen sind für diese Leistungen die Angaben zur Kalkulation der(s) Nachunternehmer(s) dem Auftraggeber vorzulegen.", mL, y + 2);
  }

  // ── Formblatt 222 (vereinfachte Darstellung, unverändert) ─────────
  function sheet222() {
    let y = head("222", "Preisermittlung bei Kalkulation über die Endsumme");
    const summeEk = a.lohnEk + a.matEk + a.geraetEk + a.fremdEk;
    const umlage = a.net - summeEk;
    const vx = 160;
    function row(label: string, value: string, bold = false, unit = "€") {
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9.5); black();
      doc.text(label, mL + 2, y);
      doc.text(value, vx, y, { align: "right" });
      doc.text(unit, vx + 3, y);
      y += 6;
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("1. Angaben zum Kalkulationslohn", mL, y); y += 6.5;
    row("Kalkulationslohn (Mittellohn, Einzelkosten)", fmt(ml), false, "€/h");
    row("Gesamte Lohnstunden", fmt(a.hours), false, "h");
    y += 3;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("2. Einzelkosten der Teilleistungen (ohne Umlagen)", mL, y); y += 6.5;
    row("Lohnkosten (Einzelkosten)", fmt(a.lohnEk));
    row("Stoffkosten (Einzelkosten)", fmt(a.matEk));
    row("Gerätekosten (Einzelkosten)", fmt(a.geraetEk));
    row("Sonstige Kosten (Einzelkosten)", fmt(a.fremdEk));
    line(mL + 2, y - 4.2, vx + 8, y - 4.2);
    row("Summe Einzelkosten der Teilleistungen", fmt(summeEk), true);
    y += 3;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("3. Umlage und Angebotssumme", mL, y); y += 6.5;
    row("Umlage (BGK + AGK + Wagnis und Gewinn)", fmt(umlage));
    line(mL + 2, y - 4.2, vx + 8, y - 4.2, 0.4);
    row("Angebotssumme ohne Umsatzsteuer", fmt(a.net), true);
  }

  // ── Formblatt 223 ─────────────────────────────────────────────────
  function sheet223() {
    const items: any[] = Array.isArray(o.items) ? o.items : [];
    // 10 Spalten wie amtliche Vorlage
    const X = [mL, 33, 66, 83, 94, 110, 126, 143, 158, 173, mR];
    const contentBottom = 250;

    function tableHead(): number {
      let y = head("223", "Aufgliederung der Einheitspreise");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("Aufgliederung der Einheitspreise", mL, y);
      y += 4;
      const top = y;
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
      const c = (k: number) => (X[k] + X[k + 1]) / 2;
      const put = (k: number, lines: string[], startY: number) => { let yy = startY; for (const l of lines) { doc.text(l, c(k), yy, { align: "center" }); yy += 2.9; } };
      put(0, ["OZ des", "LV 1)"], top + 3.4);
      put(1, ["Kurzbezeichnung", "d. Teilleistung 1)"], top + 3.4);
      put(2, ["Menge 1)"], top + 3.4);
      put(3, ["Men-", "gen-", "einheit", "1)"], top + 3.4);
      put(4, ["Zeitan-", "satz 2)"], top + 3.4);
      doc.text("Teilkosten einschl. Zuschläge in €", (X[5] + X[10]) / 2, top + 3.4, { align: "center" });
      doc.text("(ohne Umsatzsteuer) je Mengeneinheit 2)", (X[5] + X[10]) / 2, top + 6.3, { align: "center" });
      line(X[5], top + 8, X[10], top + 8);
      put(5, ["Löhne", "2) 3)"], top + 11);
      put(6, ["Stoffe 2)"], top + 11);
      put(7, ["Geräte", "2) 4)"], top + 11);
      put(8, ["Sonstiges", "2)"], top + 11);
      put(9, ["Angebotener", "Einheitspreis", "(Sp. 6+7+8+9)"], top + 11);
      const numY = top + 20;
      line(mL, numY, mR, numY);
      for (let k = 0; k < 10; k++) doc.text(String(k + 1), c(k), numY + 3.2, { align: "center" });
      const bodyY = numY + 4.6;
      line(mL, bodyY, mR, bodyY);
      rect(mL, top, mR, bodyY, 0.3);
      for (let k = 1; k < 10; k++) line(X[k], k >= 6 ? top + 8 : top, X[k], bodyY);
      line(X[5], top, X[5], bodyY);
      return bodyY;
    }

    let y = tableHead();
    let bodyTop = y;

    function closeBody(atY: number) {
      rect(mL, bodyTop, mR, atY, 0.3);
      for (let k = 1; k < 10; k++) line(X[k], bodyTop, X[k], atY);
    }
    function ensure(h: number) {
      if (y + h > contentBottom) {
        closeBody(y);
        y = tableHead();
        bodyTop = y;
      }
    }

    let anyPos = false;
    for (const it of items) {
      if (it.kind !== "position") continue; // amtliches Blatt kennt keine Titelzeilen
      anyPos = true;
      const p = calcParts(it, num(o.del_preis));
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
      const bez = doc.splitTextToSize(String(it.short_text || it.long_text || "").replace(/\n/g, " "), X[2] - X[1] - 3).slice(0, 4);
      const h = Math.max(9, bez.length * 2.9 + 4);
      ensure(h);
      doc.text(String(it.oz || ""), X[0] + 1.5, y + 3.4);
      let by = y + 3.4;
      for (const l of bez) { doc.text(l, X[1] + 1.5, by); by += 2.9; }
      doc.setFontSize(7.6);
      doc.text(fmt(num(it.qty)), X[3] - 1.5, y + 3.6, { align: "right" });
      doc.text(String(it.unit || ""), X[3] + 1.5, y + 3.6);
      doc.text(fmt(p.minutes), X[5] - 1.5, y + 3.6, { align: "right" });
      doc.text(fmt(p.lohnVk), X[6] - 1.5, y + 3.6, { align: "right" });
      doc.text(fmt(p.matVk), X[7] - 1.5, y + 3.6, { align: "right" });
      doc.text(fmt(p.geraet), X[8] - 1.5, y + 3.6, { align: "right" });
      doc.text(fmt(p.fremd), X[9] - 1.5, y + 3.6, { align: "right" });
      doc.text(fmt(p.ep), X[10] - 1.5, y + 3.6, { align: "right" });
      y += h;
      line(mL, y, mR, y, 0.15);
    }
    if (!anyPos) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); black();
      doc.text("Keine Positionen im Angebot vorhanden.", mL + 2, y + 5);
      y += 9;
    }
    closeBody(y);

    // Fußnoten (letzte Seite)
    let fy = y + 5;
    if (fy > 262) { doc.addPage(); fy = 20; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.8);
    const fn = [
      "1)  Wird vom Auftraggeber vorgegeben.",
      "2)  Ist bei allen Teilleistungen anzugeben, unabhängig davon, ob sie der Auftragnehmer oder ein Nachunternehmer",
      "     erbringen wird.",
      "3)  Sofern der zugrunde gelegte Verrechnungslohn nicht mit den Angaben in den Formblättern 221 oder 222 übereinstimmt,",
      "     hat der Bieter dies offen zu legen.",
      "4)  Für Gerätekosten einschl. der Betriebsstoffkosten, soweit diese den Einzelkosten der angegebenen Ordnungszahlen",
      "     zugerechnet worden sind.",
    ];
    for (const l of fn) { doc.text(l, mL, fy); fy += 3.6; }
  }

  // ── Ablauf ────────────────────────────────────────────────────────
  for (const s of sheets) {
    if (s === "221") sheet221();
    else if (s === "222") sheet222();
    else if (s === "223") sheet223();
  }

  doc.save(`EFB_221-223_${(o.number || "Entwurf").toString().replace(/[^\w.-]+/g, "_")}.pdf`);
}
