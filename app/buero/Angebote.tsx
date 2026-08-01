"use client";

import { useEffect, useState } from "react";

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
const PV_DEFAULT = "Steuerfreie Leistung \u2013 Nullsteuersatz nach \u00a7 12 Abs. 3 UStG (Lieferung und Installation einer Photovoltaikanlage).";
const B13_DEFAULT = "Steuerschuldnerschaft des Leistungsempf\u00e4ngers nach \u00a7 13b UStG. Es wird keine Umsatzsteuer ausgewiesen; die Umsatzsteuer schuldet der Leistungsempf\u00e4nger.";
const UNITS = ["St", "Stk", "Psch", "m", "lfm", "m\u00b2", "m\u00b3", "h", "Std", "Tag", "Wo", "Mon", "kg", "t", "g", "l", "Ltr", "Satz", "Paar", "Rolle", "Pkg", "Bund", "Pkt", "kW", "kWp", "A", "V", "%"];

function calcItem(it: any) {
  if (it.kind !== "position") return { ...it, ep: 0, gp: 0, mat_vk: 0, lohn_vk: 0 };
  const matVk = num(it.mat_ek) * (num(it.mat_multi) || 1);
  const lohnEk = (it.lohn_ek !== undefined && it.lohn_ek !== "") ? num(it.lohn_ek) : num(it.std_lohn);
  const lohnSatzVk = lohnEk * (num(it.lohn_multi) || 1);
  const lohnVk = lohnSatzVk * (num(it.minutes) / 60);
  const ep = matVk + lohnVk + num(it.fremd_vk) + num(it.geraet_vk);
  const gp = ep * num(it.qty) * (1 - num(it.discount_pct) / 100);
  return { ...it, mat_vk: matVk, lohn_satz_vk: lohnSatzVk, lohn_vk: lohnVk, ep, gp };
}

function offerTotals(items: any[], o: any) {
  let net = 0;
  for (const raw of items) if (raw.kind === "position") net += calcItem(raw).gp;
  const rabatt = net * (num(o.rabatt_pct) / 100);
  const nachlass = num(o.nachlass);
  const netAfter = Math.max(0, net - rabatt - nachlass);
  const vat = netAfter * (num(o.vat_rate) / 100);
  const gross = netAfter + vat;
  const skonto = netAfter * (num(o.skonto_pct) / 100);
  return { net, rabatt, nachlass, netAfter, vat, gross, skonto };
}

// Titelsumme: Summe der G-Preise der Positionen bis zum naechsten Titel
function titleSum(items: any[], idx: number) {
  let s = 0;
  for (let i = idx + 1; i < items.length; i++) {
    if (items[i].kind === "titel") break;
    if (items[i].kind === "position") s += calcItem(items[i]).gp;
  }
  return s;
}

function newItem(kind: string) {
  const base: any = { id: uid(), kind, oz: "" };
  if (kind === "titel") return { ...base, title: "" };
  if (kind === "text") return { ...base, short_text: "", long_text: "" };
  return { ...base, short_text: "", long_text: "", qty: "1", unit: "St", mat_ek: "", mat_multi: "1.28", lohn_ek: "", lohn_multi: "1.28", minutes: "", fremd_vk: "", geraet_vk: "", discount_pct: "" };
}

function blankOffer() {
  return {
    id: null as string | null, number: "", status: "entwurf", subject: "",
    offer_date: "", valid_until: "",
    customer_id: "", customer_name: "", customer_anrede: "", customer_street: "", customer_zip: "", customer_city: "",
    vat_rate: "19", rabatt_pct: "0", nachlass: "0", skonto_pct: "0", skonto_tage: "0",
    def_mat_multi: "1.28", def_lohn_multi: "1.28", binde_weeks: "",
    tax_mode: "standard", tax_note: "",
    items: [] as any[],
  };
}

