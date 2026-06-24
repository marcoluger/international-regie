"use client";

import React, { useEffect, useState, useRef } from "react";
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
  startTime: string;
  endTime: string;
  breakMinutes: string;
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
    slug: string;
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
  max_photos?: number;
  allowed_languages: string[];
};

const texts = {
  Deutsch: {
    title: "Regie International",
    subtitle: "Arbeitsanweisungen und Regieberichte erfassen, übersetzen, speichern und versenden.",
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
    startTime: "Anfang",
    endTime: "Ende",
    breakLabel: "Pause (Min.)",
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
    dashboard: "Dashboard",
    projects: "Projekte",
    workInstructions: "Arbeitsanweisungen",
    dueToday: "Heute fällig",
    totalProgress: "Gesamtfortschritt",
    stoppedSteps: "Gestoppte Arbeitsschritte",
    stepsInProgress: "Arbeitsschritte in Arbeit",
    noProject: "Kein Projekt",
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
    employeeManagement: "Mitarbeiterverwaltung",
    name: "Name",
    role: "Rolle",
    addEmployee: "Mitarbeiter hinzufügen",
    currentEmployees: "Aktuelle Mitarbeiter",
    resetPassword: "Passwort zurücksetzen",
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
    reportNameLabel: "Berichtsname",
    firma: "Firma",
    feedbackLabel: "Rückmeldung",
    noProjectsYet: "Noch keine Projekte vorhanden.",
    weekdays: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
    noInstructionsYet: "Noch keine Arbeitsanweisungen vorhanden.",
    msgLoginOk: "Login erfolgreich.",
    msgLogout: "Du wurdest abgemeldet.",
    msgRegisterOk: "Registrierung erfolgreich.",
    msgRegisterFail: "Registrierung fehlgeschlagen: ",
    msgLoginFail: "Login fehlgeschlagen: ",
    msgSaved: "Neuer Bericht wurde gespeichert.",
    msgUpdated: "Bericht wurde aktualisiert.",
    msgLoaded: "Bericht wurde geladen.",
    msgDeleted: "Bericht wurde gelöscht.",
    msgTranslated: "Woche wurde übersetzt.",
    msgTranslateErr: "Fehler beim Übersetzen: ",
    msgPhotoUploading: "Fotos werden hochgeladen...",
    msgPhotoOk: "Fotos wurden hochgeladen.",
    msgPhotoErr: "Fehler beim Foto-Upload: ",
    msgPhotoLimit: "Maximal {n} Fotos erlaubt.",
    msgSaving: "Speichere Arbeitsanweisung...",
    msgNoFirm: "Keine Firma geladen.",
    msgNoTitle: "Bitte Titel der Arbeitsanweisung eintragen.",
    msgInstructionSaved: "Arbeitsanweisung gespeichert.",
    msgInstructionDeleted: "Arbeitsanweisung gelöscht.",
    msgFeedbackSaved: "Rückmeldung gespeichert.",
    msgEmployeeAdded: "Mitarbeiter wurde angelegt.",
    msgPasswordReset: "Passwort-Reset-E-Mail wurde gesendet.",
    msgCompanySaved: "Firmendaten wurden gespeichert.",
    msgProjectSaved: "Projekt gespeichert.",
    msgProjectDeleted: "Projekt gelöscht.",
    msgInstructionTranslated: "Arbeitsanweisung wurde übersetzt.",
    msgNewReport: "Neuer Bericht gestartet.",
    msgNoEmployee: "Bitte Mitarbeiter eintragen.",
    msgEmailRequired: "Bitte Empfänger-E-Mail eintragen.",
    msgEmailSending: "PDF wird per E-Mail gesendet...",
    msgEmailSent: "PDF wurde per E-Mail gesendet.",
    tabReport: "Regiebericht",
    photos: "Fotos",
    deletePhoto2: "Foto löschen",
    tabDay: "Tagesansicht",
    tabWeek: "Wochenansicht",
    weekView: "Wochenansicht",
    noInstructionsDay: "Keine Arbeitsanweisungen für diesen Tag.",
    noInstructionsWeek: "Keine Arbeitsanweisungen für diese Woche.",
    noInstructionsMonth: "Keine Arbeitsanweisungen für diesen Monat.",
    tabMonth: "Monatsansicht",
    dayView: "Tagesansicht",
    monthView: "Monatsansicht",
    selectDate: "Datum wählen",
    noEntries: "Keine Einträge gefunden.",
    totalHoursMonth: "Gesamtstunden im Monat",
    hoursPerProject: "Stunden pro Projekt",
    dailyEntry: "Tageseintrag",
    saveDayEntry: "Tageseintrag speichern",
    week: "Woche",
    statusOpen: "⬜ Offen",
    statusInProgress: "🟡 In Arbeit",
    statusStopped: "⛔ Gestoppt",
    statusCompleted: "✅ Erledigt",
    problemsHints: "Probleme / Hinweise",
    roleEmployee: "Mitarbeiter",
    roleProjectManager: "Projektleiter",
    roleAdmin: "Admin",
    commentLabel: "Kommentar",
    commentPlaceholder: "Kommentar eingeben...",
    commentSaveBtn: "Speichern",
    commentSaving: "Speichere…",
    commentSaved: "Gespeichert",
    commentErrorLabel: "Fehler",
    charsLabel: "Zeichen",
    copyInstruction: "Schritte kopieren",
    copyTitle: "Schritte aus Anweisung übernehmen",
    copySource: "Anweisung auswählen",
    copyWhichSteps: "Welche Arbeitsschritte übernehmen?",
    copyAllNone: "Alle / Keine",
    copyNoSteps: "Keine Arbeitsschritte vorhanden.",
    copyCancel: "Abbrechen",
    copyConfirm: "Übernehmen",
    copySelectSource: "Bitte Anweisung wählen.",
    copyDone: "Arbeitsschritte wurden übernommen.",
  },
  Kroatisch: {
    title: "Regie International",
    subtitle: "Unos, prijevod, spremanje i slanje radnih uputa i izvještaja.",
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
    startTime: "Početak",
    endTime: "Kraj",
    breakLabel: "Pauza (min)",
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
    reportsTab: "Režijski izvještaji",
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
    weekdays: ["Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota", "Nedjelja"],
    noInstructionsYet: "Još nema radnih uputa.",
    msgLoginOk: "Prijava uspješna.",
    msgLogout: "Odjavljeni ste.",
    msgRegisterOk: "Registracija uspješna.",
    msgRegisterFail: "Registracija neuspješna: ",
    msgLoginFail: "Prijava neuspješna: ",
    msgSaved: "Novi izvještaj je spremljen.",
    msgUpdated: "Izvještaj je ažuriran.",
    msgLoaded: "Izvještaj je učitan.",
    msgDeleted: "Izvještaj je obrisan.",
    msgTranslated: "Tjedan je preveden.",
    msgTranslateErr: "Pogreška pri prevođenju: ",
    msgPhotoUploading: "Učitavanje fotografija...",
    msgPhotoOk: "Fotografije su učitane.",
    msgPhotoErr: "Pogreška pri učitavanju fotografije: ",
    msgPhotoLimit: "Najviše {n} fotografija dozvoljeno.",
    msgSaving: "Sprema se radna uputa...",
    msgNoFirm: "Tvrtka nije učitana.",
    msgNoTitle: "Unesite naslov radne upute.",
    msgInstructionSaved: "Radna uputa je spremljena.",
    msgInstructionDeleted: "Radna uputa je obrisana.",
    msgFeedbackSaved: "Povratna informacija je spremljena.",
    msgEmployeeAdded: "Radnik je dodan.",
    msgPasswordReset: "E-mail za resetiranje lozinke je poslan.",
    msgCompanySaved: "Podaci o tvrtki su spremljeni.",
    msgProjectSaved: "Projekt je spremljen.",
    msgProjectDeleted: "Projekt je obrisan.",
    msgInstructionTranslated: "Radna uputa je prevedena.",
    msgNewReport: "Novi izvještaj je pokrenut.",
    msgNoEmployee: "Unesite ime radnika.",
    msgEmailRequired: "Unesite e-mail primatelja.",
    msgEmailSending: "PDF se šalje e-poštom...",
    msgEmailSent: "PDF je poslan e-poštom.",
    tabReport: "Režijski izvještaj",
    photos: "Fotografije",
    deletePhoto2: "Obriši fotografiju",
    tabDay: "Dnevni pregled",
    tabWeek: "Tedenski pregled",
    weekView: "Tedenski pregled",
    noInstructionsDay: "Ni delovnih navodil za ta dan.",
    noInstructionsWeek: "Ni delovnih navodil za ta teden.",
    noInstructionsMonth: "Ni delovnih navodil za ta mesec.",
    tabMonth: "Mjesečni pregled",
    dayView: "Dnevni pregled",
    monthView: "Mjesečni pregled",
    selectDate: "Odaberi datum",
    noEntries: "Nema unosa.",
    totalHoursMonth: "Ukupno sati u mjesecu",
    hoursPerProject: "Sati po projektu",
    dailyEntry: "Dnevni unos",
    saveDayEntry: "Spremi dnevni unos",
    week: "Tjedan",
    statusOpen: "⬜ Otvoreno",
    statusInProgress: "🟡 U tijeku",
    statusStopped: "⛔ Zaustavljeno",
    statusCompleted: "✅ Završeno",
    problemsHints: "Problemi / napomene",
    roleEmployee: "Radnik",
    roleProjectManager: "Voditelj projekta",
    roleAdmin: "Administrator",
    commentLabel: "Komentar",
    commentPlaceholder: "Unesite komentar...",
    commentSaveBtn: "Spremi",
    commentSaving: "Spremam…",
    commentSaved: "Spremljeno",
    commentErrorLabel: "Greška",
    charsLabel: "znakova",
    copyInstruction: "Kopiraj korake",
    copyTitle: "Preuzmi korake iz upute",
    copySource: "Odaberi uputu",
    copyWhichSteps: "Koje radne korake preuzeti?",
    copyAllNone: "Sve / Ništa",
    copyNoSteps: "Nema radnih koraka.",
    copyCancel: "Odustani",
    copyConfirm: "Preuzmi",
    copySelectSource: "Odaberite uputu.",
    copyDone: "Radni koraci su preuzeti.",
  },
  Slowenisch: {
    title: "Regie International",
    subtitle: "Vnos, prevod, shranjevanje in pošiljanje delovnih navodil in poročil.",
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
    startTime: "Začetek",
    endTime: "Konec",
    breakLabel: "Odmor (min)",
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
    reportsTab: "Režijska poročila",
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
    weekdays: ["Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota", "Nedelja"],
    noInstructionsYet: "Še ni delovnih navodil.",
    msgLoginOk: "Prijava uspešna.",
    msgLogout: "Odjavljeni ste.",
    msgRegisterOk: "Registracija uspešna.",
    msgRegisterFail: "Registracija neuspešna: ",
    msgLoginFail: "Prijava neuspešna: ",
    msgSaved: "Novo poročilo je shranjeno.",
    msgUpdated: "Poročilo je posodobljeno.",
    msgLoaded: "Poročilo je naloženo.",
    msgDeleted: "Poročilo je izbrisano.",
    msgTranslated: "Teden je preveden.",
    msgTranslateErr: "Napaka pri prevajanju: ",
    msgPhotoUploading: "Nalaganje fotografij...",
    msgPhotoOk: "Fotografije so naložene.",
    msgPhotoErr: "Napaka pri nalaganju fotografije: ",
    msgPhotoLimit: "Največ {n} fotografij dovoljeno.",
    msgSaving: "Shranjevanje delovnega navodila...",
    msgNoFirm: "Podjetje ni naloženo.",
    msgNoTitle: "Vnesite naslov delovnega navodila.",
    msgInstructionSaved: "Delovno navodilo je shranjeno.",
    msgInstructionDeleted: "Delovno navodilo je izbrisano.",
    msgFeedbackSaved: "Povratna informacija je shranjena.",
    msgEmployeeAdded: "Zaposleni je dodan.",
    msgPasswordReset: "E-pošta za ponastavitev gesla je poslana.",
    msgCompanySaved: "Podatki podjetja so shranjeni.",
    msgProjectSaved: "Projekt je shranjen.",
    msgProjectDeleted: "Projekt je izbrisan.",
    msgInstructionTranslated: "Delovno navodilo je prevedeno.",
    msgNewReport: "Novo poročilo je začeto.",
    msgNoEmployee: "Vnesite ime zaposlenega.",
    msgEmailRequired: "Vnesite e-pošto prejemnika.",
    msgEmailSending: "PDF se pošilja po e-pošti...",
    msgEmailSent: "PDF je poslan po e-pošti.",
    tabReport: "Režijsko poročilo",
    photos: "Fotografije",
    deletePhoto2: "Izbriši fotografijo",
    tabDay: "Dnevni pregled",
    tabWeek: "Tjedni pregled",
    weekView: "Tjedni pregled",
    noInstructionsDay: "Nema radnih uputa za ovaj dan.",
    noInstructionsWeek: "Nema radnih uputa za ovaj tjedan.",
    noInstructionsMonth: "Nema radnih uputa za ovaj mjesec.",
    tabMonth: "Mesečni pregled",
    dayView: "Dnevni pregled",
    monthView: "Mesečni pregled",
    selectDate: "Izberi datum",
    noEntries: "Ni vnosov.",
    totalHoursMonth: "Skupno ur v mesecu",
    hoursPerProject: "Ure po projektu",
    dailyEntry: "Dnevni vnos",
    saveDayEntry: "Shrani dnevni vnos",
    week: "Teden",
    statusOpen: "⬜ Odprto",
    statusInProgress: "🟡 V teku",
    statusStopped: "⛔ Ustavljeno",
    statusCompleted: "✅ Končano",
    problemsHints: "Težave / opombe",
    roleEmployee: "Zaposleni",
    roleProjectManager: "Vodja projekta",
    roleAdmin: "Administrator",
    commentLabel: "Komentar",
    commentPlaceholder: "Vnesite komentar...",
    commentSaveBtn: "Shrani",
    commentSaving: "Shranjujem…",
    commentSaved: "Shranjeno",
    commentErrorLabel: "Napaka",
    charsLabel: "znakov",
    copyInstruction: "Kopiraj korake",
    copyTitle: "Prevzemi korake iz navodila",
    copySource: "Izberi navodilo",
    copyWhichSteps: "Katere delovne korake prevzeti?",
    copyAllNone: "Vse / Nič",
    copyNoSteps: "Ni delovnih korakov.",
    copyCancel: "Prekliči",
    copyConfirm: "Prevzemi",
    copySelectSource: "Izberite navodilo.",
    copyDone: "Delovni koraki so prevzeti.",
  },
  Polnisch: {
    title: "Regie International",
    subtitle: "Wprowadzanie, tłumaczenie, zapisywanie i wysyłanie instrukcji pracy i raportów.",
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
    startTime: "Początek",
    endTime: "Koniec",
    breakLabel: "Przerwa (min)",
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
    dashboard: "Panel główny",
    projects: "Projekty",
    workInstructions: "Instrukcje pracy",
    dueToday: "Należne dzisiaj",
    totalProgress: "Ogólny postęp",
    stoppedSteps: "Zatrzymane kroki",
    stepsInProgress: "Kroki w toku",
    noProject: "Brak projektu",
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
    translateTo: "Przetłumacz na",
    translating2: "Tłumaczenie...",
    translated: "Przetłumaczono",
    feedback: "Informacja zwrotna",
    saveFeedback: "Zapisz informację",
    toReport: "Przenieś do raportu",
    deleteInstruction: "Usuń instrukcję",
    autoReportLocked: "Automatyczne raporty nie są aktywne w Twoim pakiecie.",
    employeeManagement: "Zarządzanie pracownikami",
    name: "Imię",
    role: "Rola",
    addEmployee: "Dodaj pracownika",
    currentEmployees: "Aktualni pracownicy",
    resetPassword: "Resetuj hasło",
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
    reportNameLabel: "Nazwa raportu",
    firma: "Firma",
    feedbackLabel: "Informacja zwrotna",
    noProjectsYet: "Brak projektów.",
    weekdays: ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"],
    noInstructionsYet: "Brak instrukcji pracy.",
    msgLoginOk: "Logowanie zakończone sukcesem.",
    msgLogout: "Zostałeś wylogowany.",
    msgRegisterOk: "Rejestracja zakończona sukcesem.",
    msgRegisterFail: "Rejestracja nieudana: ",
    msgLoginFail: "Logowanie nieudane: ",
    msgSaved: "Nowy raport został zapisany.",
    msgUpdated: "Raport został zaktualizowany.",
    msgLoaded: "Raport został wczytany.",
    msgDeleted: "Raport został usunięty.",
    msgTranslated: "Tydzień został przetłumaczony.",
    msgTranslateErr: "Błąd tłumaczenia: ",
    msgPhotoUploading: "Przesyłanie zdjęć...",
    msgPhotoOk: "Zdjęcia zostały przesłane.",
    msgPhotoErr: "Błąd przesyłania zdjęcia: ",
    msgPhotoLimit: "Maksymalnie {n} zdjęć.",
    msgSaving: "Zapisywanie instrukcji pracy...",
    msgNoFirm: "Firma nie jest załadowana.",
    msgNoTitle: "Wprowadź tytuł instrukcji pracy.",
    msgInstructionSaved: "Instrukcja pracy została zapisana.",
    msgInstructionDeleted: "Instrukcja pracy została usunięta.",
    msgFeedbackSaved: "Informacja zwrotna została zapisana.",
    msgEmployeeAdded: "Pracownik został dodany.",
    msgPasswordReset: "E-mail do resetowania hasła został wysłany.",
    msgCompanySaved: "Dane firmy zostały zapisane.",
    msgProjectSaved: "Projekt został zapisany.",
    msgProjectDeleted: "Projekt został usunięty.",
    msgInstructionTranslated: "Instrukcja pracy została przetłumaczona.",
    msgNewReport: "Nowy raport został rozpoczęty.",
    msgNoEmployee: "Wprowadź imię pracownika.",
    msgEmailRequired: "Wprowadź e-mail odbiorcy.",
    msgEmailSending: "PDF jest wysyłany e-mailem...",
    msgEmailSent: "PDF został wysłany e-mailem.",
    tabReport: "Raport roboczy",
    photos: "Zdjęcia",
    deletePhoto2: "Usuń zdjęcie",
    tabDay: "Widok dzienny",
    tabWeek: "Widok tygodniowy",
    weekView: "Widok tygodniowy",
    noInstructionsDay: "Brak instrukcji na ten dzień.",
    noInstructionsWeek: "Brak instrukcji na ten tydzień.",
    noInstructionsMonth: "Brak instrukcji na ten miesiąc.",
    tabMonth: "Widok miesięczny",
    dayView: "Widok dzienny",
    monthView: "Widok miesięczny",
    selectDate: "Wybierz datę",
    noEntries: "Brak wpisów.",
    totalHoursMonth: "Łączne godziny w miesiącu",
    hoursPerProject: "Godziny na projekt",
    dailyEntry: "Wpis dzienny",
    saveDayEntry: "Zapisz wpis dzienny",
    week: "Tydzień",
    statusOpen: "⬜ Otwarte",
    statusInProgress: "🟡 W toku",
    statusStopped: "⛔ Zatrzymane",
    statusCompleted: "✅ Zakończone",
    problemsHints: "Problemy / uwagi",
    roleEmployee: "Pracownik",
    roleProjectManager: "Kierownik projektu",
    roleAdmin: "Administrator",
    commentLabel: "Komentarz",
    commentPlaceholder: "Wpisz komentarz...",
    commentSaveBtn: "Zapisz",
    commentSaving: "Zapisuję…",
    commentSaved: "Zapisano",
    commentErrorLabel: "Błąd",
    charsLabel: "znaków",
    copyInstruction: "Kopiuj kroki",
    copyTitle: "Przejmij kroki z instrukcji",
    copySource: "Wybierz instrukcję",
    copyWhichSteps: "Które kroki przejąć?",
    copyAllNone: "Wszystkie / Żadne",
    copyNoSteps: "Brak kroków pracy.",
    copyCancel: "Anuluj",
    copyConfirm: "Przejmij",
    copySelectSource: "Wybierz instrukcję.",
    copyDone: "Kroki pracy zostały przejęte.",
  },
};

