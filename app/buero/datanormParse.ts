// DATANORM-Parser für den Lieferanten-Katalog (Büro/Artikel).
// Unterstützt DATANORM 4 (Satzarten A/B/P) und DATANORM 5 (Satzart A, Preise im A-Satz).
// Zeichensatz der Dateien ist CP850 (DOS). Der Browser-TextDecoder kann kein CP850,
// daher dekodieren wir die oberen 128 Bytes über eine feste Tabelle.

// CP850 0x80–0xFF → Unicode
const CP850_HIGH =
  "ÇüéâäàåçêëèïîìÄÅ" +
  "ÉæÆôöòûùÿÖÜø£Ø×ƒ" +
  "áíóúñÑªº¿®¬½¼¡«»" +
  "░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐" +
  "└┴┬├─┼ãÃ╚╔╩╦╠═╬¤" +
  "ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀" +
  "ÓßÔÒõÕµþÞÚÛÙýÝ¯´" +
  "­±‗¾¶§÷¸°¨·¹³²■ ";

export function decodeCp850(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += b < 0x80 ? String.fromCharCode(b) : CP850_HIGH[b - 0x80];
  }
  return out;
}

export type DnArticle = {
  article_no: string;
  short_text: string;
  long_text: string;
  unit: string;
  ean: string;
  discount_group: string;
  list_ek: number | null; // Listen-EK pro Einheit in €
  net_ek: number | null;  // Netto-EK pro Einheit in € (Preisdatei / Nettopreise)
  ek: number | null;      // effektiver EK = net_ek ?? list_ek
};

export type DnDiscount = { discount_group: string; discount_pct: number; description: string };

export type DnResult = {
  version: string;   // "4" | "5" | "?"
  currency: string;
  supplierHint: string;
  catalogDate: string;
  articles: DnArticle[];
  discounts: DnDiscount[];
  stats: { articleFiles: number; priceFiles: number; discountFiles: number; withText: number; withNet: number; withEan: number };
  warnings: string[];
};

type InFile = { name: string; data: Uint8Array };

const toInt = (s: string) => {
  const n = parseInt(String(s ?? "").trim(), 10);
  return isNaN(n) ? null : n;
};

