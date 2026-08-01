"use client";

import { useEffect, useState } from "react";

// ── Hilfsfunktionen ────────────────────────────────────────────────
const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function calcItem(it: any) {
  if (it.kind !== "position") return { ...it, ep: 0, gp: 0, mat_vk: 0, lohn_vk: 0 };
  const matVk = num(it.mat_ek) * (num(it.mat_multi) || 1);
  const lohnVk = num(it.std_lohn) * (num(it.minutes) / 60);
  const ep = matVk + lohnVk + num(it.fremd_vk) + num(it.geraet_vk);
  const gp = ep * num(it.qty) * (1 - num(it.discount_pct) / 100);
  return { ...it, mat_vk: matVk, lohn_vk: lohnVk, ep, gp };
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
  return { ...base, short_text: "", long_text: "", qty: "1", unit: "St", mat_ek: "", mat_multi: "1.28", std_lohn: "", minutes: "", fremd_vk: "", geraet_vk: "", discount_pct: "" };
}

function blankOffer() {
  return {
    id: null as string | null, number: "", status: "entwurf", subject: "",
    offer_date: "", valid_until: "",
    customer_id: "", customer_name: "", customer_anrede: "", customer_street: "", customer_zip: "", customer_city: "",
    vat_rate: "19", rabatt_pct: "0", nachlass: "0", skonto_pct: "0", skonto_tage: "0",
    items: [] as any[],
  };
}

// ── Komponente ─────────────────────────────────────────────────────
export default function Angebote({ supabase, companyId, customers }: { supabase: any; companyId: string; customers: any[] }) {
  const [offers, setOffers] = useState<any[]>([]);
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [o, setO] = useState<any>(blankOffer());
  const [msg, setMsg] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openItem, setOpenItem] = useState<Record<string, boolean>>({});

  useEffect(() => { if (companyId) loadOffers(); /* eslint-disable-next-line */ }, [companyId]);

  async function loadOffers() {
    const { data, error } = await supabase.from("office_offers").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    if (error) { setMsg("Fehler beim Laden: " + error.message); return; }
    setOffers(data || []);
  }

  function startNew() { setO(blankOffer()); setMode("edit"); setMsg(""); setCustSearch(""); setPickerOpen(false); }
  function editOffer(row: any) {
    setO({ ...blankOffer(), ...row, vat_rate: String(row.vat_rate ?? "19"), rabatt_pct: String(row.rabatt_pct ?? "0"), nachlass: String(row.nachlass ?? "0"), skonto_pct: String(row.skonto_pct ?? "0"), skonto_tage: String(row.skonto_tage ?? "0"), items: Array.isArray(row.items) ? row.items : [] });
    setMode("edit"); setMsg("");
  }

  function set(field: string, val: any) { setO((p: any) => ({ ...p, [field]: val })); }
  function setItem(id: string, field: string, val: any) {
    setO((p: any) => ({ ...p, items: p.items.map((it: any) => it.id === id ? { ...it, [field]: val } : it) }));
  }
  function addItem(kind: string) { setO((p: any) => ({ ...p, items: [...p.items, newItem(kind)] })); }
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
      offer_date: o.offer_date || null, valid_until: o.valid_until || null,
      customer_id: o.customer_id || null, customer_name: o.customer_name || null, customer_anrede: o.customer_anrede || null,
      customer_street: o.customer_street || null, customer_zip: o.customer_zip || null, customer_city: o.customer_city || null,
      vat_rate: num(o.vat_rate), rabatt_pct: num(o.rabatt_pct), nachlass: num(o.nachlass), skonto_pct: num(o.skonto_pct), skonto_tage: num(o.skonto_tage),
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

  // ── Liste ────────────────────────────────────────────────────────
  if (mode === "list") {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xl font-bold">🧾 Angebote <span className="text-sm font-normal text-gray-500">({offers.length})</span></h2>
          <button type="button" onClick={startNew} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">＋ Neues Angebot</button>
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
        <label className="text-sm text-gray-600 flex items-center gap-2">gültig bis <input type="date" className="border p-2 rounded-lg text-black bg-white flex-1" value={o.valid_until || ""} onChange={(e) => set("valid_until", e.target.value)} /></label>
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
                <input className="border p-1.5 rounded text-black bg-white w-16 text-sm" placeholder="OZ" value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} />
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
                  <input className="border p-1.5 rounded text-black bg-white w-16 text-sm" placeholder="OZ" value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} />
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
                <input className="border p-1.5 rounded text-black bg-white w-16 text-sm" placeholder="OZ" value={it.oz} onChange={(e) => setItem(it.id, "oz", e.target.value)} />
                <input className="border p-1.5 rounded text-black bg-white flex-1 text-sm font-medium" placeholder="Kurztext" value={it.short_text} onChange={(e) => setItem(it.id, "short_text", e.target.value)} />
                <input className="border p-1.5 rounded text-black bg-white w-16 text-sm text-right" placeholder="Menge" value={it.qty} onChange={(e) => setItem(it.id, "qty", e.target.value)} />
                <input className="border p-1.5 rounded text-black bg-white w-14 text-sm" placeholder="Einh." value={it.unit} onChange={(e) => setItem(it.id, "unit", e.target.value)} />
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
                    <label className="flex flex-col">Std.-Satz<input className="border p-1.5 rounded text-black bg-white" value={it.std_lohn} onChange={(e) => setItem(it.id, "std_lohn", e.target.value)} /></label>
                    <label className="flex flex-col">Minuten<input className="border p-1.5 rounded text-black bg-white" value={it.minutes} onChange={(e) => setItem(it.id, "minutes", e.target.value)} /></label>
                    <label className="flex flex-col text-gray-500">Lohn-Vk<input className="border p-1.5 rounded bg-gray-100" value={fmt(it.lohn_vk)} readOnly /></label>
                    <div />
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