const pdfTexts = {
  Deutsch: { title: "Regie International", company: "Regie International", report: "Bericht", calendarWeek: "Kalenderwoche", employee: "Mitarbeiter", dailyReports: "Tagesberichte", customer: "Kunde", project: "Projekt", site: "Baustelle", hours: "Stunden", startLabel: "Anfang", endLabel: "Ende", pauseLabel: "Pause", description: "Arbeitsbeschreibung", photos: "Fotos", photo: "Foto", summary: "Zusammenfassung", totalHours: "Gesamtstunden", signatureEmployee: "Unterschrift Mitarbeiter", signatureCustomer: "Unterschrift Kunde / Bauleitung", createdAt: "Erstellt am" },
  Kroatisch: { title: "Regie International", company: "Regie International", report: "Izvještaj", calendarWeek: "Kalendarski tjedan", employee: "Radnik", dailyReports: "Dnevni izvještaji", customer: "Kupac", project: "Projekt", site: "Gradilište", hours: "Sati", startLabel: "Početak", endLabel: "Kraj", pauseLabel: "Pauza", description: "Opis rada", photos: "Fotografije", photo: "Fotografija", summary: "Sažetak", totalHours: "Ukupno sati", signatureEmployee: "Potpis radnika", signatureCustomer: "Potpis kupca / voditelja gradilišta", createdAt: "Izrađeno dana" },
  Slowenisch: { title: "Regie International", company: "Regie International", report: "Poročilo", calendarWeek: "Koledarski teden", employee: "Zaposleni", dailyReports: "Dnevna poročila", customer: "Stranka", project: "Projekt", site: "Gradbišče", hours: "Ure", startLabel: "Začetek", endLabel: "Konec", pauseLabel: "Odmor", description: "Opis dela", photos: "Fotografije", photo: "Fotografija", summary: "Povzetek", totalHours: "Skupno število ur", signatureEmployee: "Podpis zaposlenega", signatureCustomer: "Podpis stranke / vodje gradbišča", createdAt: "Ustvarjeno dne" },
  Polnisch: { title: "Regie International", company: "Regie International", report: "Raport", calendarWeek: "Tydzień kalendarzowy", employee: "Pracownik", dailyReports: "Raporty dzienne", customer: "Klient", project: "Projekt", site: "Budowa", hours: "Godziny", startLabel: "Początek", endLabel: "Koniec", pauseLabel: "Przerwa", description: "Opis pracy", photos: "Zdjęcia", photo: "Zdjęcie", summary: "Podsumowanie", totalHours: "Łączna liczba godzin", signatureEmployee: "Podpis pracownika", signatureCustomer: "Podpis klienta / kierownika budowy", createdAt: "Utworzono dnia" },
  Englisch: { title: "Regie International", company: "Regie International", report: "Report", calendarWeek: "Calendar week", employee: "Employee", dailyReports: "Daily reports", customer: "Customer", project: "Project", site: "Site", hours: "Hours", startLabel: "Start", endLabel: "End", pauseLabel: "Break", description: "Work description", photos: "Photos", photo: "Photo", summary: "Summary", totalHours: "Total hours", signatureEmployee: "Employee signature", signatureCustomer: "Customer / Site manager signature", createdAt: "Created on" },
};

function createEmptyDays(): DayEntry[] {
  return weekdays.map((day) => ({ weekday: day, date: "", customer: "", projectNumber: "", site: "", startTime: "", endTime: "", breakMinutes: "", hours: "", description: "", translation: "", photos: [] }));
}

// Bricht ein hängendes Promise nach ms Millisekunden mit Fehler ab (verhindert "ewiges Laden")
function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

