"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import QRCode from "qrcode";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const languages = ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch"];
const pdfLanguages = ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"];
const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

type Language = "Deutsch" | "Kroatisch" | "Slowenisch" | "Polnisch";

type DayEntry = {
  weekday: string;
  date: string;
  customer: string;
  projectNumber: string;
  site: string;
  hours: string;
  description: string;
  translation: string;
  photos: string[];
};

type SavedReport = {
  id: string;
  report_name: string;
  employee: string;
  from_language: string;
  to_language: string;
  pdf_language?: string;
  days: DayEntry[];
  created_at: string;
  user_id: string;
};

type CompanySettings = {
  id?: string;
  user_id: string;
  company_name: string;
  company_logo?: string;
  street?: string;
  zip_code?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  tax_number?: string;
};

type CurrentCompany = {
  company_id: string;
  role: string;
  companies: {
    id: string;
    name: string;
  };
};

type CompanyFeatures = {
  company_id: string;
  module_reports: boolean;
  module_work_orders: boolean;
  module_auto_reports: boolean;
  photos_enabled: boolean;
  email_enabled: boolean;
  signature_enabled: boolean;
  ai_enabled: boolean;
  max_employees: number;
  allowed_languages: string[];
};

const texts = {
  Deutsch: {
    title: "Wochen-Regiebericht",
    subtitle: "Regieberichte erfassen, übersetzen, speichern und versenden.",
    loginTitle: "Regiebericht Login",
    email: "E-Mail",
    password: "Passwort",
    login: "Einloggen",
    register: "Registrieren",
    logout: "Abmelden",
    loggedInAs: "Angemeldet als",
    saveLoad: "Bericht speichern / laden",
    reportName: "Berichtsname, z. B. KW 22 - Vormittag",
    saveReport: "Bericht speichern",
    updateReport: "Bericht aktualisieren",
    newReport: "Neuer Bericht",
    savedReports: "Meine gespeicherten Berichte",
    loadEdit: "Laden / Bearbeiten",
    delete: "Löschen",
    general: "Allgemeine Angaben",
    appLanguage: "App-Sprache",
    pdfLanguage: "PDF-Sprache",
    employee: "Mitarbeiter",
    calendarWeek: "Kalenderwoche",
    recipientEmail: "Empfänger-E-Mail für PDF-Versand",
    customer: "Kunde",
    projectNumber: "Projektnummer",
    site: "Baustelle",
    hours: "Stunden",
    description: "Arbeitsbeschreibung",
    translation: "Übersetzung",
    deletePhoto: "Foto löschen",
    hoursOverview: "Stundenübersicht",
    total: "Gesamt",
    translateWeek: "Woche übersetzen",
    translating: "Übersetze...",
    save: "Speichern",
    update: "Aktualisieren",
    downloadPdf: "PDF herunterladen",
    sendPdf: "PDF per E-Mail senden",
    // Dashboard
    dashboard: "Dashboard",
    projects: "Projekte",
    workInstructions: "Arbeitsanweisungen",
    dueToday: "Heute fällig",
    totalProgress: "Gesamtfortschritt",
    stoppedSteps: "Gestoppte Arbeitsschritte",
    stepsInProgress: "Arbeitsschritte in Arbeit",
    noProject: "Kein Projekt",
    // Projekte
    projectsTab: "Projekte",
    projectName: "Projektname",
    projectCustomer: "Kunde",
    projectSite: "Baustelle",
    projectManager: "Projektleiter",
    saveProject: "Projekt speichern",
    deleteProject: "Projekt löschen",
    openProject: "Projekt öffnen",
    closeProject: "Schließen",
    progress: "Fortschritt",
    noInstructions: "Noch keine Arbeitsanweisungen für dieses Projekt.",
    noReports: "Noch keine Regieberichte für dieses Projekt.",
    reportsTab: "Regieberichte",
    // Arbeitsanweisungen
    newInstruction: "Neue Arbeitsanweisung",
    instructionTitle: "Titel",
    selectProject: "Projekt auswählen",
    problems: "Probleme / Hinweise",
    workSteps: "Arbeitsschritte",
    addStep: "+ Arbeitsschritt",
    saveInstruction: "Arbeitsanweisung speichern",
    savedInstructions: "Gespeicherte Arbeitsanweisungen",
    noInstructionsSaved: "Noch keine Arbeitsanweisungen vorhanden.",
    date: "Datum",
    project: "Projekt",
    translateTo: "Übersetzen nach",
    translating2: "Übersetze...",
    translated: "Übersetzt",
    feedback: "Rückmeldung",
    saveFeedback: "Rückmeldung speichern",
    toReport: "In Regiebericht übernehmen",
    deleteInstruction: "Arbeitsanweisung löschen",
    autoReportLocked: "Automatische Regieberichte sind in deinem Paket nicht aktiviert.",
    // Mitarbeiter
    employeeManagement: "Mitarbeiterverwaltung",
    name: "Name",
    role: "Rolle",
    addEmployee: "Mitarbeiter hinzufügen",
    currentEmployees: "Aktuelle Mitarbeiter",
    resetPassword: "Passwort zurücksetzen",
    // Firmendaten
    companyData: "Firmendaten",
    uploadLogo: "Firmenlogo hochladen",
    companyName: "Firmenname",
    street: "Straße",
    zip: "PLZ",
    city: "Ort",
    phone: "Telefon",
    website: "Webseite",
    taxNumber: "UID / Steuernummer",
    saveCompany: "Firmendaten speichern",
    // Berichte
    reportNameLabel: "Berichtsname",
    firma: "Firma",
    feedbackLabel: "Rückmeldung",
    noProjectsYet: "Noch keine Projekte vorhanden.",
    noInstructionsYet: "Noch keine Arbeitsanweisungen vorhanden.",
    problemsHints: "Probleme / Hinweise",
    roleEmployee: "Mitarbeiter",
    roleProjectManager: "Projektleiter",
    roleAdmin: "Admin",
  },
  Kroatisch: {
    title: "Tjedni režijski izvještaj",
    subtitle: "Unos, prijevod, spremanje i slanje izvještaja.",
    loginTitle: "Prijava",
    email: "E-pošta",
    password: "Lozinka",
    login: "Prijava",
    register: "Registracija",
    logout: "Odjava",
    loggedInAs: "Prijavljen kao",
    saveLoad: "Spremi / učitaj izvještaj",
    reportName: "Naziv izvještaja",
    saveReport: "Spremi izvještaj",
    updateReport: "Ažuriraj izvještaj",
    newReport: "Novi izvještaj",
    savedReports: "Moji spremljeni izvještaji",
    loadEdit: "Učitaj / uredi",
    delete: "Obriši",
    general: "Opći podaci",
    appLanguage: "Jezik aplikacije",
    pdfLanguage: "Jezik PDF-a",
    employee: "Radnik",
    calendarWeek: "Kalendarski tjedan",
    recipientEmail: "E-mail primatelja za PDF",
    customer: "Kupac",
    projectNumber: "Broj projekta",
    site: "Gradilište",
    hours: "Sati",
    description: "Opis rada",
    translation: "Prijevod",
    deletePhoto: "Obriši fotografiju",
    hoursOverview: "Pregled sati",
    total: "Ukupno",
    translateWeek: "Prevedi tjedan",
    translating: "Prevodi se...",
    save: "Spremi",
    update: "Ažuriraj",
    downloadPdf: "Preuzmi PDF",
    sendPdf: "Pošalji PDF e-poštom",
    dashboard: "Nadzorna ploča",
    projects: "Projekti",
    workInstructions: "Radne upute",
    dueToday: "Danas dospijeva",
    totalProgress: "Ukupni napredak",
    stoppedSteps: "Zaustavljeni koraci",
    stepsInProgress: "Koraci u tijeku",
    noProject: "Nema projekta",
    projectsTab: "Projekti",
    projectName: "Naziv projekta",
    projectCustomer: "Kupac",
    projectSite: "Gradilište",
    projectManager: "Voditelj projekta",
    saveProject: "Spremi projekt",
    deleteProject: "Obriši projekt",
    openProject: "Otvori projekt",
    closeProject: "Zatvori",
    progress: "Napredak",
    noInstructions: "Još nema radnih uputa za ovaj projekt.",
    noReports: "Još nema izvještaja za ovaj projekt.",
    reportsTab: "Режijski izvještaji",
    newInstruction: "Nova radna uputa",
    instructionTitle: "Naslov",
    selectProject: "Odaberi projekt",
    problems: "Problemi / napomene",
    workSteps: "Radni koraci",
    addStep: "+ Korak",
    saveInstruction: "Spremi radnu uputu",
    savedInstructions: "Spremljene radne upute",
    noInstructionsSaved: "Još nema radnih uputa.",
    date: "Datum",
    project: "Projekt",
    translateTo: "Prevedi na",
    translating2: "Prevođenje...",
    translated: "Prevedeno",
    feedback: "Povratna informacija",
    saveFeedback: "Spremi povratnu informaciju",
    toReport: "Prenesi u izvještaj",
    deleteInstruction: "Obriši radnu uputu",
    autoReportLocked: "Automatski izvještaji nisu aktivni u vašem paketu.",
    employeeManagement: "Upravljanje radnicima",
    name: "Ime",
    role: "Uloga",
    addEmployee: "Dodaj radnika",
    currentEmployees: "Trenutni radnici",
    resetPassword: "Resetiraj lozinku",
    companyData: "Podaci o tvrtki",
    uploadLogo: "Učitaj logotip",
    companyName: "Naziv tvrtke",
    street: "Ulica",
    zip: "Poštanski broj",
    city: "Grad",
    phone: "Telefon",
    website: "Web stranica",
    taxNumber: "OIB / Porezni broj",
    saveCompany: "Spremi podatke tvrtke",
    reportNameLabel: "Naziv izvještaja",
    firma: "Tvrtka",
    feedbackLabel: "Povratna informacija",
    noProjectsYet: "Još nema projekata.",
    noInstructionsYet: "Još nema radnih uputa.",
    problemsHints: "Problemi / napomene",
    roleEmployee: "Radnik",
    roleProjectManager: "Voditelj projekta",
    roleAdmin: "Administrator",
  },
  Slowenisch: {
    title: "Tedensko poročilo",
    subtitle: "Vnos, prevod, shranjevanje in pošiljanje poročil.",
    loginTitle: "Prijava",
    email: "E-pošta",
    password: "Geslo",
    login: "Prijava",
    register: "Registracija",
    logout: "Odjava",
    loggedInAs: "Prijavljen kot",
    saveLoad: "Shrani / naloži poročilo",
    reportName: "Ime poročila",
    saveReport: "Shrani poročilo",
    updateReport: "Posodobi poročilo",
    newReport: "Novo poročilo",
    savedReports: "Moja shranjena poročila",
    loadEdit: "Naloži / uredi",
    delete: "Izbriši",
    general: "Splošni podatki",
    appLanguage: "Jezik aplikacije",
    pdfLanguage: "Jezik PDF-a",
    employee: "Zaposleni",
    calendarWeek: "Koledarski teden",
    recipientEmail: "E-pošta prejemnika za PDF",
    customer: "Stranka",
    projectNumber: "Številka projekta",
    site: "Gradbišče",
    hours: "Ure",
    description: "Opis dela",
    translation: "Prevod",
    deletePhoto: "Izbriši fotografijo",
    hoursOverview: "Pregled ur",
    total: "Skupaj",
    translateWeek: "Prevedi teden",
    translating: "Prevajam...",
    save: "Shrani",
    update: "Posodobi",
    downloadPdf: "Prenesi PDF",
    sendPdf: "Pošlji PDF po e-pošti",
    dashboard: "Nadzorna plošča",
    projects: "Projekti",
    workInstructions: "Delovne navodila",
    dueToday: "Danes dospeva",
    totalProgress: "Skupni napredek",
    stoppedSteps: "Ustavljeni koraki",
    stepsInProgress: "Koraki v teku",
    noProject: "Ni projekta",
    projectsTab: "Projekti",
    projectName: "Ime projekta",
    projectCustomer: "Stranka",
    projectSite: "Gradbišče",
    projectManager: "Vodja projekta",
    saveProject: "Shrani projekt",
    deleteProject: "Izbriši projekt",
    openProject: "Odpri projekt",
    closeProject: "Zapri",
    progress: "Napredek",
    noInstructions: "Še ni delovnih navodil za ta projekt.",
    noReports: "Še ni poročil za ta projekt.",
    reportsTab: "Режijska poročila",
    newInstruction: "Novo delovno navodilo",
    instructionTitle: "Naslov",
    selectProject: "Izberi projekt",
    problems: "Težave / opombe",
    workSteps: "Delovni koraki",
    addStep: "+ Korak",
    saveInstruction: "Shrani delovno navodilo",
    savedInstructions: "Shranjena delovna navodila",
    noInstructionsSaved: "Še ni delovnih navodil.",
    date: "Datum",
    project: "Projekt",
    translateTo: "Prevedi v",
    translating2: "Prevajam...",
    translated: "Prevedeno",
    feedback: "Povratna informacija",
    saveFeedback: "Shrani povratno informacijo",
    toReport: "Prenesi v poročilo",
    deleteInstruction: "Izbriši delovno navodilo",
    autoReportLocked: "Samodejno poročanje ni aktivno v vašem paketu.",
    employeeManagement: "Upravljanje zaposlenih",
    name: "Ime",
    role: "Vloga",
    addEmployee: "Dodaj zaposlenega",
    currentEmployees: "Trenutni zaposleni",
    resetPassword: "Ponastavi geslo",
    companyData: "Podatki o podjetju",
    uploadLogo: "Naloži logotip",
    companyName: "Ime podjetja",
    street: "Ulica",
    zip: "Poštna številka",
    city: "Mesto",
    phone: "Telefon",
    website: "Spletna stran",
    taxNumber: "DDV / Davčna številka",
    saveCompany: "Shrani podatke podjetja",
    reportNameLabel: "Ime poročila",
    firma: "Podjetje",
    feedbackLabel: "Povratna informacija",
    noProjectsYet: "Še ni projektov.",
    noInstructionsYet: "Še ni delovnih navodil.",
    problemsHints: "Težave / opombe",
    roleEmployee: "Zaposleni",
    roleProjectManager: "Vodja projekta",
    roleAdmin: "Administrator",
  },
  Polnisch: {
    title: "Tygodniowy raport roboczy",
    subtitle: "Wprowadzanie, tłumaczenie, zapisywanie i wysyłanie raportów.",
    loginTitle: "Logowanie",
    email: "E-mail",
    password: "Hasło",
    login: "Zaloguj",
    register: "Zarejestruj",
    logout: "Wyloguj",
    loggedInAs: "Zalogowany jako",
    saveLoad: "Zapisz / wczytaj raport",
    reportName: "Nazwa raportu",
    saveReport: "Zapisz raport",
    updateReport: "Aktualizuj raport",
    newReport: "Nowy raport",
    savedReports: "Moje zapisane raporty",
    loadEdit: "Wczytaj / edytuj",
    delete: "Usuń",
    general: "Dane ogólne",
    appLanguage: "Język aplikacji",
    pdfLanguage: "Język PDF",
    employee: "Pracownik",
    calendarWeek: "Tydzień kalendarzowy",
    recipientEmail: "E-mail odbiorcy PDF",
    customer: "Klient",
    projectNumber: "Numer projektu",
    site: "Budowa",
    hours: "Godziny",
    description: "Opis pracy",
    translation: "Tłumaczenie",
    deletePhoto: "Usuń zdjęcie",
    hoursOverview: "Przegląd godzin",
    total: "Razem",
    translateWeek: "Przetłumacz tydzień",
    translating: "Tłumaczenie...",
    save: "Zapisz",
    update: "Aktualizuj",
    downloadPdf: "Pobierz PDF",
    sendPdf: "Wyślij PDF e-mailem",
    // Dashboard
    dashboard: "Panel główny",
    projects: "Projekty",
    workInstructions: "Instrukcje pracy",
    dueToday: "Należne dzisiaj",
    totalProgress: "Ogólny postęp",
    stoppedSteps: "Zatrzymane kroki",
    stepsInProgress: "Kroki w toku",
    noProject: "Brak projektu",
    // Projekte
    projectsTab: "Projekty",
    projectName: "Nazwa projektu",
    projectCustomer: "Klient",
    projectSite: "Budowa",
    projectManager: "Kierownik projektu",
    saveProject: "Zapisz projekt",
    deleteProject: "Usuń projekt",
    openProject: "Otwórz projekt",
    closeProject: "Zamknij",
    progress: "Postęp",
    noInstructions: "Brak instrukcji dla tego projektu.",
    noReports: "Brak raportów dla tego projektu.",
    reportsTab: "Raporty robocze",
    // Arbeitsanweisungen
    newInstruction: "Nowa instrukcja pracy",
    instructionTitle: "Tytuł",
    selectProject: "Wybierz projekt",
    problems: "Problemy / Uwagi",
    workSteps: "Kroki pracy",
    addStep: "+ Krok",
    saveInstruction: "Zapisz instrukcję",
    savedInstructions: "Zapisane instrukcje",
    noInstructionsSaved: "Brak zapisanych instrukcji.",
    date: "Data",
    project: "Projekt",
    translateInstruction: "Przetłumacz na",
    translating2: "Tłumaczenie...",
    translated: "Przetłumaczono",
    translateTo: "Przetłumacz na",
    feedback: "Informacja zwrotna",
    saveFeedback: "Zapisz informację",
    toReport: "Przenieś do raportu",
    deleteInstruction: "Usuń instrukcję",
    autoReportLocked: "Automatyczne raporty nie są aktywne w Twoim pakiecie.",
    // Mitarbeiter
    employeeManagement: "Zarządzanie pracownikami",
    name: "Imię",
    role: "Rola",
    addEmployee: "Dodaj pracownika",
    currentEmployees: "Aktualni pracownicy",
    resetPassword: "Resetuj hasło",
    // Firmendaten
    companyData: "Dane firmy",
    uploadLogo: "Prześlij logo",
    companyName: "Nazwa firmy",
    street: "Ulica",
    zip: "Kod pocztowy",
    city: "Miasto",
    phone: "Telefon",
    website: "Strona internetowa",
    taxNumber: "NIP",
    saveCompany: "Zapisz dane firmy",
    // Berichte
    reportNameLabel: "Nazwa raportu",
    firma: "Firma",
    feedbackLabel: "Informacja zwrotna",
    noProjectsYet: "Brak projektów.",
    noInstructionsYet: "Brak instrukcji pracy.",
    problemsHints: "Problemy / uwagi",
    roleEmployee: "Pracownik",
    roleProjectManager: "Kierownik projektu",
    roleAdmin: "Administrator",
  },
};

