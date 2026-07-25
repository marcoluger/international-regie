"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type Company = { id: string; name: string; slug: string; created_at: string; features: any; users: any[]; status?: string; owner_user_id?: string | null; settings?: any };

const PACKAGES: Record<string, { label: string; color: string; defaults: any }> = {
  starter:    { label: "Starter (bis 5 MA)",      color: "bg-gray-100 border-gray-300",   defaults: { max_employees: 5,    max_photos: 2,  module_reports: true,  module_work_orders: false, module_auto_reports: false, photos_enabled: false, email_enabled: false, signature_enabled: false, ai_enabled: false, allowed_languages: ["Deutsch"] } },
  team:       { label: "Team (bis 20 MA)",         color: "bg-blue-50 border-blue-300",    defaults: { max_employees: 20,   max_photos: 10, module_reports: true,  module_work_orders: true,  module_auto_reports: false, photos_enabled: true,  email_enabled: true,  signature_enabled: false, ai_enabled: true,  allowed_languages: ["Deutsch", "Polnisch"] } },
  business:   { label: "Business (bis 100 MA)",   color: "bg-green-50 border-green-300",  defaults: { max_employees: 100,  max_photos: 30, module_reports: true,  module_work_orders: true,  module_auto_reports: true,  photos_enabled: true,  email_enabled: true,  signature_enabled: true,  ai_enabled: true,  allowed_languages: ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"] } },
  enterprise: { label: "Enterprise (unbegrenzt)", color: "bg-purple-50 border-purple-300", defaults: { max_employees: 9999, max_photos: 0,  module_reports: true,  module_work_orders: true,  module_auto_reports: true,  photos_enabled: true,  email_enabled: true,  signature_enabled: true,  ai_enabled: true,  allowed_languages: ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"] } },
};

const ALL_LANGUAGES = ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch", "Rumänisch", "Ukrainisch", "Ungarisch", "Bulgarisch", "Tschechisch", "Türkisch", "Italienisch", "Serbisch", "Spanisch", "Philippinisch", "Vietnamesisch", "Indisch"];

// Preis-Modell (EUR/Monat, netto): Betriebsgroesse (Stufen) + Add-on je Modul + Sprachen.
// Standardwerte – im Rechner-Tab editierbar (im Browser gespeichert).
const PRICING_DEFAULT = {
  seatTiers: [
    { key: "s5",   label: "bis 5 Mitarbeiter",   max: 5,       price: 19 },
    { key: "s20",  label: "bis 20 Mitarbeiter",  max: 20,      price: 49 },
    { key: "s100", label: "bis 100 Mitarbeiter", max: 100,     price: 149 },
    { key: "inf",  label: "unbegrenzt",          max: 1000000, price: 299 },
  ],
  perLanguage: 6, // je Sprache ueber 1 (Deutsch inklusive)
  modules: [
    { key: "module_auto_reports", label: "Automatischer Regiebericht", price: 9 },
    { key: "photos_enabled",      label: "Foto-Upload",                price: 7 },
    { key: "email_enabled",       label: "E-Mail-Versand",             price: 5 },
    { key: "signature_enabled",   label: "Unterschriften",             price: 5 },
    { key: "comments_enabled",    label: "Kommentar-Chat",             price: 5 },
    { key: "material_enabled",    label: "Materialerfassung",          price: 12 },
    { key: "export_enabled",      label: "Stundenexport",              price: 9 },
    { key: "equipment_enabled",   label: "Fahrzeuge & Werkzeuge",      price: 19 },
    { key: "absence_enabled",     label: "Urlaub & Abwesenheit",       price: 9 },
    { key: "translator_enabled",  label: "Live-Übersetzer",            price: 5 },
    { key: "ai_enabled",          label: "KI-Mehrsprachigkeit",        price: 15 },
    // feedback_enabled & module_reports: in der Basis enthalten (0 EUR)
  ],
};
type Prices = typeof PRICING_DEFAULT;

function tierForCount(count: number, tiers: Prices["seatTiers"]) {
  for (const t of tiers) if (count <= t.max) return t;
  return tiers[tiers.length - 1];
}

function computeMonthlyPrice(prices: Prices, opts: { tierKey?: string; employeeCount?: number; moduleFlags?: any; langCount?: number }) {
  const tiers = prices.seatTiers;
  const tier = opts.tierKey ? (tiers.find((t) => t.key === opts.tierKey) || tiers[0]) : tierForCount(opts.employeeCount || 0, tiers);
  const items: { label: string; price: number }[] = [{ label: tier.label, price: Number(tier.price) || 0 }];
  for (const m of prices.modules) {
    if (opts.moduleFlags?.[m.key]) items.push({ label: m.label, price: Number(m.price) || 0 });
  }
  const langCount = opts.langCount || 1;
  const langExtra = Math.max(0, langCount - 1) * (Number(prices.perLanguage) || 0);
  if (langExtra > 0) items.push({ label: `${langCount - 1} weitere Sprache(n)`, price: langExtra });
  const total = items.reduce((s, i) => s + i.price, 0);
  return { items, total, tier };
}

// Holt den aktuellen Anmelde-Token, damit die Server-Route den Aufrufer prüfen kann.
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div onClick={() => onChange(!value)} className={`relative w-12 h-6 rounded-full transition-colors ${value ? "bg-blue-600" : "bg-gray-300"}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-7" : "translate-x-1"}`} />
      </div>
      <span className={value ? "text-black font-medium" : "text-gray-500"}>{label}</span>
    </label>
  );
}

// Die 10 Testpunkte (Reihenfolge = Index der gespeicherten Antworten) – fuer die Betreiber-Ansicht.
const FEEDBACK_POINTS = ["Anmeldung & Passwort", "Arbeitsanweisung & Kommentar", "Wetter-Funktion", "Übersetzungen", "Regiebericht erstellen", "PDF-Export", "Kalenderansichten", "Live-Übersetzer", "Bedienung am Handy", "Gesamteindruck & Fehler"];

export default function AdminPage() {
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [featuresMap, setFeaturesMap] = useState<Record<string, any>>({});
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const [openDataId, setOpenDataId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingData, setSavingData] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [settingsMap, setSettingsMap] = useState<Record<string, any>>({});
  const [feedbackMap, setFeedbackMap] = useState<Record<string, any[]>>({});
  const [openFeedbackId, setOpenFeedbackId] = useState<string | null>(null);
  const [openContractId, setOpenContractId] = useState<string | null>(null);
  const [contractMap, setContractMap] = useState<Record<string, any>>({});
  const [savingContract, setSavingContract] = useState<string | null>(null);
  const [sendingContract, setSendingContract] = useState<string | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState<string | null>(null);

  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanySlug, setNewCompanySlug] = useState("");
  const [newOwnerUsername, setNewOwnerUsername] = useState("");
  const [newOwnerFullName, setNewOwnerFullName] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newOwnerPackage, setNewOwnerPackage] = useState("starter");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ username: string; password: string; company: string; slug: string } | null>(null);
  const [resetCreds, setResetCreds] = useState<{ name: string; email: string } | null>(null);
  const [legalImpressum, setLegalImpressum] = useState("");
  const [legalDatenschutz, setLegalDatenschutz] = useState("");
  const [savingLegal, setSavingLegal] = useState(false);
  const [openLegal, setOpenLegal] = useState(false);
  // Preis-Rechner-Tab
  const [adminTab, setAdminTab] = useState<"firmen" | "rechner">("firmen");
  const [prices, setPrices] = useState<Prices>(() => JSON.parse(JSON.stringify(PRICING_DEFAULT)));
  const [editPrices, setEditPrices] = useState(false);
  const [calcTier, setCalcTier] = useState("s5");
  const [calcLang, setCalcLang] = useState(1);
  const [calcMods, setCalcMods] = useState<Record<string, boolean>>({});
  const [calcCustomer, setCalcCustomer] = useState("");
  const [calcOfferNr, setCalcOfferNr] = useState("");
  const [calcVat, setCalcVat] = useState("20");
  // Editierte Preise im Browser merken.
  useEffect(() => { try { const s = localStorage.getItem("regie_prices"); if (s) setPrices(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("regie_prices", JSON.stringify(prices)); } catch {} }, [prices]);

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
    const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
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
    setMessage("Lade Daten...");
    try {
      const res = await fetch("/api/admin-data", { headers: await authHeaders() });
      if (!res.ok) {
        const txt = await res.text();
        setMessage(`Fehler beim Laden (${res.status}): ${txt.slice(0, 300)}`);
        return;
      }
      const data = await res.json();
      if (data.error) { setMessage("Fehler: " + data.error); return; }
      setCompanies(data.companies || []);
      const map: Record<string, any> = {};
      for (const c of data.companies || []) {
        map[c.id] = c.features || { company_id: c.id, package_name: "starter", max_employees: 5, valid_until: "", module_reports: true, module_work_orders: false, module_auto_reports: false, photos_enabled: false, email_enabled: false, signature_enabled: false, ai_enabled: false, allowed_languages: ["Deutsch"] };
      }
      setFeaturesMap(map);
      const nmap: Record<string, string> = {};
      const smap: Record<string, any> = {};
      for (const c of data.companies || []) {
        nmap[c.id] = c.name || "";
        smap[c.id] = c.settings || { company_name: c.name || "", street: "", zip_code: "", city: "", phone: "", email: "", website: "", tax_number: "" };
      }
      setNameMap(nmap);
      setSettingsMap(smap);
      setLegalImpressum(data.legal?.impressum || "");
      setLegalDatenschutz(data.legal?.datenschutz || "");
      setMessage("");
    } catch (e: any) {
      setMessage("Fehler beim Laden: " + (e?.message || String(e)));
    }
  }

  async function saveLegal() {
    setSavingLegal(true); setMessage("");
    try {
      const res = await fetch("/api/admin-data", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ action: "saveLegal", impressum: legalImpressum, datenschutz: legalDatenschutz }),
      });
      const data = await res.json();
      if (data.error) { setMessage("Fehler: " + data.error); }
      else { setMessage("✅ Impressum & Datenschutz gespeichert."); }
    } catch (e: any) {
      setMessage("Fehler: " + (e?.message || String(e)));
    }
    setSavingLegal(false);
  }

  function updateFeature(companyId: string, field: string, value: any) {
    setFeaturesMap(prev => ({ ...prev, [companyId]: { ...prev[companyId], [field]: value } }));
  }

  function applyPackage(companyId: string, packageName: string) {
    const pkg = PACKAGES[packageName];
    if (!pkg) return;
    setFeaturesMap(prev => ({ ...prev, [companyId]: { ...prev[companyId], ...pkg.defaults, package_name: packageName, company_id: companyId } }));
  }

  function toggleLanguage(companyId: string, lang: string) {
    const current = featuresMap[companyId]?.allowed_languages || [];
    const updated = current.includes(lang) ? current.filter((l: string) => l !== lang) : [...current, lang];
    updateFeature(companyId, "allowed_languages", updated);
  }

  function updateName(companyId: string, value: string) {
    setNameMap(prev => ({ ...prev, [companyId]: value }));
  }

  function updateSettings(companyId: string, field: string, value: string) {
    setSettingsMap(prev => ({ ...prev, [companyId]: { ...prev[companyId], [field]: value } }));
  }

  async function saveCompanyData(companyId: string) {
    setSavingData(companyId);
    try {
      const company = companies.find(c => c.id === companyId);
      const name = (nameMap[companyId] ?? company?.name ?? "").trim();
      if (!name) { setMessage("Firmenname darf nicht leer sein."); setSavingData(null); return; }
      const res1 = await fetch("/api/admin-data", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ action: "updateCompanyName", companyId, name }),
      });
      const d1 = await res1.json();
      if (d1.error) { setMessage("Fehler beim Firmennamen: " + d1.error); setSavingData(null); return; }
      const ownerUserId = company?.owner_user_id || null;
      if (ownerUserId) {
        const settings = settingsMap[companyId] || {};
        const res2 = await fetch("/api/admin-data", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ action: "saveCompanySettings", ownerUserId, settings }),
        });
        const d2 = await res2.json();
        if (d2.error) { setMessage("Fehler bei den PDF-Firmendaten: " + d2.error); setSavingData(null); return; }
      }
      setSavingData(null);
      setMessage("✅ Firmendaten gespeichert.");
      loadAll();
    } catch (e: any) {
      setSavingData(null);
      setMessage("Fehler beim Speichern der Firmendaten: " + (e?.message || String(e)));
    }
  }

  async function saveFeatures(companyId: string) {
    setSaving(companyId);
    const features = { ...featuresMap[companyId] };
    features.valid_until = features.valid_until || null; // Leerer String → null
    const res = await fetch("/api/admin-data", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "saveFeatures", companyId, features }),
    });
    const data = await res.json();
    setSaving(null);
    if (data.error) { setMessage("Fehler: " + data.error); return; }
    setMessage("✅ Einstellungen gespeichert.");
    loadAll();
  }

  // Vertrag als PDF erzeugen. Gibt das Dokument zurueck (zum Drucken oder Versenden).
  async function buildContractPdf(companyId: string) {
    const { jsPDF } = await import("jspdf");
    const c = contractMap[companyId] || {};
    const comp = companies.find((x: any) => x.id === companyId);
    const doc = new jsPDF();
    const L = 20;
    let y = 22;
    const line = (txt: string, size = 11, bold = false) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      for (const ln of doc.splitTextToSize(txt, 170)) { doc.text(ln, L, y); y += size * 0.55 + 2; }
    };

    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text("Regie International", L, y); y += 8;
    doc.setFontSize(13); doc.text("Vertragsübersicht", L, y); y += 10;

    doc.setDrawColor(200); doc.line(L, y, 190, y); y += 8;

    line("Kunde", 12, true);
    line(c.customer_name || comp?.name || "-");
    if (c.customer_street) line(c.customer_street);
    if (c.customer_zip || c.customer_city) line(`${c.customer_zip || ""} ${c.customer_city || ""}`.trim());
    if (c.customer_country) line(c.customer_country);
    if (c.vat_id) line(`USt-IdNr. / Steuernummer: ${c.vat_id}`);
    if (c.invoice_email) line(`Rechnungs-E-Mail: ${c.invoice_email}`);
    y += 4;

    line("Vertrag", 12, true);
    line(`Vertragsnummer: ${c.contract_number || "-"}`);
    line(`Paket: ${c.package || "-"}`);
    const preis = c.monthly_price !== undefined && c.monthly_price !== null && c.monthly_price !== "" ? Number(c.monthly_price) : null;
    const ust = c.vat_rate !== undefined && c.vat_rate !== null && c.vat_rate !== "" ? Number(c.vat_rate) : null;
    line(`Preis pro Monat (netto): ${preis !== null ? preis.toFixed(2) + " EUR" : "-"}`);
    line(`USt-Satz: ${ust !== null ? ust + " %" : "-"}`);
    if (preis !== null && ust !== null) {
      const brutto = preis * (1 + ust / 100);
      line(`Preis pro Monat (brutto): ${brutto.toFixed(2)} EUR`, 11, true);
    }
    line(`Vertragsbeginn: ${c.start_date || "-"}`);
    line(`Vertragsende: ${c.end_date || "unbefristet"}`);
    line(`Zahlungsart: ${c.payment_method || "-"}`);
    line(`Zahlungsziel: ${c.payment_terms ? c.payment_terms + " Tage" : "-"}`);
    line(`Status: ${c.active ? "aktiv" : "inaktiv"}`);
    y += 4;

    if (c.notes) { line("Notizen", 12, true); line(String(c.notes)); }

    y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
    doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, L, y);
    doc.setTextColor(0);
    return doc;
  }

  // Angebot aus dem Preis-Rechner als PDF erzeugen.
  async function downloadOfferPdf() {
    try {
      const { jsPDF } = await import("jspdf");
      const { items, total, tier } = computeMonthlyPrice(prices, { tierKey: calcTier, moduleFlags: calcMods, langCount: calcLang });
      const vat = calcVat !== "" ? Number(calcVat) : null;
      const doc = new jsPDF();
      const L = 20, R = 190;
      let y = 22;

      doc.setFontSize(18); doc.setFont("helvetica", "bold");
      doc.text("Regie International", L, y); y += 8;
      doc.setFontSize(13); doc.setFont("helvetica", "normal");
      doc.text("Angebot", L, y); y += 10;
      doc.setDrawColor(200); doc.line(L, y, R, y); y += 8;

      if (calcCustomer) { doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text(`Für: ${calcCustomer}`, L, y); y += 7; }
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Angebotsnummer: ${calcOfferNr || "-"}`, L, y);
      doc.text(`Datum: ${new Date().toLocaleDateString("de-DE")}`, R, y, { align: "right" }); y += 5;
      doc.text(`Umfang: ${tier.label} · ${calcLang} Sprache(n)`, L, y); y += 8;

      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("Leistungsumfang", L, y); y += 2;
      doc.line(L, y, R, y); y += 6;
      doc.setFontSize(10.5);
      for (const it of items) {
        doc.setFont("helvetica", "normal");
        const label = doc.splitTextToSize(it.label, 135);
        doc.text(label, L, y);
        doc.text(`${it.price.toFixed(2)} EUR`, R, y, { align: "right" });
        y += (label.length * 5) + 2;
      }
      y += 2; doc.line(L, y, R, y); y += 7;

      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("Monatspreis netto", L, y); doc.text(`${total.toFixed(2)} EUR`, R, y, { align: "right" }); y += 7;
      if (vat !== null && !Number.isNaN(vat)) {
        const brutto = total * (1 + vat / 100);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
        doc.text(`zzgl. ${vat}% USt`, L, y); doc.text(`${(brutto - total).toFixed(2)} EUR`, R, y, { align: "right" }); y += 6;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("Monatspreis brutto", L, y); doc.text(`${brutto.toFixed(2)} EUR`, R, y, { align: "right" }); y += 8;
      }

      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`Jährlich: ${(total * 12).toFixed(2)} EUR netto — mit 2 Monaten gratis: ${(total * 10).toFixed(2)} EUR netto`, L, y); y += 9;
      doc.setDrawColor(220); doc.line(L, y, R, y); y += 6;
      doc.setFontSize(9.5); doc.setTextColor(90);
      for (const ln of [
        "Angebot freibleibend. 14 Tage kostenlos testen.",
        "Alle Preise netto zzgl. gesetzlicher Umsatzsteuer. Laufzeit monatlich, sofern nicht anders vereinbart.",
        `Erstellt am ${new Date().toLocaleDateString("de-DE")}.`,
      ]) { doc.text(ln, L, y); y += 5; }
      doc.setTextColor(0);
      doc.save(`Angebot_${(calcCustomer || calcOfferNr || "Regie").toString().replace(/[^\w.-]+/g, "_")}.pdf`);
    } catch (e: any) {
      setMessage("Fehler beim Angebot-PDF: " + String(e?.message || e));
    }
  }

  // Vertrag als PDF herunterladen.
  async function downloadContractPdf(companyId: string) {
    try {
      const doc = await buildContractPdf(companyId);
      const c = contractMap[companyId] || {};
      doc.save(`Vertrag_${(c.contract_number || c.customer_name || "Firma").toString().replace(/[^\w.-]+/g, "_")}.pdf`);
    } catch (e: any) {
      setMessage("Fehler beim PDF: " + String(e?.message || e));
    }
  }

  // Vertrag per E-Mail senden (PDF im Anhang).
  async function sendContractMail(companyId: string) {
    const c = contractMap[companyId] || {};
    const to = (c.invoice_email || "").trim();
    if (!to) { setMessage("Fehler: Keine Rechnungs-E-Mail hinterlegt."); return; }
    if (typeof window !== "undefined" && !window.confirm(`Vertrag als PDF an ${to} senden?`)) return;
    setSendingContract(companyId);
    try {
      const doc = await buildContractPdf(companyId);
      const base64 = doc.output("datauristring").split(",")[1];
      const res = await fetch("/api/send-contract", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ companyId, to, customerName: c.customer_name || "", pdfBase64: base64 }),
      });
      const data = await res.json();
      if (data.error) { setMessage("Fehler: " + data.error); return; }
      setMessage("✅ Vertrag wurde per E-Mail versendet.");
    } catch (e: any) {
      setMessage("Fehler beim Versand: " + String(e?.message || e));
    } finally {
      setSendingContract(null);
    }
  }

  // Vertragsdaten einer Firma laden + Bereich auf-/zuklappen.
  async function toggleContract(companyId: string) {
    if (openContractId === companyId) { setOpenContractId(null); return; }
    setOpenContractId(companyId);
    try {
      const res = await fetch("/api/admin-data", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ action: "getContract", companyId }) });
      const data = await res.json();
      if (data.error) { setMessage("Fehler: " + data.error); return; }
      // Vorbelegen mit den bereits bekannten Daten (nur leere Felder, nichts ueberschreiben).
      const st = settingsMap[companyId] || {};
      const ft = featuresMap[companyId] || {};
      const comp = companies.find((x: any) => x.id === companyId);
      const existing = data.contract || {};
      const prefilled = {
        active: true,
        vat_rate: 19,
        payment_terms: 14,
        payment_method: "Überweisung",
        customer_country: "DE",
        ...existing,
        customer_name:   existing.customer_name   || st.company_name || comp?.name || "",
        customer_street: existing.customer_street || st.street        || "",
        customer_zip:    existing.customer_zip    || st.zip_code      || "",
        customer_city:   existing.customer_city   || st.city          || "",
        vat_id:          existing.vat_id          || st.tax_number    || "",
        invoice_email:   existing.invoice_email   || st.email         || "",
        package:         existing.package         || ft.package_name  || "",
        start_date:      existing.start_date      || (comp?.created_at ? String(comp.created_at).slice(0, 10) : ""),
      };
      setContractMap((prev) => ({ ...prev, [companyId]: prefilled }));
    } catch (e: any) {
      setMessage("Fehler: " + String(e?.message || e));
    }
  }
  function setContractField(companyId: string, field: string, value: any) {
    setContractMap((prev) => ({ ...prev, [companyId]: { ...(prev[companyId] || {}), [field]: value } }));
  }
  async function saveContract(companyId: string) {
    setSavingContract(companyId);
    try {
      const res = await fetch("/api/admin-data", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ action: "saveContract", companyId, contract: contractMap[companyId] || {} }) });
      const data = await res.json();
      if (data.error) { setMessage("Fehler: " + data.error); return; }
      setMessage("✅ Vertragsdaten gespeichert.");
    } catch (e: any) {
      setMessage("Fehler: " + String(e?.message || e));
    } finally {
      setSavingContract(null);
    }
  }

  // Feedback einer Firma laden + Bereich auf-/zuklappen.
  async function toggleFeedback(companyId: string) {
    if (openFeedbackId === companyId) { setOpenFeedbackId(null); return; }
    setOpenFeedbackId(companyId);
    setLoadingFeedback(companyId);
    try {
      const res = await fetch("/api/admin-data", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ action: "getFeedback", companyId }) });
      const data = await res.json();
      if (data.error) { setMessage("Fehler: " + data.error); return; }
      setFeedbackMap((prev) => ({ ...prev, [companyId]: data.feedback || [] }));
    } catch (e: any) {
      setMessage("Fehler: " + String(e?.message || e));
    } finally {
      setLoadingFeedback(null);
    }
  }

  async function createCompany() {
    if (!newCompanyName.trim() || !newCompanySlug.trim() || !newOwnerUsername.trim() || newOwnerPassword.length < 6) {
      setMessage("Bitte alle Pflichtfelder ausfüllen (Passwort min. 6 Zeichen)."); return;
    }
    setCreatingCompany(true);
    const slug = newCompanySlug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const res = await fetch("/api/admin-data", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "createCompany", name: newCompanyName.trim(), slug, ownerUsername: newOwnerUsername, ownerFullName: newOwnerFullName || newOwnerUsername, ownerPassword: newOwnerPassword, packageName: newOwnerPackage }),
    });
    const data = await res.json();
    setCreatingCompany(false);
    if (data.error) { setMessage("Fehler: " + data.error); return; }
    setLastCreated({ username: newOwnerUsername, password: newOwnerPassword, company: newCompanyName.trim(), slug });
    setNewCompanyName(""); setNewCompanySlug(""); setNewOwnerUsername(""); setNewOwnerFullName(""); setNewOwnerPassword(""); setNewOwnerPackage("starter");
    setMessage(`✅ Firma "${newCompanyName}" angelegt.`);
    loadAll();
  }

  async function setCompanyStatus(companyId: string, status: string) {
    const labelAktion = status === "blocked" ? "sperren" : "entsperren";
    if (!confirm(`Firma wirklich ${labelAktion}?`)) return;
    const res = await fetch("/api/admin-data", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "setCompanyStatus", companyId, status }),
    });
    const data = await res.json();
    if (data.error) { setMessage("Fehler beim Status-Update: " + data.error); return; }
    setMessage(status === "blocked" ? "🔒 Firma gesperrt." : "🔓 Firma entsperrt.");
    loadAll();
  }

  async function deleteCompany(companyId: string, companyName: string) {
    if (!confirm(`Firma "${companyName}" wirklich löschen?`)) return;
    const res = await fetch("/api/admin-data", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "deleteCompany", companyId }),
    });
    const data = await res.json();
    if (data.error) { setMessage("Fehler: " + data.error); return; }
    setMessage(`Firma "${companyName}" gelöscht.`);
    loadAll();
  }

  async function updateSlug(companyId: string, newSlug: string) {
    const res = await fetch("/api/admin-data", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "updateSlug", companyId, slug: newSlug }),
    });
    const data = await res.json();
    if (data.error) { setMessage("Fehler beim Slug-Update: " + data.error); return; }
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, slug: newSlug } : c));
  }

  async function resetUserPassword(userId: string, name: string, email: string) {
    const newPassword = window.prompt(`Neues Passwort für "${name || email}" festlegen (mindestens 8 Zeichen).\nDer Mitarbeiter muss es beim ersten Login ändern.`);
    if (newPassword === null) return; // abgebrochen
    if (newPassword.length < 8) { setMessage("Passwort muss mindestens 8 Zeichen haben."); return; }
    const res = await fetch("/api/admin-data", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "resetUserPassword", userId, newPassword }),
    });
    const data = await res.json();
    if (data.error) { setMessage("Fehler: " + data.error); return; }
    setResetCreds({ name: name || email, email });
    setMessage(`✅ Passwort für "${name || email}" gesetzt.`);
  }

  if (!isAdmin) {
    return (
      <main className="max-w-sm mx-auto p-8 min-h-screen bg-gray-900 flex flex-col justify-center">
        <div className="bg-white rounded-xl p-6 space-y-4 shadow-xl">
          <h1 className="text-2xl font-bold text-center">🔐 Admin-Login</h1>
          {message && <div className="bg-red-100 border rounded p-3 text-sm text-red-800">{message}</div>}
          <form onSubmit={(e) => { e.preventDefault(); adminLogin(); }} autoComplete="on" className="space-y-4">
            <input name="email" autoComplete="email" className="border p-3 w-full rounded" placeholder="Admin E-Mail" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            <div className="relative">
              <input name="password" autoComplete="current-password" className="border p-3 w-full rounded pr-12" placeholder="Passwort" type={showAdminPassword ? "text" : "password"} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
              <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">{showAdminPassword ? "🙈" : "👁️"}</button>
            </div>
            <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded font-bold">Einloggen</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 bg-gray-100 min-h-screen text-black">
      <header className="bg-white border rounded-xl p-4 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">🛠 Admin-Panel</h1><p className="text-gray-500 text-sm">Firmen & Module verwalten</p></div>
        <button type="button" onClick={async () => { await supabase.auth.signOut(); setIsAdmin(false); }} className="bg-gray-800 text-white px-4 py-2 rounded">Abmelden</button>
      </header>

      <div className="flex gap-2">
        <button type="button" onClick={() => setAdminTab("firmen")} className={`px-4 py-2 rounded-lg font-medium text-sm ${adminTab === "firmen" ? "bg-cyan-700 text-white" : "bg-white border text-gray-600"}`}>🏢 Firmen &amp; Module</button>
        <button type="button" onClick={() => setAdminTab("rechner")} className={`px-4 py-2 rounded-lg font-medium text-sm ${adminTab === "rechner" ? "bg-cyan-700 text-white" : "bg-white border text-gray-600"}`}>💶 Preis-Rechner</button>
      </div>

      {message && <div className="border rounded p-3 bg-yellow-50 text-black">{message}</div>}

      {adminTab === "rechner" && (() => {
        const { items, total } = computeMonthlyPrice(prices, { tierKey: calcTier, moduleFlags: calcMods, langCount: calcLang });
        return (
          <section className="bg-white border rounded-xl p-4 md:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-bold">💶 Preis-Rechner</h2>
                <p className="text-gray-500 text-sm">Betriebsgröße, Sprachen und Module wählen – der Monatspreis rechnet sich sofort.</p>
              </div>
              <button type="button" onClick={() => setEditPrices((v) => !v)} className={`px-3 py-2 rounded-lg text-sm font-medium ${editPrices ? "bg-amber-600 text-white" : "bg-gray-100 border text-gray-700"}`}>{editPrices ? "✓ Preise bearbeiten" : "✏️ Preise bearbeiten"}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h3 className="font-bold mb-2">Betriebsgröße</h3>
                  <div className="flex flex-wrap gap-2">
                    {prices.seatTiers.map((tr) => (
                      <div key={tr.key} className="flex flex-col">
                        <button type="button" onClick={() => setCalcTier(tr.key)} className={`border-2 rounded-lg px-4 py-2 text-sm font-medium ${calcTier === tr.key ? "border-cyan-600 bg-cyan-50 text-cyan-700" : "border-gray-200 bg-white text-gray-500"}`}>
                          {tr.label} · {tr.price} €
                        </button>
                        {editPrices && (<input type="number" value={tr.price} onChange={(e) => setPrices((p) => ({ ...p, seatTiers: p.seatTiers.map((x) => x.key === tr.key ? { ...x, price: Number(e.target.value) || 0 } : x) }))} className="border p-1 rounded mt-1 text-sm w-full" />)}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Sprachen gesamt (inkl. Deutsch)</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="number" min={1} max={17} value={calcLang} onChange={(e) => setCalcLang(Math.min(17, Math.max(1, Number(e.target.value) || 1)))} className="border p-2 rounded w-28" />
                    {editPrices && (<span className="text-sm text-gray-500 flex items-center gap-1">je weitere Sprache <input type="number" value={prices.perLanguage} onChange={(e) => setPrices((p) => ({ ...p, perLanguage: Number(e.target.value) || 0 }))} className="border p-1 rounded w-16 text-sm" /> €</span>)}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold mb-2">Module dazubuchen</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {prices.modules.map((m) => (
                      <label key={m.key} className="flex items-center justify-between border rounded-lg px-3 py-2 cursor-pointer bg-gray-50">
                        <span className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!calcMods[m.key]} onChange={(e) => setCalcMods((p) => ({ ...p, [m.key]: e.target.checked }))} />
                          {m.label}
                        </span>
                        {editPrices ? (
                          <span className="text-sm text-gray-500 flex items-center gap-1">+<input type="number" value={m.price} onChange={(e) => setPrices((p) => ({ ...p, modules: p.modules.map((x) => x.key === m.key ? { ...x, price: Number(e.target.value) || 0 } : x) }))} className="border p-1 rounded w-16 text-sm" />€</span>
                        ) : (
                          <span className="text-gray-500 text-sm whitespace-nowrap">+{m.price} €</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                {editPrices && (<button type="button" onClick={() => setPrices(JSON.parse(JSON.stringify(PRICING_DEFAULT)))} className="text-sm text-red-600 underline">Preise auf Standard zurücksetzen</button>)}
              </div>
              <div className="bg-emerald-900 text-white rounded-xl p-4 h-fit md:sticky md:top-4">
                <h3 className="font-bold text-emerald-100 mb-2">Dein Preis</h3>
                <div className="space-y-1">
                  {items.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm text-emerald-50/90"><span>{it.label}</span><span className="tabular-nums">{it.price} €</span></div>
                  ))}
                </div>
                <div className="border-t border-white/25 mt-3 pt-3 flex justify-between items-baseline">
                  <span>pro Monat</span><span><span className="text-3xl font-extrabold tabular-nums">{total}</span> €</span>
                </div>
                <p className="text-emerald-100/80 text-xs mt-2">Jährlich: {total * 12} € · mit 2 Monaten gratis: {total * 10} €</p>
                <div className="border-t border-white/20 mt-3 pt-3 space-y-2">
                  <input value={calcCustomer} onChange={(e) => setCalcCustomer(e.target.value)} placeholder="Kunde / Firma (optional)" className="w-full text-black text-sm p-2 rounded" />
                  <div className="flex gap-2">
                    <input value={calcOfferNr} onChange={(e) => setCalcOfferNr(e.target.value)} placeholder="Angebots-Nr." className="w-1/2 text-black text-sm p-2 rounded" />
                    <input value={calcVat} onChange={(e) => setCalcVat(e.target.value)} placeholder="USt %" className="w-1/2 text-black text-sm p-2 rounded" />
                  </div>
                  <button type="button" onClick={downloadOfferPdf} className="w-full bg-white text-emerald-900 font-bold px-4 py-2.5 rounded-lg text-sm">📄 Angebot als PDF</button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">Vorschlagspreise (netto). Über „Preise bearbeiten" anpassbar – Änderungen werden im Browser gespeichert.</p>
          </section>
        );
      })()}

      {resetCreds && (
        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 space-y-2">
          <h3 className="font-bold text-green-700">🔑 Passwort gesetzt</h3>
          <p><strong>Mitarbeiter:</strong> {resetCreds.name}</p>
          <p><strong>E-Mail/Login:</strong> {resetCreds.email}</p>
          <p className="text-sm text-orange-600">⚠️ Der Mitarbeiter wird beim nächsten Login zum Ändern aufgefordert. Das Passwort wird aus Sicherheitsgründen nicht angezeigt.</p>
          <button type="button" onClick={() => setResetCreds(null)} className="bg-gray-200 px-4 py-2 rounded text-sm">Schließen</button>
        </div>
      )}

      {adminTab === "firmen" && (<div className="space-y-6">

      {/* Impressum & Datenschutz */}
      <section className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2 cursor-pointer select-none" onClick={() => setOpenLegal((v) => !v)}><span>{openLegal ? "▾" : "▸"}</span>📄 Impressum & Datenschutz</h2>
        {openLegal && (<div className="space-y-4">
          <p className="text-sm text-gray-500">Diese Texte erscheinen öffentlich unter /impressum und /datenschutz. Platzhalter in [eckigen Klammern] ausfüllen – und vor dem Verkauf rechtlich prüfen lassen.</p>
          <div className="space-y-1">
            <label className="font-medium text-sm">Impressum</label>
            <textarea className="border p-3 w-full rounded text-sm font-mono" rows={12} value={legalImpressum} onChange={(e) => setLegalImpressum(e.target.value)} placeholder="Impressum-Text …" />
          </div>
          <div className="space-y-1">
            <label className="font-medium text-sm">Datenschutzerklärung</label>
            <textarea className="border p-3 w-full rounded text-sm font-mono" rows={16} value={legalDatenschutz} onChange={(e) => setLegalDatenschutz(e.target.value)} placeholder="Datenschutz-Text …" />
          </div>
          <button type="button" onClick={saveLegal} disabled={savingLegal} className="bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50">{savingLegal ? "Speichere …" : "Speichern"}</button>
        </div>)}
      </section>

      {/* Neue Firma */}
      <section className="bg-white border rounded-xl p-4 space-y-4">
        <h2 className="text-lg font-bold">➕ Neue Firma anlegen</h2>
        {lastCreated && (
          <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-green-700">✅ Zugangsdaten für den Kunden:</h3>
            <p><strong>Firma:</strong> {lastCreated.company}</p>
            <p><strong>Firmenkürzel:</strong> {lastCreated.slug}</p>
            <p><strong>Benutzername:</strong> {lastCreated.username}</p>
            <p><strong>Passwort:</strong> {lastCreated.password}</p>
            <p className="text-sm text-orange-600">⚠️ Bitte jetzt notieren!</p>
            <button type="button" onClick={() => setLastCreated(null)} className="bg-gray-200 px-4 py-2 rounded text-sm">Schließen</button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border p-3 rounded" placeholder="Firmenname *" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} />
          <input className="border p-3 rounded" placeholder="Firmenkürzel * (z.B. luger)" value={newCompanySlug} onChange={(e) => setNewCompanySlug(e.target.value)} />
          <input className="border p-3 rounded" placeholder="Owner Vollständiger Name" value={newOwnerFullName} onChange={(e) => setNewOwnerFullName(e.target.value)} />
          <input className="border p-3 rounded" placeholder="Owner Benutzername *" value={newOwnerUsername} onChange={(e) => setNewOwnerUsername(e.target.value)} />
          <input className="border p-3 rounded" placeholder="Owner Passwort *" type="password" value={newOwnerPassword} onChange={(e) => setNewOwnerPassword(e.target.value)} />
          <div className="flex items-center">{newCompanySlug && newOwnerUsername && <p className="text-sm text-blue-600">Login: <strong>{newCompanySlug.toLowerCase()}</strong> + <strong>{newOwnerUsername.toLowerCase()}</strong></p>}</div>
          <div className="md:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(PACKAGES).map(([key, pkg]) => (
                <button key={key} type="button" onClick={() => setNewOwnerPackage(key)} className={`border-2 rounded-lg p-2 text-sm font-medium ${newOwnerPackage === key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200"}`}>{pkg.label}</button>
              ))}
            </div>
          </div>
        </div>
        <button type="button" onClick={createCompany} disabled={creatingCompany} className="bg-blue-700 text-white px-6 py-3 rounded font-medium w-full disabled:opacity-50">
          {creatingCompany ? "Wird angelegt..." : "➕ Firma + Owner anlegen"}
        </button>
      </section>

      {/* Firmen Liste */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">🏢 Firmen ({companies.length})</h2>
        {companies.length === 0 && <div className="bg-white border rounded-xl p-6 text-gray-500 text-center">Noch keine Firmen vorhanden.</div>}
        {companies.map((company) => {
          const features = featuresMap[company.id] || {};
          const pkg = PACKAGES[features.package_name] || PACKAGES.starter;
          const isOpen = openCompanyId === company.id;
          const users = company.users || [];
          return (
            <div key={company.id} className={`border-2 rounded-xl overflow-hidden ${pkg.color}`}>
              <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setOpenCompanyId(isOpen ? null : company.id)}>
                <div className="flex items-center gap-3">
                  <span>{isOpen ? "▾" : "▸"}</span>
                  <div>
                    <div className="font-bold text-lg flex items-center gap-2">{company.name}{company.status === "blocked" && <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white">🔒 GESPERRT</span>}</div>
                    <div className="text-sm text-gray-500">Kürzel: <strong>{company.slug || "—"}</strong> | {users.length} Mitarbeiter | {new Date(company.created_at).toLocaleDateString("de-DE")}</div>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded border ${pkg.color}`}>{pkg.label}</span>
              </div>

              {isOpen && (
                <div className="bg-white border-t p-4 space-y-6">
                  <div>
                    <h3 className="font-bold mb-2">🔑 Firmenkürzel</h3>
                    <input className="border p-2 rounded w-full max-w-xs" value={company.slug || ""} onChange={(e) => { const s = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); updateSlug(company.id, s); }} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-3 flex items-center gap-2 cursor-pointer select-none" onClick={() => setOpenDataId(openDataId === company.id ? null : company.id)}><span>{openDataId === company.id ? "▾" : "▸"}</span>🏢 Firmendaten</h3>
                    {openDataId === company.id && (<>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Interner Firmenname (Admin-Liste)</label>
                        <input className="border p-2 rounded w-full" value={nameMap[company.id] ?? company.name ?? ""} onChange={(e) => updateName(company.id, e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Firmenname für PDF / Berichte</label>
                        <input className="border p-2 rounded w-full" value={settingsMap[company.id]?.company_name ?? ""} onChange={(e) => updateSettings(company.id, "company_name", e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm text-gray-600 block mb-1">Straße & Hausnummer</label>
                        <input className="border p-2 rounded w-full" value={settingsMap[company.id]?.street ?? ""} onChange={(e) => updateSettings(company.id, "street", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">PLZ</label>
                        <input className="border p-2 rounded w-full" value={settingsMap[company.id]?.zip_code ?? ""} onChange={(e) => updateSettings(company.id, "zip_code", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Ort</label>
                        <input className="border p-2 rounded w-full" value={settingsMap[company.id]?.city ?? ""} onChange={(e) => updateSettings(company.id, "city", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Telefon</label>
                        <input className="border p-2 rounded w-full" value={settingsMap[company.id]?.phone ?? ""} onChange={(e) => updateSettings(company.id, "phone", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">E-Mail</label>
                        <input className="border p-2 rounded w-full" value={settingsMap[company.id]?.email ?? ""} onChange={(e) => updateSettings(company.id, "email", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Website</label>
                        <input className="border p-2 rounded w-full" value={settingsMap[company.id]?.website ?? ""} onChange={(e) => updateSettings(company.id, "website", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Steuernummer</label>
                        <input className="border p-2 rounded w-full" value={settingsMap[company.id]?.tax_number ?? ""} onChange={(e) => updateSettings(company.id, "tax_number", e.target.value)} />
                      </div>
                    </div>
                    {!company.owner_user_id && (
                      <p className="text-sm text-orange-600 mt-2">⚠️ Kein Owner gefunden – die PDF-Firmendaten können nicht gespeichert werden (nur der interne Name).</p>
                    )}
                    <button type="button" onClick={() => saveCompanyData(company.id)} disabled={savingData === company.id} className="mt-3 bg-indigo-700 text-white px-5 py-2 rounded font-medium disabled:opacity-50">
                      {savingData === company.id ? "Speichert..." : "💾 Firmendaten speichern"}
                    </button>
                    </>)}
                  </div>
                  <div>
                    <h3 className="font-bold mb-3">📦 Paket</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(PACKAGES).map(([key, pkg]) => (
                        <button key={key} type="button" onClick={() => applyPackage(company.id, key)} className={`border-2 rounded-lg p-3 text-sm font-medium ${features.package_name === key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white"}`}>{pkg.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold mb-3">📅 Lizenz & Limits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Max. Mitarbeiter</label>
                        <input type="number" className="border p-2 rounded w-full" value={features.max_employees || 5} onChange={(e) => updateFeature(company.id, "max_employees", Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Max. Fotos (0 = unbegrenzt)</label>
                        <input type="number" min="0" className="border p-2 rounded w-full" value={features.max_photos ?? 2} onChange={(e) => updateFeature(company.id, "max_photos", Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Gültig bis</label>
                        <input type="date" className="border p-2 rounded w-full" value={features.valid_until || ""} onChange={(e) => updateFeature(company.id, "valid_until", e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold mb-3">🧩 Module</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Toggle label="📋 Regieberichte"      value={!!features.module_reports}      onChange={(v) => updateFeature(company.id, "module_reports", v)} />
                      <Toggle label="🤖 Auto-Regieberichte" value={!!features.module_auto_reports} onChange={(v) => updateFeature(company.id, "module_auto_reports", v)} />
                      <Toggle label="📸 Foto-Upload"        value={!!features.photos_enabled}      onChange={(v) => updateFeature(company.id, "photos_enabled", v)} />
                      <Toggle label="✉️ E-Mail-Versand"      value={!!features.email_enabled}       onChange={(v) => updateFeature(company.id, "email_enabled", v)} />
                      <Toggle label="✍️ Unterschriften"     value={!!features.signature_enabled}   onChange={(v) => updateFeature(company.id, "signature_enabled", v)} />
                      <Toggle label="💬 Feedback / Test"     value={!!features.feedback_enabled}    onChange={(v) => updateFeature(company.id, "feedback_enabled", v)} />
                      <Toggle label="🌐 Live-Übersetzer"     value={!!features.translator_enabled}  onChange={(v) => updateFeature(company.id, "translator_enabled", v)} />
                      <Toggle label="💬 Kommentar-Chat"      value={!!features.comments_enabled}    onChange={(v) => updateFeature(company.id, "comments_enabled", v)} />
                      <Toggle label="📦 Materialerfassung"    value={!!features.material_enabled}    onChange={(v) => updateFeature(company.id, "material_enabled", v)} />
                      <Toggle label="📊 Stundenexport"       value={!!features.export_enabled}      onChange={(v) => updateFeature(company.id, "export_enabled", v)} />
                      <Toggle label="🚚 Fahrzeuge & Werkzeuge" value={!!features.equipment_enabled} onChange={(v) => updateFeature(company.id, "equipment_enabled", v)} />
                      <Toggle label="🌴 Urlaub & Abwesenheit" value={!!features.absence_enabled}  onChange={(v) => updateFeature(company.id, "absence_enabled", v)} />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold mb-3">🌐 Sprachen</h3>
                    <div className="flex flex-wrap gap-2">
                      {ALL_LANGUAGES.map((lang) => {
                        const active = (features.allowed_languages || []).includes(lang);
                        return (
                          <button key={lang} type="button" onClick={() => toggleLanguage(company.id, lang)} className={`border-2 rounded-lg px-4 py-2 text-sm font-medium ${active ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-400"}`}>
                            {active ? "✓ " : ""}{lang}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {(() => {
                    const { items, total } = computeMonthlyPrice(prices, { employeeCount: users.length, moduleFlags: features, langCount: (features.allowed_languages || []).length });
                    return (
                      <div>
                        <h3 className="font-bold mb-3">💶 Preis-Vorschlag (netto / Monat)</h3>
                        <div className="border rounded-lg bg-emerald-50 p-3">
                          <div className="space-y-1">
                            {items.map((it, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-700">{it.label}</span>
                                <span className="font-medium tabular-nums">{it.price} €</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t mt-2 pt-2 flex justify-between font-bold text-emerald-800">
                            <span>Gesamt / Monat</span>
                            <span className="tabular-nums">{total} €</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Berechnet aus aktivierten Modulen, {users.length} Mitarbeiter und {(features.allowed_languages || []).length} Sprache(n). Grundlage: PRICING im Code.</p>
                        </div>
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className="font-bold mb-3">👥 Mitarbeiter ({users.length} / {features.max_employees || 5})</h3>
                    {users.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Mitarbeiter.</p> : (
                      <div className="space-y-2">
                        {users.map((u: any) => (
                          <div key={u.id} className="flex items-center justify-between border rounded p-2 bg-gray-50">
                            <div><span className="font-medium">{u.full_name || "-"}</span><span className="text-gray-500 text-sm ml-2">{u.email || "-"}</span></div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded font-bold ${u.role === "owner" ? "bg-orange-100 text-orange-700" : u.role === "admin" ? "bg-purple-100 text-purple-700" : u.role === "project_manager" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{u.role}</span>
                              <button type="button" onClick={() => resetUserPassword(u.user_id, u.full_name, u.email)} className="bg-gray-700 text-white px-2 py-1 rounded text-xs">🔑 Passwort</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <button type="button" onClick={() => toggleContract(company.id)} className="bg-slate-700 text-white px-4 py-2.5 rounded font-bold text-sm">📄 Vertrag {openContractId === company.id ? "▲" : "▼"}</button>
                    {openContractId === company.id && (() => {
                      const c = contractMap[company.id] || {};
                      const F = (label: string, field: string, type = "text", ph = "") => (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-600">{label}</label>
                          <input type={type} placeholder={ph} value={c[field] ?? ""} onChange={(ev) => setContractField(company.id, field, ev.target.value)} className="border p-2 rounded text-sm" />
                        </div>
                      );
                      return (
                        <div className="mt-2 border rounded p-3 bg-gray-50 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {F("Vertragsnummer", "contract_number", "text", "z. B. V-2026-001")}
                            {F("Paket", "package", "text", "Starter / Team / Business")}
                            {F("Preis pro Monat (netto)", "monthly_price", "number", "z. B. 49")}
                            {F("USt-Satz in %", "vat_rate", "number", "19 (DE) / 20 (AT)")}
                            {F("Vertragsbeginn", "start_date", "date")}
                            {F("Vertragsende (optional)", "end_date", "date")}
                            {F("Rechnungsempfänger", "customer_name", "text", "Firmenname")}
                            {F("Straße", "customer_street")}
                            {F("PLZ", "customer_zip")}
                            {F("Ort", "customer_city")}
                            {F("Land", "customer_country", "text", "DE / AT")}
                            {F("USt-IdNr. / Steuernummer", "vat_id")}
                            {F("Rechnungs-E-Mail", "invoice_email", "email")}
                            {F("Zahlungsart", "payment_method", "text", "Überweisung / SEPA")}
                            {F("Zahlungsziel (Tage)", "payment_terms", "number", "14")}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600">Notizen</label>
                            <textarea rows={2} value={c.notes ?? ""} onChange={(ev) => setContractField(company.id, "notes", ev.target.value)} className="border p-2 rounded text-sm" />
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={!!c.active} onChange={(ev) => setContractField(company.id, "active", ev.target.checked)} />
                            Vertrag aktiv
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={savingContract === company.id} onClick={() => saveContract(company.id)} className="bg-cyan-700 text-white px-4 py-2.5 rounded font-bold text-sm disabled:opacity-50">
                              {savingContract === company.id ? "⏳ Speichert…" : "💾 Vertrag speichern"}
                            </button>
                            <button type="button" onClick={() => downloadContractPdf(company.id)} className="bg-slate-700 text-white px-4 py-2.5 rounded font-bold text-sm">📄 PDF drucken</button>
                            <button type="button" disabled={sendingContract === company.id} onClick={() => sendContractMail(company.id)} className="bg-green-700 text-white px-4 py-2.5 rounded font-bold text-sm disabled:opacity-50">
                              {sendingContract === company.id ? "⏳ Sendet…" : "✉️ Per E-Mail senden"}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <button type="button" onClick={() => toggleFeedback(company.id)} className="bg-cyan-700 text-white px-4 py-2.5 rounded font-bold text-sm">💬 Feedback ansehen {openFeedbackId === company.id ? "▲" : "▼"}</button>
                    {openFeedbackId === company.id && (
                      <div className="mt-2 space-y-2">
                        {loadingFeedback === company.id ? (<p className="text-gray-400 text-sm">⏳ Lädt…</p>) : (feedbackMap[company.id] || []).length === 0 ? (<p className="text-gray-400 text-sm">Noch kein Feedback.</p>) : (feedbackMap[company.id] || []).map((f: any) => (
                          <div key={f.id} className="border rounded p-3 bg-gray-50 text-sm space-y-1">
                            <p className="font-semibold">{f.user_name || "?"}{f.role ? ` (${f.role === "owner" ? "Owner" : f.role === "admin" ? "Admin" : f.role === "project_manager" ? "Projektleiter" : "Mitarbeiter"})` : ""} · {new Date(f.created_at).toLocaleString("de-DE")}</p>
                            {FEEDBACK_POINTS.map((pt, i) => (((f.answers?.[i] || "").trim()) ? (<p key={i} className="break-words"><strong>{pt}:</strong> {f.answers[i]}</p>) : null))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2 border-t">
                    <button type="button" onClick={() => saveFeatures(company.id)} disabled={saving === company.id} className="bg-blue-700 text-white px-6 py-3 rounded font-bold disabled:opacity-50">
                      {saving === company.id ? "Speichert..." : "💾 Einstellungen speichern"}
                    </button>
                    {company.status === "blocked" ? (
                      <button type="button" onClick={() => setCompanyStatus(company.id, "active")} className="bg-green-700 text-white px-4 py-3 rounded font-bold">🔓 Firma entsperren</button>
                    ) : (
                      <button type="button" onClick={() => setCompanyStatus(company.id, "blocked")} className="bg-orange-600 text-white px-4 py-3 rounded font-bold">🔒 Firma sperren</button>
                    )}
                    <button type="button" onClick={() => deleteCompany(company.id, company.name)} className="bg-red-600 text-white px-4 py-3 rounded">🗑 Firma löschen</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      </div>)}
    </main>
  );
}
