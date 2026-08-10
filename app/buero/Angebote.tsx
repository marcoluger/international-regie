"use client";

import { Fragment, useEffect, useState } from "react";
import { generateAngebotPdf, generateAbPdf, generateRechnungPdf } from "./angebotPdf";
import { parseTaifunXlsx, normTokens, topMatches, similarity } from "./taifunArchiv";
import { generateEfbPdf } from "./efbPdf";
import { parseGaebX83 } from "./gaebImport";
import { downloadGaebX84 } from "./gaebExport";

// ── Hilfsfunktionen ────────────────────────────────────────────────
const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function addWeeks(dateStr: string, weeks: number) {
  if (!dateStr || !weeks) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  if (!iso) return "";
  const p = iso.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
}
const VORTEXT_DEFAULT = "Sehr geehrte Damen und Herren, vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:";
const NACHTEXT_DEFAULT = "Wir würden uns freuen, den Auftrag für Sie ausführen zu dürfen, und stehen für Rückfragen gerne zur Verfügung.";
const PV_DEFAULT = "Steuerfreie Leistung \u2013 Nullsteuersatz nach \u00a7 12 Abs. 3 UStG (Lieferung und Installation einer Photovoltaikanlage).";
const B13_DEFAULT = "Steuerschuldnerschaft des Leistungsempf\u00e4ngers nach \u00a7 13b UStG. Es wird keine Umsatzsteuer ausgewiesen; die Umsatzsteuer schuldet der Leistungsempf\u00e4nger.";
const UNITS = ["St", "Stk", "Psch", "m", "lfm", "m\u00b2", "m\u00b3", "h", "Std", "Tag", "Wo", "Mon", "kg", "t", "g", "l", "Ltr", "Satz", "Paar", "Rolle", "Pkg", "Bund", "Pkt", "kW", "kWp", "A", "V", "%"];