const pdfTexts = {
  Deutsch: {
    title: "Wochen-Regiebericht",
    company: "Elektrotechnik Luger",
    report: "Bericht",
    calendarWeek: "Kalenderwoche",
    employee: "Mitarbeiter",
    dailyReports: "Tagesberichte",
    customer: "Kunde",
    project: "Projekt",
    site: "Baustelle",
    hours: "Stunden",
    description: "Arbeitsbeschreibung",
    photos: "Fotos",
    photo: "Foto",
    summary: "Zusammenfassung",
    totalHours: "Gesamtstunden",
    signatureEmployee: "Unterschrift Mitarbeiter",
    signatureCustomer: "Unterschrift Kunde / Bauleitung",
    createdAt: "Erstellt am",
  },
  Kroatisch: {
    title: "Tjedni režijski izvještaj",
    company: "Elektrotechnik Luger",
    report: "Izvještaj",
    calendarWeek: "Kalendarski tjedan",
    employee: "Radnik",
    dailyReports: "Dnevni izvještaji",
    customer: "Kupac",
    project: "Projekt",
    site: "Gradilište",
    hours: "Sati",
    description: "Opis rada",
    photos: "Fotografije",
    photo: "Fotografija",
    summary: "Sažetak",
    totalHours: "Ukupno sati",
    signatureEmployee: "Potpis radnika",
    signatureCustomer: "Potpis kupca / voditelja gradilišta",
    createdAt: "Izrađeno dana",
  },
  Slowenisch: {
    title: "Tedensko poročilo",
    company: "Elektrotechnik Luger",
    report: "Poročilo",
    calendarWeek: "Koledarski teden",
    employee: "Zaposleni",
    dailyReports: "Dnevna poročila",
    customer: "Stranka",
    project: "Projekt",
    site: "Gradbišče",
    hours: "Ure",
    description: "Opis dela",
    photos: "Fotografije",
    photo: "Fotografija",
    summary: "Povzetek",
    totalHours: "Skupno število ur",
    signatureEmployee: "Podpis zaposlenega",
    signatureCustomer: "Podpis stranke / vodje gradbišča",
    createdAt: "Ustvarjeno dne",
  },
  Polnisch: {
    title: "Tygodniowy raport roboczy",
    company: "Elektrotechnik Luger",
    report: "Raport",
    calendarWeek: "Tydzień kalendarzowy",
    employee: "Pracownik",
    dailyReports: "Raporty dzienne",
    customer: "Klient",
    project: "Projekt",
    site: "Budowa",
    hours: "Godziny",
    description: "Opis pracy",
    photos: "Zdjęcia",
    photo: "Zdjęcie",
    summary: "Podsumowanie",
    totalHours: "Łączna liczba godzin",
    signatureEmployee: "Podpis pracownika",
    signatureCustomer: "Podpis klienta / kierownika budowy",
    createdAt: "Utworzono dnia",
  },
  Englisch: {
    title: "Weekly Work Report",
    company: "Elektrotechnik Luger",
    report: "Report",
    calendarWeek: "Calendar week",
    employee: "Employee",
    dailyReports: "Daily reports",
    customer: "Customer",
    project: "Project",
    site: "Site",
    hours: "Hours",
    description: "Work description",
    photos: "Photos",
    photo: "Photo",
    summary: "Summary",
    totalHours: "Total hours",
    signatureEmployee: "Employee signature",
    signatureCustomer: "Customer / Site manager signature",
    createdAt: "Created on",
  },
};

