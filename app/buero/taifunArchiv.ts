// Taifun-Preisarchiv (Stufe 9b):
//  - parseTaifunXlsx: liest die Taifun-Excel-Exporte (Format "Mappe2": Spalten GUID, Position,
//    Menge, [Einheit], Beschreibung, Mat.-Ek, Mat.-Multi, Mat.-Vk, Std.Lohn, min, Lohn-Vk,
//    Fremd-Vk, Gerät-Vk, E-Preis, G-Preis). Titel- und reine Textzeilen werden übersprungen.
//  - normTokens/bestMatch: Textnormalisierung + Jaccard-Ähnlichkeit für "💡 Preise vorschlagen".

export type ArchivRow = {
  pos: string; unit: string; text: string;
  mat_ek: number | null; mat_multi: number | null;
  lohn_ek: number | null; minutes: number | null;
  fremd_vk: number | null; geraet_vk: number | null; ep: number | null;
};

const numOrNull = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function cleanText(s: any): string {
  return String(s ?? "").replace(/_x000D_/g, "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

export async function parseTaifunXlsx(file: File): Promise<{ rows: ArchivRow[]; skipped: number; warn?: string }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = wb.SheetNames.find((n: string) => n !== "TAIFUN_INFO") || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];

  // Kopfzeile finden (enthält "Beschreibung" und "Menge")
  let headIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const cells = (aoa[i] || []).map((c) => String(c ?? "").trim());
    if (cells.includes("Beschreibung") && cells.includes("Menge")) { headIdx = i; break; }
  }
  if (headIdx < 0) return { rows: [], skipped: 0, warn: `${file.name}: keine Taifun-Kopfzeile (Beschreibung/Menge) gefunden.` };

  const head = (aoa[headIdx] || []).map((c) => String(c ?? "").trim());
  const col = (name: string) => head.indexOf(name);
  const cMenge = col("Menge"), cBesch = col("Beschreibung"), cPos = col("Position");
  const cMatEk = col("Mat.-Ek"), cMatMulti = col("Mat.-Multi"), cLohn = col("Std.Lohn"),
    cMin = col("min"), cFremd = col("Fremd-Vk"), cGeraet = col("Gerät-Vk"), cEp = col("E-Preis");
  // Einheiten-Spalte hat in Taifun eine leere Überschrift — direkt hinter Menge.
  const emptyIdx = head.findIndex((h, i) => h === "" && i > cMenge);
  const cUnit = emptyIdx >= 0 ? emptyIdx : cMenge + 1;

  const rows: ArchivRow[] = [];
  let skipped = 0;
  for (let i = headIdx + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const menge = r[cMenge];
    const text = cleanText(r[cBesch]);
    if (!text) { continue; }
    if (String(menge ?? "").trim().toLowerCase() === "titel") { skipped++; continue; }
    const mat_ek = numOrNull(r[cMatEk]);
    const minutes = numOrNull(r[cMin]);
    const ep = numOrNull(r[cEp]);
    // Reine Textzeilen (keine Menge, keine Kalkulation) überspringen.
    if (numOrNull(menge) === null && mat_ek === null && minutes === null && ep === null) { skipped++; continue; }
    rows.push({
      pos: String(r[cPos] ?? "").trim(),
      unit: String(r[cUnit] ?? "").trim(),
      text,
      mat_ek, mat_multi: numOrNull(r[cMatMulti]),
      lohn_ek: numOrNull(r[cLohn]), minutes,
      fremd_vk: numOrNull(r[cFremd]), geraet_vk: numOrNull(r[cGeraet]), ep,
    });
  }
  return { rows, skipped };
}

// ── Textähnlichkeit ─────────────────────────────────────────────────
const STOP = new Set(["und", "oder", "mit", "fuer", "für", "der", "die", "das", "den", "dem", "ein", "eine", "einschl", "inkl", "incl", "bis", "von", "im", "in", "auf", "an", "am", "aus", "je", "pro", "nach", "vorh", "vorhanden", "sowie"]);

export function normTokens(s: string): Set<string> {
  const t = String(s || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9,.]+/g, " ")
    .replace(/(\d),(\d)/g, "$1.$2")
    .split(/\s+/)
    .map((w) => w.replace(/^[.,]+|[.,]+$/g, ""))
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return new Set(t);
}

export function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter); // Jaccard
}

export function bestMatch(
  text: string,
  archive: { row: any; tokens: Set<string> }[],
): { row: any; score: number } | null {
  const t = normTokens(text);
  let best: any = null, bestScore = 0;
  for (const a of archive) {
    const s = similarity(t, a.tokens);
    if (s > bestScore) { bestScore = s; best = a.row; }
  }
  return best ? { row: best, score: bestScore } : null;
}
