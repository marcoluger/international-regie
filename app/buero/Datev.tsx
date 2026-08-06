"use client";

// Stufe 8a — Buchhaltung, Teil 1: Ausgangsrechnungen als DATEV-Buchungsstapel exportieren.
// Die Buchhalterin importiert die erzeugte EXTF-CSV im DATEV-Rechnungswesen
// (Stapelverarbeitung -> Importieren -> DATEV-Format) statt Rechnungen abzutippen.

import { useEffect, useState } from "react";
import { buildDatevCsv, datevFileName, toCp1252, type DatevRow } from "./datevExport";

const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtDate(iso: string) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : String(iso);
}

// Standard-Erloeskonten je Kontenrahmen (vom Steuerberater bestaetigen lassen!)
const DEFAULT_KONTEN: Record<string, { k19: string; kpv: string; k13b: string }> = {
  SKR03: { k19: "8400", kpv: "8290", k13b: "8337" },
  SKR04: { k19: "4400", kpv: "4290", k13b: "4337" },
};
const TAX_LABEL: Record<string, string> = { standard: "19 %", pv: "PV 0 %", b13: "§13b" };

function blankSettings() {
  return {
    kontenrahmen: "SKR03", berater_nr: "", mandant_nr: "", sachkonto_len: "4",
    konto_erloes_19: "8400", konto_erloes_pv: "8290", konto_erloes_13b: "8337",
    bu_19: "", bu_pv: "", bu_13b: "", debitor_default: "",
  };
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const von = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const bis = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { von, bis };
}