// Preis (Ganzzahl, 2 Nachkommastellen) auf einen Einzelpreis in € umrechnen.
// v4: Preiseinheit ist ein Code (0=/1, 1=/10, 2=/100, 3=/1000).
// v5: Preiseinheit ist die Stückzahl direkt (z. B. 100 = Preis pro 100).
function priceToEur(priceRaw: string, priceUnit: string, version: string): number | null {
  const p = toInt(priceRaw);
  if (p === null) return null;
  let factor = 1;
  if (version === "4") {
    const code = toInt(priceUnit);
    factor = code === 1 ? 10 : code === 2 ? 100 : code === 3 ? 1000 : 1;
  } else {
    const lit = toInt(priceUnit);
    factor = lit && lit > 0 ? lit : 1;
  }
  return p / 100 / factor;
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

// Datei-Typ anhand Vorlauf + Satzarten erkennen
function classify(lines: string[]): { version: string; kind: "article" | "price" | "discount" | "unknown"; currency: string; hint: string; date: string } {
  const v = lines.find((l) => l.startsWith("V")) || "";
  let version = "?";
  let currency = "EUR";
  let hint = "";
  let date = "";
  if (v.startsWith("V;")) {
    // DATANORM 5: V;050;A;YYYYMMDD;EUR;Beschreibung;Lieferant;...
    const f = v.split(";");
    version = "5";
    date = (f[3] || "").trim();
    currency = (f[4] || "EUR").trim();
    hint = (f[6] || f[5] || "").trim();
  } else if (/^V\s/.test(v)) {
    // DATANORM 4: "V " + Datum(6) + Name(40) ... + "04" + "EUR" am Ende
    version = "4";
    const m = v.match(/(\d{2})(EUR|DEM|USD)\s*$/);
    if (m) currency = m[2];
    hint = v.slice(8, 48).trim();
  }
  // Satzarten zählen (erste ~400 Zeilen reichen zur Erkennung)
  let a = 0, p = 0, r = 0;
  for (let i = 0; i < lines.length && i < 400; i++) {
    const c = lines[i][0];
    if (c === "A") a++;
    else if (c === "P") p++;
    else if (c === "R") r++;
  }
  const kind = r > 0 && a === 0 && p === 0 ? "discount" : p > 0 && a === 0 ? "price" : a > 0 ? "article" : "unknown";
  return { version, kind, currency, hint, date };
}

export function parseDatanormFiles(files: InFile[]): DnResult {
  const warnings: string[] = [];
  const byNo = new Map<string, DnArticle>();
  const peCode = new Map<string, string>(); // Preiseinheit je Artikel (für Preisdatei-Umrechnung)
  const discounts: DnDiscount[] = [];
  const seenDisc = new Set<string>();
  let version = "?";
  let currency = "EUR";
  let supplierHint = "";
  let catalogDate = "";
  const stats = { articleFiles: 0, priceFiles: 0, discountFiles: 0, withText: 0, withNet: 0, withEan: 0 };

  const ensure = (no: string): DnArticle => {
    let a = byNo.get(no);
    if (!a) {
      a = { article_no: no, short_text: "", long_text: "", unit: "", ean: "", discount_group: "", list_ek: null, net_ek: null, ek: null };
      byNo.set(no, a);
    }
    return a;
  };

  // Reihenfolge: erst Artikeldateien (Texte/Listenpreis/Preiseinheit), dann Preisdateien, dann Rabatte.
  const decoded = files.map((f) => ({ name: f.name, lines: splitLines(decodeCp850(f.data)) }));
  const order = { article: 0, price: 1, discount: 2, unknown: 3 };
  const classified = decoded.map((d) => ({ ...d, meta: classify(d.lines) }));
  classified.sort((x, y) => order[x.meta.kind] - order[y.meta.kind]);

  for (const file of classified) {
    const { version: fv, kind, currency: cur, hint, date } = file.meta;
    if (fv !== "?") version = fv;
    if (cur) currency = cur;
    if (hint && !supplierHint) supplierHint = hint;
    if (date && !catalogDate) catalogDate = date;

    if (kind === "article") stats.articleFiles++;
    else if (kind === "price") stats.priceFiles++;
    else if (kind === "discount") stats.discountFiles++;
    else { warnings.push(`Datei „${file.name}“: Satzart nicht erkannt – übersprungen.`); continue; }

    for (const ln of file.lines) {
      if (!ln) continue;
      const f = ln.split(";");
      const rec = f[0];

      if (rec === "A" && fv === "4") {
        // A;verarb;artno;textkz;kt1;kt2;preiskz;preiseinheit;me;preis;warengrp;...
        const no = (f[2] || "").trim();
        if (!no) continue;
        const a = ensure(no);
        a.short_text = ((f[4] || "") + (f[5] || "")).trim();
        a.unit = (f[8] || "").trim();
        a.discount_group = (f[10] || "").trim();
        a.list_ek = priceToEur(f[9] || "", f[7] || "", "4");
        peCode.set(no, f[7] || "");
      } else if (rec === "B" && fv === "4") {
        // B;verarb;artno;...;ean(9);...
        const no = (f[2] || "").trim();
        if (!no) continue;
        const a = ensure(no);
        const ean = (f[9] || "").trim();
        if (ean && /^\d{6,14}$/.test(ean)) a.ean = ean;
      } else if (rec === "A" && fv === "5") {
        // A;preiskz;artno;kt1;kt2;me;preiskennz;preiseinheit;preis;rabgrp;...;ean(18);...
        const no = (f[2] || "").trim();
        if (!no) continue;
        const a = ensure(no);
        a.short_text = ((f[3] || "") + (f[4] || "")).trim();
        a.unit = (f[5] || "").trim();
        a.discount_group = (f[9] || "").trim();
        const price = priceToEur(f[8] || "", f[7] || "", "5");
        a.list_ek = price;
        a.net_ek = price; // v5 liefert i. d. R. direkt den gültigen Preis
        const ean = (f[18] || "").trim();
        if (ean && /^\d{6,14}$/.test(ean)) a.ean = ean;
      } else if (rec === "P") {
        // Preisdatei: P;preiskennung; dann Gruppen zu je 9 Feldern: artno;preiskz;preis + 6 leer
        const body = f.slice(2);
        for (let i = 0; i + 2 < body.length; i += 9) {
          const no = (body[i] || "").trim();
          if (!no) continue;
          const a = ensure(no);
          a.net_ek = priceToEur(body[i + 2] || "", peCode.get(no) || "", version === "5" ? "5" : "4");
        }
      } else if (rec === "R") {
        // Rabatt-/Preisgruppe: R;;grp;kz;rabatt;bezeichnung
        const grp = (f[2] || "").trim();
        if (!grp || seenDisc.has(grp)) continue;
        seenDisc.add(grp);
        const pct = toInt(f[4] || "");
        discounts.push({ discount_group: grp, discount_pct: pct === null ? 0 : pct / 100, description: (f[5] || "").trim() });
      }
    }
  }

  // Lag eine Artikeldatei bei, sind reine Preis-Einträge ohne Text „Phantome" → verwerfen.
  let articles = Array.from(byNo.values());
  if (stats.articleFiles > 0) articles = articles.filter((a) => a.short_text);
  for (const a of articles) {
    a.ek = a.net_ek != null ? a.net_ek : a.list_ek;
    if (a.short_text) stats.withText++;
    if (a.net_ek != null) stats.withNet++;
    if (a.ean) stats.withEan++;
  }

  if (!articles.length) warnings.push("Keine Artikel gefunden.");
  return { version, currency, supplierHint, catalogDate, articles, discounts, stats, warnings };
}
