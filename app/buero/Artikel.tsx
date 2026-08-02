"use client";

import { useEffect, useState } from "react";
import { parseDatanormFiles, type DnResult } from "./datanormParse";

// ── Hilfsfunktionen ────────────────────────────────────────────────
const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: number) => Math.round(n).toLocaleString("de-DE");
const UNITS = ["St", "Stk", "Psch", "m", "lfm", "m²", "m³", "h", "Std", "Tag", "Wo", "Mon", "kg", "t", "g", "l", "Ltr", "Satz", "Paar", "Rolle", "Pkg", "Bund", "Pkt", "kW", "kWp", "A", "V", "%"];

function articleEp(a: any) {
  // Leere/0-Multiplikatoren fallen auf den App-Standard 1,28 zurück (wie im Angebot).
  const matVk = num(a.mat_ek) * (num(a.mat_multi) || 1.28);
  const lohnSatzVk = num(a.lohn_ek) * (num(a.lohn_multi) || 1.28);
  const lohnVk = lohnSatzVk * (num(a.minutes) / 60);
  return matVk + lohnVk;
}

function blankForm() {
  return { id: null as string | null, number: "", category: "", short_text: "", long_text: "", unit: "St", mat_ek: "", mat_multi: "1.28", lohn_ek: "", lohn_multi: "1.28", minutes: "" };
}

