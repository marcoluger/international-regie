"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// ─── Typen ────────────────────────────────────────────────────────────────────

type Company = {
  id: string;
  name: string;
  created_at: string;
};

type CompanyFeatures = {
  id?: string;
  company_id: string;
  package_name: string;
  max_employees: number;
  valid_until: string;
  // Module
  module_reports: boolean;
  module_work_orders: boolean;
  module_auto_reports: boolean;
  // Features
  photos_enabled: boolean;
  email_enabled: boolean;
  signature_enabled: boolean;
  ai_enabled: boolean;
  // Sprachen
  allowed_languages: string[];
};

type CompanyUser = {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  role: string;
};

// ─── Pakete ───────────────────────────────────────────────────────────────────

const PACKAGES: Record<string, { label: string; color: string; defaults: Partial<CompanyFeatures> }> = {
  starter: {
    label: "Starter (bis 5 MA)",
    color: "bg-gray-100 border-gray-300",
    defaults: {
      max_employees: 5,
      module_reports: true,
      module_work_orders: false,
      module_auto_reports: false,
      photos_enabled: false,
      email_enabled: false,
      signature_enabled: false,
      ai_enabled: false,
      allowed_languages: ["Deutsch"],
    },
  },
  team: {
    label: "Team (bis 20 MA)",
    color: "bg-blue-50 border-blue-300",
    defaults: {
      max_employees: 20,
      module_reports: true,
      module_work_orders: true,
      module_auto_reports: false,
      photos_enabled: true,
      email_enabled: true,
      signature_enabled: false,
      ai_enabled: true,
      allowed_languages: ["Deutsch", "Polnisch"],
    },
  },
  business: {
    label: "Business (bis 100 MA)",
    color: "bg-green-50 border-green-300",
    defaults: {
      max_employees: 100,
      module_reports: true,
      module_work_orders: true,
      module_auto_reports: true,
      photos_enabled: true,
      email_enabled: true,
      signature_enabled: true,
      ai_enabled: true,
      allowed_languages: ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"],
    },
  },
  enterprise: {
    label: "Enterprise (unbegrenzt)",
    color: "bg-purple-50 border-purple-300",
    defaults: {
      max_employees: 9999,
      module_reports: true,
      module_work_orders: true,
      module_auto_reports: true,
      photos_enabled: true,
      email_enabled: true,
      signature_enabled: true,
      ai_enabled: true,
      allowed_languages: ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"],
    },
  },
};

const ALL_LANGUAGES = ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"];

const EMPTY_FEATURES = (companyId: string): CompanyFeatures => ({
  company_id: companyId,
  package_name: "starter",
  max_employees: 5,
  valid_until: "",
  module_reports: true,
  module_work_orders: false,
  module_auto_reports: false,
  photos_enabled: false,
  email_enabled: false,
  signature_enabled: false,
  ai_enabled: false,
  allowed_languages: ["Deutsch"],
});