// Kupfergewicht (kg je 100 m) aus dem Querschnitt in der Bezeichnung schätzen: "5x16", "5X35", "3G2,5" …
// Formel: Σ(Adern × mm²) × 0,89 kg je 100 m (Kupferdichte 8,9 g/cm³).
function cuKgPer100m(text: string): number | null {
  const m = String(text || "").match(/(\d+)\s*[xXgG*]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const q = parseFloat(m[2].replace(",", "."));
  if (!n || !q) return null;
  return Math.round(n * q * 0.89 * 100) / 100;
}

// del = Tages-Kupferpreis (€/kg). Preiseinheit (PE) teilt Material- UND Kupferpreis auf die Einheit herunter.
function calcItem(it: any, del: number = 0) {
  if (it.kind !== "position") return { ...it, ep: 0, gp: 0, mat_vk: 0, lohn_vk: 0, kupfer_vk: 0 };
  const pe = num(it.preiseinheit) || 1;
  const versch = num(it.verschnitt) || 1;
  const matVk = num(it.mat_ek) * (num(it.mat_multi) || 1) * versch / pe;
  const lohnEk = (it.lohn_ek !== undefined && it.lohn_ek !== "") ? num(it.lohn_ek) : num(it.std_lohn);
  const lohnSatzVk = lohnEk * (num(it.lohn_multi) || 1);
  const lohnVk = lohnSatzVk * (num(it.minutes) / 60);
  const kupferEk = num(it.kupfer_kg) * del;                       // Kupfer-EK je Preiseinheit
  const kupferVk = kupferEk * (num(it.kupfer_multi) || 1) / pe;   // Kupfer-VK je Einheit
  // Fremd/Gerät: EK×Multi wenn ein EK eingetragen ist, sonst direktes Vk-Feld (Alt-Daten).
  const fremdVk = it.fremd_ek !== undefined && it.fremd_ek !== null && String(it.fremd_ek) !== "" ? num(it.fremd_ek) * (num(it.fremd_multi) || 1) : num(it.fremd_vk);
  const geraetVk = it.geraet_ek !== undefined && it.geraet_ek !== null && String(it.geraet_ek) !== "" ? num(it.geraet_ek) * (num(it.geraet_multi) || 1) : num(it.geraet_vk);
  const epCalc = matVk + lohnVk + kupferVk + fremdVk + geraetVk;
  // Fester E-Preis (ep_fix): manuell eingetippter Preis überschreibt die Kalkulation. Leer = automatisch.
  const ep = it.ep_fix !== undefined && it.ep_fix !== null && String(it.ep_fix).trim() !== "" ? num(it.ep_fix) : epCalc;
  const gp = ep * num(it.qty) * (1 - num(it.discount_pct) / 100);
  return { ...it, mat_vk: matVk, lohn_satz_vk: lohnSatzVk, lohn_vk: lohnVk, kupfer_ek: kupferEk, kupfer_vk: kupferVk, fremd_vk_eff: fremdVk, geraet_vk_eff: geraetVk, ep, gp };
}

// Artikel → Angebotsposition (Kalkulationswerte übernehmen, Multis ggf. aus Angebot)
// Funktioniert für eigene Artikel (office_articles) UND Lieferanten-Katalogzeilen (office_supplier_articles, Feld „ek").
function articleToItem(a: any, qty: string, defMat: string, defLohn: string, defKupfer?: string) {
  const s = (v: any) => (v === null || v === undefined ? "" : String(v));
  const isSup = "ek" in a; // Lieferanten-Katalogzeile: Netto-EK steht in a.ek
  const matEk = isSup ? (a.ek ?? a.net_ek ?? a.list_ek) : a.mat_ek;
  const mm = (a.mat_multi === null || a.mat_multi === undefined || a.mat_multi === "") ? (defMat || "1.28") : String(a.mat_multi);
  const lm = (a.lohn_multi === null || a.lohn_multi === undefined || a.lohn_multi === "") ? (defLohn || "1.5715") : String(a.lohn_multi);
  const text = a.short_text || (isSup && a.article_no ? "Art. " + a.article_no : "");
  // Preiseinheit + Kupfer nur bei eigenen Artikeln; Katalogpreise sind bereits je Einheit umgerechnet.
  const has = (v: any) => !isSup && v !== null && v !== undefined && String(v) !== "";
  const pe = has(a.preiseinheit) ? String(a.preiseinheit) : "1";
  const cuKg = has(a.kupfer_kg) ? String(a.kupfer_kg) : "";
  const cuMulti = has(a.kupfer_multi) ? String(a.kupfer_multi) : (defKupfer && String(defKupfer).trim() ? String(defKupfer) : "1.05");
  return {
    id: uid(), kind: "position", oz: "", article_id: a.id || null,
    short_text: text, long_text: a.long_text || "",
    qty: qty && String(qty).trim() ? String(qty) : "1", unit: a.unit || "St",
    mat_ek: s(matEk), mat_multi: mm, lohn_ek: isSup || s(a.lohn_ek) === "" ? "35" : s(a.lohn_ek), lohn_multi: lm,
    minutes: isSup ? "" : s(a.minutes), fremd_vk: "", geraet_vk: "", discount_pct: "",
    preiseinheit: pe, verschnitt: "1", kupfer_kg: cuKg, kupfer_multi: cuMulti,
  };
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

// Titelsumme: Summe der G-Preise der Positionen bis zum naechsten Titel
function titleSum(items: any[], idx: number, del: number = 0) {
  let s = 0;
  for (let i = idx + 1; i < items.length; i++) {
    if (items[i].kind === "titel") break;
    if (items[i].kind === "position") s += calcItem(items[i], del).gp;
  }
  return s;
}

function newItem(kind: string) {
  const base: any = { id: uid(), kind, oz: "" };
  if (kind === "titel") return { ...base, title: "" };
  if (kind === "text") return { ...base, short_text: "", long_text: "" };
  return { ...base, short_text: "", long_text: "", qty: "1", unit: "St", mat_ek: "", mat_multi: "1.28", lohn_ek: "35", lohn_multi: "1.5715", minutes: "", fremd_vk: "", geraet_vk: "", discount_pct: "", preiseinheit: "1", verschnitt: "1", kupfer_kg: "", kupfer_multi: "1.05" };
}

// ── Dokumentarten (Stufe 6a): Angebot -> Auftragsbestätigung -> Rechnung ──
const DOC_LABEL: Record<string, string> = { angebot: "Angebot", ab: "Auftragsbestätigung", rechnung: "Rechnung" };
const DOC_LABEL_NEW: Record<string, string> = { angebot: "Neues Angebot", ab: "Neue Auftragsbestätigung", rechnung: "Neue Rechnung" };
const DOC_LABEL_PLURAL: Record<string, string> = { angebot: "Angebote", ab: "Auftragsbestätigungen", rechnung: "Rechnungen" };
const DOC_ICON: Record<string, string> = { angebot: "🧾", ab: "📋", rechnung: "💶" };
// Status je Dokumentart (Freitext in der DB; hier nur die Auswahl)
const DOC_STATUS: Record<string, string[]> = {
  angebot: ["entwurf", "versendet", "beauftragt", "abgelehnt"],
  ab: ["entwurf", "versendet", "bestätigt"],
  rechnung: ["entwurf", "versendet", "bezahlt"],
};

function blankOffer() {
  return {
    id: null as string | null, number: "", status: "entwurf", subject: "",
    doc_type: "angebot", parent_id: null as string | null, doc_date: "",
    leistung_von: "", leistung_bis: "", zahlungsziel_tage: "",
    offer_date: "", valid_until: "",
    customer_id: "", customer_name: "", customer_anrede: "", customer_street: "", customer_zip: "", customer_city: "",
    vat_rate: "19", rabatt_pct: "0", nachlass: "0", skonto_pct: "0", skonto_tage: "0",
    def_mat_multi: "1.28", def_lohn_multi: "1.5715", binde_weeks: "",
    tax_mode: "standard", tax_note: "", vortext: "", nachtext: "", pay1_pct: "50", pay2_pct: "30", pay3_pct: "20",
    del_preis: "0",
    items: [] as any[],
  };
}

// ── Komponente ─────────────────────────────────────────────────────
export default function Angebote({ supabase, companyId, customers, doc = "angebot" }: { supabase: any; companyId: string; customers: any[]; doc?: string }) {
  const [offers, setOffers] = useState<any[]>([]);
  const [mode, setMode] = useState<"list" | "edit" | "settings">("list");
  // Die angezeigte Dokumentart kommt vom Buero-Reiter (Angebote / AB / Rechnung).
  const docFilter = doc;
  const [o, setO] = useState<any>(blankOffer());
  const [msg, setMsg] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openItem, setOpenItem] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<any>({ def_mat_multi: "1.28", def_lohn_multi: "1.5715", binde_weeks: "4", vat_rate: "19", def_rabatt_pct: "0", def_nachlass: "0", def_skonto_pct: "0", def_skonto_tage: "0", pv_text: PV_DEFAULT, b13_text: B13_DEFAULT, vortext: VORTEXT_DEFAULT, nachtext: NACHTEXT_DEFAULT, pay1_pct: "50", pay2_pct: "30", pay3_pct: "20", del_preis: "0", def_kupfer_multi: "1.05" });
  const [settingsTab, setSettingsTab] = useState("allgemein");
  const [textModules, setTextModules] = useState<any[]>([]);
  const [tmKind, setTmKind] = useState("vor");
  const [tmTitle, setTmTitle] = useState("");
  const [tmBody, setTmBody] = useState("");
  const [tmEditId, setTmEditId] = useState<string | null>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [artPickerOpen, setArtPickerOpen] = useState(false);
  const [artSource, setArtSource] = useState<string>("leistung"); // "leistung" | "artikel" oder supplier_id
  const isOwnSrc = (s: string) => s === "leistung" || s === "artikel"; // eigener Stamm (nach Art) vs. Lieferanten-Katalog

  // Stufe 9: Taifun-Tabellenansicht + Preisarchiv
  const [posView, setPosView] = useState<"zeilen" | "tabelle">("zeilen");
  const [archOpen, setArchOpen] = useState(false);
  const [archCount, setArchCount] = useState<number | null>(null);
  const [archBusy, setArchBusy] = useState(false);
  const [archMsg, setArchMsg] = useState("");
  // Prüfliste des Preisvorschlags: je unsicherer Position bis zu 5 Kandidaten zur Auswahl.
  const [sugList, setSugList] = useState<{ id: string; oz: string; text: string; cands: { row: any; score: number }[] }[]>([]);
  const [kiBusy, setKiBusy] = useState(false);
  const [artSearch, setArtSearch] = useState("");
  const [artCat, setArtCat] = useState("");
  const [supResults, setSupResults] = useState<any[]>([]);
  const [supLoading, setSupLoading] = useState(false);
  const [supErr, setSupErr] = useState("");
  const [cart, setCart] = useState<Record<string, { qty: string; art: any }>>({});

  useEffect(() => { if (companyId) { loadOffers(); loadSettings(); loadTextModules(); loadArticles(); loadSuppliers(); } /* eslint-disable-next-line */ }, [companyId]);

  // Serverseitige Suche im Lieferanten-Katalog (große Kataloge nicht komplett laden), entprellt.
  useEffect(() => {
    if (!artPickerOpen || isOwnSrc(artSource)) { setSupResults([]); return; }
    let active = true;
    setSupLoading(true);
    const safe = artSearch.trim().replace(/[,()%*]/g, " ").trim();
    const h = setTimeout(async () => {
      let query = supabase.from("office_supplier_articles").select("*").eq("company_id", companyId).eq("supplier_id", artSource);
      // PostgREST-Platzhalter in .or() ist "*" (nicht "%") – "%" würde in der URL als Prozent-Kodierung fehlinterpretiert.
      if (safe) query = query.or(`short_text.ilike.*${safe}*,article_no.ilike.*${safe}*`);
      const { data, error } = await query.order("short_text", { ascending: true }).limit(50);
      if (active) { setSupResults(data || []); setSupErr(error ? error.message : ""); setSupLoading(false); }
    }, 300);
    return () => { active = false; clearTimeout(h); };
    // eslint-disable-next-line
  }, [artPickerOpen, artSource, artSearch, companyId]);

  async function loadOffers() {
    const { data, error } = await supabase.from("office_offers").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    if (error) { setMsg("Fehler beim Laden: " + error.message); return; }
    setOffers(data || []);
  }
  async function loadSettings() {
    const { data } = await supabase.from("office_offer_settings").select("*").eq("company_id", companyId).maybeSingle();
    if (data) setSettings({ def_mat_multi: String(data.def_mat_multi ?? "1.28"), def_lohn_multi: String(data.def_lohn_multi ?? "1.5715"), binde_weeks: String(data.binde_weeks ?? "4"), vat_rate: String(data.vat_rate ?? "19"), def_rabatt_pct: String(data.def_rabatt_pct ?? "0"), def_nachlass: String(data.def_nachlass ?? "0"), def_skonto_pct: String(data.def_skonto_pct ?? "0"), def_skonto_tage: String(data.def_skonto_tage ?? "0"), pv_text: data.pv_text ?? PV_DEFAULT, b13_text: data.b13_text ?? B13_DEFAULT, vortext: data.vortext ?? VORTEXT_DEFAULT, nachtext: data.nachtext ?? NACHTEXT_DEFAULT, pay1_pct: String(data.pay1_pct ?? "50"), pay2_pct: String(data.pay2_pct ?? "30"), pay3_pct: String(data.pay3_pct ?? "20"), del_preis: String(data.del_preis ?? "0"), def_kupfer_multi: String(data.def_kupfer_multi ?? "1.05") });
  }
  async function saveSettings() {
    const { error } = await supabase.from("office_offer_settings").upsert({ company_id: companyId, def_mat_multi: num(settings.def_mat_multi), def_lohn_multi: num(settings.def_lohn_multi), binde_weeks: Math.round(num(settings.binde_weeks)), vat_rate: num(settings.vat_rate), def_rabatt_pct: num(settings.def_rabatt_pct), def_nachlass: num(settings.def_nachlass), def_skonto_pct: num(settings.def_skonto_pct), def_skonto_tage: Math.round(num(settings.def_skonto_tage)), pv_text: settings.pv_text || null, b13_text: settings.b13_text || null, vortext: settings.vortext || null, nachtext: settings.nachtext || null, pay1_pct: num(settings.pay1_pct), pay2_pct: num(settings.pay2_pct), pay3_pct: num(settings.pay3_pct), del_preis: num(settings.del_preis), def_kupfer_multi: num(settings.def_kupfer_multi), updated_at: new Date().toISOString() }, { onConflict: "company_id" });
    if (error) { setMsg("Fehler beim Speichern der Einstellungen: " + error.message); return; }
    setMsg("Einstellungen gespeichert.");
  }
  async function loadTextModules() {
    const { data } = await supabase.from("office_offer_texts").select("*").eq("company_id", companyId).order("created_at", { ascending: true });
    setTextModules(data || []);
  }
  async function saveTextModule() {
    if (!tmBody.trim() && !tmTitle.trim()) { setMsg("Bitte Titel oder Text eingeben."); return; }
    const payload = { company_id: companyId, kind: tmKind, title: tmTitle.trim(), body: tmBody };
    if (tmEditId) { const { error } = await supabase.from("office_offer_texts").update(payload).eq("id", tmEditId); if (error) { setMsg("Fehler: " + error.message); return; } }
    else { const { error } = await supabase.from("office_offer_texts").insert(payload); if (error) { setMsg("Fehler: " + error.message); return; } }
    setTmEditId(null); setTmTitle(""); setTmBody(""); await loadTextModules(); setMsg("Baustein gespeichert.");
  }
  async function deleteTextModule(id: string) {
    const { error } = await supabase.from("office_offer_texts").delete().eq("id", id);
    if (error) { setMsg("Fehler: " + error.message); return; }
    if (tmEditId === id) { setTmEditId(null); setTmTitle(""); setTmBody(""); }
    await loadTextModules();
  }

  async function loadArticles() {
    const { data } = await supabase.from("office_articles").select("*").eq("company_id", companyId).order("short_text", { ascending: true });
    setArticles(data || []);
  }
  async function loadSuppliers() {
    const { data } = await supabase.from("office_suppliers").select("id,name,article_count").eq("company_id", companyId).order("name", { ascending: true });
    setSuppliers(data || []);
  }
  function openArtPicker() { setArtPickerOpen((v) => { const nv = !v; if (nv) { loadArticles(); loadSuppliers(); setArtSource("own"); setArtSearch(""); setArtCat(""); } return nv; }); }
  function addArticleSingle(a: any) {
    setO((p: any) => ({ ...p, items: [...p.items, articleToItem(a, "1", p.def_mat_multi, p.def_lohn_multi, settings.def_kupfer_multi)] }));
    setMsg(`Artikel „${a.short_text || a.article_no || ""}“ als Position hinzugefügt.`);
  }
  function toggleCart(a: any) { setCart((c) => { const n = { ...c }; if (a.id in n) delete n[a.id]; else n[a.id] = { qty: "1", art: a }; return n; }); }
  function setCartQty(id: string, val: string) { setCart((c) => (c[id] ? { ...c, [id]: { ...c[id], qty: val } } : c)); }
  function addCartToOffer() {
    const entries = Object.values(cart);
    if (!entries.length) { setMsg("Keine Artikel im Warenkorb ausgewählt."); return; }
    setO((p: any) => ({ ...p, items: [...p.items, ...entries.map((e) => articleToItem(e.art, e.qty || "1", p.def_mat_multi, p.def_lohn_multi, settings.def_kupfer_multi))] }));
    setCart({}); setArtPickerOpen(false);
    setMsg(`${entries.length} Artikel aus dem Warenkorb übernommen.`);
  }

  function startNew() {
    const b: any = blankOffer();
    b.def_mat_multi = settings.def_mat_multi || "1.28";
    b.def_lohn_multi = settings.def_lohn_multi || "1.5715";
    b.binde_weeks = settings.binde_weeks || "";
    b.vat_rate = settings.vat_rate || "19";
    b.rabatt_pct = settings.def_rabatt_pct || "0";
    b.nachlass = settings.def_nachlass || "0";
    b.skonto_pct = settings.def_skonto_pct || "0";
    b.skonto_tage = settings.def_skonto_tage || "0";
    b.tax_mode = "standard"; b.tax_note = "";
    b.vortext = settings.vortext || "";
    b.nachtext = settings.nachtext || "";
    b.pay1_pct = settings.pay1_pct || "50";
    b.pay2_pct = settings.pay2_pct || "30";
    b.pay3_pct = settings.pay3_pct || "20";
    b.del_preis = settings.del_preis || "0";
    b.offer_date = new Date().toISOString().slice(0, 10);
    setO(b); setMode("edit"); setMsg(""); setCustSearch(""); setPickerOpen(false);
  }
  // DB-Zeile in den bearbeitbaren Zustand normalisieren (Zahlen als Strings).
  function rowToState(row: any) {
    return { ...blankOffer(), ...row, vat_rate: String(row.vat_rate ?? "19"), rabatt_pct: String(row.rabatt_pct ?? "0"), nachlass: String(row.nachlass ?? "0"), skonto_pct: String(row.skonto_pct ?? "0"), skonto_tage: String(row.skonto_tage ?? "0"), def_mat_multi: String(row.def_mat_multi ?? "1.28"), def_lohn_multi: String(row.def_lohn_multi ?? "1.5715"), binde_weeks: String(row.binde_weeks ?? ""), tax_mode: row.tax_mode || "standard", tax_note: row.tax_note ?? "", vortext: row.vortext ?? "", nachtext: row.nachtext ?? "", pay1_pct: String(row.pay1_pct ?? "50"), pay2_pct: String(row.pay2_pct ?? "30"), pay3_pct: String(row.pay3_pct ?? "20"), del_preis: String(row.del_preis ?? "0"), doc_type: row.doc_type || "angebot", parent_id: row.parent_id || null, doc_date: row.doc_date || "", leistung_von: row.leistung_von || "", leistung_bis: row.leistung_bis || "", zahlungsziel_tage: row.zahlungsziel_tage != null ? String(row.zahlungsziel_tage) : "", items: Array.isArray(row.items) ? row.items : [] };
  }
  function editOffer(row: any) {
    setO(rowToState(row));
    setMode("edit"); setMsg("");
  }
  // Folgedokument erzeugen (Angebot -> AB, Angebot/AB -> Rechnung).
  // Kopiert alle Positionen (neue IDs), verweist per parent_id auf die Quelle.
  // Nummer wird als editierbarer Vorschlag von der Quelle uebernommen (Nummernkreise kommen spaeter).
  function deriveDoc(row: any, newType: string) {
    const s: any = rowToState(row);
    s.id = null;
    s.doc_type = newType;
    s.parent_id = row.id;
    s.status = "entwurf";
    s.doc_date = new Date().toISOString().slice(0, 10);
    s.items = (Array.isArray(row.items) ? row.items : []).map((it: any) => ({ ...it, id: uid() }));
    if (newType === "rechnung" && !s.zahlungsziel_tage) s.zahlungsziel_tage = "14";
    setO(s); setMode("edit"); setCustSearch(""); setPickerOpen(false);
    setMsg(`${DOC_LABEL[newType]} aus ${DOC_LABEL[row.doc_type || "angebot"]} ${row.number || "(ohne Nr.)"} erzeugt – noch nicht gespeichert. Nach dem Speichern zu finden im Reiter ${DOC_ICON[newType]} ${DOC_LABEL[newType]}.`);
  }
  // Dokument gleicher Art als Vorlage duplizieren (ohne Nummer, ohne Verweis).
  function duplicateDoc(row: any) {
    const s: any = rowToState(row);
    s.id = null;
    s.parent_id = null;
    s.number = "";
    s.status = "entwurf";
    const heute = new Date().toISOString().slice(0, 10);
    if ((s.doc_type || "angebot") === "angebot") s.offer_date = heute; else s.doc_date = heute;
    s.items = (Array.isArray(row.items) ? row.items : []).map((it: any) => ({ ...it, id: uid() }));
    setO(s); setMode("edit"); setCustSearch(""); setPickerOpen(false);
    setMsg(`Kopie von ${row.number || "(ohne Nr.)"} erzeugt – noch nicht gespeichert.`);
  }

  function set(field: string, val: any) { setO((p: any) => ({ ...p, [field]: val })); }
  function setItem(id: string, field: string, val: any) {
    setO((p: any) => ({ ...p, items: p.items.map((it: any) => it.id === id ? { ...it, [field]: val } : it) }));
  }
  function addItem(kind: string) {
    setO((p: any) => {
      const it: any = newItem(kind);
      if (kind === "position") { it.mat_multi = p.def_mat_multi || "1.28"; it.lohn_multi = p.def_lohn_multi || "1.5715"; it.kupfer_multi = settings.def_kupfer_multi || "1.05"; }
      return { ...p, items: [...p.items, it] };
    });
  }
  function applyMultisToAll() {
    setO((p: any) => ({ ...p, items: p.items.map((it: any) => it.kind === "position" ? { ...it, mat_multi: p.def_mat_multi, lohn_multi: p.def_lohn_multi } : it) }));
    setMsg("Multiplikatoren auf alle Positionen übernommen.");
  }
  function setTaxMode(mode: string) {
    setO((p: any) => ({ ...p, tax_mode: mode, vat_rate: mode === "standard" ? (settings.vat_rate || "19") : "0", tax_note: mode === "pv" ? (settings.pv_text || PV_DEFAULT) : mode === "b13" ? (settings.b13_text || B13_DEFAULT) : "" }));
  }
  function removeItem(id: string) { setO((p: any) => ({ ...p, items: p.items.filter((it: any) => it.id !== id) })); }
  function moveItem(id: string, dir: number) {
    setO((p: any) => {
      const arr = [...p.items]; const i = arr.findIndex((x: any) => x.id === id); const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return p;
      [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...p, items: arr };
    });
  }

  function pickCustomer(k: any) {
    setO((p: any) => ({ ...p, customer_id: k.id, customer_name: k.name || "", customer_anrede: k.anrede || "", customer_street: k.street || "", customer_zip: k.zip || "", customer_city: k.city || "" }));
    setPickerOpen(false); setCustSearch("");
  }

  async function saveOffer() {
    const t = offerTotals(o.items, o);
    const payload: any = {
      company_id: companyId, number: o.number || null, status: o.status || "entwurf", subject: o.subject || null,
      offer_date: o.offer_date || null, valid_until: (o.binde_weeks ? addWeeks(o.offer_date, num(o.binde_weeks)) : o.valid_until) || null, binde_weeks: o.binde_weeks ? Math.round(num(o.binde_weeks)) : null,
      customer_id: o.customer_id || null, customer_name: o.customer_name || null, customer_anrede: o.customer_anrede || null,
      customer_street: o.customer_street || null, customer_zip: o.customer_zip || null, customer_city: o.customer_city || null,
      vat_rate: num(o.vat_rate), rabatt_pct: num(o.rabatt_pct), nachlass: num(o.nachlass), skonto_pct: num(o.skonto_pct), skonto_tage: num(o.skonto_tage),
      def_mat_multi: num(o.def_mat_multi), def_lohn_multi: num(o.def_lohn_multi),
      tax_mode: o.tax_mode || "standard", tax_note: o.tax_note || null,
      vortext: o.vortext || null, nachtext: o.nachtext || null, pay1_pct: num(o.pay1_pct), pay2_pct: num(o.pay2_pct), pay3_pct: num(o.pay3_pct),
      del_preis: num(o.del_preis),
      doc_type: o.doc_type || "angebot", parent_id: o.parent_id || null, doc_date: o.doc_date || null,
      leistung_von: o.leistung_von || null, leistung_bis: o.leistung_bis || null,
      zahlungsziel_tage: o.zahlungsziel_tage ? Math.round(num(o.zahlungsziel_tage)) : null,
      items: o.items, net_total: t.netAfter, vat_total: t.vat, gross_total: t.gross, updated_at: new Date().toISOString(),
    };
    if (o.id) {
      const { error } = await supabase.from("office_offers").update(payload).eq("id", o.id);
      if (error) { setMsg("Fehler beim Speichern: " + error.message); return; }
    } else {
      const { data, error } = await supabase.from("office_offers").insert(payload).select("id").single();
      if (error) { setMsg("Fehler beim Speichern: " + error.message); return; }
      if (data?.id) setO((p: any) => ({ ...p, id: data.id }));
    }
    await loadOffers(); setMsg(`${DOC_LABEL[o.doc_type || "angebot"]} gespeichert.`);
  }

  async function pdfOffer() {
    try {
      const cust = customers.find((k: any) => k.id === o.customer_id);
      const customerNo = cust ? String(cust.customer_no || cust.debitor || cust.kreditor || "") : "";
      await generateAngebotPdf(o, { customerNo });
    } catch (e: any) {
      setMsg("Fehler beim PDF: " + (e?.message || String(e)));
    }
  }

  // Bezugstext fürs PDF: "Angebot Nr. 1234567 vom 05.08.2026" / "Auftragsbestätigung Nr. …"
  function parentInfoText() {
    const parent: any = o.parent_id ? offers.find((r: any) => r.id === o.parent_id) : null;
    if (!parent) return "";
    const pdt = parent.doc_type || "angebot";
    const pdate = pdt === "angebot" ? parent.offer_date : (parent.doc_date || parent.offer_date);
    return `${DOC_LABEL[pdt]} Nr. ${parent.number || "(ohne Nr.)"}${pdate ? ` vom ${fmtDate(pdate)}` : ""}`;
  }

  // Stufe 6b: AB-PDF (Luger-Layout, Bezug aufs Angebot, ohne Bindefrist)
  async function pdfAb() {
    try {
      const cust = customers.find((k: any) => k.id === o.customer_id);
      const customerNo = cust ? String(cust.customer_no || cust.debitor || cust.kreditor || "") : "";
      await generateAbPdf(o, { customerNo, parentInfo: parentInfoText() });
    } catch (e: any) {
      setMsg("Fehler beim PDF: " + (e?.message || String(e)));
    }
  }

  // Stufe 6c: Rechnungs-PDF (Leistungszeitraum, Fälligkeit/Skonto, Bezug auf AB/Angebot)
  async function pdfRechnung() {
    try {
      const cust = customers.find((k: any) => k.id === o.customer_id);
      const customerNo = cust ? String(cust.customer_no || cust.debitor || cust.kreditor || "") : "";
      await generateRechnungPdf(o, { customerNo, parentInfo: parentInfoText() });
    } catch (e: any) {
      setMsg("Fehler beim PDF: " + (e?.message || String(e)));
    }
  }

  // ── Stufe 9b: Taifun-Preisarchiv ─────────────────────────────────
  async function loadArchCount() {
    const { count } = await supabase.from("office_price_archive").select("id", { count: "exact", head: true }).eq("company_id", companyId);
    setArchCount(count ?? 0);
  }
  async function importTaifunFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    setArchBusy(true); setArchMsg("Lese Dateien…");
    let total = 0, skippedAll = 0;
    const warns: string[] = [];
    try {
      for (const f of Array.from(fileList)) {
        const { rows, skipped, warn } = await parseTaifunXlsx(f);
        if (warn) { warns.push(warn); continue; }
        skippedAll += skipped;
        const payload = rows.map((r) => ({
          company_id: companyId, source: f.name, pos: r.pos || null, unit: r.unit || null,
          text: r.text, norm_text: Array.from(normTokens(r.text)).join(" "),
          mat_ek: r.mat_ek, mat_multi: r.mat_multi, lohn_ek: r.lohn_ek, minutes: r.minutes,
          fremd_vk: r.fremd_vk, geraet_vk: r.geraet_vk, ep: r.ep,
        }));
        for (let i = 0; i < payload.length; i += 500) {
          const { error } = await supabase.from("office_price_archive").insert(payload.slice(i, i + 500));
          if (error) throw new Error(`${f.name}: ${error.message}`);
        }
        total += payload.length;
        setArchMsg(`Importiere… ${f.name}: ${payload.length} Positionen`);
      }
      setArchMsg(`Fertig: ${total} Positionen importiert${skippedAll ? ` (${skippedAll} Titel-/Textzeilen übersprungen)` : ""}.${warns.length ? " ⚠️ " + warns.join(" ") : ""}`);
    } catch (e: any) {
      setArchMsg("Fehler beim Import: " + (e?.message || String(e)));
    }
    setArchBusy(false);
    await loadArchCount();
  }
  async function clearArchive() {
    if (typeof window !== "undefined" && !window.confirm("Preisarchiv wirklich komplett leeren?")) return;
    setArchBusy(true);
    const { error } = await supabase.from("office_price_archive").delete().eq("company_id", companyId);
    setArchBusy(false);
    setArchMsg(error ? "Fehler beim Leeren: " + error.message : "Preisarchiv geleert.");
    await loadArchCount();
  }

  // Werte eines Kandidaten (Archiv ODER DATANORM-Katalog) in eine Position übernehmen.
  function applyCandidate(it: any, r: any, score: number) {
    const matOnly = r.minutes == null && r.lohn_ek == null; // Katalogartikel: nur echter Material-EK
    return {
      ...it,
      mat_ek: r.mat_ek != null ? String(r.mat_ek) : it.mat_ek,
      mat_multi: r.mat_multi != null && num(r.mat_multi) > 0 ? String(r.mat_multi) : it.mat_multi,
      lohn_ek: r.lohn_ek != null && num(r.lohn_ek) > 0 ? String(r.lohn_ek) : it.lohn_ek,
      minutes: r.minutes != null ? String(r.minutes) : it.minutes,
      fremd_vk: r.fremd_vk != null && num(r.fremd_vk) > 0 ? String(r.fremd_vk) : it.fremd_vk,
      geraet_vk: r.geraet_vk != null && num(r.geraet_vk) > 0 ? String(r.geraet_vk) : it.geraet_vk,
      suggest_note: `${Math.round(score * 100)} % ähnlich: „${String(r.text).split("\n")[0].slice(0, 70)}" (${r.source || "Archiv"}${r.ep != null ? `, EP damals ${fmt(num(r.ep))} €` : ""})${matOnly ? " — nur Material-EK aus dem Katalog, Minuten fehlen noch (🤖 kann sie schätzen)" : ""}`,
    };
  }

  // DATANORM-Katalog-Kandidaten für eine Position: echte EKs aus office_supplier_articles.
  async function catalogCandidates(text: string): Promise<{ row: any; score: number }[]> {
    const toks = Array.from(normTokens(text)).filter((w) => w.length >= 4 && !/^\d+$/.test(w)).sort((a, b) => b.length - a.length).slice(0, 3);
    if (!toks.length) return [];
    try {
      const { data } = await supabase.from("office_supplier_articles")
        .select("supplier_id,article_no,short_text,unit,ek,net_ek")
        .eq("company_id", companyId)
        .or(toks.map((t) => `short_text.ilike.*${t.replace(/[,()%*]/g, "")}*`).join(","))
        .limit(15);
      const t = normTokens(text);
      const out: { row: any; score: number }[] = [];
      for (const a of data || []) {
        const ek = a.ek != null ? a.ek : a.net_ek;
        if (ek == null) continue;
        const score = similarity(t, normTokens(a.short_text || ""));
        if (score < 0.25) continue;
        const supNm = suppliers.find((s: any) => s.id === a.supplier_id)?.name || "Katalog";
        out.push({ score, row: { source: `🏭 ${supNm}${a.article_no ? " " + a.article_no : ""}`, unit: a.unit || "", text: a.short_text || ("Art. " + a.article_no), mat_ek: ek, mat_multi: null, lohn_ek: null, minutes: null, fremd_vk: null, geraet_vk: null, ep: null } });
      }
      out.sort((x, y) => y.score - x.score);
      return out.slice(0, 3);
    } catch { return []; }
  }
  function pickSuggestion(itemId: string, cand: { row: any; score: number }) {
    setO((p: any) => ({ ...p, items: p.items.map((it: any) => (it.id === itemId ? applyCandidate(it, cand.row, cand.score) : it)) }));
    setSugList((p) => p.filter((e) => e.id !== itemId));
  }
  function skipSuggestion(itemId: string) {
    setSugList((p) => p.filter((e) => e.id !== itemId));
  }

  // Kandidaten-Block direkt unter der jeweiligen Position (Zeilen- und Tabellenansicht).
  function suggBlockFor(itemId: string) {
    const e = sugList.find((x) => x.id === itemId);
    if (!e) return null;
    return (
      <div className="border-t border-amber-200 bg-amber-50/60 p-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-amber-900">💡 Vorschläge aus dem Preisarchiv — anklicken = übernehmen</span>
          <button type="button" onClick={() => skipSuggestion(itemId)} className="bg-gray-200 px-2 py-0.5 rounded text-xs whitespace-nowrap">Überspringen</button>
        </div>
        {e.cands.map((c, i) => (
          <button key={i} type="button" onClick={() => pickSuggestion(e.id, c)}
            className="w-full text-left border border-slate-200 rounded-lg p-1.5 text-xs bg-white hover:bg-emerald-50 flex flex-wrap items-center gap-x-3 gap-y-0.5"
            title={String(c.row.text)}>
            <span className={`font-bold rounded px-1.5 py-0.5 ${c.score >= 0.6 ? "bg-emerald-100 text-emerald-800" : c.score >= 0.4 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{Math.round(c.score * 100)} %</span>
            <span className="min-w-0 flex-1 truncate font-medium">{String(c.row.text).split("\n")[0]}</span>
            <span className="text-gray-600 whitespace-nowrap">Mat {c.row.mat_ek != null ? fmt(num(c.row.mat_ek)) + " €" : "—"}{c.row.mat_multi != null && num(c.row.mat_multi) > 0 ? ` ×${c.row.mat_multi}` : ""}</span>
            <span className="text-gray-600 whitespace-nowrap">Lohn {c.row.lohn_ek != null && num(c.row.lohn_ek) > 0 ? fmt(num(c.row.lohn_ek)) + " €/h" : "—"} · {c.row.minutes != null ? num(c.row.minutes) + " min" : "—"}</span>
            <span className="text-gray-800 font-medium whitespace-nowrap">EP damals {c.row.ep != null ? fmt(num(c.row.ep)) + " €" : "—"}</span>
            <span className="text-gray-400 whitespace-nowrap">{c.row.source || ""}</span>
          </button>
        ))}
      </div>
    );
  }

  // 💡 Unkalkulierte Positionen (kein Mat-EK, keine Minuten, kein fester EP) aus dem Archiv befüllen.
  // Sehr sichere Treffer (>= 80 %) werden direkt übernommen; alles Ähnliche (>= 25 %) landet in
  // der Prüfliste — dort wählt Marco je Position, WELCHER Kandidat (Preis/Zeit) übernommen wird.
  async function suggestPrices() {
    setMsg("💡 Suche passende Alt-Positionen und Katalogartikel…");
    const { data, error } = await supabase.from("office_price_archive")
      .select("source,unit,text,mat_ek,mat_multi,lohn_ek,minutes,fremd_vk,geraet_vk,ep")
      .eq("company_id", companyId);
    if (error) { setMsg("Fehler beim Laden des Archivs: " + error.message); return; }
    const archive = (data || []).map((r: any) => ({ row: r, tokens: normTokens(r.text) }));
    let filled = 0, none = 0, hadCalc = 0;
    // 1. Durchgang: Archiv (sichere Treffer sofort übernehmen, Rest sammeln)
    const pending: { it: any; cands: { row: any; score: number }[] }[] = [];
    const items = o.items.map((it: any) => {
      if (it.kind !== "position") return it;
      const unkalkuliert = num(it.mat_ek) === 0 && num(it.minutes) === 0 && num(it.geraet_vk) === 0 && num(it.fremd_vk) === 0 && num(it.geraet_ek) === 0 && num(it.fremd_ek) === 0 && String(it.ep_fix ?? "").trim() === "";
      if (!unkalkuliert) { hadCalc++; return it; }
      const cands = archive.length ? topMatches([it.short_text, it.long_text].filter(Boolean).join(" "), archive, 5, 0.25) : [];
      if (cands.length && cands[0].score >= 0.8) { filled++; return applyCandidate(it, cands[0].row, cands[0].score); }
      pending.push({ it, cands });
      return it;
    });
    setO((p: any) => ({ ...p, items }));
    // 2. Durchgang: DATANORM-Kataloge dazuholen (echte EKs), dann Kandidaten mischen
    const review: { id: string; oz: string; text: string; cands: { row: any; score: number }[] }[] = [];
    for (let i = 0; i < pending.length; i += 6) {
      const batch = pending.slice(i, i + 6);
      const catResults = await Promise.all(batch.map((p) => catalogCandidates([p.it.short_text, p.it.long_text].filter(Boolean).join(" "))));
      batch.forEach((p, j) => {
        const merged = [...p.cands, ...catResults[j]].sort((a, b) => b.score - a.score).slice(0, 6);
        if (!merged.length) { none++; return; }
        review.push({ id: p.it.id, oz: p.it.oz || "", text: p.it.short_text || "(ohne Kurztext)", cands: merged });
      });
      if (pending.length > 6) setMsg(`💡 Suche… ${Math.min(i + 6, pending.length)} / ${pending.length} Positionen geprüft`);
    }
    setSugList(review);
    if (!archive.length && !review.length && !filled) {
      setMsg("Keine Treffer — Preisarchiv ist leer (🗄️ in der Angebotsliste) und die Kataloge haben nichts Passendes.");
      return;
    }
    setMsg(`💡 ${filled} sicher übernommen (≥ 80 % aus Alt-Angeboten)${review.length ? ` · ${review.length} zum Auswählen (Kandidaten unter den Positionen: Alt-Angebote + 🏭 Katalog-EKs)` : ""}${none ? ` · ${none} ohne Treffer` : ""}${hadCalc ? ` · ${hadCalc} bereits kalkuliert` : ""}.`);
  }

  // 🤖 Stufe 9c: KI-Schätzung für ALLE Positionen ohne Preis (Route /api/price-ai, gpt-4o-mini).
  // Werte kommen als 🤖-Vorschlag (mat_ek + minutes je Einheit) — Kennzeichnung wie beim Archiv.
  async function suggestPricesAi() {
    // Fehlt Material/Gerät (needCost) und/oder fehlen Minuten (needMin)? Nur Fehlendes wird gefüllt —
    // so ergänzt die KI z. B. die Minuten zu einem echten Katalog-EK aus dem 💡-Vorschlag.
    const flags: Record<string, { needCost: boolean; needMin: boolean }> = {};
    const targets = o.items.filter((it: any) => {
      if (it.kind !== "position") return false;
      if (String(it.ep_fix ?? "").trim() !== "") return false;
      if (String(it.short_text || it.long_text || "").trim() === "") return false;
      const needCost = num(it.mat_ek) === 0 && num(it.geraet_vk) === 0 && num(it.fremd_vk) === 0 && num(it.geraet_ek) === 0 && num(it.fremd_ek) === 0;
      const needMin = num(it.minutes) === 0;
      if (!needCost && !needMin) return false;
      flags[it.id] = { needCost, needMin };
      return true;
    });
    if (!targets.length) { setMsg("🤖 Alle Positionen haben schon Preise und Minuten — nichts zu schätzen."); return; }
    setKiBusy(true);
    setMsg(`🤖 KI schätzt fehlende Werte bei ${targets.length} Position${targets.length === 1 ? "" : "en"}…`);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { setMsg("Nicht angemeldet — bitte neu einloggen."); setKiBusy(false); return; }
      const byId: Record<string, { mat_ek: number | null; geraet: number | null; minutes: number | null; note: string }> = {};
      for (let i = 0; i < targets.length; i += 25) {
        const chunk = targets.slice(i, i + 25).map((it: any) => ({
          id: it.id,
          text: [it.short_text, it.long_text].filter(Boolean).join("\n").slice(0, 500),
          unit: it.unit || "St",
          qty: num(it.qty) || 1,
        }));
        const res = await fetch("/api/price-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ positions: chunk }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Fehler ${res.status}`);
        for (const r of data?.items || []) byId[r.id] = r;
        setMsg(`🤖 KI schätzt… ${Math.min(i + 25, targets.length)} / ${targets.length}`);
      }
      let filled = 0;
      setO((p: any) => ({
        ...p,
        items: p.items.map((it: any) => {
          const r = byId[it.id];
          if (!r) return it;
          filled++;
          const f = flags[it.id] || { needCost: true, needMin: true };
          return {
            ...it,
            mat_ek: f.needCost && r.mat_ek != null && r.mat_ek > 0 ? String(r.mat_ek) : it.mat_ek,
            geraet_ek: f.needCost && r.geraet != null && r.geraet > 0 ? String(r.geraet) : it.geraet_ek,
            minutes: f.needMin && r.minutes != null ? String(r.minutes) : it.minutes,
            suggest_note: `${it.suggest_note ? it.suggest_note + " · " : ""}🤖 KI${!f.needCost ? " (nur Minuten ergänzt)" : ""}${r.note ? ` (${r.note})` : ""}${f.needCost && r.geraet != null && r.geraet > 0 ? " — Gerätekosten im Feld Gerät-Ek" : ""} — Schätzwerte, bitte prüfen!`,
          };
        }),
      }));
      // Positionen mit KI-Werten aus der Archiv-Prüfliste nehmen (sie sind jetzt kalkuliert).
      setSugList((p) => p.filter((e) => !byId[e.id]));
      const ohne = targets.length - Object.keys(byId).length;
      setMsg(`🤖 ${Object.keys(byId).length} Position${Object.keys(byId).length === 1 ? "" : "en"} von der KI geschätzt (🤖-Kennzeichnung — Schätzwerte, bitte prüfen!)${ohne > 0 ? ` · ${ohne} ohne Schätzung` : ""}.`);
    } catch (e: any) {
      setMsg("Fehler bei der KI-Schätzung: " + (e?.message || String(e)));
    }
    setKiBusy(false);
  }

  async function efbPdf() {
    try {
      if (!o.items.some((x: any) => x.kind === "position")) { setMsg("Keine Positionen für EFB-Formblätter vorhanden."); return; }
      const cust = customers.find((k: any) => k.id === o.customer_id);
      const customerNo = cust ? String(cust.customer_no || cust.debitor || cust.kreditor || "") : "";
      await generateEfbPdf(o, { customerNo });
    } catch (e: any) {
      setMsg("Fehler beim EFB-PDF: " + (e?.message || String(e)));
    }
  }

  async function importGaeb(file: File) {
    try {
      const text = await file.text();
      const res = parseGaebX83(text);
      const mm = o.def_mat_multi || "1.28";
      const lm = o.def_lohn_multi || "1.5715";
      const imported = res.items.map((g: any) => {
        if (g.kind === "titel") return { id: uid(), kind: "titel", oz: g.oz || "", rno: g.rno || "", title: g.title || "" };
        return {
          id: uid(), kind: "position", oz: g.oz || "", rno: g.rno || "", short_text: g.short_text || "", long_text: g.long_text || "",
          qty: String(g.qty ?? "1"), unit: g.unit || "St",
          mat_ek: "", mat_multi: mm, lohn_ek: "35", lohn_multi: lm, minutes: "", fremd_vk: "", geraet_vk: "", discount_pct: "",
        };
      });
      setO((p: any) => ({
        ...p,
        subject: p.subject || res.meta.boqLabel || res.meta.projectLabel || "",
        items: [...(p.items || []), ...imported],
      }));
      setMsg(`GAEB importiert: ${res.meta.titelCount} Titel, ${res.meta.posCount} Positionen. Bitte Preise kalkulieren.`);
    } catch (e: any) {
      setMsg("GAEB-Import fehlgeschlagen: " + (e?.message || String(e)));
    }
  }

  function exportGaeb() {
    try {
      if (!o.items.some((x: any) => x.kind === "position")) { setMsg("Keine Positionen zum Export vorhanden."); return; }
      downloadGaebX84(o);
    } catch (e: any) {
      setMsg("GAEB-Export fehlgeschlagen: " + (e?.message || String(e)));
    }
  }

  async function deleteOffer(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Dokument wirklich löschen?")) return;
    const { error } = await supabase.from("office_offers").delete().eq("id", id);
    if (error) { setMsg("Fehler beim Löschen: " + error.message); return; }
    await loadOffers();
  }

  const t = offerTotals(o.items, o);

  // ── Einstellungen ────────────────────────────────────────────────
  if (mode === "settings") {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xl font-bold">⚙️ Angebots-Einstellungen</h2>
          <button type="button" onClick={() => setMode("list")} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">Zurück</button>
        </div>
        {msg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{msg}</div>}
        <div className="flex flex-wrap gap-2">
          {[{ k: "allgemein", l: "Allgemein" }, { k: "rabatt", l: "Rabatt & Skonto" }, { k: "steuer", l: "Steuer / Recht" }, { k: "texte", l: "Texte & Zahlung" }].map((tb) => (
            <button key={tb.k} type="button" onClick={() => setSettingsTab(tb.k)} className={`px-4 py-2 rounded-full text-sm font-medium ${settingsTab === tb.k ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>{tb.l}</button>
          ))}
        </div>
        {settingsTab === "allgemein" && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Diese Werte werden bei jedem neuen Angebot automatisch übernommen.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
              <label className="flex flex-col text-sm">Standard-Multi Material<input className="border p-2 rounded-lg text-black bg-white" value={settings.def_mat_multi} onChange={(e) => setSettings((x: any) => ({ ...x, def_mat_multi: e.target.value }))} /></label>
              <label className="flex flex-col text-sm">Standard-Multi Lohn<input className="border p-2 rounded-lg text-black bg-white" value={settings.def_lohn_multi} onChange={(e) => setSettings((x: any) => ({ ...x, def_lohn_multi: e.target.value }))} /></label>
              <label className="flex flex-col text-sm">Bindefrist (Wochen)<input type="number" className="border p-2 rounded-lg text-black bg-white" value={settings.binde_weeks} onChange={(e) => setSettings((x: any) => ({ ...x, binde_weeks: e.target.value }))} /></label>
              <label className="flex flex-col text-sm">MwSt %<input className="border p-2 rounded-lg text-black bg-white" value={settings.vat_rate} onChange={(e) => setSettings((x: any) => ({ ...x, vat_rate: e.target.value }))} /></label>
              <label className="flex flex-col text-sm">Kupfer €/kg (DEL, Standard)<input className="border p-2 rounded-lg text-black bg-white" value={settings.del_preis} onChange={(e) => setSettings((x: any) => ({ ...x, del_preis: e.target.value }))} /></label>
              <label className="flex flex-col text-sm">Standard-Kupfer-Multi<input className="border p-2 rounded-lg text-black bg-white" value={settings.def_kupfer_multi} onChange={(e) => setSettings((x: any) => ({ ...x, def_kupfer_multi: e.target.value }))} /></label>
            </div>
          </div>
        )}
        {settingsTab === "rabatt" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg">
            <label className="flex flex-col text-sm">Rabatt %<input className="border p-2 rounded-lg text-black bg-white" value={settings.def_rabatt_pct} onChange={(e) => setSettings((x: any) => ({ ...x, def_rabatt_pct: e.target.value }))} /></label>
            <label className="flex flex-col text-sm">Nachlass €<input className="border p-2 rounded-lg text-black bg-white" value={settings.def_nachlass} onChange={(e) => setSettings((x: any) => ({ ...x, def_nachlass: e.target.value }))} /></label>
            <label className="flex flex-col text-sm">Skonto %<input className="border p-2 rounded-lg text-black bg-white" value={settings.def_skonto_pct} onChange={(e) => setSettings((x: any) => ({ ...x, def_skonto_pct: e.target.value }))} /></label>
            <label className="flex flex-col text-sm">Skonto Tage<input className="border p-2 rounded-lg text-black bg-white" value={settings.def_skonto_tage} onChange={(e) => setSettings((x: any) => ({ ...x, def_skonto_tage: e.target.value }))} /></label>
          </div>
        )}
        {settingsTab === "steuer" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Diese Texte werden ins Angebot übernommen, wenn du dort den jeweiligen Steuerfall auswählst.</p>
            <label className="flex flex-col text-sm">Photovoltaik 0 % (§ 12 Abs. 3 UStG)<textarea className="border p-2 rounded-lg text-black bg-white" rows={2} value={settings.pv_text} onChange={(e) => setSettings((x: any) => ({ ...x, pv_text: e.target.value }))} /></label>
            <label className="flex flex-col text-sm">Bauleistung § 13b UStG (Reverse Charge)<textarea className="border p-2 rounded-lg text-black bg-white" rows={2} value={settings.b13_text} onChange={(e) => setSettings((x: any) => ({ ...x, b13_text: e.target.value }))} /></label>
          </div>
        )}
        {settingsTab === "texte" && (
          <div className="space-y-2">
            <label className="flex flex-col text-sm">Vortext (Einleitung)<textarea className="border p-2 rounded-lg text-black bg-white" rows={3} value={settings.vortext} onChange={(e) => setSettings((x: any) => ({ ...x, vortext: e.target.value }))} /></label>
            <label className="flex flex-col text-sm">Nachtext (Schluss)<textarea className="border p-2 rounded-lg text-black bg-white" rows={3} value={settings.nachtext} onChange={(e) => setSettings((x: any) => ({ ...x, nachtext: e.target.value }))} /></label>
            <div className="text-sm font-medium pt-1">Zahlungsbedingungen (Standard)</div>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <input className="border p-1.5 rounded w-16 text-black bg-white" value={settings.pay1_pct} onChange={(e) => setSettings((x: any) => ({ ...x, pay1_pct: e.target.value }))} /> % bei Auftragserteilung,
              <input className="border p-1.5 rounded w-16 text-black bg-white" value={settings.pay2_pct} onChange={(e) => setSettings((x: any) => ({ ...x, pay2_pct: e.target.value }))} /> % bei Auftragsbeginn,
              <input className="border p-1.5 rounded w-16 text-black bg-white" value={settings.pay3_pct} onChange={(e) => setSettings((x: any) => ({ ...x, pay3_pct: e.target.value }))} /> % bei Auftragsabschluss
            </div>
            <p className="text-xs text-gray-500">Skonto wird aus dem Reiter „Rabatt & Skonto" übernommen.</p>
            <div className="pt-2 border-t space-y-2">
              <div className="text-sm font-medium">Textbausteine (mehrere Vor-/Nachtexte)</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start">
                <select value={tmKind} onChange={(e) => setTmKind(e.target.value)} className="border p-2 rounded-lg text-black bg-white text-sm"><option value="vor">Vortext</option><option value="nach">Nachtext</option></select>
                <input value={tmTitle} onChange={(e) => setTmTitle(e.target.value)} placeholder="Titel" className="border p-2 rounded-lg text-black bg-white text-sm" />
                <textarea value={tmBody} onChange={(e) => setTmBody(e.target.value)} placeholder="Text" rows={2} className="border p-2 rounded-lg text-black bg-white text-sm md:col-span-2" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveTextModule} className="bg-cyan-700 text-white px-3 py-1.5 rounded-lg text-xs">{tmEditId ? "Baustein speichern" : "Baustein anlegen"}</button>
                {tmEditId && <button type="button" onClick={() => { setTmEditId(null); setTmTitle(""); setTmBody(""); }} className="bg-gray-200 px-3 py-1.5 rounded-lg text-xs">Abbrechen</button>}
              </div>
              <div className="space-y-1">
                {textModules.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg p-2 text-sm bg-white">
                    <div className="min-w-0"><span className="text-xs bg-slate-100 rounded px-1.5 py-0.5">{m.kind === "vor" ? "Vortext" : "Nachtext"}</span> <strong>{m.title || "(ohne Titel)"}</strong> <span className="text-gray-500">{String(m.body || "").slice(0, 50)}</span></div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => { setTmEditId(m.id); setTmKind(m.kind); setTmTitle(m.title || ""); setTmBody(m.body || ""); }} className="text-xs px-2 py-1 rounded bg-white border">✏️</button>
                      <button type="button" onClick={() => deleteTextModule(m.id)} className="text-xs px-2 py-1 rounded bg-white border text-red-600">🗑️</button>
                    </div>
                  </div>
                ))}
                {textModules.length === 0 && <p className="text-xs text-gray-500">Noch keine Bausteine.</p>}
              </div>
            </div>
          </div>
        )}
        <button type="button" onClick={saveSettings} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">💾 Einstellungen speichern</button>
      </section>
    );
  }

  // ── Liste ────────────────────────────────────────────────────────
  if (mode === "list") {
    const docType = (r: any) => r.doc_type || "angebot";
    const listRows = offers.filter((r: any) => docType(r) === docFilter);
    const byId = new Map(offers.map((r: any) => [r.id, r]));
    const parentRef = (r: any) => {
      if (!r.parent_id) return null;
      const p: any = byId.get(r.parent_id);
      return p ? `aus ${DOC_LABEL[docType(p)]} ${p.number || "(ohne Nr.)"}` : "aus gelöschtem Dokument";
    };
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xl font-bold">{DOC_ICON[docFilter]} {DOC_LABEL_PLURAL[docFilter]} <span className="text-sm font-normal text-gray-500">({listRows.length})</span></h2>
          <div className="flex gap-2">
            {docFilter === "angebot" && (<>
              <button type="button" onClick={() => { setArchOpen((p) => !p); if (archCount === null) loadArchCount(); }} className="bg-slate-500 text-white px-4 py-2 rounded-lg text-sm" title="Alt-Angebote aus Taifun als Preisgedächtnis importieren">🗄️ Preisarchiv</button>
              <button type="button" onClick={() => { setMode("settings"); setMsg(""); }} className="bg-slate-600 text-white px-4 py-2 rounded-lg text-sm">⚙️ Einstellungen</button>
              <button type="button" onClick={startNew} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">＋ Neues Angebot</button>
            </>)}
          </div>
        </div>
        {msg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{msg}</div>}

        {/* Stufe 9b: Taifun-Preisarchiv (Import der Alt-Angebote) */}
        {archOpen && docFilter === "angebot" && (
          <div className="border border-slate-200 rounded-2xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-bold">🗄️ Preisarchiv <span className="text-sm font-normal text-gray-500">{archCount === null ? "" : `(${archCount.toLocaleString("de-DE")} Alt-Positionen)`}</span></h3>
              <div className="flex gap-2">
                <label className={`px-3 py-2 rounded-lg text-sm cursor-pointer text-white ${archBusy ? "bg-gray-300" : "bg-emerald-700"}`}>⬆ Taifun-Excel importieren
                  <input type="file" multiple accept=".xlsx,.xls" className="hidden" disabled={archBusy} onChange={(e) => { importTaifunFiles(e.target.files); e.currentTarget.value = ""; }} />
                </label>
                {(archCount ?? 0) > 0 && <button type="button" onClick={clearArchive} disabled={archBusy} className="bg-red-600 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm">🗑️ Archiv leeren</button>}
                <button type="button" onClick={() => setArchOpen(false)} className="bg-gray-200 px-3 py-2 rounded-lg text-sm">Schließen</button>
              </div>
            </div>
            {archMsg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{archMsg}</div>}
            <p className="text-xs text-gray-500">Erwartet Taifun-Excel-Exporte im Format der Kalkulationstabelle (Spalten Position, Menge, Beschreibung, Mat.-Ek, Mat.-Multi, Std.Lohn, min, …) — mehrere Dateien auf einmal möglich. Titel- und reine Textzeilen werden übersprungen. Im Angebots-Editor holt „💡 Preise vorschlagen" dann für unkalkulierte Positionen die ähnlichste Alt-Position.</p>
          </div>
        )}
        <div className="space-y-2">
          {listRows.map((row: any) => (
            <div key={row.id} className="border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <strong>{row.number || "(ohne Nr.)"}</strong>{row.subject ? <span> · {row.subject}</span> : null}
                {row.customer_name ? <div className="text-gray-600">{row.customer_name}</div> : null}
                <div className="text-gray-500 text-xs">
                  {row.status} · Brutto {fmt(num(row.gross_total))} €
                  {parentRef(row) ? <span className="ml-1 text-cyan-700">· {parentRef(row)}</span> : null}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {docType(row) === "angebot" && (
                  <button type="button" onClick={() => deriveDoc(row, "ab")} title="Auftragsbestätigung aus diesem Angebot erzeugen" className="bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm">→ 📋 AB</button>
                )}
                {(docType(row) === "angebot" || docType(row) === "ab") && (
                  <button type="button" onClick={() => deriveDoc(row, "rechnung")} title="Rechnung aus diesem Dokument erzeugen" className="bg-emerald-800 text-white px-3 py-2 rounded-lg text-sm">→ 💶 Rechnung</button>
                )}
                <button type="button" onClick={() => duplicateDoc(row)} title="Als Vorlage duplizieren" className="bg-slate-600 text-white px-3 py-2 rounded-lg text-sm">⧉</button>
                <button type="button" onClick={() => editOffer(row)} className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm">✏️ Öffnen</button>
                <button type="button" onClick={() => deleteOffer(row.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm">🗑️</button>
              </div>
            </div>
          ))}
          {listRows.length === 0 && <p className="text-gray-600">{docFilter === "angebot" ? "Noch keine Angebote." : `Noch keine ${DOC_LABEL_PLURAL[docFilter]} – entstehen über „→“ aus einem Angebot${docFilter === "rechnung" ? " oder einer AB" : ""}.`}</p>}
        </div>
      </section>
    );
  }

  // ── Editor ───────────────────────────────────────────────────────
  const q = custSearch.trim().toLowerCase();
  const custMatches = q ? customers.filter((k: any) => [k.name, k.debitor, k.kreditor, k.city, k.zip, k.phone, k.mobile].some((x: any) => String(x || "").toLowerCase().includes(q))).slice(0, 20) : [];
  const aq = artSearch.trim().toLowerCase();
  const artCategories = Array.from(new Set(articles.map((a: any) => String(a.category || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  const artMatches = articles
    .filter((a: any) => (a.art || "leistung") === (isOwnSrc(artSource) ? artSource : "")) // Alt-Daten ohne art zählen als Leistung
    .filter((a: any) => (artCat ? String(a.category || "").trim() === artCat : true))
    .filter((a: any) => (aq ? [a.number, a.short_text, a.long_text, a.category].some((x: any) => String(x || "").toLowerCase().includes(aq)) : true))
    .slice(0, 100);
  const cartCount = Object.keys(cart).length;
  const pickerRows: any[] = isOwnSrc(artSource) ? artMatches : supResults;

  const dt = o.doc_type || "angebot";
  const parentRow: any = o.parent_id ? offers.find((r: any) => r.id === o.parent_id) : null;
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-bold">{DOC_ICON[dt]} {o.id ? `${DOC_LABEL[dt]} bearbeiten` : DOC_LABEL_NEW[dt]}</h2>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={saveOffer} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">💾 Speichern</button>
          {dt === "angebot" && (<>
            <button type="button" onClick={pdfOffer} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm">📄 PDF</button>
            <button type="button" onClick={efbPdf} className="bg-slate-600 text-white px-4 py-2 rounded-lg text-sm" title="EFB-Preisformblätter 221/222/223">📑 EFB</button>
            <button type="button" disabled={!o.id} onClick={() => deriveDoc(o, "ab")} title={o.id ? "Auftragsbestätigung aus diesem Angebot erzeugen" : "Zuerst speichern, dann AB erzeugen"} className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">→ 📋 AB</button>
          </>)}
          {dt === "ab" && (
            <button type="button" onClick={pdfAb} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm" title="Auftragsbestätigung als PDF">📄 PDF</button>
          )}
          {dt === "rechnung" && (
            <button type="button" onClick={pdfRechnung} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm" title="Rechnung als PDF">📄 PDF</button>
          )}
          {(dt === "angebot" || dt === "ab") && (
            <button type="button" disabled={!o.id} onClick={() => deriveDoc(o, "rechnung")} title={o.id ? "Rechnung aus diesem Dokument erzeugen" : "Zuerst speichern, dann Rechnung erzeugen"} className="bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">→ 💶 Rechnung</button>
          )}
          <button type="button" onClick={() => { setMode("list"); loadOffers(); }} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">Zurück zur Liste</button>
        </div>
      </div>
      {msg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{msg}</div>}
      {o.parent_id ? (
        <div className="text-sm text-gray-600 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
          🔗 Erstellt aus {parentRow ? `${DOC_LABEL[parentRow.doc_type || "angebot"]} ${parentRow.number || "(ohne Nr.)"}` : "einem gelöschten Dokument"}
          {parentRow ? <button type="button" onClick={() => editOffer(parentRow)} className="ml-2 text-cyan-700 underline">öffnen</button> : null}
        </div>
      ) : null}

      {/* Kopf */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-200 rounded-xl p-3 bg-gray-50">
        <input className="border p-2 rounded-lg text-black bg-white" placeholder={`${DOC_LABEL[dt]}snummer (Start später automatisch)`} value={o.number} onChange={(e) => set("number", e.target.value)} />
        <input className="border p-2 rounded-lg text-black bg-white" placeholder="Betreff / Projekt" value={o.subject} onChange={(e) => set("subject", e.target.value)} />
        {dt === "angebot" ? (
          <label className="text-sm text-gray-600 flex items-center gap-2">Datum <input type="date" className="border p-2 rounded-lg text-black bg-white flex-1" value={o.offer_date || ""} onChange={(e) => set("offer_date", e.target.value)} /></label>
        ) : (
          <label className="text-sm text-gray-600 flex items-center gap-2">Belegdatum <input type="date" className="border p-2 rounded-lg text-black bg-white flex-1" value={o.doc_date || ""} onChange={(e) => set("doc_date", e.target.value)} /></label>
        )}
        <label className="text-sm text-gray-600 flex items-center gap-2">Status
          <select className="border p-2 rounded-lg text-black bg-white flex-1" value={o.status || "entwurf"} onChange={(e) => set("status", e.target.value)}>
            {(DOC_STATUS[dt] || DOC_STATUS.angebot).concat((DOC_STATUS[dt] || []).includes(o.status) || !o.status ? [] : [o.status]).map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        {dt === "angebot" && (
          <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap md:col-span-2">Bindefrist <input type="number" className="border p-2 rounded-lg text-black bg-white w-20" value={o.binde_weeks} onChange={(e) => set("binde_weeks", e.target.value)} /> Wochen <span className="text-gray-500">→ gültig bis {o.binde_weeks && o.offer_date ? fmtDate(addWeeks(o.offer_date, num(o.binde_weeks))) : "—"}</span></div>
        )}
        {dt === "rechnung" && (<>
          <label className="text-sm text-gray-600 flex items-center gap-2">Leistung von <input type="date" className="border p-2 rounded-lg text-black bg-white flex-1" value={o.leistung_von || ""} onChange={(e) => set("leistung_von", e.target.value)} /></label>
          <label className="text-sm text-gray-600 flex items-center gap-2">Leistung bis <input type="date" className="border p-2 rounded-lg text-black bg-white flex-1" value={o.leistung_bis || ""} onChange={(e) => set("leistung_bis", e.target.value)} /></label>
          <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap md:col-span-2">Zahlungsziel <input type="number" className="border p-2 rounded-lg text-black bg-white w-20" value={o.zahlungsziel_tage} onChange={(e) => set("zahlungsziel_tage", e.target.value)} /> Tage <span className="text-gray-500">→ fällig am {o.zahlungsziel_tage && o.doc_date ? fmtDate(addWeeks(o.doc_date, num(o.zahlungsziel_tage) / 7)) : "—"}</span></div>
        </>)}
      </div>

      {/* Kalkulations-Standard */}
      <div className="border border-slate-200 rounded-xl p-3 bg-gray-50 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">🧮 Standard-Multiplikatoren:</span>
        <label className="text-sm flex items-center gap-1">Material <input className="border p-1.5 rounded text-black bg-white w-20" value={o.def_mat_multi} onChange={(e) => set("def_mat_multi", e.target.value)} /></label>
        <label className="text-sm flex items-center gap-1">Lohn <input className="border p-1.5 rounded text-black bg-white w-20" value={o.def_lohn_multi} onChange={(e) => set("def_lohn_multi", e.target.value)} /></label>
        <button type="button" onClick={applyMultisToAll} className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs">Auf alle Positionen übernehmen</button>
        <span className="mx-1 text-slate-300">|</span>
        <label className="text-sm flex items-center gap-1" title="Tages-Kupferpreis (DEL) in € pro kg — für den Kupferzuschlag bei Kabeln">🟠 Kupfer €/kg <input className="border p-1.5 rounded text-black bg-white w-24" value={o.del_preis} onChange={(e) => set("del_preis", e.target.value)} /></label>
        <span className="text-xs text-gray-500">Neue Positionen übernehmen die Standard-Werte automatisch.</span>
      </div>

      {/* Kunde */}
      <div className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-sm">👥 Kunde</h3>
          <button type="button" onClick={() => setPickerOpen((v) => !v)} className="text-sm text-cyan-700">{pickerOpen ? "▼" : "▶"} Kunde auswählen</button>
        </div>
        {o.customer_name ? (
          <div className="text-sm">
            <strong>{o.customer_name}</strong>
            {o.customer_anrede ? <div className="text-gray-600">{o.customer_anrede}</div> : null}
            <div className="text-gray-600">{[o.customer_street, [o.customer_zip, o.customer_city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div>
          </div>
        ) : <p className="text-sm text-gray-500">Noch kein Kunde gewählt.</p>}
        {pickerOpen && (
          <div className="space-y-1">
            <input className="border p-2 rounded-lg text-black bg-white w-full" placeholder="Suche: Name, Nr., Ort, Telefon…" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
            {custMatches.map((k: any) => (
              <button key={k.id} type="button" onClick={() => pickCustomer(k)} className="w-full text-left border border-slate-200 rounded-lg p-2 text-sm bg-white hover:bg-cyan-50">
                <strong>{k.name}</strong>{k.customer_no ? <span className="text-gray-500"> · {k.customer_no}</span> : null}
                {(k.zip || k.city) ? <span className="text-gray-600"> · {[k.zip, k.city].filter(Boolean).join(" ")}</span> : null}
              </button>
            ))}
            {q && custMatches.length === 0 && <p className="text-xs text-gray-500">Kein Kunde gefunden.</p>}
          </div>
        )}
      </div>

      {/* Vortext */}
      <div className="border border-slate-200 rounded-xl p-3 bg-gray-50">
        <label className="text-sm font-medium">Vortext (Einleitung)</label>
        {textModules.filter((m: any) => m.kind === "vor").length > 0 && (
          <select className="border p-1.5 rounded-lg text-black bg-white text-sm mt-1 mr-2" value="" onChange={(e) => { const m = textModules.find((x: any) => x.id === e.target.value); if (m) set("vortext", m.body || ""); }}>
            <option value="">Vortext-Baustein wählen…</option>
            {textModules.filter((m: any) => m.kind === "vor").map((m: any) => <option key={m.id} value={m.id}>{m.title || "(ohne Titel)"}</option>)}
          </select>
        )}
        <textarea className="border p-2 rounded-lg text-black bg-white w-full mt-1 text-sm" rows={3} value={o.vortext} onChange={(e) => set("vortext", e.target.value)} />
      </div>

      {/* Positionen */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-sm">Positionen</h3>
          <button type="button" onClick={() => addItem("titel")} className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs">＋ Titel</button>
          <button type="button" onClick={() => addItem("position")} className="bg-cyan-700 text-white px-3 py-1.5 rounded-lg text-xs">＋ Position</button>
          <button type="button" onClick={() => addItem("text")} className="bg-gray-500 text-white px-3 py-1.5 rounded-lg text-xs">＋ Textposition</button>
          <label className="bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs cursor-pointer">⬆ GAEB (X83) importieren
            <input type="file" accept=".x83,.X83,.xml,.X81,.x81" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importGaeb(f); e.target.value = ""; }} />
          </label>
          <button type="button" onClick={exportGaeb} className="bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs">⬇ GAEB (X84) exportieren</button>
          <button type="button" onClick={openArtPicker} className="bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs">📦 aus Artikelstamm</button>
          <button type="button" onClick={suggestPrices} className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs" title="Unkalkulierte Positionen mit der ähnlichsten Alt-Position aus dem Taifun-Preisarchiv befüllen">💡 Preise vorschlagen</button>
          <button type="button" onClick={suggestPricesAi} disabled={kiBusy} className="bg-purple-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg text-xs" title="Fehlende Werte von der KI schätzen lassen: Material-/Gerät-EK und/oder Minuten je Einheit — nur was leer ist, wird gefüllt. Schätzwerte, bitte prüfen">{kiBusy ? "🤖 schätzt…" : "🤖 Preise durch KI"}</button>
          <button type="button" onClick={() => setPosView((p) => (p === "zeilen" ? "tabelle" : "zeilen"))} className="bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs ml-auto" title="Zwischen Zeilenansicht und Taifun-Kalkulationstabelle wechseln">{posView === "zeilen" ? "📊 Tabelle" : "📋 Zeilen"}</button>
        </div>

        {artPickerOpen && (
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-3 space-y-2">
            {/* Quelle: eigener Artikelstamm oder Lieferanten-Katalog */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium mr-1">Quelle:</span>
              <button type="button" onClick={() => setArtSource("leistung")} className={`px-2.5 py-1 rounded-full text-xs font-medium ${artSource === "leistung" ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>🔧 Leistungen</button>
              <button type="button" onClick={() => setArtSource("artikel")} className={`px-2.5 py-1 rounded-full text-xs font-medium ${artSource === "artikel" ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>📦 Artikel</button>
              {suppliers.map((s: any) => (
                <button key={s.id} type="button" onClick={() => setArtSource(s.id)} className={`px-2.5 py-1 rounded-full text-xs font-medium ${artSource === s.id ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>🏭 {s.name}</button>
              ))}
              <button type="button" onClick={() => { setArtPickerOpen(false); setCart({}); }} className="bg-gray-200 px-3 py-1.5 rounded-lg text-xs ml-auto">Schließen</button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input className="border p-2 rounded-lg text-black bg-white flex-1 min-w-[12rem] text-sm" placeholder={isOwnSrc(artSource) ? "Suche: Nr., Kurztext, Kategorie…" : "Suche im Katalog: Artikelnummer oder Bezeichnung…"} value={artSearch} onChange={(e) => setArtSearch(e.target.value)} />
              {isOwnSrc(artSource) && artCategories.length > 0 && (
                <select className="border p-2 rounded-lg text-black bg-white text-sm" value={artCat} onChange={(e) => setArtCat(e.target.value)}>
                  <option value="">Alle Kategorien</option>
                  {artCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {!isOwnSrc(artSource) && supLoading && <span className="text-xs text-gray-500">sucht…</span>}
            </div>
            {!isOwnSrc(artSource) && (() => {
              const sup = suppliers.find((x: any) => x.id === artSource);
              const cnt = Math.round(num(sup?.article_count));
              if (supErr) return <div className="text-xs text-red-600">Fehler bei der Suche: {supErr}</div>;
              if (cnt === 0) return <div className="text-xs text-amber-700">Für „{sup?.name}“ sind noch keine Katalog-Artikel importiert (evtl. nur Preise/Rabatte). Bitte die Artikel-/Preisdatei (z. B. Datpreis.001) unter „📦 Artikel → 🏭 Lieferanten-Kataloge“ importieren.</div>;
              return <div className="text-xs text-gray-500">Katalog: {cnt.toLocaleString("de-DE")} Artikel</div>;
            })()}
            <div className="max-h-72 overflow-y-auto space-y-1">
              {pickerRows.map((a: any) => {
                const inCart = a.id in cart;
                const it = calcItem(articleToItem(a, "1", o.def_mat_multi, o.def_lohn_multi, settings.def_kupfer_multi), num(o.del_preis));
                const isSup = "ek" in a;
                return (
                  <div key={a.id} className={`flex items-center gap-2 border rounded-lg p-2 text-sm ${inCart ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}>
                    <input type="checkbox" checked={inCart} onChange={() => toggleCart(a)} title="in Warenkorb" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.category ? <span className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{a.category}</span> : null}
                        {(a.number || a.article_no) ? <span className="text-xs text-gray-500">Nr. {a.number || a.article_no}</span> : null}
                        <strong>{a.short_text || (isSup && a.article_no ? "Art. " + a.article_no : "(ohne Kurztext)")}</strong>
                      </div>
                      <div className="text-xs text-gray-500">
                        {isSup ? <>EK {a.ek != null ? fmt(num(a.ek)) + " €" : "—"} → </> : null}EP ca. {fmt(it.ep)} € · {a.unit || "St"}
                      </div>
                    </div>
                    {inCart && <input value={cart[a.id].qty} onChange={(e) => setCartQty(a.id, e.target.value)} className="border p-1 rounded w-16 text-right text-black bg-white text-sm" title="Menge" />}
                    <button type="button" onClick={() => addArticleSingle(a)} className="bg-cyan-700 text-white px-2 py-1 rounded text-xs whitespace-nowrap">＋ einzeln</button>
                  </div>
                );
              })}
              {pickerRows.length === 0 && (
                <p className="text-xs text-gray-500">
                  {artSource === "leistung"
                    ? "Keine Leistung gefunden. Leistungen im Reiter „🔧 Leistungen“ anlegen."
                    : artSource === "artikel"
                    ? "Kein Artikel gefunden. Artikel im Reiter „📦 Artikel“ anlegen."
                    : supLoading ? "Suche läuft…" : artSearch.trim() ? "Kein Treffer – bei Katalogen ohne Bezeichnung nach Artikelnummer suchen." : "Suchbegriff eingeben (Artikelnummer oder Bezeichnung)."}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">{cartCount} im Warenkorb</span>
              <button type="button" onClick={addCartToOffer} disabled={cartCount === 0} className="bg-emerald-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg text-xs">Warenkorb übernehmen ({cartCount})</button>
            </div>
          </div>
        )}

        {/* 💡 Offene Vorschläge: Kandidaten stehen direkt unter der jeweiligen Position */}
        {sugList.length > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-sm">
            <span>💡 <strong>{sugList.length}</strong> Position{sugList.length === 1 ? "" : "en"} mit offenen Vorschlägen — die Kandidaten stehen direkt unter der Position, anklicken = übernehmen.</span>
            <button type="button" onClick={() => setSugList([])} className="bg-gray-200 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">Alle überspringen</button>
          </div>
        )}

        {/* Stufe 9a: Taifun-Kalkulationstabelle (umschaltbar) */}
        {posView === "tabelle" && (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full min-w-[1150px] text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  {["Pos", "Menge", "Einh", "Beschreibung", "Mat-Ek", "Mat-Multi", "Mat-Vk", "Std.Lohn", "min", "Lohn-Vk", "Fremd-Vk", "Gerät-Vk", "E-Preis", "G-Preis", ""].map((h) => (
                    <th key={h} className={`px-1.5 py-1.5 font-semibold whitespace-nowrap ${["Mat-Ek", "Mat-Multi", "Mat-Vk", "Std.Lohn", "min", "Lohn-Vk", "Fremd-Vk", "Gerät-Vk", "E-Preis", "G-Preis", "Menge"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {o.items.map((raw: any, idx: number) => {
                  const it = calcItem(raw, num(o.del_preis));
                  const tin = "border p-1 rounded text-black bg-white w-full";
                  if (it.kind === "titel") {
                    return (
                      <tr key={it.id} className="border-t border-slate-200 bg-slate-50">
                        <td className="px-1 py-1 w-16"><input className={tin} value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} /></td>
                        <td colSpan={2} className="px-1.5 text-slate-500">Titel</td>
                        <td colSpan={9} className="px-1 py-1"><input className={`${tin} font-bold`} placeholder="Titel / Überschrift" value={it.title} onChange={(e) => setItem(it.id, "title", e.target.value)} /></td>
                        <td className="px-1.5 text-right" />
                        <td className="px-1.5 text-right font-bold whitespace-nowrap">{fmt(titleSum(o.items, idx, num(o.del_preis)))}</td>
                        <td className="px-1 py-1 whitespace-nowrap">{itemButtons(it.id)}</td>
                      </tr>
                    );
                  }
                  if (it.kind === "text") {
                    return (
                      <tr key={it.id} className="border-t border-slate-200">
                        <td className="px-1 py-1 w-16"><input className={tin} value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} /></td>
                        <td colSpan={2} className="px-1.5 text-slate-400">Text</td>
                        <td colSpan={11} className="px-1 py-1">
                          <input className={tin} placeholder="Kurztext (Textposition)" value={it.short_text} onChange={(e) => setItem(it.id, "short_text", e.target.value)} />
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap">{itemButtons(it.id)}</td>
                      </tr>
                    );
                  }
                  const epFixed = String(it.ep_fix ?? "").trim() !== "";
                  const sugg = suggBlockFor(it.id);
                  return (
                    <Fragment key={it.id}>
                    <tr className={`border-t border-slate-200 ${it.suggest_note ? "bg-amber-50/60" : ""}`}>
                      <td className="px-1 py-1 w-16"><input className={tin} value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} /></td>
                      <td className="px-1 py-1 w-16"><input className={`${tin} text-right`} value={it.qty} onChange={(e) => setItem(it.id, "qty", e.target.value)} /></td>
                      <td className="px-1 py-1 w-16">
                        <select className="border p-1 rounded text-black bg-white w-full" value={it.unit} onChange={(e) => setItem(it.id, "unit", e.target.value)}>
                          {(it.unit && !UNITS.includes(it.unit) ? [it.unit, ...UNITS] : UNITS).map((u: string) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1 min-w-[16rem]">
                        <div className="flex items-center gap-1">
                          {it.suggest_note ? <span title={it.suggest_note}>{String(it.suggest_note).includes("🤖") ? "🤖" : "💡"}</span> : null}
                          <input className={`${tin} font-medium`} placeholder="Kurztext" value={it.short_text} onChange={(e) => setItem(it.id, "short_text", e.target.value)} />
                        </div>
                        {it.long_text ? <div className="text-[10px] text-gray-400 truncate max-w-[24rem]" title={it.long_text}>{String(it.long_text).split("\n")[0]}</div> : null}
                      </td>
                      <td className="px-1 py-1 w-20"><input className={`${tin} text-right`} value={it.mat_ek} onChange={(e) => setItem(it.id, "mat_ek", e.target.value)} /></td>
                      <td className="px-1 py-1 w-16"><input className={`${tin} text-right`} value={it.mat_multi} onChange={(e) => setItem(it.id, "mat_multi", e.target.value)} /></td>
                      <td className="px-1.5 text-right text-gray-500 whitespace-nowrap">{fmt(it.mat_vk)}</td>
                      <td className="px-1 py-1 w-16"><input className={`${tin} text-right`} value={it.lohn_ek} onChange={(e) => setItem(it.id, "lohn_ek", e.target.value)} /></td>
                      <td className="px-1 py-1 w-16"><input className={`${tin} text-right`} value={it.minutes} onChange={(e) => setItem(it.id, "minutes", e.target.value)} /></td>
                      <td className="px-1.5 text-right text-gray-500 whitespace-nowrap">{fmt(it.lohn_vk)}</td>
                      <td className="px-1 py-1 w-16"><input disabled={String(it.fremd_ek ?? "") !== ""} title={String(it.fremd_ek ?? "") !== "" ? `Aus Fremd-Ek ${it.fremd_ek} × Multi (in der Zeilenansicht aufklappen)` : "Fremd-Vk direkt — oder Fremd-Ek in der Zeilenansicht"} className={`border p-1 rounded text-right w-full ${String(it.fremd_ek ?? "") !== "" ? "bg-gray-100 text-black" : "bg-white text-black"}`} value={String(it.fremd_ek ?? "") !== "" ? fmt(it.fremd_vk_eff) : it.fremd_vk} onChange={(e) => setItem(it.id, "fremd_vk", e.target.value)} /></td>
                      <td className="px-1 py-1 w-16"><input disabled={String(it.geraet_ek ?? "") !== ""} title={String(it.geraet_ek ?? "") !== "" ? `Aus Gerät-Ek ${it.geraet_ek} × Multi (in der Zeilenansicht aufklappen)` : "Gerät-Vk direkt — oder Gerät-Ek in der Zeilenansicht"} className={`border p-1 rounded text-right w-full ${String(it.geraet_ek ?? "") !== "" ? "bg-gray-100 text-black" : "bg-white text-black"}`} value={String(it.geraet_ek ?? "") !== "" ? fmt(it.geraet_vk_eff) : it.geraet_vk} onChange={(e) => setItem(it.id, "geraet_vk", e.target.value)} /></td>
                      <td className="px-1 py-1 w-20">
                        <input className={`border p-1 rounded text-right w-full ${epFixed ? "bg-amber-50 border-amber-400 text-black font-medium" : "bg-white text-black"}`} placeholder={fmt(it.ep)} title="E-Preis: Zahl eintippen = fester Preis. Feld leeren = automatisch." value={it.ep_fix ?? ""} onChange={(e) => setItem(it.id, "ep_fix", e.target.value)} />
                      </td>
                      <td className="px-1.5 text-right font-bold whitespace-nowrap">{fmt(it.gp)}</td>
                      <td className="px-1 py-1 whitespace-nowrap">{itemButtons(it.id)}</td>
                    </tr>
                    {sugg && <tr><td colSpan={15} className="p-0">{sugg}</td></tr>}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {o.items.length === 0 && <p className="text-gray-500 text-sm p-3">Noch keine Positionen.</p>}
          </div>
        )}

        {posView === "zeilen" && o.items.map((raw: any, idx: number) => {
          const it = calcItem(raw, num(o.del_preis));
          const opened = !!openItem[it.id];
          if (it.kind === "titel") {
            return (
              <div key={it.id} className="border-l-4 border-slate-700 bg-slate-50 rounded-r-lg p-2 flex items-center gap-2">
                <input className="border p-1.5 rounded text-black bg-white w-16 text-sm" placeholder="Pos" value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} />
                <input className="border p-1.5 rounded text-black bg-white flex-1 text-sm font-bold" placeholder="Titel / Überschrift" value={it.title} onChange={(e) => setItem(it.id, "title", e.target.value)} />
                <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{fmt(titleSum(o.items, idx, num(o.del_preis)))} €</span>
                {itemButtons(it.id)}
              </div>
            );
          }
          if (it.kind === "text") {
            return (
              <div key={it.id} className="border border-slate-200 rounded-lg p-2 bg-white space-y-1">
                <div className="flex items-center gap-2">
                  <input className="border p-1.5 rounded text-black bg-white w-16 text-sm" placeholder="Pos" value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} />
                  <input className="border p-1.5 rounded text-black bg-white flex-1 text-sm" placeholder="Kurztext (Textposition)" value={it.short_text} onChange={(e) => setItem(it.id, "short_text", e.target.value)} />
                  {itemButtons(it.id)}
                </div>
                <textarea className="border p-1.5 rounded text-black bg-white w-full text-sm" rows={2} placeholder="Langtext" value={it.long_text} onChange={(e) => setItem(it.id, "long_text", e.target.value)} />
              </div>
            );
          }
          // Position
          return (
            <div key={it.id} className="border border-slate-200 rounded-lg bg-white">
              <div className="flex items-center gap-2 p-2">
                <button type="button" onClick={() => setOpenItem((p) => ({ ...p, [it.id]: !p[it.id] }))} className="text-gray-400 text-sm">{opened ? "▼" : "▶"}</button>
                <input className="border p-1.5 rounded text-black bg-white w-16 text-sm" placeholder="Pos" value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} />
                <input className="border p-1.5 rounded text-black bg-white w-16 text-sm text-right" placeholder="Menge" value={it.qty} onChange={(e) => setItem(it.id, "qty", e.target.value)} />
                <select className="border p-1.5 rounded text-black bg-white w-20 text-sm" value={it.unit} onChange={(e) => setItem(it.id, "unit", e.target.value)}>
                  {(it.unit && !UNITS.includes(it.unit) ? [it.unit, ...UNITS] : UNITS).map((u: string) => <option key={u} value={u}>{u}</option>)}
                </select>
                {it.suggest_note ? <span className="text-sm" title={it.suggest_note}>{String(it.suggest_note).includes("🤖") ? "🤖" : "💡"}</span> : null}
                <input className="border p-1.5 rounded text-black bg-white flex-1 text-sm font-medium" placeholder="Kurztext" value={it.short_text} onChange={(e) => setItem(it.id, "short_text", e.target.value)} />
                <input
                  className={`border p-1.5 rounded text-sm text-right w-20 ${String(it.ep_fix ?? "").trim() !== "" ? "bg-amber-50 border-amber-400 text-black font-medium" : "bg-white text-black"}`}
                  placeholder={fmt(it.ep)}
                  title="E-Preis: Zahl eintippen = fester Preis (überschreibt die Kalkulation, Feld wird gelb). Feld leeren = wieder automatisch aus EK/Lohn."
                  value={it.ep_fix ?? ""}
                  onChange={(e) => setItem(it.id, "ep_fix", e.target.value)}
                />
                <span className="text-sm font-bold text-right w-24 whitespace-nowrap" title="Gesamtpreis">{fmt(it.gp)} €</span>
                {itemButtons(it.id)}
              </div>
              {suggBlockFor(it.id)}
              {opened && (
                <div className="px-2 pb-2 space-y-2">
                  <textarea className="border p-1.5 rounded text-black bg-white w-full text-sm" rows={2} placeholder="Langtext" value={it.long_text} onChange={(e) => setItem(it.id, "long_text", e.target.value)} />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <label className="flex flex-col">Mat-Ek<input className="border p-1.5 rounded text-black bg-white" value={it.mat_ek} onChange={(e) => setItem(it.id, "mat_ek", e.target.value)} /></label>
                    <label className="flex flex-col">Mat-Multi<input className="border p-1.5 rounded text-black bg-white" value={it.mat_multi} onChange={(e) => setItem(it.id, "mat_multi", e.target.value)} /></label>
                    <label className="flex flex-col text-gray-500">Mat-Vk<input className="border p-1.5 rounded bg-gray-100" value={fmt(it.mat_vk)} readOnly /></label>
                    <label className="flex flex-col">Rabatt %<input className="border p-1.5 rounded text-black bg-white" value={it.discount_pct} onChange={(e) => setItem(it.id, "discount_pct", e.target.value)} /></label>
                    <label className="flex flex-col">Lohn-Ek<input className="border p-1.5 rounded text-black bg-white" value={it.lohn_ek} onChange={(e) => setItem(it.id, "lohn_ek", e.target.value)} /></label>
                    <label className="flex flex-col">Lohn-Multi<input className="border p-1.5 rounded text-black bg-white" value={it.lohn_multi} onChange={(e) => setItem(it.id, "lohn_multi", e.target.value)} /></label>
                    <label className="flex flex-col text-gray-500">Lohn-Satz Vk<input className="border p-1.5 rounded bg-gray-100" value={fmt(it.lohn_satz_vk)} readOnly /></label>
                    <label className="flex flex-col">Minuten<input className="border p-1.5 rounded text-black bg-white" value={it.minutes} onChange={(e) => setItem(it.id, "minutes", e.target.value)} /></label>
                    <label className="flex flex-col text-gray-500">Lohn-Vk<input className="border p-1.5 rounded bg-gray-100" value={fmt(it.lohn_vk)} readOnly /></label>
                    <label className="flex flex-col" title="Einkauf Fremdleistung (Nachunternehmer) je Einheit">Fremd-Ek<input className="border p-1.5 rounded text-black bg-white" value={it.fremd_ek ?? ""} onChange={(e) => setItem(it.id, "fremd_ek", e.target.value)} /></label>
                    <label className="flex flex-col" title="Multiplikator auf den Fremd-Ek. Leer = 1.">Fremd-Multi<input className="border p-1.5 rounded text-black bg-white" placeholder="1" value={it.fremd_multi ?? ""} onChange={(e) => setItem(it.id, "fremd_multi", e.target.value)} /></label>
                    <label className="flex flex-col" title={String(it.fremd_ek ?? "") !== "" ? "Berechnet aus Fremd-Ek × Multi" : "Direkter Vk (nur wenn kein Fremd-Ek eingetragen ist)"}>Fremd-Vk{String(it.fremd_ek ?? "") !== "" ? " (Ek×M)" : ""}<input disabled={String(it.fremd_ek ?? "") !== ""} className={`border p-1.5 rounded text-black ${String(it.fremd_ek ?? "") !== "" ? "bg-gray-100" : "bg-white"}`} value={String(it.fremd_ek ?? "") !== "" ? fmt(it.fremd_vk_eff) : it.fremd_vk} onChange={(e) => setItem(it.id, "fremd_vk", e.target.value)} /></label>
                    <label className="flex flex-col" title="Einkauf Gerät/Miete (z. B. Hebebühne) je Einheit">Gerät-Ek<input className="border p-1.5 rounded text-black bg-white" value={it.geraet_ek ?? ""} onChange={(e) => setItem(it.id, "geraet_ek", e.target.value)} /></label>
                    <label className="flex flex-col" title="Multiplikator auf den Gerät-Ek. Leer = 1.">Gerät-Multi<input className="border p-1.5 rounded text-black bg-white" placeholder="1" value={it.geraet_multi ?? ""} onChange={(e) => setItem(it.id, "geraet_multi", e.target.value)} /></label>
                    <label className="flex flex-col" title={String(it.geraet_ek ?? "") !== "" ? "Berechnet aus Gerät-Ek × Multi" : "Direkter Vk (nur wenn kein Gerät-Ek eingetragen ist)"}>Gerät-Vk{String(it.geraet_ek ?? "") !== "" ? " (Ek×M)" : ""}<input disabled={String(it.geraet_ek ?? "") !== ""} className={`border p-1.5 rounded text-black ${String(it.geraet_ek ?? "") !== "" ? "bg-gray-100" : "bg-white"}`} value={String(it.geraet_ek ?? "") !== "" ? fmt(it.geraet_vk_eff) : it.geraet_vk} onChange={(e) => setItem(it.id, "geraet_vk", e.target.value)} /></label>
                    <label className="flex flex-col text-gray-500">E-Preis{String(it.ep_fix ?? "").trim() !== "" ? " (fest, s. Zeile oben)" : ""}<input className="border p-1.5 rounded bg-gray-100 font-medium" value={fmt(it.ep)} readOnly /></label>
                    <label className="flex flex-col text-gray-500">G-Preis<input className="border p-1.5 rounded bg-gray-100 font-bold" value={fmt(it.gp)} readOnly /></label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs border-t border-slate-100 pt-2">
                    <label className="flex flex-col" title="Preis gilt je … Einheiten (z. B. 100 = Preis pro 100 m). Teilt Material- und Kupferpreis auf die Einheit herunter.">Preiseinheit<input className="border p-1.5 rounded text-black bg-white" value={it.preiseinheit ?? "1"} onChange={(e) => setItem(it.id, "preiseinheit", e.target.value)} /></label>
                    <label className="flex flex-col" title="Verschnitt-Faktor auf das Material (1 = kein Verschnitt, 1.05 = 5 %)">Verschnitt<input className="border p-1.5 rounded text-black bg-white" value={it.verschnitt ?? "1"} onChange={(e) => setItem(it.id, "verschnitt", e.target.value)} /></label>
                    <div className="col-span-2 flex items-end gap-1">
                      <label className="flex flex-col flex-1" title="Kupfergewicht in kg je Preiseinheit (z. B. kg pro 100 m). × Kupfer €/kg × Kupfer-Multi = Kupferzuschlag.">🟠 Kupfer kg<input className="border p-1.5 rounded text-black bg-white w-full" value={it.kupfer_kg ?? ""} onChange={(e) => setItem(it.id, "kupfer_kg", e.target.value)} /></label>
                      <button type="button" onClick={() => { const cu = cuKgPer100m((it.short_text || "") + " " + (it.long_text || "")); if (cu != null) { const pe = num(it.preiseinheit) || 1; setItem(it.id, "kupfer_kg", String(Math.round(cu * pe / 100 * 100) / 100)); } else setMsg("Kein Querschnitt (z. B. 5x16) in der Bezeichnung erkannt."); }} className="bg-slate-600 text-white px-2 py-1 rounded text-xs mb-[1px] whitespace-nowrap" title="Kupfergewicht aus dem Querschnitt in der Bezeichnung schätzen">Cu schätzen</button>
                    </div>
                    <label className="flex flex-col">Kupfer-Multi<input className="border p-1.5 rounded text-black bg-white" value={it.kupfer_multi ?? "1.05"} onChange={(e) => setItem(it.id, "kupfer_multi", e.target.value)} /></label>
                    <label className="flex flex-col text-gray-500" title="Kupferzuschlag je Einheit (fließt in den E-Preis)">Kupfer-Vk<input className="border p-1.5 rounded bg-gray-100" value={fmt(it.kupfer_vk)} readOnly /></label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {o.items.length === 0 && <p className="text-sm text-gray-500">Noch keine Positionen. Füge einen Titel oder eine Position hinzu.</p>}
      </div>

      {/* Steuer / Recht */}
      <div className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-2">
        <span className="text-sm font-medium">Steuer / rechtlicher Hinweis</span>
        <div className="flex flex-col gap-1 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="taxmode" checked={(o.tax_mode || "standard") === "standard"} onChange={() => setTaxMode("standard")} /> Standard ({fmt(num(o.vat_rate || "19"))} % MwSt)</label>
          <label className="flex items-center gap-2"><input type="radio" name="taxmode" checked={o.tax_mode === "pv"} onChange={() => setTaxMode("pv")} /> Photovoltaik 0 % (§ 12 Abs. 3 UStG)</label>
          <label className="flex items-center gap-2"><input type="radio" name="taxmode" checked={o.tax_mode === "b13"} onChange={() => setTaxMode("b13")} /> Bauleistung § 13b UStG (Reverse Charge)</label>
        </div>
        {o.tax_note ? <textarea className="border p-2 rounded-lg text-black bg-white w-full text-sm" rows={2} value={o.tax_note} onChange={(e) => set("tax_note", e.target.value)} /> : null}
      </div>

      {/* Summen */}
      <div className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <label className="flex flex-col">Rabatt %<input className="border p-1.5 rounded text-black bg-white" value={o.rabatt_pct} onChange={(e) => set("rabatt_pct", e.target.value)} /></label>
          <label className="flex flex-col">Nachlass €<input className="border p-1.5 rounded text-black bg-white" value={o.nachlass} onChange={(e) => set("nachlass", e.target.value)} /></label>
          <label className="flex flex-col">Skonto %<input className="border p-1.5 rounded text-black bg-white" value={o.skonto_pct} onChange={(e) => set("skonto_pct", e.target.value)} /></label>
          <label className="flex flex-col">Skonto Tage<input className="border p-1.5 rounded text-black bg-white" value={o.skonto_tage} onChange={(e) => set("skonto_tage", e.target.value)} /></label>
        </div>
        <div className="text-sm space-y-1 max-w-xs ml-auto">
          <div className="flex justify-between"><span>Positionen (netto)</span><span>{fmt(t.net)} €</span></div>
          {t.rabatt > 0 && <div className="flex justify-between text-gray-600"><span>− Rabatt {fmt(num(o.rabatt_pct))} %</span><span>−{fmt(t.rabatt)} €</span></div>}
          {t.nachlass > 0 && <div className="flex justify-between text-gray-600"><span>− Nachlass</span><span>−{fmt(t.nachlass)} €</span></div>}
          <div className="flex justify-between font-medium"><span>Netto-Summe</span><span>{fmt(t.netAfter)} €</span></div>
          <div className="flex justify-between text-gray-600"><span>{fmt(num(o.vat_rate))} % USt.</span><span>{fmt(t.vat)} €</span></div>
          <div className="flex justify-between font-bold text-base border-t pt-1"><span>Gesamt-Betrag</span><span>{fmt(t.gross)} €</span></div>
          {t.skonto > 0 && <div className="flex justify-between text-gray-500 text-xs"><span>Skonto {fmt(num(o.skonto_pct))} % ({num(o.skonto_tage)} Tage)</span><span>−{fmt(t.skonto)} €</span></div>}
        </div>
      </div>
      {/* Nachtext & Zahlungsbedingungen */}
      <div className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-2">
        <label className="text-sm font-medium">Nachtext (Schluss)</label>
        {textModules.filter((m: any) => m.kind === "nach").length > 0 && (
          <select className="border p-1.5 rounded-lg text-black bg-white text-sm" value="" onChange={(e) => { const m = textModules.find((x: any) => x.id === e.target.value); if (m) set("nachtext", m.body || ""); }}>
            <option value="">Nachtext-Baustein wählen…</option>
            {textModules.filter((m: any) => m.kind === "nach").map((m: any) => <option key={m.id} value={m.id}>{m.title || "(ohne Titel)"}</option>)}
          </select>
        )}
        <textarea className="border p-2 rounded-lg text-black bg-white w-full text-sm" rows={3} value={o.nachtext} onChange={(e) => set("nachtext", e.target.value)} />
        <div className="text-sm font-medium pt-1">Zahlungsbedingungen</div>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <input className="border p-1.5 rounded w-16 text-black bg-white" value={o.pay1_pct} onChange={(e) => set("pay1_pct", e.target.value)} /> % bei Auftragserteilung,
          <input className="border p-1.5 rounded w-16 text-black bg-white" value={o.pay2_pct} onChange={(e) => set("pay2_pct", e.target.value)} /> % bei Auftragsbeginn,
          <input className="border p-1.5 rounded w-16 text-black bg-white" value={o.pay3_pct} onChange={(e) => set("pay3_pct", e.target.value)} /> % bei Auftragsabschluss
        </div>
        {num(o.skonto_pct) > 0 && <p className="text-sm text-gray-600">Zahlbar innerhalb {num(o.skonto_tage)} Tagen mit {fmt(num(o.skonto_pct))} % Skonto.</p>}
      </div>
    </section>
  );

  // Hilfs-Renderer für Verschieben/Löschen
  function itemButtons(id: string) {
    return (
      <span className="flex gap-1 shrink-0">
        <button type="button" onClick={() => moveItem(id, -1)} className="text-xs px-1.5 py-1 rounded bg-white border" title="nach oben">▲</button>
        <button type="button" onClick={() => moveItem(id, 1)} className="text-xs px-1.5 py-1 rounded bg-white border" title="nach unten">▼</button>
        <button type="button" onClick={() => removeItem(id)} className="text-xs px-1.5 py-1 rounded bg-white border text-red-600" title="löschen">✕</button>
      </span>
    );
  }
}
