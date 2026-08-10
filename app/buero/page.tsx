"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Angebote from "./Angebote";
import Artikel from "./Artikel";
import Buchhaltung from "./Buchhaltung";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const BUERO_TABS = [
  { key: "auftraege", label: "🛠 Auftrag/Störung" },
  { key: "mitarbeiter", label: "👤 Mitarbeiter" },
  { key: "kunden", label: "👥 Kunden" },
  { key: "leistungen", label: "🔧 Leistungen" },
  { key: "artikel", label: "📦 Artikel" },
  { key: "angebote", label: "🧾 Angebote" },
  { key: "ab", label: "📋 Auftragsbestätigung" },
  { key: "rechnung", label: "💶 Rechnung" },
  { key: "buchhaltung", label: "💰 Buchhaltung" },
];

export default function BueroPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [officeEnabled, setOfficeEnabled] = useState(false);
  const [message, setMessage] = useState("");

  // Passwort-Gate
  const [officePassword, setOfficePassword] = useState<string | null>(null);
  const [officePwLoaded, setOfficePwLoaded] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [newPw, setNewPw] = useState("");

  // Navigation innerhalb des Büro-Bereichs
  const [tab, setTab] = useState("auftraege");

  // Mitarbeiter
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [officeEmployees, setOfficeEmployees] = useState<any[]>([]);
  const [eid, setEid] = useState<string | null>(null);
  const [oName, setOName] = useState("");
  const [oRole, setORole] = useState("");
  const [oPhone, setOPhone] = useState("");
  const [oEmail, setOEmail] = useState("");
  // Kunden
  const [customers, setCustomers] = useState<any[]>([]);
  const [custSearch, setCustSearch] = useState("");
  const [custFilter, setCustFilter] = useState("alle");
  const [custSort, setCustSort] = useState("vorname");
  const [letterFilter, setLetterFilter] = useState("");
  const [openCusts, setOpenCusts] = useState<Record<string, boolean>>({});
  const [cEditId, setCEditId] = useState<string | null>(null);
  const [cName, setCName] = useState("");
  const [cDebitor, setCDebitor] = useState("");
  const [cKreditor, setCKreditor] = useState("");
  const [cType, setCType] = useState("debitor");
  // Auftrags-/Störungsannahme
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSelId, setOrderSelId] = useState<string | null>(null);
  const [orderEntry, setOrderEntry] = useState("");
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [qName, setQName] = useState("");
  const [qStreet, setQStreet] = useState("");
  const [qZip, setQZip] = useState("");
  const [qCity, setQCity] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qMobile, setQMobile] = useState("");
  const [cStreet, setCStreet] = useState("");
  const [cZip, setCZip] = useState("");
  const [cCity, setCCity] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cMobile, setCMobile] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cWebsite, setCWebsite] = useState("");
  const [cUid, setCUid] = useState("");
  const [cNote, setCNote] = useState("");
  const [cAnrede, setCAnrede] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { init(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const el = noteRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [cNote, noteOpen]);

  async function init() {
    const { data: sess } = await supabase.auth.getUser();
    const u = sess?.user;
    if (!u) { setLoading(false); return; }
    setUser(u);
    const { data: cu } = await supabase.from("company_users").select("company_id, role").eq("user_id", u.id).maybeSingle();
    if (!cu) { setLoading(false); return; }
    setCompanyId(cu.company_id);
    setRole(cu.role);
    const { data: comp } = await supabase.from("companies").select("name").eq("id", cu.company_id).maybeSingle();
    setCompanyName(comp?.name || "");
    const { data: feat } = await supabase.from("company_features").select("office_enabled").eq("company_id", cu.company_id).maybeSingle();
    setOfficeEnabled(!!feat?.office_enabled);
    const { data: us } = await supabase.from("company_users").select("*").eq("company_id", cu.company_id);
    setCompanyUsers(us || []);
    const { data: os } = await supabase.from("office_settings").select("office_password").eq("company_id", cu.company_id).maybeSingle();
    setOfficePassword((os && os.office_password) ? os.office_password : null);
    setOfficePwLoaded(true);
    await loadOfficeEmployees(cu.company_id);
    await loadCustomers(cu.company_id);
    setLoading(false);
  }

  async function loadOfficeEmployees(cid: string) {
    const { data, error } = await supabase.from("office_employees").select("*").eq("company_id", cid).order("created_at", { ascending: false });
    if (error) { setMessage("Fehler beim Laden der Büro-Mitarbeiter: " + error.message); return; }
    setOfficeEmployees(data || []);
  }

  async function saveOfficePassword() {
    const pw = newPw.trim();
    if (pw.length < 4) { setMessage("Büro-Passwort zu kurz (min. 4 Zeichen)."); return; }
    const { error } = await supabase.from("office_settings").upsert({ company_id: companyId, office_password: pw }, { onConflict: "company_id" });
    if (error) { setMessage("Fehler beim Speichern des Passworts: " + error.message); return; }
    setOfficePassword(pw); setNewPw(""); setUnlocked(true); setMessage("Büro-Passwort gespeichert.");
  }

  function unlock() {
    if (officePassword && pwInput === officePassword) { setUnlocked(true); setPwInput(""); setMessage(""); }
    else setMessage("Falsches Büro-Passwort.");
  }

  function resetForm() { setEid(null); setOName(""); setORole(""); setOPhone(""); setOEmail(""); }
  function startEdit(m: any) { setEid(m.id); setOName(m.name || ""); setORole(m.role || ""); setOPhone(m.phone || ""); setOEmail(m.email || ""); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function saveEmployee() {
    if (!oName.trim()) { setMessage("Bitte einen Namen eingeben."); return; }
    const payload = { name: oName.trim(), role: oRole.trim(), phone: oPhone.trim(), email: oEmail.trim() };
    if (eid) {
      const { error } = await supabase.from("office_employees").update(payload).eq("id", eid);
      if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    } else {
      const { error } = await supabase.from("office_employees").insert({ company_id: companyId, ...payload });
      if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    }
    resetForm(); await loadOfficeEmployees(companyId); setMessage("Büro-Mitarbeiter gespeichert.");
  }

  async function deleteEmployee(id: string) {
    const { error } = await supabase.from("office_employees").delete().eq("id", id);
    if (error) { setMessage("Fehler beim Löschen: " + error.message); return; }
    if (eid === id) resetForm();
    await loadOfficeEmployees(companyId);
  }

  async function loadCustomers(cid: string) {
    const { data, error } = await supabase.from("office_customers").select("*").eq("company_id", cid).order("name", { ascending: true });
    if (error) { setMessage("Fehler beim Laden der Kunden: " + error.message); return; }
    setCustomers(data || []);
  }
  function nextDebitorNo() {
    const nums = customers.map((k: any) => parseInt(String(k.debitor || ""), 10)).filter((n: number) => !isNaN(n) && n < 90000);
    return (nums.length ? Math.max(...nums) : 10000) + 1;
  }
  function nextKreditorNo() {
    const nums = customers.map((k: any) => parseInt(String(k.kreditor || ""), 10)).filter((n: number) => !isNaN(n) && n < 90000);
    return (nums.length ? Math.max(...nums) : 70000) + 1;
  }
  async function addOrderEntry() {
    const k = customers.find((c: any) => c.id === orderSelId);
    if (!k) { setMessage("Bitte zuerst einen Kunden auswählen."); return; }
    const text = orderEntry.trim();
    if (!text) { setMessage("Bitte einen Text für die Karteikarte eingeben."); return; }
    const me = companyUsers.find((u: any) => u.user_id === (user && user.id));
    const author = me ? (me.full_name || me.email || "") : "";
    const stamp = new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const line = "[" + stamp + (author ? " – " + author : "") + "] " + text;
    const prev = String(k.note || "").trimEnd();
    const newNote = prev ? (prev + "\n" + line) : line;
    const { error } = await supabase.from("office_customers").update({ note: newNote }).eq("id", k.id);
    if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    setOrderEntry(""); await loadCustomers(companyId); setMessage("Eintrag in Karteikarte gespeichert.");
  }
  async function createQuickCustomer() {
    if (!qName.trim()) { setMessage("Bitte einen Namen eingeben."); return; }
    const deb = String(nextDebitorNo());
    const payload = { company_id: companyId, name: qName.trim(), debitor: deb, customer_no: deb, kind: "debitor", street: qStreet.trim(), zip: qZip.trim(), city: qCity.trim(), phone: qPhone.trim(), mobile: qMobile.trim() };
    const { data, error } = await supabase.from("office_customers").insert(payload).select("id").single();
    if (error) { setMessage("Fehler beim Anlegen: " + error.message); return; }
    setQName(""); setQStreet(""); setQZip(""); setQCity(""); setQPhone(""); setQMobile(""); setNewCustOpen(false);
    await loadCustomers(companyId);
    if (data && data.id) setOrderSelId(data.id);
    setMessage("Neuer Kunde angelegt (Debitor " + deb + ").");
  }
  function resetCustForm() { setCEditId(null); setCName(""); setCDebitor(""); setCKreditor(""); setCType("debitor"); setCStreet(""); setCZip(""); setCCity(""); setCPhone(""); setCMobile(""); setCEmail(""); setCWebsite(""); setCUid(""); setCNote(""); setCAnrede(""); setNoteOpen(false); }
  function startEditCust(k: any) {
    setCEditId(k.id); setCName(k.name || ""); setCDebitor(k.debitor || ""); setCKreditor(k.kreditor || ""); setCType(k.debitor && String(k.debitor).trim() ? "debitor" : "kreditor"); setCStreet(k.street || ""); setCZip(k.zip || ""); setCCity(k.city || "");
    setCPhone(k.phone || ""); setCMobile(k.mobile || ""); setCEmail(k.email || ""); setCWebsite(k.website || ""); setCUid(k.uid || ""); setCNote(k.note || ""); setCAnrede(k.anrede || ""); setNoteOpen(!!(k.note && String(k.note).trim()));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveCustomer() {
    if (!cName.trim()) { setMessage("Bitte einen Kundennamen eingeben."); return; }
    let deb = cDebitor.trim(); let kre = cKreditor.trim();
    if (!cEditId) {
      if (cType === "kreditor") { kre = String(nextKreditorNo()); deb = ""; }
      else { deb = String(nextDebitorNo()); kre = ""; }
    }
    const kind = deb && kre ? "beides" : kre ? "kreditor" : deb ? "debitor" : "sonstige";
    const payload = { name: cName.trim(), debitor: deb, kreditor: kre, customer_no: deb || kre, kind, anrede: cAnrede.trim(), street: cStreet.trim(), zip: cZip.trim(), city: cCity.trim(), phone: cPhone.trim(), mobile: cMobile.trim(), email: cEmail.trim(), website: cWebsite.trim(), uid: cUid.trim(), note: cNote.trim() };
    if (cEditId) {
      const { error } = await supabase.from("office_customers").update(payload).eq("id", cEditId);
      if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    } else {
      const { error } = await supabase.from("office_customers").insert({ company_id: companyId, ...payload });
      if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    }
    resetCustForm(); await loadCustomers(companyId); setMessage("Kunde gespeichert.");
  }
  async function deleteCustomer(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Diesen Kunden wirklich löschen?")) return;
    const { error } = await supabase.from("office_customers").delete().eq("id", id);
    if (error) { setMessage("Fehler beim Löschen: " + error.message); return; }
    if (cEditId === id) resetCustForm();
    await loadCustomers(companyId);
  }

  const isManager = role === "owner" || role === "admin";

  return (
    <div className="min-h-full bg-slate-50">
      {/* Kopfzeile */}
      <div className="bg-gradient-to-br from-cyan-700 to-cyan-900 text-white">
        <div className="max-w-[1800px] mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">🏢 Büro</h1>
            <p className="text-cyan-100 text-sm">{companyName ? companyName + " · " : ""}Auftragsverwaltung</p>
          </div>
          <a href="/" className="bg-white/15 hover:bg-white/25 border border-white/30 rounded-lg px-4 py-2 text-sm font-medium">← Zurück zur App</a>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 py-6 space-y-4">
        {message && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-sm">{message}</div>}

        {loading ? (
          <p className="text-gray-500">Lädt…</p>
        ) : !user ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <p className="font-medium">Bitte zuerst in der App anmelden.</p>
            <a href="/" className="text-cyan-700 underline text-sm">Zur Anmeldung</a>
          </div>
        ) : !isManager ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <p className="font-medium">🔒 Kein Zugriff. Der Büro-Bereich ist nur für Owner und Admin.</p>
          </div>
        ) : !officeEnabled ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <p className="font-medium">Das Modul „Büro" ist für diese Firma nicht aktiviert.</p>
            <p className="text-sm text-gray-500 mt-1">Bitte in der Admin-Seite unter „Module" das Modul „🏢 Büro" einschalten.</p>
          </div>
        ) : !unlocked ? (
          (officePwLoaded && !officePassword) ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-3 max-w-md">
              <p className="font-medium">🔒 Für den Büro-Bereich ist noch kein Passwort gesetzt. Bitte lege eines fest.</p>
              <input type="password" className="border p-3 w-full text-black bg-white rounded-lg" placeholder="Neues Büro-Passwort (min. 4 Zeichen)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <button type="button" onClick={saveOfficePassword} className="bg-cyan-700 text-white px-4 py-3 rounded-lg">Passwort speichern & öffnen</button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3 max-w-md">
              <p className="font-medium">🔒 Dieser Bereich ist passwortgeschützt.</p>
              <input type="password" className="border p-3 w-full text-black bg-white rounded-lg" placeholder="Büro-Passwort" value={pwInput} onChange={(e) => setPwInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") unlock(); }} />
              <button type="button" onClick={unlock} className="bg-cyan-700 text-white px-4 py-3 rounded-lg">Öffnen</button>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-green-700 font-medium">🔓 Büro entsperrt</p>
              <button type="button" onClick={() => setUnlocked(false)} className="text-sm text-gray-500 underline">Sperren</button>
            </div>

            {/* Tab-Leiste */}
            <div className="flex flex-wrap gap-2">
              {BUERO_TABS.map((tb) => (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => setTab(tb.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === tb.key ? "bg-cyan-700 text-white shadow-sm" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {/* Tab: Mitarbeiter */}
            {tab === "mitarbeiter" && (
              <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <h2 className="text-xl font-bold">👤 Büro-Mitarbeiter</h2>

                <div className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-gray-50 space-y-3">
                  <h3 className="font-bold">{eid ? "Mitarbeiter bearbeiten" : "Mitarbeiter anlegen"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Name *" value={oName} onChange={(e) => setOName(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Rolle / Funktion" value={oRole} onChange={(e) => setORole(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Telefon" value={oPhone} onChange={(e) => setOPhone(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="E-Mail" value={oEmail} onChange={(e) => setOEmail(e.target.value)} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={saveEmployee} className="bg-cyan-700 text-white px-4 py-3 rounded-lg">{eid ? "💾 Speichern" : "Anlegen"}</button>
                    {eid && (<button type="button" onClick={resetForm} className="bg-gray-200 px-4 py-3 rounded-lg">Abbrechen</button>)}
                  </div>
                </div>

                <div className="space-y-2">
                  {companyUsers.filter((u: any) => u.role === "owner" || u.role === "admin").map((u: any) => (
                    <div key={"cu-" + u.user_id} className="border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-2 bg-cyan-50">
                      <div>
                        <strong>{u.full_name || u.email}</strong>
                        <span className="text-sm text-gray-600"> · {u.role === "owner" ? "Owner" : "Admin"}</span>
                        {u.phone ? <span className="text-sm text-gray-600"> · 📞 {u.phone}</span> : null}
                      </div>
                      <span className="text-xs text-gray-400">aus App</span>
                    </div>
                  ))}
                  {officeEmployees.map((m: any) => (
                    <div key={m.id} className="border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong>{m.name}</strong>
                        {m.role ? <span className="text-sm text-gray-600"> · {m.role}</span> : null}
                        {m.phone ? <span className="text-sm text-gray-600"> · 📞 {m.phone}</span> : null}
                        {m.email ? <span className="text-sm text-gray-600"> · {m.email}</span> : null}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(m)} className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm">✏️ Bearbeiten</button>
                        <button type="button" onClick={() => deleteEmployee(m.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm">Löschen</button>
                      </div>
                    </div>
                  ))}
                  {officeEmployees.length === 0 && <p className="text-gray-600">Noch keine separaten Büro-Mitarbeiter angelegt.</p>}
                </div>
              </section>
            )}

            {/* Tab: Kunden */}
            {tab === "kunden" && (
              <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">👥 Kunden <span className="text-sm font-normal text-gray-500">({customers.length})</span></h2>
                  <div className="flex gap-2 items-center flex-wrap">
                    <select className="border p-2 rounded-lg text-black bg-white" value={custFilter} onChange={(e) => setCustFilter(e.target.value)}>
                      <option value="alle">Alle</option>
                      <option value="debitor">Nur Debitoren (Kunden)</option>
                      <option value="kreditor">Nur Kreditoren (Lieferanten)</option>
                    </select>
                    <select className="border p-2 rounded-lg text-black bg-white" value={custSort} onChange={(e) => setCustSort(e.target.value)}>
                      <option value="vorname">Sortierung: Vorname</option>
                      <option value="nachname">Sortierung: Nachname</option>
                    </select>
                    <input className="border p-2 rounded-lg text-black bg-white w-full sm:w-72" placeholder="Suche: Name, Nr., Ort, Telefon, E-Mail…" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
                  </div>
                </div>
                <div className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-gray-50 space-y-3">
                  <h3 className="font-bold">{cEditId ? "Kunde bearbeiten" : "Neuen Kunden anlegen"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Name / Firma *" value={cName} onChange={(e) => setCName(e.target.value)} />
                    <div className="md:col-span-2 flex items-center gap-4 flex-wrap">
                      <span className="text-sm font-medium">Typ:</span>
                      <label className="flex items-center gap-1 cursor-pointer text-sm"><input type="radio" name="ctype" checked={cType === "debitor"} onChange={() => setCType("debitor")} /> 🟢 Debitor (Kunde)</label>
                      <label className="flex items-center gap-1 cursor-pointer text-sm"><input type="radio" name="ctype" checked={cType === "kreditor"} onChange={() => setCType("kreditor")} /> 🟠 Kreditor (Lieferant)</label>
                      <span className="text-xs text-gray-500">{cEditId ? `Nr.: ${cDebitor || cKreditor || "—"}` : `Automatische Nr.: ${cType === "debitor" ? nextDebitorNo() : nextKreditorNo()}`}</span>
                    </div>
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Straße + Nr." value={cStreet} onChange={(e) => setCStreet(e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <input className="border p-3 text-black bg-white rounded-lg" placeholder="PLZ" value={cZip} onChange={(e) => setCZip(e.target.value)} />
                      <input className="border p-3 text-black bg-white rounded-lg col-span-2" placeholder="Ort" value={cCity} onChange={(e) => setCCity(e.target.value)} />
                    </div>
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Telefon" value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Mobil" value={cMobile} onChange={(e) => setCMobile(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="E-Mail" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Website" value={cWebsite} onChange={(e) => setCWebsite(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="UID / USt-ID" value={cUid} onChange={(e) => setCUid(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg md:col-span-2" placeholder="Anrede (Briefanrede, z. B. Sehr geehrte Damen und Herren)" value={cAnrede} onChange={(e) => setCAnrede(e.target.value)} />
                    <div className="md:col-span-2">
                      <button type="button" onClick={() => setNoteOpen((o) => !o)} className="text-sm font-medium text-slate-600">{noteOpen ? "▼" : "▶"} 🗂️ Karteikarte / Notiz{cNote.trim() ? ` (${cNote.trim().length} Zeichen)` : ""}</button>
                      {noteOpen && (
                        <textarea
                          ref={noteRef}
                          className="border p-3 text-black bg-white rounded-lg w-full mt-2 resize-none overflow-hidden"
                          rows={2}
                          placeholder="Karteikarte / Notiz"
                          value={cNote}
                          onChange={(e) => { setCNote(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = e.currentTarget.scrollHeight + "px"; }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={saveCustomer} className="bg-cyan-700 text-white px-4 py-3 rounded-lg">{cEditId ? "💾 Speichern" : "Anlegen"}</button>
                    {cEditId && (<button type="button" onClick={resetCustForm} className="bg-gray-200 px-4 py-3 rounded-lg">Abbrechen</button>)}
                  </div>
                </div>
                {(() => {
                  const q = custSearch.trim().toLowerCase();
                  const hasDeb = (k: any) => !!String(k.debitor || "").trim();
                  const hasKre = (k: any) => !!String(k.kreditor || "").trim();
                  const byType = custFilter === "debitor" ? customers.filter(hasDeb) : custFilter === "kreditor" ? customers.filter(hasKre) : customers;
                  const sortKey = (k: any) => {
                    const nm = String(k.name || "").trim();
                    if (custSort === "nachname") { const p = nm.split(/\s+/); return (p[p.length - 1] || nm); }
                    return nm;
                  };
                  const firstLetter = (k: any) => {
                    const ch = (sortKey(k)[0] || "").toUpperCase();
                    if (ch === "Ä") return "A"; if (ch === "Ö") return "O"; if (ch === "Ü") return "U";
                    return /[A-Z]/.test(ch) ? ch : "#";
                  };
                  const byLetter = letterFilter ? byType.filter((k: any) => firstLetter(k) === letterFilter) : byType;
                  const searched = q ? byLetter.filter((k: any) => [k.name, k.debitor, k.kreditor, k.customer_no, k.city, k.zip, k.email, k.matchcode, k.phone, k.mobile].some((x: any) => String(x || "").toLowerCase().includes(q))) : byLetter;
                  const sorted = [...searched].sort((a: any, b: any) => sortKey(a).localeCompare(sortKey(b), "de", { sensitivity: "base" }));
                  const shown = sorted.slice(0, 200);
                  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => setLetterFilter("")} className={`text-xs px-2 py-1 rounded ${letterFilter === "" ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>Alle</button>
                        {ALPHA.map((L) => (
                          <button key={L} type="button" onClick={() => setLetterFilter(letterFilter === L ? "" : L)} className={`text-xs px-2 py-1 rounded ${letterFilter === L ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>{L}</button>
                        ))}
                        <button type="button" onClick={() => setLetterFilter(letterFilter === "#" ? "" : "#")} className={`text-xs px-2 py-1 rounded ${letterFilter === "#" ? "bg-cyan-700 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>#</button>
                      </div>
                      <p className="text-xs text-gray-500">{sorted.length} Treffer{sorted.length > shown.length ? ` · zeige die ersten ${shown.length}` : ""}</p>
                      {shown.map((k: any) => {
                        const open = !!openCusts[k.id];
                        return (
                        <div key={k.id} className="border border-slate-200 rounded-xl shadow-sm">
                          <button type="button" onClick={() => setOpenCusts((p) => ({ ...p, [k.id]: !p[k.id] }))} className="w-full text-left p-3 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 flex-wrap text-sm">
                              <span className="text-gray-400">{open ? "▼" : "▶"}</span>
                              <strong>{k.name}</strong>
                              {String(k.debitor || "").trim() ? <span className="text-xs bg-green-100 text-green-800 rounded px-1.5 py-0.5">Debitor {k.debitor}</span> : null}
                              {String(k.kreditor || "").trim() ? <span className="text-xs bg-orange-100 text-orange-800 rounded px-1.5 py-0.5">Kreditor {k.kreditor}</span> : null}
                              {k.city ? <span className="text-xs text-gray-500">· {k.city}</span> : null}
                            </span>
                          </button>
                          {open && (
                            <div className="px-3 pb-3 text-sm space-y-1">
                              {(k.street || k.zip || k.city) ? <div className="text-gray-600">{[k.street, [k.zip, k.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div> : null}
                              {(k.phone || k.mobile) ? <div className="text-gray-600">📞 {[k.phone, k.mobile].filter(Boolean).join(" · ")}</div> : null}
                              {k.email ? <div className="text-gray-600">✉️ {k.email}</div> : null}
                              {k.website ? <div className="text-gray-600">🌐 {k.website}</div> : null}
                              {k.uid ? <div className="text-gray-500 text-xs">UID: {k.uid}</div> : null}
                              {k.note ? <div className="text-amber-900 text-xs mt-1 bg-amber-50 border border-amber-100 rounded px-2 py-1">🗂️ {k.note}</div> : null}
                              <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => startEditCust(k)} className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm">✏️ Bearbeiten</button>
                                <button type="button" onClick={() => deleteCustomer(k.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm">🗑️ Löschen</button>
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                      {sorted.length === 0 && <p className="text-gray-600">Keine Kunden gefunden.</p>}
                    </div>
                  );
                })()}
              </section>
            )}

            {/* Tab: Aufträge / Störungsannahme */}
            {tab === "auftraege" && (() => {
              const q = orderSearch.trim().toLowerCase();
              const matches = q ? customers.filter((k: any) => [k.name, k.street, k.zip, k.city, k.phone, k.mobile, k.debitor, k.kreditor].some((x: any) => String(x || "").toLowerCase().includes(q))).slice(0, 25) : [];
              const sel = customers.find((c: any) => c.id === orderSelId);
              return (
                <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-xl font-bold">🛠 Auftrags-/Störungsannahme</h2>
                    <p className="text-sm text-gray-500">Kunde über Name, Straße, PLZ, Telefon oder Handy suchen — dann mit Zeitstempel in die Karteikarte eintragen.</p>
                  </div>
                  <input className="border p-3 text-black bg-white rounded-lg w-full" placeholder="Suche: Name, Straße, PLZ, Telefon, Handy…" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
                  {q && (
                    <div className="space-y-1">
                      {matches.map((k: any) => (
                        <button key={k.id} type="button" onClick={() => setOrderSelId(k.id)} className={`w-full text-left border rounded-lg p-2 text-sm ${orderSelId === k.id ? "border-cyan-600 bg-cyan-50" : "border-slate-200 bg-white"}`}>
                          <strong>{k.name}</strong>
                          {k.customer_no ? <span className="text-gray-500"> · {k.customer_no}</span> : null}
                          {(k.street || k.zip || k.city) ? <span className="text-gray-600"> · {[k.street, [k.zip, k.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span> : null}
                          {(k.phone || k.mobile) ? <span className="text-gray-600"> · 📞 {[k.phone, k.mobile].filter(Boolean).join(" / ")}</span> : null}
                        </button>
                      ))}
                      {matches.length === 0 && <p className="text-gray-500 text-sm">Kein Kunde gefunden.</p>}
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <button type="button" onClick={() => { setNewCustOpen((o) => !o); if (!newCustOpen && !qName) setQName(orderSearch); }} className="text-sm font-medium text-cyan-700">{newCustOpen ? "▼" : "▶"} ＋ Neuer Kunde (nicht gefunden)</button>
                    {newCustOpen && (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 border border-slate-200 rounded-xl p-3">
                        <input className="border p-2 rounded-lg text-black bg-white" placeholder="Name / Firma *" value={qName} onChange={(e) => setQName(e.target.value)} />
                        <input className="border p-2 rounded-lg text-black bg-white" placeholder="Straße + Nr." value={qStreet} onChange={(e) => setQStreet(e.target.value)} />
                        <input className="border p-2 rounded-lg text-black bg-white" placeholder="PLZ" value={qZip} onChange={(e) => setQZip(e.target.value)} />
                        <input className="border p-2 rounded-lg text-black bg-white" placeholder="Ort" value={qCity} onChange={(e) => setQCity(e.target.value)} />
                        <input className="border p-2 rounded-lg text-black bg-white" placeholder="Telefon" value={qPhone} onChange={(e) => setQPhone(e.target.value)} />
                        <input className="border p-2 rounded-lg text-black bg-white" placeholder="Handy" value={qMobile} onChange={(e) => setQMobile(e.target.value)} />
                        <div className="md:col-span-2"><button type="button" onClick={createQuickCustomer} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">Anlegen & auswählen</button></div>
                      </div>
                    )}
                  </div>
                  {sel && (
                    <div className="border border-cyan-200 bg-cyan-50/40 rounded-2xl p-4 space-y-3">
                      <div>
                        <strong className="text-lg">{sel.name}</strong>
                        {sel.customer_no ? <span className="text-gray-500"> · {sel.customer_no}</span> : null}
                        {(sel.street || sel.zip || sel.city) ? <div className="text-gray-600 text-sm">{[sel.street, [sel.zip, sel.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div> : null}
                        {(sel.phone || sel.mobile) ? <div className="text-gray-600 text-sm">📞 {[sel.phone, sel.mobile].filter(Boolean).join(" · ")}</div> : null}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">🗂️ Karteikarte</p>
                        {String(sel.note || "").trim()
                          ? <div className="bg-white border border-slate-200 rounded-lg p-2 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">{sel.note}</div>
                          : <p className="text-sm text-gray-400">Noch keine Einträge.</p>}
                      </div>
                      <div className="space-y-2">
                        <textarea className="border p-3 w-full rounded-lg text-black bg-white" rows={3} placeholder="Neuer Eintrag (Auftrag / Störung) …" value={orderEntry} onChange={(e) => setOrderEntry(e.target.value)} />
                        <button type="button" onClick={addOrderEntry} className="bg-cyan-700 text-white px-4 py-3 rounded-lg">＋ Mit Zeitstempel eintragen</button>
                      </div>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* Leistungen (mit Arbeitszeit + Stückliste) und Artikel (reines Material): gleiche Komponente, art-Prop (Stufe 7a) */}
            {tab === "leistungen" && <Artikel supabase={supabase} companyId={companyId} art="leistung" />}

            {tab === "artikel" && <Artikel supabase={supabase} companyId={companyId} art="artikel" />}

            {tab === "angebote" && <Angebote supabase={supabase} companyId={companyId} customers={customers} doc="angebot" />}

            {/* Auftragsbestätigungen und Rechnungen: gleiche Komponente, eigene Dokumentart (Stufe 6a) */}
            {tab === "ab" && <Angebote supabase={supabase} companyId={companyId} customers={customers} doc="ab" />}

            {tab === "rechnung" && <Angebote supabase={supabase} companyId={companyId} customers={customers} doc="rechnung" />}

            {/* Buchhaltung (Stufe 8a): DATEV-Export der Ausgangsrechnungen */}
            {tab === "buchhaltung" && <Buchhaltung supabase={supabase} companyId={companyId} customers={customers} />}
          </div>
        )}
      </div>
    </div>
  );
}
