"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

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

  // Mitarbeiter
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [officeEmployees, setOfficeEmployees] = useState<any[]>([]);
  const [eid, setEid] = useState<string | null>(null);
  const [oName, setOName] = useState("");
  const [oRole, setORole] = useState("");
  const [oPhone, setOPhone] = useState("");
  const [oEmail, setOEmail] = useState("");

  useEffect(() => { init(); /* eslint-disable-next-line */ }, []);

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
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-green-700 font-medium">🔓 Büro entsperrt</p>
              <button type="button" onClick={() => setUnlocked(false)} className="text-sm text-gray-500 underline">Sperren</button>
            </div>

            {/* Mitarbeiterverwaltung */}
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

            {/* Platzhalter für die kaufmännischen Untermodule */}
            <section className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center text-gray-500">
              🧾 Angebote · Auftragsbestätigung · Rechnung — folgen als Nächstes hier im Büro-Bereich.
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
