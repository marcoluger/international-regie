// GAEB DA XML Import (X83 / DA83). Liest ein fremdes Leistungsverzeichnis:
// Titel (BoQCtgy) und Positionen (Item) mit OZ, Menge, Einheit, Kurz-/Langtext.
// Läuft im Browser (DOMParser). Preise werden NICHT importiert – die kalkuliert
// der Nutzer anschließend selbst.

export type GaebItem = {
  kind: "titel" | "position";
  oz: string;
  rno?: string; // roher RNoPart (für exakten X84-Roundtrip)
  title?: string;
  qty?: string;
  unit?: string;
  short_text?: string;
  long_text?: string;
};

export type GaebParseResult = {
  items: GaebItem[];
  meta: { projectLabel: string; boqLabel: string; titelCount: number; posCount: number };
};

// Text eines Elements (Spans) zusammenführen, ohne Zeilenumbrüche.
function plainText(el: Element | null): string {
  if (!el) return "";
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

// Einzeiliger Text: <br>/<p> werden zu Leerzeichen (für Kurztext/Titel).
function inlineText(el: Element | null): string {
  if (!el) return "";
  let s = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        s += c.nodeValue || "";
      } else if (c.nodeType === 1) {
        const tn = (c as Element).tagName.toLowerCase();
        if (tn === "br" || tn === "p") s += " ";
        walk(c);
      }
    });
  };
  walk(el);
  return s.replace(/\s+/g, " ").trim();
}

// Reichtext (DetailTxt): <br> → Zeilenumbruch, <p> → Absatz.
function richText(el: Element | null): string {
  if (!el) return "";
  let s = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        s += c.nodeValue || "";
      } else if (c.nodeType === 1) {
        const tn = (c as Element).tagName.toLowerCase();
        if (tn === "br") s += "\n";
        else if (tn === "p") { walk(c); s += "\n"; }
        else walk(c);
      }
    });
  };
  walk(el);
  // Zeilen säubern und mehrfache Leerzeilen reduzieren
  const lines = s.replace(/\r/g, "").split("\n").map((l) => l.replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, (m) => m));
  let out = lines.join("\n");
  out = out.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
  return out;
}

// direkte Kind-Elemente mit lokalem Namen (namespace-unabhängig)
function childrenByLocal(el: Element, name: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (c.tagName === name || c.localName === name) out.push(c);
  }
  return out;
}
function firstDesc(el: Element, name: string): Element | null {
  const list = el.getElementsByTagName(name);
  if (list && list.length) return list[0];
  // Fallback über localName
  const all = el.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) if (all[i].localName === name) return all[i];
  return null;
}

function parseItem(itemEl: Element, titelOz: string): GaebItem {
  const rno = itemEl.getAttribute("RNoPart") || "";
  const qtyEl = childrenByLocal(itemEl, "Qty")[0];
  const quEl = childrenByLocal(itemEl, "QU")[0];
  const qtyRaw = plainText(qtyEl || null).replace(",", ".");
  const qty = qtyRaw ? String(Number(qtyRaw) || qtyRaw) : "1";
  const unit = plainText(quEl || null) || "St";

  // Kurztext: Description > CompleteText > OutlineText > OutlTxt > TextOutlTxt
  const outl = firstDesc(itemEl, "TextOutlTxt");
  let shortText = inlineText(outl);

  // Langtext: Description > CompleteText > DetailTxt > Text
  const detail = firstDesc(itemEl, "DetailTxt");
  const textEl = detail ? childrenByLocal(detail, "Text")[0] || detail : null;
  let longRaw = richText(textEl);

  // Erste Langtextzeile ist oft identisch mit dem Kurztext → entfernen
  if (!shortText && longRaw) {
    const firstLine = longRaw.split("\n")[0].trim();
    shortText = firstLine;
  }
  if (longRaw) {
    const lines = longRaw.split("\n");
    if (lines[0] && lines[0].trim() === shortText.trim()) lines.shift();
    while (lines.length && lines[0].trim() === "") lines.shift();
    longRaw = lines.join("\n").trim();
  }

  return {
    kind: "position",
    oz: titelOz ? `${titelOz}.${rno}` : rno,
    rno,
    qty,
    unit,
    short_text: shortText,
    long_text: longRaw,
  };
}

export function parseGaebX83(xmlText: string): GaebParseResult {
  const clean = xmlText.replace(/^﻿/, "");
  const doc = new DOMParser().parseFromString(clean, "application/xml");
  const perr = doc.getElementsByTagName("parsererror");
  if (perr && perr.length) throw new Error("Die Datei konnte nicht als XML gelesen werden.");

  const boqList = doc.getElementsByTagName("BoQ");
  if (!boqList || !boqList.length) throw new Error("Keine GAEB-Struktur (BoQ) in der Datei gefunden.");
  const boq = boqList[0];

  const items: GaebItem[] = [];
  let titelCount = 0;
  let posCount = 0;

  const walkBody = (body: Element, prefix: string) => {
    for (let i = 0; i < body.children.length; i++) {
      const node = body.children[i];
      const local = node.tagName === "BoQCtgy" || node.localName === "BoQCtgy";
      if (local) {
        const rno = node.getAttribute("RNoPart") || "";
        const oz = prefix ? `${prefix}.${rno}` : rno;
        const lblEl = childrenByLocal(node, "LblTx")[0];
        const title = inlineText(lblEl || null);
        items.push({ kind: "titel", oz, rno, title });
        titelCount++;
        const innerBodies = childrenByLocal(node, "BoQBody");
        for (const ib of innerBodies) walkBody(ib, oz);
      } else if (node.tagName === "Itemlist" || node.localName === "Itemlist") {
        const its = childrenByLocal(node, "Item");
        for (const it of its) { items.push(parseItem(it, prefix)); posCount++; }
      } else if (node.tagName === "BoQBody" || node.localName === "BoQBody") {
        walkBody(node, prefix);
      }
    }
  };

  const topBodies = childrenByLocal(boq, "BoQBody");
  for (const b of topBodies) walkBody(b, "");

  if (items.length === 0) throw new Error("Keine Titel/Positionen in der GAEB-Datei gefunden.");

  const projectLabel = plainText(firstDesc(doc.documentElement, "LblPrj"));
  const boqLabel = plainText(firstDesc(boq, "LblBoQ"));

  return { items, meta: { projectLabel, boqLabel, titelCount, posCount } };
}