// ─── Hilfskomponenten ─────────────────────────────────────────────────────────

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          value ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </div>
      <span className={value ? "text-black font-medium" : "text-gray-500"}>{label}</span>
    </label>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded border ${color}`}>{text}</span>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [featuresMap, setFeaturesMap] = useState<Record<string, CompanyFeatures>>({});
  const [usersMap, setUsersMap] = useState<Record<string, CompanyUser[]>>({});
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Neue Firma anlegen
  const [newCompanyName, setNewCompanyName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        setIsAdmin(true);
        loadAll();
      }
    });
  }, []);

  async function adminLogin() {
    setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    if (error) { setMessage("Login fehlgeschlagen: " + error.message); return; }
    if (data.user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      setMessage("Kein Admin-Zugang.");
      await supabase.auth.signOut();
      return;
    }
    setIsAdmin(true);
    loadAll();
  }

  async function loadAll() {
    await loadCompanies();
  }

  async function loadCompanies() {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { setMessage("Fehler: " + error.message); return; }

    const list = data || [];
    setCompanies(list);

    // Features & Users für alle Firmen laden
    for (const company of list) {
      await loadFeatures(company.id);
      await loadUsers(company.id);
    }
  }

  async function loadFeatures(companyId: string) {
    const { data } = await supabase
      .from("company_features")
      .select("*")
      .eq("company_id", companyId)
      .single();

    setFeaturesMap((prev) => ({
      ...prev,
      [companyId]: data || EMPTY_FEATURES(companyId),
    }));
  }

  async function loadUsers(companyId: string) {
    const { data } = await supabase
      .from("company_users")
      .select("*")
      .eq("company_id", companyId);

    setUsersMap((prev) => ({
      ...prev,
      [companyId]: data || [],
    }));
  }

  function updateFeature<K extends keyof CompanyFeatures>(
    companyId: string,
    field: K,
    value: CompanyFeatures[K]
  ) {
    setFeaturesMap((prev) => ({
      ...prev,
      [companyId]: { ...prev[companyId], [field]: value },
    }));
  }

  function applyPackage(companyId: string, packageName: string) {
    const pkg = PACKAGES[packageName];
    if (!pkg) return;
    setFeaturesMap((prev) => ({
      ...prev,
      [companyId]: {
        ...prev[companyId],
        ...pkg.defaults,
        package_name: packageName,
        company_id: companyId,
      },
    }));
  }

  function toggleLanguage(companyId: string, lang: string) {
    const current = featuresMap[companyId]?.allowed_languages || [];
    const updated = current.includes(lang)
      ? current.filter((l) => l !== lang)
      : [...current, lang];
    updateFeature(companyId, "allowed_languages", updated);
  }

  async function saveFeatures(companyId: string) {
    setSaving(companyId);
    setMessage("");

    const features = featuresMap[companyId];
    if (!features) return;

    const { error } = await supabase
      .from("company_features")
      .upsert({ ...features, company_id: companyId }, { onConflict: "company_id" });

    setSaving(null);

    if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    setMessage(`✅ Einstellungen für "${companies.find((c) => c.id === companyId)?.name}" gespeichert.`);
  }

  async function createCompany() {
    if (!newCompanyName.trim()) { setMessage("Bitte Firmenname eingeben."); return; }

    const { data, error } = await supabase
      .from("companies")
      .insert({ name: newCompanyName.trim() })
      .select()
      .single();

    if (error) { setMessage("Fehler: " + error.message); return; }

    // Standard-Features anlegen
    await supabase.from("company_features").insert(EMPTY_FEATURES(data.id));

    setNewCompanyName("");
    setMessage(`✅ Firma "${data.name}" wurde angelegt.`);
    await loadCompanies();
  }

  async function deleteCompany(companyId: string, companyName: string) {
    if (!confirm(`Firma "${companyName}" wirklich löschen? Das löscht auch alle zugehörigen Daten.`)) return;

    await supabase.from("company_features").delete().eq("company_id", companyId);
    await supabase.from("company_users").delete().eq("company_id", companyId);
    const { error } = await supabase.from("companies").delete().eq("id", companyId);

    if (error) { setMessage("Fehler beim Löschen: " + error.message); return; }

    setMessage(`Firma "${companyName}" wurde gelöscht.`);
    await loadCompanies();
  }

  // ─── Login-Screen ───────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <main className="max-w-sm mx-auto p-8 space-y-4 min-h-screen bg-gray-900 flex flex-col justify-center">
        <div className="bg-white rounded-xl p-6 space-y-4 shadow-xl">
          <h1 className="text-2xl font-bold text-center">🔐 Admin-Login</h1>
          {message && <div className="bg-red-100 border rounded p-3 text-sm text-red-800">{message}</div>}
          <input
            className="border p-3 w-full rounded"
            placeholder="Admin E-Mail"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />
          <input
            className="border p-3 w-full rounded"
            placeholder="Passwort"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={adminLogin}
            className="w-full bg-gray-900 text-white py-3 rounded font-bold"
          >
            Einloggen
          </button>
        </div>
      </main>
    );
  }

  // ─── Admin-Panel ────────────────────────────────────────────────────────────
  return (
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 bg-gray-100 min-h-screen text-black">

      {/* Header */}
      <header className="bg-white border rounded-xl p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🛠 Admin-Panel</h1>
          <p className="text-gray-500 text-sm">Firmen & Module verwalten</p>
        </div>
        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); setIsAdmin(false); }}
          className="bg-gray-800 text-white px-4 py-2 rounded"
        >
          Abmelden
        </button>
      </header>

      {/* Statusmeldung */}
      {message && (
        <div className="border rounded p-3 bg-yellow-50 text-black">{message}</div>
      )}

      {/* Neue Firma anlegen */}
      <section className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold">➕ Neue Firma anlegen</h2>
        <div className="flex gap-3">
          <input
            className="border p-3 rounded flex-1"
            placeholder="Firmenname"
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createCompany(); }}
          />
          <button
            type="button"
            onClick={createCompany}
            className="bg-blue-700 text-white px-6 py-3 rounded font-medium"
          >
            Anlegen
          </button>
        </div>
      </section>

      {/* Firmen-Übersicht */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">🏢 Firmen ({companies.length})</h2>

        {companies.length === 0 && (
          <div className="bg-white border rounded-xl p-6 text-gray-500 text-center">
            Noch keine Firmen vorhanden.
          </div>
        )}

        {companies.map((company) => {
          const features = featuresMap[company.id] || EMPTY_FEATURES(company.id);
          const users = usersMap[company.id] || [];
          const pkg = PACKAGES[features.package_name] || PACKAGES.starter;
          const isOpen = openCompanyId === company.id;

          return (
            <div key={company.id} className={`border-2 rounded-xl overflow-hidden ${pkg.color}`}>

              {/* Firma Kopfzeile */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setOpenCompanyId(isOpen ? null : company.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{isOpen ? "▾" : "▸"}</span>
                  <div>
                    <div className="font-bold text-lg">{company.name}</div>
                    <div className="text-sm text-gray-500">
                      {users.length} Mitarbeiter | Erstellt: {new Date(company.created_at).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge text={pkg.label} color={pkg.color} />
                  {features.valid_until && new Date(features.valid_until) < new Date() && (
                    <Badge text="⚠️ Abgelaufen" color="bg-red-100 border-red-400 text-red-700" />
                  )}
                </div>
              </div>

              {/* Aufgeklappt: Einstellungen */}
              {isOpen && (
                <div className="bg-white border-t p-4 space-y-6">

                  {/* Paket wählen */}
                  <div>
                    <h3 className="font-bold mb-3">📦 Paket</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(PACKAGES).map(([key, pkg]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyPackage(company.id, key)}
                          className={`border-2 rounded-lg p-3 text-sm font-medium transition-colors ${
                            features.package_name === key
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-gray-200 bg-white hover:border-gray-400"
                          }`}
                        >
                          {pkg.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Paket wählen füllt die Module automatisch vor — du kannst danach noch einzeln anpassen.
                    </p>
                  </div>

                  {/* Lizenz */}
                  <div>
                    <h3 className="font-bold mb-3">📅 Lizenz & Limits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Max. Mitarbeiter</label>
                        <input
                          type="number"
                          className="border p-2 rounded w-full"
                          value={features.max_employees}
                          onChange={(e) => updateFeature(company.id, "max_employees", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Gültig bis</label>
                        <input
                          type="date"
                          className="border p-2 rounded w-full"
                          value={features.valid_until || ""}
                          onChange={(e) => updateFeature(company.id, "valid_until", e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        {features.valid_until ? (
                          <p className={`text-sm font-medium ${
                            new Date(features.valid_until) >= new Date() ? "text-green-600" : "text-red-600"
                          }`}>
                            {new Date(features.valid_until) >= new Date()
                              ? `✅ Gültig noch ${Math.ceil((new Date(features.valid_until).getTime() - Date.now()) / 86400000)} Tage`
                              : "⚠️ Lizenz abgelaufen"}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">Kein Ablaufdatum gesetzt</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Module */}
                  <div>
                    <h3 className="font-bold mb-3">🧩 Module</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Toggle label="📋 Regieberichte"         value={features.module_reports}      onChange={(v) => updateFeature(company.id, "module_reports", v)} />
                      <Toggle label="📝 Arbeitsanweisungen"    value={features.module_work_orders}  onChange={(v) => updateFeature(company.id, "module_work_orders", v)} />
                      <Toggle label="🤖 Auto-Regieberichte"    value={features.module_auto_reports} onChange={(v) => updateFeature(company.id, "module_auto_reports", v)} />
                      <Toggle label="🧠 KI-Übersetzung"        value={features.ai_enabled}          onChange={(v) => updateFeature(company.id, "ai_enabled", v)} />
                      <Toggle label="📸 Foto-Upload"           value={features.photos_enabled}      onChange={(v) => updateFeature(company.id, "photos_enabled", v)} />
                      <Toggle label="✉️ E-Mail-Versand"         value={features.email_enabled}       onChange={(v) => updateFeature(company.id, "email_enabled", v)} />
                      <Toggle label="✍️ Unterschriften"        value={features.signature_enabled}   onChange={(v) => updateFeature(company.id, "signature_enabled", v)} />
                    </div>
                  </div>

                  {/* Sprachen */}
                  <div>
                    <h3 className="font-bold mb-3">🌐 Freigeschaltete Sprachen</h3>
                    <div className="flex flex-wrap gap-2">
                      {ALL_LANGUAGES.map((lang) => {
                        const active = features.allowed_languages?.includes(lang);
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => toggleLanguage(company.id, lang)}
                            className={`border-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                              active
                                ? "border-green-600 bg-green-50 text-green-700"
                                : "border-gray-200 bg-white text-gray-400 hover:border-gray-400"
                            }`}
                          >
                            {active ? "✓ " : ""}{lang}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mitarbeiter der Firma */}
                  <div>
                    <h3 className="font-bold mb-3">👥 Mitarbeiter ({users.length} / {features.max_employees})</h3>
                    {users.length === 0 ? (
                      <p className="text-gray-400 text-sm">Noch keine Mitarbeiter.</p>
                    ) : (
                      <div className="space-y-2">
                        {users.map((u) => (
                          <div key={u.id} className="flex items-center justify-between border rounded p-2 bg-gray-50">
                            <div>
                              <span className="font-medium">{u.full_name || "-"}</span>
                              <span className="text-gray-500 text-sm ml-2">{u.email || "-"}</span>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded font-bold ${
                              u.role === "admin" ? "bg-purple-100 text-purple-700"
                              : u.role === "project_manager" ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                            }`}>
                              {u.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Aktions-Buttons */}
                  <div className="flex flex-wrap gap-3 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => saveFeatures(company.id)}
                      disabled={saving === company.id}
                      className="bg-blue-700 text-white px-6 py-3 rounded font-bold disabled:opacity-50"
                    >
                      {saving === company.id ? "Speichert..." : "💾 Einstellungen speichern"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCompany(company.id, company.name)}
                      className="bg-red-600 text-white px-4 py-3 rounded"
                    >
                      🗑 Firma löschen
                    </button>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </section>

    </main>
  );
}