// ── Komponente ─────────────────────────────────────────────────────
export default function Artikel({ supabase, companyId }: { supabase: any; companyId: string }) {
  const [view, setView] = useState<"own" | "suppliers">("own");

  // Eigener Artikelstamm
  const [articles, setArticles] = useState<any[]>([]);
  const [f, setF] = useState<any>(blankForm());
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // Lieferanten-Kataloge (DATANORM)
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supName, setSupName] = useState("");
  const [preview, setPreview] = useState<{ supplierId: string; res: DnResult; files: string[] } | null>(null);
  const [impMsg, setImpMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (companyId) { loadArticles(); loadSuppliers(); } /* eslint-disable-next-line */ }, [companyId]);

  // ── Eigener Artikelstamm ─────────────────────────────────────────
  async function loadArticles() {
    const { data, error } = await supabase.from("office_articles").select("*").eq("company_id", companyId).order("short_text", { ascending: true });
    if (error) { setMsg("Fehler beim Laden: " + error.message); return; }
    setArticles(data || []);
  }
  function setField(field: string, val: any) { setF((p: any) => ({ ...p, [field]: val })); }
  function startNew() { setF(blankForm()); setFormOpen(true); setMsg(""); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }
  function startEdit(a: any) {
    setF({ id: a.id, number: a.number ?? "", category: a.category ?? "", short_text: a.short_text ?? "", long_text: a.long_text ?? "", unit: a.unit || "St", mat_ek: a.mat_ek ?? "", mat_multi: a.mat_multi ?? "1.28", lohn_ek: a.lohn_ek ?? "", lohn_multi: a.lohn_multi ?? "1.28", minutes: a.minutes ?? "" });
    setFormOpen(true); setMsg("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetForm() { setF(blankForm()); setFormOpen(false); }
  async function saveArticle() {
    if (!f.short_text.trim()) { setMsg("Bitte einen Kurztext eingeben."); return; }
    const payload: any = {
      number: f.number.trim() || null, category: f.category.trim() || null, short_text: f.short_text.trim(), long_text: f.long_text.trim() || null, unit: f.unit || "St",
      mat_ek: f.mat_ek === "" ? null : num(f.mat_ek), mat_multi: f.mat_multi === "" ? null : num(f.mat_multi),
      lohn_ek: f.lohn_ek === "" ? null : num(f.lohn_ek), lohn_multi: f.lohn_multi === "" ? null : num(f.lohn_multi),
      minutes: f.minutes === "" ? null : num(f.minutes), updated_at: new Date().toISOString(),
    };
    if (f.id) {
      const { error } = await supabase.from("office_articles").update(payload).eq("id", f.id);
      if (error) { setMsg("Fehler beim Speichern: " + error.message); return; }
    } else {
      const { error } = await supabase.from("office_articles").insert({ company_id: companyId, ...payload });
      if (error) { setMsg("Fehler beim Speichern: " + error.message); return; }
    }
    resetForm(); await loadArticles(); setMsg("Artikel gespeichert.");
  }
  async function deleteArticle(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Diesen Artikel wirklich löschen?")) return;
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
    setBusy(true); setImpMsg("Bereite Import vor…");
    await supabase.from("office_supplier_articles").delete().eq("supplier_id", s.id);
    await supabase.from("office_supplier_discounts").delete().eq("supplier_id", s.id);
    if (res.discounts.length) {
      const drows = res.discounts.map((d) => ({ company_id: companyId, supplier_id: s.id, discount_group: d.discount_group, discount_pct: d.discount_pct, description: d.description || null }));
      for (let i = 0; i < drows.length; i += 1000) {
        const { error } = await supabase.from("office_supplier_discounts").insert(drows.slice(i, i + 1000));
        if (error) { setImpMsg("Fehler bei Rabattgruppen: " + error.message); setBusy(false); return; }
      }
    }
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
    setBusy(false); setPreview(null); setImpMsg(`Fertig: ${int(rows.length)} Artikel importiert${res.discounts.length ? `, ${int(res.discounts.length)} Rabattgruppen` : ""}.`);
    await loadSuppliers();
  }

  // ── Derived (eigener Artikelstamm) ───────────────────────────────
  const categories = Array.from(new Set(articles.map((a: any) => String(a.category || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  const q = search.trim().toLowerCase();
  const filtered = articles
    .filter((a: any) => (catFilter ? String(a.category || "").trim() === catFilter : true))
    .filter((a: any) => (q ? [a.number, a.short_text, a.long_text, a.category].some((x: any) => String(x || "").toLowerCase().includes(q)) : true));
  const shown = filtered.slice(0, 300);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      {/* Ansicht-Umschalter */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setView("own")} className={`px-4 py-2 rounded-full text-sm font-medium ${view === "own" ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>📦 Eigene Artikel</button>
        <button type="button" onClick={() => setView("suppliers")} className={`px-4 py-2 rounded-full text-sm font-medium ${view === "suppliers" ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>🏭 Lieferanten-Kataloge (DATANORM)</button>
      </div>

      {view === "own" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xl font-bold">📦 Artikelstamm <span className="text-sm font-normal text-gray-500">({articles.length})</span></h2>
            <div className="flex gap-2 items-center flex-wrap">
              {categories.length > 0 && (
                <select className="border p-2 rounded-lg text-black bg-white" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                  <option value="">Alle Kategorien</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <input className="border p-2 rounded-lg text-black bg-white w-full sm:w-72" placeholder="Suche: Nr., Kurztext, Kategorie…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button type="button" onClick={startNew} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">＋ Neuer Artikel</button>
            </div>
          </div>
          {msg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{msg}</div>}

          {formOpen && (
            <div className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-gray-50 space-y-3">
              <h3 className="font-bold">{f.id ? "Artikel bearbeiten" : "Neuen Artikel anlegen"}</h3>
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
                <label className="flex flex-col text-sm">Mat-Ek (€)
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.mat_ek} onChange={(e) => setField("mat_ek", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">Multi Material
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.mat_multi} onChange={(e) => setField("mat_multi", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">Lohn-Ek (€/h)
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.lohn_ek} onChange={(e) => setField("lohn_ek", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">Multi Lohn
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.lohn_multi} onChange={(e) => setField("lohn_multi", e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">Minuten / Einheit
                  <input className="border p-2 rounded-lg text-black bg-white" value={f.minutes} onChange={(e) => setField("minutes", e.target.value)} />
                </label>
                <div className="flex flex-col text-sm text-gray-500">Einzelpreis (Vk, Vorschau)
                  <div className="border p-2 rounded-lg bg-gray-100 font-medium">{fmt(articleEp(f))} €</div>
                </div>
              </div>
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
                  </div>
                  {a.long_text ? <div className="text-gray-500 text-xs mt-0.5 line-clamp-2">{a.long_text}</div> : null}
                  <div className="text-gray-500 text-xs mt-0.5">
                    {fmt(num(a.mat_ek))} € Mat · {fmt(num(a.lohn_ek))} €/h Lohn · {num(a.minutes)} min/{a.unit || "St"} · EP ca. {fmt(articleEp(a))} €
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => startEdit(a)} className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm">✏️ Bearbeiten</button>
                  <button type="button" onClick={() => deleteArticle(a.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm">🗑️</button>
                </div>
              </div>
            ))}
            {articles.length === 0 && <p className="text-gray-600">Noch keine Artikel. Lege den ersten Artikel an.</p>}
            {articles.length > 0 && filtered.length === 0 && <p className="text-gray-600">Kein Artikel gefunden.</p>}
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
                  <div className="max-h-40 overflow-y-auto text-xs bg-white border border-slate-200 rounded p-2 space-y-0.5">
                    {preview.res.articles.slice(0, 8).map((a, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="truncate">{a.article_no} · {a.short_text || <em className="text-gray-400">(kein Text)</em>}</span>
                        <span className="whitespace-nowrap text-gray-600">{a.ek != null ? fmt(a.ek) + " €" : "—"}{a.unit ? " / " + a.unit : ""}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => runImport(s, preview.res)} disabled={busy || !preview.res.articles.length} className="bg-cyan-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm">{busy ? "Import läuft…" : `Importieren (${int(preview.res.articles.length)})`}</button>
                    <button type="button" onClick={() => setPreview(null)} disabled={busy} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">Abbrechen</button>
                  </div>
                  <p className="text-xs text-gray-500">Beim Import wird der bestehende Katalog dieses Lieferanten ersetzt. Große Kataloge (100.000+ Artikel) können einige Minuten dauern — Fenster offen lassen.</p>
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
