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
  const date = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText))
  );
  const dayNumber = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return `KW ${weekNumber}`;
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

  const firstDate = days.find((day) => day.date)?.date || "";
  const calendarWeek = getCalendarWeek(firstDate);

  useEffect(() => {
  async function loadUser() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);

    if (data.user) {
      await loadReportsFromDatabase();
      await loadCompanySettings(data.user.id);
    }
  }

  loadUser();

  const { data: authListener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setUser(session?.user || null);

      if (session?.user) {
        loadReportsFromDatabase();
        loadCompanySettings(session.user.id);
      } else {
        setSavedReports([]);
        setCompanySettings(null);
      }
    }
  );

  return () => {
    authListener.subscription.unsubscribe();
  };
}, []);

  async function signUp() {
    setMessage("");

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage("Registrierung fehlgeschlagen: " + error.message);
      return;
    }

    setMessage("Registrierung erfolgreich.");
  }

  async function signIn() {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Login fehlgeschlagen: " + error.message);
      return;
    }

    setMessage("Login erfolgreich.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    newReport();
    setSavedReports([]);
    setMessage("Du wurdest abgemeldet.");
  }

  async function loadReportsFromDatabase() {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Fehler beim Laden: " + error.message);
      return;
    }

    setSavedReports((data || []) as SavedReport[]);
  }

  function updateDay(index: number, field: keyof DayEntry, value: string) {
    const copy = [...days];
    copy[index] = { ...copy[index], [field]: value };
    setDays(copy);
  }

  function updateFullWeekFromMonday(selectedValue: string) {
    if (!selectedValue) return;

    const [year, month, day] = selectedValue.split("-").map(Number);
    const copy = [...days];

    for (let i = 0; i < 7; i++) {
      const nextDate = new Date(Date.UTC(year, month - 1, day + i));
      copy[i] = {
        ...copy[i],
        date: nextDate.toISOString().split("T")[0],
      };
    }

    setDays(copy);
  }

  function parseHours(value: string) {
    return Number(value.replace(",", ".")) || 0;
  }

  const totalHours = days.reduce((sum, day) => sum + parseHours(day.hours), 0);

  const projectTotals = days.reduce<Record<string, number>>((acc, day) => {
    if (!day.projectNumber) return acc;

    acc[day.projectNumber] =
      (acc[day.projectNumber] || 0) + parseHours(day.hours);

    return acc;
  }, {});

  async function handlePhotos(index: number, files: FileList | null) {
    if (!files || !user) return;

    setMessage("Fotos werden hochgeladen...");

    for (const file of Array.from(files)) {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `${user.id}/${calendarWeek || "ohne-kw"}/${fileName}`;

      const { error } = await supabase.storage
        .from("report-photos")
        .upload(filePath, file);

      if (error) {
        setMessage("Fehler beim Foto-Upload: " + error.message);
        return;
      }

      const { data } = supabase.storage
        .from("report-photos")
        .getPublicUrl(filePath);

      const copy = [...days];
      copy[index] = {
        ...copy[index],
        photos: [...copy[index].photos, data.publicUrl],
      };

      setDays(copy);
    }

    setMessage("Fotos wurden hochgeladen.");
  }

  function deletePhoto(dayIndex: number, photoIndex: number) {
    const copy = [...days];

    copy[dayIndex] = {
      ...copy[dayIndex],
      photos: copy[dayIndex].photos.filter((_, index) => index !== photoIndex),
    };

    setDays(copy);
  }
async function loadCompanySettings(userId: string) {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    setMessage("Fehler beim Laden der Firmendaten: " + error.message);
    return;
  }

  setCompanySettings(
    data || {
      user_id: userId,
      company_name: "Elektrotechnik Luger",
      company_logo: "",
      street: "",
      zip_code: "",
      city: "",
      phone: "",
      email: "",
      website: "",
      tax_number: "",
    }
  );
}