// ── Komponente ─────────────────────────────────────────────────────
export default function Angebote({ supabase, companyId, customers }: { supabase: any; companyId: string; customers: any[] }) {
  const [offers, setOffers] = useState<any[]>([]);
  const [mode, setMode] = useState<"list" | "edit" | "settings">("list");
  const [o, setO] = useState<any>(blankOffer());
  const [msg, setMsg] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openItem, setOpenItem] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<any>({ def_mat_multi: "1.28", def_lohn_multi: "1.28", binde_weeks: "4", vat_rate: "19", def_rabatt_pct: "0", def_nachlass: "0", def_skonto_pct: "0", def_skonto_tage: "0", pv_text: PV_DEFAULT, b13_text: B13_DEFAULT });
  const [settingsTab, setSettingsTab] = useState("allgemein");

  useEffect(() => { if (companyId) { loadOffers(); loadSettings(); } /* eslint-disable-next-line */ }, [companyId]);

  async function loadOffers() {
    const { data, error } = await supabase.from("office_offers").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    if (error) { setMsg("Fehler beim Laden: " + error.message); return; }
    setOffers(data || []);
  }
  async function loadSettings() {
    const { data } = await supabase.from("office_offer_settings").select("*").eq("company_id", companyId).maybeSingle();
    if (data) setSettings({ def_mat_multi: String(data.def_mat_multi ?? "1.28"), def_lohn_multi: String(data.def_lohn_multi ?? "1.28"), binde_weeks: String(data.binde_weeks ?? "4"), vat_rate: String(data.vat_rate ?? "19"), def_rabatt_pct: String(data.def_rabatt_pct ?? "0"), def_nachlass: String(data.def_nachlass ?? "0"), def_skonto_pct: String(data.def_skonto_pct ?? "0"), def_skonto_tage: String(data.def_skonto_tage ?? "0"), pv_text: data.pv_text ?? PV_DEFAULT, b13_text: data.b13_text ?? B13_DEFAULT });
  }
  async function saveSettings() {
    const { error } = await supabase.from("office_offer_settings").upsert({ company_id: companyId, def_mat_multi: num(settings.def_mat_multi), def_lohn_multi: num(settings.def_lohn_multi), binde_weeks: Math.round(num(settings.binde_weeks)), vat_rate: num(settings.vat_rate), def_rabatt_pct: num(settings.def_rabatt_pct), def_nachlass: num(settings.def_nachlass), def_skonto_pct: num(settings.def_skonto_pct), def_skonto_tage: Math.round(num(settings.def_skonto_tage)), pv_text: settings.pv_text || null, b13_text: settings.b13_text || null, updated_at: new Date().toISOString() }, { onConflict: "company_id" });
    if (error) { setMsg("Fehler beim Speichern der Einstellungen: " + error.message); return; }
    setMsg("Einstellungen gespeichert.");
  }

  function startNew() {
    const b: any = blankOffer();
    b.def_mat_multi = settings.def_mat_multi || "1.28";
    b.def_lohn_multi = settings.def_lohn_multi || "1.28";
    b.binde_weeks = settings.binde_weeks || "";
    b.vat_rate = settings.vat_rate || "19";
    b.rabatt_pct = settings.def_rabatt_pct || "0";
    b.nachlass = settings.def_nachlass || "0";
    b.skonto_pct = settings.def_skonto_pct || "0";
    b.skonto_tage = settings.def_skonto_tage || "0";
    b.tax_mode = "standard"; b.tax_note = "";
    b.offer_date = new Date().toISOString().slice(0, 10);
    setO(b); setMode("edit"); setMsg(""); setCustSearch(""); setPickerOpen(false);
  }
  function editOffer(row: any) {
    setO({ ...blankOffer(), ...row, vat_rate: String(row.vat_rate ?? "19"), rabatt_pct: String(row.rabatt_pct ?? "0"), nachlass: String(row.nachlass ?? "0"), skonto_pct: String(row.skonto_pct ?? "0"), skonto_tage: String(row.skonto_tage ?? "0"), def_mat_multi: String(row.def_mat_multi ?? "1.28"), def_lohn_multi: String(row.def_lohn_multi ?? "1.28"), binde_weeks: String(row.binde_weeks ?? ""), tax_mode: row.tax_mode || "standard", tax_note: row.tax_note ?? "", items: Array.isArray(row.items) ? row.items : [] });
    setMode("edit"); setMsg("");
  }

  function set(field: string, val: any) { setO((p: any) => ({ ...p, [field]: val })); }
  function setItem(id: string, field: string, val: any) {
    setO((p: any) => ({ ...p, items: p.items.map((it: any) => it.id === id ? { ...it, [field]: val } : it) }));
  }
  function addItem(kind: string) {
    setO((p: any) => {
      const it: any = newItem(kind);
      if (kind === "position") { it.mat_multi = p.def_mat_multi || "1.28"; it.lohn_multi = p.def_lohn_multi || "1.28"; }
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
    await loadOffers(); setMsg("Angebot gespeichert.");
  }

  async function deleteOffer(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Angebot wirklich löschen?")) return;
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
          {[{ k: "allgemein", l: "Allgemein" }, { k: "rabatt", l: "Rabatt & Skonto" }, { k: "steuer", l: "Steuer / Recht" }].map((tb) => (
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
        <button type="button" onClick={saveSettings} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">💾 Einstellungen speichern</button>
      </section>
    );
  }

  // ── Liste ────────────────────────────────────────────────────────
  if (mode === "list") {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xl font-bold">🧾 Angebote <span className="text-sm font-normal text-gray-500">({offers.length})</span></h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setMode("settings"); setMsg(""); }} className="bg-slate-600 text-white px-4 py-2 rounded-lg text-sm">⚙️ Einstellungen</button>
            <button type="button" onClick={startNew} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">＋ Neues Angebot</button>
          </div>
        </div>
        {msg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{msg}</div>}
        <div className="space-y-2">
          {offers.map((row: any) => (
            <div key={row.id} className="border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <strong>{row.number || "(ohne Nr.)"}</strong>{row.subject ? <span> · {row.subject}</span> : null}
                {row.customer_name ? <div className="text-gray-600">{row.customer_name}</div> : null}
                <div className="text-gray-500 text-xs">{row.status} · Brutto {fmt(num(row.gross_total))} €</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => editOffer(row)} className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm">✏️ Öffnen</button>
                <button type="button" onClick={() => deleteOffer(row.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm">🗑️</button>
              </div>
            </div>
          ))}
          {offers.length === 0 && <p className="text-gray-600">Noch keine Angebote.</p>}
        </div>
      </section>
    );
  }

  // ── Editor ───────────────────────────────────────────────────────
  const q = custSearch.trim().toLowerCase();
  const custMatches = q ? customers.filter((k: any) => [k.name, k.debitor, k.kreditor, k.city, k.zip, k.phone, k.mobile].some((x: any) => String(x || "").toLowerCase().includes(q))).slice(0, 20) : [];

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-bold">🧾 {o.id ? "Angebot bearbeiten" : "Neues Angebot"}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={saveOffer} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">💾 Speichern</button>
          <button type="button" onClick={() => { setMode("list"); loadOffers(); }} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">Zurück zur Liste</button>
        </div>
      </div>
      {msg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{msg}</div>}

      {/* Kopf */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-200 rounded-xl p-3 bg-gray-50">
        <input className="border p-2 rounded-lg text-black bg-white" placeholder="Angebotsnummer (Start später automatisch)" value={o.number} onChange={(e) => set("number", e.target.value)} />
        <input className="border p-2 rounded-lg text-black bg-white" placeholder="Betreff / Projekt" value={o.subject} onChange={(e) => set("subject", e.target.value)} />
        <label className="text-sm text-gray-600 flex items-center gap-2">Datum <input type="date" className="border p-2 rounded-lg text-black bg-white flex-1" value={o.offer_date || ""} onChange={(e) => set("offer_date", e.target.value)} /></label>
        <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">Bindefrist <input type="number" className="border p-2 rounded-lg text-black bg-white w-20" value={o.binde_weeks} onChange={(e) => set("binde_weeks", e.target.value)} /> Wochen <span className="text-gray-500">→ gültig bis {o.binde_weeks && o.offer_date ? fmtDate(addWeeks(o.offer_date, num(o.binde_weeks))) : "—"}</span></div>
      </div>

      {/* Kalkulations-Standard */}
      <div className="border border-slate-200 rounded-xl p-3 bg-gray-50 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">🧮 Standard-Multiplikatoren:</span>
        <label className="text-sm flex items-center gap-1">Material <input className="border p-1.5 rounded text-black bg-white w-20" value={o.def_mat_multi} onChange={(e) => set("def_mat_multi", e.target.value)} /></label>
        <label className="text-sm flex items-center gap-1">Lohn <input className="border p-1.5 rounded text-black bg-white w-20" value={o.def_lohn_multi} onChange={(e) => set("def_lohn_multi", e.target.value)} /></label>
        <button type="button" onClick={applyMultisToAll} className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs">Auf alle Positionen übernehmen</button>
        <span className="text-xs text-gray-500">Neue Positionen übernehmen diese Werte automatisch.</span>
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

      {/* Positionen */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-sm">Positionen</h3>
          <button type="button" onClick={() => addItem("titel")} className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs">＋ Titel</button>
          <button type="button" onClick={() => addItem("position")} className="bg-cyan-700 text-white px-3 py-1.5 rounded-lg text-xs">＋ Position</button>
          <button type="button" onClick={() => addItem("text")} className="bg-gray-500 text-white px-3 py-1.5 rounded-lg text-xs">＋ Textposition</button>
        </div>

        {o.items.map((raw: any, idx: number) => {
          const it = calcItem(raw);
          const opened = !!openItem[it.id];
          if (it.kind === "titel") {
            return (
              <div key={it.id} className="border-l-4 border-slate-700 bg-slate-50 rounded-r-lg p-2 flex items-center gap-2">
                <input className="border p-1.5 rounded text-black bg-white w-16 text-sm" placeholder="Pos" value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} />
                <input className="border p-1.5 rounded text-black bg-white flex-1 text-sm font-bold" placeholder="Titel / Überschrift" value={it.title} onChange={(e) => setItem(it.id, "title", e.target.value)} />
                <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{fmt(titleSum(o.items, idx))} €</span>
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
                <input className="border p-1.5 rounded text-black bg-white flex-1 text-sm font-medium" placeholder="Kurztext" value={it.short_text} onChange={(e) => setItem(it.id, "short_text", e.target.value)} />
                <span className="text-sm text-right w-20 whitespace-nowrap" title="Einzelpreis">{fmt(it.ep)}</span>
                <span className="text-sm font-bold text-right w-24 whitespace-nowrap" title="Gesamtpreis">{fmt(it.gp)} €</span>
                {itemButtons(it.id)}
              </div>
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
                    <label className="flex flex-col">Fremd-Vk<input className="border p-1.5 rounded text-black bg-white" value={it.fremd_vk} onChange={(e) => setItem(it.id, "fremd_vk", e.target.value)} /></label>
                    <label className="flex flex-col">Gerät-Vk<input className="border p-1.5 rounded text-black bg-white" value={it.geraet_vk} onChange={(e) => setItem(it.id, "geraet_vk", e.target.value)} /></label>
                    <label className="flex flex-col text-gray-500">E-Preis<input className="border p-1.5 rounded bg-gray-100 font-medium" value={fmt(it.ep)} readOnly /></label>
                    <label className="flex flex-col text-gray-500">G-Preis<input className="border p-1.5 rounded bg-gray-100 font-bold" value={fmt(it.gp)} readOnly /></label>
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
