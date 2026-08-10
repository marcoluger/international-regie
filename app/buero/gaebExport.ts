// GAEB DA XML Export (X84 / DA84). Gibt das kalkulierte Angebot als
// Angebotsabgabe mit Preisen aus: je Position UP (Einheitspreis) und IT
// (Gesamtbetrag), Titelsummen, Gesamt-/USt-/Bruttobetrag + Bieter-Adresse.

const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;

function calcItem(it: any, del: number = 0) {
  if (it.kind !== "position") return { ep: 0, gp: 0 };
  const pe = num(it.preiseinheit) || 1;
  const versch = num(it.verschnitt) || 1;
  const matVk = num(it.mat_ek) * (num(it.mat_multi) || 1) * versch / pe;
  const lohnEk = it.lohn_ek !== undefined && it.lohn_ek !== "" ? num(it.lohn_ek) : num(it.std_lohn);
  const lohnSatzVk = lohnEk * (num(it.lohn_multi) || 1);
  const lohnVk = lohnSatzVk * (num(it.minutes) / 60);
  const kupferVk = num(it.kupfer_kg) * del * (num(it.kupfer_multi) || 1) / pe;
  // Fremd/Gerät: EK×Multi wenn ein EK eingetragen ist, sonst direktes Vk-Feld — identisch zu Angebote.tsx.
  const fremdVk = it.fremd_ek !== undefined && it.fremd_ek !== null && String(it.fremd_ek) !== "" ? num(it.fremd_ek) * (num(it.fremd_multi) || 1) : num(it.fremd_vk);
  const geraetVk = it.geraet_ek !== undefined && it.geraet_ek !== null && String(it.geraet_ek) !== "" ? num(it.geraet_ek) * (num(it.geraet_multi) || 1) : num(it.geraet_vk);
  const epCalc = matVk + lohnVk + kupferVk + fremdVk + geraetVk;
  // Fester E-Preis (ep_fix) überschreibt die Kalkulation — identisch zu Angebote.tsx.
  const ep = it.ep_fix !== undefined && it.ep_fix !== null && String(it.ep_fix).trim() !== "" ? num(it.ep_fix) : epCalc;
  const gp = ep * num(it.qty) * (1 - num(it.discount_pct) / 100);
  return { ep, gp };
}

function esc(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function n2(v: number) { return (Math.round(v * 100) / 100).toFixed(2); }
function n3(v: number) { return (Math.round(v * 1000) / 1000).toFixed(3); }
function pad2(v: any) { const s = String(v || "").replace(/\D/g, ""); return s || ""; }
function digits(v: any) { return String(v || "").replace(/\D/g, ""); }
function lastSeg(oz: string) { const p = String(oz || "").split("."); return digits(p[p.length - 1]); }

type Grp = { titel: any | null; rno: string; positions: any[] };

function groupItems(items: any[]): Grp[] {
  const groups: Grp[] = [];
  let cur: Grp | null = null;
  let titelCount = 0;
  for (const it of items) {
    if (it.kind === "titel") {
      titelCount++;
      cur = { titel: it, rno: digits(it.rno) || digits(it.oz) || String(titelCount), positions: [] };
      groups.push(cur);
    } else if (it.kind === "position") {
      if (!cur) { cur = { titel: null, rno: "", positions: [] }; groups.push(cur); }
      cur.positions.push(it);
    }
    // Textpositionen ohne Preis werden im X84 nicht ausgegeben
  }
  return groups;
}

export function buildGaebX84Xml(o: any, now: Date = new Date()): string {
  const items: any[] = Array.isArray(o.items) ? o.items : [];
  const groups = groupItems(items);
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);
  const vatRate = num(o.vat_rate);

  let net = 0;
  const body: string[] = [];
  let ci = 0, ii = 0;
  for (const g of groups) {
    const itemsXml: string[] = [];
    let grpTotal = 0;
    for (const p of g.positions) {
      const c = calcItem(p, num(o.del_preis));
      const qty = num(p.qty);
      const up = qty > 0 ? c.gp / qty : c.ep;
      const it = Math.round(up * 1000) / 1000 * qty;
      const itR = Math.round(it * 100) / 100;
      grpTotal += itR;
      const rno = digits(p.rno) || lastSeg(p.oz) || String((ii + 1) * 10);
      itemsXml.push(`            <Item ID="I${ii}" RNoPart="${esc(rno)}"><UP>${n3(up)}</UP><IT>${n2(itR)}</IT></Item>`);
      ii++;
    }
    grpTotal = Math.round(grpTotal * 100) / 100;
    net += grpTotal;
    if (g.titel) {
      body.push(
        `        <BoQCtgy ID="C${ci}" RNoPart="${esc(g.rno)}">\n` +
        `          <BoQBody>\n            <Itemlist>\n${itemsXml.join("\n")}\n            </Itemlist>\n          </BoQBody>\n` +
        `          <Totals><Total>${n2(grpTotal)}</Total></Totals>\n` +
        `        </BoQCtgy>`
      );
      ci++;
    } else if (itemsXml.length) {
      body.push(`        <Itemlist>\n${itemsXml.join("\n")}\n        </Itemlist>`);
    }
  }
  net = Math.round(net * 100) / 100;
  const vat = Math.round(net * vatRate) / 100;
  const gross = Math.round((net + vat) * 100) / 100;

  const prjName = esc(o.number || "Angebot");
  const prjLabel = esc(o.subject || "");
  const boqId = "00000000000000000000000000000000";
  const boqName = esc(o.number || "");

  return `<?xml version="1.0" encoding="UTF-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA84/3.3">
  <GAEBInfo>
    <Version>3.3</Version>
    <VersDate>2021-05</VersDate>
    <Date>${date}</Date>
    <Time>${time}</Time>
    <ProgSystem>Regie International Buero</ProgSystem>
    <ProgName>Regie International</ProgName>
  </GAEBInfo>
  <PrjInfo>
    <NamePrj>${prjName}</NamePrj>
    <LblPrj>${prjLabel}</LblPrj>
  </PrjInfo>
  <Award>
    <DP>84</DP>
    <AwardInfo>
      <BoQID>${boqId}</BoQID>
      <Cur>EUR</Cur>
      <CurLbl>Euro</CurLbl>
    </AwardInfo>
    <CTR>
      <Address>
        <Name1>Marco Luger Elektrotechnik</Name1>
        <Street>Poststr. 22</Street>
        <PCode>83119</PCode>
        <City>Obing</City>
        <VATID>DE255670812</VATID>
      </Address>
      <DPNo>${esc(o.number || "")}</DPNo>
    </CTR>
    <BoQ ID="B1">
      <BoQInfo>
        <Name>${boqName}</Name>
        <BoQBkdn><Type>BoQLevel</Type><LblBoQBkdn>Titel</LblBoQBkdn><Length>2</Length><Num>Yes</Num></BoQBkdn>
        <BoQBkdn><Type>Item</Type><LblBoQBkdn>Position</LblBoQBkdn><Length>3</Length><Num>Yes</Num></BoQBkdn>
        <Totals><Total>${n2(net)}</Total><VAT>${n2(vatRate)}</VAT><TotalGross>${n2(gross)}</TotalGross></Totals>
      </BoQInfo>
      <BoQBody>
${body.join("\n")}
      </BoQBody>
    </BoQ>
  </Award>
</GAEB>
`;
}