async function saveCompanySettings() {
  if (!user || !companySettings) return;

  const { error } = await supabase
    .from("company_settings")
    .upsert(
      {
        ...companySettings,
        user_id: user.id,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    setMessage("Fehler beim Speichern der Firmendaten: " + error.message);
    return;
  }

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

  const { error } = await supabase.storage
    .from("company-logos")
    .upload(filePath, file, { upsert: true });

  if (error) {
    setMessage("Fehler beim Logo-Upload: " + error.message);
    return;
  }

  const { data } = supabase.storage
    .from("company-logos")
    .getPublicUrl(filePath);

  updateCompanyField("company_logo", data.publicUrl);
  setMessage("Logo wurde hochgeladen. Bitte Firmendaten speichern.");
}
  async function saveReport() {
    setMessage("");

    if (!user) {
      setMessage("Bitte zuerst anmelden.");
      return;
    }

    const name =
      reportName.trim() ||
      `${calendarWeek || "Woche"} - ${employee || "Bericht"}`;

    const reportData = {
      report_name: name,
      employee,
      from_language: fromLanguage,
      to_language: toLanguage,
      pdf_language: pdfLanguage,
      days,
      user_id: user.id,
    };

    let error;

    if (currentReportId) {
      ({ error } = await supabase
        .from("reports")
        .update(reportData)
        .eq("id", currentReportId));
    } else {
      const result = await supabase
        .from("reports")
        .insert(reportData)
        .select()
        .single();

      error = result.error;

      if (result.data?.id) {
        setCurrentReportId(result.data.id);
      }
    }

    if (error) {
      setMessage("Fehler beim Speichern: " + error.message);
      return;
    }

    setReportName(name);
    setMessage(
      currentReportId
        ? "Bericht wurde aktualisiert."
        : "Neuer Bericht wurde gespeichert."
    );

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
  }

  async function deleteReport(id: string) {
    const { error } = await supabase.from("reports").delete().eq("id", id);

    if (error) {
      setMessage("Fehler beim Löschen: " + error.message);
      return;
    }

    if (currentReportId === id) newReport();

    setMessage("Bericht wurde gelöscht.");
    await loadReportsFromDatabase();
  }

  function newReport() {
    setCurrentReportId(null);
    setReportName("");
    setEmployee("");
    setEmailTo("");
    setFromLanguage("Deutsch");
    setToLanguage("Polnisch");
    setPdfLanguage("Deutsch");
    setDays(createEmptyDays());
  }

  async function translateAll() {
    setMessage("");

    if (!employee.trim()) {
      setMessage("Bitte Mitarbeiter eintragen.");
      return;
    }

    setLoading(true);

    const translatedDays = [...days];

    try {
      for (let i = 0; i < translatedDays.length; i++) {
        const day = translatedDays[i];

        if (!day.description.trim()) continue;

        const res = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hours: day.hours,
            description: day.description,
            fromLanguage,
            toLanguage,
          }),
        });

        const data = await res.json();

        translatedDays[i].translation = data.error
          ? data.error
          : data.translation;
      }

      setDays(translatedDays);
      setMessage("Woche wurde übersetzt.");
    } catch (error) {
      setMessage("Fehler beim Übersetzen: " + String(error));
    }

    setLoading(false);
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
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(p.company, marginLeft, pageHeight - 10);
      doc.text(
        `${p.createdAt}: ${new Date().toLocaleDateString("de-DE")}`,
        pageWidth - marginRight,
        pageHeight - 10,
        { align: "right" }
      );
      doc.setTextColor(0);
    };

    const addNewPageIfNeeded = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 25) {
        addFooter();
        doc.addPage();
        y = 15;
      }
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
    if (companySettings?.company_logo) {
  try {
    const response = await fetch(companySettings.company_logo);
    const blob = await response.blob();

    const logoBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    doc.addImage(
      logoBase64,
      "PNG",
      pageWidth - 135,
      8,
      120,
      45
    );
  } catch (error) {
    console.error("Logo konnte nicht geladen werden", error);
  }
}

    doc.setFillColor(240, 240, 240);
   doc.rect(0, 0, pageWidth, 70, "F");
    doc.setFontSize(20);
doc.setFont("helvetica", "bold");
doc.text(p.title, marginLeft, y);

doc.setFontSize(11);
doc.setFont("helvetica", "normal");
y += 8;

doc.text(
  companySettings?.company_name || "Elektrotechnik Luger",
  marginLeft,
  y
);

y += 6;

if (companySettings?.street) {
  doc.text(companySettings.street, marginLeft, y);
  y += 5;
}

if (companySettings?.zip_code || companySettings?.city) {
  doc.text(
    `${companySettings?.zip_code || ""} ${companySettings?.city || ""}`,
    marginLeft,
    y
  );
  y += 5;
}

if (companySettings?.phone) {
  doc.text(`Tel: ${companySettings.phone}`, marginLeft, y);
  y += 5;
}

if (companySettings?.email) {
  doc.text(`E-Mail: ${companySettings.email}`, marginLeft, y);
  y += 5;
}

if (companySettings?.website) {
  doc.text(`Web: ${companySettings.website}`, marginLeft, y);
  y += 5;
}