export default function Datev({ supabase, companyId, customers }: { supabase: any; companyId: string; customers: any[] }) {
  const now = new Date();
  const [s, setS] = useState<any>(blankSettings());
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [rows, setRows] = useState<any[]>([]);
  const [exportsLog, setExportsLog] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (companyId) { loadSettings(); loadLog(); } /* eslint-disable-next-line */ }, [companyId]);
  useEffect(() => { if (companyId) loadInvoices(); /* eslint-disable-next-line */ }, [companyId, month]);

  async function loadSettings() {
    const { data } = await supabase.from("office_datev_settings").select("*").eq("company_id", companyId).maybeSingle();
    if (data) setS({ ...blankSettings(), ...data, sachkonto_len: String(data.sachkonto_len ?? "4") });
  }
  async function saveSettings() {
    const payload = {
      company_id: companyId,
      kontenrahmen: s.kontenrahmen || "SKR03",
      berater_nr: s.berater_nr?.trim() || null, mandant_nr: s.mandant_nr?.trim() || null,
      sachkonto_len: Math.min(8, Math.max(4, Math.round(num(s.sachkonto_len)) || 4)),
      konto_erloes_19: s.konto_erloes_19?.trim() || null,
      konto_erloes_pv: s.konto_erloes_pv?.trim() || null,
      konto_erloes_13b: s.konto_erloes_13b?.trim() || null,
      bu_19: s.bu_19?.trim() || null, bu_pv: s.bu_pv?.trim() || null, bu_13b: s.bu_13b?.trim() || null,
      debitor_default: s.debitor_default?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("office_datev_settings").upsert(payload);
    setMsg(error ? "Fehler beim Speichern: " + error.message : "Einstellungen gespeichert.");
  }
  function setDefaults(kr: string) {
    const d = DEFAULT_KONTEN[kr] || DEFAULT_KONTEN.SKR03;
    setS((p: any) => ({ ...p, kontenrahmen: kr, konto_erloes_19: d.k19, konto_erloes_pv: d.kpv, konto_erloes_13b: d.k13b }));
  }

  async function loadInvoices() {
    setLoading(true);
    const { von, bis } = monthRange(month);
    const { data, error } = await supabase.from("office_offers").select("id,number,doc_date,offer_date,customer_id,customer_name,tax_mode,net_total,vat_total,gross_total,status,doc_type")
      .eq("company_id", companyId).eq("doc_type", "rechnung")
      .gte("doc_date", von).lte("doc_date", bis)
      .order("doc_date", { ascending: true });
    setLoading(false);
    if (error) { setMsg("Fehler beim Laden: " + error.message); return; }
    setRows((data || []).filter((r: any) => (r.status || "entwurf") !== "entwurf"));
  }
  async function loadLog() {
    const { data } = await supabase.from("office_datev_exports").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(10);
    setExportsLog(data || []);
  }

  // Zeile pruefen: Debitor + Erloeskonto + Nummer + Datum muessen da sein.
  function mapRow(r: any): { row?: DatevRow; fehler?: string; debitor?: string; konto?: string; bu?: string } {
    const cust = customers.find((k: any) => k.id === r.customer_id);
    const debitor = String(cust?.debitor || "").trim() || String(s.debitor_default || "").trim();
    const mode = r.tax_mode || "standard";
    const konto = mode === "pv" ? s.konto_erloes_pv : mode === "b13" ? s.konto_erloes_13b : s.konto_erloes_19;
    const bu = mode === "pv" ? s.bu_pv : mode === "b13" ? s.bu_13b : s.bu_19;
    if (!r.number) return { fehler: "Rechnungsnummer fehlt", debitor, konto, bu };
    if (!r.doc_date) return { fehler: "Belegdatum fehlt", debitor, konto, bu };
    if (!debitor) return { fehler: "Debitor fehlt (Kunde ohne Debitor-Nr., kein Standard-Debitor)", debitor, konto, bu };
    if (!String(konto || "").trim()) return { fehler: `Erlöskonto ${TAX_LABEL[mode] || mode} fehlt (Einstellungen)`, debitor, konto, bu };
    return { debitor, konto, bu, row: { brutto: num(r.gross_total), debitor, gegenkonto: konto, bu: bu || "", belegdatum: r.doc_date, belegnr: r.number, text: r.customer_name || "" } };
  }

  const mapped = rows.map((r: any) => ({ r, m: mapRow(r) }));
  const ok = mapped.filter((x) => x.m.row);
  const bad = mapped.filter((x) => !x.m.row);
  const summe = ok.reduce((a, x) => a + num(x.r.gross_total), 0);

  async function doExport() {
    if (!ok.length) { setMsg("Keine exportierbaren Rechnungen im Zeitraum."); return; }
    const { von, bis } = monthRange(month);
    const csv = buildDatevCsv(ok.map((x) => x.m.row!), {
      kontenrahmen: s.kontenrahmen, berater_nr: s.berater_nr, mandant_nr: s.mandant_nr, sachkonto_len: Math.round(num(s.sachkonto_len)) || 4,
    }, von, bis, `Rechnungen ${month}`);
    const name = datevFileName(von, bis);
    const blob = new Blob([toCp1252(csv) as any], { type: "text/csv;charset=windows-1252" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
    await supabase.from("office_datev_exports").insert({ company_id: companyId, von, bis, anzahl: ok.length, summe: Math.round(summe * 100) / 100, file_name: name });
    await loadLog();
    setMsg(`${ok.length} Buchung${ok.length === 1 ? "" : "en"} exportiert (${name}). In DATEV: Stapelverarbeitung → Importieren → DATEV-Format.`);
  }

  const set = (k: string, v: any) => setS((p: any) => ({ ...p, [k]: v }));

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      <h2 className="text-xl font-bold">📚 Buchhaltung — DATEV-Export</h2>
      {msg && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 text-sm">{msg}</div>}

      {/* Einstellungen */}
      <div className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-bold text-sm">⚙️ DATEV-Einstellungen</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <label className="text-sm flex items-center gap-2">Kontenrahmen
              <select className="border p-2 rounded-lg text-black bg-white" value={s.kontenrahmen} onChange={(e) => setDefaults(e.target.value)}>
                <option value="SKR03">SKR03</option>
                <option value="SKR04">SKR04</option>
              </select>
            </label>
            <button type="button" onClick={saveSettings} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">💾 Speichern</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <label className="flex flex-col">Beraternummer<input className="border p-2 rounded-lg text-black bg-white" placeholder="vom Steuerbüro" value={s.berater_nr || ""} onChange={(e) => set("berater_nr", e.target.value)} /></label>
          <label className="flex flex-col">Mandantennummer<input className="border p-2 rounded-lg text-black bg-white" placeholder="vom Steuerbüro" value={s.mandant_nr || ""} onChange={(e) => set("mandant_nr", e.target.value)} /></label>
          <label className="flex flex-col" title="Länge der Sachkonten in DATEV (Standard 4)">Sachkontenlänge<input className="border p-2 rounded-lg text-black bg-white" value={s.sachkonto_len || "4"} onChange={(e) => set("sachkonto_len", e.target.value)} /></label>
          <label className="flex flex-col" title="Wird verwendet, wenn ein Kunde keine Debitor-Nr. im Kundenstamm hat">Standard-Debitor<input className="border p-2 rounded-lg text-black bg-white" placeholder="z. B. 10000" value={s.debitor_default || ""} onChange={(e) => set("debitor_default", e.target.value)} /></label>
          <label className="flex flex-col">Erlöskonto 19 %<input className="border p-2 rounded-lg text-black bg-white" value={s.konto_erloes_19 || ""} onChange={(e) => set("konto_erloes_19", e.target.value)} /></label>
          <label className="flex flex-col">Erlöskonto PV 0 %<input className="border p-2 rounded-lg text-black bg-white" value={s.konto_erloes_pv || ""} onChange={(e) => set("konto_erloes_pv", e.target.value)} /></label>
          <label className="flex flex-col">Erlöskonto §13b<input className="border p-2 rounded-lg text-black bg-white" value={s.konto_erloes_13b || ""} onChange={(e) => set("konto_erloes_13b", e.target.value)} /></label>
          <label className="flex flex-col" title="Nur nötig, wenn das Konto kein Automatikkonto ist — mit dem Steuerbüro abstimmen">BU-Schlüssel (19 % / PV / §13b)
            <div className="flex gap-1">
              <input className="border p-2 rounded-lg text-black bg-white w-full" placeholder="19%" value={s.bu_19 || ""} onChange={(e) => set("bu_19", e.target.value)} />
              <input className="border p-2 rounded-lg text-black bg-white w-full" placeholder="PV" value={s.bu_pv || ""} onChange={(e) => set("bu_pv", e.target.value)} />
              <input className="border p-2 rounded-lg text-black bg-white w-full" placeholder="13b" value={s.bu_13b || ""} onChange={(e) => set("bu_13b", e.target.value)} />
            </div>
          </label>
        </div>
        <p className="text-xs text-gray-500">Standardkonten {s.kontenrahmen}: 19 % → {DEFAULT_KONTEN[s.kontenrahmen]?.k19} · PV 0 % (§12 Abs. 3) → {DEFAULT_KONTEN[s.kontenrahmen]?.kpv} · §13b → {DEFAULT_KONTEN[s.kontenrahmen]?.k13b}. Bitte einmal vom Steuerbüro bestätigen lassen (BU-Schlüssel meist leer, da Automatikkonten).</p>
      </div>

      {/* Export */}
      <div className="border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-bold text-sm">📤 Ausgangsrechnungen exportieren</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <input type="month" className="border p-2 rounded-lg text-black bg-white" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button type="button" onClick={doExport} disabled={!ok.length} className="bg-emerald-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm">⬇️ DATEV-Datei erzeugen ({ok.length})</button>
          </div>
        </div>
        <p className="text-xs text-gray-500">Berücksichtigt werden Rechnungen mit Belegdatum im gewählten Monat, die nicht mehr „entwurf“ sind. Je Rechnung eine Buchung: Brutto an Debitor (Soll), Gegenkonto = Erlöskonto je Steuermodus.</p>
        {loading && <p className="text-xs text-gray-500">Lade Rechnungen…</p>}

        {bad.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm space-y-1">
            <strong>⚠️ {bad.length} Rechnung{bad.length === 1 ? "" : "en"} nicht exportierbar:</strong>
            {bad.map((x) => <div key={x.r.id} className="text-xs">• {x.r.number || "(ohne Nr.)"} — {x.m.fehler}</div>)}
          </div>
        )}

        <div className="space-y-1">
          {ok.map((x) => (
            <div key={x.r.id} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-lg p-2 text-sm">
              <strong className="whitespace-nowrap">{x.r.number}</strong>
              <span className="text-xs text-gray-500">{fmtDate(x.r.doc_date)}</span>
              <span className="min-w-0 flex-1 truncate">{x.r.customer_name || "—"}</span>
              <span className="text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{TAX_LABEL[x.r.tax_mode || "standard"]}</span>
              <span className="text-xs text-gray-500">Deb. {x.m.debitor} → {x.m.konto}{x.m.bu ? ` (BU ${x.m.bu})` : ""}</span>
              <span className="font-medium whitespace-nowrap">{fmt(num(x.r.gross_total))} €</span>
            </div>
          ))}
          {!loading && rows.length === 0 && <p className="text-gray-600 text-sm">Keine Rechnungen (ohne Entwürfe) im gewählten Monat.</p>}
        </div>
        {ok.length > 0 && <p className="text-sm font-bold text-right">Summe brutto: {fmt(summe)} €</p>}
      </div>

      {/* Protokoll */}
      {exportsLog.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-3 space-y-1">
          <h3 className="font-bold text-sm">🗂 Letzte Exporte</h3>
          {exportsLog.map((e: any) => (
            <div key={e.id} className="text-xs text-gray-600 flex flex-wrap gap-2">
              <span>{fmtDate(String(e.created_at).slice(0, 10))}</span>
              <span>{fmtDate(e.von)} – {fmtDate(e.bis)}</span>
              <span>{e.anzahl} Buchungen</span>
              <span>{fmt(num(e.summe))} €</span>
              <span className="text-gray-400">{e.file_name}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