// Vorschau: zeigt VOR dem Export, was in der X84 landet (gleiche Rundung/Nummerierung
// wie buildGaebX84Xml) — inkl. Warnungen zu Textpositionen, fehlenden Nummern, EP 0,00.
export type GaebPreviewRow = { kind: "titel" | "position"; oz: string; text: string; qty?: number; unit?: string; up?: number; it?: number; sum?: number };
export type GaebPreview = { rows: GaebPreviewRow[]; warnings: string[]; net: number; vat: number; gross: number; posCount: number };

export function buildGaebX84Preview(o: any): GaebPreview {
  const items: any[] = Array.isArray(o.items) ? o.items : [];
  const groups = groupItems(items);
  const warnings: string[] = [];
  const textCount = items.filter((x: any) => x.kind === "text").length;
  if (textCount) warnings.push(`${textCount} Textposition${textCount === 1 ? "" : "en"} werden im X84 NICHT ausgegeben (das Preisblatt enthält nur bepreiste Positionen).`);
  const rows: GaebPreviewRow[] = [];
  let net = 0, posCount = 0, ii = 0, zeroEp = 0, autoNo = 0, emptyTitel = 0;
  for (const g of groups) {
    let grpTotal = 0;
    const grpRows: GaebPreviewRow[] = [];
    for (const p of g.positions) {
      const c = calcItem(p, num(o.del_preis));
      const qty = num(p.qty);
      const up = qty > 0 ? c.gp / qty : c.ep;
      const itR = Math.round((Math.round(up * 1000) / 1000) * qty * 100) / 100;
      grpTotal += itR;
      const rno = digits(p.rno) || lastSeg(p.oz);
      if (!rno) autoNo++;
      if (Math.abs(up) < 0.005) zeroEp++;
      grpRows.push({ kind: "position", oz: p.oz || rno || `(auto ${(ii + 1) * 10})`, text: String(p.short_text || p.long_text || "").split("\n")[0], qty, unit: p.unit || "", up: Math.round(up * 1000) / 1000, it: itR });
      ii++; posCount++;
    }
    grpTotal = Math.round(grpTotal * 100) / 100;
    net += grpTotal;
    if (g.titel) {
      if (!g.positions.length) emptyTitel++;
      rows.push({ kind: "titel", oz: g.titel.oz || g.rno, text: g.titel.title || "(Titel)", sum: grpTotal });
    }
    rows.push(...grpRows);
  }
  if (autoNo) warnings.push(`${autoNo} Position${autoNo === 1 ? "" : "en"} ohne Positionsnummer — im Export wird automatisch nummeriert.`);
  if (zeroEp) warnings.push(`${zeroEp} Position${zeroEp === 1 ? "" : "en"} mit Einheitspreis 0,00 — bitte prüfen, ob das gewollt ist.`);
  if (emptyTitel) warnings.push(`${emptyTitel} Titel ohne Positionen.`);
  if (!posCount) warnings.push("Keine bepreisbaren Positionen — die Datei wäre leer.");
  net = Math.round(net * 100) / 100;
  const vat = Math.round(net * num(o.vat_rate)) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  return { rows, warnings, net, vat, gross, posCount };
}

export function downloadGaebX84(o: any) {
  const xml = buildGaebX84Xml(o);
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Angebot_${(o.number || "Entwurf").toString().replace(/[^\w.-]+/g, "_")}.X84`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