// Bild im Browser verkleinern + als JPEG (Qualitaet 0.8) neu speichern, bevor es hochgeladen wird.
// Max. 1600px laengste Kante; entfernt dabei auch EXIF/GPS-Daten.
// Faellt bei Nicht-Bildern oder Fehlern auf die Originaldatei zurueck.
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });
    const maxDim = 1600;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > maxDim || height > maxDim) {
      if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
      else { width = Math.round(width * (maxDim / height)); height = maxDim; }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], baseName + ".jpg", { type: "image/jpeg" });
  } catch (e) {
    return file;
  }
}
// Ersetzt Emojis und Sonderlinien fuer das PDF durch klare Zeichen,
// weil die PDF-Standardschrift keine Emojis darstellen kann.
function sanitizePdfText(s: string): string {
  if (!s) return s;
  return s
    .replace(/⬜/g, "[ ]")
    .replace(/🟡/g, "[~]")
    .replace(/⛔/g, "[X]")
    .replace(/✅/g, "[v]")
    .replace(/📋/g, "")
    .replace(/📝/g, "")
    .replace(/💬/g, "")
    .replace(/⚠️/g, "")
    .replace(/⚠/g, "")
    .replace(/️/g, "")
    .replace(/─/g, "-");
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

function TabButton({ label, tabName, activeTab, onClick }: { label: string; tabName: string; activeTab: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`px-4 py-2 rounded font-medium transition-colors ${activeTab === tabName ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>
      {label}
    </button>
  );
}

function getAllowedLanguages(companyFeatures: any): string[] {
  if (!companyFeatures) return ["Deutsch"]; // Kein Features = nur Deutsch
  const raw = companyFeatures?.allowed_languages;
  if (!raw) return ["Deutsch"];
  if (Array.isArray(raw)) return raw.length > 0 ? raw : ["Deutsch"];
  try { const parsed = JSON.parse(raw); return parsed.length > 0 ? parsed : ["Deutsch"]; } catch { return ["Deutsch"]; }
}

function SignaturePad({ label, value, onChange }: { label: string; value: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  useEffect(() => {
    if (value === "") {
      const c = canvasRef.current; const ctx = c ? c.getContext("2d") : null;
      if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
      hasDrawn.current = false;
    }
  }, [value]);
  function getCtx() { const c = canvasRef.current; return c ? c.getContext("2d") : null; }
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!; const rect = c.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (c.width / rect.width), y: (e.clientY - rect.top) * (c.height / rect.height) };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault(); const ctx = getCtx(); if (!ctx) return;
    drawing.current = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y);
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch {}
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return; e.preventDefault(); const ctx = getCtx(); if (!ctx) return;
    const { x, y } = pos(e); ctx.lineTo(x, y); ctx.strokeStyle = "#111827"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); hasDrawn.current = true;
  }
  function end() {
    if (!drawing.current) return; drawing.current = false;
    if (hasDrawn.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  }
  function clear() {
    const c = canvasRef.current; const ctx = getCtx();
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    hasDrawn.current = false; onChange("");
  }
  return (
    <div className="border rounded p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}{value ? <span className="text-xs text-green-600 ml-2">✓ erfasst</span> : null}</span>
        <button type="button" onClick={clear} className="text-xs text-red-600 underline">Löschen</button>
      </div>
      <canvas ref={canvasRef} width={500} height={150} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} className="w-full border rounded bg-gray-50" style={{ touchAction: "none" }} />
    </div>
  );
}

export default function Home() {
  const [uiLanguage, setUiLanguage] = useState<Language>("Deutsch");
  const t = texts[uiLanguage];
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [companyBlocked, setCompanyBlocked] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isUsernameLogin, setIsUsernameLogin] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [employee, setEmployee] = useState("");
  const [reportName, setReportName] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [sigEmployee, setSigEmployee] = useState("");
  const [sigCustomer, setSigCustomer] = useState("");
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
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("employee");
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [taskComments, setTaskComments] = useState<Record<string, string>>({});
  const [commentSaveState, setCommentSaveState] = useState<Record<string, string>>({});
  const [reportInstruction, setReportInstruction] = useState<any>(null);
  const [instructionProblems, setInstructionProblems] = useState("");
  const [instructionTitle, setInstructionTitle] = useState("");
  const [instructionProject, setInstructionProject] = useState("");
  const [instructionCustomer, setInstructionCustomer] = useState("");
  const [instructionSite, setInstructionSite] = useState("");
  const [instructionDescription, setInstructionDescription] = useState("");
  const [instructionTasks, setInstructionTasks] = useState<string[]>([""]);
  const [instructionPhotos, setInstructionPhotos] = useState<string[]>([]);
  const [instructionTaskPhotos, setInstructionTaskPhotos] = useState<Record<number, string[]>>({});
  const [instructionTaskStatuses, setInstructionTaskStatuses] = useState<Record<number, string>>({});
  const [workInstructions, setWorkInstructions] = useState<any[]>([]);
  const [instructionTranslations, setInstructionTranslations] = useState<Record<string, any>>({});
  const [translatingInstructionId, setTranslatingInstructionId] = useState<string | null>(null);
  const [instructionToLanguage, setInstructionToLanguage] = useState("Polnisch");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [projects, setProjects] = useState<any[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectCustomer, setProjectCustomer] = useState("");
  const [projectSite, setProjectSite] = useState("");
  const [projectManager, setProjectManager] = useState("");
  const [pmEdits, setPmEdits] = useState<Record<string, string>>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProjectDetailId, setSelectedProjectDetailId] = useState("");
  const [instructionDate, setInstructionDate] = useState("");
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [selectedDayDate, setSelectedDayDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split("T")[0]);
  // ── NEU: Kopier-Dialog für Arbeitsanweisungen ──
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyModalInstruction, setCopyModalInstruction] = useState<any>(null);
  const [copySelectedTaskIds, setCopySelectedTaskIds] = useState<string[]>([]);
  // ── Aufklappbare Karten (Tagesansicht) und Tage (Regiebericht) ──
  const [openDayCards, setOpenDayCards] = useState<Record<string, boolean>>({});
  const [openReportDays, setOpenReportDays] = useState<Record<string, boolean>>({});
  const [openWeekDays, setOpenWeekDays] = useState<Record<string, boolean>>({});
  const [reportExpanded, setReportExpanded] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) {
        const { data: pwCheck } = await supabase.from("company_users").select("must_change_password").eq("user_id", data.user.id).maybeSingle();
        if (pwCheck?.must_change_password === true) { setMustChangePassword(true); return; }
        await loadCompanyContext(data.user.id);
        await loadReportsFromDatabase();
        await loadCompanySettings(data.user.id);
      }
    }
    loadUser();
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        const { data: pwCheck } = await supabase.from("company_users").select("must_change_password").eq("user_id", session.user.id).maybeSingle();
        if (pwCheck?.must_change_password === true) { setMustChangePassword(true); return; }
        loadCompanyContext(session.user.id);
        loadReportsFromDatabase();
        // loadCompanySettings NICHT hier aufrufen - wird nur einmal in loadUser aufgerufen
      }
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  // Übersetzt Kommentare automatisch in die Anzeige-Sprache.
  // Reagiert auf die Sprache UND auf den Inhalt der Kommentare (Signatur),
  // damit es auch direkt beim ersten Laden greift – ohne Seiten-Neuladen.
  const commentSignature = workInstructions
    .map((i: any) => `${i.id}.${(i.title || "").length}.${(i.problems_text || "").length}.${(i.work_instruction_tasks || []).map((task: any) => `${task.id}:${(task.task_text || "").length}:${(task.employee_comment || "").length}`).join(",")}`)
    .join("|");
  useEffect(() => {
    if (workInstructions.length > 0) {
      refreshCommentTranslations(uiLanguage, workInstructions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentSignature, uiLanguage]);

  async function signUp() {
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setMessage(t.msgRegisterFail + error.message); return; }
    setMessage(t.msgRegisterOk);
  }

  const [companySlug, setCompanySlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function signIn() {
    setMessage("");
    let loginEmail = "";
    if (email.includes("@")) {
      // Direkte E-Mail (für Owner/Admin)
      loginEmail = email;
    } else {
      // Firmenkürzel + Benutzername
      if (!companySlug.trim()) { setMessage("Bitte Firmenkürzel eingeben."); return; }
      loginEmail = `${companySlug.toLowerCase().trim()}.${username.toLowerCase().trim()}@regie-internal.app`;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) { setMessage(t.msgLoginFail + error.message); return; }
    setMessage(t.msgLoginOk);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); newReport(); setSavedReports([]); setMessage(t.msgLogout);
  }

  async function loadCompanyContext(userId: string) {
    const { data: companyUser, error } = await supabase.from("company_users").select("company_id, role").eq("user_id", userId).maybeSingle();
    if (error) { setMessage("Fehler beim Laden der Firma: " + error.message); return; }
    if (!companyUser) { return; } // Kein Onboarding hier – wird in loadCompanySettings entschieden
    const { data: companyData, error: companyError } = await supabase.from("companies").select("id, name, slug, status").eq("id", companyUser.company_id).single();
    if (companyError) { setMessage("Fehler beim Laden der Firmendaten: " + companyError.message); return; }
    setCompanyBlocked((companyData.status || "active") !== "active");
    const company: CurrentCompany = { company_id: companyUser.company_id, role: companyUser.role, companies: { id: companyData.id, name: companyData.name, slug: companyData.slug || "" } };
    setCurrentCompany(company);
    const { data: features } = await supabase.from("company_features").select("*").eq("company_id", companyUser.company_id).maybeSingle();
    if (features) {
      setCompanyFeatures(features as CompanyFeatures);
      const allowed = Array.isArray(features.allowed_languages) ? features.allowed_languages : (typeof features.allowed_languages === "string" ? JSON.parse(features.allowed_languages) : []);
      const firstTarget = allowed.filter((l: string) => l !== "Deutsch")[0];
      if (firstTarget) { setInstructionToLanguage(firstTarget); setToLanguage(firstTarget); }
    }
    await loadCompanyUsers(companyUser.company_id);
    await loadWorkInstructions(companyUser.company_id);
    await loadProjects(companyUser.company_id);
  }

  async function loadWorkInstructions(companyId: string) {
    const { data, error } = await supabase.from("work_instructions").select(`*, work_instruction_tasks (*)`).eq("company_id", companyId).order("created_at", { ascending: false });
    if (error) { setMessage("Fehler beim Laden der Arbeitsanweisungen: " + error.message); return; }
    setWorkInstructions(data || []);
    // Kommentare in die aktuelle Anzeige-Sprache übersetzen (z. B. Kroatisch -> Deutsch für den Owner)
    refreshCommentTranslations(uiLanguage, data || []);
  }

  async function updateTaskComment(taskId: string, comment: string) {
    setCommentSaveState(prev => ({ ...prev, [taskId]: "saving" }));
    try {
      // Anmelde-Token holen, damit die Server-Route den Aufrufer prüfen kann
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      // Speichern über Server-Route (Service-Role-Key) -> umgeht RLS, prüft aber Anmeldung + Rolle.
      const res = await withTimeout(
        fetch("/api/update-task-comment", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ taskId, comment, lang: uiLanguage }),
        }),
        15000,
        "Zeitüberschreitung beim Speichern (15s). Bitte erneut versuchen."
      );
      const data = await res.json();
      if (!res.ok || data?.error) {
        const msg = data?.error || `HTTP ${res.status}`;
        setCommentSaveState(prev => ({ ...prev, [taskId]: "error:" + msg }));
        setMessage("Fehler beim Speichern des Kommentars: " + msg);
        return;
      }
      setCommentSaveState(prev => ({ ...prev, [taskId]: "saved" }));
      setMessage("✅ Kommentar gespeichert.");
      // Sofort in die Anzeige-Sprache übersetzen, damit es ohne Neuladen erscheint
      const instructionId = workInstructions.find(i => (i.work_instruction_tasks || []).some((tk: any) => tk.id === taskId))?.id;
      let translated = "";
      try {
        const tr = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: comment, fromLanguage: "automatisch", toLanguage: uiLanguage }) });
        const trData = await tr.json();
        if (!trData.error && trData.translation) translated = trData.translation;
      } catch { /* Übersetzung übersprungen */ }
      if (instructionId && translated) {
        setInstructionTranslations(prev => ({
          ...prev,
          [instructionId]: { ...prev[instructionId], language: uiLanguage, tasks: { ...prev[instructionId]?.tasks, [`comment_${taskId}`]: translated } },
        }));
        // Eingabefeld auf die Übersetzung umstellen
        setTaskComments(prev => { const n = { ...prev }; delete n[taskId]; return n; });
      } else {
        setTaskComments(prev => ({ ...prev, [taskId]: comment }));
      }
    } catch (err: any) {
      setCommentSaveState(prev => ({ ...prev, [taskId]: "error:" + String(err?.message || err) }));
      setMessage("Fehler beim Speichern: " + String(err?.message || err));
      return;
    }
    // Neu laden + Kommentare in die Anzeige-Sprache übersetzen
    try { if (currentCompany) await loadWorkInstructions(currentCompany.company_id); } catch { /* ignorieren */ }
  }

  async function updateTaskNote(taskId: string, note: string) {
    const { error } = await supabase.from("work_instruction_tasks").update({ note }).eq("id", taskId);
    if (error) { setMessage("Fehler beim Speichern der Rückmeldung: " + error.message); return; }
    if (currentCompany) await loadWorkInstructions(currentCompany.company_id);
    setMessage(t.msgFeedbackSaved);
  }

  async function loadCompanyUsers(companyId: string) {
    const { data, error } = await supabase.from("company_users").select("*").eq("company_id", companyId).order("created_at", { ascending: true });
    if (error) { setMessage("Fehler beim Laden der Mitarbeiter: " + error.message); return; }
    setCompanyUsers(data || []);
  }

  async function addCompanyUser() {
    if (!currentCompany) return;
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPassword.trim()) { setMessage("Bitte alle Pflichtfelder ausfüllen."); return; }
    setCreatingEmployee(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || "";
    const res = await fetch("/api/create-employee", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ username: newUserUsername, password: newUserPassword, fullName: newUserName, role: newUserRole, companyId: currentCompany.company_id, companySlug: currentCompany.companies.slug }) });
    const data = await res.json();
    setCreatingEmployee(false);
    if (data.error) { setMessage("Fehler: " + data.error); return; }
    setNewUserName(""); setNewUserEmail(""); setNewUserUsername(""); setNewUserPassword(""); setNewUserRole("employee");
    await loadCompanyUsers(currentCompany.company_id);
    setMessage(`✅ Mitarbeiter angelegt. Login: ${data.email}`);
  }

  async function deleteCompanyUser(memberId: string, memberUserId: string) {
    if (!currentCompany) return;
    if (!window.confirm("Mitarbeiter wirklich löschen?")) return;
    // Löschen läuft komplett über die abgesicherte Route (prüft Anmeldung, Firma, Rolle)
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || "";
    const res = await fetch("/api/delete-employee", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: memberUserId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      setMessage("Fehler beim Löschen: " + (data?.error || `HTTP ${res.status}`));
      return;
    }
    // Direkt aus State entfernen
    setCompanyUsers(prev => prev.filter(u => u.id !== memberId));
    setMessage("Mitarbeiter wurde gelöscht.");
  }

  function canDelete(myRole: string, memberRole: string): boolean {
    if (myRole === "owner") return memberRole !== "owner";
    if (myRole === "admin") return memberRole === "employee" || memberRole === "project_manager";
    if (myRole === "project_manager") return memberRole === "employee";
    return false;
  }

  async function resetCompanyUserPassword(memberEmail: string) {
    if (!memberEmail) { setMessage("Keine E-Mail-Adresse vorhanden."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(memberEmail, { redirectTo: "https://international-regie.vercel.app" });
    if (error) { setMessage("Fehler beim Passwort-Reset: " + error.message); return; }
    setMessage(t.msgPasswordReset);
  }

  async function loadReportsFromDatabase() {
    const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
    if (error) { setMessage("Fehler beim Laden: " + error.message); return; }
    setSavedReports((data || []) as SavedReport[]);
  }

  function updateDay(index: number, field: keyof DayEntry, value: string) {
    const copy = [...days]; copy[index] = { ...copy[index], [field]: value }; setDays(copy);
  }

  // Stunden aus Anfang/Ende/Pause berechnen (inkl. Schicht ueber Mitternacht).
  function computeDayHours(start: string, end: string, breakMin: string): string {
    if (!start || !end) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return "";
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    mins -= Number(breakMin) || 0;
    if (mins < 0) mins = 0;
    return (Math.round((mins / 60) * 100) / 100).toString().replace(".", ",");
  }

  function updateDayTime(index: number, field: "startTime" | "endTime" | "breakMinutes", value: string) {
    const copy = [...days];
    const d: any = { ...copy[index], [field]: value };
    const computed = computeDayHours(d.startTime, d.endTime, d.breakMinutes);
    if (computed !== "") d.hours = computed;
    copy[index] = d;
    setDays(copy);
  }

  async function handleInstructionPhotos(files: FileList | null) {
    if (!files || !user) return;
    const existing = instructionPhotos.length;
    const limit = companyFeatures?.max_photos ?? 2;
    if (limit > 0 && existing >= limit) { setMessage(t.msgPhotoLimit.replace("{n}", String(limit))); return; }
    const selected = limit > 0 ? Array.from(files).slice(0, limit - existing) : Array.from(files);
    const dropped = Array.from(files).length - selected.length;
    setMessage(t.msgPhotoUploading);
    const uploaded: string[] = [];
    for (const original of selected) {
      const file = await compressImage(original);
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user.id}/instructions/${fileName}`;
      const { error } = await supabase.storage.from("report-photos").upload(filePath, file);
      if (error) { setMessage(t.msgPhotoErr + error.message); return; }
      const { data } = supabase.storage.from("report-photos").getPublicUrl(filePath);
      uploaded.push(data.publicUrl);
    }
    setInstructionPhotos((prev) => [...prev, ...uploaded]);
    setMessage(dropped > 0 ? t.msgPhotoLimit.replace("{n}", String(limit)) : t.msgPhotoOk);
  }

  async function handleInstructionTaskPhotos(taskIndex: number, files: FileList | null) {
    if (!files || !user) return;
    const existing = (instructionTaskPhotos[taskIndex] || []).length;
    const limit = companyFeatures?.max_photos ?? 2;
    if (limit > 0 && existing >= limit) { setMessage(t.msgPhotoLimit.replace("{n}", String(limit))); return; }
    const selected = limit > 0 ? Array.from(files).slice(0, limit - existing) : Array.from(files);
    const dropped = Array.from(files).length - selected.length;
    setMessage(t.msgPhotoUploading);
    const uploaded: string[] = [];
    for (const original of selected) {
      const file = await compressImage(original);
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user.id}/instructions/tasks/${fileName}`;
      const { error } = await supabase.storage.from("report-photos").upload(filePath, file);
      if (error) { setMessage(t.msgPhotoErr + error.message); return; }
      const { data } = supabase.storage.from("report-photos").getPublicUrl(filePath);
      uploaded.push(data.publicUrl);
    }
    setInstructionTaskPhotos((prev) => ({ ...prev, [taskIndex]: [...(prev[taskIndex] || []), ...uploaded] }));
    setMessage(dropped > 0 ? t.msgPhotoLimit.replace("{n}", String(limit)) : t.msgPhotoOk);
  }

  function getTranslated(instructionId: string, field: string, fallback: string): string {
    const trans = instructionTranslations[instructionId];
    if (trans && trans.language === uiLanguage && trans[field]) return trans[field];
    return fallback;
  }

  function getTranslatedComment(instructionId: string, taskId: string, fallback: string): string {
    const trans = instructionTranslations[instructionId];
    if (trans && trans.language === uiLanguage && trans.tasks?.[`comment_${taskId}`]) return trans.tasks[`comment_${taskId}`];
    return fallback;
  }

  function getTranslatedTask(instructionId: string, taskId: string, fallback: string): string {
    const trans = instructionTranslations[instructionId];
    if (trans && trans.language === uiLanguage && trans.tasks?.[taskId]) return trans.tasks[taskId];
    return fallback;
  }

  // Übersetzt mehrere Texte PARALLEL (statt nacheinander) -> deutlich schneller.
  async function translateBatch(items: { key: string; text: string }[], fromLanguage: string, toLanguage: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    await Promise.all(items.map(async (item) => {
      if (!item.text || !item.text.trim()) return;
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: item.text, fromLanguage, toLanguage }) });
        const data = await res.json();
        result[item.key] = data.error ? item.text : data.translation;
      } catch { result[item.key] = item.text; }
    }));
    return result;
  }

  // Kommentare in die Anzeige-Sprache übersetzen.
  // Übersetzt JEDEN Kommentar in die Sprache des Betrachters – mit Auto-Spracherkennung,
  // damit es auch funktioniert, wenn comment_lang fehlt oder falsch gespeichert wurde.
  async function refreshCommentTranslations(targetLang: string, instructions: any[]) {
    // Sammelt ALLE zu übersetzenden Texte (Titel, Probleme, Beschreibung, Arbeitsschritte, Kommentare)
    // und übersetzt sie PARALLEL in die Anzeige-Sprache – mit automatischer Spracherkennung.
    type Job = { instId: string; storeKey: string; inTasks: boolean; text: string; sourceLang: string };
    const jobs: Job[] = [];
    for (const inst of instructions) {
      const existing = instructionTranslations[inst.id];
      const sameLang = existing?.language === targetLang;
      // Felder der Anweisung
      const fields: { key: string; text: string }[] = [
        { key: "title", text: inst.title || "" },
        { key: "problems_text", text: inst.problems_text || "" },
        { key: "description", text: inst.description || "" },
      ];
      for (const f of fields) {
        if (!f.text.trim()) continue;
        if (sameLang && existing?.[f.key]) continue; // schon übersetzt
        jobs.push({ instId: inst.id, storeKey: f.key, inTasks: false, text: f.text, sourceLang: "automatisch" });
      }
      // Arbeitsschritte + Kommentare
      for (const task of inst.work_instruction_tasks || []) {
        const taskText = (task.task_text || "").trim();
        if (taskText && !(sameLang && existing?.tasks?.[task.id])) {
          jobs.push({ instId: inst.id, storeKey: task.id, inTasks: true, text: taskText, sourceLang: "automatisch" });
        }
        const c = (task.employee_comment || "").trim();
        if (c && !(sameLang && existing?.tasks?.[`comment_${task.id}`])) {
          const declared = task.comment_lang;
          const sourceLang = declared && declared !== targetLang ? declared : "automatisch";
          jobs.push({ instId: inst.id, storeKey: `comment_${task.id}`, inTasks: true, text: c, sourceLang });
        }
      }
    }
    if (jobs.length === 0) return;
    const fieldUpdates: Record<string, Record<string, string>> = {};
    const taskUpdates: Record<string, Record<string, string>> = {};
    // PARALLEL übersetzen (statt nacheinander)
    await Promise.all(jobs.map(async (job) => {
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: job.text, fromLanguage: job.sourceLang, toLanguage: targetLang }) });
        const data = await res.json();
        if (!data.error && data.translation) {
          if (job.inTasks) {
            if (!taskUpdates[job.instId]) taskUpdates[job.instId] = {};
            taskUpdates[job.instId][job.storeKey] = data.translation;
          } else {
            if (!fieldUpdates[job.instId]) fieldUpdates[job.instId] = {};
            fieldUpdates[job.instId][job.storeKey] = data.translation;
          }
        }
      } catch { /* Übersetzung übersprungen */ }
    }));
    const ids = new Set([...Object.keys(fieldUpdates), ...Object.keys(taskUpdates)]);
    if (ids.size > 0) {
      setInstructionTranslations((prev) => {
        const next: Record<string, any> = { ...prev };
        for (const id of ids) {
          next[id] = {
            ...next[id],
            ...(fieldUpdates[id] || {}),
            language: targetLang,
            tasks: { ...next[id]?.tasks, ...(taskUpdates[id] || {}) },
          };
        }
        return next;
      });
    }
  }

  async function saveWorkInstruction() {
    setMessage(t.msgSaving);
    if (!currentCompany) { setMessage(t.msgNoFirm); return; }
    if (!instructionTitle.trim()) { setMessage(t.msgNoTitle); return; }
    const { data: instruction, error } = await supabase.from("work_instructions").insert({ company_id: currentCompany.company_id, project_id: selectedProjectId || null, work_date: instructionDate || null, created_by: user?.id, assigned_user_ids: assignedUserIds, title: instructionTitle, project: instructionProject, customer: instructionCustomer, site: instructionSite, description: instructionDescription, problems_text: instructionProblems, photos: instructionPhotos }).select().single();
    if (error) { setMessage("Fehler: " + error.message); return; }
    const taskRows = instructionTasks
      .map((task, originalIndex) => ({ task, originalIndex }))
      .filter((entry) => entry.task.trim() !== "")
      .map((entry, sortOrder) => ({
        work_instruction_id: instruction.id,
        task_text: entry.task,
        sort_order: sortOrder,
        photos: instructionTaskPhotos[entry.originalIndex] || [],
        status: instructionTaskStatuses[entry.originalIndex] || "open",
      }));
    if (taskRows.length > 0) {
      const { error: taskError } = await supabase.from("work_instruction_tasks").insert(taskRows);
      if (taskError) { setMessage("Arbeitsanweisung gespeichert, aber Schritte nicht: " + taskError.message); return; }
    }
    setInstructionTitle(""); setInstructionProject(""); setInstructionCustomer(""); setInstructionSite(""); setInstructionDescription(""); setInstructionTasks([""]); setInstructionProblems(""); setInstructionPhotos([]); setInstructionTaskPhotos({}); setInstructionTaskStatuses({}); setAssignedUserIds([]);
    await loadWorkInstructions(currentCompany.company_id);
    setMessage(t.msgInstructionSaved);
  }

  async function deleteWorkInstruction(id: string) {
    if (!currentCompany) return;
    const { error } = await supabase.from("work_instructions").delete().eq("id", id);
    if (error) { setMessage("Fehler beim Löschen: " + error.message); return; }
    await loadWorkInstructions(currentCompany.company_id);
    setMessage(t.msgInstructionDeleted);
  }

  // ── NEU: Kopier-Dialog öffnen (im "Neue Arbeitsanweisung"-Formular) ──
  function openCopyModal() {
    setCopyModalInstruction(null);
    setCopySelectedTaskIds([]);
    setCopyModalOpen(true);
  }

  // Quelle (bestehende Anweisung) im Dialog auswählen – alle Schritte vorauswählen
  function selectCopySource(instructionId: string) {
    const src = workInstructions.find((i) => i.id === instructionId) || null;
    setCopyModalInstruction(src);
    setCopySelectedTaskIds(src ? (src.work_instruction_tasks || []).map((task: any) => task.id) : []);
  }

  // ── NEU: ausgewählte Arbeitsschritte (inkl. Status) in das "Neue Arbeitsanweisung"-Formular übernehmen ──
  function applyCopiedSteps() {
    if (!copyModalInstruction) { setMessage(t.copySelectSource); return; }
    const tasks = (copyModalInstruction.work_instruction_tasks || [])
      .filter((task: any) => copySelectedTaskIds.includes(task.id))
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .filter((task: any) => (task.task_text || "").trim() !== "");
    if (tasks.length === 0) { setMessage(t.copyNoSteps); return; }
    // Bestehende (nicht-leere) Schritte behalten, kopierte anhängen
    const existing = instructionTasks.filter((x) => x.trim() !== "");
    const startIndex = existing.length;
    const newStatuses = { ...instructionTaskStatuses };
    tasks.forEach((task: any, i: number) => { newStatuses[startIndex + i] = task.status || "open"; });
    setInstructionTasks([...existing, ...tasks.map((task: any) => task.task_text)]);
    setInstructionTaskStatuses(newStatuses);
    setCopyModalOpen(false);
    setCopyModalInstruction(null);
    setCopySelectedTaskIds([]);
    setMessage("✅ " + t.copyDone);
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

  // Sichtbarkeit einer Arbeitsanweisung je nach Rolle:
  // owner/admin sehen alles; employee nur zugewiesene; project_manager zugewiesene ODER selbst erstellte.
  function canSeeInstruction(i: any): boolean {
    const role = currentCompany?.role;
    if (role === "owner" || role === "admin") return true;
    if (role === "employee") return (i.assigned_user_ids || []).includes(user?.id);
    if (role === "project_manager") return (i.assigned_user_ids || []).includes(user?.id) || i.created_by === user?.id;
    return true;
  }
  function parseHours(value: string) { return Number(value.replace(",", ".")) || 0; }
  const totalHours = days.reduce((sum, day) => sum + parseHours(day.hours), 0);
  const projectTotals = days.reduce<Record<string, number>>((acc, day) => {
    if (!day.projectNumber) return acc;
    acc[day.projectNumber] = (acc[day.projectNumber] || 0) + parseHours(day.hours);
    return acc;
  }, {});

  async function handlePhotos(index: number, files: FileList | null) {
    if (!files || !user) return;
    const existing = days[index]?.photos?.length || 0;
    const limit = companyFeatures?.max_photos ?? 2;
    if (limit > 0 && existing >= limit) { setMessage(t.msgPhotoLimit.replace("{n}", String(limit))); return; }
    const selected = limit > 0 ? Array.from(files).slice(0, limit - existing) : Array.from(files);
    const dropped = Array.from(files).length - selected.length;
    setMessage(t.msgPhotoUploading);
    for (const original of selected) {
      const file = await compressImage(original);
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user.id}/${calendarWeek || "ohne-kw"}/${fileName}`;
      const { error } = await supabase.storage.from("report-photos").upload(filePath, file);
      if (error) { setMessage(t.msgPhotoErr + error.message); return; }
      const { data } = supabase.storage.from("report-photos").getPublicUrl(filePath);
      const copy = [...days]; copy[index] = { ...copy[index], photos: [...copy[index].photos, data.publicUrl] }; setDays(copy);
    }
    setMessage(dropped > 0 ? t.msgPhotoLimit.replace("{n}", String(limit)) : t.msgPhotoOk);
  }

  function deletePhoto(dayIndex: number, photoIndex: number) {
    const copy = [...days]; copy[dayIndex] = { ...copy[dayIndex], photos: copy[dayIndex].photos.filter((_, index) => index !== photoIndex) }; setDays(copy);
  }

  // ── FIXED: Onboarding nur für Owner, Settings über owner in company_users ──
  async function loadCompanySettings(userId: string) {
    const { data: companyUser } = await supabase.from("company_users").select("company_id, role").eq("user_id", userId).maybeSingle();
    
    // Kein Eintrag = selbst registriert ohne Firma = Onboarding zeigen
    if (!companyUser?.company_id) {
      setShowOnboarding(true);
      return;
    }

    // Hat Firma = kein Onboarding
    setShowOnboarding(false);

    const { data: ownerUser } = await supabase.from("company_users").select("user_id").eq("company_id", companyUser.company_id).eq("role", "owner").maybeSingle();
    const ownerUserId = ownerUser?.user_id || userId;
    const { data } = await supabase.from("company_settings").select("*").eq("user_id", ownerUserId).single();
    const settings = data || { user_id: ownerUserId, company_name: "", company_logo: "", street: "", zip_code: "", city: "", phone: "", email: "", website: "", tax_number: "" };
    setCompanySettings(settings);
  }

  async function saveCompanySettings() {
    if (!user || !companySettings) return;
    const { error } = await supabase.from("company_settings").upsert({ ...companySettings, user_id: user.id }, { onConflict: "user_id" });
    if (error) { setMessage("Fehler beim Speichern der Firmendaten: " + error.message); return; }
    setMessage(t.msgCompanySaved);
  }

  function updateCompanyField(field: keyof CompanySettings, value: string) {
    if (!user) return;
    setCompanySettings((current) => ({ user_id: user.id, company_name: current?.company_name || "", ...current, [field]: value }));
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
    const reportData = { report_name: name, employee, from_language: fromLanguage, to_language: toLanguage, pdf_language: pdfLanguage, days, user_id: user.id, project_id: selectedProjectId || null };
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
    setMessage(currentReportId ? t.msgUpdated : t.msgSaved);
    await loadReportsFromDatabase();
  }

  function loadReport(report: SavedReport) {
    setCurrentReportId(report.id); setReportName(report.report_name); setEmployee(report.employee || "");
    setFromLanguage(report.from_language || "Deutsch"); setToLanguage(report.to_language || "Polnisch");
    setPdfLanguage(report.pdf_language || "Deutsch"); setDays(report.days || createEmptyDays());
    setMessage(t.msgLoaded); setActiveTab("regiebericht");
  }

  async function deleteReport(id: string) {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) { setMessage("Fehler beim Löschen: " + error.message); return; }
    if (currentReportId === id) newReport();
    setMessage(t.msgDeleted); await loadReportsFromDatabase();
  }

  function newReport() {
    setCurrentReportId(null); setReportName(""); setEmployee(""); setEmailTo(""); setSigEmployee(""); setSigCustomer("");
    setFromLanguage("Deutsch"); setToLanguage("Polnisch"); setPdfLanguage("Deutsch"); setDays(createEmptyDays());
  }

  async function loadProjects(companyId?: string) {
    const id = companyId ?? currentCompany?.company_id;
    if (!id) return;
    const { data, error } = await supabase.from("projects").select("*").eq("company_id", id).order("created_at", { ascending: false });
    if (error) { setMessage("Fehler beim Laden der Projekte: " + error.message); return; }
    setProjects(data || []);
  }

  async function saveProject() {
    if (!currentCompany) return;
    const { error } = await supabase.from("projects").insert({ company_id: currentCompany.company_id, name: projectName, customer: projectCustomer, site: projectSite, project_manager: projectManager });
    if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    setProjectName(""); setProjectCustomer(""); setProjectSite(""); setProjectManager("");
    await loadProjects(); setMessage(t.msgProjectSaved);
  }

  async function updateProjectManager(projectId: string, newPm: string) {
    const project = projects.find((p: any) => p.id === projectId);
    if (!project) return;
    if ((project.project_manager || "") === (newPm || "")) { setMessage("Projektleiter unverändert."); return; }
    const { error } = await supabase.from("projects").update({ project_manager: newPm }).eq("id", projectId);
    if (error) { setMessage("Fehler beim Ändern des Projektleiters: " + error.message); return; }
    await loadProjects(); setMessage("Projektleiter geändert.");
  }

  // Neuen Projektleiter (additiv) allen Anweisungen des Projekts zuweisen, damit er sie sieht.
  async function assignPmToProjectInstructions(projectId: string, pmName: string) {
    if (!currentCompany) return;
    const member = companyUsers.find((m: any) => m.role === "project_manager" && (m.full_name || m.email) === pmName);
    if (!member) { setMessage("Kein Projektleiter mit diesem Namen in der Mitarbeiterliste gefunden – Sichtbarkeit kann nicht übertragen werden."); return; }
    const newId = member.user_id;
    const { data: insts, error: loadErr } = await supabase.from("work_instructions").select("id, assigned_user_ids").eq("project_id", projectId);
    if (loadErr) { setMessage("Fehler beim Laden der Anweisungen: " + loadErr.message); return; }
    if (!insts || insts.length === 0) { setMessage("Dieses Projekt hat noch keine Anweisungen."); return; }
    if (!window.confirm(`${pmName} allen ${insts.length} Anweisung(en) dieses Projekts zuweisen (Sichtbarkeit)?`)) return;
    let changed = 0;
    for (const inst of insts as any[]) {
      const current: string[] = inst.assigned_user_ids || [];
      if (current.includes(newId)) continue;
      const { error: upErr } = await supabase.from("work_instructions").update({ assigned_user_ids: [...current, newId] }).eq("id", inst.id);
      if (upErr) { setMessage("Fehler beim Zuweisen: " + upErr.message); return; }
      changed++;
    }
    await loadWorkInstructions(currentCompany.company_id);
    setMessage(`Sichtbarkeit übertragen: ${pmName} wurde ${changed} Anweisung(en) zugewiesen.`);
  }

  async function deleteProject(id: string) {
    if (!currentCompany) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { setMessage("Fehler beim Löschen des Projekts: " + error.message); return; }
    if (selectedProjectDetailId === id) setSelectedProjectDetailId("");
    await loadProjects(); setMessage(t.msgProjectDeleted);
  }

  async function updateTaskStatus(taskId: string, status: string) {
    const { error } = await supabase.from("work_instruction_tasks").update({ status }).eq("id", taskId);
    if (error) { setMessage("Fehler beim Speichern des Status."); return; }
    if (currentCompany) await loadWorkInstructions(currentCompany.company_id);
  }

  async function translateAll() {
    setMessage("");
    if (!employee.trim()) { setMessage(t.msgNoEmployee); return; }
    setLoading(true);
    const translatedDays = [...days];
    try {
      for (let i = 0; i < translatedDays.length; i++) {
        const day = translatedDays[i];
        if (!day.description.trim()) continue;
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hours: day.hours, description: day.description, fromLanguage, toLanguage }) });
        const data = await res.json();
        translatedDays[i].translation = data.error ? data.error : data.translation;
      }
      setDays(translatedDays); setMessage(t.msgTranslated);
    } catch (error) { setMessage(t.msgTranslateErr + String(error)); }
    setLoading(false);
  }

  async function translateInstruction(instruction: any) {
    setTranslatingInstructionId(instruction.id); setMessage("");
    try {
      // Alle Texte sammeln und PARALLEL übersetzen
      const items: { key: string; text: string }[] = [
        { key: "title", text: instruction.title || "" },
        { key: "problems_text", text: instruction.problems_text || "" },
        { key: "description", text: instruction.description || "" },
      ];
      for (const task of instruction.work_instruction_tasks || []) {
        if (task.task_text?.trim()) items.push({ key: `task_${task.id}`, text: task.task_text });
        if (task.note?.trim()) items.push({ key: `note_${task.id}`, text: task.note });
        if (task.employee_comment?.trim()) items.push({ key: `comment_${task.id}`, text: task.employee_comment });
      }
      const out = await translateBatch(items, "automatisch", instructionToLanguage);
      const translatedFields: Record<string, string> = {};
      if (out["title"]) translatedFields.title = out["title"];
      if (out["problems_text"]) translatedFields.problems_text = out["problems_text"];
      if (out["description"]) translatedFields.description = out["description"];
      const translatedTasks: Record<string, string> = {};
      for (const task of instruction.work_instruction_tasks || []) {
        if (out[`task_${task.id}`]) translatedTasks[task.id] = out[`task_${task.id}`];
        if (out[`note_${task.id}`]) translatedTasks[`note_${task.id}`] = out[`note_${task.id}`];
        if (out[`comment_${task.id}`]) translatedTasks[`comment_${task.id}`] = out[`comment_${task.id}`];
      }
      setInstructionTranslations((prev) => ({ ...prev, [instruction.id]: { ...translatedFields, tasks: translatedTasks, language: instructionToLanguage } }));
      setMessage(t.msgInstructionTranslated);
    } catch (err) { setMessage(t.msgTranslateErr + String(err)); }
    setTranslatingInstructionId(null);
  }

  async function createReportFromInstruction(instruction: any) {
    // Frisch laden damit employee_comment aktuell ist
    if (currentCompany) {
      const { data } = await supabase.from("work_instructions").select("*, work_instruction_tasks (*)").eq("id", instruction.id).single();
      if (data) instruction = data;
    }

    // Übersetzungen zusammenführen
    const currentTranslations = instructionTranslations[instruction.id] || {};
    const mergedTasks = { ...currentTranslations.tasks };
    
    // Automatisch übersetzen wenn Sprache nicht Deutsch und noch keine Übersetzung
    if (uiLanguage !== "Deutsch" && currentTranslations.language !== uiLanguage) {
      setMessage("Übersetze...");
      const targetLang = uiLanguage;
      const translatedFields: Record<string, string> = {};
      for (const item of [
        { key: "title", text: instruction.title || "" },
        { key: "problems_text", text: instruction.problems_text || "" },
      ]) {
        if (!item.text.trim()) continue;
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: item.text, fromLanguage: "Deutsch", toLanguage: targetLang }) });
        const data = await res.json();
        translatedFields[item.key] = data.error ? item.text : data.translation;
      }
      for (const task of instruction.work_instruction_tasks || []) {
        if (task.task_text?.trim()) {
          const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: task.task_text, fromLanguage: "Deutsch", toLanguage: targetLang }) });
          const data = await res.json();
          mergedTasks[task.id] = data.error ? task.task_text : data.translation;
        }
        if (task.employee_comment?.trim()) {
          const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: task.employee_comment, fromLanguage: "Deutsch", toLanguage: targetLang }) });
          const data = await res.json();
          mergedTasks[`comment_${task.id}`] = data.error ? task.employee_comment : data.translation;
        }
      }
      setInstructionTranslations(prev => ({ ...prev, [instruction.id]: { ...translatedFields, tasks: mergedTasks, language: targetLang } }));
      setMessage("");
      // Direkt die frischen Übersetzungen verwenden
      Object.assign(currentTranslations, translatedFields);
    }

    const getTaskText = (taskId: string, fallback: string) => mergedTasks[taskId] || fallback;
    const getCommentText = (taskId: string, fallback: string) => mergedTasks[`comment_${taskId}`] || fallback;
    const getTitleText = () => currentTranslations.title || instruction.title;
    const getProblemsText = () => currentTranslations.problems_text || instruction.problems_text || "";

    const currentTexts = texts[uiLanguage];
    const completedTasks = (instruction.work_instruction_tasks || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((task: any) => {
        const statusText = task.status === "completed" ? currentTexts.statusCompleted : task.status === "in_progress" ? currentTexts.statusInProgress : task.status === "stopped" ? currentTexts.statusStopped : currentTexts.statusOpen;
        const taskText = getTaskText(task.id, task.task_text);
        const lines = [`${statusText}: ${taskText}`];
        if (task.note) lines.push(`   📝 ${currentTexts.feedbackLabel}: ${task.note}`);
        if (task.employee_comment) {
          const comment = getCommentText(task.id, task.employee_comment);
          lines.push(`   💬 ${currentTexts.commentLabel}: ${comment}`);
        }
        return lines.join("\n");
      });
    const titleTranslated = getTitleText();
    const problemsTranslated = getProblemsText();
    const description = [
      titleTranslated !== instruction.title ? `📋 ${titleTranslated}` : "",
      ...completedTasks,
      problemsTranslated ? `─────\n⚠️ ${currentTexts.problemsHints}: ${problemsTranslated}` : "",
      instruction.employee_note ? `${currentTexts.feedbackLabel}: ${instruction.employee_note}` : ""
    ].filter(Boolean).join("\n─────\n");
    const copy = [...days];
    const targetDate = instruction.work_date || "";
    if (targetDate) {
      const [year, month, day] = targetDate.split("-").map(Number);
      const selectedDate = new Date(Date.UTC(year, month - 1, day));
      const dayNumber = selectedDate.getUTCDay() || 7;
      const monday = new Date(selectedDate);
      monday.setUTCDate(selectedDate.getUTCDate() - dayNumber + 1);
      for (let i = 0; i < 7; i++) { const nextDate = new Date(monday); nextDate.setUTCDate(monday.getUTCDate() + i); copy[i] = { ...copy[i], date: nextDate.toISOString().split("T")[0] }; }
    }
    const targetIndex = targetDate ? copy.findIndex((day) => day.date === targetDate) : 0;
    const indexToUse = targetIndex >= 0 ? targetIndex : 0;
    copy[indexToUse] = { ...copy[indexToUse], customer: instruction.customer || "", projectNumber: instruction.project || "", site: instruction.site || "", description, photos: [] };
    setDays(copy); setReportInstruction(instruction); setActiveTab("regiebericht"); setMessage("Regiebericht wurde aus Arbeitsanweisung vorbereitet.");
  }

  // ── FIXED: kein window.location.reload() ──
  async function changePassword() {
    if (!newPassword.trim() || newPassword.length < 6) { setMessage("Passwort muss mindestens 6 Zeichen haben."); return; }
    if (newPassword !== newPasswordConfirm) { setMessage("Passwörter stimmen nicht überein."); return; }
    setChangingPassword(true); setMessage("Speichere...");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch("/api/change-password", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: user?.id, newPassword }) });
      const data = await res.json();
      if (data.error) { setMessage("Fehler: " + data.error); setChangingPassword(false); return; }
      const { error: dbError } = await supabase.from("company_users").update({ must_change_password: false }).eq("user_id", user?.id);
      if (dbError) { setMessage("DB Fehler: " + dbError.message); setChangingPassword(false); return; }
      if (user?.email) { await supabase.auth.signInWithPassword({ email: user.email, password: newPassword }); }
      setMustChangePassword(false); setNewPassword(""); setNewPasswordConfirm(""); setMessage("✅ Passwort geändert!");
      setShowOnboarding(false); // Onboarding nie zeigen nach Passwortänderung
      if (user?.id) { await loadCompanyContext(user.id); await loadReportsFromDatabase(); }
    } catch (err) { setMessage("Unbekannter Fehler: " + String(err)); setChangingPassword(false); }
  }

  async function saveOnboarding() {
    if (!user || !companySettings) return;
    const { data: existingUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).maybeSingle();
    let companyId = existingUser?.company_id;
    if (!companyId) {
      const { data: newCompany, error: companyError } = await supabase.from("companies").insert({ name: companySettings.company_name || "Meine Firma", owner_user_id: user.id, status: "active" }).select().single();
      if (companyError) { setMessage("Fehler beim Anlegen der Firma: " + companyError.message); return; }
      companyId = newCompany.id;
      const { error: userError } = await supabase.from("company_users").insert({ company_id: companyId, user_id: user.id, email: user.email, full_name: companySettings.company_name, role: "owner" });
      if (userError) { setMessage("Fehler beim Anlegen des Benutzers: " + userError.message); return; }
      await supabase.from("company_features").insert({ company_id: companyId, package_name: "starter", max_employees: 5, max_photos: 2, module_reports: true, module_work_orders: false, module_auto_reports: false, photos_enabled: false, email_enabled: false, signature_enabled: false, ai_enabled: false, allowed_languages: ["Deutsch"] });
    }
    const { error } = await supabase.from("company_settings").upsert({ ...companySettings, user_id: user.id }, { onConflict: "user_id" });
    if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    await loadCompanyContext(user.id);
    setShowOnboarding(false); setOnboardingDone(true); setMessage("Willkommen! Ihre Firmendaten wurden gespeichert.");
  }

  async function createPDF(sendByEmail = false) {
    const p = pdfTexts[pdfLanguage as keyof typeof pdfTexts];
    const doc = new jsPDF("p", "mm", "a4");
    const FONT = "helvetica";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 15; const marginRight = 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let y = 15;
    const addFooter = () => { doc.setFontSize(8); doc.setTextColor(120); doc.text(companySettings?.company_name || currentCompany?.companies?.name || p.company, marginLeft, pageHeight - 10); doc.text(`${p.createdAt}: ${new Date().toLocaleDateString("de-DE")}`, pageWidth - marginRight, pageHeight - 10, { align: "right" }); doc.setTextColor(0); };
    const addNewPageIfNeeded = (neededHeight: number) => { if (y + neededHeight > pageHeight - 25) { addFooter(); doc.addPage(); y = 15; } };
    const qrText = `${p.title} ${calendarWeek || ""} - ${employee}`;
    const qrImage = await QRCode.toDataURL(qrText);
    let logoBase64 = "";
    if (companySettings?.company_logo) {
      try {
        const response = await fetch(companySettings.company_logo);
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob); });
      } catch (error) { console.error("Logo konnte nicht geladen werden:", error); }
    }
    doc.setFillColor(240, 240, 240); doc.rect(0, 0, pageWidth, 70, "F");
    doc.setFontSize(20); doc.setFont(FONT, "bold"); doc.text(p.title, marginLeft, y);
    doc.setFontSize(11); doc.setFont(FONT, "normal"); y += 8;
    doc.text(companySettings?.company_name || currentCompany?.companies?.name || "Regie International", marginLeft, y); y += 6;
    if (companySettings?.street) { doc.text(companySettings.street, marginLeft, y); y += 5; }
    if (companySettings?.zip_code || companySettings?.city) { doc.text(`${companySettings?.zip_code || ""} ${companySettings?.city || ""}`, marginLeft, y); y += 5; }
    if (companySettings?.phone) { doc.text(`Tel: ${companySettings.phone}`, marginLeft, y); y += 5; }
    if (companySettings?.email) { doc.text(`E-Mail: ${companySettings.email}`, marginLeft, y); y += 5; }
    if (companySettings?.website) { doc.text(`Web: ${companySettings.website}`, marginLeft, y); y += 5; }
    if (companySettings?.tax_number) { doc.text(`UID: ${companySettings.tax_number}`, marginLeft, y); y += 5; }
    y += 7;
    doc.text(`${p.report}: ${reportName || "-"}`, marginLeft, y); y += 6;
    doc.text(`${p.calendarWeek}: ${calendarWeek || "-"}`, marginLeft, y); y += 6;
    doc.text(`${p.employee}: ${employee || "-"}`, marginLeft, y);
    if (logoBase64) {
      // Logo seitenverhaeltnis-treu einpassen (max. 55 x 30 mm), rechtsbuendig oben
      const maxW = 55, maxH = 30, topY = 8, rightEdge = pageWidth - marginRight;
      let drawW = 30, drawH = 30, fmt = "PNG";
      try {
        const props: any = doc.getImageProperties(logoBase64);
        const ft = (props?.fileType || "").toUpperCase();
        fmt = (ft === "JPEG" || ft === "JPG") ? "JPEG" : "PNG";
        const ratio = (props.width || 1) / (props.height || 1);
        drawW = maxW; drawH = drawW / ratio;
        if (drawH > maxH) { drawH = maxH; drawW = drawH * ratio; }
      } catch (e) { drawW = 30; drawH = 30; fmt = "PNG"; }
      doc.addImage(logoBase64, fmt, rightEdge - drawW, topY, drawW, drawH);
    } else {
      doc.addImage(qrImage, "PNG", pageWidth - 42, 8, 28, 28);
    }
    y += 10; if (y < 75) y = 75;
    doc.setFontSize(12); doc.setFont(FONT, "bold"); doc.text(p.dailyReports, marginLeft, y); y += 8;
    for (const day of days) {
      const hasContent = day.description || day.hours || day.customer || day.projectNumber || day.site || day.photos.length > 0;
      if (!hasContent) continue;
      const descriptionText = sanitizePdfText(day.translation || day.description || "-");
      const splitDescription = doc.splitTextToSize(descriptionText, contentWidth - 8);
      const estimatedHeight = 45 + splitDescription.length * 5 + day.photos.length * 10;
      addNewPageIfNeeded(estimatedHeight);
      doc.setFillColor(230, 230, 230); doc.rect(marginLeft, y, contentWidth, 9, "F");
      doc.setFontSize(11); doc.setFont(FONT, "bold"); doc.text(`${day.weekday} - ${day.date || "-"}`, marginLeft + 3, y + 6); y += 13;
      doc.setFont(FONT, "normal"); doc.setFontSize(9);
      doc.text(`${p.customer}: ${day.customer || "-"}`, marginLeft + 3, y); doc.text(`${p.project}: ${day.projectNumber || "-"}`, marginLeft + 80, y); y += 6;
      doc.text(`${p.site}: ${day.site || "-"}`, marginLeft + 3, y); doc.text(`${p.hours}: ${day.hours || "-"}`, marginLeft + 80, y); y += 6;
      if (day.startTime || day.endTime || day.breakMinutes) { doc.text(`${p.startLabel}: ${day.startTime || "-"}   ${p.endLabel}: ${day.endTime || "-"}   ${p.pauseLabel}: ${day.breakMinutes ? day.breakMinutes + " min" : "-"}`, marginLeft + 3, y); y += 6; }
      y += 2;
      doc.setFont(FONT, "bold"); doc.text(`${p.description}:`, marginLeft + 3, y); y += 6;
      doc.setFont(FONT, "normal"); doc.text(splitDescription, marginLeft + 3, y); y += splitDescription.length * 5 + 5;
      if (day.photos.length > 0) {
        doc.setFont(FONT, "bold"); doc.text(`${p.photos}:`, marginLeft + 3, y); y += 6;
        doc.setFont(FONT, "normal"); doc.setFontSize(8);
        for (let photoIndex = 0; photoIndex < day.photos.length; photoIndex++) {
          try {
            const response = await fetch(day.photos[photoIndex]);
            const blob = await response.blob();
            const photoBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob); });
            addNewPageIfNeeded(65);
            doc.text(`${p.photo} ${photoIndex + 1}:`, marginLeft + 3, y); y += 5;
            doc.addImage(photoBase64, "JPEG", marginLeft + 3, y, 70, 50); y += 56;
          } catch (error) { doc.text(`${p.photo} ${photoIndex + 1}: konnte nicht geladen werden`, marginLeft + 3, y); y += 6; }
        }
        y += 2;
      }
      doc.setDrawColor(200); doc.line(marginLeft, y, pageWidth - marginRight, y); y += 10; doc.setDrawColor(0);
    }
    const sigW = 70; const sigH = 21;
    const anySig = !!(sigEmployee || sigCustomer);
    addNewPageIfNeeded(anySig ? 92 : 65);
    doc.setFontSize(12); doc.setFont(FONT, "bold"); doc.text(p.summary, marginLeft, y); y += 8;
    doc.setFontSize(10); doc.setFont(FONT, "normal");
    doc.text(`${p.totalHours}: ${totalHours.toString().replace(".", ",")} ${p.hours}`, marginLeft, y); y += 8;
    Object.entries(projectTotals).forEach(([project, total]) => { doc.text(`${p.project} ${project}: ${total.toString().replace(".", ",")} ${p.hours}`, marginLeft, y); y += 6; });
    y += anySig ? 30 : 18;
    if (sigEmployee) { try { doc.addImage(sigEmployee, "PNG", marginLeft, y - sigH, sigW, sigH); } catch {} }
    if (sigCustomer) { try { doc.addImage(sigCustomer, "PNG", pageWidth - marginRight - sigW, y - sigH, sigW, sigH); } catch {} }
    doc.line(marginLeft, y, marginLeft + 70, y); doc.line(pageWidth - marginRight - 70, y, pageWidth - marginRight, y);
    y += 6; doc.setFontSize(9); doc.text(p.signatureEmployee, marginLeft, y); doc.text(p.signatureCustomer, pageWidth - marginRight - 70, y);
    addFooter();
    // Dateiname: Projekt_KW_Mitarbeiter (z. B. AU2260027_KW26_Max_Mustermann.pdf)
    const illegal = (s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "");
    const projectNumbers = Array.from(new Set((days || []).map((d: any) => (d.projectNumber || "").trim()).filter(Boolean)));
    const projectPart = illegal(projectNumbers.length === 0 ? "Projekt" : projectNumbers.join("-")).replace(/\s+/g, "_");
    const kwPart = illegal(calendarWeek || "Woche").replace(/\s+/g, "");
    const employeePart = illegal(employee || "Mitarbeiter").replace(/\s+/g, "_");
    const filename = `${projectPart}_${kwPart}_${employeePart}.pdf`;
    if (sendByEmail) {
      if (!companyFeatures?.email_enabled) { setMessage("🔒 E-Mail-Versand ist in deinem Paket nicht aktiviert."); return; }
      if (!emailTo.trim()) { setMessage(t.msgEmailRequired); return; }
      setMessage(t.msgEmailSending);
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch("/api/send-report", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ to: emailTo, subject: `${p.title} ${calendarWeek || ""}`, pdfBase64, filename }) });
      const data = await res.json();
      if (data.error) { setMessage("Fehler beim E-Mail-Versand: " + data.error); return; }
      setMessage(t.msgEmailSent); return;
    }
    doc.save(filename);
  }

  if (!user) {
    return (
      <main className="max-w-xl mx-auto p-4 md:p-8 space-y-6 bg-gray-100 min-h-screen text-black">
        <section className="border rounded p-4 space-y-4 bg-white">
          <h1 className="text-3xl font-bold">{t.loginTitle}</h1>
          <select className="border p-3 w-full text-black bg-white" value={uiLanguage} onChange={(e) => setUiLanguage(e.target.value as Language)}>
            {languages.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
          </select>
          {message && <div className="border rounded p-3 bg-yellow-100 text-black">{message}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsUsernameLogin(false)} className={`flex-1 py-2 rounded font-medium ${!isUsernameLogin ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-700"}`}>📧 E-Mail</button>
            <button type="button" onClick={() => setIsUsernameLogin(true)} className={`flex-1 py-2 rounded font-medium ${isUsernameLogin ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-700"}`}>👤 Benutzername</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); signIn(); }} autoComplete="on" className="space-y-3">
          {isUsernameLogin ? (
            <div className="space-y-3">
              <input name="company" autoComplete="organization" className="border p-3 w-full text-black bg-white rounded" placeholder="Firmenkürzel (z.B. luger)" value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} />
              <input name="username" autoComplete="username" className="border p-3 w-full text-black bg-white rounded" placeholder="Benutzername (z.B. max)" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          ) : (
            <input name="email" autoComplete="email" className="border p-3 w-full text-black bg-white" placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
          <div className="relative">
            <input name="password" autoComplete="current-password" className="border p-3 w-full text-black bg-white pr-12" placeholder={t.password} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">{showPassword ? "🙈" : "👁️"}</button>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-3 rounded w-full">{t.login}</button>
          </form>
          <p className="text-center text-sm text-gray-500">Noch kein Konto? <button type="button" onClick={signUp} className="text-blue-600 underline ml-1">{t.register}</button></p>
        </section>
      </main>
    );
  }

  if (user && mustChangePassword) {
    return (
      <main className="max-w-md mx-auto p-4 md:p-8 min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border rounded-xl p-6 space-y-5 w-full shadow-lg">
          <div className="text-center"><div className="text-5xl mb-3">🔐</div><h2 className="text-2xl font-bold">Passwort ändern</h2><p className="text-gray-500 text-sm mt-1">Bitte ändern Sie Ihr temporäres Passwort.</p></div>
          {message && <div className="bg-yellow-50 border rounded p-3 text-sm">{message}</div>}
          <input className="border p-3 w-full rounded text-black" placeholder="Neues Passwort (min. 6 Zeichen)" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input className="border p-3 w-full rounded text-black" placeholder="Passwort bestätigen" type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} />
          <button type="button" onClick={changePassword} disabled={changingPassword} className="w-full bg-blue-700 text-white py-3 rounded font-bold disabled:opacity-50">{changingPassword ? "Wird gespeichert..." : "Passwort speichern & weiter"}</button>
        </div>
      </main>
    );
  }

  if (user && companyBlocked) {
    return (
      <main className="max-w-md mx-auto p-4 md:p-8 min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border rounded-xl p-6 space-y-5 w-full shadow-lg text-center">
          <div className="text-6xl mb-2">🔒</div>
          <h2 className="text-2xl font-bold text-red-700">Konto gesperrt</h2>
          <p className="text-gray-600">Dieses Firmenkonto ist derzeit gesperrt. Bitte kontaktieren Sie Ihren Anbieter, um den Zugang wieder freizuschalten.</p>
          <button type="button" onClick={signOut} className="w-full bg-gray-800 text-white py-3 rounded font-bold">Abmelden</button>
        </div>
      </main>
    );
  }

  if (user && showOnboarding && false) {
    return (
      <main className="max-w-xl mx-auto p-4 md:p-8 min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border rounded-xl p-6 space-y-6 w-full shadow-lg">
          <div className="flex items-center gap-2 mb-2">{[1, 2, 3].map((step) => (<div key={step} className={`flex-1 h-2 rounded-full ${onboardingStep >= step ? "bg-blue-600" : "bg-gray-200"}`} />))}</div>
          {onboardingStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">👋 Willkommen!</h2>
              <p className="text-gray-600">Bitte hinterlegen Sie zuerst Ihre Firmendaten.</p>
              <div className="space-y-3">
                <input className="border p-3 w-full rounded text-black" placeholder="Firmenname *" value={companySettings?.company_name || ""} onChange={(e) => updateCompanyField("company_name", e.target.value)} />
                <input className="border p-3 w-full rounded text-black" placeholder="Straße" value={companySettings?.street || ""} onChange={(e) => updateCompanyField("street", e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="border p-3 rounded text-black" placeholder="PLZ" value={companySettings?.zip_code || ""} onChange={(e) => updateCompanyField("zip_code", e.target.value)} />
                  <input className="border p-3 rounded text-black" placeholder="Ort" value={companySettings?.city || ""} onChange={(e) => updateCompanyField("city", e.target.value)} />
                </div>
              </div>
              <button type="button" onClick={() => { if (!companySettings?.company_name?.trim()) { setMessage("Bitte Firmenname eingeben."); return; } setOnboardingStep(2); }} className="w-full bg-blue-700 text-white py-3 rounded font-bold">Weiter →</button>
            </div>
          )}
          {onboardingStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">📞 Kontaktdaten</h2>
              <div className="space-y-3">
                <input className="border p-3 w-full rounded text-black" placeholder="Telefon" value={companySettings?.phone || ""} onChange={(e) => updateCompanyField("phone", e.target.value)} />
                <input className="border p-3 w-full rounded text-black" placeholder="E-Mail" value={companySettings?.email || ""} onChange={(e) => updateCompanyField("email", e.target.value)} />
                <input className="border p-3 w-full rounded text-black" placeholder="Webseite" value={companySettings?.website || ""} onChange={(e) => updateCompanyField("website", e.target.value)} />
                <input className="border p-3 w-full rounded text-black" placeholder="UID / Steuernummer" value={companySettings?.tax_number || ""} onChange={(e) => updateCompanyField("tax_number", e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setOnboardingStep(1)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded font-medium">← Zurück</button>
                <button type="button" onClick={() => setOnboardingStep(3)} className="flex-1 bg-blue-700 text-white py-3 rounded font-bold">Weiter →</button>
              </div>
            </div>
          )}
          {onboardingStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">🖼️ Firmenlogo</h2>
              <p className="text-gray-600">Optional — kann später hinzugefügt werden.</p>
              {companySettings?.company_logo && (<img src={companySettings?.company_logo} alt="Logo" className="h-20 object-contain border rounded p-2" />)}
              <input type="file" accept="image/*" className="border p-3 w-full rounded text-black bg-white" onChange={(e) => uploadCompanyLogo(e.target.files)} />
              {message && <div className="bg-yellow-50 border rounded p-3 text-sm">{message}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setOnboardingStep(2)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded font-medium">← Zurück</button>
                <button type="button" onClick={saveOnboarding} className="flex-1 bg-green-700 text-white py-3 rounded font-bold">✅ Speichern & Starten</button>
              </div>
              <button type="button" onClick={() => setShowOnboarding(false)} className="w-full text-gray-400 text-sm underline">Überspringen</button>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 bg-gray-100 min-h-screen text-black">
      <header className="bg-white border rounded p-4 space-y-1">
        <h1 className="text-3xl font-bold">{t.title}</h1>
        <p className="text-gray-600">{t.subtitle}</p>
        <p className="text-gray-700">{t.loggedInAs}: <strong>{user.email}</strong></p>
        {currentCompany && (<p className="text-gray-700">{t.firma}: <strong>{currentCompany.companies.name}</strong> | {t.role}: <strong>{currentCompany.role === "owner" ? "Owner" : currentCompany.role === "admin" ? t.roleAdmin : currentCompany.role === "project_manager" ? t.roleProjectManager : t.roleEmployee}</strong></p>)}
        <div className="flex items-center gap-3 mt-2">
          <button type="button" onClick={signOut} className="bg-gray-800 text-white px-4 py-2 rounded">{t.logout}</button>
          <select className="border p-2 rounded text-black bg-white text-sm" value={uiLanguage} onChange={(e) => {
            // Nur Sprache umschalten – die Übersetzung aller Felder läuft automatisch
            // über den useEffect (refreshCommentTranslations) in die neue Sprache.
            setUiLanguage(e.target.value as Language);
          }}>
            {getAllowedLanguages(companyFeatures).filter(l => languages.includes(l as Language)).map((lang) => (<option key={lang} value={lang}>🌐 {lang}</option>))}
          </select>
          <select className="border p-2 rounded text-black bg-white text-sm" value={pdfLanguage} onChange={(e) => setPdfLanguage(e.target.value)}>
            {getAllowedLanguages(companyFeatures).filter(l => pdfLanguages.includes(l)).map((lang) => (<option key={lang} value={lang}>📄 {lang}</option>))}
          </select>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        <TabButton label={t.dashboard}          tabName="dashboard"          activeTab={activeTab} onClick={() => setActiveTab("dashboard")} />
        <TabButton label={t.tabReport}          tabName="regiebericht"       activeTab={activeTab} onClick={() => setActiveTab("regiebericht")} />
        <TabButton label={t.saveLoad}           tabName="berichte"           activeTab={activeTab} onClick={() => setActiveTab("berichte")} />
        {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
          <TabButton label={t.projectsTab}      tabName="projekte"           activeTab={activeTab} onClick={() => { setActiveTab("projekte"); loadProjects(); }} />
        )}
        {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
          <TabButton label={t.workInstructions}   tabName="arbeitsanweisungen" activeTab={activeTab} onClick={() => setActiveTab("arbeitsanweisungen")} />
        )}
        {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
          <TabButton label={t.employeeManagement} tabName="mitarbeiter"      activeTab={activeTab} onClick={() => setActiveTab("mitarbeiter")} />
        )}
        {(currentCompany?.role === "owner" || currentCompany?.role === "admin") && (
          <TabButton label={t.companyData}      tabName="firmendaten"        activeTab={activeTab} onClick={() => setActiveTab("firmendaten")} />
        )}
        <TabButton label={t.tabDay}             tabName="tag"                activeTab={activeTab} onClick={() => { setActiveTab("tag"); if (currentCompany) loadWorkInstructions(currentCompany.company_id); }} />
        <TabButton label={t.tabWeek}            tabName="woche"              activeTab={activeTab} onClick={() => { setActiveTab("woche"); if (currentCompany) loadWorkInstructions(currentCompany.company_id); }} />
        <TabButton label={t.tabMonth}           tabName="monat"              activeTab={activeTab} onClick={() => { setActiveTab("monat"); if (currentCompany) loadWorkInstructions(currentCompany.company_id); }} />
      </nav>

      {message && <div className="border rounded p-3 bg-yellow-100 text-black">{message}</div>}

      {activeTab === "dashboard" && (
        <section className="border rounded p-4 space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.dashboard}</h2>
          {(() => {
            const visibleInstructions = workInstructions.filter(canSeeInstruction);
            const visibleProjectIds = new Set(visibleInstructions.map((i: any) => i.project_id).filter(Boolean));
            const visibleProjectsCount = (currentCompany?.role === "owner" || currentCompany?.role === "admin") ? projects.length : visibleProjectIds.size;
            const allTasks = visibleInstructions.flatMap((i) => i.work_instruction_tasks || []);
            const openCount = allTasks.filter((t: any) => (t.status || "open") === "open").length;
            const progressCount = allTasks.filter((t: any) => t.status === "in_progress").length;
            const stoppedCount = allTasks.filter((t: any) => t.status === "stopped").length;
            const completedCount = allTasks.filter((t: any) => t.status === "completed").length;
            const totalTasks = allTasks.length;
            const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
            const today = new Date().toISOString().split("T")[0];
            const todayInstructions = visibleInstructions.filter((i: any) => i.work_date === today);
            return (
              <div className="space-y-3">
                <p>{t.projects}: <strong>{visibleProjectsCount}</strong></p>
                <p>{t.workInstructions}: <strong>{visibleInstructions.length}</strong></p>
                <p>{t.dueToday}: <strong>{todayInstructions.length}</strong></p>
                <div className="border rounded p-3 bg-gray-100">
                  <p>{t.statusOpen}: {openCount}</p><p>{t.statusInProgress}: {progressCount}</p>
                  <p>{t.statusStopped}: {stoppedCount}</p><p>{t.statusCompleted}: {completedCount}</p>
                  <p className="font-bold mt-3">{t.totalProgress}: {progressPercent}%</p>
                  <div className="w-full bg-gray-300 rounded h-4 mt-1"><div className="bg-green-600 h-4 rounded" style={{ width: `${progressPercent}%` }} /></div>
                </div>
                {stoppedCount > 0 && (<div className="border rounded p-3 bg-red-50"><h3 className="font-bold mb-2">{t.stoppedSteps}</h3>{allTasks.filter((t: any) => t.status === "stopped").map((task: any) => (<p key={task.id}><strong>{visibleInstructions.find((i) => (i.work_instruction_tasks || []).some((t: any) => t.id === task.id))?.project || t.noProject}</strong>{" — "}⛔ {task.task_text}{task.note ? ` — ${task.note}` : ""}</p>))}</div>)}
                {progressCount > 0 && (<div className="border rounded p-3 bg-yellow-50"><h3 className="font-bold mb-2">{t.stepsInProgress}</h3>{allTasks.filter((t: any) => t.status === "in_progress").map((task: any) => (<p key={task.id}><strong>{visibleInstructions.find((i) => (i.work_instruction_tasks || []).some((t: any) => t.id === task.id))?.project || t.noProject}</strong>{" — "}🟡 {task.task_text}{task.note ? ` — ${task.note}` : ""}</p>))}</div>)}
              </div>
            );
          })()}
        </section>
      )}

      {activeTab === "regiebericht" && (
        <div className="space-y-4">
          <section className="border rounded p-4 space-y-4 bg-white text-black">
            <h2 className="text-xl font-bold">{t.general}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border p-3 text-black bg-white" placeholder={t.employee} value={employee} onChange={(e) => setEmployee(e.target.value)} />
              <input className="border p-3 bg-gray-200 text-black" value={calendarWeek} readOnly placeholder={t.calendarWeek} />
              <select className="border p-3 text-black bg-white" value={fromLanguage} onChange={(e) => setFromLanguage(e.target.value)}>
                {(getAllowedLanguages(companyFeatures).length > 0 ? getAllowedLanguages(companyFeatures) : languages).map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </select>
              <select className="border p-3 text-black bg-white" value={toLanguage} onChange={(e) => setToLanguage(e.target.value)}>
                {(getAllowedLanguages(companyFeatures).length > 0 ? getAllowedLanguages(companyFeatures) : languages).filter((lang) => lang !== "Deutsch").map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </select>
              {companyFeatures?.email_enabled ? <input className="border p-3 text-black bg-white md:col-span-2" placeholder={t.recipientEmail} value={emailTo} onChange={(e) => setEmailTo(e.target.value)} /> : <div className="border rounded p-3 bg-gray-50 text-sm text-gray-400 md:col-span-2">🔒 E-Mail-Versand ist in deinem Paket nicht aktiviert.</div>}
            </div>
          </section>
          <section className="border rounded bg-white text-black">
            <div className="p-4 cursor-pointer select-none flex justify-between items-center" onClick={() => setReportExpanded(v => !v)}>
              <h2 className="text-xl font-bold">{reportExpanded ? "▾" : "▸"} {t.tabReport}{calendarWeek ? ` — ${t.calendarWeek}: ${calendarWeek}` : ""}{employee ? ` — ${employee}` : ""}</h2>
            </div>
          </section>
          {reportExpanded && (<>
          {days.map((day, index) => (
            <section key={day.weekday} className="border rounded p-4 space-y-3 bg-white text-black">
              <h2 className="text-xl font-bold cursor-pointer select-none" onClick={() => setOpenReportDays(prev => ({ ...prev, [day.weekday]: !prev[day.weekday] }))}>{openReportDays[day.weekday] ? "▾" : "▸"} {t.weekdays[index] || day.weekday}</h2>
              {openReportDays[day.weekday] && (<>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="date" className="border p-3 text-black bg-white" value={day.date} onChange={(e) => { if (index === 0) updateFullWeekFromMonday(e.target.value); else updateDay(index, "date", e.target.value); }} />
                <input className="border p-3 text-black bg-white" placeholder={t.customer} value={day.customer} onChange={(e) => updateDay(index, "customer", e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder={t.projectNumber} value={day.projectNumber} onChange={(e) => updateDay(index, "projectNumber", e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder={t.site} value={day.site} onChange={(e) => updateDay(index, "site", e.target.value)} />
                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">{t.startTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={day.startTime || ""} onChange={(e) => updateDayTime(index, "startTime", e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">{t.endTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={day.endTime || ""} onChange={(e) => updateDayTime(index, "endTime", e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">{t.breakLabel}</label><input type="number" min="0" step="5" className="border p-2 w-full text-black bg-white" value={day.breakMinutes || ""} onChange={(e) => updateDayTime(index, "breakMinutes", e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">{t.hours}</label><input className="border p-2 w-full text-black bg-white" value={day.hours} onChange={(e) => updateDay(index, "hours", e.target.value)} readOnly={!!(day.startTime && day.endTime)} /></div>
                </div>
              </div>
              <textarea className="border p-3 w-full text-black bg-white resize-none overflow-hidden" rows={Math.max(4, (day.description || "").split("\n").length + 1)} placeholder={t.description} value={day.description} onChange={(e) => updateDay(index, "description", e.target.value)} />
              {companyFeatures?.photos_enabled ? <input type="file" accept="image/*" multiple className="border p-3 w-full text-black bg-white" onChange={(e) => handlePhotos(index, e.target.files)} /> : <div className="border rounded p-3 bg-gray-50 text-sm text-gray-400">🔒 Foto-Upload ist in deinem Paket nicht aktiviert.</div>}
              {day.photos.length > 0 && (<div className="grid grid-cols-2 gap-3">{day.photos.map((photo, photoIndex) => (<div key={photoIndex} className="border rounded p-2"><img src={photo} alt="Foto" className="w-full h-32 object-cover" /><button type="button" onClick={() => deletePhoto(index, photoIndex)} className="mt-2 bg-red-600 text-white px-2 py-2 rounded w-full">{t.deletePhoto}</button></div>))}</div>)}
              {day.translation && (<div className="border p-3 rounded bg-gray-100 text-black"><strong>{t.translation}:</strong><p>{day.translation}</p></div>)}
              </>)}
            </section>
          ))}
          <section className="border rounded p-4 space-y-2 bg-white text-black">
            <h2 className="text-xl font-bold">{t.hoursOverview}</h2>
            <p><strong>{t.total}:</strong> {totalHours.toString().replace(".", ",")} {t.hours}</p>
            {Object.entries(projectTotals).map(([project, total]) => (<p key={project}><strong>{t.projectNumber} {project}:</strong> {total.toString().replace(".", ",")} {t.hours}</p>))}
          </section>
          </>)}
          {companyFeatures?.signature_enabled && (
            <section className="border rounded p-4 space-y-3 bg-white text-black">
              <h2 className="text-xl font-bold">✍️ Unterschriften</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SignaturePad label={pdfTexts[uiLanguage as keyof typeof pdfTexts]?.signatureEmployee || "Unterschrift Mitarbeiter"} value={sigEmployee} onChange={setSigEmployee} />
                <SignaturePad label={pdfTexts[uiLanguage as keyof typeof pdfTexts]?.signatureCustomer || "Unterschrift Kunde / Bauleitung"} value={sigCustomer} onChange={setSigCustomer} />
              </div>
            </section>
          )}
          <div className="flex flex-wrap gap-4">
            <button type="button" onClick={translateAll} className="bg-black text-white px-4 py-3 rounded">{loading ? t.translating : t.translateWeek}</button>
            <button type="button" onClick={saveReport} className="bg-orange-600 text-white px-4 py-3 rounded">{currentReportId ? t.update : t.save}</button>
            <button type="button" onClick={() => createPDF(false)} className="bg-green-600 text-white px-4 py-3 rounded">{t.downloadPdf}</button>
            {companyFeatures?.email_enabled && <button type="button" onClick={() => createPDF(true)} className="bg-purple-600 text-white px-4 py-3 rounded">{t.sendPdf}</button>}
          </div>
        </div>
      )}

      {activeTab === "berichte" && (
        <section className="border rounded p-4 space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.saveLoad}</h2>
          <input className="border p-3 w-full text-black bg-white" placeholder={t.reportName} value={reportName} onChange={(e) => setReportName(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={saveReport} className="bg-orange-600 text-white px-4 py-3 rounded">{currentReportId ? t.updateReport : t.saveReport}</button>
            <button type="button" onClick={() => { newReport(); setMessage(t.msgNewReport); }} className="bg-gray-700 text-white px-4 py-3 rounded">{t.newReport}</button>
          </div>
          {savedReports.length > 0 && (<div className="space-y-2"><h3 className="font-bold">{t.savedReports}</h3>{savedReports.map((report) => (<div key={report.id} className="border rounded p-3 space-y-2"><strong>{report.report_name}</strong><p className="text-sm text-gray-700">{t.employee}: {report.employee || "-"} | {new Date(report.created_at).toLocaleString("de-DE")}</p><div className="flex gap-2"><button type="button" onClick={() => loadReport(report)} className="bg-blue-600 text-white px-3 py-2 rounded">{t.loadEdit}</button><button type="button" onClick={() => deleteReport(report.id)} className="bg-red-600 text-white px-3 py-2 rounded">{t.delete}</button></div></div>))}</div>)}
        </section>
      )}

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
                {(currentCompany?.role === "owner" || currentCompany?.role === "admin") ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{t.projectManager}:</span>
                  <select className="border p-2 rounded text-sm" value={pmEdits[project.id] ?? (project.project_manager || "")} onChange={(e) => setPmEdits((prev) => ({ ...prev, [project.id]: e.target.value }))}>
                    <option value="">—</option>
                    {project.project_manager && !companyUsers.some((m: any) => (m.full_name || m.email) === project.project_manager && m.role === "project_manager") && (<option value={project.project_manager}>{project.project_manager}</option>)}
                    {companyUsers.filter((m: any) => m.role === "project_manager").map((m: any) => (<option key={m.user_id} value={m.full_name || m.email || ""}>{m.full_name || m.email}</option>))}
                  </select>
                  <button type="button" onClick={() => updateProjectManager(project.id, pmEdits[project.id] ?? (project.project_manager || ""))} className="bg-blue-700 text-white px-3 py-1 rounded text-sm">{t.save}</button>
                  <button type="button" onClick={() => assignPmToProjectInstructions(project.id, pmEdits[project.id] ?? (project.project_manager || ""))} className="bg-green-700 text-white px-3 py-1 rounded text-sm">Sichtbarkeit zuweisen</button>
                </div>
                ) : (
                <p>{t.projectManager}: {project.project_manager || "-"}</p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedProjectDetailId(project.id === selectedProjectDetailId ? "" : project.id)} className="bg-gray-700 text-white px-3 py-2 rounded">{project.id === selectedProjectDetailId ? t.closeProject : t.openProject}</button>
                  <button type="button" onClick={() => deleteProject(project.id)} className="bg-red-600 text-white px-3 py-2 rounded">{t.deleteProject}</button>
                </div>
                {selectedProjectDetailId === project.id && (
                  <div className="border rounded p-3 bg-gray-50 space-y-3 mt-2">
                    {(() => {
                      const tasks = workInstructions.filter((i) => i.project_id === project.id).flatMap((i) => i.work_instruction_tasks || []);
                      const completedCount = tasks.filter((t: any) => t.status === "completed").length;
                      const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
                      return (<div className="border rounded p-3 bg-gray-100"><p>{t.statusOpen}: {tasks.filter((t: any) => (t.status || "open") === "open").length}</p><p>{t.statusInProgress}: {tasks.filter((t: any) => t.status === "in_progress").length}</p><p>{t.statusStopped}: {tasks.filter((t: any) => t.status === "stopped").length}</p><p>{t.statusCompleted}: {completedCount}</p><p className="font-bold mt-2">{t.progress}: {progressPercent}%</p><div className="w-full bg-gray-300 rounded h-4 mt-1"><div className="bg-green-600 h-4 rounded" style={{ width: `${progressPercent}%` }} /></div></div>);
                    })()}
                    <h4 className="font-bold">{t.workInstructions}</h4>
                    {workInstructions.filter((i) => i.project_id === project.id).map((instruction) => (
                      <div key={instruction.id} className="border rounded p-3 bg-white space-y-2">
                        <strong>{getTranslated(instruction.id, "title", instruction.title)}</strong>
                        <p><strong>{t.date}:</strong> {instruction.work_date || "-"}</p>
                        <p><strong>{t.customer}:</strong> {instruction.customer || "-"}</p>
                        <p><strong>{t.site}:</strong> {instruction.site || "-"}</p>
                        {instruction.problems_text && <p><strong>{t.problems}:</strong> {getTranslated(instruction.id, "problems_text", instruction.problems_text)}</p>}
                        {(instruction.work_instruction_tasks || []).length > 0 && (<ul className="list-disc pl-6 space-y-1">{instruction.work_instruction_tasks.map((task: any) => (<li key={task.id}>{task.status === "completed" ? t.statusCompleted : task.status === "in_progress" ? t.statusInProgress : task.status === "stopped" ? t.statusStopped : t.statusOpen}{" "}{getTranslatedTask(instruction.id, task.id, task.task_text)}{task.note && <div className="text-sm text-gray-600 ml-2">{t.feedbackLabel}: {task.note}</div>}</li>))}</ul>)}
                        {companyFeatures?.module_auto_reports ? (<button type="button" onClick={() => createReportFromInstruction(instruction)} className="bg-green-700 text-white px-3 py-2 rounded">{t.toReport}</button>) : (<p className="text-sm text-gray-500">{t.autoReportLocked}</p>)}
                      </div>
                    ))}
                    {workInstructions.filter((i) => i.project_id === project.id).length === 0 && <p className="text-gray-600">{t.noInstructions}</p>}
                    <h4 className="font-bold mt-2">{t.reportsTab}</h4>
                    {savedReports.filter((r: any) => r.project_id === project.id).map((report: any) => (<div key={report.id} className="border rounded p-3 bg-white"><strong>{report.report_name}</strong><p>{t.employee}: {report.employee || "-"}</p></div>))}
                    {savedReports.filter((r: any) => r.project_id === project.id).length === 0 && <p className="text-gray-600">{t.noReports}</p>}
                  </div>
                )}
              </div>
            ))}
            {projects.length === 0 && <p className="text-gray-600">{t.noProjectsYet}</p>}
          </div>
        </section>
      )}

      {activeTab === "arbeitsanweisungen" && (
        <div className="space-y-4">
          {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") ? (
          <section className="border rounded p-4 space-y-4 bg-white text-black">
            <h2 className="text-xl font-bold">{t.newInstruction}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border p-3 text-black bg-white" placeholder={t.instructionTitle} value={instructionTitle} onChange={(e) => setInstructionTitle(e.target.value)} />
              <select className="border p-3 text-black bg-white" value={selectedProjectId} onChange={(e) => { const pid = e.target.value; setSelectedProjectId(pid); const sp = projects.find((p) => p.id === pid); if (sp) { setInstructionProject(sp.name || ""); setInstructionCustomer(sp.customer || ""); setInstructionSite(sp.site || ""); } }}>
                <option value="">{t.selectProject}</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <input className="border p-3 text-black bg-white" placeholder={t.customer} value={instructionCustomer} onChange={(e) => setInstructionCustomer(e.target.value)} />
              <input className="border p-3 text-black bg-white" placeholder={t.site} value={instructionSite} onChange={(e) => setInstructionSite(e.target.value)} />
              <input type="date" className="border p-3 text-black bg-white" value={instructionDate} onChange={(e) => setInstructionDate(e.target.value)} />
            </div>
            {/* Mitarbeiter zuweisen – Mehrfachauswahl */}
            {companyUsers.filter(m => m.role === "employee").length > 0 && (
              <div className="border rounded p-3 bg-gray-50 space-y-2">
                <h3 className="font-bold text-sm">👤 Mitarbeiter zuweisen</h3>
                {companyUsers.filter(m => m.role === "employee").map((m) => (
                  <label key={m.user_id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignedUserIds.includes(m.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignedUserIds(prev => [...prev, m.user_id]);
                        } else {
                          setAssignedUserIds(prev => prev.filter(id => id !== m.user_id));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span>{m.full_name || m.email}</span>
                  </label>
                ))}
              </div>
            )}
            {/* Projektleiter zuweisen – Mehrfachauswahl */}
            {companyUsers.filter(m => m.role === "project_manager").length > 0 && (
              <div className="border rounded p-3 bg-gray-50 space-y-2">
                <h3 className="font-bold text-sm">👷 Projektleiter zuweisen</h3>
                {companyUsers.filter(m => m.role === "project_manager").map((m) => (
                  <label key={m.user_id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignedUserIds.includes(m.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignedUserIds(prev => [...prev, m.user_id]);
                        } else {
                          setAssignedUserIds(prev => prev.filter(id => id !== m.user_id));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span>{m.full_name || m.email}</span>
                  </label>
                ))}
              </div>
            )}
            <input className="border p-3 w-full text-black bg-white" placeholder={t.problems} value={instructionProblems} onChange={(e) => setInstructionProblems(e.target.value)} />
            {companyFeatures?.photos_enabled && (
              <div>
                <h3 className="font-bold mb-2">{t.photos}</h3>
                <input type="file" accept="image/*" multiple className="border p-3 w-full text-black bg-white" onChange={(e) => handleInstructionPhotos(e.target.files)} />
                {instructionPhotos.length > 0 && (<div className="grid grid-cols-3 gap-2 mt-2">{instructionPhotos.map((photo, i) => (<div key={i} className="relative"><img src={photo} alt="Foto" className="w-full h-24 object-cover rounded" /><button type="button" onClick={() => setInstructionPhotos((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs">✕</button></div>))}</div>)}
              </div>
            )}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold">{t.workSteps}</h3>
              <button type="button" onClick={openCopyModal} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm">📋 {t.copyInstruction}</button>
            </div>
            {instructionTasks.map((task, index) => (
              <div key={index} className="border rounded p-3 space-y-2 bg-gray-50">
                <input className="border p-3 w-full text-black bg-white" placeholder={`${t.workSteps} ${index + 1}`} value={task} onChange={(e) => { const copy = [...instructionTasks]; copy[index] = e.target.value; setInstructionTasks(copy); }} />
                {companyFeatures?.photos_enabled && (<><input type="file" accept="image/*" multiple className="border p-2 w-full text-black bg-white text-sm" onChange={(e) => handleInstructionTaskPhotos(index, e.target.files)} />{(instructionTaskPhotos[index] || []).length > 0 && (<div className="grid grid-cols-3 gap-2">{(instructionTaskPhotos[index] || []).map((photo, pi) => (<div key={pi} className="relative"><img src={photo} alt="Foto" className="w-full h-20 object-cover rounded" /><button type="button" onClick={() => setInstructionTaskPhotos((prev) => ({ ...prev, [index]: (prev[index] || []).filter((_, idx) => idx !== pi) }))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs">✕</button></div>))}</div>)}</>)}
              </div>
            ))}
            <div className="flex gap-3">
              <button type="button" onClick={() => setInstructionTasks([...instructionTasks, ""])} className="bg-gray-700 text-white px-4 py-3 rounded">{t.addStep}</button>
              <button type="button" onClick={saveWorkInstruction} className="bg-blue-700 text-white px-4 py-3 rounded">{t.saveInstruction}</button>
            </div>
          </section>
          ) : (
            <section className="border rounded p-4 bg-yellow-50 text-black"><p className="text-yellow-700 text-sm">🔒 Arbeitsanweisungen anlegen ist nur für Projektleiter und Admins möglich.</p></section>
          )}
          <section className="border rounded p-4 bg-blue-50 text-black"><p className="text-blue-700 text-sm">💡 {t.savedInstructions} → {t.tabDay} / {t.tabWeek} / {t.tabMonth}</p></section>
        </div>
      )}

      {activeTab === "tag" && (
        <div className="space-y-4">
          <section className="border rounded p-4 bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">{t.dayView}</h2>
            <input type="date" className="border p-3 rounded text-black bg-white" value={selectedDayDate} onChange={(e) => setSelectedDayDate(e.target.value)} />
          </section>
          {(() => {
            const dayInstructions = workInstructions.filter((i) => {
              if (i.work_date !== selectedDayDate) return false;
              return canSeeInstruction(i);
            });
            if (dayInstructions.length === 0) return (<section className="border rounded p-4 bg-white text-black"><p className="text-gray-500">{t.noInstructionsDay}</p></section>);
            return dayInstructions.map((instruction) => (
              <section key={instruction.id} className="border rounded p-4 bg-white text-black space-y-2">
                <div className="flex justify-between items-start cursor-pointer select-none" onClick={() => setOpenDayCards(prev => ({ ...prev, [instruction.id]: !prev[instruction.id] }))}>
                  <div>
                    <h3 className="font-bold text-lg">{openDayCards[instruction.id] ? "▾" : "▸"} {getTranslated(instruction.id, "title", instruction.title)}</h3>
                    <p className="text-sm text-gray-600 ml-5"><strong>{t.project}:</strong> {instruction.project || "-"} &nbsp;·&nbsp; <strong>{t.site}:</strong> {instruction.site || "-"}</p>
                  </div>
                  <span className="text-sm text-gray-500">{instruction.work_date}</span>
                </div>
                {openDayCards[instruction.id] && (<>
                <p><strong>{t.customer}:</strong> {instruction.customer || "-"}</p>
                {instruction.problems_text && (<div className="bg-yellow-50 border rounded p-2"><strong>{t.problemsHints}:</strong> {getTranslated(instruction.id, "problems_text", instruction.problems_text)}</div>)}
                {(instruction.photos || []).length > 0 && companyFeatures?.photos_enabled && (<div className="grid grid-cols-3 gap-2">{(instruction.photos || []).map((photo: string, i: number) => (<img key={i} src={photo} alt="Foto" className="w-full h-24 object-cover rounded border" />))}</div>)}
                <ul className="space-y-4 mt-2">
                  {(instruction.work_instruction_tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((task: any) => (
                    <li key={task.id} className="border rounded-lg p-3 bg-gray-50 space-y-3">
                      <div className="flex items-center gap-2">
                        <select className="border rounded p-1 text-sm text-black bg-white" value={task.status || "open"} onChange={(e) => updateTaskStatus(task.id, e.target.value)}>
                          <option value="open">{t.statusOpen}</option><option value="in_progress">{t.statusInProgress}</option><option value="stopped">{t.statusStopped}</option><option value="completed">{t.statusCompleted}</option>
                        </select>
                        <span className="font-medium">{getTranslatedTask(instruction.id, task.id, task.task_text)}</span>
                      </div>
                      {task.note && <p className="text-sm text-gray-600 ml-2">{t.feedbackLabel}: {task.note}</p>}
                      {(task.photos || []).length > 0 && companyFeatures?.photos_enabled && (<div className="grid grid-cols-3 gap-1">{(task.photos || []).map((photo: string, pi: number) => (<img key={pi} src={photo} alt="Foto" className="w-full h-16 object-cover rounded" />))}</div>)}
                      {/* Mitarbeiter-Kommentar */}
                      <div className="border-t pt-2 space-y-2">
                        <p className="text-sm font-medium text-gray-700">💬 {t.commentLabel} (max. 1000 {t.charsLabel}):</p>
                        <textarea
                          className="border p-2 w-full rounded text-sm text-black bg-white"
                          rows={5}
                          maxLength={1000}
                          placeholder={t.commentPlaceholder}
                          value={taskComments[task.id] !== undefined ? taskComments[task.id] : (getTranslatedComment(instruction.id, task.id, task.employee_comment || ""))}
                          onChange={(e) => { setTaskComments(prev => ({ ...prev, [task.id]: e.target.value.slice(0, 1000) })); setCommentSaveState(prev => ({ ...prev, [task.id]: "" })); }}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">
                            {((taskComments[task.id] !== undefined ? taskComments[task.id] : getTranslatedComment(instruction.id, task.id, task.employee_comment || "")) || "").length} / 1000 {t.charsLabel}
                          </span>
                          <div className="flex items-center gap-2">
                            {commentSaveState[task.id] === "saving" && <span className="text-xs text-gray-500">⏳ {t.commentSaving}</span>}
                            {commentSaveState[task.id] === "saved" && <span className="text-xs text-green-700 font-medium">✓ {t.commentSaved}</span>}
                            {commentSaveState[task.id]?.startsWith("error:") && <span className="text-xs text-red-600">{t.commentErrorLabel}: {commentSaveState[task.id].slice(6)}</span>}
                            <button
                              type="button"
                              disabled={commentSaveState[task.id] === "saving"}
                              onClick={() => {
                                const val = taskComments[task.id] !== undefined ? taskComments[task.id] : getTranslatedComment(instruction.id, task.id, task.employee_comment || "");
                                updateTaskComment(task.id, val);
                              }}
                              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                            >
                              💾 {t.commentSaveBtn}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-2 border-t flex-wrap">
                  {companyFeatures?.module_auto_reports && (<button type="button" onClick={() => createReportFromInstruction(instruction)} className="bg-green-700 text-white px-3 py-2 rounded text-sm">📋 {t.toReport}</button>)}
                  {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (<button type="button" onClick={() => deleteWorkInstruction(instruction.id)} className="bg-red-600 text-white px-3 py-2 rounded text-sm">{t.deleteInstruction}</button>)}
                </div>
                </>)}
              </section>
            ));
          })()}
        </div>
      )}

      {activeTab === "woche" && (
        <div className="space-y-4">
          <section className="border rounded p-4 bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">{t.weekView}</h2>
            <div className="flex items-center gap-3"><label className="text-sm font-medium">{t.selectDate}:</label><input type="date" className="border p-3 rounded text-black bg-white" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} /></div>
            <p className="text-sm text-gray-500">{t.week}: {getCalendarWeek(selectedWeek)}</p>
          </section>
          {(() => {
            if (!selectedWeek) return null;
            const [y, m, d] = selectedWeek.split("-").map(Number);
            const date = new Date(Date.UTC(y, m - 1, d));
            const dayNum = date.getUTCDay() || 7;
            const monday = new Date(date); monday.setUTCDate(date.getUTCDate() - dayNum + 1);
            const weekDates = Array.from({ length: 7 }, (_, i) => { const nd = new Date(monday); nd.setUTCDate(monday.getUTCDate() + i); return nd.toISOString().split("T")[0]; });
            const weekInstructions = workInstructions.filter((i) => {
              if (!weekDates.includes(i.work_date)) return false;
              return canSeeInstruction(i);
            });
            if (weekInstructions.length === 0) return (<section className="border rounded p-4 bg-white text-black"><p className="text-gray-500">{t.noInstructionsWeek}</p></section>);
            return weekDates.map((dateStr, di) => {
              const dayInstructions = weekInstructions.filter((i) => i.work_date === dateStr);
              if (dayInstructions.length === 0) return null;
              return (
                <section key={dateStr} className="border rounded p-4 bg-white text-black space-y-3">
                  <div className="flex justify-between items-center bg-gray-100 rounded p-2">
                    <h3 className="font-bold cursor-pointer select-none" onClick={() => setOpenWeekDays(prev => ({ ...prev, [dateStr]: !prev[dateStr] }))}>{openWeekDays[dateStr] ? "▾" : "▸"} {t.weekdays[di]} — {dateStr}</h3>
                    <button type="button" onClick={() => { setSelectedDayDate(dateStr); setActiveTab("tag"); }} className="text-blue-600 text-sm hover:underline">→ {t.dayView}</button>
                  </div>
                  {openWeekDays[dateStr] && (<>
                  {dayInstructions.map((instruction) => (
                    <div key={instruction.id} className="border rounded p-3 space-y-2">
                      <div className="flex justify-between"><strong>{getTranslated(instruction.id, "title", instruction.title)}</strong><span className="text-sm text-gray-500">{instruction.project || "-"}</span></div>
                      <p className="text-sm"><strong>{t.customer}:</strong> {instruction.customer || "-"} | <strong>{t.site}:</strong> {instruction.site || "-"}</p>
                      {instruction.problems_text && (<div className="bg-yellow-50 border rounded p-2 text-sm"><strong>{t.problemsHints}:</strong> {getTranslated(instruction.id, "problems_text", instruction.problems_text)}</div>)}
                      <ul className="space-y-1">
                        {(instruction.work_instruction_tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((task: any) => (
                          <li key={task.id} className="flex items-center gap-2 text-sm">
                            <select className="border rounded p-1 text-xs text-black bg-white" value={task.status || "open"} onChange={(e) => updateTaskStatus(task.id, e.target.value)}>
                              <option value="open">{t.statusOpen}</option><option value="in_progress">{t.statusInProgress}</option><option value="stopped">{t.statusStopped}</option><option value="completed">{t.statusCompleted}</option>
                            </select>
                            <span>{getTranslatedTask(instruction.id, task.id, task.task_text)}</span>{task.note && <span className="text-gray-500">— {task.note}</span>}
                          </li>
                        ))}
                      </ul>
                      {companyFeatures?.module_auto_reports && (<button type="button" onClick={() => createReportFromInstruction(instruction)} className="bg-green-700 text-white px-3 py-1 rounded text-sm">📋 {t.toReport}</button>)}
                    </div>
                  ))}
                  </>)}
                </section>
              );
            });
          })()}
        </div>
      )}

      {activeTab === "monat" && (
        <div className="space-y-4">
          <section className="border rounded p-4 bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">{t.monthView}</h2>
            <input type="month" className="border p-3 rounded text-black bg-white" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          </section>
          {(() => {
            const monthInstructions = workInstructions.filter((i) => {
              if (!i.work_date?.startsWith(selectedMonth)) return false;
              return canSeeInstruction(i);
            });
            const [year, month] = selectedMonth.split("-").map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7;
            const cells: (number | null)[] = [];
            for (let i = 0; i < firstDay; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            return (
              <>
                <section className="border rounded p-4 bg-white text-black">
                  <h3 className="font-bold mb-3">{selectedMonth}</h3>
                  <div className="grid grid-cols-7 gap-1 mb-1">{t.weekdays.map((label) => (<div key={label} className="text-center text-xs font-bold text-gray-500 py-1">{label.slice(0, 2)}</div>))}</div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, i) => {
                      if (!day) return <div key={`e-${i}`} />;
                      const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                      const entries = monthInstructions.filter((inst) => inst.work_date === dateStr);
                      const isToday = dateStr === new Date().toISOString().split("T")[0];
                      return (<div key={day} onClick={() => { setSelectedDayDate(dateStr); setActiveTab("tag"); }} className={`border rounded p-1 min-h-14 cursor-pointer hover:border-blue-400 transition-colors ${isToday ? "border-blue-500 bg-blue-50" : entries.length > 0 ? "bg-green-50 border-green-300" : "bg-white"}`}><div className={`text-xs font-bold ${isToday ? "text-blue-600" : "text-gray-700"}`}>{day}</div>{entries.length > 0 && <div className="text-xs text-green-700 font-medium">{entries.length} ✓</div>}{entries[0] && <div className="text-xs text-gray-500 truncate">{entries[0].title}</div>}</div>);
                    })}
                  </div>
                </section>
                <section className="border rounded p-4 bg-white text-black space-y-2">
                  <h3 className="font-bold">{t.workInstructions} ({monthInstructions.length})</h3>
                  {monthInstructions.length === 0 && <p className="text-gray-500">{t.noInstructionsMonth}</p>}
                  {monthInstructions.sort((a, b) => (a.work_date || "").localeCompare(b.work_date || "")).map((instruction) => (<div key={instruction.id} onClick={() => { setSelectedDayDate(instruction.work_date); setActiveTab("tag"); }} className="border rounded p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 flex justify-between items-center"><div><span className="font-medium">{getTranslated(instruction.id, "title", instruction.title)}</span><span className="text-gray-500 text-sm ml-2">{instruction.customer || "-"}</span></div><span className="text-sm text-gray-500">{instruction.work_date}</span></div>))}
                </section>
              </>
            );
          })()}
        </div>
      )}

      {activeTab === "mitarbeiter" && (
        <section className="border rounded p-4 space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.employeeManagement}</h2>
          {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
            <div className="border rounded p-4 bg-gray-50 space-y-3">
              <h3 className="font-bold">Neuen Mitarbeiter anlegen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border p-3 text-black bg-white" placeholder="Vollständiger Name *" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder="Benutzername * (für Login)" value={newUserUsername} onChange={(e) => setNewUserUsername(e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder="Passwort *" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                <select className="border p-3 text-black bg-white" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                  <option value="employee">{t.roleEmployee}</option>
                  {(currentCompany?.role === "owner" || currentCompany?.role === "admin") && <option value="project_manager">{t.roleProjectManager}</option>}
                  {currentCompany?.role === "owner" && <option value="admin">{t.roleAdmin}</option>}
                </select>
              </div>
              <button type="button" onClick={addCompanyUser} disabled={creatingEmployee} className="bg-blue-700 text-white px-4 py-3 rounded disabled:opacity-50">{creatingEmployee ? "Wird angelegt..." : t.addEmployee}</button>
              <p className="text-xs text-gray-400">Der Mitarbeiter meldet sich mit seinem Benutzernamen und Passwort an.</p>
            </div>
          )}
          <p>{t.currentEmployees}: <strong>{companyUsers.length}</strong></p>
          <div className="space-y-3">
            {companyUsers.map((member) => (
              <div key={member.id} className="border rounded p-3 space-y-2">
                <strong>{member.full_name || "-"}</strong>
                <p>{member.email || "-"}</p>
                <p>{t.role}: {member.role === "owner" ? "Owner" : member.role === "admin" ? t.roleAdmin : member.role === "project_manager" ? t.roleProjectManager : t.roleEmployee}</p>
                <div className="flex gap-2 flex-wrap">
                  {member.email && (<button type="button" onClick={() => resetCompanyUserPassword(member.email)} className="bg-gray-700 text-white px-3 py-2 rounded">{t.resetPassword}</button>)}
                  {currentCompany && canDelete(currentCompany.role, member.role) && member.user_id !== user?.id && (
                    <button type="button" onClick={() => deleteCompanyUser(member.id, member.user_id)} className="bg-red-600 text-white px-3 py-2 rounded">🗑️ Löschen</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "firmendaten" && (
        <section className="border rounded p-4 space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.companyData}</h2>
          {companySettings?.company_logo && (<img src={companySettings.company_logo} alt="Firmenlogo" className="h-20 object-contain" />)}
          <div><label className="block text-sm font-medium mb-1">{t.uploadLogo}</label><input type="file" accept="image/*" className="border p-3 w-full text-black bg-white" onChange={(e) => uploadCompanyLogo(e.target.files)} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border p-3 text-black bg-white" placeholder={t.companyName} value={companySettings?.company_name || ""} onChange={(e) => updateCompanyField("company_name", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.street} value={companySettings?.street || ""} onChange={(e) => updateCompanyField("street", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.zip} value={companySettings?.zip_code || ""} onChange={(e) => updateCompanyField("zip_code", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.city} value={companySettings?.city || ""} onChange={(e) => updateCompanyField("city", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.phone} value={companySettings?.phone || ""} onChange={(e) => updateCompanyField("phone", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.email} value={companySettings?.email || ""} onChange={(e) => updateCompanyField("email", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.website} value={companySettings?.website || ""} onChange={(e) => updateCompanyField("website", e.target.value)} />
            <input className="border p-3 text-black bg-white" placeholder={t.taxNumber} value={companySettings?.tax_number || ""} onChange={(e) => updateCompanyField("tax_number", e.target.value)} />
          </div>
          <button type="button" onClick={saveCompanySettings} className="bg-blue-700 text-white px-4 py-3 rounded">{t.saveCompany}</button>
        </section>
      )}

      {/* ── NEU: Kopier-Dialog – Schritte aus bestehender Anweisung ins Formular übernehmen ── */}
      {copyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setCopyModalOpen(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold">📋 {t.copyTitle}</h3>
            <div>
              <label className="block text-sm font-medium mb-1">{t.copySource}</label>
              <select className="border p-3 w-full rounded text-black bg-white" value={copyModalInstruction?.id || ""} onChange={(e) => selectCopySource(e.target.value)}>
                <option value="">{t.copySource}</option>
                {workInstructions.map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.title}{inst.work_date ? ` (${inst.work_date})` : ""}</option>
                ))}
              </select>
            </div>
            {copyModalInstruction && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t.copyWhichSteps}</p>
                  <button type="button" className="text-xs text-blue-600 underline" onClick={() => {
                    const all = (copyModalInstruction.work_instruction_tasks || []).map((task: any) => task.id);
                    setCopySelectedTaskIds((prev) => prev.length === all.length ? [] : all);
                  }}>{t.copyAllNone}</button>
                </div>
                {(copyModalInstruction.work_instruction_tasks || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((task: any) => (
                  <label key={task.id} className="flex items-start gap-2 border rounded p-2 cursor-pointer bg-gray-50">
                    <input type="checkbox" className="w-4 h-4 mt-1" checked={copySelectedTaskIds.includes(task.id)} onChange={(e) => {
                      if (e.target.checked) setCopySelectedTaskIds((prev) => [...prev, task.id]);
                      else setCopySelectedTaskIds((prev) => prev.filter((id) => id !== task.id));
                    }} />
                    <span className="text-sm flex-1">{task.task_text}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{task.status === "completed" ? t.statusCompleted : task.status === "in_progress" ? t.statusInProgress : task.status === "stopped" ? t.statusStopped : t.statusOpen}</span>
                  </label>
                ))}
                {(copyModalInstruction.work_instruction_tasks || []).length === 0 && (<p className="text-sm text-gray-500">{t.copyNoSteps}</p>)}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setCopyModalOpen(false)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded font-medium">{t.copyCancel}</button>
              <button type="button" disabled={!copyModalInstruction || copySelectedTaskIds.length === 0} onClick={applyCopiedSteps} className="flex-1 bg-indigo-600 text-white py-3 rounded font-bold disabled:opacity-50">{t.copyConfirm}</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
