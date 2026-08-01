"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const BUERO_TABS = [
  { key: "mitarbeiter", label: "👤 Mitarbeiter" },
  { key: "kunden", label: "👥 Kunden" },
  { key: "angebote", label: "🧾 Angebote" },
  { key: "ab", label: "📋 Auftragsbestätigung" },
  { key: "rechnung", label: "💶 Rechnung" },
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
  const [tab, setTab] = useState("mitarbeiter");

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
  const [cEditId, setCEditId] = useState<string | null>(null);
  const [cName, setCName] = useState("");
  const [cDebitor, setCDebitor] = useState("");
  const [cKreditor, setCKreditor] = useState("");
  const [cStreet, setCStreet] = useState("");
  const [cZip, setCZip] = useState("");
  const [cCity, setCCity] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cMobile, setCMobile] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cWebsite, setCWebsite] = useState("");
  const [cUid, setCUid] = useState("");
  const [cNote, setCNote] = useState("");
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
  function resetCustForm() { setCEditId(null); setCName(""); setCDebitor(""); setCKreditor(""); setCStreet(""); setCZip(""); setCCity(""); setCPhone(""); setCMobile(""); setCEmail(""); setCWebsite(""); setCUid(""); setCNote(""); setNoteOpen(false); }
  function startEditCust(k: any) {
    setCEditId(k.id); setCName(k.name || ""); setCDebitor(k.debitor || ""); setCKreditor(k.kreditor || ""); setCStreet(k.street || ""); setCZip(k.zip || ""); setCCity(k.city || "");
    setCPhone(k.phone || ""); setCMobile(k.mobile || ""); setCEmail(k.email || ""); setCWebsite(k.website || ""); setCUid(k.uid || ""); setCNote(k.note || ""); setNoteOpen(!!(k.note && String(k.note).trim()));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveCustomer() {
    if (!cName.trim()) { setMessage("Bitte einen Kundennamen eingeben."); return; }
    const deb = cDebitor.trim(); const kre = cKreditor.trim();
    const kind = deb && kre ? "beides" : kre ? "kreditor" : deb ? "debitor" : "sonstige";
    const payload = { name: cName.trim(), debitor: deb, kreditor: kre, customer_no: deb || kre, kind, street: cStreet.trim(), zip: cZip.trim(), city: cCity.trim(), phone: cPhone.trim(), mobile: cMobile.trim(), email: cEmail.trim(), website: cWebsite.trim(), uid: cUid.trim(), note: cNote.trim() };
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
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">🏢 Büro</h1>
            <p className="text-cyan-100 text-sm">{companyName ? companyName + " · " : ""}Auftragsverwaltung</p>
          </div>
          <a href="/" className="bg-white/15 hover:bg-white/25 border border-white/30 rounded-lg px-4 py-2 text-sm font-medium">← Zurück zur App</a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
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
                    <input className="border p-2 rounded-lg text-black bg-white w-full sm:w-72" placeholder="Suche: Name, Nr., Ort, Telefon, E-Mail…" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
                  </div>
                </div>
                <div className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-gray-50 space-y-3">
                  <h3 className="font-bold">{cEditId ? "Kunde bearbeiten" : "Neuen Kunden anlegen"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Name / Firma *" value={cName} onChange={(e) => setCName(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Debitor-Nr. (Kunde)" value={cDebitor} onChange={(e) => setCDebitor(e.target.value)} />
                    <input className="border p-3 text-black bg-white rounded-lg" placeholder="Kreditor-Nr. (Lieferant)" value={cKreditor} onChange={(e) => setCKreditor(e.target.value)} />
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
                  const filtered = q ? byType.filter((k: any) => [k.name, k.debitor, k.kreditor, k.customer_no, k.city, k.zip, k.email, k.matchcode, k.phone, k.mobile].some((x: any) => String(x || "").toLowerCase().includes(q))) : byType;
                  const shown = filtered.slice(0, 100);
                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">{filtered.length} Treffer{filtered.length > shown.length ? ` · zeige die ersten ${shown.length}` : ""}</p>
                      {shown.map((k: any) => (
                        <div key={k.id} className="border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-start justify-between gap-2">
                          <div className="text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong>{k.name}</strong>
                              {String(k.debitor || "").trim() ? <span className="text-xs bg-green-100 text-green-800 rounded px-1.5 py-0.5">Debitor {k.debitor}</span> : null}
                              {String(k.kreditor || "").trim() ? <span className="text-xs bg-orange-100 text-orange-800 rounded px-1.5 py-0.5">Kreditor {k.kreditor}</span> : null}
                            </div>
                            {(k.street || k.zip || k.city) ? <div className="text-gray-600">{[k.street, [k.zip, k.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div> : null}
                            {(k.phone || k.mobile) ? <div className="text-gray-600">📞 {[k.phone, k.mobile].filter(Boolean).join(" · ")}</div> : null}
                            {k.email ? <div className="text-gray-600">✉️ {k.email}</div> : null}
                            {k.uid ? <div className="text-gray-500 text-xs">UID: {k.uid}</div> : null}
                            {k.note ? <div className="text-amber-900 text-xs mt-1 bg-amber-50 border border-amber-100 rounded px-2 py-1">🗂️ {k.note}</div> : null}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button type="button" onClick={() => startEditCust(k)} className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm">✏️</button>
                            <button type="button" onClick={() => deleteCustomer(k.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm">🗑️</button>
                          </div>
                        </div>
                      ))}
                      {filtered.length === 0 && <p className="text-gray-600">Keine Kunden gefunden.</p>}
                    </div>
                  );
                })()}
              </section>
            )}

            {/* Tabs: Angebote / Auftragsbestätigung / Rechnung – folgen */}
            {(tab === "angebote" || tab === "ab" || tab === "rechnung") && (
              <section className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center text-gray-500">
                {(BUERO_TABS.find((t) => t.key === tab)?.label || "")} — folgt als Nächstes hier im Büro-Bereich.
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
