"use client";

import { useEffect, useState } from "react";
import { parseDatanormFiles, type DnResult } from "./datanormParse";

// ── Hilfsfunktionen ────────────────────────────────────────────────
const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: number) => Math.round(n).toLocaleString("de-DE");
const UNITS = ["St", "Stk", "Psch", "m", "lfm", "m²", "m³", "h", "Std", "Tag", "Wo", "Mon", "kg", "t", "g", "l", "Ltr", "Satz", "Paar", "Rolle", "Pkg", "Bund", "Pkt", "kW", "kWp", "A", "V", "%"];

// Kupfergewicht aus dem Querschnitt in der Bezeichnung schaetzen ("5x16", "3G2,5").
// kg/100 m ~ Summe(Adern x mm2) x 0,89 (Cu-Dichte 8,9 g/cm3). Identisch zu Angebote.tsx.
function cuKgPer100m(text: string): number | null {
  const m = String(text || "").match(/(\d+)\s*[xXgG]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const adern = Number(m[1]);
  const qmm = Number(String(m[2]).replace(",", "."));
  if (!adern || !qmm) return null;
  return Math.round(adern * qmm * 0.89 * 100) / 100;
}

function articleEp(a: any) {
  // Leere/0-Multiplikatoren: Material 1,28 · Lohn 1,5715 (wie im Angebot).
  const pe = num(a.preiseinheit) || 1;
  const matVk = num(a.mat_ek) * (num(a.mat_multi) || 1.28) / pe;
  const lohnSatzVk = num(a.lohn_ek) * (num(a.lohn_multi) || 1.5715);
  const lohnVk = lohnSatzVk * (num(a.minutes) / 60);
  return matVk + lohnVk;
}

function blankForm() {
  return { id: null as string | null, number: "", category: "", short_text: "", long_text: "", unit: "St", mat_ek: "", mat_multi: "1.28", lohn_ek: "", lohn_multi: "1.5715", minutes: "", preiseinheit: "1", kupfer_kg: "", kupfer_multi: "", components: [] as any[] };
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Stückliste: Material-EK und Kupfer je 1 Einheit der Leistung (EK der Teile / deren Preiseinheit × Menge).
function compSums(comps: any[]) {
  let mat = 0, cu = 0;
  for (const c of comps || []) {
    const pe = num(c.preiseinheit) || 1;
    mat += (num(c.ek) / pe) * num(c.qty);
    cu += (num(c.kupfer_kg) / pe) * num(c.qty);
  }
  return { mat: Math.round(mat * 100) / 100, cu: Math.round(cu * 100) / 100 };
}

// ── Komponente ─────────────────────────────────────────────────────
// art: "leistung" (mit Arbeitszeit + Stückliste, Standard) oder "artikel" (reines Material) — Stufe 7a.
export default function Artikel({ supabase, companyId, art = "leistung" }: { supabase: any; companyId: string; art?: "leistung" | "artikel" }) {
  const isLeistung = art === "leistung";
  const TYP = isLeistung ? "Leistung" : "Artikel";
  const TYP_ICON = isLeistung ? "🔧" : "📦";
  const [view, setView] = useState<"own" | "suppliers">("own");

  // Eigener Artikelstamm
  const [articles, setArticles] = useState<any[]>([]);
  const [f, setF] = useState<any>(blankForm());
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // DATANORM-Übernahme in die Maske ("form") oder in die Stückliste ("bom")
  const [dnOpen, setDnOpen] = useState(false);
  const [dnTarget, setDnTarget] = useState<"form" | "bom">("form");
  const [dnSup, setDnSup] = useState<string>("");
  const [dnSearch, setDnSearch] = useState("");
  const [dnResults, setDnResults] = useState<any[]>([]);
  const [dnLoading, setDnLoading] = useState(false);

  // Eigene Artikel in die Stückliste übernehmen (nur Leistungen)
  const [bomOpen, setBomOpen] = useState(false);
  const [bomSearch, setBomSearch] = useState("");
  const [bomResults, setBomResults] = useState<any[]>([]);
  const [bomLoading, setBomLoading] = useState(false);

  // Lieferanten-Kataloge (DATANORM)
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supName, setSupName] = useState("");
  const [preview, setPreview] = useState<{ supplierId: string; res: DnResult; files: string[] } | null>(null);
  const [impMsg, setImpMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (companyId) { loadArticles(); loadSuppliers(); } /* eslint-disable-next-line */ }, [companyId]);

  // Serverseitige Suche im Lieferanten-Katalog für die Übernahme in die Artikel-Maske (entprellt).
  useEffect(() => {
    if (!dnOpen) { setDnResults([]); return; }
    let active = true;
    setDnLoading(true);
    const safe = dnSearch.trim().replace(/[,()%*]/g, " ").trim();
    const h = setTimeout(async () => {
      let query = supabase.from("office_supplier_articles").select("*").eq("company_id", companyId);
      if (dnSup) query = query.eq("supplier_id", dnSup);
      if (safe) query = query.or(`short_text.ilike.*${safe}*,article_no.ilike.*${safe}*`);
      const { data } = await query.order("short_text", { ascending: true }).limit(30);
      if (active) { setDnResults(data || []); setDnLoading(false); }
    }, 300);
    return () => { active = false; clearTimeout(h); };
    // eslint-disable-next-line
  }, [dnOpen, dnSup, dnSearch, companyId]);

  const supName2 = (id: string) => suppliers.find((s: any) => s.id === id)?.name || "";
  function openDnPicker() { setDnTarget("form"); setDnSup(""); setDnSearch(f.number || ""); setDnOpen(true); }
  function openDnBom() { setDnTarget("bom"); setDnSup(""); setDnSearch(""); setDnOpen(true); }
  function fillFromCatalog(a: any) {
    if (dnTarget === "bom") {
      const ek = a.ek != null ? a.ek : a.net_ek;
      const c = { id: uid(), source: "datanorm", supplier_id: a.supplier_id, number: a.article_no || "", short_text: a.short_text || (a.article_no ? "Art. " + a.article_no : ""), unit: a.unit || "St", qty: "1", ek: ek != null ? String(ek) : "", preiseinheit: "1", kupfer_kg: "" };
      setF((p: any) => ({ ...p, components: [...(p.components || []), c] }));
      setDnOpen(false);
      setMsg(`In die Stückliste übernommen: ${c.short_text || c.number}. Menge/EK prüfen.`);
      return;
    }
    setF((p: any) => ({
      ...p,
      number: a.article_no || p.number,
      short_text: a.short_text || (a.article_no ? "Art. " + a.article_no : p.short_text),
      long_text: a.long_text || p.long_text,
      unit: a.unit || p.unit,
      mat_ek: a.ek != null ? String(a.ek) : (a.net_ek != null ? String(a.net_ek) : p.mat_ek),
    }));
    setDnOpen(false);
    setMsg(`Aus Katalog übernommen: ${a.short_text || a.article_no || ""}. EK/Bezeichnung geprüft, dann speichern.`);
  }

  // Serverseitige Suche im eigenen Artikelstamm (nur art='artikel') für die Stückliste (entprellt).
  useEffect(() => {
    if (!bomOpen) { setBomResults([]); return; }
    let active = true;
    setBomLoading(true);
    const safe = bomSearch.trim().replace(/[,()%*]/g, " ").trim();
    const h = setTimeout(async () => {
      let query = supabase.from("office_articles").select("*").eq("company_id", companyId).eq("art", "artikel");
      if (safe) query = query.or(`short_text.ilike.*${safe}*,number.ilike.*${safe}*,category.ilike.*${safe}*`);
      const { data } = await query.order("short_text", { ascending: true }).limit(30);
      if (active) { setBomResults(data || []); setBomLoading(false); }
    }, 300);
    return () => { active = false; clearTimeout(h); };
    // eslint-disable-next-line
  }, [bomOpen, bomSearch, companyId]);

  function addCompFromOwn(a: any) {
    const c = { id: uid(), source: "own", article_id: a.id, number: a.number || "", short_text: a.short_text || "", unit: a.unit || "St", qty: "1", ek: a.mat_ek != null ? String(a.mat_ek) : "", preiseinheit: a.preiseinheit != null ? String(a.preiseinheit) : "1", kupfer_kg: a.kupfer_kg != null ? String(a.kupfer_kg) : "" };
    setF((p: any) => ({ ...p, components: [...(p.components || []), c] }));
    setBomOpen(false);
    setMsg(`In die Stückliste übernommen: ${c.short_text || c.number}. Menge prüfen.`);
  }
  function setComp(i: number, field: string, val: any) {
    setF((p: any) => { const arr = [...(p.components || [])]; arr[i] = { ...arr[i], [field]: val }; return { ...p, components: arr }; });
  }
  function removeComp(i: number) {
    setF((p: any) => ({ ...p, components: (p.components || []).filter((_: any, j: number) => j !== i) }));
  }

  // Eingefrorene Stücklisten-Preise auf Wunsch aktualisieren (eigene Artikel + DATANORM-Katalog).
  async function refreshCompPrices() {
    const comps: any[] = f.components || [];
    if (!comps.length) return;
    setMsg("Aktualisiere Preise…");
    const out = [...comps];
    let changed = 0, missing = 0;
    for (let i = 0; i < out.length; i++) {
      const c = { ...out[i] };
      try {
        if (c.source === "own" && c.article_id) {
          const { data } = await supabase.from("office_articles").select("mat_ek,preiseinheit,kupfer_kg").eq("id", c.article_id).maybeSingle();
          if (data) {
            const neu = data.mat_ek != null ? String(data.mat_ek) : c.ek;
            if (num(neu) !== num(c.ek)) changed++;
            c.ek = neu;
            c.preiseinheit = data.preiseinheit != null ? String(data.preiseinheit) : c.preiseinheit;
            c.kupfer_kg = data.kupfer_kg != null ? String(data.kupfer_kg) : c.kupfer_kg;
          } else missing++;
        } else if (c.source === "datanorm" && c.supplier_id && c.number) {
          const { data } = await supabase.from("office_supplier_articles").select("ek,net_ek").eq("company_id", companyId).eq("supplier_id", c.supplier_id).eq("article_no", c.number).limit(1);
          const row = data && data[0];
          const ek = row ? (row.ek != null ? row.ek : row.net_ek) : null;
          if (ek != null) { if (num(ek) !== num(c.ek)) changed++; c.ek = String(ek); } else missing++;
        }
      } catch { /* Zeile überspringen, eingefrorener Preis bleibt */ }
      out[i] = c;
    }
    setF((p: any) => ({ ...p, components: out }));
    setMsg(`Preise aktualisiert: ${changed} geändert${missing ? `, ${missing} nicht gefunden (Preis eingefroren gelassen)` : ""}.`);
  }

  // ── Eigener Artikelstamm ─────────────────────────────────────────
  async function loadArticles() {
    // Alt-Daten ohne art-Spalte zählen als Leistung (Migration setzt Default 'leistung').
    const { data, error } = await supabase.from("office_articles").select("*").eq("company_id", companyId).eq("art", art).order("short_text", { ascending: true });
    if (error) { setMsg("Fehler beim Laden: " + error.message); return; }
    setArticles(data || []);
  }
  function setField(field: string, val: any) { setF((p: any) => ({ ...p, [field]: val })); }
  function startNew() { setF(blankForm()); setFormOpen(true); setMsg(""); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }
  function startEdit(a: any) {
    setF({ id: a.id, number: a.number ?? "", category: a.category ?? "", short_text: a.short_text ?? "", long_text: a.long_text ?? "", unit: a.unit || "St", mat_ek: a.mat_ek ?? "", mat_multi: a.mat_multi ?? "1.28", lohn_ek: a.lohn_ek ?? "", lohn_multi: a.lohn_multi ?? "1.5715", minutes: a.minutes ?? "", preiseinheit: a.preiseinheit ?? "1", kupfer_kg: a.kupfer_kg ?? "", kupfer_multi: a.kupfer_multi ?? "", components: Array.isArray(a.components) ? a.components : [] });
    setFormOpen(true); setMsg("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetForm() { setF(blankForm()); setFormOpen(false); }
  async function saveArticle() {
    if (!f.short_text.trim()) { setMsg("Bitte einen Kurztext eingeben."); return; }
    // Mit Stückliste: Material-EK (und Kupfer, falls Teile Kupfer tragen) automatisch aus der Summe.
    const comps: any[] = isLeistung && Array.isArray(f.components) ? f.components.filter((c: any) => num(c.qty) > 0) : [];
    const sums = compSums(comps);
    const payload: any = {
      art,
      number: f.number.trim() || null, category: f.category.trim() || null, short_text: f.short_text.trim(), long_text: f.long_text.trim() || null, unit: f.unit || "St",
      mat_ek: comps.length ? sums.mat : (f.mat_ek === "" ? null : num(f.mat_ek)), mat_multi: f.mat_multi === "" ? null : num(f.mat_multi),
      lohn_ek: isLeistung ? (f.lohn_ek === "" ? null : num(f.lohn_ek)) : null, lohn_multi: isLeistung ? (f.lohn_multi === "" ? null : num(f.lohn_multi)) : null,
      minutes: isLeistung ? (f.minutes === "" ? null : num(f.minutes)) : null,
      preiseinheit: f.preiseinheit === "" ? null : num(f.preiseinheit),
      kupfer_kg: comps.length && sums.cu > 0 ? sums.cu : (f.kupfer_kg === "" ? null : num(f.kupfer_kg)),
      kupfer_multi: f.kupfer_multi === "" ? null : num(f.kupfer_multi),
      components: comps.length ? comps : null,
      updated_at: new Date().toISOString(),
    };
    if (f.id) {
      const { error } = await supabase.from("office_articles").update(payload).eq("id", f.id);
      if (error) { setMsg("Fehler beim Speichern: " + error.message); return; }
    } else {
      const { error } = await supabase.from("office_articles").insert({ company_id: companyId, ...payload });
      if (error) { setMsg("Fehler beim Speichern: " + error.message); return; }
    }
    resetForm(); await loadArticles(); setMsg(`${TYP} gespeichert.`);
  }
  async function deleteArticle(id: string) {
    if (typeof window !== "undefined" && !window.confirm(isLeistung ? "Diese Leistung wirklich löschen?" : "Diesen Artikel wirklich löschen?")) return;
    const { error } = await supabase.from("office_articles").delete().eq("id", id);
    if (error) { setMsg("Fehler beim Löschen: " + error.message); return; }
    if (f.id === id) resetForm();
    await loadArticles();
  }

  // ── Lieferanten-Kataloge (DATANORM) ──────────────────────────────
  async function loadSuppliers() {
    const { data } = await supabase.from("office_suppliers").select("*").eq("company_id", companyId).order("name", { ascending: true });
    setSuppliers(data || []);
  }
  async function addSupplier() {
    const name = supName.trim();
    if (!name) { setImpMsg("Bitte einen Lieferantennamen eingeben."); return; }
    const { error } = await supabase.from("office_suppliers").insert({ company_id: companyId, name });
    if (error) { setImpMsg("Fehler beim Anlegen: " + error.message); return; }
    setSupName(""); await loadSuppliers(); setImpMsg("Lieferant angelegt.");
  }
  async function deleteSupplier(s: any) {
    if (typeof window !== "undefined" && !window.confirm(`Lieferant „${s.name}" inkl. aller Katalog-Artikel wirklich löschen?`)) return;
    setBusy(true); setImpMsg("Lösche Katalog…");
    await supabase.from("office_supplier_articles").delete().eq("supplier_id", s.id);
    await supabase.from("office_supplier_discounts").delete().eq("supplier_id", s.id);
    const { error } = await supabase.from("office_suppliers").delete().eq("id", s.id);
    setBusy(false);
    if (error) { setImpMsg("Fehler beim Löschen: " + error.message); return; }
    if (preview?.supplierId === s.id) setPreview(null);
    await loadSuppliers(); setImpMsg("Lieferant gelöscht.");
  }
  async function onDatanormFiles(s: any, fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    setBusy(true); setImpMsg("Lese Dateien…"); setPreview(null);
    try {
      const files: { name: string; data: Uint8Array }[] = [];
      for (const file of Array.from(fileList)) {
        if (/\.zip$/i.test(file.name)) { setImpMsg(`„${file.name}" ist ein ZIP – bitte entpackt hochladen (z. B. DATANORM.001, DATPREIS.001, Datanorm.Rab).`); setBusy(false); return; }
        files.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
      }
      const res = parseDatanormFiles(files);
      setPreview({ supplierId: s.id, res, files: files.map((x) => x.name) });
      setImpMsg("");
    } catch (e: any) {
      setImpMsg("Fehler beim Einlesen: " + (e?.message || String(e)));
    }
    setBusy(false);
  }
  async function runImport(s: any, res: DnResult) {
    const hasArt = res.articles.length > 0;
    const hasDisc = res.discounts.length > 0;
    if (!hasArt && !hasDisc) { setImpMsg("Nichts zu importieren."); return; }
    setBusy(true); setImpMsg("Bereite Import vor…");

    // Rabattgruppen: nur ersetzen, wenn welche in der Datei sind.
    if (hasDisc) {
      await supabase.from("office_supplier_discounts").delete().eq("supplier_id", s.id);
      const drows = res.discounts.map((d) => ({ company_id: companyId, supplier_id: s.id, discount_group: d.discount_group, discount_pct: d.discount_pct, description: d.description || null }));
      for (let i = 0; i < drows.length; i += 1000) {
        const { error } = await supabase.from("office_supplier_discounts").insert(drows.slice(i, i + 1000));
        if (error) { setImpMsg("Fehler bei Rabattgruppen: " + error.message); setBusy(false); return; }
        setImpMsg(`Importiere Rabattgruppen… ${int(Math.min(i + 1000, drows.length))} / ${int(drows.length)}`);
      }
    }

    // Artikel: nur ersetzen, wenn die Datei Artikel enthält (sonst bleiben bestehende erhalten).
    if (hasArt) {
      await supabase.from("office_supplier_articles").delete().eq("supplier_id", s.id);
      const rows = res.articles.map((a) => ({
        company_id: companyId, supplier_id: s.id, article_no: a.article_no, short_text: a.short_text || null, long_text: a.long_text || null,
        unit: a.unit || null, ean: a.ean || null, discount_group: a.discount_group || null, list_ek: a.list_ek, net_ek: a.net_ek, ek: a.ek,
      }));
      const B = 1000;
      for (let i = 0; i < rows.length; i += B) {
        const { error } = await supabase.from("office_supplier_articles").insert(rows.slice(i, i + B));
        if (error) { setImpMsg("Fehler beim Import: " + error.message); setBusy(false); await loadSuppliers(); return; }
        setImpMsg(`Importiere… ${int(Math.min(i + B, rows.length))} / ${int(rows.length)} Artikel`);
      }
      await supabase.from("office_suppliers").update({ datanorm_version: res.version, currency: res.currency, catalog_date: res.catalogDate || null, article_count: rows.length, updated_at: new Date().toISOString() }).eq("id", s.id);
    } else {
      // Nur Rabatte importiert – Artikelzahl unverändert lassen, Zeitstempel aktualisieren.
      await supabase.from("office_suppliers").update({ updated_at: new Date().toISOString() }).eq("id", s.id);
    }

    setBusy(false); setPreview(null);
    const parts: string[] = [];
    if (hasArt) parts.push(`${int(res.articles.length)} Artikel`);
    if (hasDisc) parts.push(`${int(res.discounts.length)} Rabattgruppen`);
    setImpMsg(`Fertig: ${parts.join(" und ")} importiert.`);
    await loadSuppliers();
  }

  // ── Derived (eigener Artikelstamm) ───────────────────────────────
  const categories = Array.from(new Set(articles.map((a: any) => String(a.category || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  const q = search.trim().toLowerCase();
  const filtered = articles
    .filter((a: any) => (catFilter ? String(a.category || "").trim() === catFilter : true))
    .filter((a: any) => (q ? [a.number, a.short_text, a.long_text, a.category].some((x: any) => String(x || "").toLowerCase().includes(q)) : true));
  const shown = filtered.slice(0, 300);
  const fComps: any[] = isLeistung && Array.isArray(f.components) ? f.components : [];
  const hasComps = fComps.length > 0;
  const fSums = compSums(fComps);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      {/* Ansicht-Umschalter: Lieferanten-Kataloge nur im Artikel-Reiter */}
      {!isLeistung && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setView("own")} className={`px-4 py-2 rounded-full text-sm font-medium ${view === "own" ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>📦 Eigene Artikel</button>
          <button type="button" onClick={() => setView("suppliers")} className={`px-4 py-2 rounded-full text-sm font-medium ${view === "suppliers" ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>🏭 Lieferanten-Kataloge (DATANORM)</button>
        </div>
      )}

      {view === "own" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{TYP_ICON} {isLeistung ? "Leistungen" : "Artikelstamm"} <span className="text-sm font-normal text-gray-500">({articles.length})</span></h2>
            <div className="flex gap-2 items-center flex-wrap">
              {categories.length > 0 && (
                <select className="border p-2 rounded-lg text-black bg-white" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                  <option value="">Alle Kategorien</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <input className="border p-2 rounded-lg text-black bg-white w-full sm:w-72" placeholder="Suche: Nr., Kurztext, Kategorie…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button type="button" onClick={startNew} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">＋ {isLeistung ? "Neue Leistung" : "Neuer Artikel"}</button>
            </div>
          </div>
          {msg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{msg}</div>}

          {formOpen && (
            <div className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-gray-50 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold">{f.id ? `${TYP} bearbeiten` : (isLeistung ? "Neue Leistung anlegen" : "Neuen Artikel anlegen")}</h3>
                <button type="button" onClick={openDnPicker} className="bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm">🏭 aus Lieferanten-Katalog übernehmen</button>
              </div>

              {dnOpen && (
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">🏭 Katalog</span>
                    <select className="border p-2 rounded-lg text-black bg-white text-sm" value={dnSup} onChange={(e) => setDnSup(e.target.value)}>
                      <option value="">Alle Lieferanten</option>
                      {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input className="border p-2 rounded-lg text-black bg-white flex-1 min-w-[12rem] text-sm" placeholder="Suche: Artikelnummer oder Bezeichnung…" value={dnSearch} onChange={(e) => setDnSearch(e.target.value)} />
                    {dnLoading && <span className="text-xs text-gray-500">sucht…</span>}
                    <button type="button" onClick={() => setDnOpen(false)} className="bg-gray-200 px-3 py-2 rounded-lg text-xs">Schließen</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {dnResults.map((a: any) => (
                      <button key={a.id} type="button" onClick={() => fillFromCatalog(a)} className="w-full text-left border border-slate-200 rounded-lg p-2 text-sm bg-white hover:bg-emerald-50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{supName2(a.supplier_id)}</span>
                          {a.article_no ? <span className="text-xs text-gray-500">Nr. {a.article_no}</span> : null}
                          <strong>{a.short_text || (a.article_no ? "Art. " + a.article_no : "(ohne Bezeichnung)")}</strong>
                        </div>
                        <div className="text-xs text-gray-500">EK {a.ek != null ? fmt(num(a.ek)) + " €" : "—"}{a.unit ? " / " + a.unit : ""}</div>
                      </button>
                    ))}
                    {dnResults.length === 0 && <p className="text-xs text-gray-500">{dnLoading ? "Suche läuft…" : dnSearch.trim() ? "Kein Treffer – nach Artikelnummer suchen (Rexel hat keine Bezeichnungen)." : "Suchbegriff eingeben."}</p>}
                  </div>
                  <p className="text-xs text-gray-500">Übernimmt Nummer, Bezeichnung, Einheit und Netto-EK in die Maske. Deine Multiplikatoren/Lohn bleiben; danach speichern.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col text-sm">Artikelnummer
                  <input className="border p-2 rounded-lg text-black bg-white" placeholder="z. B. Lieferanten- oder interne Nr." value={f.number} onChange={(e) => setField("number", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">Kategorie / Gruppe
                  <input list="office-article-cats" className="border p-2 rounded-lg text-black bg-white" placeholder="z. B. Kabel, Schalter, Leuchten" value={f.category} onChange={(e) => setField("category", e.target.value)} />
                  <datalist id="office-article-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </label>
                <label className="flex flex-col text-sm md:col-span-2">Kurztext *
                  <input className="border p-2 rounded-lg text-black bg-white font-medium" placeholder="Kurzbezeichnung des Artikels" value={f.short_text} onChange={(e) => setField("short_text", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm md:col-span-2">Langtext
                  <textarea className="border p-2 rounded-lg text-black bg-white" rows={2} placeholder="Ausführliche Beschreibung (optional)" value={f.long_text} onChange={(e) => setField("long_text", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">Einheit
                  <select className="border p-2 rounded-lg text-black bg-white" value={f.unit} onChange={(e) => setField("unit", e.target.value)}>
                    {(f.unit && !UNITS.includes(f.unit) ? [f.unit, ...UNITS] : UNITS).map((u: string) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <div />
                <label className="flex flex-col text-sm" title={hasComps ? "Wird automatisch aus der Stückliste berechnet." : undefined}>Mat-Ek (€){hasComps ? " — aus Stückliste" : ""}
                  <input disabled={hasComps} className={`border p-2 rounded-lg text-black ${hasComps ? "bg-gray-100" : "bg-white"}`} value={hasComps ? String(fSums.mat) : f.mat_ek} onChange={(e) => setField("mat_ek", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">Multi Material
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.mat_multi} onChange={(e) => setField("mat_multi", e.target.value)} />
                </label>
                {isLeistung && (<>
                <label className="flex flex-col text-sm">Lohn-Ek (€/h)
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.lohn_ek} onChange={(e) => setField("lohn_ek", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">Multi Lohn
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.lohn_multi} onChange={(e) => setField("lohn_multi", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">Minuten / Einheit
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.minutes} onChange={(e) => setField("minutes", e.target.value)} />
                </label>
                </>)}
                <label className="flex flex-col text-sm" title="Preis gilt je … Einheiten (z. B. 100 = Preis pro 100 m). Leer = 1.">Preiseinheit
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.preiseinheit} onChange={(e) => setField("preiseinheit", e.target.value)} />
                </label>
                <div className="flex flex-col text-sm">🟠 Kupfer kg / Preiseinheit{hasComps && fSums.cu > 0 ? " — aus Stückliste" : ""}
                  <div className="flex gap-1 items-stretch">
                    <input disabled={hasComps && fSums.cu > 0} className={`border p-2 rounded-lg text-black w-full ${hasComps && fSums.cu > 0 ? "bg-gray-100" : "bg-white"}`} value={hasComps && fSums.cu > 0 ? String(fSums.cu) : f.kupfer_kg} onChange={(e) => setField("kupfer_kg", e.target.value)} />
                    <button type="button" onClick={() => { const cu = cuKgPer100m((f.short_text || "") + " " + (f.long_text || "")); if (cu != null) { const pe = num(f.preiseinheit) || 1; setField("kupfer_kg", String(Math.round(cu * pe / 100 * 100) / 100)); setMsg(""); } else setMsg("Kein Querschnitt (z. B. 5x16) in der Bezeichnung erkannt."); }} className="bg-slate-600 text-white px-2 rounded-lg text-xs whitespace-nowrap" title="Kupfergewicht aus dem Querschnitt in der Bezeichnung schätzen">Cu schätzen</button>
                  </div>
                </div>
                <label className="flex flex-col text-sm" title="Eigener Multiplikator auf den Kupferanteil. Leer = Standard aus den Angebots-Einstellungen.">Kupfer-Multi
                  <input className="border p-2 rounded-lg text-black bg-white" placeholder="Standard" value={f.kupfer_multi} onChange={(e) => setField("kupfer_multi", e.target.value)} />
                </label>
                <div className="flex flex-col text-sm text-gray-500">Einzelpreis (Vk, Vorschau)
                  <div className="border p-2 rounded-lg bg-gray-100 font-medium">{fmt(articleEp(hasComps ? { ...f, mat_ek: String(fSums.mat) } : f))} €</div>
                  {(hasComps && fSums.cu > 0) || num(f.kupfer_kg) > 0 ? <span className="text-xs text-amber-700">ohne Kupfer — Tageskurs steht im Angebot</span> : null}
                </div>
              </div>
              {/* Stückliste (nur Leistungen, Stufe 7a): Material-Teile aus eigenem Artikelstamm + DATANORM. */}
              {isLeistung && (
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="font-bold text-sm">🧩 Stückliste (Material) <span className="font-normal text-gray-500">— nur intern für die Kalkulation, erscheint nicht im Angebot</span></h4>
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => { setBomSearch(""); setBomOpen(true); }} className="bg-cyan-700 text-white px-3 py-1.5 rounded-lg text-xs">＋ 📦 Artikel</button>
                      <button type="button" onClick={openDnBom} className="bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs">＋ 🏭 Katalog (DATANORM)</button>
                      {hasComps && <button type="button" onClick={refreshCompPrices} className="bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs" title="Eingefrorene EKs mit den aktuellen Preisen aus Artikelstamm/Katalog abgleichen">🔄 Preise aktualisieren</button>}
                    </div>
                  </div>

                  {bomOpen && (
                    <div className="border border-cyan-200 bg-cyan-50/50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">📦 Eigener Artikelstamm</span>
                        <input className="border p-2 rounded-lg text-black bg-white flex-1 min-w-[12rem] text-sm" placeholder="Suche: Nr., Kurztext, Kategorie…" value={bomSearch} onChange={(e) => setBomSearch(e.target.value)} />
                        {bomLoading && <span className="text-xs text-gray-500">sucht…</span>}
                        <button type="button" onClick={() => setBomOpen(false)} className="bg-gray-200 px-3 py-2 rounded-lg text-xs">Schließen</button>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {bomResults.map((a: any) => (
                          <button key={a.id} type="button" onClick={() => addCompFromOwn(a)} className="w-full text-left border border-slate-200 rounded-lg p-2 text-sm bg-white hover:bg-cyan-50">
                            <div className="flex items-center gap-2 flex-wrap">
                              {a.category ? <span className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{a.category}</span> : null}
                              {a.number ? <span className="text-xs text-gray-500">Nr. {a.number}</span> : null}
                              <strong>{a.short_text || "(ohne Kurztext)"}</strong>
                            </div>
                            <div className="text-xs text-gray-500">EK {a.mat_ek != null ? fmt(num(a.mat_ek)) + " €" : "—"}{num(a.preiseinheit) > 1 ? " / " + a.preiseinheit : ""}{a.unit ? " " + a.unit : ""}</div>
                          </button>
                        ))}
                        {bomResults.length === 0 && <p className="text-xs text-gray-500">{bomLoading ? "Suche läuft…" : "Kein Artikel gefunden. Reine Material-Artikel legst du im Reiter „📦 Artikel“ an."}</p>}
                      </div>
                    </div>
                  )}

                  {fComps.map((c: any, i: number) => (
                    <div key={c.id || i} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg p-2 text-sm bg-gray-50">
                      <span className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 whitespace-nowrap">{c.source === "datanorm" ? "🏭 " + (supName2(c.supplier_id) || "Katalog") : "📦 Artikel"}</span>
                      {c.number ? <span className="text-xs text-gray-500 whitespace-nowrap">Nr. {c.number}</span> : null}
                      <strong className="min-w-0 flex-1 truncate" title={c.short_text}>{c.short_text || "(ohne Bezeichnung)"}</strong>
                      <label className="flex items-center gap-1 text-xs">Menge
                        <input className="border p-1.5 rounded text-black bg-white w-16" value={c.qty} onChange={(e) => setComp(i, "qty", e.target.value)} />
                      </label>
                      <span className="text-xs text-gray-500">{c.unit || "St"}</span>
                      <label className="flex items-center gap-1 text-xs">EK €
                        <input className="border p-1.5 rounded text-black bg-white w-20" value={c.ek} onChange={(e) => setComp(i, "ek", e.target.value)} />
                      </label>
                      {num(c.preiseinheit) > 1 ? <span className="text-xs text-gray-500">/ {c.preiseinheit}</span> : null}
                      <span className="text-xs font-medium whitespace-nowrap">= {fmt((num(c.ek) / (num(c.preiseinheit) || 1)) * num(c.qty))} €</span>
                      <button type="button" onClick={() => removeComp(i)} className="bg-red-600 text-white px-2 py-1 rounded text-xs" title="Aus der Stückliste entfernen">🗑️</button>
                    </div>
                  ))}
                  {hasComps ? (
                    <p className="text-xs text-gray-600">Material-EK aus Stückliste: <strong>{fmt(fSums.mat)} €</strong>{fSums.cu > 0 ? <> · 🟠 Kupfer: <strong>{fmt(fSums.cu)} kg</strong></> : null} — Preise sind eingefroren, „🔄 Preise aktualisieren“ holt die aktuellen EKs.</p>
                  ) : (
                    <p className="text-xs text-gray-500">Noch keine Teile. Ohne Stückliste gilt das Mat-Ek-Feld oben wie bisher.</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={saveArticle} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">{f.id ? "💾 Speichern" : "Anlegen"}</button>
                <button type="button" onClick={resetForm} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">Abbrechen</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-gray-500">{filtered.length} Treffer{filtered.length > shown.length ? ` · zeige die ersten ${shown.length}` : ""}</p>
            {shown.map((a: any) => (
              <div key={a.id} className="border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.category ? <span className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{a.category}</span> : null}
                    {a.number ? <span className="text-xs text-gray-500">Nr. {a.number}</span> : null}
                    <strong>{a.short_text || "(ohne Kurztext)"}</strong>
                    {Array.isArray(a.components) && a.components.length > 0 ? <span className="text-xs bg-cyan-50 text-cyan-800 border border-cyan-200 rounded px-1.5 py-0.5">🧩 {a.components.length} Teile</span> : null}
                  </div>
                  {a.long_text ? <div className="text-gray-500 text-xs mt-0.5 line-clamp-2">{a.long_text}</div> : null}
                  <div className="text-gray-500 text-xs mt-0.5">
                    {isLeistung
                      ? <>{fmt(num(a.mat_ek))} € Mat · {fmt(num(a.lohn_ek))} €/h Lohn · {num(a.minutes)} min/{a.unit || "St"} · EP ca. {fmt(articleEp(a))} €</>
                      : <>{fmt(num(a.mat_ek))} € EK / {num(a.preiseinheit) > 1 ? `${num(a.preiseinheit)} ` : ""}{a.unit || "St"} · VK ca. {fmt(articleEp(a))} €</>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => startEdit(a)} className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm">✏️ Bearbeiten</button>
                  <button type="button" onClick={() => deleteArticle(a.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm">🗑️</button>
                </div>
              </div>
            ))}
            {articles.length === 0 && <p className="text-gray-600">{isLeistung ? "Noch keine Leistungen. Lege die erste Leistung an — deine bisherigen Artikel mit Arbeitszeit findest du hier." : "Noch keine Artikel. Lege den ersten Artikel an oder übernimm einen aus dem Lieferanten-Katalog."}</p>}
            {articles.length > 0 && filtered.length === 0 && <p className="text-gray-600">{isLeistung ? "Keine Leistung gefunden." : "Kein Artikel gefunden."}</p>}
          </div>
        </div>
      )}

      {view === "suppliers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xl font-bold">🏭 Lieferanten-Kataloge <span className="text-sm font-normal text-gray-500">({suppliers.length})</span></h2>
            <div className="flex gap-2 items-center">
              <input className="border p-2 rounded-lg text-black bg-white" placeholder="Neuer Lieferant (Name)" value={supName} onChange={(e) => setSupName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSupplier(); }} />
              <button type="button" onClick={addSupplier} disabled={busy} className="bg-cyan-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">＋ Lieferant</button>
            </div>
          </div>
          {impMsg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{impMsg}</div>}
          <p className="text-xs text-gray-500">DATANORM-Dateien (Version 4 &amp; 5) entpackt hochladen — pro Lieferant zusammen, was zusammengehört: die Artikeldatei (z. B. <code>DATANORM.001</code>) und, falls vorhanden, die Preisdatei (<code>DATPREIS.001</code>) und die Rabattdatei (<code>Datanorm.Rab</code>). Zeichensatz CP850 wird automatisch erkannt.</p>

          {suppliers.map((s: any) => (
            <div key={s.id} className="border border-slate-200 rounded-xl p-3 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <strong>{s.name}</strong>
                  <span className="text-gray-500"> · {int(num(s.article_count))} Artikel</span>
                  {s.datanorm_version && s.datanorm_version !== "?" ? <span className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 ml-2">DATANORM {s.datanorm_version}</span> : null}
                  {s.catalog_date ? <span className="text-xs text-gray-400 ml-1">Stand {s.catalog_date}</span> : null}
                </div>
                <div className="flex gap-2 items-center">
                  <label className={`px-3 py-2 rounded-lg text-sm cursor-pointer ${busy ? "bg-gray-300 text-white" : "bg-emerald-700 text-white"}`}>⬆ DATANORM-Dateien
                    <input type="file" multiple className="hidden" disabled={busy} onChange={(e) => { onDatanormFiles(s, e.target.files); e.currentTarget.value = ""; }} />
                  </label>
                  <button type="button" onClick={() => deleteSupplier(s)} disabled={busy} className="bg-red-600 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm">🗑️</button>
                </div>
              </div>

              {preview && preview.supplierId === s.id && (
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-medium">Vorschau — {preview.files.join(", ")}</div>
                  <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>DATANORM {preview.res.version}</span>
                    <span>Währung {preview.res.currency}</span>
                    <span><strong>{int(preview.res.articles.length)}</strong> Artikel</span>
                    <span>{int(preview.res.stats.withText)} mit Text</span>
                    <span>{int(preview.res.stats.withNet)} mit Netto-EK</span>
                    <span>{int(preview.res.stats.withEan)} mit EAN</span>
                    {preview.res.discounts.length ? <span>{int(preview.res.discounts.length)} Rabattgruppen</span> : null}
                  </div>
                  {preview.res.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700">⚠️ {w}</div>)}
                  {(() => {
                    const hint = String(preview.res.supplierHint || "").trim();
                    if (!hint) return null;
                    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
                    const a = norm(hint), b = norm(s.name || "");
                    if (!b || a.includes(b) || b.includes(a)) return null;
                    return (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                        ⚠️ Die Datei nennt im Vorlauf <strong>„{hint}"</strong>, importiert wird aber nach <strong>„{s.name}"</strong>. Bitte prüfen, ob der richtige Lieferant gewählt ist.
                      </div>
                    );
                  })()}
                  <div className="max-h-40 overflow-y-auto text-xs bg-white border border-slate-200 rounded p-2 space-y-0.5">
                    {preview.res.articles.slice(0, 8).map((a, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="truncate">{a.article_no} · {a.short_text || <em className="text-gray-400">(kein Text)</em>}</span>
                        <span className="whitespace-nowrap text-gray-600">{a.ek != null ? fmt(a.ek) + " €" : "—"}{a.unit ? " / " + a.unit : ""}</span>
                      </div>
                    ))}
                  </div>
                  {preview.res.articles.length === 0 && preview.res.discounts.length > 0 && (
                    <p className="text-xs text-slate-600">Nur Rabattgruppen in dieser Datei — beim Import bleiben die bereits importierten Artikel dieses Lieferanten erhalten.</p>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => runImport(s, preview.res)} disabled={busy || (!preview.res.articles.length && !preview.res.discounts.length)} className="bg-cyan-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm">{busy ? "Import läuft…" : preview.res.articles.length ? `Importieren (${int(preview.res.articles.length)} Artikel)` : `Rabattgruppen importieren (${int(preview.res.discounts.length)})`}</button>
                    <button type="button" onClick={() => setPreview(null)} disabled={busy} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">Abbrechen</button>
                  </div>
                  <p className="text-xs text-gray-500">Beim Import wird der jeweilige Datenbestand (Artikel bzw. Rabattgruppen) dieses Lieferanten ersetzt. Große Kataloge (100.000+ Artikel) können einige Minuten dauern — Fenster offen lassen.</p>
                </div>
              )}
            </div>
          ))}
          {suppliers.length === 0 && <p className="text-gray-600">Noch kein Lieferant angelegt. Lege oben einen Lieferanten an und lade seine DATANORM-Dateien hoch.</p>}
        </div>
      )}
    </section>
  );
}