if (companySettings?.tax_number) {
  doc.text(`UID: ${companySettings.tax_number}`, marginLeft, y);
  y += 5;
}

    y += 7;
    doc.text(`${p.report}: ${reportName || "-"}`, marginLeft, y);
    y += 6;
    doc.text(`${p.calendarWeek}: ${calendarWeek || "-"}`, marginLeft, y);
    y += 6;
    doc.text(`${p.employee}: ${employee || "-"}`, marginLeft, y);

    if (logoBase64) {
  doc.addImage(logoBase64, "PNG", pageWidth - 45, 8, 30, 30);
} else {
  doc.addImage(qrImage, "PNG", pageWidth - 42, 8, 28, 28);
}

    y += 10;

if (y < 75) {
  y = 75;
}

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(p.dailyReports, marginLeft, y);
    y += 8;

    for (const day of days) {
      const hasContent =
        day.description ||
        day.hours ||
        day.customer ||
        day.projectNumber ||
        day.site ||
        day.photos.length > 0;

      if (!hasContent) return;

      const descriptionText = day.translation || day.description || "-";
      const splitDescription = doc.splitTextToSize(
        descriptionText,
        contentWidth - 8
      );

      const estimatedHeight =
        45 + splitDescription.length * 5 + day.photos.length * 10;

      addNewPageIfNeeded(estimatedHeight);

      doc.setFillColor(230, 230, 230);
      doc.rect(marginLeft, y, contentWidth, 9, "F");

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${day.weekday} - ${day.date || "-"}`, marginLeft + 3, y + 6);

      y += 13;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      doc.text(`${p.customer}: ${day.customer || "-"}`, marginLeft + 3, y);
      doc.text(`${p.project}: ${day.projectNumber || "-"}`, marginLeft + 80, y);
      y += 6;

      doc.text(`${p.site}: ${day.site || "-"}`, marginLeft + 3, y);
      doc.text(`${p.hours}: ${day.hours || "-"}`, marginLeft + 80, y);
      y += 8;

      doc.setFont("helvetica", "bold");
      doc.text(`${p.description}:`, marginLeft + 3, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.text(splitDescription, marginLeft + 3, y);
      y += splitDescription.length * 5 + 5;

      
      if (day.photos.length > 0) {
  doc.setFont("helvetica", "bold");
  doc.text(`${p.photos}:`, marginLeft + 3, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

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

      doc.text(`${p.photo} ${photoIndex + 1}:`, marginLeft + 3, y);
      y += 5;

      doc.addImage(photoBase64, "JPEG", marginLeft + 3, y, 70, 50);
      y += 56;
    } catch (error) {
      doc.text(
        `${p.photo} ${photoIndex + 1}: konnte nicht geladen werden`,
        marginLeft + 3,
        y
      );
      y += 6;
    }
  }

  y += 2;
}
      doc.setDrawColor(200);
doc.line(marginLeft, y, pageWidth - marginRight, y);
y += 10;
doc.setDrawColor(0);
}

    addNewPageIfNeeded(65);

    
    doc.setFontSize(12);
doc.setFont("helvetica", "bold");
doc.text(p.summary, marginLeft, y);
y += 8;

doc.setFontSize(10);
doc.setFont("helvetica", "normal");
doc.text(
  `${p.totalHours}: ${totalHours.toString().replace(".", ",")} ${p.hours}`,
  marginLeft,
  y
);
y += 8;

Object.entries(projectTotals).forEach(([project, total]) => {
      doc.text(
        `${p.project} ${project}: ${total
          .toString()
          .replace(".", ",")} ${p.hours}`,
        marginLeft,
        y
      );
      y += 6;
    });

    y += 18;

    doc.line(marginLeft, y, marginLeft + 70, y);
    doc.line(pageWidth - marginRight - 70, y, pageWidth - marginRight, y);

    y += 6;
    doc.setFontSize(9);
    doc.text(p.signatureEmployee, marginLeft, y);
    doc.text(p.signatureCustomer, pageWidth - marginRight - 70, y);

    addFooter();

    const filename = `Regiebericht_${calendarWeek || "Woche"}_${
      employee || "Mitarbeiter"
    }.pdf`;

    if (sendByEmail) {
      if (!emailTo.trim()) {
        setMessage("Bitte Empfänger-E-Mail eintragen.");
        return;
      }

      setMessage("PDF wird per E-Mail gesendet...");

      const pdfBase64 = doc.output("datauristring").split(",")[1];

      const res = await fetch("/api/send-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: emailTo,
          subject: `${p.title} ${calendarWeek || ""}`,
          pdfBase64,
          filename,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessage("Fehler beim E-Mail-Versand: " + data.error);
        return;
      }

      setMessage("PDF wurde per E-Mail gesendet.");
      return;
    }

    doc.save(filename);
  }

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
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          {message && (
            <div className="border rounded p-3 bg-yellow-100 text-black">
              {message}
            </div>
          )}

          <input
            className="border p-3 w-full text-black bg-white"
            placeholder={t.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="border p-3 w-full text-black bg-white"
            placeholder={t.password}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={signIn}
              className="bg-blue-600 text-white px-4 py-3 rounded"
            >
              {t.login}
            </button>

            <button
              type="button"
              onClick={signUp}
              className="bg-green-600 text-white px-4 py-3 rounded"
            >
              {t.register}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 bg-gray-100 min-h-screen text-black">
      <header>
        <h1 className="text-3xl font-bold text-black">{t.title}</h1>
        <p className="text-gray-700">{t.subtitle}</p>
        <p className="text-gray-700">
          {t.loggedInAs}: {user.email}
        </p>

        <button
          type="button"
          onClick={signOut}
          className="mt-3 bg-gray-800 text-white px-4 py-2 rounded"
        >
          {t.logout}
        </button>
      </header>
<section className="border rounded p-4 space-y-4 bg-white text-black">
  <h2 className="text-xl font-bold">Firmendaten</h2>

  {companySettings?.company_logo && (
    <img
      src={companySettings.company_logo}
      alt="Firmenlogo"
      className="h-20 object-contain"
    />
  )}

  <input
    type="file"
    accept="image/*"
    className="border p-3 w-full text-black bg-white"
    onChange={(e) => uploadCompanyLogo(e.target.files)}
  />

  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <input className="border p-3 text-black bg-white" placeholder="Firmenname" value={companySettings?.company_name || ""} onChange={(e) => updateCompanyField("company_name", e.target.value)} />
    <input className="border p-3 text-black bg-white" placeholder="Straße" value={companySettings?.street || ""} onChange={(e) => updateCompanyField("street", e.target.value)} />
    <input className="border p-3 text-black bg-white" placeholder="PLZ" value={companySettings?.zip_code || ""} onChange={(e) => updateCompanyField("zip_code", e.target.value)} />
    <input className="border p-3 text-black bg-white" placeholder="Ort" value={companySettings?.city || ""} onChange={(e) => updateCompanyField("city", e.target.value)} />
    <input className="border p-3 text-black bg-white" placeholder="Telefon" value={companySettings?.phone || ""} onChange={(e) => updateCompanyField("phone", e.target.value)} />
    <input className="border p-3 text-black bg-white" placeholder="E-Mail" value={companySettings?.email || ""} onChange={(e) => updateCompanyField("email", e.target.value)} />
    <input className="border p-3 text-black bg-white" placeholder="Webseite" value={companySettings?.website || ""} onChange={(e) => updateCompanyField("website", e.target.value)} />
    <input className="border p-3 text-black bg-white" placeholder="UID / Steuernummer" value={companySettings?.tax_number || ""} onChange={(e) => updateCompanyField("tax_number", e.target.value)} />
  </div>

  <button
    type="button"
    onClick={saveCompanySettings}
    className="bg-blue-700 text-white px-4 py-3 rounded"
  >
    Firmendaten speichern
  </button>
</section>
      {message && (
        <div className="border rounded p-3 bg-yellow-100 text-black">
          {message}
        </div>
      )}

      <section className="border rounded p-4 space-y-4 bg-white text-black">
        <h2 className="text-xl font-bold">{t.saveLoad}</h2>

        <input
          className="border p-3 w-full text-black bg-white"
          placeholder={t.reportName}
          value={reportName}
          onChange={(e) => setReportName(e.target.value)}
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveReport}
            className="bg-orange-600 text-white px-4 py-3 rounded"
          >
            {currentReportId ? t.updateReport : t.saveReport}
          </button>

          <button
            type="button"
            onClick={newReport}
            className="bg-gray-700 text-white px-4 py-3 rounded"
          >
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
                  {t.employee}: {report.employee || "-"} |{" "}
                  {new Date(report.created_at).toLocaleString("de-DE")}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => loadReport(report)}
                    className="bg-blue-600 text-white px-3 py-2 rounded"
                  >
                    {t.loadEdit}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteReport(report.id)}
                    className="bg-red-600 text-white px-3 py-2 rounded"
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border rounded p-4 space-y-4 bg-white text-black">
        <h2 className="text-xl font-bold">{t.general}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            className="border p-3 text-black bg-white"
            value={uiLanguage}
            onChange={(e) => setUiLanguage(e.target.value as Language)}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {t.appLanguage}: {lang}
              </option>
            ))}
          </select>

          <select
            className="border p-3 text-black bg-white"
            value={pdfLanguage}
            onChange={(e) => setPdfLanguage(e.target.value)}
          >
            {pdfLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {t.pdfLanguage}: {lang}
              </option>
            ))}
          </select>

          <input
            className="border p-3 text-black bg-white"
            placeholder={t.employee}
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
          />

          <input
            className="border p-3 bg-gray-200 text-black"
            value={calendarWeek}
            readOnly
            placeholder={t.calendarWeek}
          />

          <select
            className="border p-3 text-black bg-white"
            value={fromLanguage}
            onChange={(e) => setFromLanguage(e.target.value)}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          <select
            className="border p-3 text-black bg-white"
            value={toLanguage}
            onChange={(e) => setToLanguage(e.target.value)}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          <input
            className="border p-3 text-black bg-white md:col-span-2"
            placeholder={t.recipientEmail}
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
        </div>
      </section>

      {days.map((day, index) => (
        <section
          key={day.weekday}
          className="border rounded p-4 space-y-3 bg-white text-black"
        >
          <h2 className="text-xl font-bold">{day.weekday}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="date"
              className="border p-3 text-black bg-white"
              value={day.date}
              onChange={(e) => {
                if (index === 0) updateFullWeekFromMonday(e.target.value);
                else updateDay(index, "date", e.target.value);
              }}
            />

            <input
              className="border p-3 text-black bg-white"
              placeholder={t.customer}
              value={day.customer}
              onChange={(e) => updateDay(index, "customer", e.target.value)}
            />

            <input
              className="border p-3 text-black bg-white"
              placeholder={t.projectNumber}
              value={day.projectNumber}
              onChange={(e) =>
                updateDay(index, "projectNumber", e.target.value)
              }
            />

            <input
              className="border p-3 text-black bg-white"
              placeholder={t.site}
              value={day.site}
              onChange={(e) => updateDay(index, "site", e.target.value)}
            />

            <input
              className="border p-3 text-black bg-white"
              placeholder={t.hours}
              value={day.hours}
              onChange={(e) => updateDay(index, "hours", e.target.value)}
            />
          </div>

          <textarea
            className="border p-3 w-full h-28 text-black bg-white"
            placeholder={t.description}
            value={day.description}
            onChange={(e) => updateDay(index, "description", e.target.value)}
          />

          <input
            type="file"
            accept="image/*"
            multiple
            className="border p-3 w-full text-black bg-white"
            onChange={(e) => handlePhotos(index, e.target.files)}
          />

          {day.photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {day.photos.map((photo, photoIndex) => (
                <div key={photoIndex} className="border rounded p-2">
                  <img
                    src={photo}
                    alt="Foto"
                    className="w-full h-32 object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => deletePhoto(index, photoIndex)}
                    className="mt-2 bg-red-600 text-white px-2 py-2 rounded w-full"
                  >
                    {t.deletePhoto}
                  </button>
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

      <section className="border rounded p-4 space-y-2 bg-white text-black">
        <h2 className="text-xl font-bold">{t.hoursOverview}</h2>
        <p>
          <strong>{t.total}:</strong>{" "}
          {totalHours.toString().replace(".", ",")} {t.hours}
        </p>

        {Object.entries(projectTotals).map(([project, total]) => (
          <p key={project}>
            <strong>
              {t.projectNumber} {project}:
            </strong>{" "}
            {total.toString().replace(".", ",")} {t.hours}
          </p>
        ))}
      </section>

      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={translateAll}
          className="bg-black text-white px-4 py-3 rounded"
        >
          {loading ? t.translating : t.translateWeek}
        </button>

        <button
          type="button"
          onClick={saveReport}
          className="bg-orange-600 text-white px-4 py-3 rounded"
        >
          {currentReportId ? t.update : t.save}
        </button>

        <button
          type="button"
          onClick={() => createPDF(false)}
          className="bg-green-600 text-white px-4 py-3 rounded"
        >
          {t.downloadPdf}
        </button>

        <button
          type="button"
          onClick={() => createPDF(true)}
          className="bg-purple-600 text-white px-4 py-3 rounded"
        >
          {t.sendPdf}
        </button>
      </div>
    </main>
  );
}
