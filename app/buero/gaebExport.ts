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
  const ep = matVk + lohnVk + kupferVk + num(it.fremd_vk) + num(it.geraet_vk);
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