function createEmptyDays(): DayEntry[] {
  return weekdays.map((day) => ({
    weekday: day,
    date: "",
    customer: "",
    projectNumber: "",
    site: "",
    hours: "",
    description: "",
    translation: "",
    photos: [],
  }));
}

function getCalendarWeek(dateString: string) {
  if (!dateString) return "";
  const [yearText, monthText, dayText] = dateString.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `KW ${weekNumber}`;
}

// ─── Tab-Button Hilfkomponente ────────────────────────────────────────────────
function TabButton({
  label,
  tabName,
  activeTab,
  onClick,
}: {
  label: string;
  tabName: string;
  activeTab: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded font-medium transition-colors ${
        activeTab === tabName
          ? "bg-blue-700 text-white"
          : "bg-gray-200 text-gray-800 hover:bg-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

// Hilfsfunktion: allowed_languages sicher als Array holen
function getAllowedLanguages(companyFeatures: any): string[] {
  const raw = companyFeatures?.allowed_languages;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Falls jsonb als String kommt: '["Deutsch","Kroatisch"]'
  try { return JSON.parse(raw); } catch { return []; }
}

export default function Home() {
  const [uiLanguage, setUiLanguage] = useState<Language>("Deutsch");
  const t = texts[uiLanguage];

  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [employee, setEmployee] = useState("");
  const [reportName, setReportName] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [fromLanguage, setFromLanguage] = useState("Deutsch");
  const [toLanguage, setToLanguage] = useState("Polnisch");
  const [pdfLanguage, setPdfLanguage] = useState("Deutsch");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [days, setDays] = useState<DayEntry[]>(createEmptyDays());
  const [currentCompany, setCurrentCompany] = useState<CurrentCompany | null>(null);
  const [companyFeatures, setCompanyFeatures] = useState<CompanyFeatures | null>(null);
  const firstDate = days.find((day) => day.date)?.date || "";
  const calendarWeek = getCalendarWeek(firstDate);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("employee");
  const [instructionProblems, setInstructionProblems] = useState("");
  const [instructionTitle, setInstructionTitle] = useState("");
  const [instructionProject, setInstructionProject] = useState("");
  const [instructionCustomer, setInstructionCustomer] = useState("");
  const [instructionSite, setInstructionSite] = useState("");
  const [instructionDescription, setInstructionDescription] = useState("");
  const [instructionTasks, setInstructionTasks] = useState<string[]>([""]);
  const [workInstructions, setWorkInstructions] = useState<any[]>([]);
  const [instructionTranslations, setInstructionTranslations] = useState<Record<string, any>>({});
  const [translatingInstructionId, setTranslatingInstructionId] = useState<string | null>(null);
  const [instructionToLanguage, setInstructionToLanguage] = useState("Polnisch");

  // FIX 1: "dashboard" als Standard-Tab, alle Tabs klar definiert
  const [activeTab, setActiveTab] = useState("dashboard");



  const [projects, setProjects] = useState<any[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectCustomer, setProjectCustomer] = useState("");
  const [projectSite, setProjectSite] = useState("");
  const [projectManager, setProjectManager] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProjectDetailId, setSelectedProjectDetailId] = useState("");
  const [instructionDate, setInstructionDate] = useState("");

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) {
        await loadCompanyContext(data.user.id);
        await loadReportsFromDatabase();
        await loadCompanySettings(data.user.id);
      }
    }

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        loadCompanyContext(session.user.id);
        loadReportsFromDatabase();
        loadCompanySettings(session.user.id);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signUp() {
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setMessage("Registrierung fehlgeschlagen: " + error.message); return; }
    setMessage("Registrierung erfolgreich.");
  }

  async function signIn() {
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage("Login fehlgeschlagen: " + error.message); return; }
    setMessage("Login erfolgreich.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    newReport();
    setSavedReports([]);
    setMessage("Du wurdest abgemeldet.");
  }

  // FIX 2: loadProjects bekommt companyId als Parameter, damit es nicht auf
  // den noch nicht gesetzten currentCompany-State angewiesen ist
  async function loadCompanyContext(userId: string) {
    const { data: companyUser, error } = await supabase
      .from("company_users")
      .select("company_id, role, companies(id, name)")
      .eq("user_id", userId)
      .single();

    if (error) { setMessage("Fehler beim Laden der Firma: " + error.message); return; }

    const companyData = Array.isArray(companyUser.companies)
      ? companyUser.companies[0]
      : companyUser.companies;

    const company: CurrentCompany = {
      company_id: companyUser.company_id,
      role: companyUser.role,
      companies: { id: companyData.id, name: companyData.name },
    };

    setCurrentCompany(company);

    const { data: features, error: featureError } = await supabase
      .from("company_features")
      .select("*")
      .eq("company_id", companyUser.company_id)
      .single();

    if (featureError) { setMessage("Fehler beim Laden der Module: " + featureError.message); return; }

    setCompanyFeatures(features as CompanyFeatures);
  // NUR Übersetzungs-Zielsprache anpassen, NICHT die App-Sprache
  const allowed = Array.isArray(features.allowed_languages)
    ? features.allowed_languages
    : (typeof features.allowed_languages === "string" ? JSON.parse(features.allowed_languages) : []);
  const firstTarget = allowed.filter((l: string) => l !== "Deutsch")[0];
  if (firstTarget) {
    setInstructionToLanguage(firstTarget);
    setToLanguage(firstTarget); // Regiebericht-Zielsprache
  }
  // App-Sprache bleibt immer Deutsch (oder was der User gewählt hat)

    // Alle Ladefunktionen erhalten jetzt die companyId direkt
    await loadCompanyUsers(companyUser.company_id);
    await loadWorkInstructions(companyUser.company_id);
    await loadProjects(companyUser.company_id); // FIX 2: companyId direkt übergeben
  }

  async function loadWorkInstructions(companyId: string) {
    const { data, error } = await supabase
      .from("work_instructions")
      .select(`*, work_instruction_tasks (*)`)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) { setMessage("Fehler beim Laden der Arbeitsanweisungen: " + error.message); return; }
    setWorkInstructions(data || []);
  }

  async function updateTaskNote(taskId: string, note: string) {
    const { error } = await supabase.from("work_instruction_tasks").update({ note }).eq("id", taskId);
    if (error) { setMessage("Fehler beim Speichern der Rückmeldung: " + error.message); return; }
    if (currentCompany) await loadWorkInstructions(currentCompany.company_id);
    setMessage("Rückmeldung gespeichert.");
  }

  async function loadCompanyUsers(companyId: string) {
    const { data, error } = await supabase
      .from("company_users")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) { setMessage("Fehler beim Laden der Mitarbeiter: " + error.message); return; }
    setCompanyUsers(data || []);
  }

  async function addCompanyUser() {
    if (!currentCompany) return;
    const { error } = await supabase.from("company_users").insert({
      company_id: currentCompany.company_id,
      full_name: newUserName,
      email: newUserEmail,
      role: newUserRole,
    });
    if (error) { setMessage("Fehler beim Hinzufügen: " + error.message); return; }
    setNewUserName(""); setNewUserEmail(""); setNewUserRole("employee");
    await loadCompanyUsers(currentCompany.company_id);
    setMessage("Mitarbeiter wurde angelegt.");
  }

  async function resetCompanyUserPassword(memberEmail: string) {
    if (!memberEmail) { setMessage("Keine E-Mail-Adresse vorhanden."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(memberEmail, {
      redirectTo: "https://international-regie.vercel.app",
    });
    if (error) { setMessage("Fehler beim Passwort-Reset: " + error.message); return; }
    setMessage("Passwort-Reset-E-Mail wurde gesendet.");
  }

  async function loadReportsFromDatabase() {
    const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
    if (error) { setMessage("Fehler beim Laden: " + error.message); return; }
    setSavedReports((data || []) as SavedReport[]);
  }

  function updateDay(index: number, field: keyof DayEntry, value: string) {
    const copy = [...days];
    copy[index] = { ...copy[index], [field]: value };
    setDays(copy);
  }

  async function saveWorkInstruction() {
    setMessage("Speichere Arbeitsanweisung...");
    if (!currentCompany) { setMessage("Keine Firma geladen."); return; }
    if (!instructionTitle.trim()) { setMessage("Bitte Titel der Arbeitsanweisung eintragen."); return; }

    const { data: instruction, error } = await supabase
      .from("work_instructions")
      .insert({
        company_id: currentCompany.company_id,
        project_id: selectedProjectId || null,
        work_date: instructionDate || null,
        created_by: user?.id,
        title: instructionTitle,
        project: instructionProject,
        customer: instructionCustomer,
        site: instructionSite,
        description: instructionDescription,
        problems_text: instructionProblems,
      })
      .select()
      .single();

    if (error) { setMessage("Fehler: " + error.message); return; }

    const taskRows = instructionTasks
      .filter((task) => task.trim() !== "")
      .map((task, index) => ({ work_instruction_id: instruction.id, task_text: task, sort_order: index }));

    if (taskRows.length > 0) {
      const { error: taskError } = await supabase.from("work_instruction_tasks").insert(taskRows);
      if (taskError) { setMessage("Arbeitsanweisung gespeichert, aber Schritte nicht: " + taskError.message); return; }
    }

    setInstructionTitle(""); setInstructionProject(""); setInstructionCustomer("");
    setInstructionSite(""); setInstructionDescription(""); setInstructionTasks([""]); setInstructionProblems("");

    await loadWorkInstructions(currentCompany.company_id);
    setMessage("Arbeitsanweisung gespeichert.");
  }

  async function deleteWorkInstruction(id: string) {
    if (!currentCompany) return;
    const { error } = await supabase.from("work_instructions").delete().eq("id", id);
    if (error) { setMessage("Fehler beim Löschen: " + error.message); return; }
    await loadWorkInstructions(currentCompany.company_id);
    setMessage("Arbeitsanweisung gelöscht.");
  }

  function updateFullWeekFromMonday(selectedValue: string) {
    if (!selectedValue) return;
    const [year, month, day] = selectedValue.split("-").map(Number);
    const copy = [...days];
    for (let i = 0; i < 7; i++) {
      const nextDate = new Date(Date.UTC(year, month - 1, day + i));
      copy[i] = { ...copy[i], date: nextDate.toISOString().split("T")[0] };
    }
    setDays(copy);
  }

  async function updateWorkInstructionNote(id: string, note: string) {
    const { error } = await supabase.from("work_instructions").update({ employee_note: note }).eq("id", id);
    if (error) { setMessage("Fehler beim Speichern der Notiz: " + error.message); return; }
    if (currentCompany) await loadWorkInstructions(currentCompany.company_id);
    setMessage("Notiz wurde gespeichert.");
  }

  function parseHours(value: string) {
    return Number(value.replace(",", ".")) || 0;
  }

  const totalHours = days.reduce((sum, day) => sum + parseHours(day.hours), 0);

  const projectTotals = days.reduce<Record<string, number>>((acc, day) => {
    if (!day.projectNumber) return acc;
    acc[day.projectNumber] = (acc[day.projectNumber] || 0) + parseHours(day.hours);
    return acc;
  }, {});

  async function handlePhotos(index: number, files: FileList | null) {
    if (!files || !user) return;
    setMessage("Fotos werden hochgeladen...");
    for (const file of Array.from(files)) {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user.id}/${calendarWeek || "ohne-kw"}/${fileName}`;
      const { error } = await supabase.storage.from("report-photos").upload(filePath, file);
      if (error) { setMessage("Fehler beim Foto-Upload: " + error.message); return; }
      const { data } = supabase.storage.from("report-photos").getPublicUrl(filePath);
      const copy = [...days];
      copy[index] = { ...copy[index], photos: [...copy[index].photos, data.publicUrl] };
      setDays(copy);
    }
    setMessage("Fotos wurden hochgeladen.");
  }

  function deletePhoto(dayIndex: number, photoIndex: number) {
    const copy = [...days];
    copy[dayIndex] = { ...copy[dayIndex], photos: copy[dayIndex].photos.filter((_, index) => index !== photoIndex) };
    setDays(copy);
  }

  async function loadCompanySettings(userId: string) {
    const { data, error } = await supabase.from("company_settings").select("*").eq("user_id", userId).single();
    if (error && error.code !== "PGRST116") { setMessage("Fehler beim Laden der Firmendaten: " + error.message); return; }
    setCompanySettings(data || {
      user_id: userId, company_name: "Elektrotechnik Luger", company_logo: "",
      street: "", zip_code: "", city: "", phone: "", email: "", website: "", tax_number: "",
    });
  }

  async function saveCompanySettings() {
    if (!user || !companySettings) return;
    const { error } = await supabase.from("company_settings").upsert({ ...companySettings, user_id: user.id }, { onConflict: "user_id" });
    if (error) { setMessage("Fehler beim Speichern der Firmendaten: " + error.message); return; }
    setMessage("Firmendaten wurden gespeichert.");
  }

  function updateCompanyField(field: keyof CompanySettings, value: string) {
    if (!user) return;
    setCompanySettings((current) => ({
      user_id: user.id,
      company_name: current?.company_name || "Elektrotechnik Luger",
      ...current,
      [field]: value,
    }));
  }

  async function uploadCompanyLogo(files: FileList | null) {
    if (!files || !files[0] || !user) return;
    const file = files[0];
    const fileExt = file.name.split(".").pop() || "png";
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;
    const { error } = await supabase.storage.from("company-logos").upload(filePath, file, { upsert: true });
    if (error) { setMessage("Fehler beim Logo-Upload: " + error.message); return; }
    const { data } = supabase.storage.from("company-logos").getPublicUrl(filePath);
    updateCompanyField("company_logo", data.publicUrl);
    setMessage("Logo wurde hochgeladen. Bitte Firmendaten speichern.");
  }

  async function saveReport() {
    setMessage("");
    if (!user) { setMessage("Bitte zuerst anmelden."); return; }
    const name = reportName.trim() || `${calendarWeek || "Woche"} - ${employee || "Bericht"}`;
    const reportData = {
      report_name: name, employee, from_language: fromLanguage, to_language: toLanguage,
      pdf_language: pdfLanguage, days, user_id: user.id, project_id: selectedProjectId || null,
    };
    let error;
    if (currentReportId) {
      ({ error } = await supabase.from("reports").update(reportData).eq("id", currentReportId));
    } else {
      const result = await supabase.from("reports").insert(reportData).select().single();
      error = result.error;
      if (result.data?.id) setCurrentReportId(result.data.id);
    }
    if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    setReportName(name);
    setMessage(currentReportId ? "Bericht wurde aktualisiert." : "Neuer Bericht wurde gespeichert.");
    await loadReportsFromDatabase();
  }

  function loadReport(report: SavedReport) {
    setCurrentReportId(report.id);
    setReportName(report.report_name);
    setEmployee(report.employee || "");
    setFromLanguage(report.from_language || "Deutsch");
    setToLanguage(report.to_language || "Polnisch");
    setPdfLanguage(report.pdf_language || "Deutsch");
    setDays(report.days || createEmptyDays());
    setMessage("Bericht wurde geladen.");
    setActiveTab("regiebericht"); // Nach Laden direkt zum Bericht springen
  }

  async function deleteReport(id: string) {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) { setMessage("Fehler beim Löschen: " + error.message); return; }
    if (currentReportId === id) newReport();
    setMessage("Bericht wurde gelöscht.");
    await loadReportsFromDatabase();
  }

  function newReport() {
    setCurrentReportId(null); setReportName(""); setEmployee(""); setEmailTo("");
    setFromLanguage("Deutsch"); setToLanguage("Polnisch"); setPdfLanguage("Deutsch");
    setDays(createEmptyDays());
  }

  // FIX 2: companyId als Parameter
  async function loadProjects(companyId?: string) {
    const id = companyId ?? currentCompany?.company_id;
    if (!id) return;
    const { data, error } = await supabase
      .from("projects").select("*").eq("company_id", id).order("created_at", { ascending: false });
    if (error) { setMessage("Fehler beim Laden der Projekte: " + error.message); return; }
    setProjects(data || []);
  }

  async function saveProject() {
    if (!currentCompany) return;
    const { error } = await supabase.from("projects").insert({
      company_id: currentCompany.company_id,
      name: projectName, customer: projectCustomer, site: projectSite, project_manager: projectManager,
    });
    if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    setProjectName(""); setProjectCustomer(""); setProjectSite(""); setProjectManager("");
    await loadProjects();
    setMessage("Projekt gespeichert.");
  }

  async function deleteProject(id: string) {
    if (!currentCompany) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { setMessage("Fehler beim Löschen des Projekts: " + error.message); return; }
    if (selectedProjectDetailId === id) setSelectedProjectDetailId("");
    await loadProjects();
    setMessage("Projekt gelöscht.");
  }

  async function updateTaskStatus(taskId: string, status: string) {
    const { error } = await supabase.from("work_instruction_tasks").update({ status }).eq("id", taskId);
    if (error) { setMessage("Fehler beim Speichern des Status."); return; }
    if (currentCompany) await loadWorkInstructions(currentCompany.company_id);
  }

  async function translateAll() {
    setMessage("");
    if (!employee.trim()) { setMessage("Bitte Mitarbeiter eintragen."); return; }
    setLoading(true);
    const translatedDays = [...days];
    try {
      for (let i = 0; i < translatedDays.length; i++) {
        const day = translatedDays[i];
        if (!day.description.trim()) continue;
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hours: day.hours, description: day.description, fromLanguage, toLanguage }),
        });
        const data = await res.json();
        translatedDays[i].translation = data.error ? data.error : data.translation;
      }
      setDays(translatedDays);
      setMessage("Woche wurde übersetzt.");
    } catch (error) {
      setMessage("Fehler beim Übersetzen: " + String(error));
    }
    setLoading(false);
  }

  async function translateInstruction(instruction: any) {
    setTranslatingInstructionId(instruction.id);
    setMessage("");

    try {
      const textsToTranslate = [
        { key: "title", text: instruction.title || "" },
        { key: "problems_text", text: instruction.problems_text || "" },
        { key: "description", text: instruction.description || "" },
      ];

      const translatedFields: Record<string, string> = {};

      for (const item of textsToTranslate) {
        if (!item.text.trim()) continue;
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: item.text,
            fromLanguage: "Deutsch",
            toLanguage: instructionToLanguage,
          }),
        });
        const data = await res.json();
        translatedFields[item.key] = data.error ? item.text : data.translation;
      }

      // Arbeitsschritte übersetzen
      const translatedTasks: Record<string, string> = {};
      for (const task of instruction.work_instruction_tasks || []) {
        if (!task.task_text?.trim()) continue;
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: task.task_text,
            fromLanguage: "Deutsch",
            toLanguage: instructionToLanguage,
          }),
        });
        const data = await res.json();
        translatedTasks[task.id] = data.error ? task.task_text : data.translation;

        // Rückmeldung übersetzen falls vorhanden
        if (task.note?.trim()) {
          const resNote = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: task.note,
              fromLanguage: "Deutsch",
              toLanguage: instructionToLanguage,
            }),
          });
          const dataNote = await resNote.json();
          translatedTasks[`note_${task.id}`] = dataNote.error ? task.note : dataNote.translation;
        }
      }

      setInstructionTranslations((prev) => ({
        ...prev,
        [instruction.id]: {
          ...translatedFields,
          tasks: translatedTasks,
          language: instructionToLanguage,
        },
      }));

      setMessage("Arbeitsanweisung wurde übersetzt.");
    } catch (err) {
      setMessage("Fehler beim Übersetzen: " + String(err));
    }

    setTranslatingInstructionId(null);
  }

  function createReportFromInstruction(instruction: any) {
    const completedTasks = (instruction.work_instruction_tasks || []).map((task: any) => {
      const statusText =
        task.status === "completed" ? "✅ Erledigt"
        : task.status === "in_progress" ? "🟡 In Arbeit"
        : task.status === "stopped" ? "⛔ Gestoppt"
        : "⬜ Offen";
      return [
        `${statusText}: ${task.task_text}`,
        task.note ? `Rückmeldung: ${task.note}` : "",
      ].filter(Boolean).join("\n");
    });

    const description = [
      ...completedTasks,
      instruction.problems_text ? "Probleme / Hinweise: " + instruction.problems_text : "",
      instruction.employee_note ? "Rückmeldung Mitarbeiter: " + instruction.employee_note : "",
    ].filter(Boolean).join("\n");

    const copy = [...days];
    const targetDate = instruction.work_date || "";

    if (targetDate) {
      const [year, month, day] = targetDate.split("-").map(Number);
      const selectedDate = new Date(Date.UTC(year, month - 1, day));
      const dayNumber = selectedDate.getUTCDay() || 7;
      const monday = new Date(selectedDate);
      monday.setUTCDate(selectedDate.getUTCDate() - dayNumber + 1);
      for (let i = 0; i < 7; i++) {
        const nextDate = new Date(monday);
        nextDate.setUTCDate(monday.getUTCDate() + i);
        copy[i] = { ...copy[i], date: nextDate.toISOString().split("T")[0] };
      }
    }

    const targetIndex = targetDate ? copy.findIndex((day) => day.date === targetDate) : 0;
    const indexToUse = targetIndex >= 0 ? targetIndex : 0;

    copy[indexToUse] = {
      ...copy[indexToUse],
      customer: instruction.customer || "",
      projectNumber: instruction.project || "",
      site: instruction.site || "",
      description,
    };

    setDays(copy);
    setActiveTab("regiebericht"); // FIX 3: korrekter Tab-Name
    setMessage("Regiebericht wurde aus Arbeitsanweisung vorbereitet.");
  }

  async function createPDF(sendByEmail = false) {
    const p = pdfTexts[pdfLanguage as keyof typeof pdfTexts];
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 15;
    const marginRight = 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let y = 15;

    const addFooter = () => {
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(p.company, marginLeft, pageHeight - 10);
      doc.text(`${p.createdAt}: ${new Date().toLocaleDateString("de-DE")}`, pageWidth - marginRight, pageHeight - 10, { align: "right" });
      doc.setTextColor(0);
    };

    const addNewPageIfNeeded = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 25) { addFooter(); doc.addPage(); y = 15; }
    };

    const qrText = `${p.title} ${calendarWeek || ""} - ${employee}`;
    const qrImage = await QRCode.toDataURL(qrText);

    let logoBase64 = "";
    if (companySettings?.company_logo) {
      try {
        const response = await fetch(companySettings.company_logo);
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error("Logo konnte nicht geladen werden:", error);
      }
    }

    doc.setFillColor(240, 240, 240);
    doc.rect(0, 0, pageWidth, 70, "F");
    doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text(p.title, marginLeft, y);
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    y += 8;

    doc.text(companySettings?.company_name || "Elektrotechnik Luger", marginLeft, y); y += 6;
    if (companySettings?.street) { doc.text(companySettings.street, marginLeft, y); y += 5; }
    if (companySettings?.zip_code || companySettings?.city) {
      doc.text(`${companySettings?.zip_code || ""} ${companySettings?.city || ""}`, marginLeft, y); y += 5;
    }
    if (companySettings?.phone) { doc.text(`Tel: ${companySettings.phone}`, marginLeft, y); y += 5; }
    if (companySettings?.email) { doc.text(`E-Mail: ${companySettings.email}`, marginLeft, y); y += 5; }
    if (companySettings?.website) { doc.text(`Web: ${companySettings.website}`, marginLeft, y); y += 5; }
    if (companySettings?.tax_number) { doc.text(`UID: ${companySettings.tax_number}`, marginLeft, y); y += 5; }

    y += 7;
    doc.text(`${p.report}: ${reportName || "-"}`, marginLeft, y); y += 6;
    doc.text(`${p.calendarWeek}: ${calendarWeek || "-"}`, marginLeft, y); y += 6;
    doc.text(`${p.employee}: ${employee || "-"}`, marginLeft, y);

    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", pageWidth - 45, 8, 30, 30);
    } else {
      doc.addImage(qrImage, "PNG", pageWidth - 42, 8, 28, 28);
    }

    y += 10;
    if (y < 75) y = 75;

    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(p.dailyReports, marginLeft, y); y += 8;

    for (const day of days) {
      const hasContent = day.description || day.hours || day.customer || day.projectNumber || day.site || day.photos.length > 0;
      if (!hasContent) continue; // FIX: war "return", jetzt "continue" damit alle Tage verarbeitet werden

      const descriptionText = day.translation || day.description || "-";
      const splitDescription = doc.splitTextToSize(descriptionText, contentWidth - 8);
      const estimatedHeight = 45 + splitDescription.length * 5 + day.photos.length * 10;
      addNewPageIfNeeded(estimatedHeight);

      doc.setFillColor(230, 230, 230);
      doc.rect(marginLeft, y, contentWidth, 9, "F");
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(`${day.weekday} - ${day.date || "-"}`, marginLeft + 3, y + 6);
      y += 13;

      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(`${p.customer}: ${day.customer || "-"}`, marginLeft + 3, y);
      doc.text(`${p.project}: ${day.projectNumber || "-"}`, marginLeft + 80, y); y += 6;
      doc.text(`${p.site}: ${day.site || "-"}`, marginLeft + 3, y);
      doc.text(`${p.hours}: ${day.hours || "-"}`, marginLeft + 80, y); y += 8;

      doc.setFont("helvetica", "bold"); doc.text(`${p.description}:`, marginLeft + 3, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.text(splitDescription, marginLeft + 3, y);
      y += splitDescription.length * 5 + 5;

      if (day.photos.length > 0) {
        doc.setFont("helvetica", "bold"); doc.text(`${p.photos}:`, marginLeft + 3, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        for (let photoIndex = 0; photoIndex < day.photos.length; photoIndex++) {
          const photo = day.photos[photoIndex];
          try {
            const response = await fetch(photo);
            const blob = await response.blob();
            const photoBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            addNewPageIfNeeded(65);
            doc.text(`${p.photo} ${photoIndex + 1}:`, marginLeft + 3, y); y += 5;
            doc.addImage(photoBase64, "JPEG", marginLeft + 3, y, 70, 50); y += 56;
          } catch (error) {
            doc.text(`${p.photo} ${photoIndex + 1}: konnte nicht geladen werden`, marginLeft + 3, y); y += 6;
          }
        }
        y += 2;
      }

      doc.setDrawColor(200); doc.line(marginLeft, y, pageWidth - marginRight, y); y += 10; doc.setDrawColor(0);
    }

    addNewPageIfNeeded(65);
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text(p.summary, marginLeft, y); y += 8;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`${p.totalHours}: ${totalHours.toString().replace(".", ",")} ${p.hours}`, marginLeft, y); y += 8;
    Object.entries(projectTotals).forEach(([project, total]) => {
      doc.text(`${p.project} ${project}: ${total.toString().replace(".", ",")} ${p.hours}`, marginLeft, y); y += 6;
    });

    y += 18;
    doc.line(marginLeft, y, marginLeft + 70, y);
    doc.line(pageWidth - marginRight - 70, y, pageWidth - marginRight, y);
    y += 6; doc.setFontSize(9);
    doc.text(p.signatureEmployee, marginLeft, y);
    doc.text(p.signatureCustomer, pageWidth - marginRight - 70, y);
    addFooter();

    const filename = `Regiebericht_${calendarWeek || "Woche"}_${employee || "Mitarbeiter"}.pdf`;

    if (sendByEmail) {
      if (!emailTo.trim()) { setMessage("Bitte Empfänger-E-Mail eintragen."); return; }
      setMessage("PDF wird per E-Mail gesendet...");
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const res = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, subject: `${p.title} ${calendarWeek || ""}`, pdfBase64, filename }),
      });
      const data = await res.json();
      if (data.error) { setMessage("Fehler beim E-Mail-Versand: " + data.error); return; }
      setMessage("PDF wurde per E-Mail gesendet.");
      return;
    }

    doc.save(filename);
  }

  // ─── Login-Screen ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="max-w-xl mx-auto p-4 md:p-8 space-y-6 bg-gray-100 min-h-screen text-black">
        <section className="border rounded p-4 space-y-4 bg-white">
          <h1 className="text-3xl font-bold">{t.loginTitle}</h1>
          <select
            className="border p-3 w-full text-black bg-white"
            value={uiLanguage}
            onChange={(e) => setUiLanguage(e.target.value as Language)}
          >
            {languages.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
          </select>
          {message && <div className="border rounded p-3 bg-yellow-100 text-black">{message}</div>}
          <input className="border p-3 w-full text-black bg-white" placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="border p-3 w-full text-black bg-white" placeholder={t.password} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={signIn} className="bg-blue-600 text-white px-4 py-3 rounded">{t.login}</button>
            <button type="button" onClick={signUp} className="bg-green-600 text-white px-4 py-3 rounded">{t.register}</button>
          </div>
        </section>
      </main>
    );
  }

  // ─── Haupt-App ─────────────────────────────────────────────────────────────
  return (
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 bg-gray-100 min-h-screen text-black">

      {/* Header */}
      <header className="bg-white border rounded p-4 space-y-1">
        <h1 className="text-3xl font-bold">{t.title}</h1>
        <p className="text-gray-600">{t.subtitle}</p>
        <p className="text-gray-700">{t.loggedInAs}: <strong>{user.email}</strong></p>
        {currentCompany && (
          <p className="text-gray-700">
            {t.firma}: <strong>{currentCompany.companies.name}</strong> | {t.role}: <strong>{currentCompany.role}</strong>
          </p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <button type="button" onClick={signOut} className="bg-gray-800 text-white px-4 py-2 rounded">
            {t.logout}
          </button>
          <select
            className="border p-2 rounded text-black bg-white text-sm"
            value={uiLanguage}
            onChange={(e) => setUiLanguage(e.target.value as Language)}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>🌐 {lang}</option>
            ))}
          </select>
          <select
            className="border p-2 rounded text-black bg-white text-sm"
            value={pdfLanguage}
            onChange={(e) => setPdfLanguage(e.target.value)}
          >
            {(getAllowedLanguages(companyFeatures).length > 0
              ? getAllowedLanguages(companyFeatures).filter(l => pdfLanguages.includes(l))
              : pdfLanguages
            ).map((lang) => (
              <option key={lang} value={lang}>📄 {lang}</option>
            ))}
          </select>
        </div>
      </header>

      {/* FIX 3: Alle Bereiche als eigene Tabs, sauber strukturiert */}
      <nav className="flex flex-wrap gap-2">
        <TabButton label={t.dashboard}            tabName="dashboard"           activeTab={activeTab} onClick={() => setActiveTab("dashboard")} />
        <TabButton label="Regiebericht"         tabName="regiebericht"        activeTab={activeTab} onClick={() => setActiveTab("regiebericht")} />
        <TabButton label={t.saveLoad}             tabName="berichte"            activeTab={activeTab} onClick={() => setActiveTab("berichte")} />
        <TabButton label={t.projectsTab}             tabName="projekte"            activeTab={activeTab} onClick={() => { setActiveTab("projekte"); loadProjects(); }} />
        <TabButton label={t.workInstructions}   tabName="arbeitsanweisungen"  activeTab={activeTab} onClick={() => setActiveTab("arbeitsanweisungen")} />
        <TabButton label={t.employeeManagement}          tabName="mitarbeiter"         activeTab={activeTab} onClick={() => setActiveTab("mitarbeiter")} />
        <TabButton label={t.companyData}          tabName="firmendaten"         activeTab={activeTab} onClick={() => setActiveTab("firmendaten")} />
      </nav>

      {/* Globale Statusmeldung */}
      {message && (
        <div className="border rounded p-3 bg-yellow-100 text-black">{message}</div>
      )}

      {/* ── TAB: Dashboard ── */}
      {activeTab === "dashboard" && (
        <section className="border rounded p-4 space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.dashboard}</h2>
          {(() => {
            const allTasks = workInstructions.flatMap((i) => i.work_instruction_tasks || []);
            const openCount      = allTasks.filter((t: any) => (t.status || "open") === "open").length;
            const progressCount  = allTasks.filter((t: any) => t.status === "in_progress").length;
            const stoppedCount   = allTasks.filter((t: any) => t.status === "stopped").length;
            const completedCount = allTasks.filter((t: any) => t.status === "completed").length;
            const totalTasks     = allTasks.length;
            const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
            const today = new Date().toISOString().split("T")[0];
            const todayInstructions = workInstructions.filter((i: any) => i.work_date === today);

            return (
              <div className="space-y-3">
                <p>{t.projects}: <strong>{projects.length}</strong></p>
                <p>{t.workInstructions}: <strong>{workInstructions.length}</strong></p>
                <p>{t.dueToday}: <strong>{todayInstructions.length}</strong></p>

                <div className="border rounded p-3 bg-gray-100">
                  <p>⬜ Offen: {openCount}</p>
                  <p>🟡 In Arbeit: {progressCount}</p>
                  <p>⛔ Gestoppt: {stoppedCount}</p>
                  <p>✅ Erledigt: {completedCount}</p>
                  <p className="font-bold mt-3">{t.totalProgress}: {progressPercent}%</p>
                  <div className="w-full bg-gray-300 rounded h-4 mt-1">
                    <div className="bg-green-600 h-4 rounded" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>

                {stoppedCount > 0 && (
                  <div className="border rounded p-3 bg-red-50">
                    <h3 className="font-bold mb-2">{t.stoppedSteps}</h3>
                    {allTasks.filter((t: any) => t.status === "stopped").map((task: any) => (
                      <p key={task.id}>
                        <strong>{workInstructions.find((i) => (i.work_instruction_tasks || []).some((t: any) => t.id === task.id))?.project || t.noProject}</strong>
                        {" — "}⛔ {task.task_text}{task.note ? ` — ${task.note}` : ""}
                      </p>
                    ))}
                  </div>
                )}

                {progressCount > 0 && (
                  <div className="border rounded p-3 bg-yellow-50">
                    <h3 className="font-bold mb-2">{t.stepsInProgress}</h3>
                    {allTasks.filter((t: any) => t.status === "in_progress").map((task: any) => (
                      <p key={task.id}>
                        <strong>{workInstructions.find((i) => (i.work_instruction_tasks || []).some((t: any) => t.id === task.id))?.project || t.noProject}</strong>
                        {" — "}🟡 {task.task_text}{task.note ? ` — ${task.note}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* ── TAB: Regiebericht (Eingabe) ── */}
      {activeTab === "regiebericht" && (
        <div className="space-y-4">
          {/* Allgemeine Angaben */}
          <section className="border rounded p-4 space-y-4 bg-white text-black">
            <h2 className="text-xl font-bold">{t.general}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">


              <input className="border p-3 text-black bg-white" placeholder={t.employee} value={employee} onChange={(e) => setEmployee(e.target.value)} />
              <input className="border p-3 bg-gray-200 text-black" value={calendarWeek} readOnly placeholder={t.calendarWeek} />
              <select className="border p-3 text-black bg-white" value={fromLanguage} onChange={(e) => setFromLanguage(e.target.value)}>
                {(getAllowedLanguages(companyFeatures).length > 0 ? getAllowedLanguages(companyFeatures) : languages).map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </select>
              <select className="border p-3 text-black bg-white" value={toLanguage} onChange={(e) => setToLanguage(e.target.value)}>
                {(getAllowedLanguages(companyFeatures).length > 0 ? getAllowedLanguages(companyFeatures) : languages)
                  .filter((lang) => lang !== "Deutsch")
                  .map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </select>
              <input className="border p-3 text-black bg-white md:col-span-2" placeholder={t.recipientEmail} value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
            </div>
          </section>

          {/* Tageseinträge */}
          {days.map((day, index) => (
            <section key={day.weekday} className="border rounded p-4 space-y-3 bg-white text-black">
              <h2 className="text-xl font-bold">{day.weekday}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="date" className="border p-3 text-black bg-white" value={day.date}
                  onChange={(e) => { if (index === 0) updateFullWeekFromMonday(e.target.value); else updateDay(index, "date", e.target.value); }}
                />
                <input className="border p-3 text-black bg-white" placeholder={t.customer} value={day.customer} onChange={(e) => updateDay(index, "customer", e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder={t.projectNumber} value={day.projectNumber} onChange={(e) => updateDay(index, "projectNumber", e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder={t.site} value={day.site} onChange={(e) => updateDay(index, "site", e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder={t.hours} value={day.hours} onChange={(e) => updateDay(index, "hours", e.target.value)} />
              </div>
              <textarea className="border p-3 w-full h-28 text-black bg-white" placeholder={t.description} value={day.description} onChange={(e) => updateDay(index, "description", e.target.value)} />
              <input type="file" accept="image/*" multiple className="border p-3 w-full text-black bg-white" onChange={(e) => handlePhotos(index, e.target.files)} />
              {day.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {day.photos.map((photo, photoIndex) => (
                    <div key={photoIndex} className="border rounded p-2">
                      <img src={photo} alt="Foto" className="w-full h-32 object-cover" />
                      <button type="button" onClick={() => deletePhoto(index, photoIndex)} className="mt-2 bg-red-600 text-white px-2 py-2 rounded w-full">{t.deletePhoto}</button>
                    </div>
                  ))}
                </div>
              )}
              {day.translation && (
                <div className="border p-3 rounded bg-gray-100 text-black">
                  <strong>{t.translation}:</strong>
                  <p>{day.translation}</p>
                </div>
              )}
            </section>
          ))}

          {/* Stundenübersicht */}
          <section className="border rounded p-4 space-y-2 bg-white text-black">
            <h2 className="text-xl font-bold">{t.hoursOverview}</h2>
            <p><strong>{t.total}:</strong> {totalHours.toString().replace(".", ",")} {t.hours}</p>
            {Object.entries(projectTotals).map(([project, total]) => (
              <p key={project}><strong>{t.projectNumber} {project}:</strong> {total.toString().replace(".", ",")} {t.hours}</p>
            ))}
          </section>

          {/* Aktions-Buttons */}
          <div className="flex flex-wrap gap-4">
            <button type="button" onClick={translateAll} className="bg-black text-white px-4 py-3 rounded">
              {loading ? t.translating : t.translateWeek}
            </button>
            <button type="button" onClick={saveReport} className="bg-orange-600 text-white px-4 py-3 rounded">
              {currentReportId ? t.update : t.save}
            </button>
            <button type="button" onClick={() => createPDF(false)} className="bg-green-600 text-white px-4 py-3 rounded">
              {t.downloadPdf}
            </button>
            <button type="button" onClick={() => createPDF(true)} className="bg-purple-600 text-white px-4 py-3 rounded">
              {t.sendPdf}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: Berichte (Speichern / Laden) ── */}
      {activeTab === "berichte" && (
        <section className="border rounded p-4 space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.saveLoad}</h2>
          <input className="border p-3 w-full text-black bg-white" placeholder={t.reportName} value={reportName} onChange={(e) => setReportName(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={saveReport} className="bg-orange-600 text-white px-4 py-3 rounded">
              {currentReportId ? t.updateReport : t.saveReport}
            </button>
            <button type="button" onClick={() => { newReport(); setMessage("Neuer Bericht gestartet."); }} className="bg-gray-700 text-white px-4 py-3 rounded">
              {t.newReport}
            </button>
          </div>

          {savedReports.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold">{t.savedReports}</h3>
              {savedReports.map((report) => (
                <div key={report.id} className="border rounded p-3 space-y-2">
                  <strong>{report.report_name}</strong>
                  <p className="text-sm text-gray-700">
                    {t.employee}: {report.employee || "-"} | {new Date(report.created_at).toLocaleString("de-DE")}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => loadReport(report)} className="bg-blue-600 text-white px-3 py-2 rounded">{t.loadEdit}</button>
                    <button type="button" onClick={() => deleteReport(report.id)} className="bg-red-600 text-white px-3 py-2 rounded">{t.delete}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── TAB: Projekte ── */}
      {activeTab === "projekte" && (
        <section className="border rounded p-4 space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.projectsTab}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border p-3 w-full" placeholder={t.projectName} value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <input className="border p-3 w-full" placeholder={t.customer} value={projectCustomer} onChange={(e) => setProjectCustomer(e.target.value)} />
            <input className="border p-3 w-full" placeholder={t.site} value={projectSite} onChange={(e) => setProjectSite(e.target.value)} />
            <input className="border p-3 w-full" placeholder={t.projectManager} value={projectManager} onChange={(e) => setProjectManager(e.target.value)} />
          </div>
          <button type="button" onClick={saveProject} className="bg-blue-700 text-white px-4 py-3 rounded">{t.saveProject}</button>

          <div className="space-y-3 mt-4">
            {projects.map((project) => (
              <div key={project.id} className="border rounded p-3 space-y-2">
                <strong>{project.name}</strong>
                <p>{t.customer}: {project.customer || "-"}</p>
                <p>{t.site}: {project.site || "-"}</p>
                <p>{t.projectManager}: {project.project_manager || "-"}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedProjectDetailId(project.id === selectedProjectDetailId ? "" : project.id)} className="bg-gray-700 text-white px-3 py-2 rounded">
                    {project.id === selectedProjectDetailId ? t.closeProject : t.openProject}
                  </button>
                  <button type="button" onClick={() => deleteProject(project.id)} className="bg-red-600 text-white px-3 py-2 rounded">{t.deleteProject}</button>
                </div>

                {selectedProjectDetailId === project.id && (
                  <div className="border rounded p-3 bg-gray-50 space-y-3 mt-2">
                    {(() => {
                      const tasks = workInstructions.filter((i) => i.project_id === project.id).flatMap((i) => i.work_instruction_tasks || []);
                      const openCount      = tasks.filter((t: any) => (t.status || "open") === "open").length;
                      const progressCount  = tasks.filter((t: any) => t.status === "in_progress").length;
                      const stoppedCount   = tasks.filter((t: any) => t.status === "stopped").length;
                      const completedCount = tasks.filter((t: any) => t.status === "completed").length;
                      const totalTasks     = tasks.length;
                      const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
                      return (
                        <div className="border rounded p-3 bg-gray-100">
                          <p>⬜ Offen: {openCount}</p><p>🟡 In Arbeit: {progressCount}</p>
                          <p>⛔ Gestoppt: {stoppedCount}</p><p>✅ Erledigt: {completedCount}</p>
                          <p className="font-bold mt-2">{t.progress}: {progressPercent}%</p>
                          <div className="w-full bg-gray-300 rounded h-4 mt-1">
                            <div className="bg-green-600 h-4 rounded" style={{ width: `${progressPercent}%` }} />
                          </div>
                        </div>
                      );
                    })()}

                    <h4 className="font-bold">{t.workInstructions}</h4>
                    {workInstructions.filter((i) => i.project_id === project.id).map((instruction) => (
                      <div key={instruction.id} className="border rounded p-3 bg-white space-y-2">
                        <strong>{instruction.title}</strong>
                        <p><strong>{t.date}:</strong> {instruction.work_date || "-"}</p>
                        <p><strong>{t.customer}:</strong> {instruction.customer || "-"}</p>
                        <p><strong>{t.site}:</strong> {instruction.site || "-"}</p>
                        {instruction.problems_text && <p><strong>{t.problems}:</strong> {instruction.problems_text}</p>}
                        {(instruction.work_instruction_tasks || []).length > 0 && (
                          <ul className="list-disc pl-6 space-y-1">
                            {instruction.work_instruction_tasks.map((task: any) => (
                              <li key={task.id}>
                                {task.status === "completed" ? "✅ Erledigt" : task.status === "in_progress" ? "🟡 In Arbeit" : task.status === "stopped" ? "⛔ Gestoppt" : "⬜ Offen"}{" "}{task.task_text}
                                {task.note && <div className="text-sm text-gray-600 ml-2">{t.feedbackLabel}: {task.note}</div>}
                              </li>
                            ))}
                          </ul>
                        )}
                        {companyFeatures?.module_auto_reports ? (
                          <button type="button" onClick={() => createReportFromInstruction(instruction)} className="bg-green-700 text-white px-3 py-2 rounded">{t.toReport}</button>
                        ) : (
                          <p className="text-sm text-gray-500">{t.autoReportLocked}</p>
                        )}
                      </div>
                    ))}
                    {workInstructions.filter((i) => i.project_id === project.id).length === 0 && (
                      <p className="text-gray-600">{t.noInstructions}</p>
                    )}

                    <h4 className="font-bold mt-2">{t.reportsTab}</h4>
                    {savedReports.filter((r: any) => r.project_id === project.id).map((report: any) => (
                      <div key={report.id} className="border rounded p-3 bg-white">
                        <strong>{report.report_name}</strong>
                        <p>{t.employee}: {report.employee || "-"}</p>
                      </div>
                    ))}
                    {savedReports.filter((r: any) => r.project_id === project.id).length === 0 && (
                      <p className="text-gray-600">{t.noReports}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {projects.length === 0 && <p className="text-gray-600">{t.noProjectsYet}</p>}
          </div>
        </section>
      )}

      {/* ── TAB: Arbeitsanweisungen ── */}
      {activeTab === "arbeitsanweisungen" && (
        <div className="space-y-4">
          <section className="border rounded p-4 space-y-4 bg-white text-black">
            <h2 className="text-xl font-bold">{t.newInstruction}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border p-3 text-black bg-white" placeholder={t.instructionTitle} value={instructionTitle} onChange={(e) => setInstructionTitle(e.target.value)} />
              <select className="border p-3 text-black bg-white" value={selectedProjectId} onChange={(e) => {
                const projectId = e.target.value;
                setSelectedProjectId(projectId);
                const selectedProject = projects.find((p) => p.id === projectId);
                if (selectedProject) {
                  setInstructionProject(selectedProject.name || "");
                  setInstructionCustomer(selectedProject.customer || "");
                  setInstructionSite(selectedProject.site || "");
                }
              }}>
                <option value="">{t.selectProject}</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <input className="border p-3 text-black bg-white" placeholder={t.customer} value={instructionCustomer} onChange={(e) => setInstructionCustomer(e.target.value)} />
              <input className="border p-3 text-black bg-white" placeholder={t.site} value={instructionSite} onChange={(e) => setInstructionSite(e.target.value)} />
              <input type="date" className="border p-3 text-black bg-white" value={instructionDate} onChange={(e) => setInstructionDate(e.target.value)} />
            </div>
            <input className="border p-3 w-full text-black bg-white" placeholder={t.problems} value={instructionProblems} onChange={(e) => setInstructionProblems(e.target.value)} />
            <h3 className="font-bold">{t.workSteps}</h3>
            {instructionTasks.map((task, index) => (
              <input key={index} className="border p-3 w-full text-black bg-white" placeholder={`Arbeitsschritt ${index + 1}`} value={task}
                onChange={(e) => { const copy = [...instructionTasks]; copy[index] = e.target.value; setInstructionTasks(copy); }} />
            ))}
            <div className="flex gap-3">
              <button type="button" onClick={() => setInstructionTasks([...instructionTasks, ""])} className="bg-gray-700 text-white px-4 py-3 rounded">{t.addStep}</button>
              <button type="button" onClick={saveWorkInstruction} className="bg-blue-700 text-white px-4 py-3 rounded">{t.saveInstruction}</button>
            </div>
          </section>

          <section className="border rounded p-4 space-y-4 bg-white text-black">
            <h2 className="text-xl font-bold">{t.savedInstructions}</h2>
            {workInstructions.length === 0 && <p className="text-gray-600">{t.noInstructionsYet}</p>}
            {/* Zielsprache für Übersetzung — nur freigeschaltete Sprachen */}
            <div className="flex items-center gap-3 bg-gray-50 border rounded p-3">
              <label className="text-sm font-medium text-gray-700">🌐 {t.translateTo}:</label>
              <select
                className="border p-2 rounded text-black bg-white"
                value={instructionToLanguage}
                onChange={(e) => setInstructionToLanguage(e.target.value)}
              >
                {getAllowedLanguages(companyFeatures)
                  .filter((lang) => lang !== "Deutsch")
                  .map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
              </select>
              {getAllowedLanguages(companyFeatures).filter((l) => l !== "Deutsch").length === 0 && (
                <span className="text-sm text-gray-400">🔒 Keine Zielsprachen freigeschaltet</span>
              )}
            </div>

            {workInstructions.map((instruction) => {
              const translation = instructionTranslations[instruction.id];
              const isTranslating = translatingInstructionId === instruction.id;

              return (
              <div key={instruction.id} className="border rounded p-4 space-y-2">
                <h3 className="font-bold text-lg">{instruction.title}</h3>
                {translation?.title && (
                  <p className="text-blue-700 italic text-sm">🌐 {translation.title}</p>
                )}
                <p><strong>{t.date}:</strong> {instruction.work_date || "-"}</p>
                <p><strong>{t.project}:</strong> {instruction.project || "-"}</p>
                <p><strong>{t.customer}:</strong> {instruction.customer || "-"}</p>
                <p><strong>{t.site}:</strong> {instruction.site || "-"}</p>
                {instruction.problems_text && (
                  <div className="bg-yellow-50 border rounded p-3">
                    <strong>{t.problemsHints}:</strong>
                    <p>{instruction.problems_text}</p>
                    {translation?.problems_text && (
                      <p className="text-blue-700 italic text-sm mt-1">🌐 {translation.problems_text}</p>
                    )}
                  </div>
                )}
                <ul className="list-disc pl-6 mt-2 space-y-2">
                  {(instruction.work_instruction_tasks || [])
                    .sort((a: any, b: any) => a.sort_order - b.sort_order)
                    .map((task: any) => (
                      <li key={task.id} className="space-y-2 border rounded p-2 list-none">
                        <div className="flex items-center gap-2">
                          <select className="border rounded p-2 font-medium text-black bg-white" value={task.status || "open"} onChange={(e) => updateTaskStatus(task.id, e.target.value)}>
                            <option value="open">⬜ Offen</option>
                            <option value="in_progress">🟡 In Arbeit</option>
                            <option value="stopped">⛔ Gestoppt</option>
                            <option value="completed">✅ Erledigt</option>
                          </select>
                          <div>
                            <div className="font-medium">{task.task_text}</div>
                            {translation?.tasks?.[task.id] && (
                              <div className="text-blue-700 italic text-sm">🌐 {translation.tasks[task.id]}</div>
                            )}
                          </div>
                        </div>
                        <input className="border p-2 w-full text-black bg-white" placeholder={t.feedback} defaultValue={task.note || ""} id={`task-note-${task.id}`} />
                        {translation?.tasks?.[`note_${task.id}`] && (
                          <p className="text-blue-700 italic text-sm">🌐 {translation.tasks[`note_${task.id}`]}</p>
                        )}
                        <button type="button" onClick={() => {
                          const field = document.getElementById(`task-note-${task.id}`) as HTMLInputElement;
                          updateTaskNote(task.id, field.value);
                        }} className="bg-gray-700 text-white px-3 py-2 rounded">{t.saveFeedback}</button>
                      </li>
                    ))}
                </ul>

                {/* Übersetzungs-Button */}
                {companyFeatures?.ai_enabled && (
                  <div className="border-t pt-3 mt-2">
                    <button
                      type="button"
                      onClick={() => translateInstruction(instruction)}
                      disabled={isTranslating}
                      className="bg-black text-white px-4 py-2 rounded font-medium disabled:opacity-50"
                    >
                      {isTranslating ? "⏳ " + t.translating2 : `🌐 ${t.translateTo}: ${instructionToLanguage}`}
                    </button>
                    {translation && (
                      <span className="ml-3 text-sm text-green-600 font-medium">
                        {t.translated} ({translation.language})
                      </span>
                    )}
                  </div>
                )}

                {/* Button: Arbeitsanweisung → Regiebericht */}
                <div className="border-t pt-3 mt-2">
                  {companyFeatures?.module_auto_reports ? (
                    <button
                      type="button"
                      onClick={() => createReportFromInstruction(instruction)}
                      className="bg-green-700 text-white px-4 py-2 rounded font-medium"
                    >
                      {t.toReport}
                    </button>
                  ) : (
                    <div className="bg-gray-50 border rounded p-3 text-sm text-gray-500">
                      {t.autoReportLocked}
                    </div>
                  )}
                </div>

                {(currentCompany?.role === "owner" || currentCompany?.role === "project_manager" || currentCompany?.role === "admin") && (
                  <button type="button" onClick={() => deleteWorkInstruction(instruction.id)} className="bg-red-600 text-white px-3 py-2 rounded">{t.deleteInstruction}</button>
                )}
              </div>
              );
            })}
          </section>
        </div>
      )}

      {/* ── TAB: Mitarbeiter ── */}
      {activeTab === "mitarbeiter" && (
        <section className="border rounded p-4 space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.employeeManagement}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border p-3 text-black bg-white" placeholder={t.name} value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.email} value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
            <select className="border p-3 text-black bg-white" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
              <option value="employee">{t.roleEmployee}</option>
              <option value="project_manager">{t.roleProjectManager}</option>
              <option value="admin">{t.roleAdmin}</option>
            </select>
          </div>
          <button type="button" onClick={addCompanyUser} className="bg-blue-700 text-white px-4 py-3 rounded">{t.addEmployee}</button>
          <p>{t.currentEmployees}: <strong>{companyUsers.length}</strong></p>
          <div className="space-y-3">
            {companyUsers.map((member) => (
              <div key={member.id} className="border rounded p-3 space-y-2">
                <strong>{member.full_name || "-"}</strong>
                <p>{member.email || "-"}</p>
                <p>{t.role}: {member.role}</p>
                {member.email && (
                  <button type="button" onClick={() => resetCompanyUserPassword(member.email)} className="bg-gray-700 text-white px-3 py-2 rounded">{t.resetPassword}</button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TAB: Firmendaten ── */}
      {activeTab === "firmendaten" && (
        <section className="border rounded p-4 space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.companyData}</h2>
          {companySettings?.company_logo && (
            <img src={companySettings.company_logo} alt="Firmenlogo" className="h-20 object-contain" />
          )}
          <div>
            <label className="block text-sm font-medium mb-1">{t.uploadLogo}</label>
            <input type="file" accept="image/*" className="border p-3 w-full text-black bg-white" onChange={(e) => uploadCompanyLogo(e.target.files)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border p-3 text-black bg-white" placeholder={t.companyName}        value={companySettings?.company_name || ""} onChange={(e) => updateCompanyField("company_name", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.street}            value={companySettings?.street || ""}        onChange={(e) => updateCompanyField("street", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.zip}               value={companySettings?.zip_code || ""}      onChange={(e) => updateCompanyField("zip_code", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.city}               value={companySettings?.city || ""}          onChange={(e) => updateCompanyField("city", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.phone}           value={companySettings?.phone || ""}         onChange={(e) => updateCompanyField("phone", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.email}            value={companySettings?.email || ""}         onChange={(e) => updateCompanyField("email", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.website}          value={companySettings?.website || ""}       onChange={(e) => updateCompanyField("website", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.taxNumber} value={companySettings?.tax_number || ""}   onChange={(e) => updateCompanyField("tax_number", e.target.value)} />
          </div>
          <button type="button" onClick={saveCompanySettings} className="bg-blue-700 text-white px-4 py-3 rounded">{t.saveCompany}</button>
        </section>
      )}

    </main>
  );
}