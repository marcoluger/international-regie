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

const languages = ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Rumänisch", "Ukrainisch", "Ungarisch", "Bulgarisch", "Tschechisch", "Türkisch", "Italienisch", "Englisch", "Serbisch", "Spanisch", "Philippinisch", "Vietnamesisch", "Indisch"];
const UNIT_LABELS: Record<string, Record<string, string>> = {
  "Stk": { Deutsch: "Stk", Kroatisch: "kom", Slowenisch: "kos", Polnisch: "szt", Rumänisch: "buc", Ukrainisch: "шт", Ungarisch: "db", Bulgarisch: "бр", Tschechisch: "ks", Türkisch: "adet", Italienisch: "pz", Englisch: "pcs", Serbisch: "kom", Spanisch: "ud" },
  "Pack": { Deutsch: "Pack", Kroatisch: "pak", Slowenisch: "pak", Polnisch: "opak", Rumänisch: "pachet", Ukrainisch: "упак", Ungarisch: "csom", Bulgarisch: "опак", Tschechisch: "bal", Türkisch: "paket", Italienisch: "conf", Englisch: "pack", Serbisch: "pak", Spanisch: "paq" },
  "Rolle": { Deutsch: "Rolle", Kroatisch: "rola", Slowenisch: "kolut", Polnisch: "rolka", Rumänisch: "rolă", Ukrainisch: "рулон", Ungarisch: "tekercs", Bulgarisch: "ролка", Tschechisch: "role", Türkisch: "rulo", Italienisch: "rotolo", Englisch: "roll", Serbisch: "rola", Spanisch: "rollo" },
  "Sack": { Deutsch: "Sack", Kroatisch: "vreća", Slowenisch: "vreča", Polnisch: "worek", Rumänisch: "sac", Ukrainisch: "мішок", Ungarisch: "zsák", Bulgarisch: "чувал", Tschechisch: "pytel", Türkisch: "çuval", Italienisch: "sacco", Englisch: "bag", Serbisch: "vreća", Spanisch: "saco" },
};
// Einheit in der Anzeige-Sprache (intern wird immer der gleiche Wert gespeichert).
function unitLabel(unit: string, lang: string): string {
  return UNIT_LABELS[unit]?.[lang] || unit;
}
const MATERIAL_UNITS = ["Stk", "m", "m²", "kg", "l", "Pack", "Rolle", "Sack"];
const COUNTRIES = ["Deutschland", "Österreich", "Schweiz", "Rumänien", "Italien", "Türkei", "Ungarn", "Tschechien", "Slowakei", "Ukraine", "Bulgarien", "Serbien", "Kroatien", "Slowenien", "Bosnien und Herzegowina", "Nordmazedonien", "Kosovo", "Albanien", "Polen", "Portugal", "Spanien", "Griechenland", "Andere"];
const pdfLanguages = ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch", "Spanisch"];
const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

type Language = "Deutsch" | "Kroatisch" | "Slowenisch" | "Polnisch" | "Rumänisch" | "Ukrainisch" | "Ungarisch" | "Bulgarisch" | "Tschechisch" | "Türkisch" | "Italienisch" | "Englisch" | "Serbisch" | "Spanisch" | "Philippinisch" | "Vietnamesisch" | "Indisch";

type DayEntry = {
  weekday: string;
  date: string;
  customer: string;
  projectNumber: string;
  site: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  travelOutStart?: string;
  travelOutEnd?: string;
  travelOutKm?: string;
  travelReturnStart?: string;
  travelReturnEnd?: string;
  travelReturnKm?: string;
  hours: string;
  description: string;
  translation: string;
  photos: string[];
  // Uebertragene Arbeitsanweisungen je Tag (fuer "ersetzen statt doppelt anhaengen")
  blocks?: { id: string; text: string }[];
  // Weitere Eintraege am selben Tag (zweiter Arbeitsschritt mit eigener Zeit/Fahrzeit/km).
  extra?: DaySubEntry[];
};

type DaySubEntry = {
  customer: string;
  projectNumber: string;
  site: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  hours: string;
  travelOutStart?: string;
  travelOutEnd?: string;
  travelOutKm?: string;
  travelReturnStart?: string;
  travelReturnEnd?: string;
  travelReturnKm?: string;
  description: string;
  translation?: string;
};

function emptySubEntry(): DaySubEntry {
  return { customer: "", projectNumber: "", site: "", startTime: "", endTime: "", breakMinutes: "", hours: "", travelOutStart: "", travelOutEnd: "", travelOutKm: "", travelReturnStart: "", travelReturnEnd: "", travelReturnKm: "", description: "" };
}
// Alle Zeit-/km-relevanten Positionen eines Tages (Haupteintrag + Zusatzeintraege).
function dayLineItems(day: any): any[] {
  return [day, ...((day && day.extra) || [])];
}

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
  read_only?: boolean;
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
  feedback_enabled?: boolean;
  translator_enabled?: boolean;
  comments_enabled?: boolean;
  material_enabled?: boolean;
  export_enabled?: boolean;
  equipment_enabled?: boolean;
  absence_enabled?: boolean;
};

const texts = {
  Deutsch: {
    navigate: "Navigation",
    absenceReported: "Gemeldet",
    absenceTab: "Urlaub & Abwesenheit", absenceVacation: "Urlaub", absenceSick: "Krankheit", absenceFrom: "Von", absenceTo: "Bis", absenceRequest: "Beantragen", absencePending: "Offen", absenceApproved: "Genehmigt", absenceRejected: "Abgelehnt", absenceApprove: "Genehmigen", absenceReject: "Ablehnen", absenceEmpty: "Keine Meldungen.",
    filterAll: "Alle",
    equipmentTab: "Fahrzeuge & Werkzeuge", equipmentVehicle: "Fahrzeug", equipmentTool: "Werkzeug", equipmentIdentifier: "Kennzeichen / Nummer", equipmentAssign: "Zuweisen", equipmentReturn: "Zurückgeben", equipmentFree: "Verfügbar", equipmentHistory: "Verlauf", equipmentEmpty: "Noch keine Geräte erfasst.", equipmentType: "Typ",
    exportTab: "Stundenexport", exportMonth: "Monat", exportDownload: "CSV herunterladen", exportEmpty: "Keine Stunden im gewählten Monat.", exportDays: "Arbeitstage",
    materialOrder: "Material bestellen", materialOrders: "Bestellungen", orderOpen: "Offen", orderOrdered: "Bestellt", orderDelivered: "Geliefert", ordersEmpty: "Keine Bestellungen.", orderNote: "Notiz",
    materialCatalog: "Materialstamm", materialCatalogEmpty: "Noch kein Material gespeichert.",
    materialUsed: "Verbrauchtes Material", materialAdd: "Hinzufügen", materialQty: "Menge", materialUnit: "Einheit", materialName: "Bezeichnung", materialNone: "Noch kein Material erfasst.",
    editBtn: "Bearbeiten", cancelBtn: "Abbrechen", saveBtn: "Speichern", overviewBtn: "Übersicht", languageLabel: "Sprache", nationalityLabel: "Nationalität", phoneLabel: "Telefon", nameLabel: "Name", readOnlyLabel: "Nur lesen (Arbeitsanweisung nicht bearbeitbar)", readOnlyHint: "Nur lesen – Schreiben ist für dieses Konto gesperrt.", commentEdited: "bearbeitet", commentDeleteAsk: "Diesen Beitrag löschen?",
    feedbackTab: "Feedback", feedbackTitle: "Tester-Feedback", feedbackIntro: "Bitte zu jedem Punkt kurz dein Feedback eintragen.", feedbackSend: "Feedback senden", feedbackThanks: "Danke für dein Feedback!", feedbackReview: "Abgegebenes Feedback", feedbackNone: "Noch kein Feedback vorhanden.",
    feedbackPoints: ["Anmeldung & Passwort", "Arbeitsanweisung & Kommentar", "Wetter-Funktion", "Übersetzungen", "Regiebericht erstellen", "PDF-Export", "Kalenderansichten", "Live-Übersetzer", "Bedienung am Handy", "Gesamteindruck & Fehler"],
    translatorHint: "Hinweis: Übersetzung per KI – nicht immer 100 % korrekt.",
    translatorTab: "Übersetzer", translatorTitle: "Live-Übersetzer", translatorPlaceholder: "Text eingeben…", translatorBtn: "Übersetzen", translatorSwap: "Sprachen tauschen",
    weather: "Wetter", weatherError: "Wetter/Standort nicht verfügbar",
    instructionDoc: "Arbeitsanweisung",
    help: "Anleitung",
    helpEmpty: "Anleitung noch nicht hinterlegt",
    dashOpen: "Öffnen",
    readLabel: "Gelesen",
    readUnread: "ungelesen",
    readAllDone: "alle gelesen",
    dashMyProjects: "Meine Projekte",
    dashToday: "Heute",
    dashTomorrow: "Morgen",
    dashWeek: "Woche",
    dashNextWeek: "Nächste Woche",
    dashMyProjectsToday: "Meine Projekte – heute",
    dashNothingToday: "Heute nichts geplant",
    dashNoProjects: "Noch keine Projekte zugewiesen",
    dashOverdue: "überfällig",
    dashDone: "fertig",
    msgFillRequired: "Bitte alle Pflichtfelder ausfüllen.",
    msgEmployeeDeleted: "Mitarbeiter wurde gelöscht.",
    msgNoEmailAddr: "Keine E-Mail-Adresse vorhanden.",
    msgCommentSavedOk: "✅ Kommentar gespeichert.",
    msgNoteSaved: "Notiz wurde gespeichert.",
    msgLogoUploaded: "Logo wurde hochgeladen. Bitte Firmendaten speichern.",
    msgPleaseLogin: "Bitte zuerst anmelden.",
    msgPmUnchanged: "Projektleiter unverändert.",
    msgPmChanged: "Projektleiter geändert.",
    msgPmNotFound: "Kein Projektleiter mit diesem Namen in der Mitarbeiterliste gefunden – Sichtbarkeit kann nicht übertragen werden.",
    msgProjectNoInstr: "Dieses Projekt hat noch keine Anweisungen.",
    msgTranslatingGeneric: "Übersetze...",
    msgReportPrepared: "Regiebericht wurde aus Arbeitsanweisung vorbereitet.",
    msgEmailNotEnabled: "🔒 E-Mail-Versand ist in deinem Paket nicht aktiviert.",
    assignVisibility: "Sichtbarkeit zuweisen",
    assignEmployees: "Mitarbeiter zuweisen",
    assignProjectManager: "Projektleiter zuweisen",
    instructionsLocked: "Arbeitsanweisungen anlegen ist nur für Projektleiter und Admins möglich.",
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
    saveAsNew: "Als neuen Bericht speichern",
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
    material: "Material",
    werkzeug: "Werkzeug",
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
    transferTitle: "Wohin übertragen?",
    transferInsert: "Hier einfügen",
    transferNoReports: "Keine gespeicherten Berichte",
    travelTime: "Fahrzeit",
    teamReports: "Mitarbeiter-Berichte",
    teamNoReports: "Keine Berichte vorhanden",
    travelOut: "Hinfahrt",
    travelReturn: "Rückfahrt",
    km: "km",
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
    msgNoDate: "Bitte ein Datum für die Arbeitsanweisung eintragen.",
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
  Spanisch: {
    navigate: "Cómo llegar",
    absenceReported: "Notificado",
    absenceTab: "Vacaciones y ausencias", absenceVacation: "Vacaciones", absenceSick: "Enfermedad", absenceFrom: "Desde", absenceTo: "Hasta", absenceRequest: "Solicitar", absencePending: "Abierto", absenceApproved: "Aprobado", absenceRejected: "Rechazado", absenceApprove: "Aprobar", absenceReject: "Rechazar", absenceEmpty: "No hay solicitudes.",
    filterAll: "Todos",
    equipmentTab: "Vehículos y herramientas", equipmentVehicle: "Vehículo", equipmentTool: "Herramienta", equipmentIdentifier: "Matrícula / número", equipmentAssign: "Asignar", equipmentReturn: "Devolver", equipmentFree: "Disponible", equipmentHistory: "Historial", equipmentEmpty: "Aún no hay equipos registrados.", equipmentType: "Tipo",
    exportTab: "Exportación de horas", exportMonth: "Mes", exportDownload: "Descargar CSV", exportEmpty: "No hay horas en el mes seleccionado.", exportDays: "Días trabajados",
    materialOrder: "Pedir material", materialOrders: "Pedidos", orderOpen: "Abierto", orderOrdered: "Pedido", orderDelivered: "Entregado", ordersEmpty: "No hay pedidos.", orderNote: "Nota",
    materialCatalog: "Catálogo de materiales", materialCatalogEmpty: "Aún no hay material guardado.",
    materialUsed: "Material consumido", materialAdd: "Añadir", materialQty: "Cantidad", materialUnit: "Unidad", materialName: "Denominación", materialNone: "Aún no se ha registrado material.",
    editBtn: "Editar", cancelBtn: "Cancelar", saveBtn: "Guardar", overviewBtn: "Resumen", languageLabel: "Idioma", nationalityLabel: "Nacionalidad", phoneLabel: "Teléfono", nameLabel: "Nombre", readOnlyLabel: "Solo lectura (la instrucción no se puede editar)", readOnlyHint: "Solo lectura: la escritura está bloqueada para esta cuenta.", commentEdited: "editado", commentDeleteAsk: "¿Eliminar esta entrada?",
    feedbackTab: "Comentarios", feedbackTitle: "Comentarios del tester", feedbackIntro: "Por favor, añade un breve comentario para cada punto.", feedbackSend: "Enviar comentarios", feedbackThanks: "¡Gracias por tus comentarios!", feedbackReview: "Comentarios recibidos", feedbackNone: "Aún no hay comentarios.",
    feedbackPoints: ["Inicio de sesión y contraseña", "Instrucción de trabajo y comentario", "Función meteorológica", "Traducciones", "Crear informe", "Exportar PDF", "Vistas de calendario", "Traductor en vivo", "Uso en el móvil", "Impresión general y errores"],
    translatorHint: "Nota: traducción con IA, no siempre 100 % correcta.",
    translatorTab: "Traductor", translatorTitle: "Traductor en vivo", translatorPlaceholder: "Introduce el texto…", translatorBtn: "Traducir", translatorSwap: "Intercambiar idiomas",
    weather: "Tiempo", weatherError: "Tiempo/ubicación no disponible",
    instructionDoc: "Instrucción de trabajo",
    help: "Instrucciones",
    helpEmpty: "Instrucciones aún no disponibles",
    dashOpen: "Abrir",
    readLabel: "Leído",
    readUnread: "no leído",
    readAllDone: "todos leídos",
    dashMyProjects: "Mis proyectos",
    dashToday: "Hoy",
    dashTomorrow: "Mañana",
    dashWeek: "Semana",
    dashNextWeek: "Próxima semana",
    dashMyProjectsToday: "Mis proyectos – hoy",
    dashNothingToday: "Nada planificado para hoy",
    dashNoProjects: "Aún no hay proyectos asignados",
    dashOverdue: "vencido",
    dashDone: "terminado",
    msgFillRequired: "Por favor, rellena todos los campos obligatorios.",
    msgEmployeeDeleted: "El empleado ha sido eliminado.",
    msgNoEmailAddr: "No hay dirección de correo electrónico.",
    msgCommentSavedOk: "✅ Comentario guardado.",
    msgNoteSaved: "La nota se ha guardado.",
    msgLogoUploaded: "El logotipo se ha subido. Guarda los datos de la empresa.",
    msgPleaseLogin: "Por favor, inicia sesión primero.",
    msgPmUnchanged: "Jefe de proyecto sin cambios.",
    msgPmChanged: "Jefe de proyecto cambiado.",
    msgPmNotFound: "No se encontró ningún jefe de proyecto con ese nombre en la lista de empleados: no se puede transferir la visibilidad.",
    msgProjectNoInstr: "Este proyecto aún no tiene instrucciones.",
    msgTranslatingGeneric: "Traduciendo...",
    msgReportPrepared: "El informe se ha preparado a partir de la instrucción de trabajo.",
    msgEmailNotEnabled: "🔒 El envío por correo no está activado en tu paquete.",
    assignVisibility: "Asignar visibilidad",
    assignEmployees: "Asignar empleados",
    assignProjectManager: "Asignar jefe de proyecto",
    instructionsLocked: "Solo los jefes de proyecto y administradores pueden crear instrucciones de trabajo.",
    title: "Regie International",
    subtitle: "Crear, traducir, guardar y enviar instrucciones de trabajo e informes.",
    loginTitle: "Acceso al informe",
    email: "Correo electrónico",
    password: "Contraseña",
    login: "Iniciar sesión",
    register: "Registrarse",
    logout: "Cerrar sesión",
    loggedInAs: "Conectado como",
    saveLoad: "Guardar / cargar informe",
    reportName: "Nombre del informe, p. ej. Sem 22 - mañana",
    saveReport: "Guardar informe",
    updateReport: "Actualizar informe",
    newReport: "Nuevo informe",
    savedReports: "Mis informes guardados",
    loadEdit: "Cargar / editar",
    delete: "Eliminar",
    general: "Datos generales",
    appLanguage: "Idioma de la app",
    pdfLanguage: "Idioma del PDF",
    employee: "Empleado",
    calendarWeek: "Semana natural",
    recipientEmail: "Correo del destinatario para envío de PDF",
    customer: "Cliente",
    projectNumber: "Número de proyecto",
    site: "Obra",
    hours: "Horas",
    startTime: "Inicio",
    endTime: "Fin",
    breakLabel: "Pausa (min.)",
    description: "Descripción del trabajo",
    translation: "Traducción",
    deletePhoto: "Eliminar foto",
    hoursOverview: "Resumen de horas",
    total: "Total",
    translateWeek: "Traducir semana",
    translating: "Traduciendo...",
    save: "Guardar",
    update: "Actualizar",
    saveAsNew: "Guardar como nuevo informe",
    downloadPdf: "Descargar PDF",
    sendPdf: "Enviar PDF por correo",
    dashboard: "Panel",
    projects: "Proyectos",
    workInstructions: "Instrucciones de trabajo",
    dueToday: "Vence hoy",
    totalProgress: "Progreso total",
    stoppedSteps: "Pasos detenidos",
    stepsInProgress: "Pasos en curso",
    noProject: "Sin proyecto",
    projectsTab: "Proyectos",
    projectName: "Nombre del proyecto",
    projectCustomer: "Cliente",
    projectSite: "Obra",
    projectManager: "Jefe de proyecto",
    saveProject: "Guardar proyecto",
    deleteProject: "Eliminar proyecto",
    openProject: "Abrir proyecto",
    closeProject: "Cerrar",
    progress: "Progreso",
    noInstructions: "Aún no hay instrucciones de trabajo para este proyecto.",
    noReports: "Aún no hay informes para este proyecto.",
    reportsTab: "Informes",
    newInstruction: "Nueva instrucción de trabajo",
    instructionTitle: "Título",
    selectProject: "Seleccionar proyecto",
    problems: "Problemas / notas",
    material: "Material",
    werkzeug: "Herramienta",
    workSteps: "Pasos de trabajo",
    addStep: "+ Paso de trabajo",
    saveInstruction: "Guardar instrucción de trabajo",
    savedInstructions: "Instrucciones de trabajo guardadas",
    noInstructionsSaved: "Aún no hay instrucciones de trabajo.",
    date: "Fecha",
    project: "Proyecto",
    translateTo: "Traducir a",
    translating2: "Traduciendo...",
    translated: "Traducido",
    feedback: "Respuesta",
    saveFeedback: "Guardar respuesta",
    toReport: "Transferir al informe",
    transferTitle: "¿Adónde transferir?",
    transferInsert: "Insertar aquí",
    transferNoReports: "No hay informes guardados",
    travelTime: "Tiempo de viaje",
    teamReports: "Informes de empleados",
    teamNoReports: "No hay informes disponibles",
    travelOut: "Ida",
    travelReturn: "Vuelta",
    km: "km",
    deleteInstruction: "Eliminar instrucción de trabajo",
    autoReportLocked: "Los informes automáticos no están activados en tu paquete.",
    employeeManagement: "Gestión de empleados",
    name: "Nombre",
    role: "Rol",
    addEmployee: "Añadir empleado",
    currentEmployees: "Empleados actuales",
    resetPassword: "Restablecer contraseña",
    companyData: "Datos de la empresa",
    uploadLogo: "Subir logotipo de la empresa",
    companyName: "Nombre de la empresa",
    street: "Calle",
    zip: "Código postal",
    city: "Ciudad",
    phone: "Teléfono",
    website: "Sitio web",
    taxNumber: "CIF / NIF",
    saveCompany: "Guardar datos de la empresa",
    reportNameLabel: "Nombre del informe",
    firma: "Empresa",
    feedbackLabel: "Respuesta",
    noProjectsYet: "Aún no hay proyectos.",
    weekdays: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
    noInstructionsYet: "Aún no hay instrucciones de trabajo.",
    msgLoginOk: "Sesión iniciada correctamente.",
    msgLogout: "Has cerrado sesión.",
    msgRegisterOk: "Registro correcto.",
    msgRegisterFail: "Registro fallido: ",
    msgLoginFail: "Error de inicio de sesión: ",
    msgSaved: "El nuevo informe se ha guardado.",
    msgUpdated: "El informe se ha actualizado.",
    msgLoaded: "El informe se ha cargado.",
    msgDeleted: "El informe se ha eliminado.",
    msgTranslated: "La semana se ha traducido.",
    msgTranslateErr: "Error al traducir: ",
    msgPhotoUploading: "Subiendo fotos...",
    msgPhotoOk: "Las fotos se han subido.",
    msgPhotoErr: "Error al subir fotos: ",
    msgPhotoLimit: "Máximo {n} fotos permitidas.",
    msgSaving: "Guardando instrucción de trabajo...",
    msgNoFirm: "No hay empresa cargada.",
    msgNoTitle: "Introduce el título de la instrucción de trabajo.",
    msgNoDate: "Introduce una fecha para la instrucción de trabajo.",
    msgInstructionSaved: "Instrucción de trabajo guardada.",
    msgInstructionDeleted: "Instrucción de trabajo eliminada.",
    msgFeedbackSaved: "Respuesta guardada.",
    msgEmployeeAdded: "El empleado se ha creado.",
    msgPasswordReset: "Se ha enviado el correo para restablecer la contraseña.",
    msgCompanySaved: "Los datos de la empresa se han guardado.",
    msgProjectSaved: "Proyecto guardado.",
    msgProjectDeleted: "Proyecto eliminado.",
    msgInstructionTranslated: "La instrucción de trabajo se ha traducido.",
    msgNewReport: "Nuevo informe iniciado.",
    msgNoEmployee: "Introduce el empleado.",
    msgEmailRequired: "Introduce el correo del destinatario.",
    msgEmailSending: "Enviando el PDF por correo...",
    msgEmailSent: "El PDF se ha enviado por correo.",
    tabReport: "Informe",
    photos: "Fotos",
    deletePhoto2: "Eliminar foto",
    tabDay: "Vista diaria",
    tabWeek: "Vista semanal",
    weekView: "Vista semanal",
    noInstructionsDay: "No hay instrucciones para este día.",
    noInstructionsWeek: "No hay instrucciones para esta semana.",
    noInstructionsMonth: "No hay instrucciones para este mes.",
    tabMonth: "Vista mensual",
    dayView: "Vista diaria",
    monthView: "Vista mensual",
    selectDate: "Elegir fecha",
    noEntries: "No se encontraron entradas.",
    totalHoursMonth: "Horas totales del mes",
    hoursPerProject: "Horas por proyecto",
    dailyEntry: "Entrada diaria",
    saveDayEntry: "Guardar entrada diaria",
    week: "Semana",
    statusOpen: "⬜ Abierto",
    statusInProgress: "🟡 En curso",
    statusStopped: "⛔ Detenido",
    statusCompleted: "✅ Terminado",
    problemsHints: "Problemas / notas",
    roleEmployee: "Empleado",
    roleProjectManager: "Jefe de proyecto",
    roleAdmin: "Administrador",
    commentLabel: "Comentario",
    commentPlaceholder: "Introduce un comentario...",
    commentSaveBtn: "Guardar",
    commentSaving: "Guardando…",
    commentSaved: "Guardado",
    commentErrorLabel: "Error",
    charsLabel: "caracteres",
    copyInstruction: "Copiar pasos",
    copyTitle: "Copiar pasos de una instrucción",
    copySource: "Seleccionar instrucción",
    copyWhichSteps: "¿Qué pasos de trabajo copiar?",
    copyAllNone: "Todos / Ninguno",
    copyNoSteps: "No hay pasos de trabajo.",
    copyCancel: "Cancelar",
    copyConfirm: "Aplicar",
    copySelectSource: "Elige una instrucción.",
    copyDone: "Los pasos de trabajo se han aplicado.",
  },
  Rumänisch: {
    navigate: "Navigare",
    absenceReported: "Raportat",
    absenceTab: "Concediu și absențe", absenceVacation: "Concediu", absenceSick: "Boală", absenceFrom: "De la", absenceTo: "Până la", absenceRequest: "Solicită", absencePending: "Deschis", absenceApproved: "Aprobat", absenceRejected: "Respins", absenceApprove: "Aprobă", absenceReject: "Respinge", absenceEmpty: "Nicio solicitare.",
    filterAll: "Toate",
    equipmentTab: "Vehicule și scule", equipmentVehicle: "Vehicul", equipmentTool: "Sculă", equipmentIdentifier: "Număr înmatriculare / număr", equipmentAssign: "Atribuie", equipmentReturn: "Returnează", equipmentFree: "Disponibil", equipmentHistory: "Istoric", equipmentEmpty: "Încă nu există echipamente.", equipmentType: "Tip",
    exportTab: "Export ore", exportMonth: "Luna", exportDownload: "Descarcă CSV", exportEmpty: "Nicio oră în luna selectată.", exportDays: "Zile lucrate",
    materialOrder: "Comandă material", materialOrders: "Comenzi", orderOpen: "Deschis", orderOrdered: "Comandat", orderDelivered: "Livrat", ordersEmpty: "Nicio comandă.", orderNote: "Notă",
    materialCatalog: "Catalog de materiale", materialCatalogEmpty: "Încă nu există materiale salvate.",
    materialUsed: "Material consumat", materialAdd: "Adaugă", materialQty: "Cantitate", materialUnit: "Unitate", materialName: "Denumire", materialNone: "Încă nu a fost înregistrat material.",
    editBtn: "Editează", cancelBtn: "Anulează", saveBtn: "Salvează", overviewBtn: "Prezentare generală", languageLabel: "Limbă", nationalityLabel: "Naționalitate", phoneLabel: "Telefon", nameLabel: "Nume", readOnlyLabel: "Doar citire (instrucțiunea nu poate fi editată)", readOnlyHint: "Doar citire – scrierea este blocată pentru acest cont.", commentEdited: "editat", commentDeleteAsk: "Ștergeți această înregistrare?",
    feedbackTab: "Feedback", feedbackTitle: "Feedback tester", feedbackIntro: "Te rugăm să adaugi pe scurt feedback pentru fiecare punct.", feedbackSend: "Trimite feedback", feedbackThanks: "Mulțumim pentru feedback!", feedbackReview: "Feedback primit", feedbackNone: "Încă nu există feedback.",
    feedbackPoints: ["Autentificare & parolă", "Instrucțiune & comentariu", "Funcția meteo", "Traduceri", "Creare raport", "Export PDF", "Vizualizări calendar", "Traducător live", "Utilizare pe telefon", "Impresie generală & erori"],
    translatorHint: "Notă: Traducere realizată de IA – nu întotdeauna 100% corectă.",
    translatorTab: "Traducător", translatorTitle: "Traducător live", translatorPlaceholder: "Introduceți textul…", translatorBtn: "Traduce", translatorSwap: "Schimbă limbile",
    weather: "Vreme", weatherError: "Vremea/locația nu este disponibilă",
    instructionDoc: "Instrucțiune de lucru",
    help: "Instrucțiuni",
    helpEmpty: "Instrucțiunile nu sunt încă disponibile",
    dashOpen: "Deschide",
    readLabel: "Citit",
    readUnread: "necitit",
    readAllDone: "toate citite",
    dashMyProjects: "Proiectele mele",
    dashToday: "Azi",
    dashTomorrow: "Mâine",
    dashWeek: "Săptămână",
    dashNextWeek: "Săptămâna viitoare",
    dashMyProjectsToday: "Proiectele mele – azi",
    dashNothingToday: "Nimic planificat azi",
    dashNoProjects: "Niciun proiect atribuit",
    dashOverdue: "întârziat",
    dashDone: "gata",
    msgFillRequired: "Vă rugăm completați toate câmpurile obligatorii.",
    msgEmployeeDeleted: "Angajatul a fost șters.",
    msgNoEmailAddr: "Nu există adresă de e-mail.",
    msgCommentSavedOk: "✅ Comentariu salvat.",
    msgNoteSaved: "Nota a fost salvată.",
    msgLogoUploaded: "Logoul a fost încărcat. Vă rugăm salvați datele firmei.",
    msgPleaseLogin: "Vă rugăm autentificați-vă mai întâi.",
    msgPmUnchanged: "Șeful de proiect neschimbat.",
    msgPmChanged: "Șeful de proiect a fost schimbat.",
    msgPmNotFound: "Nu s-a găsit niciun șef de proiect cu acest nume în lista de angajați – vizibilitatea nu poate fi transferată.",
    msgProjectNoInstr: "Acest proiect nu are încă instrucțiuni.",
    msgTranslatingGeneric: "Se traduce...",
    msgReportPrepared: "Raportul de lucru a fost pregătit din instrucțiunea de lucru.",
    msgEmailNotEnabled: "🔒 Trimiterea de e-mailuri nu este activată în pachetul tău.",
    assignVisibility: "Atribuie vizibilitate",
    assignEmployees: "Atribuie angajați",
    assignProjectManager: "Atribuie șef de proiect",
    instructionsLocked: "Crearea instrucțiunilor de lucru este posibilă doar pentru șefii de proiect și administratori.",
    title: "Regie International",
    subtitle: "Înregistrați, traduceți, salvați și trimiteți instrucțiuni de lucru și rapoarte de lucru.",
    loginTitle: "Autentificare raport de lucru",
    email: "E-mail",
    password: "Parolă",
    login: "Autentificare",
    register: "Înregistrare",
    logout: "Deconectare",
    loggedInAs: "Autentificat ca",
    saveLoad: "Salvare / încărcare raport",
    reportName: "Nume raport, de ex. săpt. 22 - dimineață",
    saveReport: "Salvare raport",
    updateReport: "Actualizare raport",
    newReport: "Raport nou",
    savedReports: "Rapoartele mele salvate",
    loadEdit: "Încărcare / editare",
    delete: "Ștergere",
    general: "Date generale",
    appLanguage: "Limba aplicației",
    pdfLanguage: "Limba PDF",
    employee: "Angajat",
    calendarWeek: "Săptămâna calendaristică",
    recipientEmail: "E-mail destinatar pentru trimitere PDF",
    customer: "Client",
    projectNumber: "Număr proiect",
    site: "Șantier",
    hours: "Ore",
    startTime: "Început",
    endTime: "Sfârșit",
    breakLabel: "Pauză (min.)",
    description: "Descrierea lucrării",
    translation: "Traducere",
    deletePhoto: "Ștergere fotografie",
    hoursOverview: "Prezentare ore",
    total: "Total",
    translateWeek: "Traducere săptămână",
    translating: "Se traduce...",
    save: "Salvare",
    update: "Actualizare",
    saveAsNew: "Salvează ca raport nou",
    downloadPdf: "Descărcare PDF",
    sendPdf: "Trimitere PDF prin e-mail",
    dashboard: "Tablou de bord",
    projects: "Proiecte",
    workInstructions: "Instrucțiuni de lucru",
    dueToday: "Scadent azi",
    totalProgress: "Progres total",
    stoppedSteps: "Etape de lucru oprite",
    stepsInProgress: "Etape de lucru în curs",
    noProject: "Niciun proiect",
    projectsTab: "Proiecte",
    projectName: "Nume proiect",
    projectCustomer: "Client",
    projectSite: "Șantier",
    projectManager: "Șef de proiect",
    saveProject: "Salvare proiect",
    deleteProject: "Ștergere proiect",
    openProject: "Deschidere proiect",
    closeProject: "Închidere",
    progress: "Progres",
    noInstructions: "Încă nicio instrucțiune de lucru pentru acest proiect.",
    noReports: "Încă niciun raport de lucru pentru acest proiect.",
    reportsTab: "Rapoarte de lucru",
    newInstruction: "Instrucțiune de lucru nouă",
    instructionTitle: "Titlu",
    selectProject: "Selectare proiect",
    problems: "Probleme / observații",
    material: "Material",
    werkzeug: "Unelte",
    workSteps: "Etape de lucru",
    addStep: "+ Etapă de lucru",
    saveInstruction: "Salvare instrucțiune de lucru",
    savedInstructions: "Instrucțiuni de lucru salvate",
    noInstructionsSaved: "Încă nu există instrucțiuni de lucru.",
    date: "Data",
    project: "Proiect",
    translateTo: "Traducere în",
    translating2: "Se traduce...",
    translated: "Tradus",
    feedback: "Feedback",
    saveFeedback: "Salvare feedback",
    toReport: "Preluare în raportul de lucru",
    transferTitle: "Unde să transfer?",
    transferInsert: "Inserează aici",
    transferNoReports: "Niciun raport salvat",
    travelTime: "Timp de deplasare",
    teamReports: "Rapoartele angajaților",
    teamNoReports: "Niciun raport disponibil",
    travelOut: "Dus",
    travelReturn: "Întors",
    km: "km",
    deleteInstruction: "Ștergere instrucțiune de lucru",
    autoReportLocked: "Rapoartele de lucru automate nu sunt activate în pachetul dumneavoastră.",
    employeeManagement: "Administrare angajați",
    name: "Nume",
    role: "Rol",
    addEmployee: "Adăugare angajat",
    currentEmployees: "Angajați actuali",
    resetPassword: "Resetare parolă",
    companyData: "Date firmă",
    uploadLogo: "Încărcare logo firmă",
    companyName: "Nume firmă",
    street: "Stradă",
    zip: "Cod poștal",
    city: "Localitate",
    phone: "Telefon",
    website: "Site web",
    taxNumber: "Cod fiscal / CUI",
    saveCompany: "Salvare date firmă",
    reportNameLabel: "Nume raport",
    firma: "Firmă",
    feedbackLabel: "Feedback",
    noProjectsYet: "Încă nu există proiecte.",
    weekdays: ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"],
    noInstructionsYet: "Încă nu există instrucțiuni de lucru.",
    msgLoginOk: "Autentificare reușită.",
    msgLogout: "Ați fost deconectat.",
    msgRegisterOk: "Înregistrare reușită.",
    msgRegisterFail: "Înregistrare eșuată: ",
    msgLoginFail: "Autentificare eșuată: ",
    msgSaved: "Raportul nou a fost salvat.",
    msgUpdated: "Raportul a fost actualizat.",
    msgLoaded: "Raportul a fost încărcat.",
    msgDeleted: "Raportul a fost șters.",
    msgTranslated: "Săptămâna a fost tradusă.",
    msgTranslateErr: "Eroare la traducere: ",
    msgPhotoUploading: "Se încarcă fotografiile...",
    msgPhotoOk: "Fotografiile au fost încărcate.",
    msgPhotoErr: "Eroare la încărcarea fotografiilor: ",
    msgPhotoLimit: "Sunt permise maximum {n} fotografii.",
    msgSaving: "Se salvează instrucțiunea de lucru...",
    msgNoFirm: "Nicio firmă încărcată.",
    msgNoTitle: "Vă rugăm să introduceți titlul instrucțiunii de lucru.",
    msgNoDate: "Vă rugăm să introduceți o dată pentru instrucțiunea de lucru.",
    msgInstructionSaved: "Instrucțiunea de lucru a fost salvată.",
    msgInstructionDeleted: "Instrucțiunea de lucru a fost ștearsă.",
    msgFeedbackSaved: "Feedbackul a fost salvat.",
    msgEmployeeAdded: "Angajatul a fost creat.",
    msgPasswordReset: "E-mailul de resetare a parolei a fost trimis.",
    msgCompanySaved: "Datele firmei au fost salvate.",
    msgProjectSaved: "Proiectul a fost salvat.",
    msgProjectDeleted: "Proiectul a fost șters.",
    msgInstructionTranslated: "Instrucțiunea de lucru a fost tradusă.",
    msgNewReport: "A fost început un raport nou.",
    msgNoEmployee: "Vă rugăm să introduceți angajatul.",
    msgEmailRequired: "Vă rugăm să introduceți e-mailul destinatarului.",
    msgEmailSending: "PDF-ul se trimite prin e-mail...",
    msgEmailSent: "PDF-ul a fost trimis prin e-mail.",
    tabReport: "Raport de lucru",
    photos: "Fotografii",
    deletePhoto2: "Ștergere fotografie",
    tabDay: "Vizualizare zi",
    tabWeek: "Vizualizare săptămână",
    weekView: "Vizualizare săptămână",
    noInstructionsDay: "Nicio instrucțiune de lucru pentru această zi.",
    noInstructionsWeek: "Nicio instrucțiune de lucru pentru această săptămână.",
    noInstructionsMonth: "Nicio instrucțiune de lucru pentru această lună.",
    tabMonth: "Vizualizare lună",
    dayView: "Vizualizare zi",
    monthView: "Vizualizare lună",
    selectDate: "Selectare dată",
    noEntries: "Nu s-au găsit înregistrări.",
    totalHoursMonth: "Total ore în lună",
    hoursPerProject: "Ore pe proiect",
    dailyEntry: "Înregistrare zilnică",
    saveDayEntry: "Salvare înregistrare zilnică",
    week: "Săptămâna",
    statusOpen: "⬜ Deschis",
    statusInProgress: "🟡 În lucru",
    statusStopped: "⛔ Oprit",
    statusCompleted: "✅ Finalizat",
    problemsHints: "Probleme / observații",
    roleEmployee: "Angajat",
    roleProjectManager: "Șef de proiect",
    roleAdmin: "Administrator",
    commentLabel: "Comentariu",
    commentPlaceholder: "Introduceți comentariul...",
    commentSaveBtn: "Salvare",
    commentSaving: "Se salvează…",
    commentSaved: "Salvat",
    commentErrorLabel: "Eroare",
    charsLabel: "Caractere",
    copyInstruction: "Copiere etape",
    copyTitle: "Preluare etape din instrucțiune",
    copySource: "Selectare instrucțiune",
    copyWhichSteps: "Ce etape de lucru se preiau?",
    copyAllNone: "Toate / niciuna",
    copyNoSteps: "Nu există etape de lucru.",
    copyCancel: "Anulare",
    copyConfirm: "Preluare",
    copySelectSource: "Vă rugăm să selectați instrucțiunea.",
    copyDone: "Etapele de lucru au fost preluate.",
  },
  Englisch: {
    navigate: "Directions",
    absenceReported: "Reported",
    absenceTab: "Leave & absence", absenceVacation: "Vacation", absenceSick: "Sick leave", absenceFrom: "From", absenceTo: "To", absenceRequest: "Request", absencePending: "Open", absenceApproved: "Approved", absenceRejected: "Rejected", absenceApprove: "Approve", absenceReject: "Reject", absenceEmpty: "No requests.",
    filterAll: "All",
    equipmentTab: "Vehicles & tools", equipmentVehicle: "Vehicle", equipmentTool: "Tool", equipmentIdentifier: "Plate / number", equipmentAssign: "Assign", equipmentReturn: "Return", equipmentFree: "Available", equipmentHistory: "History", equipmentEmpty: "No equipment recorded yet.", equipmentType: "Type",
    exportTab: "Hours export", exportMonth: "Month", exportDownload: "Download CSV", exportEmpty: "No hours in the selected month.", exportDays: "Working days",
    materialOrder: "Order material", materialOrders: "Orders", orderOpen: "Open", orderOrdered: "Ordered", orderDelivered: "Delivered", ordersEmpty: "No orders.", orderNote: "Note",
    materialCatalog: "Material catalogue", materialCatalogEmpty: "No material saved yet.",
    materialUsed: "Material used", materialAdd: "Add", materialQty: "Quantity", materialUnit: "Unit", materialName: "Description", materialNone: "No material recorded yet.",
    editBtn: "Edit", cancelBtn: "Cancel", saveBtn: "Save", overviewBtn: "Overview", languageLabel: "Language", nationalityLabel: "Nationality", phoneLabel: "Phone", nameLabel: "Name", readOnlyLabel: "Read only (work instruction cannot be edited)", readOnlyHint: "Read only – writing is disabled for this account.", commentEdited: "edited", commentDeleteAsk: "Delete this entry?",
    feedbackTab: "Feedback", feedbackTitle: "Tester feedback", feedbackIntro: "Please add short feedback for each point.", feedbackSend: "Send feedback", feedbackThanks: "Thanks for your feedback!", feedbackReview: "Submitted feedback", feedbackNone: "No feedback yet.",
    feedbackPoints: ["Login & password", "Work instruction & comment", "Weather feature", "Translations", "Create report", "PDF export", "Calendar views", "Live translator", "Mobile usability", "Overall & bugs"],
    translatorHint: "Note: AI translation – not always 100% accurate.",
    translatorTab: "Translator", translatorTitle: "Live translator", translatorPlaceholder: "Enter text…", translatorBtn: "Translate", translatorSwap: "Swap languages",
    weather: "Weather", weatherError: "Weather/location unavailable",
    instructionDoc: "Work instruction",
    help: "Guide",
    helpEmpty: "Guide not available yet",
    dashOpen: "Open",
    readLabel: "Read",
    readUnread: "unread",
    readAllDone: "all read",
    dashMyProjects: "My projects",
    dashToday: "Today",
    dashTomorrow: "Tomorrow",
    dashWeek: "Week",
    dashNextWeek: "Next week",
    dashMyProjectsToday: "My projects – today",
    dashNothingToday: "Nothing planned today",
    dashNoProjects: "No projects assigned yet",
    dashOverdue: "overdue",
    dashDone: "done",
    msgFillRequired: "Please fill in all required fields.",
    msgEmployeeDeleted: "Employee has been deleted.",
    msgNoEmailAddr: "No email address available.",
    msgCommentSavedOk: "✅ Comment saved.",
    msgNoteSaved: "Note has been saved.",
    msgLogoUploaded: "Logo has been uploaded. Please save the company data.",
    msgPleaseLogin: "Please log in first.",
    msgPmUnchanged: "Project manager unchanged.",
    msgPmChanged: "Project manager changed.",
    msgPmNotFound: "No project manager with this name found in the employee list – visibility cannot be transferred.",
    msgProjectNoInstr: "This project has no work instructions yet.",
    msgTranslatingGeneric: "Translating...",
    msgReportPrepared: "Work report has been prepared from the work instruction.",
    msgEmailNotEnabled: "🔒 Email sending is not enabled in your plan.",
    assignVisibility: "Assign visibility",
    assignEmployees: "Assign employees",
    assignProjectManager: "Assign project manager",
    instructionsLocked: "Creating work instructions is only possible for project managers and admins.",
    title: "Regie International",
    subtitle: "Create, translate, save and send work instructions and work reports.",
    loginTitle: "Work Report Login",
    email: "Email",
    password: "Password",
    login: "Log in",
    register: "Register",
    logout: "Log out",
    loggedInAs: "Logged in as",
    saveLoad: "Save / load report",
    reportName: "Report name, e.g. CW 22 - morning",
    saveReport: "Save report",
    updateReport: "Update report",
    newReport: "New report",
    savedReports: "My saved reports",
    loadEdit: "Load / edit",
    delete: "Delete",
    general: "General information",
    appLanguage: "App language",
    pdfLanguage: "PDF language",
    employee: "Employee",
    calendarWeek: "Calendar week",
    recipientEmail: "Recipient email for PDF",
    customer: "Customer",
    projectNumber: "Project number",
    site: "Site",
    hours: "Hours",
    startTime: "Start",
    endTime: "End",
    breakLabel: "Break (min.)",
    description: "Work description",
    translation: "Translation",
    deletePhoto: "Delete photo",
    hoursOverview: "Hours overview",
    total: "Total",
    translateWeek: "Translate week",
    translating: "Translating...",
    save: "Save",
    update: "Update",
    saveAsNew: "Save as new report",
    downloadPdf: "Download PDF",
    sendPdf: "Send PDF by email",
    dashboard: "Dashboard",
    projects: "Projects",
    workInstructions: "Work instructions",
    dueToday: "Due today",
    totalProgress: "Total progress",
    stoppedSteps: "Stopped work steps",
    stepsInProgress: "Work steps in progress",
    noProject: "No project",
    projectsTab: "Projects",
    projectName: "Project name",
    projectCustomer: "Customer",
    projectSite: "Site",
    projectManager: "Project manager",
    saveProject: "Save project",
    deleteProject: "Delete project",
    openProject: "Open project",
    closeProject: "Close",
    progress: "Progress",
    noInstructions: "No work instructions for this project yet.",
    noReports: "No work reports for this project yet.",
    reportsTab: "Work reports",
    newInstruction: "New work instruction",
    instructionTitle: "Title",
    selectProject: "Select project",
    problems: "Problems / notes",
    material: "Material",
    werkzeug: "Tools",
    workSteps: "Work steps",
    addStep: "+ Work step",
    saveInstruction: "Save work instruction",
    savedInstructions: "Saved work instructions",
    noInstructionsSaved: "No work instructions yet.",
    date: "Date",
    project: "Project",
    translateTo: "Translate to",
    translating2: "Translating...",
    translated: "Translated",
    feedback: "Feedback",
    saveFeedback: "Save feedback",
    toReport: "Add to work report",
    transferTitle: "Transfer where?",
    transferInsert: "Insert here",
    transferNoReports: "No saved reports",
    travelTime: "Travel time",
    teamReports: "Employee reports",
    teamNoReports: "No reports available",
    travelOut: "Outbound",
    travelReturn: "Return",
    km: "km",
    deleteInstruction: "Delete work instruction",
    autoReportLocked: "Automatic work reports are not enabled in your plan.",
    employeeManagement: "Employee management",
    name: "Name",
    role: "Role",
    addEmployee: "Add employee",
    currentEmployees: "Current employees",
    resetPassword: "Reset password",
    companyData: "Company data",
    uploadLogo: "Upload company logo",
    companyName: "Company name",
    street: "Street",
    zip: "Postal code",
    city: "City",
    phone: "Phone",
    website: "Website",
    taxNumber: "VAT / tax number",
    saveCompany: "Save company data",
    reportNameLabel: "Report name",
    firma: "Company",
    feedbackLabel: "Feedback",
    noProjectsYet: "No projects yet.",
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    noInstructionsYet: "No work instructions yet.",
    msgLoginOk: "Login successful.",
    msgLogout: "You have been logged out.",
    msgRegisterOk: "Registration successful.",
    msgRegisterFail: "Registration failed: ",
    msgLoginFail: "Login failed: ",
    msgSaved: "New report has been saved.",
    msgUpdated: "Report has been updated.",
    msgLoaded: "Report has been loaded.",
    msgDeleted: "Report has been deleted.",
    msgTranslated: "Week has been translated.",
    msgTranslateErr: "Translation error: ",
    msgPhotoUploading: "Uploading photos...",
    msgPhotoOk: "Photos have been uploaded.",
    msgPhotoErr: "Photo upload error: ",
    msgPhotoLimit: "A maximum of {n} photos is allowed.",
    msgSaving: "Saving work instruction...",
    msgNoFirm: "No company loaded.",
    msgNoTitle: "Please enter a title for the work instruction.",
    msgNoDate: "Please enter a date for the work instruction.",
    msgInstructionSaved: "Work instruction saved.",
    msgInstructionDeleted: "Work instruction deleted.",
    msgFeedbackSaved: "Feedback saved.",
    msgEmployeeAdded: "Employee has been created.",
    msgPasswordReset: "Password reset email has been sent.",
    msgCompanySaved: "Company data has been saved.",
    msgProjectSaved: "Project saved.",
    msgProjectDeleted: "Project deleted.",
    msgInstructionTranslated: "Work instruction has been translated.",
    msgNewReport: "New report started.",
    msgNoEmployee: "Please enter an employee.",
    msgEmailRequired: "Please enter the recipient email.",
    msgEmailSending: "Sending PDF by email...",
    msgEmailSent: "PDF has been sent by email.",
    tabReport: "Work report",
    photos: "Photos",
    deletePhoto2: "Delete photo",
    tabDay: "Day view",
    tabWeek: "Week view",
    weekView: "Week view",
    noInstructionsDay: "No work instructions for this day.",
    noInstructionsWeek: "No work instructions for this week.",
    noInstructionsMonth: "No work instructions for this month.",
    tabMonth: "Month view",
    dayView: "Day view",
    monthView: "Month view",
    selectDate: "Select date",
    noEntries: "No entries found.",
    totalHoursMonth: "Total hours in month",
    hoursPerProject: "Hours per project",
    dailyEntry: "Daily entry",
    saveDayEntry: "Save daily entry",
    week: "Week",
    statusOpen: "⬜ Open",
    statusInProgress: "🟡 In progress",
    statusStopped: "⛔ Stopped",
    statusCompleted: "✅ Completed",
    problemsHints: "Problems / notes",
    roleEmployee: "Employee",
    roleProjectManager: "Project manager",
    roleAdmin: "Admin",
    commentLabel: "Comment",
    commentPlaceholder: "Enter comment...",
    commentSaveBtn: "Save",
    commentSaving: "Saving…",
    commentSaved: "Saved",
    commentErrorLabel: "Error",
    charsLabel: "Characters",
    copyInstruction: "Copy steps",
    copyTitle: "Copy steps from instruction",
    copySource: "Select instruction",
    copyWhichSteps: "Which work steps to copy?",
    copyAllNone: "All / none",
    copyNoSteps: "No work steps available.",
    copyCancel: "Cancel",
    copyConfirm: "Apply",
    copySelectSource: "Please select an instruction.",
    copyDone: "Work steps have been applied.",
  },
  Italienisch: {
    navigate: "Indicazioni",
    absenceReported: "Segnalato",
    absenceTab: "Ferie e assenze", absenceVacation: "Ferie", absenceSick: "Malattia", absenceFrom: "Dal", absenceTo: "Al", absenceRequest: "Richiedi", absencePending: "Aperto", absenceApproved: "Approvato", absenceRejected: "Rifiutato", absenceApprove: "Approva", absenceReject: "Rifiuta", absenceEmpty: "Nessuna richiesta.",
    filterAll: "Tutti",
    equipmentTab: "Veicoli e attrezzi", equipmentVehicle: "Veicolo", equipmentTool: "Attrezzo", equipmentIdentifier: "Targa / numero", equipmentAssign: "Assegna", equipmentReturn: "Restituisci", equipmentFree: "Disponibile", equipmentHistory: "Cronologia", equipmentEmpty: "Nessuna attrezzatura registrata.", equipmentType: "Tipo",
    exportTab: "Esportazione ore", exportMonth: "Mese", exportDownload: "Scarica CSV", exportEmpty: "Nessuna ora nel mese selezionato.", exportDays: "Giorni lavorati",
    materialOrder: "Ordina materiale", materialOrders: "Ordini", orderOpen: "Aperto", orderOrdered: "Ordinato", orderDelivered: "Consegnato", ordersEmpty: "Nessun ordine.", orderNote: "Nota",
    materialCatalog: "Catalogo materiali", materialCatalogEmpty: "Nessun materiale salvato.",
    materialUsed: "Materiale consumato", materialAdd: "Aggiungi", materialQty: "Quantità", materialUnit: "Unità", materialName: "Descrizione", materialNone: "Nessun materiale registrato.",
    editBtn: "Modifica", cancelBtn: "Annulla", saveBtn: "Salva", overviewBtn: "Panoramica", languageLabel: "Lingua", nationalityLabel: "Nazionalità", phoneLabel: "Telefono", nameLabel: "Nome", readOnlyLabel: "Sola lettura (istruzione non modificabile)", readOnlyHint: "Sola lettura – la scrittura è bloccata per questo account.", commentEdited: "modificato", commentDeleteAsk: "Eliminare questo contributo?",
    feedbackTab: "Feedback", feedbackTitle: "Feedback tester", feedbackIntro: "Aggiungi un breve feedback per ogni punto.", feedbackSend: "Invia feedback", feedbackThanks: "Grazie per il tuo feedback!", feedbackReview: "Feedback ricevuti", feedbackNone: "Ancora nessun feedback.",
    feedbackPoints: ["Accesso & password", "Istruzione & commento", "Funzione meteo", "Traduzioni", "Creare rapporto", "Esportazione PDF", "Viste calendario", "Traduttore live", "Uso su cellulare", "Impressione generale & errori"],
    translatorHint: "Nota: Traduzione tramite IA – non sempre corretta al 100%.",
    translatorTab: "Traduttore", translatorTitle: "Traduttore live", translatorPlaceholder: "Inserisci il testo…", translatorBtn: "Traduci", translatorSwap: "Scambia lingue",
    weather: "Meteo", weatherError: "Meteo/posizione non disponibile",
    instructionDoc: "Istruzione di lavoro",
    help: "Guida",
    helpEmpty: "Guida non ancora disponibile",
    dashOpen: "Apri",
    readLabel: "Letto",
    readUnread: "non letto",
    readAllDone: "tutto letto",
    dashMyProjects: "I miei progetti",
    dashToday: "Oggi",
    dashTomorrow: "Domani",
    dashWeek: "Settimana",
    dashNextWeek: "Prossima settimana",
    dashMyProjectsToday: "I miei progetti – oggi",
    dashNothingToday: "Niente in programma oggi",
    dashNoProjects: "Nessun progetto assegnato",
    dashOverdue: "in ritardo",
    dashDone: "fatto",
    msgFillRequired: "Compila tutti i campi obbligatori.",
    msgEmployeeDeleted: "Il dipendente è stato eliminato.",
    msgNoEmailAddr: "Nessun indirizzo e-mail disponibile.",
    msgCommentSavedOk: "✅ Commento salvato.",
    msgNoteSaved: "La nota è stata salvata.",
    msgLogoUploaded: "Logo caricato. Salva i dati dell'azienda.",
    msgPleaseLogin: "Accedi prima.",
    msgPmUnchanged: "Responsabile progetto invariato.",
    msgPmChanged: "Responsabile progetto modificato.",
    msgPmNotFound: "Nessun responsabile progetto con questo nome trovato nell'elenco dipendenti – la visibilità non può essere trasferita.",
    msgProjectNoInstr: "Questo progetto non ha ancora istruzioni.",
    msgTranslatingGeneric: "Traduzione in corso...",
    msgReportPrepared: "Il rapporto di lavoro è stato preparato dall'istruzione di lavoro.",
    msgEmailNotEnabled: "🔒 L'invio di e-mail non è attivo nel tuo pacchetto.",
    assignVisibility: "Assegna visibilità",
    assignEmployees: "Assegna dipendenti",
    assignProjectManager: "Assegna responsabile progetto",
    instructionsLocked: "La creazione di istruzioni di lavoro è possibile solo per i responsabili di progetto e gli amministratori.",
    title: "Regie International",
    subtitle: "Registra, traduci, salva e invia istruzioni di lavoro e rapporti di lavoro.",
    loginTitle: "Accesso rapporto di lavoro",
    email: "E-mail",
    password: "Password",
    login: "Accedi",
    register: "Registrati",
    logout: "Esci",
    loggedInAs: "Connesso come",
    saveLoad: "Salva / carica rapporto",
    reportName: "Nome rapporto, es. sett. 22 - mattina",
    saveReport: "Salva rapporto",
    updateReport: "Aggiorna rapporto",
    newReport: "Nuovo rapporto",
    savedReports: "I miei rapporti salvati",
    loadEdit: "Carica / modifica",
    delete: "Elimina",
    general: "Informazioni generali",
    appLanguage: "Lingua app",
    pdfLanguage: "Lingua PDF",
    employee: "Dipendente",
    calendarWeek: "Settimana",
    recipientEmail: "E-mail destinatario per invio PDF",
    customer: "Cliente",
    projectNumber: "Numero progetto",
    site: "Cantiere",
    hours: "Ore",
    startTime: "Inizio",
    endTime: "Fine",
    breakLabel: "Pausa (min.)",
    description: "Descrizione del lavoro",
    translation: "Traduzione",
    deletePhoto: "Elimina foto",
    hoursOverview: "Riepilogo ore",
    total: "Totale",
    translateWeek: "Traduci settimana",
    translating: "Traduzione in corso...",
    save: "Salva",
    update: "Aggiorna",
    saveAsNew: "Salva come nuovo rapporto",
    downloadPdf: "Scarica PDF",
    sendPdf: "Invia PDF via e-mail",
    dashboard: "Dashboard",
    projects: "Progetti",
    workInstructions: "Istruzioni di lavoro",
    dueToday: "In scadenza oggi",
    totalProgress: "Avanzamento totale",
    stoppedSteps: "Fasi di lavoro interrotte",
    stepsInProgress: "Fasi di lavoro in corso",
    noProject: "Nessun progetto",
    projectsTab: "Progetti",
    projectName: "Nome progetto",
    projectCustomer: "Cliente",
    projectSite: "Cantiere",
    projectManager: "Responsabile progetto",
    saveProject: "Salva progetto",
    deleteProject: "Elimina progetto",
    openProject: "Apri progetto",
    closeProject: "Chiudi",
    progress: "Avanzamento",
    noInstructions: "Nessuna istruzione di lavoro per questo progetto.",
    noReports: "Nessun rapporto di lavoro per questo progetto.",
    reportsTab: "Rapporti di lavoro",
    newInstruction: "Nuova istruzione di lavoro",
    instructionTitle: "Titolo",
    selectProject: "Seleziona progetto",
    problems: "Problemi / note",
    material: "Materiale",
    werkzeug: "Attrezzi",
    workSteps: "Fasi di lavoro",
    addStep: "+ Fase di lavoro",
    saveInstruction: "Salva istruzione di lavoro",
    savedInstructions: "Istruzioni di lavoro salvate",
    noInstructionsSaved: "Nessuna istruzione di lavoro presente.",
    date: "Data",
    project: "Progetto",
    translateTo: "Traduci in",
    translating2: "Traduzione in corso...",
    translated: "Tradotto",
    feedback: "Riscontro",
    saveFeedback: "Salva riscontro",
    toReport: "Aggiungi al rapporto di lavoro",
    transferTitle: "Trasferire dove?",
    transferInsert: "Inserisci qui",
    transferNoReports: "Nessun rapporto salvato",
    travelTime: "Tempo di viaggio",
    teamReports: "Rapporti dei dipendenti",
    teamNoReports: "Nessun rapporto disponibile",
    travelOut: "Andata",
    travelReturn: "Ritorno",
    km: "km",
    deleteInstruction: "Elimina istruzione di lavoro",
    autoReportLocked: "I rapporti di lavoro automatici non sono attivi nel tuo pacchetto.",
    employeeManagement: "Gestione dipendenti",
    name: "Nome",
    role: "Ruolo",
    addEmployee: "Aggiungi dipendente",
    currentEmployees: "Dipendenti attuali",
    resetPassword: "Reimposta password",
    companyData: "Dati azienda",
    uploadLogo: "Carica logo aziendale",
    companyName: "Nome azienda",
    street: "Via",
    zip: "CAP",
    city: "Città",
    phone: "Telefono",
    website: "Sito web",
    taxNumber: "P. IVA / codice fiscale",
    saveCompany: "Salva dati azienda",
    reportNameLabel: "Nome rapporto",
    firma: "Azienda",
    feedbackLabel: "Riscontro",
    noProjectsYet: "Nessun progetto presente.",
    weekdays: ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"],
    noInstructionsYet: "Nessuna istruzione di lavoro presente.",
    msgLoginOk: "Accesso riuscito.",
    msgLogout: "Sei stato disconnesso.",
    msgRegisterOk: "Registrazione riuscita.",
    msgRegisterFail: "Registrazione non riuscita: ",
    msgLoginFail: "Accesso non riuscito: ",
    msgSaved: "Il nuovo rapporto è stato salvato.",
    msgUpdated: "Il rapporto è stato aggiornato.",
    msgLoaded: "Il rapporto è stato caricato.",
    msgDeleted: "Il rapporto è stato eliminato.",
    msgTranslated: "La settimana è stata tradotta.",
    msgTranslateErr: "Errore di traduzione: ",
    msgPhotoUploading: "Caricamento foto in corso...",
    msgPhotoOk: "Le foto sono state caricate.",
    msgPhotoErr: "Errore caricamento foto: ",
    msgPhotoLimit: "Sono consentite al massimo {n} foto.",
    msgSaving: "Salvataggio istruzione di lavoro...",
    msgNoFirm: "Nessuna azienda caricata.",
    msgNoTitle: "Inserire il titolo dell'istruzione di lavoro.",
    msgNoDate: "Inserire una data per l'istruzione di lavoro.",
    msgInstructionSaved: "Istruzione di lavoro salvata.",
    msgInstructionDeleted: "Istruzione di lavoro eliminata.",
    msgFeedbackSaved: "Riscontro salvato.",
    msgEmployeeAdded: "Il dipendente è stato creato.",
    msgPasswordReset: "L'e-mail di reimpostazione password è stata inviata.",
    msgCompanySaved: "I dati dell'azienda sono stati salvati.",
    msgProjectSaved: "Progetto salvato.",
    msgProjectDeleted: "Progetto eliminato.",
    msgInstructionTranslated: "L'istruzione di lavoro è stata tradotta.",
    msgNewReport: "Nuovo rapporto avviato.",
    msgNoEmployee: "Inserire il dipendente.",
    msgEmailRequired: "Inserire l'e-mail del destinatario.",
    msgEmailSending: "Invio PDF via e-mail in corso...",
    msgEmailSent: "PDF inviato via e-mail.",
    tabReport: "Rapporto di lavoro",
    photos: "Foto",
    deletePhoto2: "Elimina foto",
    tabDay: "Vista giorno",
    tabWeek: "Vista settimana",
    weekView: "Vista settimana",
    noInstructionsDay: "Nessuna istruzione di lavoro per questo giorno.",
    noInstructionsWeek: "Nessuna istruzione di lavoro per questa settimana.",
    noInstructionsMonth: "Nessuna istruzione di lavoro per questo mese.",
    tabMonth: "Vista mese",
    dayView: "Vista giorno",
    monthView: "Vista mese",
    selectDate: "Seleziona data",
    noEntries: "Nessuna voce trovata.",
    totalHoursMonth: "Ore totali nel mese",
    hoursPerProject: "Ore per progetto",
    dailyEntry: "Voce giornaliera",
    saveDayEntry: "Salva voce giornaliera",
    week: "Settimana",
    statusOpen: "⬜ Aperto",
    statusInProgress: "🟡 In corso",
    statusStopped: "⛔ Interrotto",
    statusCompleted: "✅ Completato",
    problemsHints: "Problemi / note",
    roleEmployee: "Dipendente",
    roleProjectManager: "Responsabile progetto",
    roleAdmin: "Amministratore",
    commentLabel: "Commento",
    commentPlaceholder: "Inserisci commento...",
    commentSaveBtn: "Salva",
    commentSaving: "Salvataggio…",
    commentSaved: "Salvato",
    commentErrorLabel: "Errore",
    charsLabel: "Caratteri",
    copyInstruction: "Copia fasi",
    copyTitle: "Copia fasi dall'istruzione",
    copySource: "Seleziona istruzione",
    copyWhichSteps: "Quali fasi di lavoro copiare?",
    copyAllNone: "Tutte / nessuna",
    copyNoSteps: "Nessuna fase di lavoro presente.",
    copyCancel: "Annulla",
    copyConfirm: "Applica",
    copySelectSource: "Seleziona un'istruzione.",
    copyDone: "Le fasi di lavoro sono state applicate.",
  },
  Türkisch: {
    navigate: "Yol tarifi",
    absenceReported: "Bildirildi",
    absenceTab: "İzin ve devamsızlık", absenceVacation: "İzin", absenceSick: "Hastalık", absenceFrom: "Başlangıç", absenceTo: "Bitiş", absenceRequest: "Talep et", absencePending: "Açık", absenceApproved: "Onaylandı", absenceRejected: "Reddedildi", absenceApprove: "Onayla", absenceReject: "Reddet", absenceEmpty: "Talep yok.",
    filterAll: "Tümü",
    equipmentTab: "Araçlar ve aletler", equipmentVehicle: "Araç", equipmentTool: "Alet", equipmentIdentifier: "Plaka / numara", equipmentAssign: "Ata", equipmentReturn: "İade et", equipmentFree: "Müsait", equipmentHistory: "Geçmiş", equipmentEmpty: "Henüz ekipman girilmedi.", equipmentType: "Tür",
    exportTab: "Saat dışa aktarma", exportMonth: "Ay", exportDownload: "CSV indir", exportEmpty: "Seçilen ayda saat yok.", exportDays: "Çalışma günleri",
    materialOrder: "Malzeme siparişi", materialOrders: "Siparişler", orderOpen: "Açık", orderOrdered: "Sipariş edildi", orderDelivered: "Teslim edildi", ordersEmpty: "Sipariş yok.", orderNote: "Not",
    materialCatalog: "Malzeme kataloğu", materialCatalogEmpty: "Henüz kayıtlı malzeme yok.",
    materialUsed: "Kullanılan malzeme", materialAdd: "Ekle", materialQty: "Miktar", materialUnit: "Birim", materialName: "Tanım", materialNone: "Henüz malzeme girilmedi.",
    editBtn: "Düzenle", cancelBtn: "İptal", saveBtn: "Kaydet", overviewBtn: "Genel bakış", languageLabel: "Dil", nationalityLabel: "Uyruk", phoneLabel: "Telefon", nameLabel: "Ad", readOnlyLabel: "Salt okunur (iş talimatı düzenlenemez)", readOnlyHint: "Salt okunur – bu hesap için yazma engellendi.", commentEdited: "düzenlendi", commentDeleteAsk: "Bu kayıt silinsin mi?",
    feedbackTab: "Geri bildirim", feedbackTitle: "Test geri bildirimi", feedbackIntro: "Lütfen her madde için kısa geri bildirim yazın.", feedbackSend: "Geri bildirim gönder", feedbackThanks: "Geri bildiriminiz için teşekkürler!", feedbackReview: "Gönderilen geri bildirimler", feedbackNone: "Henüz geri bildirim yok.",
    feedbackPoints: ["Giriş & şifre", "İş talimatı & yorum", "Hava durumu", "Çeviriler", "Rapor oluşturma", "PDF dışa aktarma", "Takvim görünümleri", "Canlı çevirmen", "Telefonda kullanım", "Genel izlenim & hatalar"],
    translatorHint: "Not: Çeviri yapay zeka ile yapılır – her zaman %100 doğru değildir.",
    translatorTab: "Çevirmen", translatorTitle: "Canlı çevirmen", translatorPlaceholder: "Metin girin…", translatorBtn: "Çevir", translatorSwap: "Dilleri değiştir",
    weather: "Hava", weatherError: "Hava/konum kullanılamıyor",
    instructionDoc: "İş talimatı",
    help: "Kılavuz",
    helpEmpty: "Kılavuz henüz eklenmedi",
    dashOpen: "Aç",
    readLabel: "Okundu",
    readUnread: "okunmadı",
    readAllDone: "tümü okundu",
    dashMyProjects: "Projelerim",
    dashToday: "Bugün",
    dashTomorrow: "Yarın",
    dashWeek: "Hafta",
    dashNextWeek: "Gelecek hafta",
    dashMyProjectsToday: "Projelerim – bugün",
    dashNothingToday: "Bugün için bir şey planlanmadı",
    dashNoProjects: "Henüz atanmış proje yok",
    dashOverdue: "gecikmiş",
    dashDone: "tamam",
    msgFillRequired: "Lütfen tüm zorunlu alanları doldurun.",
    msgEmployeeDeleted: "Çalışan silindi.",
    msgNoEmailAddr: "E-posta adresi yok.",
    msgCommentSavedOk: "✅ Yorum kaydedildi.",
    msgNoteSaved: "Not kaydedildi.",
    msgLogoUploaded: "Logo yüklendi. Lütfen firma bilgilerini kaydedin.",
    msgPleaseLogin: "Lütfen önce giriş yapın.",
    msgPmUnchanged: "Proje yöneticisi değişmedi.",
    msgPmChanged: "Proje yöneticisi değiştirildi.",
    msgPmNotFound: "Çalışan listesinde bu isimde bir proje yöneticisi bulunamadı – görünürlük aktarılamaz.",
    msgProjectNoInstr: "Bu projenin henüz talimatı yok.",
    msgTranslatingGeneric: "Çevriliyor...",
    msgReportPrepared: "İş raporu, iş talimatından hazırlandı.",
    msgEmailNotEnabled: "🔒 E-posta gönderimi paketinizde etkin değil.",
    assignVisibility: "Görünürlük ata",
    assignEmployees: "Çalışan ata",
    assignProjectManager: "Proje yöneticisi ata",
    instructionsLocked: "İş talimatı oluşturmak yalnızca proje yöneticileri ve yöneticiler için mümkündür.",
    title: "Regie International",
    subtitle: "İş talimatlarını ve iş raporlarını kaydedin, çevirin, saklayın ve gönderin.",
    loginTitle: "İş Raporu Girişi",
    email: "E-posta",
    password: "Şifre",
    login: "Giriş yap",
    register: "Kayıt ol",
    logout: "Çıkış yap",
    loggedInAs: "Giriş yapan",
    saveLoad: "Rapor kaydet / yükle",
    reportName: "Rapor adı, örn. Hafta 22 - sabah",
    saveReport: "Rapor kaydet",
    updateReport: "Rapor güncelle",
    newReport: "Yeni rapor",
    savedReports: "Kaydedilen raporlarım",
    loadEdit: "Yükle / düzenle",
    delete: "Sil",
    general: "Genel bilgiler",
    appLanguage: "Uygulama dili",
    pdfLanguage: "PDF dili",
    employee: "Çalışan",
    calendarWeek: "Takvim haftası",
    recipientEmail: "PDF gönderimi için alıcı e-postası",
    customer: "Müşteri",
    projectNumber: "Proje numarası",
    site: "Şantiye",
    hours: "Saat",
    startTime: "Başlangıç",
    endTime: "Bitiş",
    breakLabel: "Mola (dk.)",
    description: "İş açıklaması",
    translation: "Çeviri",
    deletePhoto: "Fotoğrafı sil",
    hoursOverview: "Saat özeti",
    total: "Toplam",
    translateWeek: "Haftayı çevir",
    translating: "Çevriliyor...",
    save: "Kaydet",
    update: "Güncelle",
    saveAsNew: "Yeni rapor olarak kaydet",
    downloadPdf: "PDF indir",
    sendPdf: "PDF'yi e-posta ile gönder",
    dashboard: "Panel",
    projects: "Projeler",
    workInstructions: "İş talimatları",
    dueToday: "Bugün teslim",
    totalProgress: "Toplam ilerleme",
    stoppedSteps: "Durdurulan iş adımları",
    stepsInProgress: "Devam eden iş adımları",
    noProject: "Proje yok",
    projectsTab: "Projeler",
    projectName: "Proje adı",
    projectCustomer: "Müşteri",
    projectSite: "Şantiye",
    projectManager: "Proje yöneticisi",
    saveProject: "Proje kaydet",
    deleteProject: "Proje sil",
    openProject: "Proje aç",
    closeProject: "Kapat",
    progress: "İlerleme",
    noInstructions: "Bu proje için henüz iş talimatı yok.",
    noReports: "Bu proje için henüz iş raporu yok.",
    reportsTab: "İş raporları",
    newInstruction: "Yeni iş talimatı",
    instructionTitle: "Başlık",
    selectProject: "Proje seç",
    problems: "Sorunlar / notlar",
    material: "Malzeme",
    werkzeug: "Aletler",
    workSteps: "İş adımları",
    addStep: "+ İş adımı",
    saveInstruction: "İş talimatını kaydet",
    savedInstructions: "Kaydedilen iş talimatları",
    noInstructionsSaved: "Henüz iş talimatı yok.",
    date: "Tarih",
    project: "Proje",
    translateTo: "Şuna çevir",
    translating2: "Çevriliyor...",
    translated: "Çevrildi",
    feedback: "Geri bildirim",
    saveFeedback: "Geri bildirimi kaydet",
    toReport: "İş raporuna aktar",
    transferTitle: "Nereye aktarılsın?",
    transferInsert: "Buraya ekle",
    transferNoReports: "Kayıtlı rapor yok",
    travelTime: "Yol süresi",
    teamReports: "Çalışan raporları",
    teamNoReports: "Rapor bulunmuyor",
    travelOut: "Gidiş",
    travelReturn: "Dönüş",
    km: "km",
    deleteInstruction: "İş talimatını sil",
    autoReportLocked: "Otomatik iş raporları paketinizde etkin değil.",
    employeeManagement: "Çalışan yönetimi",
    name: "Ad",
    role: "Rol",
    addEmployee: "Çalışan ekle",
    currentEmployees: "Mevcut çalışanlar",
    resetPassword: "Şifreyi sıfırla",
    companyData: "Firma bilgileri",
    uploadLogo: "Firma logosu yükle",
    companyName: "Firma adı",
    street: "Sokak",
    zip: "Posta kodu",
    city: "Şehir",
    phone: "Telefon",
    website: "İnternet sitesi",
    taxNumber: "Vergi numarası",
    saveCompany: "Firma bilgilerini kaydet",
    reportNameLabel: "Rapor adı",
    firma: "Firma",
    feedbackLabel: "Geri bildirim",
    noProjectsYet: "Henüz proje yok.",
    weekdays: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"],
    noInstructionsYet: "Henüz iş talimatı yok.",
    msgLoginOk: "Giriş başarılı.",
    msgLogout: "Çıkış yapıldı.",
    msgRegisterOk: "Kayıt başarılı.",
    msgRegisterFail: "Kayıt başarısız: ",
    msgLoginFail: "Giriş başarısız: ",
    msgSaved: "Yeni rapor kaydedildi.",
    msgUpdated: "Rapor güncellendi.",
    msgLoaded: "Rapor yüklendi.",
    msgDeleted: "Rapor silindi.",
    msgTranslated: "Hafta çevrildi.",
    msgTranslateErr: "Çeviri hatası: ",
    msgPhotoUploading: "Fotoğraflar yükleniyor...",
    msgPhotoOk: "Fotoğraflar yüklendi.",
    msgPhotoErr: "Fotoğraf yükleme hatası: ",
    msgPhotoLimit: "En fazla {n} fotoğrafına izin verilir.",
    msgSaving: "İş talimatı kaydediliyor...",
    msgNoFirm: "Firma yüklenmedi.",
    msgNoTitle: "Lütfen iş talimatı başlığını girin.",
    msgNoDate: "Lütfen iş talimatı için bir tarih girin.",
    msgInstructionSaved: "İş talimatı kaydedildi.",
    msgInstructionDeleted: "İş talimatı silindi.",
    msgFeedbackSaved: "Geri bildirim kaydedildi.",
    msgEmployeeAdded: "Çalışan oluşturuldu.",
    msgPasswordReset: "Şifre sıfırlama e-postası gönderildi.",
    msgCompanySaved: "Firma bilgileri kaydedildi.",
    msgProjectSaved: "Proje kaydedildi.",
    msgProjectDeleted: "Proje silindi.",
    msgInstructionTranslated: "İş talimatı çevrildi.",
    msgNewReport: "Yeni rapor başlatıldı.",
    msgNoEmployee: "Lütfen çalışanı girin.",
    msgEmailRequired: "Lütfen alıcı e-postasını girin.",
    msgEmailSending: "PDF e-posta ile gönderiliyor...",
    msgEmailSent: "PDF e-posta ile gönderildi.",
    tabReport: "İş raporu",
    photos: "Fotoğraflar",
    deletePhoto2: "Fotoğrafı sil",
    tabDay: "Gün görünümü",
    tabWeek: "Hafta görünümü",
    weekView: "Hafta görünümü",
    noInstructionsDay: "Bu gün için iş talimatı yok.",
    noInstructionsWeek: "Bu hafta için iş talimatı yok.",
    noInstructionsMonth: "Bu ay için iş talimatı yok.",
    tabMonth: "Ay görünümü",
    dayView: "Gün görünümü",
    monthView: "Ay görünümü",
    selectDate: "Tarih seç",
    noEntries: "Kayıt bulunamadı.",
    totalHoursMonth: "Aydaki toplam saat",
    hoursPerProject: "Proje başına saat",
    dailyEntry: "Günlük kayıt",
    saveDayEntry: "Günlük kaydı kaydet",
    week: "Hafta",
    statusOpen: "⬜ Açık",
    statusInProgress: "🟡 Devam ediyor",
    statusStopped: "⛔ Durduruldu",
    statusCompleted: "✅ Tamamlandı",
    problemsHints: "Sorunlar / notlar",
    roleEmployee: "Çalışan",
    roleProjectManager: "Proje yöneticisi",
    roleAdmin: "Yönetici",
    commentLabel: "Yorum",
    commentPlaceholder: "Yorum girin...",
    commentSaveBtn: "Kaydet",
    commentSaving: "Kaydediliyor…",
    commentSaved: "Kaydedildi",
    commentErrorLabel: "Hata",
    charsLabel: "Karakter",
    copyInstruction: "Adımları kopyala",
    copyTitle: "Talimattan adımları al",
    copySource: "Talimat seç",
    copyWhichSteps: "Hangi iş adımları alınsın?",
    copyAllNone: "Tümü / hiçbiri",
    copyNoSteps: "İş adımı yok.",
    copyCancel: "İptal",
    copyConfirm: "Uygula",
    copySelectSource: "Lütfen bir talimat seçin.",
    copyDone: "İş adımları alındı.",
  },
  Ungarisch: {
    navigate: "Navigáció",
    absenceReported: "Bejelentve",
    absenceTab: "Szabadság és távollét", absenceVacation: "Szabadság", absenceSick: "Betegség", absenceFrom: "Ettől", absenceTo: "Eddig", absenceRequest: "Igénylés", absencePending: "Nyitott", absenceApproved: "Jóváhagyva", absenceRejected: "Elutasítva", absenceApprove: "Jóváhagyás", absenceReject: "Elutasítás", absenceEmpty: "Nincs bejelentés.",
    filterAll: "Összes",
    equipmentTab: "Járművek és szerszámok", equipmentVehicle: "Jármű", equipmentTool: "Szerszám", equipmentIdentifier: "Rendszám / szám", equipmentAssign: "Kiosztás", equipmentReturn: "Visszaadás", equipmentFree: "Elérhető", equipmentHistory: "Előzmények", equipmentEmpty: "Még nincs rögzített eszköz.", equipmentType: "Típus",
    exportTab: "Óraexport", exportMonth: "Hónap", exportDownload: "CSV letöltése", exportEmpty: "Nincs óra a kiválasztott hónapban.", exportDays: "Munkanapok",
    materialOrder: "Anyag rendelése", materialOrders: "Rendelések", orderOpen: "Nyitott", orderOrdered: "Megrendelve", orderDelivered: "Kiszállítva", ordersEmpty: "Nincs rendelés.", orderNote: "Megjegyzés",
    materialCatalog: "Anyagtörzs", materialCatalogEmpty: "Még nincs mentett anyag.",
    materialUsed: "Felhasznált anyag", materialAdd: "Hozzáadás", materialQty: "Mennyiség", materialUnit: "Egység", materialName: "Megnevezés", materialNone: "Még nincs rögzített anyag.",
    editBtn: "Szerkesztés", cancelBtn: "Mégse", saveBtn: "Mentés", overviewBtn: "Áttekintés", languageLabel: "Nyelv", nationalityLabel: "Nemzetiség", phoneLabel: "Telefon", nameLabel: "Név", readOnlyLabel: "Csak olvasás (a munkautasítás nem szerkeszthető)", readOnlyHint: "Csak olvasás – az írás ehhez a fiókhoz le van tiltva.", commentEdited: "szerkesztve", commentDeleteAsk: "Törli ezt a bejegyzést?",
    feedbackTab: "Visszajelzés", feedbackTitle: "Tesztelői visszajelzés", feedbackIntro: "Kérjük, minden ponthoz írjon rövid visszajelzést.", feedbackSend: "Visszajelzés küldése", feedbackThanks: "Köszönjük a visszajelzést!", feedbackReview: "Beérkezett visszajelzések", feedbackNone: "Még nincs visszajelzés.",
    feedbackPoints: ["Bejelentkezés & jelszó", "Munkautasítás & megjegyzés", "Időjárás funkció", "Fordítások", "Jelentés készítése", "PDF exportálás", "Naptárnézetek", "Élő fordító", "Használat telefonon", "Összbenyomás & hibák"],
    translatorHint: "Megjegyzés: A fordítást MI készíti – nem mindig 100%-osan pontos.",
    translatorTab: "Fordító", translatorTitle: "Élő fordító", translatorPlaceholder: "Írja be a szöveget…", translatorBtn: "Fordítás", translatorSwap: "Nyelvek cseréje",
    weather: "Időjárás", weatherError: "Időjárás/helyzet nem érhető el",
    instructionDoc: "Munkautasítás",
    help: "Útmutató",
    helpEmpty: "Az útmutató még nincs megadva",
    dashOpen: "Megnyitás",
    readLabel: "Elolvasva",
    readUnread: "olvasatlan",
    readAllDone: "mind elolvasva",
    dashMyProjects: "Saját projektjeim",
    dashToday: "Ma",
    dashTomorrow: "Holnap",
    dashWeek: "Hét",
    dashNextWeek: "Jövő hét",
    dashMyProjectsToday: "Saját projektjeim – ma",
    dashNothingToday: "Mára nincs tervezve",
    dashNoProjects: "Még nincs hozzárendelt projekt",
    dashOverdue: "lejárt",
    dashDone: "kész",
    msgFillRequired: "Kérjük, töltse ki az összes kötelező mezőt.",
    msgEmployeeDeleted: "A munkatárs törölve.",
    msgNoEmailAddr: "Nincs e-mail cím.",
    msgCommentSavedOk: "✅ Megjegyzés mentve.",
    msgNoteSaved: "A jegyzet mentve.",
    msgLogoUploaded: "A logó feltöltve. Kérjük, mentse a cégadatokat.",
    msgPleaseLogin: "Kérjük, először jelentkezzen be.",
    msgPmUnchanged: "Projektvezető változatlan.",
    msgPmChanged: "Projektvezető módosítva.",
    msgPmNotFound: "Nem található ilyen nevű projektvezető a munkatársak listáján – a láthatóság nem ruházható át.",
    msgProjectNoInstr: "Ennek a projektnek még nincsenek utasításai.",
    msgTranslatingGeneric: "Fordítás...",
    msgReportPrepared: "A munkajelentés elkészült a munkautasításból.",
    msgEmailNotEnabled: "🔒 Az e-mail küldés nincs engedélyezve a csomagodban.",
    assignVisibility: "Láthatóság hozzárendelése",
    assignEmployees: "Munkatársak hozzárendelése",
    assignProjectManager: "Projektvezető hozzárendelése",
    instructionsLocked: "Munkautasítások létrehozása csak projektvezetők és adminisztrátorok számára lehetséges.",
    title: "Regie International",
    subtitle: "Munkautasítások és munkajelentések rögzítése, fordítása, mentése és küldése.",
    loginTitle: "Munkajelentés belépés",
    email: "E-mail",
    password: "Jelszó",
    login: "Bejelentkezés",
    register: "Regisztráció",
    logout: "Kijelentkezés",
    loggedInAs: "Bejelentkezve mint",
    saveLoad: "Jelentés mentése / betöltése",
    reportName: "Jelentés neve, pl. 22. hét - délelőtt",
    saveReport: "Jelentés mentése",
    updateReport: "Jelentés frissítése",
    newReport: "Új jelentés",
    savedReports: "Mentett jelentéseim",
    loadEdit: "Betöltés / szerkesztés",
    delete: "Törlés",
    general: "Általános adatok",
    appLanguage: "Alkalmazás nyelve",
    pdfLanguage: "PDF nyelve",
    employee: "Munkatárs",
    calendarWeek: "Naptári hét",
    recipientEmail: "Címzett e-mail PDF küldéshez",
    customer: "Ügyfél",
    projectNumber: "Projektszám",
    site: "Munkaterület",
    hours: "Óra",
    startTime: "Kezdés",
    endTime: "Befejezés",
    breakLabel: "Szünet (perc)",
    description: "Munkaleírás",
    translation: "Fordítás",
    deletePhoto: "Fénykép törlése",
    hoursOverview: "Óraáttekintés",
    total: "Összesen",
    translateWeek: "Hét fordítása",
    translating: "Fordítás...",
    save: "Mentés",
    update: "Frissítés",
    saveAsNew: "Mentés új jelentésként",
    downloadPdf: "PDF letöltése",
    sendPdf: "PDF küldése e-mailben",
    dashboard: "Áttekintő",
    projects: "Projektek",
    workInstructions: "Munkautasítások",
    dueToday: "Mai határidő",
    totalProgress: "Teljes előrehaladás",
    stoppedSteps: "Leállított munkalépések",
    stepsInProgress: "Folyamatban lévő munkalépések",
    noProject: "Nincs projekt",
    projectsTab: "Projektek",
    projectName: "Projekt neve",
    projectCustomer: "Ügyfél",
    projectSite: "Munkaterület",
    projectManager: "Projektvezető",
    saveProject: "Projekt mentése",
    deleteProject: "Projekt törlése",
    openProject: "Projekt megnyitása",
    closeProject: "Bezárás",
    progress: "Előrehaladás",
    noInstructions: "Még nincs munkautasítás ehhez a projekthez.",
    noReports: "Még nincs munkajelentés ehhez a projekthez.",
    reportsTab: "Munkajelentések",
    newInstruction: "Új munkautasítás",
    instructionTitle: "Cím",
    selectProject: "Projekt kiválasztása",
    problems: "Problémák / megjegyzések",
    material: "Anyag",
    werkzeug: "Szerszámok",
    workSteps: "Munkalépések",
    addStep: "+ Munkalépés",
    saveInstruction: "Munkautasítás mentése",
    savedInstructions: "Mentett munkautasítások",
    noInstructionsSaved: "Még nincs munkautasítás.",
    date: "Dátum",
    project: "Projekt",
    translateTo: "Fordítás erre",
    translating2: "Fordítás...",
    translated: "Lefordítva",
    feedback: "Visszajelzés",
    saveFeedback: "Visszajelzés mentése",
    toReport: "Átvétel a munkajelentésbe",
    transferTitle: "Hová vegyük át?",
    transferInsert: "Beszúrás ide",
    transferNoReports: "Nincs mentett jelentés",
    travelTime: "Utazási idő",
    teamReports: "Munkatársak jelentései",
    teamNoReports: "Nincs elérhető jelentés",
    travelOut: "Odaút",
    travelReturn: "Visszaút",
    km: "km",
    deleteInstruction: "Munkautasítás törlése",
    autoReportLocked: "Az automatikus munkajelentések nincsenek engedélyezve a csomagodban.",
    employeeManagement: "Munkatársak kezelése",
    name: "Név",
    role: "Szerepkör",
    addEmployee: "Munkatárs hozzáadása",
    currentEmployees: "Jelenlegi munkatársak",
    resetPassword: "Jelszó visszaállítása",
    companyData: "Cégadatok",
    uploadLogo: "Céglógó feltöltése",
    companyName: "Cégnév",
    street: "Utca",
    zip: "Irányítószám",
    city: "Város",
    phone: "Telefon",
    website: "Weboldal",
    taxNumber: "Adószám",
    saveCompany: "Cégadatok mentése",
    reportNameLabel: "Jelentés neve",
    firma: "Cég",
    feedbackLabel: "Visszajelzés",
    noProjectsYet: "Még nincs projekt.",
    weekdays: ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"],
    noInstructionsYet: "Még nincs munkautasítás.",
    msgLoginOk: "Sikeres bejelentkezés.",
    msgLogout: "Kijelentkeztél.",
    msgRegisterOk: "Sikeres regisztráció.",
    msgRegisterFail: "A regisztráció sikertelen: ",
    msgLoginFail: "A bejelentkezés sikertelen: ",
    msgSaved: "Az új jelentés mentve.",
    msgUpdated: "A jelentés frissítve.",
    msgLoaded: "A jelentés betöltve.",
    msgDeleted: "A jelentés törölve.",
    msgTranslated: "A hét lefordítva.",
    msgTranslateErr: "Fordítási hiba: ",
    msgPhotoUploading: "Fényképek feltöltése...",
    msgPhotoOk: "A fényképek feltöltve.",
    msgPhotoErr: "Fénykép feltöltési hiba: ",
    msgPhotoLimit: "Legfeljebb {n} fénykép engedélyezett.",
    msgSaving: "Munkautasítás mentése...",
    msgNoFirm: "Nincs betöltve cég.",
    msgNoTitle: "Kérjük, adja meg a munkautasítás címét.",
    msgNoDate: "Kérjük, adjon meg egy dátumot a munkautasításhoz.",
    msgInstructionSaved: "Munkautasítás mentve.",
    msgInstructionDeleted: "Munkautasítás törölve.",
    msgFeedbackSaved: "Visszajelzés mentve.",
    msgEmployeeAdded: "A munkatárs létrehozva.",
    msgPasswordReset: "A jelszó-visszaállító e-mail elküldve.",
    msgCompanySaved: "A cégadatok mentve.",
    msgProjectSaved: "Projekt mentve.",
    msgProjectDeleted: "Projekt törölve.",
    msgInstructionTranslated: "A munkautasítás lefordítva.",
    msgNewReport: "Új jelentés elindítva.",
    msgNoEmployee: "Kérjük, adja meg a munkatársat.",
    msgEmailRequired: "Kérjük, adja meg a címzett e-mail címét.",
    msgEmailSending: "PDF küldése e-mailben...",
    msgEmailSent: "A PDF e-mailben elküldve.",
    tabReport: "Munkajelentés",
    photos: "Fényképek",
    deletePhoto2: "Fénykép törlése",
    tabDay: "Napi nézet",
    tabWeek: "Heti nézet",
    weekView: "Heti nézet",
    noInstructionsDay: "Nincs munkautasítás erre a napra.",
    noInstructionsWeek: "Nincs munkautasítás erre a hétre.",
    noInstructionsMonth: "Nincs munkautasítás erre a hónapra.",
    tabMonth: "Havi nézet",
    dayView: "Napi nézet",
    monthView: "Havi nézet",
    selectDate: "Dátum választása",
    noEntries: "Nem található bejegyzés.",
    totalHoursMonth: "Összóra a hónapban",
    hoursPerProject: "Óra projektenként",
    dailyEntry: "Napi bejegyzés",
    saveDayEntry: "Napi bejegyzés mentése",
    week: "Hét",
    statusOpen: "⬜ Nyitott",
    statusInProgress: "🟡 Folyamatban",
    statusStopped: "⛔ Leállítva",
    statusCompleted: "✅ Kész",
    problemsHints: "Problémák / megjegyzések",
    roleEmployee: "Munkatárs",
    roleProjectManager: "Projektvezető",
    roleAdmin: "Adminisztrátor",
    commentLabel: "Megjegyzés",
    commentPlaceholder: "Írjon megjegyzést...",
    commentSaveBtn: "Mentés",
    commentSaving: "Mentés…",
    commentSaved: "Mentve",
    commentErrorLabel: "Hiba",
    charsLabel: "Karakter",
    copyInstruction: "Lépések másolása",
    copyTitle: "Lépések átvétele utasításból",
    copySource: "Utasítás kiválasztása",
    copyWhichSteps: "Mely munkalépéseket vegye át?",
    copyAllNone: "Összes / egyik sem",
    copyNoSteps: "Nincs munkalépés.",
    copyCancel: "Mégse",
    copyConfirm: "Átvétel",
    copySelectSource: "Kérjük, válasszon utasítást.",
    copyDone: "A munkalépések átvéve.",
  },
  Tschechisch: {
    navigate: "Navigace",
    absenceReported: "Nahlášeno",
    absenceTab: "Dovolená a nepřítomnost", absenceVacation: "Dovolená", absenceSick: "Nemoc", absenceFrom: "Od", absenceTo: "Do", absenceRequest: "Podat žádost", absencePending: "Otevřeno", absenceApproved: "Schváleno", absenceRejected: "Zamítnuto", absenceApprove: "Schválit", absenceReject: "Zamítnout", absenceEmpty: "Žádné žádosti.",
    filterAll: "Vše",
    equipmentTab: "Vozidla a nářadí", equipmentVehicle: "Vozidlo", equipmentTool: "Nářadí", equipmentIdentifier: "SPZ / číslo", equipmentAssign: "Přidělit", equipmentReturn: "Vrátit", equipmentFree: "Dostupné", equipmentHistory: "Historie", equipmentEmpty: "Zatím není zadáno žádné vybavení.", equipmentType: "Typ",
    exportTab: "Export hodin", exportMonth: "Měsíc", exportDownload: "Stáhnout CSV", exportEmpty: "Žádné hodiny ve vybraném měsíci.", exportDays: "Pracovní dny",
    materialOrder: "Objednat materiál", materialOrders: "Objednávky", orderOpen: "Otevřeno", orderOrdered: "Objednáno", orderDelivered: "Dodáno", ordersEmpty: "Žádné objednávky.", orderNote: "Poznámka",
    materialCatalog: "Katalog materiálu", materialCatalogEmpty: "Zatím není uložen žádný materiál.",
    materialUsed: "Spotřebovaný materiál", materialAdd: "Přidat", materialQty: "Množství", materialUnit: "Jednotka", materialName: "Název", materialNone: "Zatím není zadán žádný materiál.",
    editBtn: "Upravit", cancelBtn: "Zrušit", saveBtn: "Uložit", overviewBtn: "Přehled", languageLabel: "Jazyk", nationalityLabel: "Národnost", phoneLabel: "Telefon", nameLabel: "Jméno", readOnlyLabel: "Pouze čtení (pracovní pokyn nelze upravovat)", readOnlyHint: "Pouze čtení – zápis je pro tento účet zakázán.", commentEdited: "upraveno", commentDeleteAsk: "Smazat tento příspěvek?",
    feedbackTab: "Zpětná vazba", feedbackTitle: "Zpětná vazba testera", feedbackIntro: "Ke každému bodu prosím napište krátkou zpětnou vazbu.", feedbackSend: "Odeslat zpětnou vazbu", feedbackThanks: "Děkujeme za zpětnou vazbu!", feedbackReview: "Odeslaná zpětná vazba", feedbackNone: "Zatím žádná zpětná vazba.",
    feedbackPoints: ["Přihlášení & heslo", "Pracovní pokyn & komentář", "Funkce počasí", "Překlady", "Vytvoření výkazu", "Export PDF", "Zobrazení kalendáře", "Živý překladač", "Použití na mobilu", "Celkový dojem & chyby"],
    translatorHint: "Poznámka: Překlad pomocí AI – ne vždy 100% správný.",
    translatorTab: "Překladač", translatorTitle: "Živý překladač", translatorPlaceholder: "Zadejte text…", translatorBtn: "Přeložit", translatorSwap: "Prohodit jazyky",
    weather: "Počasí", weatherError: "Počasí/poloha není k dispozici",
    instructionDoc: "Pracovní pokyn",
    help: "Návod",
    helpEmpty: "Návod zatím není k dispozici",
    dashOpen: "Otevřít",
    readLabel: "Přečteno",
    readUnread: "nepřečteno",
    readAllDone: "vše přečteno",
    dashMyProjects: "Moje projekty",
    dashToday: "Dnes",
    dashTomorrow: "Zítra",
    dashWeek: "Týden",
    dashNextWeek: "Příští týden",
    dashMyProjectsToday: "Moje projekty – dnes",
    dashNothingToday: "Na dnešek nic naplánováno",
    dashNoProjects: "Zatím žádné přiřazené projekty",
    dashOverdue: "po termínu",
    dashDone: "hotovo",
    msgFillRequired: "Vyplňte prosím všechna povinná pole.",
    msgEmployeeDeleted: "Zaměstnanec byl smazán.",
    msgNoEmailAddr: "E-mailová adresa není k dispozici.",
    msgCommentSavedOk: "✅ Komentář uložen.",
    msgNoteSaved: "Poznámka byla uložena.",
    msgLogoUploaded: "Logo bylo nahráno. Uložte prosím údaje o firmě.",
    msgPleaseLogin: "Nejprve se prosím přihlaste.",
    msgPmUnchanged: "Vedoucí projektu beze změny.",
    msgPmChanged: "Vedoucí projektu změněn.",
    msgPmNotFound: "V seznamu zaměstnanců nebyl nalezen vedoucí projektu s tímto jménem – viditelnost nelze přenést.",
    msgProjectNoInstr: "Tento projekt zatím nemá žádné pokyny.",
    msgTranslatingGeneric: "Překládám...",
    msgReportPrepared: "Pracovní výkaz byl připraven z pracovního pokynu.",
    msgEmailNotEnabled: "🔒 Odesílání e-mailů není ve vašem balíčku aktivováno.",
    assignVisibility: "Přiřadit viditelnost",
    assignEmployees: "Přiřadit zaměstnance",
    assignProjectManager: "Přiřadit vedoucího projektu",
    instructionsLocked: "Vytváření pracovních pokynů je možné pouze pro vedoucí projektu a administrátory.",
    title: "Regie International",
    subtitle: "Zaznamenávejte, překládejte, ukládejte a odesílejte pracovní pokyny a pracovní výkazy.",
    loginTitle: "Přihlášení k výkazu",
    email: "E-mail",
    password: "Heslo",
    login: "Přihlásit se",
    register: "Registrovat",
    logout: "Odhlásit se",
    loggedInAs: "Přihlášen jako",
    saveLoad: "Uložit / načíst výkaz",
    reportName: "Název výkazu, např. týden 22 - dopoledne",
    saveReport: "Uložit výkaz",
    updateReport: "Aktualizovat výkaz",
    newReport: "Nový výkaz",
    savedReports: "Moje uložené výkazy",
    loadEdit: "Načíst / upravit",
    delete: "Smazat",
    general: "Obecné údaje",
    appLanguage: "Jazyk aplikace",
    pdfLanguage: "Jazyk PDF",
    employee: "Zaměstnanec",
    calendarWeek: "Kalendářní týden",
    recipientEmail: "E-mail příjemce pro odeslání PDF",
    customer: "Zákazník",
    projectNumber: "Číslo projektu",
    site: "Staveniště",
    hours: "Hodiny",
    startTime: "Začátek",
    endTime: "Konec",
    breakLabel: "Přestávka (min.)",
    description: "Popis práce",
    translation: "Překlad",
    deletePhoto: "Smazat fotografii",
    hoursOverview: "Přehled hodin",
    total: "Celkem",
    translateWeek: "Přeložit týden",
    translating: "Překládám...",
    save: "Uložit",
    update: "Aktualizovat",
    saveAsNew: "Uložit jako nový výkaz",
    downloadPdf: "Stáhnout PDF",
    sendPdf: "Odeslat PDF e-mailem",
    dashboard: "Přehled",
    projects: "Projekty",
    workInstructions: "Pracovní pokyny",
    dueToday: "Dnes ke splnění",
    totalProgress: "Celkový pokrok",
    stoppedSteps: "Zastavené pracovní kroky",
    stepsInProgress: "Pracovní kroky v průběhu",
    noProject: "Žádný projekt",
    projectsTab: "Projekty",
    projectName: "Název projektu",
    projectCustomer: "Zákazník",
    projectSite: "Staveniště",
    projectManager: "Vedoucí projektu",
    saveProject: "Uložit projekt",
    deleteProject: "Smazat projekt",
    openProject: "Otevřít projekt",
    closeProject: "Zavřít",
    progress: "Pokrok",
    noInstructions: "Pro tento projekt zatím nejsou žádné pracovní pokyny.",
    noReports: "Pro tento projekt zatím nejsou žádné pracovní výkazy.",
    reportsTab: "Pracovní výkazy",
    newInstruction: "Nový pracovní pokyn",
    instructionTitle: "Název",
    selectProject: "Vybrat projekt",
    problems: "Problémy / poznámky",
    material: "Materiál",
    werkzeug: "Nářadí",
    workSteps: "Pracovní kroky",
    addStep: "+ Pracovní krok",
    saveInstruction: "Uložit pracovní pokyn",
    savedInstructions: "Uložené pracovní pokyny",
    noInstructionsSaved: "Zatím žádné pracovní pokyny.",
    date: "Datum",
    project: "Projekt",
    translateTo: "Přeložit do",
    translating2: "Překládám...",
    translated: "Přeloženo",
    feedback: "Zpětná vazba",
    saveFeedback: "Uložit zpětnou vazbu",
    toReport: "Převzít do pracovního výkazu",
    transferTitle: "Kam převést?",
    transferInsert: "Vložit sem",
    transferNoReports: "Žádné uložené výkazy",
    travelTime: "Doba jízdy",
    teamReports: "Výkazy zaměstnanců",
    teamNoReports: "Žádné výkazy",
    travelOut: "Cesta tam",
    travelReturn: "Cesta zpět",
    km: "km",
    deleteInstruction: "Smazat pracovní pokyn",
    autoReportLocked: "Automatické pracovní výkazy nejsou ve vašem balíčku aktivovány.",
    employeeManagement: "Správa zaměstnanců",
    name: "Jméno",
    role: "Role",
    addEmployee: "Přidat zaměstnance",
    currentEmployees: "Současní zaměstnanci",
    resetPassword: "Obnovit heslo",
    companyData: "Údaje o firmě",
    uploadLogo: "Nahrát logo firmy",
    companyName: "Název firmy",
    street: "Ulice",
    zip: "PSČ",
    city: "Město",
    phone: "Telefon",
    website: "Webové stránky",
    taxNumber: "DIČ / daňové číslo",
    saveCompany: "Uložit údaje o firmě",
    reportNameLabel: "Název výkazu",
    firma: "Firma",
    feedbackLabel: "Zpětná vazba",
    noProjectsYet: "Zatím žádné projekty.",
    weekdays: ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"],
    noInstructionsYet: "Zatím žádné pracovní pokyny.",
    msgLoginOk: "Přihlášení úspěšné.",
    msgLogout: "Byli jste odhlášeni.",
    msgRegisterOk: "Registrace úspěšná.",
    msgRegisterFail: "Registrace se nezdařila: ",
    msgLoginFail: "Přihlášení se nezdařilo: ",
    msgSaved: "Nový výkaz byl uložen.",
    msgUpdated: "Výkaz byl aktualizován.",
    msgLoaded: "Výkaz byl načten.",
    msgDeleted: "Výkaz byl smazán.",
    msgTranslated: "Týden byl přeložen.",
    msgTranslateErr: "Chyba překladu: ",
    msgPhotoUploading: "Nahrávání fotografií...",
    msgPhotoOk: "Fotografie byly nahrány.",
    msgPhotoErr: "Chyba při nahrávání fotografií: ",
    msgPhotoLimit: "Je povoleno maximálně {n} fotografií.",
    msgSaving: "Ukládám pracovní pokyn...",
    msgNoFirm: "Žádná firma není načtena.",
    msgNoTitle: "Zadejte prosím název pracovního pokynu.",
    msgNoDate: "Zadejte prosím datum pracovního pokynu.",
    msgInstructionSaved: "Pracovní pokyn uložen.",
    msgInstructionDeleted: "Pracovní pokyn smazán.",
    msgFeedbackSaved: "Zpětná vazba uložena.",
    msgEmployeeAdded: "Zaměstnanec byl vytvořen.",
    msgPasswordReset: "E-mail pro obnovení hesla byl odeslán.",
    msgCompanySaved: "Údaje o firmě byly uloženy.",
    msgProjectSaved: "Projekt uložen.",
    msgProjectDeleted: "Projekt smazán.",
    msgInstructionTranslated: "Pracovní pokyn byl přeložen.",
    msgNewReport: "Nový výkaz zahájen.",
    msgNoEmployee: "Zadejte prosím zaměstnance.",
    msgEmailRequired: "Zadejte prosím e-mail příjemce.",
    msgEmailSending: "Odesílání PDF e-mailem...",
    msgEmailSent: "PDF bylo odesláno e-mailem.",
    tabReport: "Pracovní výkaz",
    photos: "Fotografie",
    deletePhoto2: "Smazat fotografii",
    tabDay: "Denní zobrazení",
    tabWeek: "Týdenní zobrazení",
    weekView: "Týdenní zobrazení",
    noInstructionsDay: "Žádné pracovní pokyny pro tento den.",
    noInstructionsWeek: "Žádné pracovní pokyny pro tento týden.",
    noInstructionsMonth: "Žádné pracovní pokyny pro tento měsíc.",
    tabMonth: "Měsíční zobrazení",
    dayView: "Denní zobrazení",
    monthView: "Měsíční zobrazení",
    selectDate: "Vybrat datum",
    noEntries: "Nebyly nalezeny žádné záznamy.",
    totalHoursMonth: "Celkem hodin za měsíc",
    hoursPerProject: "Hodiny na projekt",
    dailyEntry: "Denní záznam",
    saveDayEntry: "Uložit denní záznam",
    week: "Týden",
    statusOpen: "⬜ Otevřeno",
    statusInProgress: "🟡 Probíhá",
    statusStopped: "⛔ Zastaveno",
    statusCompleted: "✅ Hotovo",
    problemsHints: "Problémy / poznámky",
    roleEmployee: "Zaměstnanec",
    roleProjectManager: "Vedoucí projektu",
    roleAdmin: "Administrátor",
    commentLabel: "Komentář",
    commentPlaceholder: "Zadejte komentář...",
    commentSaveBtn: "Uložit",
    commentSaving: "Ukládám…",
    commentSaved: "Uloženo",
    commentErrorLabel: "Chyba",
    charsLabel: "Znaky",
    copyInstruction: "Kopírovat kroky",
    copyTitle: "Převzít kroky z pokynu",
    copySource: "Vybrat pokyn",
    copyWhichSteps: "Které pracovní kroky převzít?",
    copyAllNone: "Vše / nic",
    copyNoSteps: "Žádné pracovní kroky.",
    copyCancel: "Zrušit",
    copyConfirm: "Převzít",
    copySelectSource: "Vyberte prosím pokyn.",
    copyDone: "Pracovní kroky byly převzaty.",
  },
  Ukrainisch: {
    navigate: "Навігація",
    absenceReported: "Повідомлено",
    absenceTab: "Відпустка та відсутність", absenceVacation: "Відпустка", absenceSick: "Лікарняний", absenceFrom: "З", absenceTo: "До", absenceRequest: "Подати заявку", absencePending: "Відкрито", absenceApproved: "Затверджено", absenceRejected: "Відхилено", absenceApprove: "Затвердити", absenceReject: "Відхилити", absenceEmpty: "Немає заявок.",
    filterAll: "Усі",
    equipmentTab: "Транспорт та інструменти", equipmentVehicle: "Транспорт", equipmentTool: "Інструмент", equipmentIdentifier: "Номер", equipmentAssign: "Призначити", equipmentReturn: "Повернути", equipmentFree: "Доступно", equipmentHistory: "Історія", equipmentEmpty: "Обладнання ще не внесено.", equipmentType: "Тип",
    exportTab: "Експорт годин", exportMonth: "Місяць", exportDownload: "Завантажити CSV", exportEmpty: "Немає годин у вибраному місяці.", exportDays: "Робочі дні",
    materialOrder: "Замовити матеріал", materialOrders: "Замовлення", orderOpen: "Відкрито", orderOrdered: "Замовлено", orderDelivered: "Доставлено", ordersEmpty: "Замовлень немає.", orderNote: "Примітка",
    materialCatalog: "Каталог матеріалів", materialCatalogEmpty: "Матеріали ще не збережені.",
    materialUsed: "Використані матеріали", materialAdd: "Додати", materialQty: "Кількість", materialUnit: "Одиниця", materialName: "Назва", materialNone: "Матеріали ще не внесені.",
    editBtn: "Редагувати", cancelBtn: "Скасувати", saveBtn: "Зберегти", overviewBtn: "Огляд", languageLabel: "Мова", nationalityLabel: "Національність", phoneLabel: "Телефон", nameLabel: "Ім’я", readOnlyLabel: "Лише читання (інструкцію не можна редагувати)", readOnlyHint: "Лише читання – запис для цього облікового запису заблоковано.", commentEdited: "відредаговано", commentDeleteAsk: "Видалити цей запис?",
    feedbackTab: "Відгук", feedbackTitle: "Відгук тестувальника", feedbackIntro: "Будь ласка, додайте короткий відгук до кожного пункту.", feedbackSend: "Надіслати відгук", feedbackThanks: "Дякуємо за відгук!", feedbackReview: "Надіслані відгуки", feedbackNone: "Відгуків поки немає.",
    feedbackPoints: ["Вхід і пароль", "Інструкція та коментар", "Функція погоди", "Переклади", "Створення звіту", "Експорт PDF", "Види календаря", "Живий перекладач", "Використання на телефоні", "Загальне враження та помилки"],
    translatorHint: "Примітка: Переклад виконує ШІ – не завжди 100% точний.",
    translatorTab: "Перекладач", translatorTitle: "Живий перекладач", translatorPlaceholder: "Введіть текст…", translatorBtn: "Перекласти", translatorSwap: "Поміняти мови",
    weather: "Погода", weatherError: "Погода/місцезнаходження недоступні",
    instructionDoc: "Робоча інструкція",
    help: "Інструкція",
    helpEmpty: "Інструкцію ще не додано",
    dashOpen: "Відкрити",
    readLabel: "Прочитано",
    readUnread: "непрочитано",
    readAllDone: "усе прочитано",
    dashMyProjects: "Мої проєкти",
    dashToday: "Сьогодні",
    dashTomorrow: "Завтра",
    dashWeek: "Тиждень",
    dashNextWeek: "Наступний тиждень",
    dashMyProjectsToday: "Мої проєкти – сьогодні",
    dashNothingToday: "На сьогодні нічого не заплановано",
    dashNoProjects: "Ще немає призначених проєктів",
    dashOverdue: "прострочено",
    dashDone: "готово",
    msgFillRequired: "Будь ласка, заповніть усі обов'язкові поля.",
    msgEmployeeDeleted: "Працівника видалено.",
    msgNoEmailAddr: "Немає електронної адреси.",
    msgCommentSavedOk: "✅ Коментар збережено.",
    msgNoteSaved: "Нотатку збережено.",
    msgLogoUploaded: "Логотип завантажено. Збережіть дані компанії.",
    msgPleaseLogin: "Будь ласка, спочатку увійдіть.",
    msgPmUnchanged: "Керівник проєкту без змін.",
    msgPmChanged: "Керівника проєкту змінено.",
    msgPmNotFound: "Керівника проєкту з таким іменем у списку працівників не знайдено – видимість неможливо передати.",
    msgProjectNoInstr: "Цей проєкт ще не має інструкцій.",
    msgTranslatingGeneric: "Перекладаю...",
    msgReportPrepared: "Робочий звіт підготовлено з робочої інструкції.",
    msgEmailNotEnabled: "🔒 Надсилання e-mail не активовано у вашому пакеті.",
    assignVisibility: "Призначити видимість",
    assignEmployees: "Призначити працівників",
    assignProjectManager: "Призначити керівника проєкту",
    instructionsLocked: "Створювати робочі інструкції можуть лише керівники проєкту та адміністратори.",
    title: "Regie International",
    subtitle: "Створюйте, перекладайте, зберігайте та надсилайте робочі інструкції та робочі звіти.",
    loginTitle: "Вхід до звіту",
    email: "Електронна пошта",
    password: "Пароль",
    login: "Увійти",
    register: "Реєстрація",
    logout: "Вийти",
    loggedInAs: "Увійшли як",
    saveLoad: "Зберегти / завантажити звіт",
    reportName: "Назва звіту, напр. тижд. 22 - ранок",
    saveReport: "Зберегти звіт",
    updateReport: "Оновити звіт",
    newReport: "Новий звіт",
    savedReports: "Мої збережені звіти",
    loadEdit: "Завантажити / редагувати",
    delete: "Видалити",
    general: "Загальні дані",
    appLanguage: "Мова додатка",
    pdfLanguage: "Мова PDF",
    employee: "Працівник",
    calendarWeek: "Календарний тиждень",
    recipientEmail: "E-mail отримувача для надсилання PDF",
    customer: "Замовник",
    projectNumber: "Номер проєкту",
    site: "Об'єкт",
    hours: "Години",
    startTime: "Початок",
    endTime: "Кінець",
    breakLabel: "Перерва (хв.)",
    description: "Опис роботи",
    translation: "Переклад",
    deletePhoto: "Видалити фото",
    hoursOverview: "Огляд годин",
    total: "Разом",
    translateWeek: "Перекласти тиждень",
    translating: "Перекладається...",
    save: "Зберегти",
    update: "Оновити",
    saveAsNew: "Зберегти як новий звіт",
    downloadPdf: "Завантажити PDF",
    sendPdf: "Надіслати PDF ел. поштою",
    dashboard: "Панель",
    projects: "Проєкти",
    workInstructions: "Робочі інструкції",
    dueToday: "Термін сьогодні",
    totalProgress: "Загальний прогрес",
    stoppedSteps: "Зупинені робочі кроки",
    stepsInProgress: "Робочі кроки в роботі",
    noProject: "Немає проєкту",
    projectsTab: "Проєкти",
    projectName: "Назва проєкту",
    projectCustomer: "Замовник",
    projectSite: "Об'єкт",
    projectManager: "Керівник проєкту",
    saveProject: "Зберегти проєкт",
    deleteProject: "Видалити проєкт",
    openProject: "Відкрити проєкт",
    closeProject: "Закрити",
    progress: "Прогрес",
    noInstructions: "Для цього проєкту ще немає робочих інструкцій.",
    noReports: "Для цього проєкту ще немає робочих звітів.",
    reportsTab: "Робочі звіти",
    newInstruction: "Нова робоча інструкція",
    instructionTitle: "Назва",
    selectProject: "Вибрати проєкт",
    problems: "Проблеми / примітки",
    material: "Матеріал",
    werkzeug: "Інструменти",
    workSteps: "Робочі кроки",
    addStep: "+ Робочий крок",
    saveInstruction: "Зберегти інструкцію",
    savedInstructions: "Збережені інструкції",
    noInstructionsSaved: "Ще немає робочих інструкцій.",
    date: "Дата",
    project: "Проєкт",
    translateTo: "Перекласти на",
    translating2: "Перекладається...",
    translated: "Перекладено",
    feedback: "Відгук",
    saveFeedback: "Зберегти відгук",
    toReport: "Додати до звіту",
    transferTitle: "Куди перенести?",
    transferInsert: "Вставити сюди",
    transferNoReports: "Немає збережених звітів",
    travelTime: "Час у дорозі",
    teamReports: "Звіти працівників",
    teamNoReports: "Немає звітів",
    travelOut: "Туди",
    travelReturn: "Назад",
    km: "km",
    deleteInstruction: "Видалити інструкцію",
    autoReportLocked: "Автоматичні звіти не активовані у вашому пакеті.",
    employeeManagement: "Управління працівниками",
    name: "Ім'я",
    role: "Роль",
    addEmployee: "Додати працівника",
    currentEmployees: "Поточні працівники",
    resetPassword: "Скинути пароль",
    companyData: "Дані компанії",
    uploadLogo: "Завантажити логотип",
    companyName: "Назва компанії",
    street: "Вулиця",
    zip: "Поштовий індекс",
    city: "Місто",
    phone: "Телефон",
    website: "Вебсайт",
    taxNumber: "Податковий номер",
    saveCompany: "Зберегти дані компанії",
    reportNameLabel: "Назва звіту",
    firma: "Компанія",
    feedbackLabel: "Відгук",
    noProjectsYet: "Ще немає проєктів.",
    weekdays: ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота", "Неділя"],
    noInstructionsYet: "Ще немає робочих інструкцій.",
    msgLoginOk: "Вхід успішний.",
    msgLogout: "Ви вийшли з системи.",
    msgRegisterOk: "Реєстрація успішна.",
    msgRegisterFail: "Помилка реєстрації: ",
    msgLoginFail: "Помилка входу: ",
    msgSaved: "Новий звіт збережено.",
    msgUpdated: "Звіт оновлено.",
    msgLoaded: "Звіт завантажено.",
    msgDeleted: "Звіт видалено.",
    msgTranslated: "Тиждень перекладено.",
    msgTranslateErr: "Помилка перекладу: ",
    msgPhotoUploading: "Завантаження фото...",
    msgPhotoOk: "Фото завантажено.",
    msgPhotoErr: "Помилка завантаження фото: ",
    msgPhotoLimit: "Дозволено максимум {n} фото.",
    msgSaving: "Збереження інструкції...",
    msgNoFirm: "Компанію не завантажено.",
    msgNoTitle: "Будь ласка, введіть назву інструкції.",
    msgNoDate: "Будь ласка, введіть дату інструкції.",
    msgInstructionSaved: "Інструкцію збережено.",
    msgInstructionDeleted: "Інструкцію видалено.",
    msgFeedbackSaved: "Відгук збережено.",
    msgEmployeeAdded: "Працівника створено.",
    msgPasswordReset: "Лист для скидання пароля надіслано.",
    msgCompanySaved: "Дані компанії збережено.",
    msgProjectSaved: "Проєкт збережено.",
    msgProjectDeleted: "Проєкт видалено.",
    msgInstructionTranslated: "Інструкцію перекладено.",
    msgNewReport: "Розпочато новий звіт.",
    msgNoEmployee: "Будь ласка, вкажіть працівника.",
    msgEmailRequired: "Будь ласка, введіть e-mail отримувача.",
    msgEmailSending: "Надсилання PDF ел. поштою...",
    msgEmailSent: "PDF надіслано ел. поштою.",
    tabReport: "Робочий звіт",
    photos: "Фото",
    deletePhoto2: "Видалити фото",
    tabDay: "Перегляд дня",
    tabWeek: "Перегляд тижня",
    weekView: "Перегляд тижня",
    noInstructionsDay: "Немає інструкцій на цей день.",
    noInstructionsWeek: "Немає інструкцій на цей тиждень.",
    noInstructionsMonth: "Немає інструкцій на цей місяць.",
    tabMonth: "Перегляд місяця",
    dayView: "Перегляд дня",
    monthView: "Перегляд місяця",
    selectDate: "Вибрати дату",
    noEntries: "Записів не знайдено.",
    totalHoursMonth: "Всього годин за місяць",
    hoursPerProject: "Години на проєкт",
    dailyEntry: "Щоденний запис",
    saveDayEntry: "Зберегти щоденний запис",
    week: "Тиждень",
    statusOpen: "⬜ Відкрито",
    statusInProgress: "🟡 В роботі",
    statusStopped: "⛔ Зупинено",
    statusCompleted: "✅ Виконано",
    problemsHints: "Проблеми / примітки",
    roleEmployee: "Працівник",
    roleProjectManager: "Керівник проєкту",
    roleAdmin: "Адміністратор",
    commentLabel: "Коментар",
    commentPlaceholder: "Введіть коментар...",
    commentSaveBtn: "Зберегти",
    commentSaving: "Збереження…",
    commentSaved: "Збережено",
    commentErrorLabel: "Помилка",
    charsLabel: "Символи",
    copyInstruction: "Копіювати кроки",
    copyTitle: "Перенести кроки з інструкції",
    copySource: "Вибрати інструкцію",
    copyWhichSteps: "Які кроки перенести?",
    copyAllNone: "Усі / жодного",
    copyNoSteps: "Немає робочих кроків.",
    copyCancel: "Скасувати",
    copyConfirm: "Перенести",
    copySelectSource: "Будь ласка, виберіть інструкцію.",
    copyDone: "Робочі кроки перенесено.",
  },
  Bulgarisch: {
    navigate: "Навигация",
    absenceReported: "Съобщено",
    absenceTab: "Отпуск и отсъствия", absenceVacation: "Отпуск", absenceSick: "Болничен", absenceFrom: "От", absenceTo: "До", absenceRequest: "Заяви", absencePending: "Отворена", absenceApproved: "Одобрена", absenceRejected: "Отхвърлена", absenceApprove: "Одобри", absenceReject: "Отхвърли", absenceEmpty: "Няма заявки.",
    filterAll: "Всички",
    equipmentTab: "Превозни средства и инструменти", equipmentVehicle: "Превозно средство", equipmentTool: "Инструмент", equipmentIdentifier: "Регистрационен / номер", equipmentAssign: "Присвои", equipmentReturn: "Върни", equipmentFree: "Свободно", equipmentHistory: "История", equipmentEmpty: "Все още няма въведено оборудване.", equipmentType: "Тип",
    exportTab: "Експорт на часове", exportMonth: "Месец", exportDownload: "Изтегли CSV", exportEmpty: "Няма часове за избрания месец.", exportDays: "Работни дни",
    materialOrder: "Поръчай материал", materialOrders: "Поръчки", orderOpen: "Отворена", orderOrdered: "Поръчана", orderDelivered: "Доставена", ordersEmpty: "Няма поръчки.", orderNote: "Бележка",
    materialCatalog: "Каталог с материали", materialCatalogEmpty: "Все още няма записани материали.",
    materialUsed: "Изразходван материал", materialAdd: "Добави", materialQty: "Количество", materialUnit: "Мерна единица", materialName: "Наименование", materialNone: "Все още няма въведен материал.",
    editBtn: "Редактиране", cancelBtn: "Отказ", saveBtn: "Запази", overviewBtn: "Преглед", languageLabel: "Език", nationalityLabel: "Националност", phoneLabel: "Телефон", nameLabel: "Име", readOnlyLabel: "Само четене (инструкцията не може да се редактира)", readOnlyHint: "Само четене – писането е забранено за този акаунт.", commentEdited: "редактирано", commentDeleteAsk: "Да се изтрие ли този запис?",
    feedbackTab: "Отзиви", feedbackTitle: "Обратна връзка от тестер", feedbackIntro: "Моля, добавете кратка обратна връзка за всяка точка.", feedbackSend: "Изпрати обратна връзка", feedbackThanks: "Благодарим за обратната връзка!", feedbackReview: "Изпратени отзиви", feedbackNone: "Все още няма обратна връзка.",
    feedbackPoints: ["Вход и парола", "Инструкция и коментар", "Функция за времето", "Преводи", "Създаване на отчет", "Експорт в PDF", "Изгледи на календара", "Жив преводач", "Използване на телефон", "Общо впечатление и грешки"],
    translatorHint: "Забележка: Преводът е от ИИ – не винаги 100% точен.",
    translatorTab: "Преводач", translatorTitle: "Жив преводач", translatorPlaceholder: "Въведете текст…", translatorBtn: "Преведи", translatorSwap: "Размяна на езици",
    weather: "Време", weatherError: "Времето/местоположението не е налично",
    instructionDoc: "Работна инструкция",
    help: "Инструкции",
    helpEmpty: "Инструкциите още не са въведени",
    dashOpen: "Отвори",
    readLabel: "Прочетено",
    readUnread: "непрочетено",
    readAllDone: "всичко прочетено",
    dashMyProjects: "Моите проекти",
    dashToday: "Днес",
    dashTomorrow: "Утре",
    dashWeek: "Седмица",
    dashNextWeek: "Следваща седмица",
    dashMyProjectsToday: "Моите проекти – днес",
    dashNothingToday: "Днес няма планирано",
    dashNoProjects: "Още няма възложени проекти",
    dashOverdue: "просрочено",
    dashDone: "готово",
    msgFillRequired: "Моля, попълнете всички задължителни полета.",
    msgEmployeeDeleted: "Служителят е изтрит.",
    msgNoEmailAddr: "Няма имейл адрес.",
    msgCommentSavedOk: "✅ Коментарът е запазен.",
    msgNoteSaved: "Бележката е запазена.",
    msgLogoUploaded: "Логото е качено. Моля, запазете данните на фирмата.",
    msgPleaseLogin: "Моля, първо влезте.",
    msgPmUnchanged: "Ръководителят на проект е непроменен.",
    msgPmChanged: "Ръководителят на проект е променен.",
    msgPmNotFound: "Не е намерен ръководител на проект с това име в списъка със служители – видимостта не може да бъде прехвърлена.",
    msgProjectNoInstr: "Този проект още няма инструкции.",
    msgTranslatingGeneric: "Превеждане...",
    msgReportPrepared: "Отчетът е подготвен от работната инструкция.",
    msgEmailNotEnabled: "🔒 Изпращането на имейли не е активирано във вашия пакет.",
    assignVisibility: "Присвояване на видимост",
    assignEmployees: "Присвояване на служители",
    assignProjectManager: "Присвояване на ръководител на проект",
    instructionsLocked: "Създаването на работни инструкции е възможно само за ръководители на проект и администратори.",
    title: "Regie International",
    subtitle: "Създавайте, превеждайте, запазвайте и изпращайте работни инструкции и отчети.",
    loginTitle: "Вход към отчета",
    email: "Имейл",
    password: "Парола",
    login: "Влизане",
    register: "Регистрация",
    logout: "Изход",
    loggedInAs: "Влезъл като",
    saveLoad: "Запазване / зареждане на отчет",
    reportName: "Име на отчета, напр. седм. 22 - сутрин",
    saveReport: "Запазване на отчет",
    updateReport: "Обновяване на отчет",
    newReport: "Нов отчет",
    savedReports: "Моите запазени отчети",
    loadEdit: "Зареждане / редактиране",
    delete: "Изтриване",
    general: "Общи данни",
    appLanguage: "Език на приложението",
    pdfLanguage: "Език на PDF",
    employee: "Служител",
    calendarWeek: "Календарна седмица",
    recipientEmail: "Имейл на получателя за PDF",
    customer: "Клиент",
    projectNumber: "Номер на проект",
    site: "Строителен обект",
    hours: "Часове",
    startTime: "Начало",
    endTime: "Край",
    breakLabel: "Почивка (мин.)",
    description: "Описание на работата",
    translation: "Превод",
    deletePhoto: "Изтриване на снимка",
    hoursOverview: "Преглед на часовете",
    total: "Общо",
    translateWeek: "Превод на седмицата",
    translating: "Превеждане...",
    save: "Запазване",
    update: "Обновяване",
    saveAsNew: "Запази като нов отчет",
    downloadPdf: "Изтегляне на PDF",
    sendPdf: "Изпращане на PDF по имейл",
    dashboard: "Табло",
    projects: "Проекти",
    workInstructions: "Работни инструкции",
    dueToday: "За днес",
    totalProgress: "Общ напредък",
    stoppedSteps: "Спрени работни стъпки",
    stepsInProgress: "Работни стъпки в ход",
    noProject: "Няма проект",
    projectsTab: "Проекти",
    projectName: "Име на проект",
    projectCustomer: "Клиент",
    projectSite: "Строителен обект",
    projectManager: "Ръководител на проект",
    saveProject: "Запазване на проект",
    deleteProject: "Изтриване на проект",
    openProject: "Отваряне на проект",
    closeProject: "Затваряне",
    progress: "Напредък",
    noInstructions: "Още няма работни инструкции за този проект.",
    noReports: "Още няма отчети за този проект.",
    reportsTab: "Отчети",
    newInstruction: "Нова работна инструкция",
    instructionTitle: "Заглавие",
    selectProject: "Избор на проект",
    problems: "Проблеми / бележки",
    material: "Материали",
    werkzeug: "Инструменти",
    workSteps: "Работни стъпки",
    addStep: "+ Работна стъпка",
    saveInstruction: "Запазване на инструкция",
    savedInstructions: "Запазени инструкции",
    noInstructionsSaved: "Още няма работни инструкции.",
    date: "Дата",
    project: "Проект",
    translateTo: "Превод на",
    translating2: "Превеждане...",
    translated: "Преведено",
    feedback: "Обратна връзка",
    saveFeedback: "Запазване на обратна връзка",
    toReport: "Добавяне към отчета",
    transferTitle: "Къде да се прехвърли?",
    transferInsert: "Вмъкни тук",
    transferNoReports: "Няма запазени отчети",
    travelTime: "Време за път",
    teamReports: "Отчети на служителите",
    teamNoReports: "Няма отчети",
    travelOut: "Отиване",
    travelReturn: "Връщане",
    km: "km",
    deleteInstruction: "Изтриване на инструкция",
    autoReportLocked: "Автоматичните отчети не са активирани във вашия пакет.",
    employeeManagement: "Управление на служители",
    name: "Име",
    role: "Роля",
    addEmployee: "Добавяне на служител",
    currentEmployees: "Текущи служители",
    resetPassword: "Нулиране на парола",
    companyData: "Данни за фирмата",
    uploadLogo: "Качване на лого",
    companyName: "Име на фирмата",
    street: "Улица",
    zip: "Пощенски код",
    city: "Град",
    phone: "Телефон",
    website: "Уебсайт",
    taxNumber: "ДДС / данъчен номер",
    saveCompany: "Запазване на данните",
    reportNameLabel: "Име на отчета",
    firma: "Фирма",
    feedbackLabel: "Обратна връзка",
    noProjectsYet: "Още няма проекти.",
    weekdays: ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"],
    noInstructionsYet: "Още няма работни инструкции.",
    msgLoginOk: "Успешно влизане.",
    msgLogout: "Излязохте от системата.",
    msgRegisterOk: "Успешна регистрация.",
    msgRegisterFail: "Неуспешна регистрация: ",
    msgLoginFail: "Неуспешно влизане: ",
    msgSaved: "Новият отчет е запазен.",
    msgUpdated: "Отчетът е обновен.",
    msgLoaded: "Отчетът е зареден.",
    msgDeleted: "Отчетът е изтрит.",
    msgTranslated: "Седмицата е преведена.",
    msgTranslateErr: "Грешка при превод: ",
    msgPhotoUploading: "Качване на снимки...",
    msgPhotoOk: "Снимките са качени.",
    msgPhotoErr: "Грешка при качване на снимки: ",
    msgPhotoLimit: "Разрешени са максимум {n} снимки.",
    msgSaving: "Запазване на инструкция...",
    msgNoFirm: "Няма заредена фирма.",
    msgNoTitle: "Моля, въведете заглавие на инструкцията.",
    msgNoDate: "Моля, въведете дата за инструкцията.",
    msgInstructionSaved: "Инструкцията е запазена.",
    msgInstructionDeleted: "Инструкцията е изтрита.",
    msgFeedbackSaved: "Обратната връзка е запазена.",
    msgEmployeeAdded: "Служителят е създаден.",
    msgPasswordReset: "Имейлът за нулиране на паролата е изпратен.",
    msgCompanySaved: "Данните за фирмата са запазени.",
    msgProjectSaved: "Проектът е запазен.",
    msgProjectDeleted: "Проектът е изтрит.",
    msgInstructionTranslated: "Инструкцията е преведена.",
    msgNewReport: "Започнат е нов отчет.",
    msgNoEmployee: "Моля, въведете служител.",
    msgEmailRequired: "Моля, въведете имейл на получателя.",
    msgEmailSending: "Изпращане на PDF по имейл...",
    msgEmailSent: "PDF е изпратен по имейл.",
    tabReport: "Отчет",
    photos: "Снимки",
    deletePhoto2: "Изтриване на снимка",
    tabDay: "Дневен изглед",
    tabWeek: "Седмичен изглед",
    weekView: "Седмичен изглед",
    noInstructionsDay: "Няма инструкции за този ден.",
    noInstructionsWeek: "Няма инструкции за тази седмица.",
    noInstructionsMonth: "Няма инструкции за този месец.",
    tabMonth: "Месечен изглед",
    dayView: "Дневен изглед",
    monthView: "Месечен изглед",
    selectDate: "Избор на дата",
    noEntries: "Не са намерени записи.",
    totalHoursMonth: "Общо часове за месеца",
    hoursPerProject: "Часове на проект",
    dailyEntry: "Дневен запис",
    saveDayEntry: "Запазване на дневен запис",
    week: "Седмица",
    statusOpen: "⬜ Отворен",
    statusInProgress: "🟡 В процес",
    statusStopped: "⛔ Спрян",
    statusCompleted: "✅ Завършен",
    problemsHints: "Проблеми / бележки",
    roleEmployee: "Служител",
    roleProjectManager: "Ръководител на проект",
    roleAdmin: "Администратор",
    commentLabel: "Коментар",
    commentPlaceholder: "Въведете коментар...",
    commentSaveBtn: "Запазване",
    commentSaving: "Запазване…",
    commentSaved: "Запазено",
    commentErrorLabel: "Грешка",
    charsLabel: "Знаци",
    copyInstruction: "Копиране на стъпки",
    copyTitle: "Прехвърляне на стъпки от инструкция",
    copySource: "Избор на инструкция",
    copyWhichSteps: "Кои работни стъпки да се прехвърлят?",
    copyAllNone: "Всички / никои",
    copyNoSteps: "Няма работни стъпки.",
    copyCancel: "Отказ",
    copyConfirm: "Прехвърляне",
    copySelectSource: "Моля, изберете инструкция.",
    copyDone: "Работните стъпки са прехвърлени.",
  },
  Serbisch: {
    navigate: "Navigacija",
    absenceReported: "Prijavljeno",
    absenceTab: "Godišnji i odsustva", absenceVacation: "Godišnji odmor", absenceSick: "Bolovanje", absenceFrom: "Od", absenceTo: "Do", absenceRequest: "Podnesi zahtev", absencePending: "Otvoreno", absenceApproved: "Odobreno", absenceRejected: "Odbijeno", absenceApprove: "Odobri", absenceReject: "Odbij", absenceEmpty: "Nema prijava.",
    filterAll: "Sve",
    equipmentTab: "Vozila i alati", equipmentVehicle: "Vozilo", equipmentTool: "Alat", equipmentIdentifier: "Registracija / broj", equipmentAssign: "Dodeli", equipmentReturn: "Vrati", equipmentFree: "Dostupno", equipmentHistory: "Istorija", equipmentEmpty: "Još nema unete opreme.", equipmentType: "Vrsta",
    exportTab: "Izvoz sati", exportMonth: "Mesec", exportDownload: "Preuzmi CSV", exportEmpty: "Nema sati u izabranom mesecu.", exportDays: "Radni dani",
    materialOrder: "Poruči materijal", materialOrders: "Porudžbine", orderOpen: "Otvoreno", orderOrdered: "Poručeno", orderDelivered: "Isporučeno", ordersEmpty: "Nema porudžbina.", orderNote: "Napomena",
    materialCatalog: "Katalog materijala", materialCatalogEmpty: "Još nema sačuvanog materijala.",
    materialUsed: "Utrošeni materijal", materialAdd: "Dodaj", materialQty: "Količina", materialUnit: "Jedinica", materialName: "Naziv", materialNone: "Još nema unetog materijala.",
    editBtn: "Izmeni", cancelBtn: "Otkaži", saveBtn: "Sačuvaj", overviewBtn: "Pregled", languageLabel: "Jezik", nationalityLabel: "Nacionalnost", phoneLabel: "Telefon", nameLabel: "Ime", readOnlyLabel: "Samo čitanje (radni nalog se ne može menjati)", readOnlyHint: "Samo čitanje – pisanje je onemogućeno za ovaj nalog.", commentEdited: "izmenjeno", commentDeleteAsk: "Obrisati ovaj unos?",
    feedbackTab: "Povratne informacije", feedbackTitle: "Povratne informacije testera", feedbackIntro: "Molimo dodajte kratku povratnu informaciju za svaku tačku.", feedbackSend: "Pošalji povratne informacije", feedbackThanks: "Hvala na povratnim informacijama!", feedbackReview: "Poslate povratne informacije", feedbackNone: "Još nema povratnih informacija.",
    feedbackPoints: ["Prijava i lozinka", "Radni nalog i komentar", "Funkcija vremena", "Prevodi", "Kreiranje izveštaja", "PDF izvoz", "Prikazi kalendara", "Prevodilac uživo", "Korišćenje na telefonu", "Ukupni utisak i greške"],
    translatorHint: "Napomena: Prevod pravi veštačka inteligencija – nije uvek 100% tačan.",
    translatorTab: "Prevodilac", translatorTitle: "Prevodilac uživo", translatorPlaceholder: "Unesite tekst…", translatorBtn: "Prevedi", translatorSwap: "Zameni jezike",
    weather: "Vreme", weatherError: "Vreme/lokacija nije dostupna",
    instructionDoc: "Radni nalog",
    help: "Uputstvo",
    helpEmpty: "Uputstvo još nije uneto",
    dashOpen: "Otvori",
    readLabel: "Pročitano",
    readUnread: "nepročitano",
    readAllDone: "sve pročitano",
    dashMyProjects: "Moji projekti",
    dashToday: "Danas",
    dashTomorrow: "Sutra",
    dashWeek: "Nedelja",
    dashNextWeek: "Sledeća nedelja",
    dashMyProjectsToday: "Moji projekti – danas",
    dashNothingToday: "Danas ništa nije planirano",
    dashNoProjects: "Još nema dodeljenih projekata",
    dashOverdue: "kasni",
    dashDone: "gotovo",
    msgFillRequired: "Molimo popunite sva obavezna polja.",
    msgEmployeeDeleted: "Radnik je obrisan.",
    msgNoEmailAddr: "Nema imejl adrese.",
    msgCommentSavedOk: "✅ Komentar sačuvan.",
    msgNoteSaved: "Beleška je sačuvana.",
    msgLogoUploaded: "Logo je otpremljen. Molimo sačuvajte podatke o firmi.",
    msgPleaseLogin: "Molimo prvo se prijavite.",
    msgPmUnchanged: "Rukovodilac projekta nepromenjen.",
    msgPmChanged: "Rukovodilac projekta promenjen.",
    msgPmNotFound: "Nije pronađen rukovodilac projekta sa ovim imenom na listi radnika – vidljivost se ne može preneti.",
    msgProjectNoInstr: "Ovaj projekat još nema naloga.",
    msgTranslatingGeneric: "Prevođenje...",
    msgReportPrepared: "Radni izveštaj je pripremljen iz radnog naloga.",
    msgEmailNotEnabled: "🔒 Slanje imejlova nije aktivirano u vašem paketu.",
    assignVisibility: "Dodeli vidljivost",
    assignEmployees: "Dodeli radnike",
    assignProjectManager: "Dodeli rukovodioca projekta",
    instructionsLocked: "Kreiranje radnih naloga moguće je samo za rukovodioce projekta i administratore.",
    title: "Regie International",
    subtitle: "Kreirajte, prevodite, čuvajte i šaljite radne naloge i radne izveštaje.",
    loginTitle: "Prijava na radni izveštaj",
    email: "Imejl",
    password: "Lozinka",
    login: "Prijavi se",
    register: "Registracija",
    logout: "Odjavi se",
    loggedInAs: "Prijavljeni kao",
    saveLoad: "Sačuvaj / učitaj izveštaj",
    reportName: "Naziv izveštaja, npr. sedm. 22 - prepodne",
    saveReport: "Sačuvaj izveštaj",
    updateReport: "Ažuriraj izveštaj",
    newReport: "Novi izveštaj",
    savedReports: "Moji sačuvani izveštaji",
    loadEdit: "Učitaj / uredi",
    delete: "Obriši",
    general: "Opšti podaci",
    appLanguage: "Jezik aplikacije",
    pdfLanguage: "Jezik PDF-a",
    employee: "Radnik",
    calendarWeek: "Kalendarska nedelja",
    recipientEmail: "Imejl primaoca za slanje PDF-a",
    customer: "Klijent",
    projectNumber: "Broj projekta",
    site: "Gradilište",
    hours: "Sati",
    startTime: "Početak",
    endTime: "Kraj",
    breakLabel: "Pauza (min.)",
    description: "Opis posla",
    translation: "Prevod",
    deletePhoto: "Obriši fotografiju",
    hoursOverview: "Pregled sati",
    total: "Ukupno",
    translateWeek: "Prevedi nedelju",
    translating: "Prevođenje...",
    save: "Sačuvaj",
    update: "Ažuriraj",
    saveAsNew: "Sačuvaj kao novi izveštaj",
    downloadPdf: "Preuzmi PDF",
    sendPdf: "Pošalji PDF imejlom",
    dashboard: "Kontrolna tabla",
    projects: "Projekti",
    workInstructions: "Radni nalozi",
    dueToday: "Rok danas",
    totalProgress: "Ukupan napredak",
    stoppedSteps: "Zaustavljeni radni koraci",
    stepsInProgress: "Radni koraci u toku",
    noProject: "Nema projekta",
    projectsTab: "Projekti",
    projectName: "Naziv projekta",
    projectCustomer: "Klijent",
    projectSite: "Gradilište",
    projectManager: "Rukovodilac projekta",
    saveProject: "Sačuvaj projekat",
    deleteProject: "Obriši projekat",
    openProject: "Otvori projekat",
    closeProject: "Zatvori",
    progress: "Napredak",
    noInstructions: "Za ovaj projekat još nema radnih naloga.",
    noReports: "Za ovaj projekat još nema radnih izveštaja.",
    reportsTab: "Radni izveštaji",
    newInstruction: "Novi radni nalog",
    instructionTitle: "Naslov",
    selectProject: "Izaberi projekat",
    problems: "Problemi / napomene",
    material: "Materijal",
    werkzeug: "Alat",
    workSteps: "Radni koraci",
    addStep: "+ Radni korak",
    saveInstruction: "Sačuvaj radni nalog",
    savedInstructions: "Sačuvani radni nalozi",
    noInstructionsSaved: "Još nema radnih naloga.",
    date: "Datum",
    project: "Projekat",
    translateTo: "Prevedi na",
    translating2: "Prevođenje...",
    translated: "Prevedeno",
    feedback: "Povratna informacija",
    saveFeedback: "Sačuvaj povratnu informaciju",
    toReport: "Dodaj u radni izveštaj",
    transferTitle: "Gde preneti?",
    transferInsert: "Ubaci ovde",
    transferNoReports: "Nema sačuvanih izveštaja",
    travelTime: "Vreme putovanja",
    teamReports: "Izveštaji radnika",
    teamNoReports: "Nema izveštaja",
    travelOut: "Polazak",
    travelReturn: "Povratak",
    km: "km",
    deleteInstruction: "Obriši radni nalog",
    autoReportLocked: "Automatski radni izveštaji nisu aktivirani u vašem paketu.",
    employeeManagement: "Upravljanje radnicima",
    name: "Ime",
    role: "Uloga",
    addEmployee: "Dodaj radnika",
    currentEmployees: "Trenutni radnici",
    resetPassword: "Resetuj lozinku",
    companyData: "Podaci o firmi",
    uploadLogo: "Otpremi logo firme",
    companyName: "Naziv firme",
    street: "Ulica",
    zip: "Poštanski broj",
    city: "Grad",
    phone: "Telefon",
    website: "Veb-sajt",
    taxNumber: "PIB / poreski broj",
    saveCompany: "Sačuvaj podatke o firmi",
    reportNameLabel: "Naziv izveštaja",
    firma: "Firma",
    feedbackLabel: "Povratna informacija",
    noProjectsYet: "Još nema projekata.",
    weekdays: ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"],
    noInstructionsYet: "Još nema radnih naloga.",
    msgLoginOk: "Prijava uspešna.",
    msgLogout: "Odjavljeni ste.",
    msgRegisterOk: "Registracija uspešna.",
    msgRegisterFail: "Registracija nije uspela: ",
    msgLoginFail: "Prijava nije uspela: ",
    msgSaved: "Novi izveštaj je sačuvan.",
    msgUpdated: "Izveštaj je ažuriran.",
    msgLoaded: "Izveštaj je učitan.",
    msgDeleted: "Izveštaj je obrisan.",
    msgTranslated: "Nedelja je prevedena.",
    msgTranslateErr: "Greška pri prevođenju: ",
    msgPhotoUploading: "Otpremanje fotografija...",
    msgPhotoOk: "Fotografije su otpremljene.",
    msgPhotoErr: "Greška pri otpremanju fotografija: ",
    msgPhotoLimit: "Dozvoljeno je najviše {n} fotografija.",
    msgSaving: "Čuvanje radnog naloga...",
    msgNoFirm: "Nije učitana nijedna firma.",
    msgNoTitle: "Unesite naslov radnog naloga.",
    msgNoDate: "Unesite datum radnog naloga.",
    msgInstructionSaved: "Radni nalog je sačuvan.",
    msgInstructionDeleted: "Radni nalog je obrisan.",
    msgFeedbackSaved: "Povratna informacija je sačuvana.",
    msgEmployeeAdded: "Radnik je kreiran.",
    msgPasswordReset: "Imejl za resetovanje lozinke je poslat.",
    msgCompanySaved: "Podaci o firmi su sačuvani.",
    msgProjectSaved: "Projekat je sačuvan.",
    msgProjectDeleted: "Projekat je obrisan.",
    msgInstructionTranslated: "Radni nalog je preveden.",
    msgNewReport: "Pokrenut je novi izveštaj.",
    msgNoEmployee: "Unesite radnika.",
    msgEmailRequired: "Unesite imejl primaoca.",
    msgEmailSending: "Slanje PDF-a imejlom...",
    msgEmailSent: "PDF je poslat imejlom.",
    tabReport: "Radni izveštaj",
    photos: "Fotografije",
    deletePhoto2: "Obriši fotografiju",
    tabDay: "Dnevni prikaz",
    tabWeek: "Nedeljni prikaz",
    weekView: "Nedeljni prikaz",
    noInstructionsDay: "Nema radnih naloga za ovaj dan.",
    noInstructionsWeek: "Nema radnih naloga za ovu nedelju.",
    noInstructionsMonth: "Nema radnih naloga za ovaj mesec.",
    tabMonth: "Mesečni prikaz",
    dayView: "Dnevni prikaz",
    monthView: "Mesečni prikaz",
    selectDate: "Izaberi datum",
    noEntries: "Nije pronađen nijedan unos.",
    totalHoursMonth: "Ukupno sati u mesecu",
    hoursPerProject: "Sati po projektu",
    dailyEntry: "Dnevni unos",
    saveDayEntry: "Sačuvaj dnevni unos",
    week: "Nedelja",
    statusOpen: "⬜ Otvoreno",
    statusInProgress: "🟡 U toku",
    statusStopped: "⛔ Zaustavljeno",
    statusCompleted: "✅ Završeno",
    problemsHints: "Problemi / napomene",
    roleEmployee: "Radnik",
    roleProjectManager: "Rukovodilac projekta",
    roleAdmin: "Administrator",
    commentLabel: "Komentar",
    commentPlaceholder: "Unesite komentar...",
    commentSaveBtn: "Sačuvaj",
    commentSaving: "Čuvanje…",
    commentSaved: "Sačuvano",
    commentErrorLabel: "Greška",
    charsLabel: "Znakovi",
    copyInstruction: "Kopiraj korake",
    copyTitle: "Preuzmi korake iz naloga",
    copySource: "Izaberi nalog",
    copyWhichSteps: "Koje radne korake preuzeti?",
    copyAllNone: "Sve / ništa",
    copyNoSteps: "Nema radnih koraka.",
    copyCancel: "Otkaži",
    copyConfirm: "Preuzmi",
    copySelectSource: "Izaberite nalog.",
    copyDone: "Radni koraci su preuzeti.",
  },
  Kroatisch: {
    navigate: "Navigacija",
    absenceReported: "Prijavljeno",
    absenceTab: "Godišnji i izostanci", absenceVacation: "Godišnji odmor", absenceSick: "Bolovanje", absenceFrom: "Od", absenceTo: "Do", absenceRequest: "Podnesi zahtjev", absencePending: "Otvoreno", absenceApproved: "Odobreno", absenceRejected: "Odbijeno", absenceApprove: "Odobri", absenceReject: "Odbij", absenceEmpty: "Nema prijava.",
    filterAll: "Sve",
    equipmentTab: "Vozila i alati", equipmentVehicle: "Vozilo", equipmentTool: "Alat", equipmentIdentifier: "Registracija / broj", equipmentAssign: "Dodijeli", equipmentReturn: "Vrati", equipmentFree: "Dostupno", equipmentHistory: "Povijest", equipmentEmpty: "Još nema unesenih uređaja.", equipmentType: "Vrsta",
    exportTab: "Izvoz sati", exportMonth: "Mjesec", exportDownload: "Preuzmi CSV", exportEmpty: "Nema sati u odabranom mjesecu.", exportDays: "Radni dani",
    materialOrder: "Naruči materijal", materialOrders: "Narudžbe", orderOpen: "Otvoreno", orderOrdered: "Naručeno", orderDelivered: "Isporučeno", ordersEmpty: "Nema narudžbi.", orderNote: "Napomena",
    materialCatalog: "Katalog materijala", materialCatalogEmpty: "Još nema spremljenog materijala.",
    materialUsed: "Utrošeni materijal", materialAdd: "Dodaj", materialQty: "Količina", materialUnit: "Jedinica", materialName: "Naziv", materialNone: "Još nema unesenog materijala.",
    editBtn: "Uredi", cancelBtn: "Odustani", saveBtn: "Spremi", overviewBtn: "Pregled", languageLabel: "Jezik", nationalityLabel: "Nacionalnost", phoneLabel: "Telefon", nameLabel: "Ime", readOnlyLabel: "Samo čitanje (radni nalog se ne može uređivati)", readOnlyHint: "Samo čitanje – pisanje je onemogućeno za ovaj račun.", commentEdited: "uređeno", commentDeleteAsk: "Izbrisati ovaj unos?",
    feedbackTab: "Povratne informacije", feedbackTitle: "Povratne informacije testera", feedbackIntro: "Molimo dodajte kratku povratnu informaciju za svaku točku.", feedbackSend: "Pošalji povratne informacije", feedbackThanks: "Hvala na povratnim informacijama!", feedbackReview: "Poslane povratne informacije", feedbackNone: "Još nema povratnih informacija.",
    feedbackPoints: ["Prijava i lozinka", "Radni nalog i komentar", "Funkcija vremena", "Prijevodi", "Izrada izvještaja", "PDF izvoz", "Prikazi kalendara", "Prevoditelj uživo", "Korištenje na mobitelu", "Ukupni dojam i greške"],
    translatorHint: "Napomena: Prijevod radi umjetna inteligencija – nije uvijek 100% točan.",
    translatorTab: "Prevoditelj", translatorTitle: "Prevoditelj uživo", translatorPlaceholder: "Unesite tekst…", translatorBtn: "Prevedi", translatorSwap: "Zamijeni jezike",
    weather: "Vrijeme", weatherError: "Vrijeme/lokacija nije dostupna",
    instructionDoc: "Radni nalog",
    help: "Upute",
    helpEmpty: "Upute još nisu unesene",
    dashOpen: "Otvori",
    readLabel: "Pročitano",
    readUnread: "nepročitano",
    readAllDone: "sve pročitano",
    dashMyProjects: "Moji projekti",
    dashToday: "Danas",
    dashTomorrow: "Sutra",
    dashWeek: "Tjedan",
    dashNextWeek: "Sljedeći tjedan",
    dashMyProjectsToday: "Moji projekti – danas",
    dashNothingToday: "Danas ništa nije planirano",
    dashNoProjects: "Još nema dodijeljenih projekata",
    dashOverdue: "u kašnjenju",
    dashDone: "gotovo",
    msgFillRequired: "Molimo ispunite sva obavezna polja.",
    msgEmployeeDeleted: "Djelatnik je obrisan.",
    msgNoEmailAddr: "Nema e-mail adrese.",
    msgCommentSavedOk: "✅ Komentar spremljen.",
    msgNoteSaved: "Bilješka je spremljena.",
    msgLogoUploaded: "Logo je učitan. Molimo spremite podatke tvrtke.",
    msgPleaseLogin: "Molimo prvo se prijavite.",
    msgPmUnchanged: "Voditelj projekta nepromijenjen.",
    msgPmChanged: "Voditelj projekta promijenjen.",
    msgPmNotFound: "Nije pronađen voditelj projekta s ovim imenom na popisu djelatnika – vidljivost se ne može prenijeti.",
    msgProjectNoInstr: "Ovaj projekt još nema naloga.",
    msgTranslatingGeneric: "Prevodim...",
    msgReportPrepared: "Radni izvještaj pripremljen iz radnog naloga.",
    msgEmailNotEnabled: "🔒 Slanje e-pošte nije aktivirano u vašem paketu.",
    assignVisibility: "Dodijeli vidljivost",
    assignEmployees: "Dodijeli djelatnike",
    assignProjectManager: "Dodijeli voditelja projekta",
    instructionsLocked: "Stvaranje radnih naloga moguće je samo za voditelje projekta i administratore.",
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
    saveAsNew: "Spremi kao novi izvještaj",
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
    material: "Materijal",
    werkzeug: "Alat",
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
    transferTitle: "Kamo prenijeti?",
    transferInsert: "Umetni ovdje",
    transferNoReports: "Nema spremljenih izvještaja",
    travelTime: "Vrijeme putovanja",
    teamReports: "Izvještaji radnika",
    teamNoReports: "Nema izvještaja",
    travelOut: "Polazak",
    travelReturn: "Povratak",
    km: "km",
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
    msgNoDate: "Unesite datum radne upute.",
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
    navigate: "Navigacija",
    absenceReported: "Prijavljeno",
    absenceTab: "Dopust in odsotnosti", absenceVacation: "Dopust", absenceSick: "Bolniška", absenceFrom: "Od", absenceTo: "Do", absenceRequest: "Oddaj vlogo", absencePending: "Odprto", absenceApproved: "Odobreno", absenceRejected: "Zavrnjeno", absenceApprove: "Odobri", absenceReject: "Zavrni", absenceEmpty: "Ni prijav.",
    filterAll: "Vse",
    equipmentTab: "Vozila in orodja", equipmentVehicle: "Vozilo", equipmentTool: "Orodje", equipmentIdentifier: "Registrska št. / številka", equipmentAssign: "Dodeli", equipmentReturn: "Vrni", equipmentFree: "Na voljo", equipmentHistory: "Zgodovina", equipmentEmpty: "Naprave še niso vnesene.", equipmentType: "Vrsta",
    exportTab: "Izvoz ur", exportMonth: "Mesec", exportDownload: "Prenesi CSV", exportEmpty: "Ni ur v izbranem mesecu.", exportDays: "Delovni dnevi",
    materialOrder: "Naroči material", materialOrders: "Naročila", orderOpen: "Odprto", orderOrdered: "Naročeno", orderDelivered: "Dostavljeno", ordersEmpty: "Ni naročil.", orderNote: "Opomba",
    materialCatalog: "Katalog materiala", materialCatalogEmpty: "Material še ni shranjen.",
    materialUsed: "Porabljen material", materialAdd: "Dodaj", materialQty: "Količina", materialUnit: "Enota", materialName: "Naziv", materialNone: "Material še ni vnesen.",
    editBtn: "Uredi", cancelBtn: "Prekliči", saveBtn: "Shrani", overviewBtn: "Pregled", languageLabel: "Jezik", nationalityLabel: "Narodnost", phoneLabel: "Telefon", nameLabel: "Ime", readOnlyLabel: "Samo branje (delovnega naloga ni mogoče urejati)", readOnlyHint: "Samo branje – pisanje je za ta račun onemogočeno.", commentEdited: "urejeno", commentDeleteAsk: "Izbrisati ta vnos?",
    feedbackTab: "Povratne informacije", feedbackTitle: "Povratne informacije preizkuševalca", feedbackIntro: "Prosimo, dodajte kratko povratno informacijo za vsako točko.", feedbackSend: "Pošlji povratne informacije", feedbackThanks: "Hvala za povratne informacije!", feedbackReview: "Oddane povratne informacije", feedbackNone: "Še ni povratnih informacij.",
    feedbackPoints: ["Prijava in geslo", "Delovni nalog in komentar", "Funkcija vremena", "Prevodi", "Ustvarjanje poročila", "Izvoz PDF", "Pogledi koledarja", "Živi prevajalnik", "Uporaba na telefonu", "Splošni vtis in napake"],
    translatorHint: "Opomba: Prevod naredi umetna inteligenca – ni vedno 100 % pravilen.",
    translatorTab: "Prevajalnik", translatorTitle: "Živi prevajalnik", translatorPlaceholder: "Vnesite besedilo…", translatorBtn: "Prevedi", translatorSwap: "Zamenjaj jezika",
    weather: "Vreme", weatherError: "Vreme/lokacija ni na voljo",
    instructionDoc: "Delovni nalog",
    help: "Navodila",
    helpEmpty: "Navodila še niso vnesena",
    dashOpen: "Odpri",
    readLabel: "Prebrano",
    readUnread: "neprebrano",
    readAllDone: "vse prebrano",
    dashMyProjects: "Moji projekti",
    dashToday: "Danes",
    dashTomorrow: "Jutri",
    dashWeek: "Teden",
    dashNextWeek: "Naslednji teden",
    dashMyProjectsToday: "Moji projekti – danes",
    dashNothingToday: "Danes ni nič načrtovano",
    dashNoProjects: "Še ni dodeljenih projektov",
    dashOverdue: "zamuja",
    dashDone: "končano",
    msgFillRequired: "Izpolnite vsa obvezna polja.",
    msgEmployeeDeleted: "Zaposleni je izbrisan.",
    msgNoEmailAddr: "E-poštni naslov ni na voljo.",
    msgCommentSavedOk: "✅ Komentar shranjen.",
    msgNoteSaved: "Opomba je shranjena.",
    msgLogoUploaded: "Logotip je naložen. Shranite podatke podjetja.",
    msgPleaseLogin: "Najprej se prijavite.",
    msgPmUnchanged: "Vodja projekta nespremenjen.",
    msgPmChanged: "Vodja projekta spremenjen.",
    msgPmNotFound: "Vodja projekta s tem imenom ni bil najden na seznamu zaposlenih – vidnosti ni mogoče prenesti.",
    msgProjectNoInstr: "Ta projekt še nima nalogov.",
    msgTranslatingGeneric: "Prevajam...",
    msgReportPrepared: "Delovno poročilo je pripravljeno iz delovnega naloga.",
    msgEmailNotEnabled: "🔒 Pošiljanje e-pošte ni aktivirano v vašem paketu.",
    assignVisibility: "Dodeli vidnost",
    assignEmployees: "Dodeli zaposlene",
    assignProjectManager: "Dodeli vodjo projekta",
    instructionsLocked: "Ustvarjanje delovnih nalogov je mogoče samo za vodje projektov in administratorje.",
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
    saveAsNew: "Shrani kot novo poročilo",
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
    material: "Material",
    werkzeug: "Orodje",
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
    transferTitle: "Kam prenesti?",
    transferInsert: "Vstavi sem",
    transferNoReports: "Ni shranjenih poročil",
    travelTime: "Čas vožnje",
    teamReports: "Poročila zaposlenih",
    teamNoReports: "Ni poročil",
    travelOut: "Pot tja",
    travelReturn: "Pot nazaj",
    km: "km",
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
    msgNoDate: "Vnesite datum delovnega navodila.",
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
    navigate: "Nawigacja",
    absenceReported: "Zgłoszone",
    absenceTab: "Urlop i nieobecności", absenceVacation: "Urlop", absenceSick: "Choroba", absenceFrom: "Od", absenceTo: "Do", absenceRequest: "Złóż wniosek", absencePending: "Otwarte", absenceApproved: "Zatwierdzone", absenceRejected: "Odrzucone", absenceApprove: "Zatwierdź", absenceReject: "Odrzuć", absenceEmpty: "Brak zgłoszeń.",
    filterAll: "Wszystkie",
    equipmentTab: "Pojazdy i narzędzia", equipmentVehicle: "Pojazd", equipmentTool: "Narzędzie", equipmentIdentifier: "Nr rejestracyjny / numer", equipmentAssign: "Przypisz", equipmentReturn: "Zwróć", equipmentFree: "Dostępne", equipmentHistory: "Historia", equipmentEmpty: "Brak zapisanego sprzętu.", equipmentType: "Typ",
    exportTab: "Eksport godzin", exportMonth: "Miesiąc", exportDownload: "Pobierz CSV", exportEmpty: "Brak godzin w wybranym miesiącu.", exportDays: "Dni robocze",
    materialOrder: "Zamów materiał", materialOrders: "Zamówienia", orderOpen: "Otwarte", orderOrdered: "Zamówione", orderDelivered: "Dostarczone", ordersEmpty: "Brak zamówień.", orderNote: "Notatka",
    materialCatalog: "Katalog materiałów", materialCatalogEmpty: "Brak zapisanych materiałów.",
    materialUsed: "Zużyty materiał", materialAdd: "Dodaj", materialQty: "Ilość", materialUnit: "Jednostka", materialName: "Nazwa", materialNone: "Brak zapisanego materiału.",
    editBtn: "Edytuj", cancelBtn: "Anuluj", saveBtn: "Zapisz", overviewBtn: "Przegląd", languageLabel: "Język", nationalityLabel: "Narodowość", phoneLabel: "Telefon", nameLabel: "Imię", readOnlyLabel: "Tylko odczyt (instrukcji nie można edytować)", readOnlyHint: "Tylko odczyt – pisanie jest zablokowane dla tego konta.", commentEdited: "edytowano", commentDeleteAsk: "Usunąć ten wpis?",
    feedbackTab: "Opinie", feedbackTitle: "Opinia testera", feedbackIntro: "Prosimy o krótką opinię do każdego punktu.", feedbackSend: "Wyślij opinię", feedbackThanks: "Dziękujemy za opinię!", feedbackReview: "Przesłane opinie", feedbackNone: "Brak opinii.",
    feedbackPoints: ["Logowanie i hasło", "Instrukcja i komentarz", "Funkcja pogody", "Tłumaczenia", "Tworzenie raportu", "Eksport PDF", "Widoki kalendarza", "Tłumacz na żywo", "Obsługa na telefonie", "Ogólne wrażenie i błędy"],
    translatorHint: "Uwaga: Tłumaczenie wykonuje AI – nie zawsze w 100% poprawne.",
    translatorTab: "Tłumacz", translatorTitle: "Tłumacz na żywo", translatorPlaceholder: "Wpisz tekst…", translatorBtn: "Przetłumacz", translatorSwap: "Zamień języki",
    weather: "Pogoda", weatherError: "Pogoda/lokalizacja niedostępna",
    instructionDoc: "Instrukcja robocza",
    help: "Instrukcja",
    helpEmpty: "Instrukcja jeszcze nie dodana",
    dashOpen: "Otwórz",
    readLabel: "Przeczytane",
    readUnread: "nieprzeczytane",
    readAllDone: "wszystko przeczytane",
    dashMyProjects: "Moje projekty",
    dashToday: "Dziś",
    dashTomorrow: "Jutro",
    dashWeek: "Tydzień",
    dashNextWeek: "Następny tydzień",
    dashMyProjectsToday: "Moje projekty – dzisiaj",
    dashNothingToday: "Nic na dziś",
    dashNoProjects: "Brak przydzielonych projektów",
    dashOverdue: "zaległe",
    dashDone: "gotowe",
    msgFillRequired: "Proszę wypełnić wszystkie wymagane pola.",
    msgEmployeeDeleted: "Pracownik został usunięty.",
    msgNoEmailAddr: "Brak adresu e-mail.",
    msgCommentSavedOk: "✅ Komentarz zapisany.",
    msgNoteSaved: "Notatka została zapisana.",
    msgLogoUploaded: "Logo zostało przesłane. Proszę zapisać dane firmy.",
    msgPleaseLogin: "Proszę najpierw się zalogować.",
    msgPmUnchanged: "Kierownik projektu bez zmian.",
    msgPmChanged: "Kierownik projektu zmieniony.",
    msgPmNotFound: "Nie znaleziono kierownika projektu o tym nazwisku na liście pracowników – widoczności nie można przenieść.",
    msgProjectNoInstr: "Ten projekt nie ma jeszcze instrukcji.",
    msgTranslatingGeneric: "Tłumaczę...",
    msgReportPrepared: "Raport roboczy przygotowano z instrukcji roboczej.",
    msgEmailNotEnabled: "🔒 Wysyłanie e-maili nie jest aktywne w Twoim pakiecie.",
    assignVisibility: "Przypisz widoczność",
    assignEmployees: "Przypisz pracowników",
    assignProjectManager: "Przypisz kierownika projektu",
    instructionsLocked: "Tworzenie instrukcji roboczych jest możliwe tylko dla kierowników projektu i administratorów.",
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
    saveAsNew: "Zapisz jako nowy raport",
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
    material: "Materiał",
    werkzeug: "Narzędzia",
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
    transferTitle: "Gdzie przenieść?",
    transferInsert: "Wstaw tutaj",
    transferNoReports: "Brak zapisanych raportów",
    travelTime: "Czas dojazdu",
    teamReports: "Raporty pracowników",
    teamNoReports: "Brak raportów",
    travelOut: "Dojazd",
    travelReturn: "Powrót",
    km: "km",
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
    msgNoDate: "Wprowadź datę instrukcji pracy.",
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
  Philippinisch: {"navigate":"Nabigasyon","absenceReported":"Naiulat","absenceTab":"Bakasyon at Pagliban","absenceVacation":"Bakasyon","absenceSick":"Sakit","absenceFrom":"Mula","absenceTo":"Hanggang","absenceRequest":"Mag-request","absencePending":"Bukas","absenceApproved":"Aprubado","absenceRejected":"Tinanggihan","absenceApprove":"Aprubahan","absenceReject":"Tanggihan","absenceEmpty":"Walang ulat.","filterAll":"Lahat","equipmentTab":"Sasakyan at Kagamitan","equipmentVehicle":"Sasakyan","equipmentTool":"Kagamitan","equipmentIdentifier":"Plaka / Numero","equipmentAssign":"Italaga","equipmentReturn":"Isauli","equipmentFree":"Available","equipmentHistory":"Kasaysayan","equipmentEmpty":"Wala pang naitalang kagamitan.","equipmentType":"Uri","exportTab":"Export ng Oras","exportMonth":"Buwan","exportDownload":"I-download ang CSV","exportEmpty":"Walang oras sa napiling buwan.","exportDays":"Araw ng Trabaho","materialOrder":"Mag-order ng Materyales","materialOrders":"Mga Order","orderOpen":"Bukas","orderOrdered":"Na-order","orderDelivered":"Naihatid","ordersEmpty":"Walang order.","orderNote":"Tala","materialCatalog":"Katalogo ng Materyales","materialCatalogEmpty":"Wala pang naitalang materyales.","materialUsed":"Nagamit na Materyales","materialAdd":"Idagdag","materialQty":"Dami","materialUnit":"Yunit","materialName":"Pangalan","materialNone":"Wala pang naitalang materyales.","editBtn":"I-edit","cancelBtn":"Kanselahin","saveBtn":"I-save","overviewBtn":"Pangkalahatan","languageLabel":"Wika","nationalityLabel":"Nasyonalidad","phoneLabel":"Telepono","nameLabel":"Pangalan","readOnlyLabel":"Basahin lamang (hindi ma-edit ang tagubilin sa trabaho)","readOnlyHint":"Basahin lamang – naka-lock ang pagsulat para sa account na ito.","commentEdited":"na-edit","commentDeleteAsk":"Burahin ang post na ito?","feedbackTab":"Feedback","feedbackTitle":"Feedback ng Tester","feedbackIntro":"Pakilagay ng maikling feedback sa bawat punto.","feedbackSend":"Ipadala ang Feedback","feedbackThanks":"Salamat sa iyong feedback!","feedbackReview":"Naibigay na Feedback","feedbackNone":"Wala pang feedback.","feedbackPoints":["Pag-login at Password","Tagubilin sa Trabaho at Komento","Panahon-Function","Mga Pagsasalin","Gumawa ng Regiebericht","PDF-Export","Mga View ng Kalendaryo","Live-Tagasalin","Paggamit sa Telepono","Pangkalahatang Impresyon at Error"],"translatorHint":"Paalala: Pagsasalin sa pamamagitan ng AI – hindi laging 100% tama.","translatorTab":"Tagasalin","translatorTitle":"Live-Tagasalin","translatorPlaceholder":"Maglagay ng teksto…","translatorBtn":"Isalin","translatorSwap":"Palitan ang mga wika","weather":"Panahon","weatherError":"Panahon/Lokasyon hindi available","instructionDoc":"Tagubilin sa Trabaho","help":"Gabay","helpEmpty":"Wala pang naitalang gabay","dashOpen":"Buksan","readLabel":"Nabasa","readUnread":"hindi nabasa","readAllDone":"lahat nabasa","dashMyProjects":"Aking mga Proyekto","dashToday":"Ngayon","dashTomorrow":"Bukas","dashWeek":"Linggo","dashNextWeek":"Susunod na Linggo","dashMyProjectsToday":"Aking mga Proyekto – ngayon","dashNothingToday":"Walang nakaplano ngayon","dashNoProjects":"Wala pang naitalagang proyekto","dashOverdue":"lampas na sa takdang oras","dashDone":"tapos na","msgFillRequired":"Pakisagot ang lahat ng kinakailangang field.","msgEmployeeDeleted":"Nabura ang empleyado.","msgNoEmailAddr":"Walang E-Mail-address.","msgCommentSavedOk":"✅ Nai-save ang komento.","msgNoteSaved":"Nai-save ang tala.","msgLogoUploaded":"Na-upload ang logo. Pakisave ang datos ng kumpanya.","msgPleaseLogin":"Mag-login muna.","msgPmUnchanged":"Hindi nabago ang project manager.","msgPmChanged":"Nabago ang project manager.","msgPmNotFound":"Walang nahanap na project manager sa pangalang ito sa listahan ng empleyado – hindi mailipat ang visibility.","msgProjectNoInstr":"Wala pang tagubilin ang proyektong ito.","msgTranslatingGeneric":"Nagsasalin...","msgReportPrepared":"Naihanda ang Regiebericht mula sa tagubilin sa trabaho.","msgEmailNotEnabled":"🔒 Hindi naka-enable ang pagpapadala ng E-Mail sa iyong pakete.","assignVisibility":"Italaga ang Visibility","assignEmployees":"Italaga ang mga Empleyado","assignProjectManager":"Italaga ang Project Manager","instructionsLocked":"Ang paggawa ng tagubilin sa trabaho ay para lamang sa project manager at admin.","title":"Regie International","subtitle":"Mag-record, magsalin, mag-save at magpadala ng mga tagubilin sa trabaho at Regiebericht.","loginTitle":"Regiebericht Login","email":"E-Mail","password":"Password","login":"Mag-login","register":"Magparehistro","logout":"Mag-logout","loggedInAs":"Naka-login bilang","saveLoad":"I-save / i-load ang ulat","reportName":"Pangalan ng ulat, hal. KW 22 - Umaga","saveReport":"I-save ang ulat","updateReport":"I-update ang ulat","newReport":"Bagong Ulat","savedReports":"Aking mga naka-save na ulat","loadEdit":"I-load / I-edit","delete":"Burahin","general":"Pangkalahatang Impormasyon","appLanguage":"Wika ng App","pdfLanguage":"Wika ng PDF","employee":"Empleyado","calendarWeek":"Linggo ng Kalendaryo","recipientEmail":"E-Mail ng tatanggap para sa pagpapadala ng PDF","customer":"Kliyente","projectNumber":"Numero ng Proyekto","site":"Site ng Konstruksyon","hours":"Oras","startTime":"Simula","endTime":"Katapusan","breakLabel":"Pahinga (Min.)","description":"Deskripsyon ng Trabaho","translation":"Pagsasalin","deletePhoto":"Burahin ang Larawan","hoursOverview":"Pangkalahatang Oras","total":"Kabuuan","translateWeek":"Isalin ang Linggo","translating":"Nagsasalin...","save":"I-save","update":"I-update","saveAsNew":"I-save bilang bagong ulat","downloadPdf":"I-download ang PDF","sendPdf":"Ipadala ang PDF sa E-Mail","dashboard":"Dashboard","projects":"Mga Proyekto","workInstructions":"Mga Tagubilin sa Trabaho","dueToday":"Takdang ngayon","totalProgress":"Kabuuang Progreso","stoppedSteps":"Mga Nahintong Hakbang sa Trabaho","stepsInProgress":"Mga Hakbang sa Trabahong Isinasagawa","noProject":"Walang Proyekto","projectsTab":"Mga Proyekto","projectName":"Pangalan ng Proyekto","projectCustomer":"Kliyente","projectSite":"Site ng Konstruksyon","projectManager":"Project Manager","saveProject":"I-save ang Proyekto","deleteProject":"Burahin ang Proyekto","openProject":"Buksan ang Proyekto","closeProject":"Isara","progress":"Progreso","noInstructions":"Wala pang tagubilin sa trabaho para sa proyektong ito.","noReports":"Wala pang Regiebericht para sa proyektong ito.","reportsTab":"Mga Regiebericht","newInstruction":"Bagong Tagubilin sa Trabaho","instructionTitle":"Pamagat","selectProject":"Pumili ng Proyekto","problems":"Mga Problema / Paalala","material":"Materyales","werkzeug":"Kagamitan","workSteps":"Mga Hakbang sa Trabaho","addStep":"+ Hakbang sa Trabaho","saveInstruction":"I-save ang Tagubilin sa Trabaho","savedInstructions":"Mga naka-save na Tagubilin sa Trabaho","noInstructionsSaved":"Wala pang tagubilin sa trabaho.","date":"Petsa","project":"Proyekto","translateTo":"Isalin sa","translating2":"Nagsasalin...","translated":"Naisalin","feedback":"Tugon","saveFeedback":"I-save ang Tugon","toReport":"Ilipat sa Regiebericht","transferTitle":"Saan ililipat?","transferInsert":"Ipasok dito","transferNoReports":"Walang naka-save na ulat","travelTime":"Oras ng Biyahe","teamReports":"Mga Ulat ng Empleyado","teamNoReports":"Walang ulat","travelOut":"Pagpunta","travelReturn":"Pagbalik","km":"km","deleteInstruction":"Burahin ang Tagubilin sa Trabaho","autoReportLocked":"Hindi naka-enable ang awtomatikong Regiebericht sa iyong pakete.","employeeManagement":"Pamamahala ng Empleyado","name":"Pangalan","role":"Papel","addEmployee":"Magdagdag ng Empleyado","currentEmployees":"Kasalukuyang mga Empleyado","resetPassword":"I-reset ang Password","companyData":"Datos ng Kumpanya","uploadLogo":"Mag-upload ng Logo ng Kumpanya","companyName":"Pangalan ng Kumpanya","street":"Kalye","zip":"ZIP","city":"Lungsod","phone":"Telepono","website":"Website","taxNumber":"UID / Numero ng Buwis","saveCompany":"I-save ang Datos ng Kumpanya","reportNameLabel":"Pangalan ng Ulat","firma":"Kumpanya","feedbackLabel":"Tugon","noProjectsYet":"Wala pang proyekto.","weekdays":["Lunes","Martes","Miyerkules","Huwebes","Biyernes","Sabado","Linggo"],"noInstructionsYet":"Wala pang tagubilin sa trabaho.","msgLoginOk":"Matagumpay ang login.","msgLogout":"Naka-logout ka na.","msgRegisterOk":"Matagumpay ang pagpaparehistro.","msgRegisterFail":"Nabigo ang pagpaparehistro: ","msgLoginFail":"Nabigo ang login: ","msgSaved":"Nai-save ang bagong ulat.","msgUpdated":"Na-update ang ulat.","msgLoaded":"Na-load ang ulat.","msgDeleted":"Nabura ang ulat.","msgTranslated":"Naisalin ang linggo.","msgTranslateErr":"Error sa pagsasalin: ","msgPhotoUploading":" Ina-upload ang mga larawan...","msgPhotoOk":"Na-upload ang mga larawan.","msgPhotoErr":"Error sa pag-upload ng larawan: ","msgPhotoLimit":"Maximum na {n} larawan ang pinapayagan.","msgSaving":"Ini-save ang tagubilin sa trabaho...","msgNoFirm":"Walang na-load na kumpanya.","msgNoTitle":"Pakilagay ang pamagat ng tagubilin sa trabaho.","msgNoDate":"Pakilagay ang petsa ng tagubilin sa trabaho.","msgInstructionSaved":"Nai-save ang tagubilin sa trabaho.","msgInstructionDeleted":"Nabura ang tagubilin sa trabaho.","msgFeedbackSaved":"Nai-save ang tugon.","msgEmployeeAdded":"Nalikha ang empleyado.","msgPasswordReset":"Naipadala ang E-Mail para sa pag-reset ng password.","msgCompanySaved":"Nai-save ang datos ng kumpanya.","msgProjectSaved":"Nai-save ang proyekto.","msgProjectDeleted":"Nabura ang proyekto.","msgInstructionTranslated":"Naisalin ang tagubilin sa trabaho.","msgNewReport":"Nagsimula ang bagong ulat.","msgNoEmployee":"Pakilagay ang empleyado.","msgEmailRequired":"Pakilagay ang E-Mail ng tatanggap.","msgEmailSending":"Ipinapadala ang PDF sa E-Mail...","msgEmailSent":"Naipadala ang PDF sa E-Mail.","tabReport":"Regiebericht","photos":"Mga Larawan","deletePhoto2":"Burahin ang Larawan","tabDay":"View ng Araw","tabWeek":"View ng Linggo","weekView":"View ng Linggo","noInstructionsDay":"Walang tagubilin sa trabaho para sa araw na ito.","noInstructionsWeek":"Walang tagubilin sa trabaho para sa linggong ito.","noInstructionsMonth":"Walang tagubilin sa trabaho para sa buwang ito.","tabMonth":"View ng Buwan","dayView":"View ng Araw","monthView":"View ng Buwan","selectDate":"Pumili ng Petsa","noEntries":"Walang nahanap na entry.","totalHoursMonth":"Kabuuang Oras sa Buwan","hoursPerProject":"Oras kada Proyekto","dailyEntry":"Entry ng Araw","saveDayEntry":"I-save ang Entry ng Araw","week":"Linggo","statusOpen":"⬜ Bukas","statusInProgress":"🟡 Isinasagawa","statusStopped":"⛔ Nahinto","statusCompleted":"✅ Tapos na","problemsHints":"Mga Problema / Paalala","roleEmployee":"Empleyado","roleProjectManager":"Project Manager","roleAdmin":"Admin","commentLabel":"Komento","commentPlaceholder":"Maglagay ng komento...","commentSaveBtn":"I-save","commentSaving":"Ini-save…","commentSaved":"Nai-save","commentErrorLabel":"Error","charsLabel":"Karakter","copyInstruction":"Kopyahin ang mga Hakbang","copyTitle":"Kunin ang mga hakbang mula sa tagubilin","copySource":"Pumili ng Tagubilin","copyWhichSteps":"Aling mga hakbang sa trabaho ang kukunin?","copyAllNone":"Lahat / Wala","copyNoSteps":"Walang hakbang sa trabaho.","copyCancel":"Kanselahin","copyConfirm":"Kunin","copySelectSource":"Pumili ng tagubilin.","copyDone":"Nakuha ang mga hakbang sa trabaho."},
  Vietnamesisch: {"navigate":"Điều hướng","absenceReported":"Đã báo","absenceTab":"Nghỉ phép & Vắng mặt","absenceVacation":"Nghỉ phép","absenceSick":"Ốm bệnh","absenceFrom":"Từ","absenceTo":"Đến","absenceRequest":"Xin phép","absencePending":"Chờ duyệt","absenceApproved":"Đã duyệt","absenceRejected":"Bị từ chối","absenceApprove":"Duyệt","absenceReject":"Từ chối","absenceEmpty":"Không có báo cáo.","filterAll":"Tất cả","equipmentTab":"Xe & Dụng cụ","equipmentVehicle":"Xe","equipmentTool":"Dụng cụ","equipmentIdentifier":"Biển số / Số hiệu","equipmentAssign":"Gán","equipmentReturn":"Trả lại","equipmentFree":"Có sẵn","equipmentHistory":"Lịch sử","equipmentEmpty":"Chưa có thiết bị nào.","equipmentType":"Loại","exportTab":"Xuất giờ công","exportMonth":"Tháng","exportDownload":"Tải CSV","exportEmpty":"Không có giờ công trong tháng đã chọn.","exportDays":"Ngày làm việc","materialOrder":"Đặt vật tư","materialOrders":"Đơn đặt hàng","orderOpen":"Chưa xử lý","orderOrdered":"Đã đặt","orderDelivered":"Đã giao","ordersEmpty":"Không có đơn đặt hàng.","orderNote":"Ghi chú","materialCatalog":"Danh mục vật tư","materialCatalogEmpty":"Chưa lưu vật tư nào.","materialUsed":"Vật tư đã dùng","materialAdd":"Thêm","materialQty":"Số lượng","materialUnit":"Đơn vị","materialName":"Tên gọi","materialNone":"Chưa ghi nhận vật tư nào.","editBtn":"Chỉnh sửa","cancelBtn":"Hủy","saveBtn":"Lưu","overviewBtn":"Tổng quan","languageLabel":"Ngôn ngữ","nationalityLabel":"Quốc tịch","phoneLabel":"Điện thoại","nameLabel":"Tên","readOnlyLabel":"Chỉ đọc (không sửa được hướng dẫn công việc)","readOnlyHint":"Chỉ đọc – tài khoản này bị khóa quyền ghi.","commentEdited":"đã chỉnh sửa","commentDeleteAsk":"Xóa bài viết này?","feedbackTab":"Phản hồi","feedbackTitle":"Phản hồi người thử nghiệm","feedbackIntro":"Vui lòng ghi ngắn gọn phản hồi cho từng mục.","feedbackSend":"Gửi phản hồi","feedbackThanks":"Cảm ơn phản hồi của bạn!","feedbackReview":"Phản hồi đã gửi","feedbackNone":"Chưa có phản hồi nào.","feedbackPoints":["Đăng nhập & Mật khẩu","Hướng dẫn công việc & Bình luận","Chức năng thời tiết","Bản dịch","Tạo báo cáo công việc","Xuất PDF","Chế độ xem lịch","Trình dịch trực tiếp","Sử dụng trên điện thoại","Ấn tượng chung & Lỗi"],"translatorHint":"Lưu ý: Dịch bằng AI – không phải lúc nào cũng chính xác 100 %.","translatorTab":"Trình dịch","translatorTitle":"Trình dịch trực tiếp","translatorPlaceholder":"Nhập văn bản…","translatorBtn":"Dịch","translatorSwap":"Đổi ngôn ngữ","weather":"Thời tiết","weatherError":"Thời tiết/vị trí không khả dụng","instructionDoc":"Hướng dẫn công việc","help":"Hướng dẫn","helpEmpty":"Chưa có hướng dẫn","dashOpen":"Mở","readLabel":"Đã đọc","readUnread":"chưa đọc","readAllDone":"đã đọc hết","dashMyProjects":"Dự án của tôi","dashToday":"Hôm nay","dashTomorrow":"Ngày mai","dashWeek":"Tuần","dashNextWeek":"Tuần sau","dashMyProjectsToday":"Dự án của tôi – hôm nay","dashNothingToday":"Hôm nay không có kế hoạch","dashNoProjects":"Chưa được giao dự án nào","dashOverdue":"quá hạn","dashDone":"hoàn thành","msgFillRequired":"Vui lòng điền tất cả các trường bắt buộc.","msgEmployeeDeleted":"Đã xóa nhân viên.","msgNoEmailAddr":"Không có địa chỉ e-mail.","msgCommentSavedOk":"✅ Đã lưu bình luận.","msgNoteSaved":"Đã lưu ghi chú.","msgLogoUploaded":"Đã tải logo lên. Vui lòng lưu thông tin công ty.","msgPleaseLogin":"Vui lòng đăng nhập trước.","msgPmUnchanged":"Trưởng dự án không thay đổi.","msgPmChanged":"Đã đổi trưởng dự án.","msgPmNotFound":"Không tìm thấy trưởng dự án nào có tên này trong danh sách nhân viên – không thể chuyển quyền hiển thị.","msgProjectNoInstr":"Dự án này chưa có hướng dẫn nào.","msgTranslatingGeneric":"Đang dịch...","msgReportPrepared":"Đã chuẩn bị báo cáo công việc từ hướng dẫn công việc.","msgEmailNotEnabled":"🔒 Gửi e-mail chưa được kích hoạt trong gói của bạn.","assignVisibility":"Gán quyền hiển thị","assignEmployees":"Gán nhân viên","assignProjectManager":"Gán trưởng dự án","instructionsLocked":"Chỉ trưởng dự án và quản trị viên mới tạo được hướng dẫn công việc.","title":"Regie International","subtitle":"Ghi nhận, dịch, lưu và gửi hướng dẫn công việc và báo cáo công việc.","loginTitle":"Đăng nhập báo cáo công việc","email":"E-mail","password":"Mật khẩu","login":"Đăng nhập","register":"Đăng ký","logout":"Đăng xuất","loggedInAs":"Đăng nhập với tên","saveLoad":"Lưu / tải báo cáo","reportName":"Tên báo cáo, ví dụ Tuần 22 - Buổi sáng","saveReport":"Lưu báo cáo","updateReport":"Cập nhật báo cáo","newReport":"Báo cáo mới","savedReports":"Báo cáo đã lưu của tôi","loadEdit":"Tải / Chỉnh sửa","delete":"Xóa","general":"Thông tin chung","appLanguage":"Ngôn ngữ ứng dụng","pdfLanguage":"Ngôn ngữ PDF","employee":"Nhân viên","calendarWeek":"Tuần lịch","recipientEmail":"E-mail người nhận để gửi PDF","customer":"Khách hàng","projectNumber":"Số dự án","site":"Công trường","hours":"Giờ","startTime":"Bắt đầu","endTime":"Kết thúc","breakLabel":"Nghỉ (phút)","description":"Mô tả công việc","translation":"Bản dịch","deletePhoto":"Xóa ảnh","hoursOverview":"Tổng quan giờ công","total":"Tổng","translateWeek":"Dịch cả tuần","translating":"Đang dịch...","save":"Lưu","update":"Cập nhật","saveAsNew":"Lưu thành báo cáo mới","downloadPdf":"Tải PDF","sendPdf":"Gửi PDF qua e-mail","dashboard":"Bảng điều khiển","projects":"Dự án","workInstructions":"Hướng dẫn công việc","dueToday":"Đến hạn hôm nay","totalProgress":"Tiến độ tổng","stoppedSteps":"Bước công việc đã dừng","stepsInProgress":"Bước công việc đang làm","noProject":"Không có dự án","projectsTab":"Dự án","projectName":"Tên dự án","projectCustomer":"Khách hàng","projectSite":"Công trường","projectManager":"Trưởng dự án","saveProject":"Lưu dự án","deleteProject":"Xóa dự án","openProject":"Mở dự án","closeProject":"Đóng","progress":"Tiến độ","noInstructions":"Chưa có hướng dẫn công việc cho dự án này.","noReports":"Chưa có báo cáo công việc cho dự án này.","reportsTab":"Báo cáo công việc","newInstruction":"Hướng dẫn công việc mới","instructionTitle":"Tiêu đề","selectProject":"Chọn dự án","problems":"Vấn đề / Lưu ý","material":"Vật tư","werkzeug":"Dụng cụ","workSteps":"Các bước công việc","addStep":"+ Bước công việc","saveInstruction":"Lưu hướng dẫn công việc","savedInstructions":"Hướng dẫn công việc đã lưu","noInstructionsSaved":"Chưa có hướng dẫn công việc nào.","date":"Ngày","project":"Dự án","translateTo":"Dịch sang","translating2":"Đang dịch...","translated":"Đã dịch","feedback":"Phản hồi","saveFeedback":"Lưu phản hồi","toReport":"Đưa vào báo cáo công việc","transferTitle":"Chuyển đến đâu?","transferInsert":"Chèn vào đây","transferNoReports":"Không có báo cáo đã lưu","travelTime":"Thời gian di chuyển","teamReports":"Báo cáo của nhân viên","teamNoReports":"Không có báo cáo nào","travelOut":"Lượt đi","travelReturn":"Lượt về","km":"km","deleteInstruction":"Xóa hướng dẫn công việc","autoReportLocked":"Báo cáo công việc tự động chưa được kích hoạt trong gói của bạn.","employeeManagement":"Quản lý nhân viên","name":"Tên","role":"Vai trò","addEmployee":"Thêm nhân viên","currentEmployees":"Nhân viên hiện tại","resetPassword":"Đặt lại mật khẩu","companyData":"Thông tin công ty","uploadLogo":"Tải logo công ty lên","companyName":"Tên công ty","street":"Đường","zip":"Mã bưu điện","city":"Thành phố","phone":"Điện thoại","website":"Trang web","taxNumber":"Mã số thuế / UID","saveCompany":"Lưu thông tin công ty","reportNameLabel":"Tên báo cáo","firma":"Công ty","feedbackLabel":"Phản hồi","noProjectsYet":"Chưa có dự án nào.","weekdays":["Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy","Chủ Nhật"],"noInstructionsYet":"Chưa có hướng dẫn công việc nào.","msgLoginOk":"Đăng nhập thành công.","msgLogout":"Bạn đã đăng xuất.","msgRegisterOk":"Đăng ký thành công.","msgRegisterFail":"Đăng ký thất bại: ","msgLoginFail":"Đăng nhập thất bại: ","msgSaved":"Đã lưu báo cáo mới.","msgUpdated":"Đã cập nhật báo cáo.","msgLoaded":"Đã tải báo cáo.","msgDeleted":"Đã xóa báo cáo.","msgTranslated":"Đã dịch cả tuần.","msgTranslateErr":"Lỗi khi dịch: ","msgPhotoUploading":"Đang tải ảnh lên...","msgPhotoOk":"Đã tải ảnh lên.","msgPhotoErr":"Lỗi khi tải ảnh lên: ","msgPhotoLimit":"Chỉ cho phép tối đa {n} ảnh.","msgSaving":"Đang lưu hướng dẫn công việc...","msgNoFirm":"Chưa tải công ty nào.","msgNoTitle":"Vui lòng nhập tiêu đề hướng dẫn công việc.","msgNoDate":"Vui lòng nhập ngày cho hướng dẫn công việc.","msgInstructionSaved":"Đã lưu hướng dẫn công việc.","msgInstructionDeleted":"Đã xóa hướng dẫn công việc.","msgFeedbackSaved":"Đã lưu phản hồi.","msgEmployeeAdded":"Đã tạo nhân viên.","msgPasswordReset":"Đã gửi e-mail đặt lại mật khẩu.","msgCompanySaved":"Đã lưu thông tin công ty.","msgProjectSaved":"Đã lưu dự án.","msgProjectDeleted":"Đã xóa dự án.","msgInstructionTranslated":"Đã dịch hướng dẫn công việc.","msgNewReport":"Đã bắt đầu báo cáo mới.","msgNoEmployee":"Vui lòng nhập nhân viên.","msgEmailRequired":"Vui lòng nhập e-mail người nhận.","msgEmailSending":"Đang gửi PDF qua e-mail...","msgEmailSent":"Đã gửi PDF qua e-mail.","tabReport":"Báo cáo công việc","photos":"Ảnh","deletePhoto2":"Xóa ảnh","tabDay":"Xem theo ngày","tabWeek":"Xem theo tuần","weekView":"Xem theo tuần","noInstructionsDay":"Không có hướng dẫn công việc cho ngày này.","noInstructionsWeek":"Không có hướng dẫn công việc cho tuần này.","noInstructionsMonth":"Không có hướng dẫn công việc cho tháng này.","tabMonth":"Xem theo tháng","dayView":"Xem theo ngày","monthView":"Xem theo tháng","selectDate":"Chọn ngày","noEntries":"Không tìm thấy mục nào.","totalHoursMonth":"Tổng giờ công trong tháng","hoursPerProject":"Giờ công theo dự án","dailyEntry":"Mục nhập theo ngày","saveDayEntry":"Lưu mục nhập ngày","week":"Tuần","statusOpen":"⬜ Chưa xử lý","statusInProgress":"🟡 Đang làm","statusStopped":"⛔ Đã dừng","statusCompleted":"✅ Hoàn thành","problemsHints":"Vấn đề / Lưu ý","roleEmployee":"Nhân viên","roleProjectManager":"Trưởng dự án","roleAdmin":"Quản trị viên","commentLabel":"Bình luận","commentPlaceholder":"Nhập bình luận...","commentSaveBtn":"Lưu","commentSaving":"Đang lưu…","commentSaved":"Đã lưu","commentErrorLabel":"Lỗi","charsLabel":"Ký tự","copyInstruction":"Sao chép các bước","copyTitle":"Lấy các bước từ hướng dẫn","copySource":"Chọn hướng dẫn","copyWhichSteps":"Lấy những bước công việc nào?","copyAllNone":"Tất cả / Không","copyNoSteps":"Không có bước công việc nào.","copyCancel":"Hủy","copyConfirm":"Lấy vào","copySelectSource":"Vui lòng chọn hướng dẫn.","copyDone":"Đã lấy các bước công việc."},
  Indisch: {"navigate":"नेविगेशन","absenceReported":"सूचित किया गया","absenceTab":"छुट्टी और अनुपस्थिति","absenceVacation":"छुट्टी","absenceSick":"बीमारी","absenceFrom":"से","absenceTo":"तक","absenceRequest":"आवेदन करें","absencePending":"लंबित","absenceApproved":"स्वीकृत","absenceRejected":"अस्वीकृत","absenceApprove":"स्वीकृत करें","absenceReject":"अस्वीकार करें","absenceEmpty":"कोई सूचना नहीं।","filterAll":"सभी","equipmentTab":"वाहन और औज़ार","equipmentVehicle":"वाहन","equipmentTool":"औज़ार","equipmentIdentifier":"नंबर प्लेट / नंबर","equipmentAssign":"सौंपें","equipmentReturn":"वापस करें","equipmentFree":"उपलब्ध","equipmentHistory":"इतिहास","equipmentEmpty":"अभी तक कोई उपकरण दर्ज नहीं।","equipmentType":"प्रकार","exportTab":"घंटे निर्यात","exportMonth":"महीना","exportDownload":"CSV डाउनलोड करें","exportEmpty":"चुने हुए महीने में कोई घंटे नहीं।","exportDays":"कार्य दिवस","materialOrder":"सामग्री ऑर्डर करें","materialOrders":"ऑर्डर","orderOpen":"खुला","orderOrdered":"ऑर्डर किया गया","orderDelivered":"पहुँचा दिया गया","ordersEmpty":"कोई ऑर्डर नहीं।","orderNote":"नोट","materialCatalog":"सामग्री सूची","materialCatalogEmpty":"अभी तक कोई सामग्री सहेजी नहीं गई।","materialUsed":"उपयोग की गई सामग्री","materialAdd":"जोड़ें","materialQty":"मात्रा","materialUnit":"इकाई","materialName":"नाम","materialNone":"अभी तक कोई सामग्री दर्ज नहीं।","editBtn":"संपादित करें","cancelBtn":"रद्द करें","saveBtn":"सहेजें","overviewBtn":"अवलोकन","languageLabel":"भाषा","nationalityLabel":"राष्ट्रीयता","phoneLabel":"टेलीफ़ोन","nameLabel":"नाम","readOnlyLabel":"केवल पढ़ें (कार्य निर्देश संपादन योग्य नहीं)","readOnlyHint":"केवल पढ़ें – इस खाते के लिए लिखना अवरुद्ध है।","commentEdited":"संपादित","commentDeleteAsk":"इस प्रविष्टि को हटाएँ?","feedbackTab":"फ़ीडबैक","feedbackTitle":"परीक्षक फ़ीडबैक","feedbackIntro":"कृपया हर बिंदु पर संक्षेप में अपना फ़ीडबैक दर्ज करें।","feedbackSend":"फ़ीडबैक भेजें","feedbackThanks":"आपके फ़ीडबैक के लिए धन्यवाद!","feedbackReview":"दिया गया फ़ीडबैक","feedbackNone":"अभी तक कोई फ़ीडबैक नहीं।","feedbackPoints":["लॉगिन और पासवर्ड","कार्य निर्देश और टिप्पणी","मौसम सुविधा","अनुवाद","रेजी रिपोर्ट बनाना","PDF निर्यात","कैलेंडर दृश्य","लाइव अनुवादक","मोबाइल पर संचालन","समग्र प्रभाव और त्रुटियाँ"],"translatorHint":"सूचना: AI द्वारा अनुवाद – हमेशा 100% सही नहीं।","translatorTab":"अनुवादक","translatorTitle":"लाइव अनुवादक","translatorPlaceholder":"टेक्स्ट दर्ज करें…","translatorBtn":"अनुवाद करें","translatorSwap":"भाषाएँ बदलें","weather":"मौसम","weatherError":"मौसम/स्थान उपलब्ध नहीं","instructionDoc":"कार्य निर्देश","help":"गाइड","helpEmpty":"गाइड अभी तक उपलब्ध नहीं","dashOpen":"खोलें","readLabel":"पढ़ा गया","readUnread":"अपठित","readAllDone":"सभी पढ़े गए","dashMyProjects":"मेरे प्रोजेक्ट","dashToday":"आज","dashTomorrow":"कल","dashWeek":"सप्ताह","dashNextWeek":"अगला सप्ताह","dashMyProjectsToday":"मेरे प्रोजेक्ट – आज","dashNothingToday":"आज कुछ भी योजनाबद्ध नहीं","dashNoProjects":"अभी तक कोई प्रोजेक्ट नहीं सौंपा गया","dashOverdue":"समय बीत गया","dashDone":"पूर्ण","msgFillRequired":"कृपया सभी अनिवार्य फ़ील्ड भरें।","msgEmployeeDeleted":"कर्मचारी हटा दिया गया।","msgNoEmailAddr":"कोई ई-मेल पता उपलब्ध नहीं।","msgCommentSavedOk":"✅ टिप्पणी सहेजी गई।","msgNoteSaved":"नोट सहेजा गया।","msgLogoUploaded":"लोगो अपलोड हो गया। कृपया कंपनी डेटा सहेजें।","msgPleaseLogin":"कृपया पहले लॉगिन करें।","msgPmUnchanged":"प्रोजेक्ट प्रबंधक अपरिवर्तित।","msgPmChanged":"प्रोजेक्ट प्रबंधक बदल दिया गया।","msgPmNotFound":"कर्मचारी सूची में इस नाम का कोई प्रोजेक्ट प्रबंधक नहीं मिला – दृश्यता स्थानांतरित नहीं की जा सकती।","msgProjectNoInstr":"इस प्रोजेक्ट के लिए अभी तक कोई निर्देश नहीं।","msgTranslatingGeneric":"अनुवाद हो रहा है...","msgReportPrepared":"कार्य निर्देश से रेजी रिपोर्ट तैयार की गई।","msgEmailNotEnabled":"🔒 आपके पैकेज में ई-मेल भेजना सक्रिय नहीं है।","assignVisibility":"दृश्यता सौंपें","assignEmployees":"कर्मचारी सौंपें","assignProjectManager":"प्रोजेक्ट प्रबंधक सौंपें","instructionsLocked":"कार्य निर्देश बनाना केवल प्रोजेक्ट प्रबंधक और एडमिन के लिए संभव है।","title":"रेजी इंटरनेशनल","subtitle":"कार्य निर्देश और रेजी रिपोर्ट दर्ज करें, अनुवाद करें, सहेजें और भेजें।","loginTitle":"रेजी रिपोर्ट लॉगिन","email":"ई-मेल","password":"पासवर्ड","login":"लॉगिन करें","register":"पंजीकरण करें","logout":"लॉगआउट","loggedInAs":"इस रूप में लॉगिन","saveLoad":"रिपोर्ट सहेजें / लोड करें","reportName":"रिपोर्ट नाम, जैसे KW 22 - सुबह","saveReport":"रिपोर्ट सहेजें","updateReport":"रिपोर्ट अपडेट करें","newReport":"नई रिपोर्ट","savedReports":"मेरी सहेजी गई रिपोर्ट","loadEdit":"लोड करें / संपादित करें","delete":"हटाएँ","general":"सामान्य जानकारी","appLanguage":"ऐप भाषा","pdfLanguage":"PDF भाषा","employee":"कर्मचारी","calendarWeek":"कैलेंडर सप्ताह","recipientEmail":"PDF भेजने के लिए प्राप्तकर्ता ई-मेल","customer":"ग्राहक","projectNumber":"प्रोजेक्ट नंबर","site":"निर्माण स्थल","hours":"घंटे","startTime":"शुरुआत","endTime":"समाप्ति","breakLabel":"ब्रेक (मिनट)","description":"कार्य विवरण","translation":"अनुवाद","deletePhoto":"फ़ोटो हटाएँ","hoursOverview":"घंटे का अवलोकन","total":"कुल","translateWeek":"सप्ताह का अनुवाद करें","translating":"अनुवाद हो रहा है...","save":"सहेजें","update":"अपडेट करें","saveAsNew":"नई रिपोर्ट के रूप में सहेजें","downloadPdf":"PDF डाउनलोड करें","sendPdf":"PDF ई-मेल से भेजें","dashboard":"डैशबोर्ड","projects":"प्रोजेक्ट","workInstructions":"कार्य निर्देश","dueToday":"आज देय","totalProgress":"कुल प्रगति","stoppedSteps":"रुके हुए कार्य चरण","stepsInProgress":"प्रगति में कार्य चरण","noProject":"कोई प्रोजेक्ट नहीं","projectsTab":"प्रोजेक्ट","projectName":"प्रोजेक्ट नाम","projectCustomer":"ग्राहक","projectSite":"निर्माण स्थल","projectManager":"प्रोजेक्ट प्रबंधक","saveProject":"प्रोजेक्ट सहेजें","deleteProject":"प्रोजेक्ट हटाएँ","openProject":"प्रोजेक्ट खोलें","closeProject":"बंद करें","progress":"प्रगति","noInstructions":"इस प्रोजेक्ट के लिए अभी तक कोई कार्य निर्देश नहीं।","noReports":"इस प्रोजेक्ट के लिए अभी तक कोई रेजी रिपोर्ट नहीं।","reportsTab":"रेजी रिपोर्ट","newInstruction":"नया कार्य निर्देश","instructionTitle":"शीर्षक","selectProject":"प्रोजेक्ट चुनें","problems":"समस्याएँ / सूचनाएँ","material":"सामग्री","werkzeug":"औज़ार","workSteps":"कार्य चरण","addStep":"+ कार्य चरण","saveInstruction":"कार्य निर्देश सहेजें","savedInstructions":"सहेजे गए कार्य निर्देश","noInstructionsSaved":"अभी तक कोई कार्य निर्देश नहीं।","date":"तारीख","project":"प्रोजेक्ट","translateTo":"अनुवाद करें","translating2":"अनुवाद हो रहा है...","translated":"अनुवादित","feedback":"प्रतिक्रिया","saveFeedback":"प्रतिक्रिया सहेजें","toReport":"रेजी रिपोर्ट में लें","transferTitle":"कहाँ स्थानांतरित करें?","transferInsert":"यहाँ डालें","transferNoReports":"कोई सहेजी गई रिपोर्ट नहीं","travelTime":"यात्रा समय","teamReports":"कर्मचारी रिपोर्ट","teamNoReports":"कोई रिपोर्ट उपलब्ध नहीं","travelOut":"जाने की यात्रा","travelReturn":"वापसी की यात्रा","km":"km","deleteInstruction":"कार्य निर्देश हटाएँ","autoReportLocked":"आपके पैकेज में स्वचालित रेजी रिपोर्ट सक्रिय नहीं हैं।","employeeManagement":"कर्मचारी प्रबंधन","name":"नाम","role":"भूमिका","addEmployee":"कर्मचारी जोड़ें","currentEmployees":"वर्तमान कर्मचारी","resetPassword":"पासवर्ड रीसेट करें","companyData":"कंपनी डेटा","uploadLogo":"कंपनी लोगो अपलोड करें","companyName":"कंपनी का नाम","street":"सड़क","zip":"पिन कोड","city":"शहर","phone":"टेलीफ़ोन","website":"वेबसाइट","taxNumber":"UID / कर संख्या","saveCompany":"कंपनी डेटा सहेजें","reportNameLabel":"रिपोर्ट नाम","firma":"कंपनी","feedbackLabel":"प्रतिक्रिया","noProjectsYet":"अभी तक कोई प्रोजेक्ट नहीं।","weekdays":["सोमवार","मंगलवार","बुधवार","गुरुवार","शुक्रवार","शनिवार","रविवार"],"noInstructionsYet":"अभी तक कोई कार्य निर्देश नहीं।","msgLoginOk":"लॉगिन सफल।","msgLogout":"आप लॉगआउट हो गए।","msgRegisterOk":"पंजीकरण सफल।","msgRegisterFail":"पंजीकरण विफल: ","msgLoginFail":"लॉगिन विफल: ","msgSaved":"नई रिपोर्ट सहेजी गई।","msgUpdated":"रिपोर्ट अपडेट की गई।","msgLoaded":"रिपोर्ट लोड की गई।","msgDeleted":"रिपोर्ट हटा दी गई।","msgTranslated":"सप्ताह का अनुवाद किया गया।","msgTranslateErr":"अनुवाद में त्रुटि: ","msgPhotoUploading":"फ़ोटो अपलोड हो रहे हैं...","msgPhotoOk":"फ़ोटो अपलोड हो गए।","msgPhotoErr":"फ़ोटो अपलोड में त्रुटि: ","msgPhotoLimit":"अधिकतम {n} फ़ोटो की अनुमति है।","msgSaving":"कार्य निर्देश सहेजा जा रहा है...","msgNoFirm":"कोई कंपनी लोड नहीं हुई।","msgNoTitle":"कृपया कार्य निर्देश का शीर्षक दर्ज करें।","msgNoDate":"कृपया कार्य निर्देश की तारीख दर्ज करें।","msgInstructionSaved":"कार्य निर्देश सहेजा गया।","msgInstructionDeleted":"कार्य निर्देश हटा दिया गया।","msgFeedbackSaved":"प्रतिक्रिया सहेजी गई।","msgEmployeeAdded":"कर्मचारी बनाया गया।","msgPasswordReset":"पासवर्ड रीसेट ई-मेल भेज दी गई।","msgCompanySaved":"कंपनी डेटा सहेजा गया।","msgProjectSaved":"प्रोजेक्ट सहेजा गया।","msgProjectDeleted":"प्रोजेक्ट हटा दिया गया।","msgInstructionTranslated":"कार्य निर्देश का अनुवाद किया गया।","msgNewReport":"नई रिपोर्ट शुरू की गई।","msgNoEmployee":"कृपया कर्मचारी दर्ज करें।","msgEmailRequired":"कृपया प्राप्तकर्ता ई-मेल दर्ज करें।","msgEmailSending":"PDF ई-मेल से भेजा जा रहा है...","msgEmailSent":"PDF ई-मेल से भेज दिया गया।","tabReport":"रेजी रिपोर्ट","photos":"फ़ोटो","deletePhoto2":"फ़ोटो हटाएँ","tabDay":"दिन दृश्य","tabWeek":"सप्ताह दृश्य","weekView":"सप्ताह दृश्य","noInstructionsDay":"इस दिन के लिए कोई कार्य निर्देश नहीं।","noInstructionsWeek":"इस सप्ताह के लिए कोई कार्य निर्देश नहीं।","noInstructionsMonth":"इस महीने के लिए कोई कार्य निर्देश नहीं।","tabMonth":"महीना दृश्य","dayView":"दिन दृश्य","monthView":"महीना दृश्य","selectDate":"तारीख चुनें","noEntries":"कोई प्रविष्टि नहीं मिली।","totalHoursMonth":"महीने में कुल घंटे","hoursPerProject":"प्रति प्रोजेक्ट घंटे","dailyEntry":"दैनिक प्रविष्टि","saveDayEntry":"दैनिक प्रविष्टि सहेजें","week":"सप्ताह","statusOpen":"⬜ खुला","statusInProgress":"🟡 प्रगति में","statusStopped":"⛔ रुका हुआ","statusCompleted":"✅ पूर्ण","problemsHints":"समस्याएँ / सूचनाएँ","roleEmployee":"कर्मचारी","roleProjectManager":"प्रोजेक्ट प्रबंधक","roleAdmin":"एडमिन","commentLabel":"टिप्पणी","commentPlaceholder":"टिप्पणी दर्ज करें...","commentSaveBtn":"सहेजें","commentSaving":"सहेजा जा रहा है…","commentSaved":"सहेजा गया","commentErrorLabel":"त्रुटि","charsLabel":"अक्षर","copyInstruction":"चरण कॉपी करें","copyTitle":"निर्देश से चरण लें","copySource":"निर्देश चुनें","copyWhichSteps":"कौन से कार्य चरण लें?","copyAllNone":"सभी / कोई नहीं","copyNoSteps":"कोई कार्य चरण उपलब्ध नहीं।","copyCancel":"रद्द करें","copyConfirm":"लें","copySelectSource":"कृपया निर्देश चुनें।","copyDone":"कार्य चरण ले लिए गए।"},
};

const pdfTexts = {
  Deutsch: { title: "Regie International", company: "Regie International", report: "Bericht", calendarWeek: "Kalenderwoche", employee: "Mitarbeiter", dailyReports: "Tagesberichte", customer: "Kunde", project: "Projekt", site: "Baustelle", hours: "Stunden", startLabel: "Anfang", endLabel: "Ende", pauseLabel: "Pause", description: "Arbeitsbeschreibung", photos: "Fotos", photo: "Foto", summary: "Zusammenfassung", totalHours: "Gesamtstunden", signatureEmployee: "Unterschrift Mitarbeiter", signatureCustomer: "Unterschrift Kunde / Bauleitung", createdAt: "Erstellt am" },
  Spanisch: { title: "Regie International", company: "Regie International", report: "Informe", calendarWeek: "Semana natural", employee: "Empleado", dailyReports: "Informes diarios", customer: "Cliente", project: "Proyecto", site: "Obra", hours: "Horas", startLabel: "Inicio", endLabel: "Fin", pauseLabel: "Pausa", description: "Descripción del trabajo", photos: "Fotos", photo: "Foto", summary: "Resumen", totalHours: "Horas totales", signatureEmployee: "Firma del empleado", signatureCustomer: "Firma del cliente / jefe de obra", createdAt: "Creado el" },
  Kroatisch: { title: "Regie International", company: "Regie International", report: "Izvještaj", calendarWeek: "Kalendarski tjedan", employee: "Radnik", dailyReports: "Dnevni izvještaji", customer: "Kupac", project: "Projekt", site: "Gradilište", hours: "Sati", startLabel: "Početak", endLabel: "Kraj", pauseLabel: "Pauza", description: "Opis rada", photos: "Fotografije", photo: "Fotografija", summary: "Sažetak", totalHours: "Ukupno sati", signatureEmployee: "Potpis radnika", signatureCustomer: "Potpis kupca / voditelja gradilišta", createdAt: "Izrađeno dana" },
  Slowenisch: { title: "Regie International", company: "Regie International", report: "Poročilo", calendarWeek: "Koledarski teden", employee: "Zaposleni", dailyReports: "Dnevna poročila", customer: "Stranka", project: "Projekt", site: "Gradbišče", hours: "Ure", startLabel: "Začetek", endLabel: "Konec", pauseLabel: "Odmor", description: "Opis dela", photos: "Fotografije", photo: "Fotografija", summary: "Povzetek", totalHours: "Skupno število ur", signatureEmployee: "Podpis zaposlenega", signatureCustomer: "Podpis stranke / vodje gradbišča", createdAt: "Ustvarjeno dne" },
  Polnisch: { title: "Regie International", company: "Regie International", report: "Raport", calendarWeek: "Tydzień kalendarzowy", employee: "Pracownik", dailyReports: "Raporty dzienne", customer: "Klient", project: "Projekt", site: "Budowa", hours: "Godziny", startLabel: "Początek", endLabel: "Koniec", pauseLabel: "Przerwa", description: "Opis pracy", photos: "Zdjęcia", photo: "Zdjęcie", summary: "Podsumowanie", totalHours: "Łączna liczba godzin", signatureEmployee: "Podpis pracownika", signatureCustomer: "Podpis klienta / kierownika budowy", createdAt: "Utworzono dnia" },
  Englisch: { title: "Regie International", company: "Regie International", report: "Report", calendarWeek: "Calendar week", employee: "Employee", dailyReports: "Daily reports", customer: "Customer", project: "Project", site: "Site", hours: "Hours", startLabel: "Start", endLabel: "End", pauseLabel: "Break", description: "Work description", photos: "Photos", photo: "Photo", summary: "Summary", totalHours: "Total hours", signatureEmployee: "Employee signature", signatureCustomer: "Customer / Site manager signature", createdAt: "Created on" },
  Rumänisch: { title: "Regie International", company: "Regie International", report: "Raport", calendarWeek: "Săptămâna calendaristică", employee: "Angajat", dailyReports: "Rapoarte zilnice", customer: "Client", project: "Proiect", site: "Șantier", hours: "Ore", startLabel: "Început", endLabel: "Sfârșit", pauseLabel: "Pauză", description: "Descrierea lucrării", photos: "Fotografii", photo: "Fotografie", summary: "Rezumat", totalHours: "Total ore", signatureEmployee: "Semnătura angajatului", signatureCustomer: "Semnătura clientului / șefului de șantier", createdAt: "Creat la" },
  Italienisch: { title: "Regie International", company: "Regie International", report: "Rapporto", calendarWeek: "Settimana", employee: "Dipendente", dailyReports: "Rapporti giornalieri", customer: "Cliente", project: "Progetto", site: "Cantiere", hours: "Ore", startLabel: "Inizio", endLabel: "Fine", pauseLabel: "Pausa", description: "Descrizione del lavoro", photos: "Foto", photo: "Foto", summary: "Riepilogo", totalHours: "Ore totali", signatureEmployee: "Firma del dipendente", signatureCustomer: "Firma del cliente / capocantiere", createdAt: "Creato il" },
  Türkisch: { title: "Regie International", company: "Regie International", report: "Rapor", calendarWeek: "Takvim haftası", employee: "Çalışan", dailyReports: "Günlük raporlar", customer: "Müşteri", project: "Proje", site: "Şantiye", hours: "Saat", startLabel: "Başlangıç", endLabel: "Bitiş", pauseLabel: "Mola", description: "İş açıklaması", photos: "Fotoğraflar", photo: "Fotoğraf", summary: "Özet", totalHours: "Toplam saat", signatureEmployee: "Çalışan imzası", signatureCustomer: "Müşteri / şantiye şefi imzası", createdAt: "Oluşturulma tarihi" },
  Ungarisch: { title: "Regie International", company: "Regie International", report: "Jelentés", calendarWeek: "Naptári hét", employee: "Munkatárs", dailyReports: "Napi jelentések", customer: "Ügyfél", project: "Projekt", site: "Munkaterület", hours: "Óra", startLabel: "Kezdés", endLabel: "Befejezés", pauseLabel: "Szünet", description: "Munkaleírás", photos: "Fényképek", photo: "Fénykép", summary: "Összegzés", totalHours: "Össóra", signatureEmployee: "Munkatárs aláírása", signatureCustomer: "Ügyfél / építésvezető aláírása", createdAt: "Létrehozva" },
  Tschechisch: { title: "Regie International", company: "Regie International", report: "Výkaz", calendarWeek: "Kalendářní týden", employee: "Zaměstnanec", dailyReports: "Denní výkazy", customer: "Zákazník", project: "Projekt", site: "Staveniště", hours: "Hodiny", startLabel: "Začátek", endLabel: "Konec", pauseLabel: "Přestávka", description: "Popis práce", photos: "Fotografie", photo: "Fotografie", summary: "Souhrn", totalHours: "Celkem hodin", signatureEmployee: "Podpis zaměstnance", signatureCustomer: "Podpis zákazníka / stavbyvedoucího", createdAt: "Vytvořeno dne" },
  Ukrainisch: { title: "Regie International", company: "Regie International", report: "Звіт", calendarWeek: "Календарний тиждень", employee: "Працівник", dailyReports: "Щоденні звіти", customer: "Замовник", project: "Проєкт", site: "Об'єкт", hours: "Години", startLabel: "Початок", endLabel: "Кінець", pauseLabel: "Перерва", description: "Опис роботи", photos: "Фото", photo: "Фото", summary: "Підсумок", totalHours: "Всього годин", signatureEmployee: "Підпис працівника", signatureCustomer: "Підпис замовника / керівника об'єкта", createdAt: "Створено" },
  Bulgarisch: { title: "Regie International", company: "Regie International", report: "Отчет", calendarWeek: "Календарна седмица", employee: "Служител", dailyReports: "Дневни отчети", customer: "Клиент", project: "Проект", site: "Строителен обект", hours: "Часове", startLabel: "Начало", endLabel: "Край", pauseLabel: "Почивка", description: "Описание на работата", photos: "Снимки", photo: "Снимка", summary: "Обобщение", totalHours: "Общо часове", signatureEmployee: "Подпис на служителя", signatureCustomer: "Подпис на клиента / ръководителя", createdAt: "Създадено на" },
  Serbisch: { title: "Regie International", company: "Regie International", report: "Izveštaj", calendarWeek: "Kalendarska nedelja", employee: "Radnik", dailyReports: "Dnevni izveštaji", customer: "Klijent", project: "Projekat", site: "Gradilište", hours: "Sati", startLabel: "Početak", endLabel: "Kraj", pauseLabel: "Pauza", description: "Opis posla", photos: "Fotografije", photo: "Fotografija", summary: "Rezime", totalHours: "Ukupno sati", signatureEmployee: "Potpis radnika", signatureCustomer: "Potpis klijenta / rukovodioca gradilišta", createdAt: "Kreirano" },
};

// ── Wetter: zentrale Wortlisten + deterministische Umsetzung in jede Anzeige-Sprache ──
const WEATHER_COND: Record<string, Record<string, string>> = {
  clear:   { Deutsch:"klar", Rumänisch:"senin", Englisch:"clear", Italienisch:"sereno", Türkisch:"açık", Ungarisch:"derült", Tschechisch:"jasno", Ukrainisch:"ясно", Bulgarisch:"ясно", Serbisch:"vedro", Kroatisch:"vedro", Slowenisch:"jasno", Polnisch:"bezchmurnie", Spanisch:"despejado" },
  partly:  { Deutsch:"teils bewölkt", Rumänisch:"parțial înnorat", Englisch:"partly cloudy", Italienisch:"parzialmente nuvoloso", Türkisch:"parçalı bulutlu", Ungarisch:"részben felhős", Tschechisch:"polojasno", Ukrainisch:"мінлива хмарність", Bulgarisch:"частична облачност", Serbisch:"delimično oblačno", Kroatisch:"djelomično oblačno", Slowenisch:"delno oblačno", Polnisch:"częściowe zachmurzenie", Spanisch:"parcialmente nublado" },
  cloudy:  { Deutsch:"bewölkt", Rumänisch:"înnorat", Englisch:"cloudy", Italienisch:"nuvoloso", Türkisch:"bulutlu", Ungarisch:"felhős", Tschechisch:"zataženo", Ukrainisch:"хмарно", Bulgarisch:"облачно", Serbisch:"oblačno", Kroatisch:"oblačno", Slowenisch:"oblačno", Polnisch:"pochmurno", Spanisch:"nublado" },
  fog:     { Deutsch:"Nebel", Rumänisch:"ceață", Englisch:"fog", Italienisch:"nebbia", Türkisch:"sis", Ungarisch:"köd", Tschechisch:"mlha", Ukrainisch:"туман", Bulgarisch:"мъгла", Serbisch:"magla", Kroatisch:"magla", Slowenisch:"megla", Polnisch:"mgła", Spanisch:"niebla" },
  drizzle: { Deutsch:"Nieselregen", Rumänisch:"burniță", Englisch:"drizzle", Italienisch:"pioviggine", Türkisch:"çisenti", Ungarisch:"szitálás", Tschechisch:"mrholení", Ukrainisch:"мряка", Bulgarisch:"ръмеж", Serbisch:"rosulja", Kroatisch:"rosulja", Slowenisch:"rosenje", Polnisch:"mżawka", Spanisch:"llovizna" },
  rain:    { Deutsch:"Regen", Rumänisch:"ploaie", Englisch:"rain", Italienisch:"pioggia", Türkisch:"yağmur", Ungarisch:"eső", Tschechisch:"déšť", Ukrainisch:"дощ", Bulgarisch:"дъжд", Serbisch:"kiša", Kroatisch:"kiša", Slowenisch:"dež", Polnisch:"deszcz", Spanisch:"lluvia" },
  snow:    { Deutsch:"Schnee", Rumänisch:"ninsoare", Englisch:"snow", Italienisch:"neve", Türkisch:"kar", Ungarisch:"hó", Tschechisch:"sníh", Ukrainisch:"сніг", Bulgarisch:"сняг", Serbisch:"sneg", Kroatisch:"snijeg", Slowenisch:"sneg", Polnisch:"śnieg", Spanisch:"nieve" },
  showers: { Deutsch:"Regenschauer", Rumänisch:"averse de ploaie", Englisch:"rain showers", Italienisch:"rovesci di pioggia", Türkisch:"sağanak yağış", Ungarisch:"záporeső", Tschechisch:"přeháňky", Ukrainisch:"зливи", Bulgarisch:"превалявания", Serbisch:"pljuskovi", Kroatisch:"pljuskovi", Slowenisch:"plohe", Polnisch:"przelotne opady", Spanisch:"chubascos" },
  thunder: { Deutsch:"Gewitter", Rumänisch:"furtună", Englisch:"thunderstorm", Italienisch:"temporale", Türkisch:"gök gürültülü fırtına", Ungarisch:"zivatar", Tschechisch:"bouřka", Ukrainisch:"гроза", Bulgarisch:"гръмотевична буря", Serbisch:"grmljavina", Kroatisch:"grmljavina", Slowenisch:"nevihta", Polnisch:"burza", Spanisch:"tormenta" },
  unknown: { Deutsch:"wechselhaft", Rumänisch:"variabil", Englisch:"variable", Italienisch:"variabile", Türkisch:"değişken", Ungarisch:"változékony", Tschechisch:"proměnlivo", Ukrainisch:"мінливо", Bulgarisch:"променливо", Serbisch:"promenljivo", Kroatisch:"promjenjivo", Slowenisch:"spremenljivo", Polnisch:"zmiennie", Spanisch:"variable" },
};
const WEATHER_WORD_TO_CAT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const cat in WEATHER_COND) { for (const lang in WEATHER_COND[cat]) { map[WEATHER_COND[cat][lang].toLowerCase()] = cat; } }
  return map;
})();
function wmoCat(code: number): string {
  return code === 0 ? "clear"
    : (code === 1 || code === 2) ? "partly"
    : code === 3 ? "cloudy"
    : (code === 45 || code === 48) ? "fog"
    : (code >= 51 && code <= 57) ? "drizzle"
    : (code >= 61 && code <= 67) ? "rain"
    : (code >= 71 && code <= 77) ? "snow"
    : (code >= 80 && code <= 82) ? "showers"
    : (code >= 85 && code <= 86) ? "snow"
    : (code >= 95) ? "thunder"
    : "unknown";
}
function wmoLocalizedText(code: number, lang: string): string {
  const cat = wmoCat(code);
  return (WEATHER_COND as any)[cat]?.[lang] || (WEATHER_COND as any)[cat]?.Deutsch || "";
}
// Trennt Wetterzeilen (erkennbar am Wind-Symbol) vom restlichen Kommentartext.
function splitWeather(text: string): { body: string; weather: string[] } {
  const body: string[] = [];
  const weather: string[] = [];
  for (const ln of (text || "").split("\n")) {
    if (ln.indexOf("💨") !== -1) weather.push(ln.trim());
    else body.push(ln);
  }
  return { body: body.join("\n"), weather };
}
// Setzt eine Wetterzeile deterministisch in die Ziel-Sprache um (egal, in welcher sie erstellt wurde).
function localizeWeather(line: string, lang: string): string {
  if (!line || line.indexOf("💨") === -1) return line;
  const targetPrefix = ((texts as any)[lang] && (texts as any)[lang].weather) || "Wetter";
  const m = line.match(/^(🌦️\s*)?(\S+)( .+?)? \(([\d.,: ]+)\): ([\d.,\-]+) °C, (.+?), 💨 ([\d.,\-]+) km\/h, 🌧️ ([\d.,\-]+) mm(.*)$/);
  if (!m) return line;
  const marker = m[1] || "";
  const place = m[3] || "";
  const cat = WEATHER_WORD_TO_CAT[(m[6] || "").trim().toLowerCase()] || "unknown";
  const targetCond = (WEATHER_COND as any)[cat]?.[lang] || m[6];
  return `${marker}${targetPrefix}${place} (${m[4]}): ${m[5]} °C, ${targetCond}, 💨 ${m[7]} km/h, 🌧️ ${m[8]} mm${m[9] || ""}`;
}

function createEmptyDays(): DayEntry[] {
  return weekdays.map((day) => ({ weekday: day, date: "", customer: "", projectNumber: "", site: "", startTime: "", endTime: "", breakMinutes: "", travelOutStart: "", travelOutEnd: "", travelOutKm: "", travelReturnStart: "", travelReturnEnd: "", travelReturnKm: "", hours: "", description: "", translation: "", photos: [] }));
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
// Wird in createPDF gesetzt: true, wenn die Unicode-Schrift (NotoSans) geladen wurde.
let pdfUnicodeSymbols = false;
function sanitizePdfText(s: string): string {
  if (!s) return s;
  let r = s
    .replace(/📋/g, "")
    .replace(/📝/g, "")
    .replace(/💬/g, "")
    .replace(/📦/g, "")
    .replace(/🔧/g, "")
    .replace(/─/g, "-");
  if (pdfUnicodeSymbols) {
    // echte Symbole (DejaVu Sans deckt diese ab)
    r = r
      .replace(/⬜/g, "□")
      .replace(/🟡/g, "◐")
      .replace(/⛔/g, "✗")
      .replace(/✅/g, "✓")
      .replace(/⚠️/g, "⚠")
      .replace(/⚠/g, "⚠");
  } else {
    // sichere ASCII-Platzhalter (Helvetica-Fallback)
    r = r
      .replace(/⬜/g, "[ ]")
      .replace(/🟡/g, "[~]")
      .replace(/⛔/g, "[X]")
      .replace(/✅/g, "[v]")
      .replace(/⚠️/g, "(!)")
      .replace(/⚠/g, "(!)");
  }
  r = r.replace(/️/g, "");
  return r;
}

// Laedt eine Unicode-Schrift (Noto Sans) fuer das PDF und gibt den Font-Namen zurueck.
// Bei JEDEM Problem -> Fallback "helvetica", damit das PDF niemals bricht.
async function loadPdfFont(doc: any): Promise<string> {
  try {
    const toBase64 = (buf: ArrayBuffer): string => {
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000; // chunk-weise -> verhindert "Maximum call stack size exceeded"
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
      }
      return btoa(binary);
    };
    const tryFetchFont = async (urls: string[]): Promise<ArrayBuffer | null> => {
      for (const u of urls) {
        try {
          const r = await fetch(u);
          if (r.ok) {
            const b = await r.arrayBuffer();
            if (b && b.byteLength > 2000) return b; // kleine Dateien = LFS-Pointer/Fehlerseite -> ignorieren
          }
        } catch { /* naechster Kandidat */ }
      }
      return null;
    };
    const regBuf = await tryFetchFont([
      "/fonts/NotoSans-Regular.ttf", "/fonts/NotoSans.ttf",
      "/fonts/notosans-regular.ttf", "/fonts/NotoSans-regular.ttf",
    ]);
    if (!regBuf) return "helvetica";
    const regB64 = toBase64(regBuf);
    doc.addFileToVFS("NotoSans-Regular.ttf", regB64);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    const boldBuf = await tryFetchFont([
      "/fonts/NotoSans-Bold.ttf", "/fonts/NotoSans-bold.ttf", "/fonts/notosans-bold.ttf",
    ]);
    const boldB64 = boldBuf ? toBase64(boldBuf) : regB64; // kein Bold-File -> Regular auch fuer fett
    doc.addFileToVFS("NotoSans-Bold.ttf", boldB64);
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
    return "NotoSans";
  } catch {
    return "helvetica";
  }
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

// ISO-Kalenderwoche <-> Datum (Montag). Fuer das <input type="week"> in der Anweisung.
function isoWeekToMonday(weekStr: string): string {
  const m = (weekStr || "").match(/^(\d{4})-W(\d{2})$/);
  if (!m) return "";
  const year = Number(m[1]); const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4); week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(week1Monday); monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday.toISOString().split("T")[0];
}
function dateToIsoWeek(dateString: string): string {
  if (!dateString) return "";
  const [y, mo, d] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}
// Dropdown-Optionen fuer die Kalenderwoche: einige Wochen zurueck bis ~1 Jahr voraus.
// value = Montag (YYYY-MM-DD), label = "KW 31 · 27.07.–02.08.2026".
function buildWeekOptions(): { value: string; label: string }[] {
  const todayStr = new Date().toISOString().split("T")[0];
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const base = new Date(Date.UTC(ty, tm - 1, td));
  const dow = base.getUTCDay() || 7;
  const curMonday = new Date(base); curMonday.setUTCDate(base.getUTCDate() - dow + 1);
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`;
  const opts: { value: string; label: string }[] = [];
  for (let i = -8; i <= 56; i++) {
    const mon = new Date(curMonday); mon.setUTCDate(curMonday.getUTCDate() + i * 7);
    const monStr = mon.toISOString().split("T")[0];
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
    opts.push({ value: monStr, label: `${getCalendarWeek(monStr)} · ${fmt(mon)}–${fmt(sun)}${sun.getUTCFullYear()}` });
  }
  return opts;
}

function TabButton({ label, tabName, activeTab, onClick }: { label: string; tabName: string; activeTab: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`px-5 py-3 rounded-full text-sm font-medium transition-colors ${activeTab === tabName ? "bg-cyan-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"}`}>
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

// Textfeld, das immer so hoch ist, dass der ganze Inhalt sichtbar ist
// (misst die tatsaechliche Hoehe, damit auch umgebrochene Zeilen mitzaehlen).
function AutoTextarea({ value, onChange, className, placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  function fit() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }
  useEffect(() => { fit(); }, [value]);
  useEffect(() => {
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return (
    <textarea
      ref={ref}
      rows={4}
      className={className}
      placeholder={placeholder}
      value={value}
      onInput={fit}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SignaturePad({ label, value, onChange }: { label: string; value: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const lastEmitted = useRef("");
  // Zeigt eine gespeicherte Unterschrift auf der Zeichenflaeche an bzw. leert sie.
  useEffect(() => {
    const c = canvasRef.current; const ctx = c ? c.getContext("2d") : null;
    if (!c || !ctx) return;
    if (!value) {
      ctx.clearRect(0, 0, c.width, c.height);
      hasDrawn.current = false;
      return;
    }
    // Eigenes Zeichnen nicht ueberschreiben (sonst flackert es beim Malen).
    if (value === lastEmitted.current) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      hasDrawn.current = true;
    };
    img.src = value;
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
    if (hasDrawn.current && canvasRef.current) { const url = canvasRef.current.toDataURL("image/png"); lastEmitted.current = url; onChange(url); }
  }
  function clear() {
    const c = canvasRef.current; const ctx = getCtx();
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    hasDrawn.current = false; lastEmitted.current = ""; onChange("");
  }
  return (
    <div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}{value ? <span className="text-xs text-green-600 ml-2">✓ erfasst</span> : null}</span>
        <button type="button" onClick={clear} className="text-xs text-red-600 underline">Löschen</button>
      </div>
      <canvas ref={canvasRef} width={500} height={150} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} className="w-full border rounded-lg bg-gray-50" style={{ touchAction: "none" }} />
    </div>
  );
}

// Zusatz-Labels fuer neue Funktionen (Geraete-Planung). Fallback auf Deutsch,
// falls eine Sprache hier nicht hinterlegt ist.
const EXTRA_LABELS: Record<string, Record<string, string>> = {
  Deutsch: {"planTitle":"Planung","planNew":"Neue Planung","planEquipment":"Gerät","planEmployee":"Mitarbeiter","planFrom":"Von","planTo":"Bis","planNote":"Notiz (optional)","planSave":"Planung speichern","planUpcoming":"Geplante Zuordnungen","planEmpty":"Keine Planungen.","planActive":"läuft","planPlanned":"geplant","planConflictTitle":"Achtung: Überschneidung","planConflictText":"Dieses Gerät ist im gewählten Zeitraum bereits verplant:","planSaveAnyway":"Trotzdem speichern","planCancel":"Abbrechen","planPick":"— bitte wählen —","exportProjectLabel":"Projekt","exportTranslating":"Übersetze Tätigkeiten…","exportByEmployee":"Stunden Mitarbeiter","exportByProject":"Stunden Projekt","kmStart":"Start-km","kmEnd":"End-km","kmDriven":"Gefahrene km","kmSave":"km speichern","kmWarnNegative":"End-km kleiner als Start-km – bitte prüfen","returnTitle":"Rückgabe","returnQuestion":"Beschädigung oder Besonderheit?","returnPlaceholder":"z. B. Kratzer hinten links, Werkzeug defekt … (optional)","returnConfirm":"Zurückgeben","returnNoteHistory":"Rückgabe-Notiz","returnNoDamage":"Keine Beschädigung","returnDamage":"Beschädigung","returnOther":"Sonstiges","eqReportTitle":"Monats-Export","eqReportVehicles":"Fahrzeuge CSV","eqReportTools":"Werkzeug CSV","colFrom":"Von","colTo":"Bis","colDuration":"Dauer (Tage)","colDamage":"Beschädigung / Notiz","colOngoing":"läuft noch","take":"Übernehmen","scopeLabel":"Zeitraum","scopeDay":"Ein Tag","scopeWeek":"Ganze Woche","myTimes":"Meine Zeiten","saveTimes":"Zeiten speichern","timesSaved":"Zeiten gespeichert.","exReportTitle":"Vorhandener Regiebericht","exReportAsk":"Für dieses Projekt gibt es in dieser KW schon einen Regiebericht. Tag dort eintragen oder neuen Bericht erstellen?","exReportYes":"In diesen Bericht eintragen","exReportNo":"Neuen Bericht erstellen","dayFilled":"Dieser Tag ist im Regiebericht bereits ausgefüllt.","extraEntry":"Weiterer Eintrag","addEntry":"+ Weiterer Eintrag","removeEntry":"Entfernen","moreTabs":"Mehr","navAddr2":"2. Adresse (nur Navigation)","instrDeleteAsk":"Arbeitsanweisung wirklich löschen?","archiveTab":"Archiv","toArchive":"Ins Archiv","fromArchive":"Aus Archiv","addr2Desc":"Beschreibung","absRejectReason":"Grund der Ablehnung"},
  Englisch: {"planTitle":"Planning","planNew":"New plan","planEquipment":"Equipment","planEmployee":"Employee","planFrom":"From","planTo":"To","planNote":"Note (optional)","planSave":"Save plan","planUpcoming":"Planned assignments","planEmpty":"No plans.","planActive":"active","planPlanned":"planned","planConflictTitle":"Warning: overlap","planConflictText":"This equipment is already planned for the selected period:","planSaveAnyway":"Save anyway","planCancel":"Cancel","planPick":"— please choose —","exportProjectLabel":"Project","exportTranslating":"Translating activities…","exportByEmployee":"Hours by employee","exportByProject":"Hours by project","kmStart":"Start km","kmEnd":"End km","kmDriven":"Distance (km)","kmSave":"Save km","kmWarnNegative":"End km lower than start km – please check","returnTitle":"Return","returnQuestion":"Damage or anything notable?","returnPlaceholder":"e.g. scratch rear left, tool broken … (optional)","returnConfirm":"Return","returnNoteHistory":"Return note","returnNoDamage":"No damage","returnDamage":"Damage","returnOther":"Other","eqReportTitle":"Monthly export","eqReportVehicles":"Vehicles CSV","eqReportTools":"Tools CSV","colFrom":"From","colTo":"To","colDuration":"Duration (days)","colDamage":"Damage / note","colOngoing":"ongoing","take":"Take","scopeLabel":"Period","scopeDay":"One day","scopeWeek":"Whole week","myTimes":"My hours","saveTimes":"Save hours","timesSaved":"Hours saved.","exReportTitle":"Existing work report","exReportAsk":"There is already a work report for this project in this week. Add the day to it or create a new report?","exReportYes":"Add to this report","exReportNo":"Create new report","dayFilled":"This day is already filled in the work report.","extraEntry":"Additional entry","addEntry":"+ Additional entry","removeEntry":"Remove","moreTabs":"More","navAddr2":"2nd address (navigation only)","instrDeleteAsk":"Really delete this work instruction?","archiveTab":"Archive","toArchive":"To archive","fromArchive":"From archive","addr2Desc":"Description","absRejectReason":"Reason for rejection"},
  Kroatisch: {"planTitle":"Planiranje","planNew":"Novo planiranje","planEquipment":"Oprema","planEmployee":"Radnik","planFrom":"Od","planTo":"Do","planNote":"Napomena (nije obavezno)","planSave":"Spremi plan","planUpcoming":"Planirane dodjele","planEmpty":"Nema planiranja.","planActive":"u tijeku","planPlanned":"planirano","planConflictTitle":"Pozor: preklapanje","planConflictText":"Ova oprema je već planirana za odabrano razdoblje:","planSaveAnyway":"Ipak spremi","planCancel":"Odustani","planPick":"— odaberite —","exportProjectLabel":"Projekt","exportTranslating":"Prevodim djelatnosti…","exportByEmployee":"Sati po radniku","exportByProject":"Sati po projektu","kmStart":"Početni km","kmEnd":"Završni km","kmDriven":"Prijeđeni km","kmSave":"Spremi km","kmWarnNegative":"Završni km manji od početnog – provjerite","returnTitle":"Povrat","returnQuestion":"Oštećenje ili posebnost?","returnPlaceholder":"npr. ogrebotina straga lijevo, alat neispravan … (nije obavezno)","returnConfirm":"Vrati","returnNoteHistory":"Napomena povrata","returnNoDamage":"Bez oštećenja","returnDamage":"Oštećenje","returnOther":"Ostalo","eqReportTitle":"Mjesečni izvoz","eqReportVehicles":"Vozila CSV","eqReportTools":"Alat CSV","colFrom":"Od","colTo":"Do","colDuration":"Trajanje (dana)","colDamage":"Oštećenje / napomena","colOngoing":"još traje","take":"Preuzmi","scopeLabel":"Razdoblje","scopeDay":"Jedan dan","scopeWeek":"Cijeli tjedan","myTimes":"Moji sati","saveTimes":"Spremi sate","timesSaved":"Sati spremljeni.","exReportTitle":"Postojeći izvještaj","exReportAsk":"Za ovaj projekt već postoji izvještaj u ovom tjednu. Dodati dan u njega ili izraditi novi izvještaj?","exReportYes":"Dodaj u ovaj izvještaj","exReportNo":"Izradi novi izvještaj","dayFilled":"Ovaj dan je već ispunjen u izvještaju.","extraEntry":"Dodatni unos","addEntry":"+ Dodatni unos","removeEntry":"Ukloni","moreTabs":"Više","navAddr2":"2. adresa (samo navigacija)","instrDeleteAsk":"Stvarno izbrisati radni nalog?","archiveTab":"Arhiva","toArchive":"U arhivu","fromArchive":"Iz arhive","addr2Desc":"Opis","absRejectReason":"Razlog odbijanja"},
  Slowenisch: {"planTitle":"Načrtovanje","planNew":"Novo načrtovanje","planEquipment":"Oprema","planEmployee":"Zaposleni","planFrom":"Od","planTo":"Do","planNote":"Opomba (neobvezno)","planSave":"Shrani načrt","planUpcoming":"Načrtovane dodelitve","planEmpty":"Ni načrtov.","planActive":"poteka","planPlanned":"načrtovano","planConflictTitle":"Pozor: prekrivanje","planConflictText":"Ta oprema je za izbrano obdobje že načrtovana:","planSaveAnyway":"Vseeno shrani","planCancel":"Prekliči","planPick":"— izberite —","exportProjectLabel":"Projekt","exportTranslating":"Prevajam dejavnosti…","exportByEmployee":"Ure po zaposlenem","exportByProject":"Ure po projektu","kmStart":"Začetni km","kmEnd":"Končni km","kmDriven":"Prevoženi km","kmSave":"Shrani km","kmWarnNegative":"Končni km manjši od začetnega – preverite","returnTitle":"Vračilo","returnQuestion":"Poškodba ali posebnost?","returnPlaceholder":"npr. praska zadaj levo, orodje okvarjeno … (neobvezno)","returnConfirm":"Vrni","returnNoteHistory":"Opomba vračila","returnNoDamage":"Brez poškodb","returnDamage":"Poškodba","returnOther":"Drugo","eqReportTitle":"Mesečni izvoz","eqReportVehicles":"Vozila CSV","eqReportTools":"Orodje CSV","colFrom":"Od","colTo":"Do","colDuration":"Trajanje (dni)","colDamage":"Poškodba / opomba","colOngoing":"še poteka","take":"Prevzemi","scopeLabel":"Obdobje","scopeDay":"En dan","scopeWeek":"Cel teden","myTimes":"Moje ure","saveTimes":"Shrani ure","timesSaved":"Ure shranjene.","exReportTitle":"Obstoječe poročilo","exReportAsk":"Za ta projekt v tem tednu že obstaja poročilo. Dodam dan vanj ali ustvarim novo poročilo?","exReportYes":"Dodaj v to poročilo","exReportNo":"Ustvari novo poročilo","dayFilled":"Ta dan je v poročilu že izpolnjen.","extraEntry":"Dodatni vnos","addEntry":"+ Dodatni vnos","removeEntry":"Odstrani","moreTabs":"Več","navAddr2":"2. naslov (samo navigacija)","instrDeleteAsk":"Res izbrišem delovno navodilo?","archiveTab":"Arhiv","toArchive":"V arhiv","fromArchive":"Iz arhiva","addr2Desc":"Opis","absRejectReason":"Razlog zavrnitve"},
  Polnisch: {"planTitle":"Planowanie","planNew":"Nowe planowanie","planEquipment":"Sprzęt","planEmployee":"Pracownik","planFrom":"Od","planTo":"Do","planNote":"Notatka (opcjonalnie)","planSave":"Zapisz plan","planUpcoming":"Zaplanowane przydziały","planEmpty":"Brak planów.","planActive":"trwa","planPlanned":"zaplanowane","planConflictTitle":"Uwaga: nakładanie się","planConflictText":"Ten sprzęt jest już zaplanowany w wybranym okresie:","planSaveAnyway":"Zapisz mimo to","planCancel":"Anuluj","planPick":"— wybierz —","exportProjectLabel":"Projekt","exportTranslating":"Tłumaczę czynności…","exportByEmployee":"Godziny wg pracownika","exportByProject":"Godziny wg projektu","kmStart":"Km początkowy","kmEnd":"Km końcowy","kmDriven":"Przejechane km","kmSave":"Zapisz km","kmWarnNegative":"Km końcowy mniejszy niż początkowy – sprawdź","returnTitle":"Zwrot","returnQuestion":"Uszkodzenie lub uwaga?","returnPlaceholder":"np. rysa z tyłu po lewej, narzędzie uszkodzone … (opcjonalnie)","returnConfirm":"Zwróć","returnNoteHistory":"Notatka zwrotu","returnNoDamage":"Brak uszkodzeń","returnDamage":"Uszkodzenie","returnOther":"Inne","eqReportTitle":"Eksport miesięczny","eqReportVehicles":"Pojazdy CSV","eqReportTools":"Narzędzia CSV","colFrom":"Od","colTo":"Do","colDuration":"Czas trwania (dni)","colDamage":"Uszkodzenie / notatka","colOngoing":"w toku","take":"Przejmij","scopeLabel":"Okres","scopeDay":"Jeden dzień","scopeWeek":"Cały tydzień","myTimes":"Moje godziny","saveTimes":"Zapisz godziny","timesSaved":"Godziny zapisane.","exReportTitle":"Istniejący raport","exReportAsk":"Dla tego projektu istnieje już raport w tym tygodniu. Dodać dzień do niego czy utworzyć nowy raport?","exReportYes":"Dodaj do tego raportu","exReportNo":"Utwórz nowy raport","dayFilled":"Ten dzień jest już wypełniony w raporcie.","extraEntry":"Dodatkowy wpis","addEntry":"+ Dodatkowy wpis","removeEntry":"Usuń","moreTabs":"Więcej","navAddr2":"2. adres (tylko nawigacja)","instrDeleteAsk":"Na pewno usunąć instrukcję pracy?","archiveTab":"Archiwum","toArchive":"Do archiwum","fromArchive":"Z archiwum","addr2Desc":"Opis","absRejectReason":"Powód odrzucenia"},
  Rumänisch: {"planTitle":"Planificare","planNew":"Planificare nouă","planEquipment":"Echipament","planEmployee":"Angajat","planFrom":"De la","planTo":"Până la","planNote":"Notă (opțional)","planSave":"Salvează planul","planUpcoming":"Alocări planificate","planEmpty":"Nicio planificare.","planActive":"în curs","planPlanned":"planificat","planConflictTitle":"Atenție: suprapunere","planConflictText":"Acest echipament este deja planificat pentru perioada selectată:","planSaveAnyway":"Salvează oricum","planCancel":"Anulează","planPick":"— alegeți —","exportProjectLabel":"Proiect","exportTranslating":"Traduc activitățile…","exportByEmployee":"Ore pe angajat","exportByProject":"Ore pe proiect","kmStart":"Km start","kmEnd":"Km final","kmDriven":"Km parcurși","kmSave":"Salvează km","kmWarnNegative":"Km final mai mic decât km start – verificați","returnTitle":"Returnare","returnQuestion":"Deteriorare sau observație?","returnPlaceholder":"ex. zgârietură spate stânga, unealtă defectă … (opțional)","returnConfirm":"Returnează","returnNoteHistory":"Notă returnare","returnNoDamage":"Fără deteriorări","returnDamage":"Deteriorare","returnOther":"Altele","eqReportTitle":"Export lunar","eqReportVehicles":"Vehicule CSV","eqReportTools":"Unelte CSV","colFrom":"De la","colTo":"Până la","colDuration":"Durată (zile)","colDamage":"Deteriorare / notă","colOngoing":"în curs","take":"Preia","scopeLabel":"Perioadă","scopeDay":"O zi","scopeWeek":"Toată săptămâna","myTimes":"Orele mele","saveTimes":"Salvează orele","timesSaved":"Ore salvate.","exReportTitle":"Raport existent","exReportAsk":"Există deja un raport pentru acest proiect în această săptămână. Adăugați ziua în el sau creați un raport nou?","exReportYes":"Adaugă în acest raport","exReportNo":"Creează raport nou","dayFilled":"Această zi este deja completată în raport.","extraEntry":"Intrare suplimentară","addEntry":"+ Intrare suplimentară","removeEntry":"Elimină","moreTabs":"Mai mult","navAddr2":"A 2-a adresă (doar navigare)","instrDeleteAsk":"Ștergeți definitiv instrucțiunea de lucru?","archiveTab":"Arhivă","toArchive":"În arhivă","fromArchive":"Din arhivă","addr2Desc":"Descriere","absRejectReason":"Motivul respingerii"},
  Ukrainisch: {"planTitle":"Планування","planNew":"Нове планування","planEquipment":"Обладнання","planEmployee":"Працівник","planFrom":"Від","planTo":"До","planNote":"Примітка (необов'язково)","planSave":"Зберегти план","planUpcoming":"Заплановані призначення","planEmpty":"Немає планів.","planActive":"триває","planPlanned":"заплановано","planConflictTitle":"Увага: накладання","planConflictText":"Це обладнання вже заплановане на вибраний період:","planSaveAnyway":"Все одно зберегти","planCancel":"Скасувати","planPick":"— оберіть —","exportProjectLabel":"Проєкт","exportTranslating":"Перекладаю роботи…","exportByEmployee":"Години за працівником","exportByProject":"Години за проєктом","kmStart":"Початковий км","kmEnd":"Кінцевий км","kmDriven":"Пройдено км","kmSave":"Зберегти км","kmWarnNegative":"Кінцевий км менший за початковий – перевірте","returnTitle":"Повернення","returnQuestion":"Пошкодження чи особливість?","returnPlaceholder":"напр. подряпина ззаду ліворуч, інструмент несправний … (необов'язково)","returnConfirm":"Повернути","returnNoteHistory":"Примітка повернення","returnNoDamage":"Без пошкоджень","returnDamage":"Пошкодження","returnOther":"Інше","eqReportTitle":"Місячний експорт","eqReportVehicles":"Транспорт CSV","eqReportTools":"Інструменти CSV","colFrom":"Від","colTo":"До","colDuration":"Тривалість (днів)","colDamage":"Пошкодження / примітка","colOngoing":"триває","take":"Взяти","scopeLabel":"Період","scopeDay":"Один день","scopeWeek":"Цілий тиждень","myTimes":"Мої години","saveTimes":"Зберегти години","timesSaved":"Години збережено.","exReportTitle":"Наявний звіт","exReportAsk":"Для цього проєкту вже є звіт у цьому тижні. Додати день до нього чи створити новий звіт?","exReportYes":"Додати до цього звіту","exReportNo":"Створити новий звіт","dayFilled":"Цей день уже заповнено у звіті.","extraEntry":"Додатковий запис","addEntry":"+ Додатковий запис","removeEntry":"Видалити","moreTabs":"Більше","navAddr2":"2-га адреса (лише навігація)","instrDeleteAsk":"Справді видалити інструкцію?","archiveTab":"Архів","toArchive":"До архіву","fromArchive":"З архіву","addr2Desc":"Опис","absRejectReason":"Причина відхилення"},
  Ungarisch: {"planTitle":"Tervezés","planNew":"Új tervezés","planEquipment":"Eszköz","planEmployee":"Munkatárs","planFrom":"Kezdés","planTo":"Vége","planNote":"Megjegyzés (opcionális)","planSave":"Terv mentése","planUpcoming":"Tervezett hozzárendelések","planEmpty":"Nincs tervezés.","planActive":"folyamatban","planPlanned":"tervezett","planConflictTitle":"Figyelem: átfedés","planConflictText":"Ez az eszköz a kiválasztott időszakra már be van tervezve:","planSaveAnyway":"Mentés mégis","planCancel":"Mégse","planPick":"— válasszon —","exportProjectLabel":"Projekt","exportTranslating":"Tevékenységek fordítása…","exportByEmployee":"Órák munkatársanként","exportByProject":"Órák projektenként","kmStart":"Kezdő km","kmEnd":"Záró km","kmDriven":"Megtett km","kmSave":"km mentése","kmWarnNegative":"A záró km kisebb a kezdőnél – ellenőrizze","returnTitle":"Visszavétel","returnQuestion":"Sérülés vagy megjegyzés?","returnPlaceholder":"pl. karcolás hátul balra, szerszám hibás … (opcionális)","returnConfirm":"Visszaadás","returnNoteHistory":"Visszavételi megjegyzés","returnNoDamage":"Nincs sérülés","returnDamage":"Sérülés","returnOther":"Egyéb","eqReportTitle":"Havi export","eqReportVehicles":"Járművek CSV","eqReportTools":"Szerszámok CSV","colFrom":"Kezdés","colTo":"Vége","colDuration":"Időtartam (nap)","colDamage":"Sérülés / megjegyzés","colOngoing":"folyamatban","take":"Átvesz","scopeLabel":"Időszak","scopeDay":"Egy nap","scopeWeek":"Egész hét","myTimes":"Óráim","saveTimes":"Órák mentése","timesSaved":"Órák elmentve.","exReportTitle":"Meglévő jelentés","exReportAsk":"Ehhez a projekthez ezen a héten már van jelentés. Hozzáadja a napot, vagy új jelentést hoz létre?","exReportYes":"Hozzáadás ehhez a jelentéshez","exReportNo":"Új jelentés létrehozása","dayFilled":"Ez a nap már ki van töltve a jelentésben.","extraEntry":"További bejegyzés","addEntry":"+ További bejegyzés","removeEntry":"Eltávolítás","moreTabs":"Több","navAddr2":"2. cím (csak navigáció)","instrDeleteAsk":"Biztosan törli a munkautasítást?","archiveTab":"Archívum","toArchive":"Archiválás","fromArchive":"Vissza az archívumból","addr2Desc":"Leírás","absRejectReason":"Elutasítás oka"},
  Bulgarisch: {"planTitle":"Планиране","planNew":"Ново планиране","planEquipment":"Оборудване","planEmployee":"Служител","planFrom":"От","planTo":"До","planNote":"Бележка (по избор)","planSave":"Запази плана","planUpcoming":"Планирани разпределения","planEmpty":"Няма планове.","planActive":"тече","planPlanned":"планирано","planConflictTitle":"Внимание: припокриване","planConflictText":"Това оборудване вече е планирано за избрания период:","planSaveAnyway":"Запази въпреки това","planCancel":"Отказ","planPick":"— изберете —","exportProjectLabel":"Проект","exportTranslating":"Превеждам дейностите…","exportByEmployee":"Часове по служител","exportByProject":"Часове по проект","kmStart":"Начални км","kmEnd":"Крайни км","kmDriven":"Изминати км","kmSave":"Запази км","kmWarnNegative":"Крайните км са по-малки от началните – проверете","returnTitle":"Връщане","returnQuestion":"Повреда или особеност?","returnPlaceholder":"напр. драскотина отзад вляво, дефектен инструмент … (по избор)","returnConfirm":"Върни","returnNoteHistory":"Бележка при връщане","returnNoDamage":"Без повреди","returnDamage":"Повреда","returnOther":"Друго","eqReportTitle":"Месечен експорт","eqReportVehicles":"Превозни средства CSV","eqReportTools":"Инструменти CSV","colFrom":"От","colTo":"До","colDuration":"Продължителност (дни)","colDamage":"Повреда / бележка","colOngoing":"все още тече","take":"Вземи","scopeLabel":"Период","scopeDay":"Един ден","scopeWeek":"Цяла седмица","myTimes":"Моите часове","saveTimes":"Запази часовете","timesSaved":"Часовете са запазени.","exReportTitle":"Съществуващ отчет","exReportAsk":"За този проект вече има отчет за тази седмица. Да добавим деня в него или да създадем нов отчет?","exReportYes":"Добави в този отчет","exReportNo":"Създай нов отчет","dayFilled":"Този ден вече е попълнен в отчета.","extraEntry":"Допълнителен запис","addEntry":"+ Допълнителен запис","removeEntry":"Премахни","moreTabs":"Още","navAddr2":"2-ри адрес (само навигация)","instrDeleteAsk":"Наистина ли да изтрия инструкцията?","archiveTab":"Архив","toArchive":"В архива","fromArchive":"От архива","addr2Desc":"Описание","absRejectReason":"Причина за отхвърляне"},
  Tschechisch: {"planTitle":"Plánování","planNew":"Nové plánování","planEquipment":"Vybavení","planEmployee":"Zaměstnanec","planFrom":"Od","planTo":"Do","planNote":"Poznámka (nepovinné)","planSave":"Uložit plán","planUpcoming":"Naplánovaná přiřazení","planEmpty":"Žádné plány.","planActive":"probíhá","planPlanned":"naplánováno","planConflictTitle":"Pozor: překrytí","planConflictText":"Toto vybavení je pro zvolené období již naplánováno:","planSaveAnyway":"Přesto uložit","planCancel":"Zrušit","planPick":"— vyberte —","exportProjectLabel":"Projekt","exportTranslating":"Překládám činnosti…","exportByEmployee":"Hodiny podle zaměstnance","exportByProject":"Hodiny podle projektu","kmStart":"Počáteční km","kmEnd":"Konečné km","kmDriven":"Ujeté km","kmSave":"Uložit km","kmWarnNegative":"Konečné km nižší než počáteční – zkontrolujte","returnTitle":"Vrácení","returnQuestion":"Poškození nebo zvláštnost?","returnPlaceholder":"např. škrábanec vzadu vlevo, vadné nářadí … (nepovinné)","returnConfirm":"Vrátit","returnNoteHistory":"Poznámka k vrácení","returnNoDamage":"Bez poškození","returnDamage":"Poškození","returnOther":"Ostatní","eqReportTitle":"Měsíční export","eqReportVehicles":"Vozidla CSV","eqReportTools":"Nářadí CSV","colFrom":"Od","colTo":"Do","colDuration":"Doba (dny)","colDamage":"Poškození / poznámka","colOngoing":"stále probíhá","take":"Převzít","scopeLabel":"Období","scopeDay":"Jeden den","scopeWeek":"Celý týden","myTimes":"Moje hodiny","saveTimes":"Uložit hodiny","timesSaved":"Hodiny uloženy.","exReportTitle":"Existující výkaz","exReportAsk":"Pro tento projekt už v tomto týdnu existuje výkaz. Přidat den do něj nebo vytvořit nový výkaz?","exReportYes":"Přidat do tohoto výkazu","exReportNo":"Vytvořit nový výkaz","dayFilled":"Tento den je ve výkazu už vyplněný.","extraEntry":"Další záznam","addEntry":"+ Další záznam","removeEntry":"Odebrat","moreTabs":"Více","navAddr2":"2. adresa (jen navigace)","instrDeleteAsk":"Opravdu smazat pracovní pokyn?","archiveTab":"Archiv","toArchive":"Do archivu","fromArchive":"Z archivu","addr2Desc":"Popis","absRejectReason":"Důvod zamítnutí"},
  Türkisch: {"planTitle":"Planlama","planNew":"Yeni planlama","planEquipment":"Ekipman","planEmployee":"Çalışan","planFrom":"Başlangıç","planTo":"Bitiş","planNote":"Not (isteğe bağlı)","planSave":"Planı kaydet","planUpcoming":"Planlanan atamalar","planEmpty":"Plan yok.","planActive":"sürüyor","planPlanned":"planlandı","planConflictTitle":"Dikkat: çakışma","planConflictText":"Bu ekipman seçilen dönem için zaten planlanmış:","planSaveAnyway":"Yine de kaydet","planCancel":"İptal","planPick":"— seçin —","exportProjectLabel":"Proje","exportTranslating":"Faaliyetler çevriliyor…","exportByEmployee":"Çalışana göre saat","exportByProject":"Projeye göre saat","kmStart":"Başlangıç km","kmEnd":"Bitiş km","kmDriven":"Gidilen km","kmSave":"km kaydet","kmWarnNegative":"Bitiş km başlangıçtan küçük – kontrol edin","returnTitle":"İade","returnQuestion":"Hasar veya özel durum?","returnPlaceholder":"örn. arka sol çizik, alet arızalı … (isteğe bağlı)","returnConfirm":"İade et","returnNoteHistory":"İade notu","returnNoDamage":"Hasar yok","returnDamage":"Hasar","returnOther":"Diğer","eqReportTitle":"Aylık dışa aktarma","eqReportVehicles":"Araçlar CSV","eqReportTools":"Aletler CSV","colFrom":"Başlangıç","colTo":"Bitiş","colDuration":"Süre (gün)","colDamage":"Hasar / not","colOngoing":"devam ediyor","take":"Al","scopeLabel":"Dönem","scopeDay":"Bir gün","scopeWeek":"Tüm hafta","myTimes":"Saatlerim","saveTimes":"Saatleri kaydet","timesSaved":"Saatler kaydedildi.","exReportTitle":"Mevcut rapor","exReportAsk":"Bu proje için bu haftada zaten bir rapor var. Günü ona mı ekleyelim yoksa yeni rapor mu oluşturalım?","exReportYes":"Bu rapora ekle","exReportNo":"Yeni rapor oluştur","dayFilled":"Bu gün raporda zaten dolu.","extraEntry":"Ek kayıt","addEntry":"+ Ek kayıt","removeEntry":"Kaldır","moreTabs":"Daha fazla","navAddr2":"2. adres (yalnızca navigasyon)","instrDeleteAsk":"İş talimatı gerçekten silinsin mi?","archiveTab":"Arşiv","toArchive":"Arşive taşı","fromArchive":"Arşivden çıkar","addr2Desc":"Açıklama","absRejectReason":"Ret nedeni"},
  Italienisch: {"planTitle":"Pianificazione","planNew":"Nuova pianificazione","planEquipment":"Attrezzatura","planEmployee":"Dipendente","planFrom":"Dal","planTo":"Al","planNote":"Nota (facoltativo)","planSave":"Salva pianificazione","planUpcoming":"Assegnazioni pianificate","planEmpty":"Nessuna pianificazione.","planActive":"in corso","planPlanned":"pianificato","planConflictTitle":"Attenzione: sovrapposizione","planConflictText":"Questa attrezzatura è già pianificata per il periodo selezionato:","planSaveAnyway":"Salva comunque","planCancel":"Annulla","planPick":"— seleziona —","exportProjectLabel":"Progetto","exportTranslating":"Traduzione delle attività…","exportByEmployee":"Ore per dipendente","exportByProject":"Ore per progetto","kmStart":"Km iniziali","kmEnd":"Km finali","kmDriven":"Km percorsi","kmSave":"Salva km","kmWarnNegative":"Km finali inferiori a quelli iniziali – controllare","returnTitle":"Restituzione","returnQuestion":"Danno o particolarità?","returnPlaceholder":"es. graffio posteriore sinistro, utensile difettoso … (facoltativo)","returnConfirm":"Restituisci","returnNoteHistory":"Nota di restituzione","returnNoDamage":"Nessun danno","returnDamage":"Danno","returnOther":"Altro","eqReportTitle":"Esportazione mensile","eqReportVehicles":"Veicoli CSV","eqReportTools":"Utensili CSV","colFrom":"Dal","colTo":"Al","colDuration":"Durata (giorni)","colDamage":"Danno / nota","colOngoing":"in corso","take":"Prendi","scopeLabel":"Periodo","scopeDay":"Un giorno","scopeWeek":"Intera settimana","myTimes":"Le mie ore","saveTimes":"Salva le ore","timesSaved":"Ore salvate.","exReportTitle":"Rapporto esistente","exReportAsk":"Per questo progetto esiste già un rapporto in questa settimana. Aggiungere il giorno o creare un nuovo rapporto?","exReportYes":"Aggiungi a questo rapporto","exReportNo":"Crea nuovo rapporto","dayFilled":"Questo giorno è già compilato nel rapporto.","extraEntry":"Voce aggiuntiva","addEntry":"+ Voce aggiuntiva","removeEntry":"Rimuovi","moreTabs":"Altro","navAddr2":"2° indirizzo (solo navigazione)","instrDeleteAsk":"Eliminare davvero l'istruzione di lavoro?","archiveTab":"Archivio","toArchive":"In archivio","fromArchive":"Dall'archivio","addr2Desc":"Descrizione","absRejectReason":"Motivo del rifiuto"},
  Serbisch: {"planTitle":"Planiranje","planNew":"Novo planiranje","planEquipment":"Oprema","planEmployee":"Radnik","planFrom":"Od","planTo":"Do","planNote":"Napomena (opciono)","planSave":"Sačuvaj plan","planUpcoming":"Planirane dodele","planEmpty":"Nema planiranja.","planActive":"u toku","planPlanned":"planirano","planConflictTitle":"Pažnja: preklapanje","planConflictText":"Ova oprema je već planirana za izabrani period:","planSaveAnyway":"Ipak sačuvaj","planCancel":"Otkaži","planPick":"— izaberite —","exportProjectLabel":"Projekat","exportTranslating":"Prevodim aktivnosti…","exportByEmployee":"Sati po radniku","exportByProject":"Sati po projektu","kmStart":"Početni km","kmEnd":"Krajnji km","kmDriven":"Pređeni km","kmSave":"Sačuvaj km","kmWarnNegative":"Krajnji km manji od početnog – proverite","returnTitle":"Vraćanje","returnQuestion":"Oštećenje ili posebnost?","returnPlaceholder":"npr. ogrebotina pozadi levo, alat neispravan … (opciono)","returnConfirm":"Vrati","returnNoteHistory":"Napomena vraćanja","returnNoDamage":"Bez oštećenja","returnDamage":"Oštećenje","returnOther":"Ostalo","eqReportTitle":"Mesečni izvoz","eqReportVehicles":"Vozila CSV","eqReportTools":"Alat CSV","colFrom":"Od","colTo":"Do","colDuration":"Trajanje (dana)","colDamage":"Oštećenje / napomena","colOngoing":"još traje","take":"Preuzmi","scopeLabel":"Period","scopeDay":"Jedan dan","scopeWeek":"Cela nedelja","myTimes":"Moji sati","saveTimes":"Sačuvaj sate","timesSaved":"Sati sačuvani.","exReportTitle":"Postojeći izveštaj","exReportAsk":"Za ovaj projekat već postoji izveštaj u ovoj nedelji. Dodati dan u njega ili napraviti novi izveštaj?","exReportYes":"Dodaj u ovaj izveštaj","exReportNo":"Napravi novi izveštaj","dayFilled":"Ovaj dan je već popunjen u izveštaju.","extraEntry":"Dodatni unos","addEntry":"+ Dodatni unos","removeEntry":"Ukloni","moreTabs":"Više","navAddr2":"2. adresa (samo navigacija)","instrDeleteAsk":"Zaista obrisati radni nalog?","archiveTab":"Arhiva","toArchive":"U arhivu","fromArchive":"Iz arhive","addr2Desc":"Opis","absRejectReason":"Razlog odbijanja"},
  Spanisch: {"planTitle":"Planificación","planNew":"Nueva planificación","planEquipment":"Equipo","planEmployee":"Empleado","planFrom":"Desde","planTo":"Hasta","planNote":"Nota (opcional)","planSave":"Guardar planificación","planUpcoming":"Asignaciones planificadas","planEmpty":"Sin planificaciones.","planActive":"en curso","planPlanned":"planificado","planConflictTitle":"Atención: solapamiento","planConflictText":"Este equipo ya está planificado para el período seleccionado:","planSaveAnyway":"Guardar de todos modos","planCancel":"Cancelar","planPick":"— seleccione —","exportProjectLabel":"Proyecto","exportTranslating":"Traduciendo actividades…","exportByEmployee":"Horas por empleado","exportByProject":"Horas por proyecto","kmStart":"Km inicial","kmEnd":"Km final","kmDriven":"Km recorridos","kmSave":"Guardar km","kmWarnNegative":"Km final menor que el inicial – verifique","returnTitle":"Devolución","returnQuestion":"¿Daño o particularidad?","returnPlaceholder":"p. ej. rayón trasero izquierdo, herramienta defectuosa … (opcional)","returnConfirm":"Devolver","returnNoteHistory":"Nota de devolución","returnNoDamage":"Sin daños","returnDamage":"Daño","returnOther":"Otros","eqReportTitle":"Exportación mensual","eqReportVehicles":"Vehículos CSV","eqReportTools":"Herramientas CSV","colFrom":"Desde","colTo":"Hasta","colDuration":"Duración (días)","colDamage":"Daño / nota","colOngoing":"en curso","take":"Tomar","scopeLabel":"Periodo","scopeDay":"Un día","scopeWeek":"Toda la semana","myTimes":"Mis horas","saveTimes":"Guardar horas","timesSaved":"Horas guardadas.","exReportTitle":"Informe existente","exReportAsk":"Ya existe un informe para este proyecto en esta semana. ¿Añadir el día o crear un informe nuevo?","exReportYes":"Añadir a este informe","exReportNo":"Crear informe nuevo","dayFilled":"Este día ya está completado en el informe.","extraEntry":"Entrada adicional","addEntry":"+ Entrada adicional","removeEntry":"Quitar","moreTabs":"Más","navAddr2":"2ª dirección (solo navegación)","instrDeleteAsk":"¿Eliminar realmente la instrucción de trabajo?","archiveTab":"Archivo","toArchive":"Al archivo","fromArchive":"Del archivo","addr2Desc":"Descripción","absRejectReason":"Motivo del rechazo"},
  Philippinisch: {"planTitle":"Pagpaplano","planNew":"Bagong Pagpaplano","planEquipment":"Kagamitan","planEmployee":"Empleyado","planFrom":"Mula","planTo":"Hanggang","planNote":"Tala (opsyonal)","planSave":"I-save ang Pagpaplano","planUpcoming":"Mga Nakaplanong Talaga","planEmpty":"Walang pagpaplano.","planActive":"aktibo","planPlanned":"nakaplano","planConflictTitle":"Babala: Pagkakasalungat","planConflictText":"Ang kagamitang ito ay naka-iskedyul na sa napiling panahon:","planSaveAnyway":"I-save pa rin","planCancel":"Kanselahin","planPick":"— pumili —","exportProjectLabel":"Proyekto","exportTranslating":"Isinasalin ang mga gawain…","exportByEmployee":"Oras ng Empleyado","exportByProject":"Oras ng Proyekto","kmStart":"Simula-km","kmEnd":"Katapusan-km","kmDriven":"Napatakbong km","kmSave":"I-save ang km","kmWarnNegative":"Ang katapusan-km ay mas maliit kaysa simula-km – pakisuri","returnTitle":"Pagsasauli","returnQuestion":"May pinsala o kakaibang bagay?","returnPlaceholder":"hal. gasgas sa likod kaliwa, sirang kagamitan … (opsyonal)","returnConfirm":"Isauli","returnNoteHistory":"Tala sa Pagsasauli","returnNoDamage":"Walang Pinsala","returnDamage":"Pinsala","returnOther":"Iba pa","eqReportTitle":"Export ng Buwan","eqReportVehicles":"Sasakyan CSV","eqReportTools":"Kagamitan CSV","colFrom":"Mula","colTo":"Hanggang","colDuration":"Tagal (Araw)","colDamage":"Pinsala / Tala","colOngoing":"kasalukuyang isinasagawa","take":"Kunin","scopeLabel":"Panahon","scopeDay":"Isang araw","scopeWeek":"Buong linggo","myTimes":"Aking mga oras","saveTimes":"I-save ang oras","timesSaved":"Na-save ang oras.","exReportTitle":"Umiiral na ulat","exReportAsk":"May ulat na para sa proyektong ito sa linggong ito. Idagdag ang araw dito o gumawa ng bagong ulat?","exReportYes":"Idagdag sa ulat na ito","exReportNo":"Gumawa ng bagong ulat","dayFilled":"Puno na ang araw na ito sa ulat.","extraEntry":"Karagdagang entry","addEntry":"+ Karagdagang entry","removeEntry":"Alisin","moreTabs":"Higit pa","navAddr2":"2nd address (nabigasyon lang)","instrDeleteAsk":"Talagang burahin ang tagubilin sa trabaho?","archiveTab":"Archive","toArchive":"Sa archive","fromArchive":"Mula sa archive","addr2Desc":"Paglalarawan","absRejectReason":"Dahilan ng pagtanggi"},
  Vietnamesisch: {"planTitle":"Lập kế hoạch","planNew":"Kế hoạch mới","planEquipment":"Thiết bị","planEmployee":"Nhân viên","planFrom":"Từ","planTo":"Đến","planNote":"Ghi chú (tùy chọn)","planSave":"Lưu kế hoạch","planUpcoming":"Phân bổ đã lên kế hoạch","planEmpty":"Không có kế hoạch nào.","planActive":"đang chạy","planPlanned":"đã lên kế hoạch","planConflictTitle":"Chú ý: Trùng lịch","planConflictText":"Thiết bị này đã được lên kế hoạch trong khoảng thời gian đã chọn:","planSaveAnyway":"Vẫn lưu","planCancel":"Hủy","planPick":"— vui lòng chọn —","exportProjectLabel":"Dự án","exportTranslating":"Đang dịch các hoạt động…","exportByEmployee":"Giờ công theo nhân viên","exportByProject":"Giờ công theo dự án","kmStart":"km đầu","kmEnd":"km cuối","kmDriven":"Số km đã đi","kmSave":"Lưu km","kmWarnNegative":"km cuối nhỏ hơn km đầu – vui lòng kiểm tra","returnTitle":"Trả lại","returnQuestion":"Có hư hỏng hoặc điều gì đặc biệt không?","returnPlaceholder":"ví dụ trầy xước phía sau bên trái, dụng cụ hỏng … (tùy chọn)","returnConfirm":"Trả lại","returnNoteHistory":"Ghi chú trả lại","returnNoDamage":"Không hư hỏng","returnDamage":"Hư hỏng","returnOther":"Khác","eqReportTitle":"Xuất theo tháng","eqReportVehicles":"Xe CSV","eqReportTools":"Dụng cụ CSV","colFrom":"Từ","colTo":"Đến","colDuration":"Thời lượng (ngày)","colDamage":"Hư hỏng / Ghi chú","colOngoing":"vẫn đang chạy","take":"Nhận","scopeLabel":"Khoảng thời gian","scopeDay":"Một ngày","scopeWeek":"Cả tuần","myTimes":"Giờ của tôi","saveTimes":"Lưu giờ","timesSaved":"Đã lưu giờ.","exReportTitle":"Báo cáo hiện có","exReportAsk":"Đã có báo cáo cho dự án này trong tuần này. Thêm ngày vào đó hay tạo báo cáo mới?","exReportYes":"Thêm vào báo cáo này","exReportNo":"Tạo báo cáo mới","dayFilled":"Ngày này đã được điền trong báo cáo.","extraEntry":"Mục bổ sung","addEntry":"+ Mục bổ sung","removeEntry":"Xóa","moreTabs":"Thêm","navAddr2":"Địa chỉ 2 (chỉ điều hướng)","instrDeleteAsk":"Thực sự xóa hướng dẫn công việc này?","archiveTab":"Lưu trữ","toArchive":"Vào lưu trữ","fromArchive":"Khỏi lưu trữ","addr2Desc":"Mô tả","absRejectReason":"Lý do từ chối"},
  Indisch: {"planTitle":"योजना","planNew":"नई योजना","planEquipment":"उपकरण","planEmployee":"कर्मचारी","planFrom":"से","planTo":"तक","planNote":"नोट (वैकल्पिक)","planSave":"योजना सहेजें","planUpcoming":"योजनाबद्ध आवंटन","planEmpty":"कोई योजना नहीं।","planActive":"चल रहा है","planPlanned":"योजनाबद्ध","planConflictTitle":"ध्यान दें: ओवरलैप","planConflictText":"यह उपकरण चुनी हुई अवधि में पहले से ही योजनाबद्ध है:","planSaveAnyway":"फिर भी सहेजें","planCancel":"रद्द करें","planPick":"— कृपया चुनें —","exportProjectLabel":"प्रोजेक्ट","exportTranslating":"गतिविधियों का अनुवाद हो रहा है…","exportByEmployee":"घंटे कर्मचारी","exportByProject":"घंटे प्रोजेक्ट","kmStart":"शुरुआती km","kmEnd":"अंतिम km","kmDriven":"चली गई km","kmSave":"km सहेजें","kmWarnNegative":"अंतिम km शुरुआती km से कम – कृपया जाँचें","returnTitle":"वापसी","returnQuestion":"क्षति या विशेष बात?","returnPlaceholder":"जैसे पीछे बाईं ओर खरोंच, औज़ार खराब … (वैकल्पिक)","returnConfirm":"वापस करें","returnNoteHistory":"वापसी नोट","returnNoDamage":"कोई क्षति नहीं","returnDamage":"क्षति","returnOther":"अन्य","eqReportTitle":"मासिक निर्यात","eqReportVehicles":"वाहन CSV","eqReportTools":"औज़ार CSV","colFrom":"से","colTo":"तक","colDuration":"अवधि (दिन)","colDamage":"क्षति / नोट","colOngoing":"अभी भी चल रहा है","take":"लें","scopeLabel":"अवधि","scopeDay":"एक दिन","scopeWeek":"पूरा सप्ताह","myTimes":"मेरे घंटे","saveTimes":"घंटे सहेजें","timesSaved":"घंटे सहेजे गए।","exReportTitle":"मौजूदा रिपोर्ट","exReportAsk":"इस प्रोजेक्ट के लिए इस सप्ताह पहले से रिपोर्ट है। दिन को उसमें जोड़ें या नई रिपोर्ट बनाएं?","exReportYes":"इस रिपोर्ट में जोड़ें","exReportNo":"नई रिपोर्ट बनाएं","dayFilled":"यह दिन रिपोर्ट में पहले से भरा है।","extraEntry":"अतिरिक्त प्रविष्टि","addEntry":"+ अतिरिक्त प्रविष्टि","removeEntry":"हटाएं","moreTabs":"अधिक","navAddr2":"दूसरा पता (केवल नेविगेशन)","instrDeleteAsk":"क्या वाकई कार्य निर्देश हटाएं?","archiveTab":"संग्रह","toArchive":"संग्रह में","fromArchive":"संग्रह से बाहर","addr2Desc":"विवरण","absRejectReason":"अस्वीकृति का कारण"},
};

// Rueckgabe-Notiz zerlegen: neuer Code (#none/#damage/#other[:text]) ODER alte,
// bereits lokalisiert gespeicherte Phrasen (in allen 14 Sprachen erkannt).
function parseReturnNote(raw: string): { kind: "none" | "damage" | "other" | "legacy"; free: string } {
  const s = String(raw || "");
  if (s.startsWith("#none")) return { kind: "none", free: "" };
  if (s.startsWith("#damage")) return { kind: "damage", free: s.slice(7).replace(/^:\s*/, "") };
  if (s.startsWith("#other")) return { kind: "other", free: s.slice(6).replace(/^:\s*/, "") };
  for (const lang of Object.values(EXTRA_LABELS)) {
    if (s === lang.returnNoDamage) return { kind: "none", free: "" };
    if (s === lang.returnDamage) return { kind: "damage", free: "" };
    if (s.startsWith(lang.returnDamage + ": ")) return { kind: "damage", free: s.slice((lang.returnDamage + ": ").length) };
    if (s === lang.returnOther) return { kind: "other", free: "" };
    if (s.startsWith(lang.returnOther + ": ")) return { kind: "other", free: s.slice((lang.returnOther + ": ").length) };
  }
  return { kind: "legacy", free: s };
}

export default function Home() {
  const [uiLanguage, setUiLanguage] = useState<Language>("Deutsch");
  const t = texts[uiLanguage];
  const tx = EXTRA_LABELS[uiLanguage] || EXTRA_LABELS.Deutsch;
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [companyBlocked, setCompanyBlocked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openDashProjects, setOpenDashProjects] = useState<Record<string, boolean>>({});
  const [dashRange, setDashRange] = useState("today");
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpText, setHelpText] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  // Aktuelles Anmelde-Token, laufend aus onAuthStateChange gesetzt.
  // So braucht das Speichern kein getSession() (das kann unter Last haengen).
  const tokenRef = useRef<string>("");
  // Kennt immer die aktuell gewaehlte Anzeige-Sprache – damit spaet eintreffende
  // Uebersetzungen einer alten Sprache die neue nicht mehr ueberschreiben koennen.
  const uiLanguageRef = useRef<Language>("Deutsch");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [reportVersion, setReportVersion] = useState(0);
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
  const [allReports, setAllReports] = useState<SavedReport[]>([]);
  const [teamReports, setTeamReports] = useState<SavedReport[]>([]);
  const [teamOpenId, setTeamOpenId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [teamFilterUid, setTeamFilterUid] = useState<string>("");
  const [teamShowArchive, setTeamShowArchive] = useState(false);
  const [transFrom, setTransFrom] = useState<string>("Deutsch");
  const [transTo, setTransTo] = useState<string>("Kroatisch");
  const [transInput, setTransInput] = useState<string>("");
  const [transOutput, setTransOutput] = useState<string>("");
  const [transLoading, setTransLoading] = useState(false);
  const [feedbackAnswers, setFeedbackAnswers] = useState<string[]>(Array(10).fill(""));
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamTrans, setTeamTrans] = useState<Record<string, { lang: string; days: Record<number, string>; extras?: Record<string, string> }>>({});
  const [days, setDays] = useState<DayEntry[]>(createEmptyDays());
  const [currentCompany, setCurrentCompany] = useState<CurrentCompany | null>(null);
  const [companyFeatures, setCompanyFeatures] = useState<CompanyFeatures | null>(null);
  // Modul "Kommentar-Chat": AN = offener Verlauf fuer alle, AUS = privater Kommentar je Person.
  const chatOn = !!companyFeatures?.comments_enabled;
  // "Nur lesen": Mitarbeiter darf Arbeitsanweisungen ansehen und Regieberichte erstellen,
  // aber weder Kommentare schreiben noch den Status aendern.
  const readOnlyUser = !!(currentCompany as any)?.read_only;
  const firstDate = days.find((day) => day.date)?.date || "";
  const calendarWeek = getCalendarWeek(firstDate);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("employee");
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [newUserLanguage, setNewUserLanguage] = useState<string>("Deutsch");
  const [newUserNationality, setNewUserNationality] = useState<string>("");
  const [newUserPhone, setNewUserPhone] = useState<string>("");
  const [newUserReadOnly, setNewUserReadOnly] = useState<boolean>(false);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("employee");
  const [editLang, setEditLang] = useState<string>("Deutsch");
  const [editNationality, setEditNationality] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [editReadOnly, setEditReadOnly] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [taskComments, setTaskComments] = useState<Record<string, string>>({});
  const [commentSaveState, setCommentSaveState] = useState<Record<string, string>>({});
  const [reportInstruction, setReportInstruction] = useState<any>(null);
  const [transferInst, setTransferInst] = useState<any>(null);
  const [transferConfirm, setTransferConfirm] = useState<{ instruction: any; report: SavedReport } | null>(null);
  const [instructionProblems, setInstructionProblems] = useState("");
  const [instructionMaterial, setInstructionMaterial] = useState("");
  const [instructionWerkzeug, setInstructionWerkzeug] = useState("");
  const [instructionTitle, setInstructionTitle] = useState("");
  const [instructionProject, setInstructionProject] = useState("");
  const [instructionCustomer, setInstructionCustomer] = useState("");
  const [instructionSite, setInstructionSite] = useState("");
  const [instructionStreet, setInstructionStreet] = useState("");
  const [instructionZip, setInstructionZip] = useState("");
  const [instructionCity, setInstructionCity] = useState("");
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
  const [moreTabsOpen, setMoreTabsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectCustomer, setProjectCustomer] = useState("");
  const [projectSite, setProjectSite] = useState("");
  const [projectStreet, setProjectStreet] = useState("");
  const [projectZip, setProjectZip] = useState("");
  const [projectCity, setProjectCity] = useState("");
  const [projectManager, setProjectManager] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<Record<string, string>>({});
  const [matDraft, setMatDraft] = useState<Record<string, { qty: string; unit: string; name: string }>>({});
  const [matSaving, setMatSaving] = useState<string | null>(null);
  const [materialCatalog, setMaterialCatalog] = useState<any[]>([]);
  const [catDraft, setCatDraft] = useState<{ id: string; name: string; unit: string }>({ id: "", name: "", unit: MATERIAL_UNITS[0] });
  const [catalogSuggestions, setCatalogSuggestions] = useState<{ name: string; unit: string }[]>([]);
  const [catTrans, setCatTrans] = useState<Record<string, string>>({});
  const [materialOrders, setMaterialOrders] = useState<any[]>([]);
  const [exportMonth, setExportMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [expCollapsed, setExpCollapsed] = useState<Record<string, boolean>>({});
  const [exportWeek, setExportWeek] = useState<string>("");
  const [exportProject, setExportProject] = useState<string>("");
  const [equipment, setEquipment] = useState<any[]>([]);
  const [eqDraft, setEqDraft] = useState<{ id: string; type: string; name: string; identifier: string; note: string }>({ id: "", type: "tool", name: "", identifier: "", note: "" });
  // km-Eingaben je Fahrzeug (durch den zugewiesenen Mitarbeiter / Chefs, direkt an der Karte).
  const [eqKmDraft, setEqKmDraft] = useState<Record<string, { start: string; end: string }>>({});
  // Rueckgabe-Nachfrage (Beschaedigung / Besonderheit) fuer Fahrzeuge & Werkzeuge.
  const [returnTarget, setReturnTarget] = useState<{ id: string; name: string } | null>(null);
  const [returnNote, setReturnNote] = useState<string>("");
  const [returnKind, setReturnKind] = useState<"none" | "damage" | "other">("none");
  const [eqReportMonth, setEqReportMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [eqReportWeek, setEqReportWeek] = useState<string>("");
  const [eqHistory, setEqHistory] = useState<Record<string, any[]>>({});
  const [eqHistTrans, setEqHistTrans] = useState<Record<string, string>>({});
  const [eqOpenId, setEqOpenId] = useState<string | null>(null);
  const [eqTrans, setEqTrans] = useState<Record<string, string>>({});
  const [eqFilter, setEqFilter] = useState<string>("all");
  const [eqPlans, setEqPlans] = useState<any[]>([]);
  const [eqPlanDraft, setEqPlanDraft] = useState<{ id: string; equipmentId: string; userId: string; dateFrom: string; dateTo: string; note: string }>({ id: "", equipmentId: "", userId: "", dateFrom: "", dateTo: "", note: "" });
  const [eqPlanConflict, setEqPlanConflict] = useState<any[] | null>(null);
  const [eqPlanSaving, setEqPlanSaving] = useState(false);
  const [absences, setAbsences] = useState<any[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");
  const [absDraft, setAbsDraft] = useState<{ type: string; start: string; end: string; note: string }>({ type: "vacation", start: "", end: "", note: "" });
  const [absSaving, setAbsSaving] = useState(false);
  const [absTrans, setAbsTrans] = useState<Record<string, string>>({});
  const [absCollapsed, setAbsCollapsed] = useState<Record<string, boolean>>({});
  const [orderDraft, setOrderDraft] = useState<Record<string, { qty: string; unit: string; name: string; note: string }>>({});
  const [orderSaving, setOrderSaving] = useState<string | null>(null);
  const [orderTrans, setOrderTrans] = useState<Record<string, string>>({});
  const [pmEdits, setPmEdits] = useState<Record<string, string>>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProjectDetailId, setSelectedProjectDetailId] = useState("");
  const [instructionDate, setInstructionDate] = useState("");
  const [instructionAddress2, setInstructionAddress2] = useState("");
  const [instructionAddr2Desc, setInstructionAddr2Desc] = useState("");
  const [instructionAddr2Name, setInstructionAddr2Name] = useState("");
  const [instructionAddr2Street, setInstructionAddr2Street] = useState("");
  const [instructionAddr2Zip, setInstructionAddr2Zip] = useState("");
  const [instructionAddr2City, setInstructionAddr2City] = useState("");
  const [addr2Open, setAddr2Open] = useState(false);
  const [instructionScope, setInstructionScope] = useState<"day" | "week">("day");
  // Vom Mitarbeiter je Anweisung/Tag erfasste Zeiten (Stunden, Pause, Fahrzeit, km).
  // Aufbau: { [instructionId]: { [YYYY-MM-DD]: { startTime, endTime, breakMinutes, hours, travelOut*, travelReturn* } } }
  const [instrTimes, setInstrTimes] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [instrTimesSaving, setInstrTimesSaving] = useState<string>("");
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [editingInstructionId, setEditingInstructionId] = useState<string | null>(null);
  const [openInstrList, setOpenInstrList] = useState(false);
  const [openInstrCards, setOpenInstrCards] = useState<Record<string, boolean>>({});
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
      tokenRef.current = session?.access_token || "";
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
    .map((i: any) => `${i.id}.${(i.title || "").length}.${(i.problems_text || "").length}.${(i.work_instruction_tasks || []).map((task: any) => `${task.id}:${(task.task_text || "").length}:${JSON.stringify(task.comments || task.employee_comment || "").length}`).join(",")}.${JSON.stringify(i.used_material || []).length}`)
    .join("|");
  useEffect(() => {
    uiLanguageRef.current = uiLanguage;
    if (workInstructions.length > 0) {
      refreshCommentTranslations(uiLanguage, workInstructions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentSignature, uiLanguage]);

  // Notizen der Abwesenheiten in die Anzeige-Sprache uebersetzen.
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      if (!companyFeatures?.absence_enabled || absences.length === 0) {
        setAbsTrans({});
        return;
      }
      const items = (absences as any[])
        .filter((a) => (a?.note || "").trim())
        .map((a) => ({ key: String(a.id), text: String(a.note) }));
      if (items.length === 0) { setAbsTrans({}); return; }
      let out: Record<string, string> = {};
      try {
        out = await translateBatch(items, "automatisch", uiLanguage);
      } catch { /* ohne Uebersetzung weiter */ }
      if (!abgebrochen) setAbsTrans(out);
    })();
    return () => { abgebrochen = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absences, uiLanguage, companyFeatures?.absence_enabled]);

  // Bestellungen (Bezeichnung + Notiz) in die Anzeige-Sprache uebersetzen.
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      if (!companyFeatures?.material_enabled || materialOrders.length === 0) {
        setOrderTrans({});
        return;
      }
      const items: { key: string; text: string }[] = [];
      for (const o of materialOrders as any[]) {
        if ((o?.name || "").trim()) items.push({ key: String(o.id), text: String(o.name) });
        if ((o?.note || "").trim()) items.push({ key: `n_${o.id}`, text: String(o.note) });
      }
      let out: Record<string, string> = {};
      try {
        out = await translateBatch(items, "automatisch", uiLanguage);
      } catch { /* ohne Uebersetzung weiter */ }
      if (!abgebrochen) setOrderTrans(out);
    })();
    return () => { abgebrochen = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialOrders, uiLanguage, companyFeatures?.material_enabled]);

  // Bezeichnungen der Geraete in die Anzeige-Sprache uebersetzen
  // (gespeichert bleibt immer das Original).
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      if (!companyFeatures?.equipment_enabled || equipment.length === 0) {
        setEqTrans({});
        return;
      }
      const items = equipment
        .filter((e: any) => (e?.name || "").trim())
        .map((e: any) => ({ key: String(e.id), text: String(e.name) }));
      let out: Record<string, string> = {};
      try {
        out = await translateBatch(items, "automatisch", uiLanguage);
      } catch { /* ohne Uebersetzung weiter */ }
      if (!abgebrochen) setEqTrans(out);
    })();
    return () => { abgebrochen = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment, uiLanguage, companyFeatures?.equipment_enabled]);

  // Vorschlaege fuer die Materialerfassung: immer in der eingestellten Sprache.
  // Der Katalog speichert die Originalbezeichnung; hier wird sie uebersetzt und
  // doppelte Eintraege (z. B. dieselbe Position in zwei Sprachen) werden zusammengefasst.
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      if (!companyFeatures?.material_enabled || materialCatalog.length === 0) {
        setCatalogSuggestions([]);
        setCatTrans({});
        return;
      }
      const items = materialCatalog
        .filter((m: any) => (m?.name || "").trim())
        .map((m: any) => ({ key: String(m.id), text: String(m.name) }));
      let out: Record<string, string> = {};
      try {
        out = await translateBatch(items, "automatisch", uiLanguage);
      } catch { /* ohne Uebersetzung weiter */ }
      if (abgebrochen) return;
      setCatTrans(out);
      const seen = new Map<string, { name: string; unit: string }>();
      for (const m of materialCatalog) {
        const orig = (m?.name || "").trim();
        if (!orig) continue;
        const name = (out[String(m.id)] || orig).trim();
        const key = name.toLowerCase();
        if (!seen.has(key)) seen.set(key, { name, unit: m.unit || "" });
      }
      setCatalogSuggestions(Array.from(seen.values()).sort((x, y) => x.name.localeCompare(y.name)));
    })();
    return () => { abgebrochen = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialCatalog, uiLanguage, companyFeatures?.material_enabled]);

  // Materialstamm laden, sobald das Modul freigeschaltet ist.
  useEffect(() => {
    if (companyFeatures?.material_enabled && currentCompany) { loadMaterialCatalog(); loadMaterialOrders(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFeatures?.material_enabled, currentCompany?.company_id]);

  // Live-Uebersetzer: Von-/Zu-Sprache auf die freigeschalteten Sprachen begrenzen.
  useEffect(() => {
    const allowed = getAllowedLanguages(companyFeatures).filter((l) => languages.includes(l as Language));
    if (allowed.length === 0) return;
    if (!allowed.includes(transFrom)) setTransFrom(allowed[0]);
    if (!allowed.includes(transTo)) { const alt = allowed.find((l) => l !== (allowed.includes(transFrom) ? transFrom : allowed[0])); setTransTo(alt || allowed[0]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFeatures]);

  // Gelbe Meldung nach 10 Sekunden automatisch ausblenden.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 10000);
    return () => clearTimeout(timer);
  }, [message]);

  const [companySlug, setCompanySlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function signIn() {
    setMessage("");
    if (!companySlug.trim()) { setMessage("Bitte Firmenkürzel eingeben."); return; }
    const loginEmail = `${companySlug.toLowerCase().trim()}.${username.toLowerCase().trim()}@regie-internal.app`;
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) { setMessage(t.msgLoginFail + error.message); return; }
    setMessage(t.msgLoginOk);
  }

  async function signOut() {
    // Zuerst die Oberflaeche abmelden – unabhaengig vom Netzwerk.
    // So klappt der Logout auch, wenn der Aufruf (v. a. auf dem Handy) haengt.
    setUser(null); newReport(); setSavedReports([]); setCompanyBlocked(false); setMessage(t.msgLogout);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch { /* ignorieren */ }
  }

  // Laedt alle Listen/Kontextdaten neu (ohne das aktive Formular anzutasten).
  async function refreshAll() {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      // Zuerst Sitzung/Token auffrischen – sonst haengen die Abfragen in der Handy-PWA
      // (blockierter Token-Refresh nach dem Wiederaufwecken) und liefern leere Daten.
      await ensureFreshSession();
      // Jeder Ladevorgang ist zeitlich begrenzt (max. 12s), damit der Knopf
      // bei einer haengenden Verbindung nicht ewig auf "Laden" stehen bleibt.
      await dbTimeout(loadCompanyContext(user.id), 12000);
      await dbTimeout(loadReportsFromDatabase(), 12000);
      await dbTimeout(loadCompanySettings(user.id), 12000);
    } catch { /* ignorieren */ } finally {
      // Wird IMMER ausgefuehrt -> der Aktualisieren-Knopf haengt nie dauerhaft.
      setRefreshing(false);
    }
  }

  // Automatisch neu laden, sobald der Tab/das Fenster wieder aktiv wird.
  useEffect(() => {
    function onActive() {
      if (document.visibilityState === "visible" && user?.id) {
        loadCompanyContext(user.id);
        loadReportsFromDatabase();
        loadCompanySettings(user.id);
      }
    }
    window.addEventListener("focus", onActive);
    document.addEventListener("visibilitychange", onActive);
    return () => {
      window.removeEventListener("focus", onActive);
      document.removeEventListener("visibilitychange", onActive);
    };
  }, [user?.id]);

  // Traegt automatisch den Namen des angemeldeten Benutzers ins Feld "Mitarbeiter" ein,
  // aber NUR wenn das Feld noch leer ist (eine vorhandene Eingabe wird nie ueberschrieben).
  useEffect(() => {
    if (!user?.id || companyUsers.length === 0) return;
    const me = companyUsers.find((m: any) => m.user_id === user.id);
    const name = me?.full_name || "";
    if (name) setEmployee((prev) => (prev && prev.trim() ? prev : name));
  }, [companyUsers, user?.id]);

  // Uebersetzt die Tages-Texte des Regieberichts automatisch in die Anzeige-Sprache (oben).
  // Laeuft NUR bei Sprachwechsel oder beim Laden/Uebertragen eines Berichts (reportVersion) –
  // NICHT bei jeder Eingabe. Nutzt den Cache, daher sparsam.
  useEffect(() => {
    let cancelled = false;
    const snapshot = days;
    const translateOne = async (raw: string): Promise<string> => {
      const text = (raw || "").trim();
      if (!text) return "";
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: text, fromLanguage: "automatisch", toLanguage: uiLanguage }) });
        const data = await res.json();
        if (data.error || !data.translation) return "";
        return data.translation.trim() === text ? "" : data.translation;
      } catch { return ""; }
    };
    (async () => {
      const results = await Promise.all(snapshot.map(async (day) => {
        const dayTrans = await translateOne(day.description);
        const extraTrans = await Promise.all((day.extra || []).map((ex) => translateOne(ex.description)));
        return { dayTrans, extraTrans };
      }));
      if (cancelled) return;
      setDays((prev) => prev.map((d, i) => {
        if (i >= results.length) return d;
        const { dayTrans, extraTrans } = results[i];
        const newExtra = (d.extra || []).map((ex, j) => ({ ...ex, translation: extraTrans[j] || "" }));
        return { ...d, translation: dayTrans, extra: d.extra && d.extra.length ? newExtra : d.extra };
      }));
    })();
    return () => { cancelled = true; };
  }, [uiLanguage, reportVersion]);

  async function loadCompanyContext(userId: string) {
    const { data: companyUser, error } = await supabase.from("company_users").select("company_id, role, preferred_language, read_only").eq("user_id", userId).maybeSingle();
    if (error) { setMessage("Fehler beim Laden der Firma: " + error.message); return; }
    if (!companyUser) { return; } // Kein Onboarding hier – wird in loadCompanySettings entschieden
    const { data: companyData, error: companyError } = await supabase.from("companies").select("id, name, slug, status").eq("id", companyUser.company_id).single();
    if (companyError) { setMessage("Fehler beim Laden der Firmendaten: " + companyError.message); return; }
    setCompanyBlocked((companyData.status || "active") !== "active");
    const company: CurrentCompany = { company_id: companyUser.company_id, role: companyUser.role, read_only: !!(companyUser as any).read_only, companies: { id: companyData.id, name: companyData.name, slug: companyData.slug || "" } };
    setCurrentCompany(company);
    const { data: features } = await supabase.from("company_features").select("*").eq("company_id", companyUser.company_id).maybeSingle();
    if (features) {
      setCompanyFeatures(features as CompanyFeatures);
      const allowed = Array.isArray(features.allowed_languages) ? features.allowed_languages : (typeof features.allowed_languages === "string" ? JSON.parse(features.allowed_languages) : []);
      const firstTarget = allowed.filter((l: string) => l !== "Deutsch")[0];
      if (firstTarget) { setInstructionToLanguage(firstTarget); setToLanguage(firstTarget); }
      const pref = (companyUser as any).preferred_language;
      if (pref && allowed.includes(pref) && languages.includes(pref as Language)) { setUiLanguage(pref as Language); }
    }
    await loadCompanyUsers(companyUser.company_id);
    await loadWorkInstructions(companyUser.company_id);
    await loadProjects(companyUser.company_id);
  }

  async function loadWorkInstructions(companyId: string) {
    const { data, error } = await supabase.from("work_instructions").select(`*, work_instruction_tasks (*)`).eq("company_id", companyId).order("created_at", { ascending: false });
    if (error) { setMessage("Fehler beim Laden der Arbeitsanweisungen: " + error.message); return; }
    let instrs: any[] = data || [];
    // Lesebestaetigungen SEPARAT laden – das Laden/Uebersetzen darf daran NICHT scheitern.
    try {
      const ids = instrs.map((i: any) => i.id);
      if (ids.length > 0) {
        const { data: reads } = await supabase.from("instruction_reads").select("instruction_id, user_id, read_at").in("instruction_id", ids);
        const byInst: Record<string, any[]> = {};
        for (const r of reads || []) { if (!byInst[r.instruction_id]) byInst[r.instruction_id] = []; byInst[r.instruction_id].push({ user_id: r.user_id, read_at: r.read_at }); }
        instrs = instrs.map((i: any) => ({ ...i, instruction_reads: byInst[i.id] || [] }));
      }
    } catch { /* Lesestatus optional */ }
    setWorkInstructions(instrs);
    // Vom Mitarbeiter erfasste Zeiten (eigene) laden
    if (user?.id) loadInstrTimes(companyId, user.id);
    // Kommentare in die aktuelle Anzeige-Sprache uebersetzen
    refreshCommentTranslations(uiLanguage, instrs);
  }

  // Eigenen Chat-Beitrag loeschen (die Route laesst nur eigene Beitraege zu).
  async function deleteTaskComment(taskId: string, commentId: string) {
    if (typeof window !== "undefined" && !window.confirm(t.commentDeleteAsk)) return;
    setCommentSaveState(prev => ({ ...prev, [taskId]: "saving" }));
    try {
      let token = tokenRef.current;
      if (!token) {
        try {
          const sess = await dbTimeout(supabase.auth.getSession(), 5000);
          token = sess?.data?.session?.access_token || "";
        } catch { /* Route antwortet dann mit 401 */ }
      }
      const res = await withTimeout(
        fetch("/api/update-task-comment", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ taskId, commentId, action: "delete" }),
        }),
        15000,
        "Zeitüberschreitung beim Löschen (15s). Bitte erneut versuchen."
      );
      const data = await res.json();
      if (!res.ok || data?.error) {
        const msg = data?.error || `HTTP ${res.status}`;
        setCommentSaveState(prev => ({ ...prev, [taskId]: "error:" + msg }));
        setMessage("Fehler beim Löschen: " + msg);
        return;
      }
      setCommentSaveState(prev => ({ ...prev, [taskId]: "saved" }));
      setWorkInstructions(prev => prev.map((inst: any) => ({
        ...inst,
        work_instruction_tasks: (inst.work_instruction_tasks || []).map((tk: any) =>
          tk.id === taskId ? { ...tk, comments: taskCommentList(tk).filter((c: any) => c.id !== commentId) } : tk
        ),
      })));
    } catch (e: any) {
      setCommentSaveState(prev => ({ ...prev, [taskId]: "error:" + String(e?.message || e) }));
    }
  }

  // Schluessel fuer die Uebersetzung einer Materialbezeichnung.
  function materialKey(name: string): string {
    return `mat_${(name || "").trim().toLowerCase()}`;
  }
  // Materialbezeichnung in der Anzeige-Sprache (faellt auf das Original zurueck).
  function getTranslatedMaterial(instructionId: string, name: string): string {
    const trans = instructionTranslations[instructionId];
    if (trans && trans.language === uiLanguage && trans.tasks?.[materialKey(name)]) return trans.tasks[materialKey(name)];
    return name || "";
  }

  // ── Urlaub & Abwesenheiten ──
  async function absencesCall(payload: any) {
    let token = tokenRef.current;
    if (!token) {
      try {
        const sess = await dbTimeout(supabase.auth.getSession(), 5000);
        token = sess?.data?.session?.access_token || "";
      } catch { /* Route antwortet dann mit 401 */ }
    }
    const res = await fetch("/api/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => ({ error: "Antwort konnte nicht gelesen werden." }));
  }
  async function loadAbsences() {
    try {
      const data = await absencesCall({ action: "list" });
      if (Array.isArray(data?.items)) setAbsences(data.items);
    } catch { /* still ignorieren */ }
  }
  async function createAbsence() {
    if (!absDraft.start) { setMessage(t.msgFillRequired); return; }
    setAbsSaving(true);
    try {
      const data = await absencesCall({ action: "create", type: absDraft.type, startDate: absDraft.start, endDate: absDraft.end || absDraft.start, note: absDraft.note });
      if (data?.error) { setMessage("Fehler: " + data.error); return; }
      setAbsDraft({ type: "vacation", start: "", end: "", note: "" });
      await loadAbsences();
      setMessage("\u2705 " + t.msgSaved);
    } finally {
      setAbsSaving(false);
    }
  }
  async function decideAbsence(id: string, status: string, reason?: string) {
    const data = await absencesCall({ action: "decide", id, status, reason });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    setAbsences(prev => prev.map((a: any) => (a.id === id ? { ...a, status, reject_reason: status === "rejected" ? (reason || "") : null } : a)));
    setRejectingId(null); setRejectReasonDraft("");
  }
  async function deleteAbsence(id: string) {
    const data = await absencesCall({ action: "delete", id });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    setAbsences(prev => prev.filter((a: any) => a.id !== id));
  }
  // Anzahl Kalendertage einer Abwesenheit.
  function absenceDayCount(a: any): number {
    if (!a?.start_date || !a?.end_date) return 0;
    const from = new Date(a.start_date + "T00:00:00Z").getTime();
    const to = new Date(a.end_date + "T00:00:00Z").getTime();
    if (!from || !to || to < from) return 1;
    return Math.round((to - from) / 86400000) + 1;
  }

  // ── Fahrzeuge & Werkzeuge ──
  async function equipmentCall(payload: any) {
    let token = tokenRef.current;
    if (!token) {
      try {
        const sess = await dbTimeout(supabase.auth.getSession(), 5000);
        token = sess?.data?.session?.access_token || "";
      } catch { /* Route antwortet dann mit 401 */ }
    }
    const res = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => ({ error: "Antwort konnte nicht gelesen werden." }));
  }
  async function loadEquipment() {
    try {
      const data = await equipmentCall({ action: "list" });
      if (Array.isArray(data?.items)) setEquipment(data.items);
    } catch { /* still ignorieren */ }
  }
  async function saveEquipment() {
    if (!eqDraft.name.trim()) { setMessage(t.msgFillRequired); return; }
    const data = await equipmentCall({ action: "save", id: eqDraft.id || undefined, type: eqDraft.type, name: eqDraft.name.trim(), identifier: eqDraft.identifier, note: eqDraft.note });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    setEqDraft({ id: "", type: "tool", name: "", identifier: "", note: "" });
    await loadEquipment();
    setMessage("\u2705 " + t.msgSaved);
  }
  async function deleteEquipment(id: string) {
    const data = await equipmentCall({ action: "delete", id });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    await loadEquipment();
  }
  async function assignEquipment(id: string, userId: string, note?: string) {
    const data = await equipmentCall({ action: "assign", id, userId: userId || null, note: note || "" });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    await loadEquipment();
    if (eqOpenId === id) await loadEquipmentHistory(id);
  }
  // Rueckgabe mit Nachfrage nach Beschaedigung/Besonderheit.
  function requestReturn(eq: any) {
    setReturnNote("");
    setReturnKind("none");
    setReturnTarget({ id: eq.id, name: eqTrans[eq.id] || eq.name || "" });
  }
  async function confirmReturn() {
    const tgt = returnTarget;
    if (!tgt) return;
    const txt = returnNote.trim();
    // Sprachneutral speichern: fester Code + optionaler Freitext. Das Label wird
    // beim Anzeigen in der jeweiligen Sprache gerendert (keine KI-Uebersetzung noetig).
    let note = "";
    if (returnKind === "none") note = "#none";
    else if (returnKind === "damage") note = txt ? `#damage:${txt}` : "#damage";
    else note = txt ? `#other:${txt}` : "#other";
    await assignEquipment(tgt.id, "", note);
    setReturnTarget(null);
    setReturnNote("");
    setReturnKind("none");
  }
  // Monats-CSV je Kategorie (Fahrzeug/Werkzeug) aus den Nutzungs-Zeitraeumen.
  async function downloadEquipmentCsv(kind: "vehicle" | "tool") {
    const data = await equipmentCall({ action: "report" });
    const periods: any[] = Array.isArray(data?.periods) ? data.periods : [];
    const nowIso = new Date().toISOString();
    const rows = periods
      .filter((p) => (p.type || "tool") === kind)
      .filter((p) => String(p.end || nowIso).slice(0, 7) === eqReportMonth)
      .filter((p) => !eqReportWeek || getCalendarWeek(String(p.end || nowIso).slice(0, 10)) === eqReportWeek)
      .sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
    if (rows.length === 0) { setMessage(t.exportEmpty); return; }
    const clean = (v: any) => String(v ?? "").replace(/;/g, ",").replace(/[\r\n]+/g, " ");
    const fmtDate = (x: any) => (x ? new Date(x).toLocaleDateString("de-DE") : "");
    const durDays = (p: any) => {
      if (!p.start) return "";
      const end = p.end ? new Date(p.end).getTime() : Date.now();
      return csvNum(Math.max(0, (end - new Date(p.start).getTime()) / 86400000), 1);
    };
    // Rueckgabe-Notiz mit lokalisiertem Label ausgeben.
    const fmtDamage = (raw: any) => {
      const pp = parseReturnNote(String(raw || ""));
      if (pp.kind === "legacy") return pp.free;
      const label = pp.kind === "none" ? tx.returnNoDamage : pp.kind === "damage" ? tx.returnDamage : tx.returnOther;
      return pp.free ? `${label}: ${pp.free}` : label;
    };
    const isVeh = kind === "vehicle";
    const head = (isVeh
      ? [t.equipmentVehicle, t.equipmentIdentifier, t.employee, tx.colFrom, tx.colTo, tx.colDuration, t.km, tx.colDamage]
      : [t.equipmentTool, t.equipmentIdentifier, t.employee, tx.colFrom, tx.colTo, tx.colDuration, tx.colDamage]
    ).join(";");
    const lines = rows.map((p) => {
      const base = [clean(p.name), clean(p.identifier), clean(p.employee), fmtDate(p.start), p.ongoing ? tx.colOngoing : fmtDate(p.end), durDays(p)];
      return (isVeh ? [...base, p.km != null ? csvNum(p.km, 1) : "", clean(fmtDamage(p.damage))] : [...base, clean(fmtDamage(p.damage))]).join(";");
    });
    const csv = "\ufeff" + [head, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${isVeh ? "Fahrzeuge" : "Werkzeug"}_${eqReportMonth}${eqReportWeek ? "_" + eqReportWeek.replace(/\s+/g, "") : ""}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  async function loadEquipmentHistory(id: string) {
    const data = await equipmentCall({ action: "history", id });
    if (Array.isArray(data?.history)) {
      setEqHistory(prev => ({ ...prev, [id]: data.history }));
      // Verlaufs-Notizen in die Anzeige-Sprache uebersetzen.
      // Feste Auswahl (keine Beschaedigung/Beschaedigung/Sonstiges) wird NICHT per KI
      // uebersetzt (Label kommt aus EXTRA_LABELS) – nur Freitext und km-Notizen.
      try {
        const items = (data.history as any[])
          .filter((h) => h?.note && String(h.note).trim())
          .map((h) => {
            if (h.action === "km") return { key: String(h.id), text: String(h.note) };
            const p = parseReturnNote(String(h.note));
            const free = p.kind === "legacy" ? p.free : p.free;
            return free ? { key: String(h.id), text: free } : null;
          })
          .filter(Boolean) as { key: string; text: string }[];
        if (items.length > 0) {
          const out = await translateBatch(items, "automatisch", uiLanguage);
          setEqHistTrans(prev => ({ ...prev, ...out }));
        }
      } catch { /* ohne Uebersetzung weiter */ }
    }
  }
  async function toggleEquipmentHistory(id: string) {
    if (eqOpenId === id) { setEqOpenId(null); return; }
    setEqOpenId(id);
    await loadEquipmentHistory(id);
  }
  // ── Geraete-Planung ──
  async function loadEquipmentPlans() {
    try {
      const data = await equipmentCall({ action: "plan_list" });
      if (Array.isArray(data?.plans)) setEqPlans(data.plans);
    } catch { /* still */ }
  }
  async function savePlan(force = false) {
    const d = eqPlanDraft;
    if (!d.equipmentId || !d.userId || !d.dateFrom || !d.dateTo) { setMessage(t.msgFillRequired); return; }
    setEqPlanSaving(true);
    try {
      const data = await equipmentCall({
        action: "plan_save",
        id: d.id || undefined,
        equipmentId: d.equipmentId, userId: d.userId,
        dateFrom: d.dateFrom, dateTo: d.dateTo, note: d.note,
        force,
      });
      if (data?.conflict) { setEqPlanConflict(data.conflicts || []); return; }
      if (data?.error) { setMessage(data.error); return; }
      setEqPlanConflict(null);
      setEqPlanDraft({ id: "", equipmentId: "", userId: "", dateFrom: "", dateTo: "", note: "" });
      await loadEquipmentPlans();
      await loadEquipment();
    } finally {
      setEqPlanSaving(false);
    }
  }
  async function deletePlan(id: string) {
    const data = await equipmentCall({ action: "plan_delete", id });
    if (data?.error) { setMessage(data.error); return; }
    if (eqPlanDraft.id === id) setEqPlanDraft({ id: "", equipmentId: "", userId: "", dateFrom: "", dateTo: "", note: "" });
    await loadEquipmentPlans();
  }
  // km fuer ein (zugewiesenes) Fahrzeug speichern – durch den Mitarbeiter oder Chefs.
  // Freies Geraet selbst uebernehmen (Server weist dem angemeldeten Konto zu).
  async function takeSelf(id: string) {
    const data = await equipmentCall({ action: "take_self", id });
    if (data?.error) { setMessage(data.error); return; }
    await loadEquipment();
  }
  // Teil-Update: nur die uebergebenen km-Felder speichern (Start jetzt, Ende spaeter).
  async function setKm(id: string, patch: { startKm?: string; endKm?: string }) {
    const data = await equipmentCall({ action: "set_km", id, ...patch });
    if (data?.error) { setMessage(data.error); return; }
    setEqKmDraft((prev) => { const n = { ...prev }; delete n[id]; return n; });
    await loadEquipment();
  }

  // ── Stundenexport: Monatssummen je Mitarbeiter ──
  function monthlyHourSummary(month: string) {
    const rows: Record<string, { name: string; days: number; hours: number; travelMin: number; km: number }> = {};
    const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
    for (const r of teamReports as any[]) {
      const name = String(r?.employee || "").trim() || "?";
      for (const d of (r?.days || [])) {
        if (!d?.date || !String(d.date).startsWith(month)) continue;
        // Haupt- + Zusatzeintraege zusammenfassen (Tag zaehlt aber nur einmal).
        let h = 0, tm = 0, km = 0;
        for (const it of dayLineItems(d)) {
          h += parseHours(String(it.hours || ""));
          tm += travelMinutes(it.travelOutStart, it.travelOutEnd) + travelMinutes(it.travelReturnStart, it.travelReturnEnd);
          km += num(it.travelOutKm) + num(it.travelReturnKm);
        }
        if (h === 0 && tm === 0 && km === 0) continue;
        const key = name.toLowerCase();
        if (!rows[key]) rows[key] = { name, days: 0, hours: 0, travelMin: 0, km: 0 };
        if (h > 0) rows[key].days += 1;
        rows[key].hours += h;
        rows[key].travelMin += tm;
        rows[key].km += km;
      }
    }
    return Object.values(rows).sort((x, y) => x.name.localeCompare(y.name));
  }
  // Einzelne Tage je Mitarbeiter (Tag fuer Tag).
  function monthlyHourDetail(month: string, week?: string) {
    const num = (v: any) => Number(String(v ?? "").replace(",", ".")) || 0;
    const rows: any[] = [];
    for (const r of teamReports as any[]) {
      const name = String(r?.employee || "").trim() || "?";
      for (const d of (r?.days || [])) {
        if (!d?.date || !String(d.date).startsWith(month)) continue;
        if (week && getCalendarWeek(String(d.date)) !== week) continue;
        // Jede Position (Haupt- + Zusatzeintrag) als eigene Zeile.
        for (const it of dayLineItems(d)) {
          const h = parseHours(String(it.hours || ""));
          const tm = travelMinutes(it.travelOutStart, it.travelOutEnd) + travelMinutes(it.travelReturnStart, it.travelReturnEnd);
          const km = num(it.travelOutKm) + num(it.travelReturnKm);
          if (h === 0 && tm === 0 && km === 0) continue;
          rows.push({
            name,
            date: String(d.date),
            customer: String(it.customer || ""),
            project: String(it.projectNumber || ""),
            site: String(it.site || ""),
            start: String(it.startTime || ""),
            end: String(it.endTime || ""),
            pause: String(it.breakMinutes || ""),
            hours: h,
            travelMin: tm,
            km,
            desc: String(it.description || ""),
          });
        }
      }
    }
    return rows.sort((x, y) => x.name.localeCompare(y.name) || x.date.localeCompare(y.date));
  }
  // Tage nach Mitarbeiter gruppiert (fuer die Anzeige).
  function monthlyHoursByEmployee(month: string, week?: string) {
    const detail = monthlyHourDetail(month, week);
    const groups: Record<string, { name: string; days: any[]; hours: number; travelMin: number; km: number }> = {};
    for (const row of detail) {
      const key = row.name.toLowerCase();
      if (!groups[key]) groups[key] = { name: row.name, days: [], hours: 0, travelMin: 0, km: 0 };
      groups[key].days.push(row);
      groups[key].hours += row.hours;
      groups[key].travelMin += row.travelMin;
      groups[key].km += row.km;
    }
    return Object.values(groups).sort((x, y) => x.name.localeCompare(y.name));
  }
  // Tage nach Projekt gruppiert (alle Mitarbeiter zusammen) – fuer den Projekt-CSV-Export.
  function monthlyHoursByProject(month: string, week?: string) {
    const detail = monthlyHourDetail(month, week);
    const groups: Record<string, { project: string; customer: string; days: any[]; hours: number; travelMin: number; km: number }> = {};
    for (const row of detail) {
      const projName = String(row.project || "").trim();
      const label = projName || String(row.customer || "").trim() || "—";
      const key = label.toLowerCase();
      if (!groups[key]) groups[key] = { project: label, customer: String(row.customer || ""), days: [], hours: 0, travelMin: 0, km: 0 };
      groups[key].days.push(row);
      groups[key].hours += row.hours;
      groups[key].travelMin += row.travelMin;
      groups[key].km += row.km;
    }
    // Innerhalb eines Projekts nach Mitarbeiter, dann Datum sortieren.
    for (const g of Object.values(groups)) {
      g.days.sort((x: any, y: any) => String(x.name).localeCompare(String(y.name)) || String(x.date).localeCompare(String(y.date)));
    }
    return Object.values(groups).sort((x, y) => x.project.localeCompare(y.project));
  }

  // Welche Kalenderwochen kommen im gewaehlten Monat vor?
  function weeksInMonth(month: string): string[] {
    const set = new Set<string>();
    for (const row of monthlyHourDetail(month)) {
      const wk = getCalendarWeek(row.date);
      if (wk) set.add(wk);
    }
    return Array.from(set).sort((a2, b2) => Number(a2.replace(/\D/g, "")) - Number(b2.replace(/\D/g, "")));
  }
  // Alle Kalenderwochen, die der Monat beruehrt (datenunabhaengig) – fuer den Geraete-Export.
  function calendarWeeksOfMonth(month: string): string[] {
    if (!month) return [];
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return [];
    const days = new Date(y, m, 0).getDate();
    const set = new Set<string>();
    for (let d = 1; d <= days; d++) {
      const wk = getCalendarWeek(`${month}-${String(d).padStart(2, "0")}`);
      if (wk) set.add(wk);
    }
    return Array.from(set).sort((a2, b2) => Number(a2.replace(/\D/g, "")) - Number(b2.replace(/\D/g, "")));
  }

  // Zahl im deutschen Format (Komma) fuer Excel.
  function csvNum(n: number, digits = 2): string {
    return (Math.round(n * 100) / 100).toFixed(digits).replace(".", ",");
  }
  function downloadHoursCsv(nurMitarbeiter?: string) {
    const alle = monthlyHoursByEmployee(exportMonth, exportWeek || undefined);
    const gruppen = nurMitarbeiter ? alle.filter((g) => g.name === nurMitarbeiter) : alle;
    if (gruppen.length === 0) { setMessage(t.exportEmpty); return; }
    const clean = (v: any) => String(v ?? "").replace(/;/g, ",").replace(/[\r\n]+/g, " ");
    const head = [t.employee, t.date, t.customer, t.projectNumber, t.site, t.startTime, t.endTime, t.breakLabel, t.hours, `${t.travelTime} (h)`, t.km].join(";");
    const lines: string[] = [];
    let gesamt = { hours: 0, travelMin: 0, km: 0, days: 0 };
    for (const g of gruppen) {
      for (const d2 of g.days) {
        lines.push([
          clean(g.name), clean(d2.date), clean(d2.customer), clean(d2.project), clean(d2.site),
          clean(d2.start), clean(d2.end), clean(d2.pause),
          csvNum(d2.hours), csvNum(d2.travelMin / 60), csvNum(d2.km, 1),
        ].join(";"));
      }
      // Zwischensumme je Mitarbeiter
      lines.push([clean(g.name), `${t.total} (${g.days.length} ${t.exportDays})`, "", "", "", "", "", "", csvNum(g.hours), csvNum(g.travelMin / 60), csvNum(g.km, 1)].join(";"));
      lines.push("");
      gesamt = { hours: gesamt.hours + g.hours, travelMin: gesamt.travelMin + g.travelMin, km: gesamt.km + g.km, days: gesamt.days + g.days.length };
    }
    if (gruppen.length > 1) lines.push([t.total, `${gesamt.days} ${t.exportDays}`, "", "", "", "", "", "", csvNum(gesamt.hours), csvNum(gesamt.travelMin / 60), csvNum(gesamt.km, 1)].join(";"));
    // BOM, damit Excel Umlaute richtig anzeigt
    const csv = "\ufeff" + [head, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const wer = nurMitarbeiter ? "_" + nurMitarbeiter.replace(/[^\wÄÖÜäöüß.-]+/g, "_") : "";
    a.download = `Stunden${wer}_${exportMonth}${exportWeek ? "_" + exportWeek.replace(/\s+/g, "") : ""}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  // CSV nach Projekt gruppiert – alle Mitarbeiter zusammen, inkl. Taetigkeit.
  async function downloadProjectCsv() {
    let gruppen = monthlyHoursByProject(exportMonth, exportWeek || undefined);
    // Nur das gewaehlte Projekt (leer = alle).
    if (exportProject) gruppen = gruppen.filter((g) => g.project === exportProject);
    if (gruppen.length === 0) { setMessage(t.exportEmpty); return; }

    // Taetigkeiten in die eingestellte Sprache uebersetzen (Auto-Spracherkennung + Server-Cache).
    let descMap: Record<string, string> = {};
    const uniqueDescs = Array.from(new Set(
      gruppen.flatMap((g) => g.days.map((d2: any) => String(d2.desc || "").trim())).filter(Boolean)
    ));
    if (uniqueDescs.length > 0) {
      setMessage(tx.exportTranslating);
      try {
        descMap = await translateBatch(uniqueDescs.map((d) => ({ key: d, text: d })), "automatisch", uiLanguage);
      } catch { /* ohne Uebersetzung weiter */ }
      setMessage("");
    }
    const transDesc = (s: any) => { const k = String(s || "").trim(); return k ? (descMap[k] || k) : ""; };

    const clean = (v: any) => String(v ?? "").replace(/;/g, ",").replace(/[\r\n]+/g, " ");
    const head = [t.projectNumber, t.customer, t.employee, t.date, t.site, t.hours, `${t.travelTime} (h)`, t.km, t.description].join(";");
    const lines: string[] = [];
    let gesamt = { hours: 0, travelMin: 0, km: 0, days: 0 };
    for (const g of gruppen) {
      for (const d2 of g.days) {
        lines.push([
          clean(g.project), clean(d2.customer), clean(d2.name), clean(d2.date), clean(d2.site),
          csvNum(d2.hours), csvNum(d2.travelMin / 60), csvNum(d2.km, 1), clean(transDesc(d2.desc)),
        ].join(";"));
      }
      // Zwischensumme je Projekt
      lines.push([`${clean(g.project)} — ${t.total}`, "", "", `${g.days.length} ${t.exportDays}`, "", csvNum(g.hours), csvNum(g.travelMin / 60), csvNum(g.km, 1), ""].join(";"));
      lines.push("");
      gesamt = { hours: gesamt.hours + g.hours, travelMin: gesamt.travelMin + g.travelMin, km: gesamt.km + g.km, days: gesamt.days + g.days.length };
    }
    if (gruppen.length > 1) lines.push([t.total, "", "", `${gesamt.days} ${t.exportDays}`, "", csvNum(gesamt.hours), csvNum(gesamt.travelMin / 60), csvNum(gesamt.km, 1), ""].join(";"));
    const csv = "\ufeff" + [head, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const projTag = exportProject ? "_" + exportProject.replace(/[^\wÄÖÜäöüß.-]+/g, "_") : "";
    a.download = `Projekte${projTag}_${exportMonth}${exportWeek ? "_" + exportWeek.replace(/\s+/g, "") : ""}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Materialbestellungen ──
  async function ordersCall(payload: any) {
    let token = tokenRef.current;
    if (!token) {
      try {
        const sess = await dbTimeout(supabase.auth.getSession(), 5000);
        token = sess?.data?.session?.access_token || "";
      } catch { /* Route antwortet dann mit 401 */ }
    }
    const res = await fetch("/api/material-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => ({ error: "Antwort konnte nicht gelesen werden." }));
  }
  async function loadMaterialOrders() {
    try {
      const data = await ordersCall({ action: "list" });
      if (Array.isArray(data?.orders)) setMaterialOrders(data.orders);
    } catch { /* still ignorieren */ }
  }
  async function createOrder(instructionId: string) {
    const d = orderDraft[instructionId] || { qty: "", unit: MATERIAL_UNITS[0], name: "", note: "" };
    if (!d.name.trim()) { setMessage(t.msgFillRequired); return; }
    setOrderSaving(instructionId);
    try {
      const data = await ordersCall({ action: "create", instructionId, qty: d.qty, unit: d.unit, name: d.name.trim(), note: d.note });
      if (data?.error) { setMessage("Fehler: " + data.error); return; }
      setOrderDraft(prev => ({ ...prev, [instructionId]: { qty: "", unit: d.unit || MATERIAL_UNITS[0], name: "", note: "" } }));
      await loadMaterialOrders();
      setMessage("\u2705 " + t.msgSaved);
    } finally {
      setOrderSaving(null);
    }
  }
  async function setOrderStatus(id: string, status: string) {
    const data = await ordersCall({ action: "status", id, status });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    setMaterialOrders(prev => prev.map((o: any) => (o.id === id ? { ...o, status } : o)));
  }
  async function deleteOrder(id: string) {
    const data = await ordersCall({ action: "delete", id });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    setMaterialOrders(prev => prev.filter((o: any) => o.id !== id));
  }
  function orderStatusLabel(st: string): string {
    return st === "ordered" ? t.orderOrdered : st === "delivered" ? t.orderDelivered : t.orderOpen;
  }

  // ── Materialstamm (gespeichertes Material einer Firma) ──
  async function catalogCall(payload: any) {
    let token = tokenRef.current;
    if (!token) {
      try {
        const sess = await dbTimeout(supabase.auth.getSession(), 5000);
        token = sess?.data?.session?.access_token || "";
      } catch { /* Route antwortet dann mit 401 */ }
    }
    const res = await fetch("/api/material-catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => ({ error: "Antwort konnte nicht gelesen werden." }));
  }
  async function loadMaterialCatalog() {
    try {
      const data = await catalogCall({ action: "list" });
      if (Array.isArray(data?.items)) setMaterialCatalog(data.items);
    } catch { /* still ignorieren */ }
  }
  async function saveCatalogItem() {
    if (!catDraft.name.trim()) { setMessage(t.msgFillRequired); return; }
    const data = await catalogCall({ action: "save", id: catDraft.id || undefined, name: catDraft.name.trim(), unit: catDraft.unit });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    setCatDraft({ id: "", name: "", unit: MATERIAL_UNITS[0] });
    await loadMaterialCatalog();
    setMessage("\u2705 " + t.msgSaved);
  }
  async function deleteCatalogItem(id: string) {
    const data = await catalogCall({ action: "delete", id });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    await loadMaterialCatalog();
  }
  // Einheit aus dem Materialstamm zu einer Bezeichnung finden.
  function unitForMaterial(name: string): string {
    const key = (name || "").trim().toLowerCase();
    const hit = catalogSuggestions.find((m) => m.name.toLowerCase() === key)
      || materialCatalog.find((m: any) => (m.name || "").toLowerCase() === key);
    return hit?.unit || "";
  }

  // ── Verbrauchtes Material (Modul: material_enabled) ──
  function usedMaterialList(inst: any): any[] {
    return Array.isArray(inst?.used_material) ? inst.used_material : [];
  }
  async function saveUsedMaterial(instructionId: string, list: any[]): Promise<boolean> {
    setMatSaving(instructionId);
    try {
      let token = tokenRef.current;
      if (!token) {
        try {
          const sess = await dbTimeout(supabase.auth.getSession(), 5000);
          token = sess?.data?.session?.access_token || "";
        } catch { /* Route antwortet dann mit 401 */ }
      }
      const res = await withTimeout(
        fetch("/api/update-material", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ instructionId, material: list }),
        }),
        15000,
        "Zeitüberschreitung beim Speichern (15s). Bitte erneut versuchen."
      );
      const data = await res.json();
      if (!res.ok || data?.error) {
        setMessage("Fehler: " + (data?.error || `HTTP ${res.status}`));
        return false;
      }
      setWorkInstructions(prev => prev.map((i: any) => (i.id === instructionId ? { ...i, used_material: list } : i)));
      return true;
    } catch (e: any) {
      setMessage("Fehler beim Speichern: " + String(e?.message || e));
      return false;
    } finally {
      setMatSaving(null);
    }
  }
  async function addMaterial(instruction: any) {
    const d = matDraft[instruction.id] || { qty: "", unit: MATERIAL_UNITS[0], name: "" };
    if (!String(d.qty).trim() || !d.name.trim()) { setMessage(t.msgFillRequired); return; }
    const list = [...usedMaterialList(instruction), { qty: String(d.qty).trim(), unit: d.unit || MATERIAL_UNITS[0], name: d.name.trim(), by: myDisplayName(), at: new Date().toISOString() }];
    const ok = await saveUsedMaterial(instruction.id, list);
    if (ok) {
      setMatDraft(prev => ({ ...prev, [instruction.id]: { qty: "", unit: d.unit || MATERIAL_UNITS[0], name: "" } }));
      loadMaterialCatalog();
    }
  }
  async function removeMaterial(instruction: any, idx: number) {
    const list = usedMaterialList(instruction).filter((_: any, i: number) => i !== idx);
    await saveUsedMaterial(instruction.id, list);
  }

  async function updateTaskComment(taskId: string, comment: string, commentId?: string) {
    setCommentSaveState(prev => ({ ...prev, [taskId]: "saving" }));
    try {
      // Token aus dem Auth-Listener nehmen (nicht getSession(), das kann unter Last haengen).
      let token = tokenRef.current;
      if (!token) {
        try {
          const s = await dbTimeout(supabase.auth.getSession(), 5000);
          token = s?.data?.session?.access_token || "";
        } catch { /* Fallback: ohne Token antwortet die Route mit 401 statt zu haengen */ }
      }
      // Speichern über Server-Route (Service-Role-Key) -> umgeht RLS, prüft aber Anmeldung + Rolle.
      const res = await withTimeout(
        fetch("/api/update-task-comment", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ taskId, comment, lang: uiLanguage, commentId: commentId || undefined }),
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
      setMessage(t.msgCommentSavedOk);
      // Getippten Kommentar sofort anzeigen. Das Speichern wird NICHT von einer
      // Uebersetzung blockiert; die Anzeige-Uebersetzung laeuft spaeter nicht-blockierend
      // ueber refreshCommentTranslations (beim Neuladen).
      // Chat: Eingabefeld leeren (neuer Beitrag). Privat: eigener Text bleibt im Feld stehen.
      setTaskComments(prev => ({ ...prev, [taskId]: chatOn ? "" : comment }));
      setEditingCommentId(prev => { const n = { ...prev }; delete n[taskId]; return n; });
      const myName = myDisplayName();
      setWorkInstructions(prev => prev.map((inst: any) => ({
        ...inst,
        work_instruction_tasks: (inst.work_instruction_tasks || []).map((tk: any) => {
          if (tk.id !== taskId) return tk;
          const list = taskCommentList(tk);
          if (commentId) {
            // Bearbeiteten Beitrag ersetzen (oder entfernen, wenn geleert)
            const next = comment.trim()
              ? list.map((c: any) => (c.id === commentId ? { ...c, text: comment, lang: uiLanguage, edited_at: new Date().toISOString() } : c))
              : list.filter((c: any) => c.id !== commentId);
            return { ...tk, comments: next };
          }
          const base = chatOn ? list : list.filter((c: any) => !isMyComment(c));
          const entry = { id: `local-${Date.now()}`, user_id: user?.id, name: myName, text: comment, lang: uiLanguage, at: new Date().toISOString() };
          const next = comment.trim() ? [...base, entry] : base;
          return { ...tk, comments: next };
        }),
      })));
    } catch (err: any) {
      setCommentSaveState(prev => ({ ...prev, [taskId]: "error:" + String(err?.message || err) }));
      setMessage("Fehler beim Speichern: " + String(err?.message || err));
      return;
    }
    // KEIN Neuladen nach dem Speichern: das Neuladen loeste eine erneute Uebersetzungsrunde
    // aus, die die bereits angezeigte Uebersetzung der Anweisung zuruecksetzte (alles wieder
    // deutsch). Der Kommentar ist lokal sichtbar (taskComments) und in der DB gespeichert;
    // beim naechsten regulaeren Laden ist alles konsistent.
  }

  // Holt aktuelles Wetter + Ort am GPS-Standort und gibt eine fertige Textzeile in der Anzeige-Sprache zurueck.
  async function fetchWeatherLine(): Promise<string | null> {
    const pos = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false });
    });
    if (!pos) { setMessage(t.weatherError); return null; }
    const lat = pos.coords.latitude.toFixed(4);
    const lon = pos.coords.longitude.toFixed(4);
    let data: any;
    try {
      const res = await withTimeout(fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code,wind_speed_10m`), 10000, "Wetter-Timeout");
      data = await res.json();
    } catch { setMessage(t.weatherError); return null; }
    const c = data?.current;
    if (!c) { setMessage(t.weatherError); return null; }
    const lang2map: Record<string, string> = { Deutsch:"de", Rumänisch:"ro", Englisch:"en", Italienisch:"it", Türkisch:"tr", Ungarisch:"hu", Tschechisch:"cs", Ukrainisch:"uk", Bulgarisch:"bg", Serbisch:"sr", Kroatisch:"hr", Slowenisch:"sl", Polnisch:"pl" };
    const loc2 = lang2map[uiLanguage] || "de";
    let ort = "";
    try {
      const geo = await withTimeout(fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${loc2}`), 8000, "Geo-Timeout");
      const gd = await geo.json();
      ort = gd?.city || gd?.locality || gd?.principalSubdivision || "";
    } catch { /* Ort ist optional */ }
    const temp = Math.round(Number(c.temperature_2m));
    const wind = Math.round(Number(c.wind_speed_10m));
    const prec = Number(c.precipitation ?? 0);
    const cond = wmoLocalizedText(Number(c.weather_code), uiLanguage);
    const now = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    const stamp = `${p2(now.getDate())}.${p2(now.getMonth() + 1)}., ${p2(now.getHours())}:${p2(now.getMinutes())}`;
    const line = `${t.weather}${ort ? " " + ort : ""} (${stamp}): ${temp} °C, ${cond}, 💨 ${wind} km/h, 🌧️ ${prec} mm`;
    return line;
  }

  // Wetter in einen Arbeitsanweisungs-Kommentar einfuegen.
  async function insertWeatherIntoComment(taskId: string, currentVal: string) {
    setMessage(t.weather + " …");
    const line = await fetchWeatherLine();
    if (!line) return;
    const base = currentVal || "";
    const sep = base && !base.endsWith("\n") ? "\n" : "";
    setTaskComments(prev => ({ ...prev, [taskId]: (base + sep + line).slice(0, 1000) }));
    setCommentSaveState(prev => ({ ...prev, [taskId]: "" }));
    setMessage("");
  }

  // Wetter in den Tagestext des Regieberichts einfuegen.
  async function insertWeatherIntoDay(index: number, currentDesc: string) {
    setMessage(t.weather + " …");
    const line = await fetchWeatherLine();
    if (!line) return;
    const base = currentDesc || "";
    const sep = base && !base.endsWith("\n") ? "\n" : "";
    updateDay(index, "description", base + sep + line);
    setMessage("");
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
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPassword.trim()) { setMessage(t.msgFillRequired); return; }
    if (newUserPassword.length < 8) { setMessage("Passwort muss mindestens 8 Zeichen haben."); return; }
    if (!newUserNationality.trim() || !newUserPhone.trim()) { setMessage("Nationalität und Telefonnummer sind Pflicht."); return; }
    setCreatingEmployee(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || "";
    const res = await fetch("/api/create-employee", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ username: newUserUsername, password: newUserPassword, fullName: newUserName, role: newUserRole, companyId: currentCompany.company_id, companySlug: currentCompany.companies.slug, preferredLanguage: newUserLanguage, nationality: newUserNationality, phone: newUserPhone, readOnly: newUserReadOnly }) });
    const data = await res.json();
    setCreatingEmployee(false);
    if (data.error) { setMessage("Fehler: " + data.error); return; }
    setNewUserName(""); setNewUserEmail(""); setNewUserUsername(""); setNewUserPassword(""); setNewUserRole("employee"); setNewUserLanguage("Deutsch"); setNewUserNationality(""); setNewUserPhone(""); setNewUserReadOnly(false);
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
    setMessage(t.msgEmployeeDeleted);
  }

  function canDelete(myRole: string, memberRole: string): boolean {
    if (myRole === "owner") return memberRole !== "owner";
    if (myRole === "admin") return memberRole === "employee" || memberRole === "project_manager";
    if (myRole === "project_manager") return memberRole === "employee";
    return false;
  }

  // Wer darf wen BEARBEITEN? Owner -> jeden, Admin -> PL/Mitarbeiter, PL -> Mitarbeiter.
  function canManageMember(myRole: string, memberRole: string): boolean {
    if (myRole === "owner") return true;
    if (myRole === "admin") return memberRole === "employee" || memberRole === "project_manager";
    if (myRole === "project_manager") return memberRole === "employee";
    return false;
  }
  // Welche Rollen darf die eigene Rolle vergeben?
  function settableRoles(myRole: string): string[] {
    if (myRole === "owner") return ["owner", "admin", "project_manager", "employee"];
    if (myRole === "admin") return ["project_manager", "employee"];
    if (myRole === "project_manager") return ["employee"];
    return [];
  }
  const roleLabel = (r: string) => r === "owner" ? "Owner" : r === "admin" ? t.roleAdmin : r === "project_manager" ? t.roleProjectManager : t.roleEmployee;

  // Rolle/Sprache/Nationalitaet/Telefon eines Mitarbeiters aendern (ueber abgesicherte Route).
  async function updateEmployee(member: any) {
    if (!currentCompany) return;
    if (!editNationality.trim() || !editPhone.trim()) { setMessage("Bitte Nationalität und Telefonnummer ausfüllen."); return; }
    setSavingEdit(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const body: any = { userId: member.user_id, preferredLanguage: editLang, nationality: editNationality.trim(), phone: editPhone.trim(), readOnly: editReadOnly };
      // Rolle nur mitschicken, wenn geaendert und nicht man selbst.
      if (editRole !== member.role && member.user_id !== user?.id) body.role = editRole;
      const res = await fetch("/api/update-employee", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) { setMessage("Fehler: " + (data?.error || `HTTP ${res.status}`)); return; }
      setEditMemberId(null);
      await loadCompanyUsers(currentCompany.company_id);
      setMessage("✅ Gespeichert.");
    } catch (e: any) {
      setMessage("Fehler beim Speichern: " + String(e?.message || e));
    } finally {
      setSavingEdit(false);
    }
  }

  async function resetCompanyUserPassword(memberEmail: string) {
    if (!memberEmail) { setMessage(t.msgNoEmailAddr); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(memberEmail, { redirectTo: "https://international-regie.vercel.app" });
    if (error) { setMessage("Fehler beim Passwort-Reset: " + error.message); return; }
    setMessage(t.msgPasswordReset);
  }

  async function loadReportsFromDatabase() {
    const data = await reportsCall({ action: "list_mine" });
    if (data?.error) { setMessage("Fehler beim Laden: " + data.error); return; }
    setSavedReports((Array.isArray(data?.rows) ? data.rows : []) as SavedReport[]);
  }

  // RLS-sichere Aufrufe fuer berichts-uebergreifende Aktionen (Service-Key serverseitig).
  async function reportsCall(payload: any) {
    let token = tokenRef.current;
    if (!token) {
      try { const sess = await dbTimeout(supabase.auth.getSession(), 5000); token = sess?.data?.session?.access_token || ""; } catch { /* 401 */ }
    }
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return await res.json().catch(() => ({ error: "Antwort konnte nicht gelesen werden." }));
  }
  // Alle Berichte (nur Admin/Owner sehen im Archiv die Berichte ALLER Mitarbeiter).
  async function loadAllReports() {
    const role = currentCompany?.role;
    if (role !== "owner" && role !== "admin") { setAllReports([]); return; }
    try {
      const data = await reportsCall({ action: "list_all" });
      setAllReports((Array.isArray(data?.rows) ? data.rows : []) as SavedReport[]);
    } catch { setAllReports([]); }
  }
  // Bericht ins Archiv verschieben / zurueckholen.
  async function archiveReport(id: string, value: boolean) {
    const data = await reportsCall({ action: "archive", id, value });
    if (data?.error) { setMessage("Fehler: " + data.error); return; }
    setSavedReports((prev) => prev.map((r: any) => (r.id === id ? { ...r, archived: value } : r)));
    setAllReports((prev) => prev.map((r: any) => (r.id === id ? { ...r, archived: value } : r)));
    setTeamReports((prev) => prev.map((r: any) => (r.id === id ? { ...r, archived: value } : r)));
  }
  // KW eines Berichts (aus dem ersten Tag mit Datum, sonst aus dem Namen).
  function reportFirstDate(r: any): string {
    return (r?.days || []).map((d: any) => (d?.date || "").trim()).filter(Boolean).sort()[0] || "";
  }
  function reportKw(r: any): string {
    const d = reportFirstDate(r);
    if (d) return getCalendarWeek(d);
    const m = String(r?.report_name || "").match(/KW\s*\d+/i);
    return m ? m[0].replace(/\s+/g, " ") : "";
  }

  // Berichte ALLER Mitarbeiter der Firma laden (nur Ansicht, nach Mitarbeiter gruppiert).
  async function loadTeamReports() {
    const role = currentCompany?.role;
    if (role !== "owner" && role !== "admin" && role !== "project_manager") { setTeamReports([]); return; }
    setTeamLoading(true);
    try {
      // Ueber die Server-Route (Service-Key) -> RLS-sicher.
      const data = await reportsCall({ action: "list_team" });
      if (data?.error) { setMessage("Fehler beim Laden: " + data.error); setTeamReports([]); return; }
      setTeamReports((Array.isArray(data?.rows) ? data.rows : []) as SavedReport[]);
    } finally { setTeamLoading(false); }
  }

  // Inhalt eines Mitarbeiter-Berichts in die Anzeige-Sprache uebersetzen (beim Aufklappen).
  async function translateTeamReport(r: SavedReport) {
    const existing = teamTrans[r.id];
    if (existing && existing.lang === uiLanguage) return;
    const days = r.days || [];
    const out: Record<number, string> = {};
    const outExtra: Record<string, string> = {};
    const tr = async (raw: string): Promise<string> => {
      const text = (raw || "").trim();
      if (!text) return "";
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: text, fromLanguage: "automatisch", toLanguage: uiLanguage }) });
        const data = await res.json();
        if (!data.error && data.translation && data.translation.trim() !== text) return data.translation;
      } catch { /* ignore */ }
      return "";
    };
    await Promise.all(days.map(async (d, i) => {
      const dt = await tr(d.description);
      if (dt) out[i] = dt;
      await Promise.all(((d as any).extra || []).map(async (ex: any, j: number) => {
        const et = await tr(ex.description);
        if (et) outExtra[`${i}_${j}`] = et;
      }));
    }));
    setTeamTrans((prev) => ({ ...prev, [r.id]: { lang: uiLanguage, days: out, extras: outExtra } }));
  }

  // Bei Sprachwechsel den gerade geoeffneten Bericht neu uebersetzen.
  useEffect(() => {
    if (!teamOpenId) return;
    const r = teamReports.find((x) => x.id === teamOpenId);
    if (r) translateTeamReport(r);
  }, [uiLanguage]);

  // Mitarbeiter-Bericht als PDF in der aktuellen Anzeige-Sprache (fuer PL/Admin/Owner).
  async function createTeamPDF(r: SavedReport) {
    setMessage("⏳ PDF …");
    try {
      const trText = async (raw: string): Promise<string> => {
        const text = (raw || "").trim();
        if (!text) return "";
        try {
          const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: text, fromLanguage: "automatisch", toLanguage: uiLanguage }) });
          const data = await res.json();
          return (!data.error && data.translation && data.translation.trim() !== text) ? data.translation : "";
        } catch { return ""; }
      };
      const pdfDays = await Promise.all((r.days || []).map(async (d: any) => {
        const translation = await trText(d.description);
        const extra = await Promise.all((d.extra || []).map(async (ex: any) => ({ ...ex, translation: await trText(ex.description) })));
        return { ...d, translation, extra: (d.extra && d.extra.length) ? extra : d.extra };
      }));
      await createPDF(false, { days: pdfDays, reportName: r.report_name, employee: r.employee, calendarWeek: "", sigEmployee: (r as any).signature_employee || "", sigCustomer: (r as any).signature_customer || "" });
      // Gedruckt -> Mitarbeiter-Bericht ins Archiv verschieben.
      await archiveReport(r.id, true);
    } finally {
      setMessage("");
    }
  }

  // Live-Uebersetzer: freien Text von transFrom nach transTo uebersetzen (nutzt Cache).
  async function runLiveTranslate() {
    const text = transInput.trim();
    if (!text) { setTransOutput(""); return; }
    if (transFrom === transTo) { setTransOutput(text); return; }
    setTransLoading(true);
    setTransOutput("");
    try {
      const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: text, fromLanguage: transFrom, toLanguage: transTo }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) { setMessage("Fehler: " + (data?.error || `HTTP ${res.status}`)); return; }
      setTransOutput(data.translation || "");
    } catch (e: any) {
      setMessage("Fehler bei der Übersetzung: " + String(e?.message || e));
    } finally {
      setTransLoading(false);
    }
  }

  // Feedback abgeben (Tester) bzw. laden (Owner/Admin/PL).
  async function submitFeedback() {
    if (!feedbackAnswers.some((a) => a && a.trim())) { setMessage("Bitte mindestens ein Feld ausfüllen."); return; }
    setFeedbackSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ answers: feedbackAnswers }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) { setMessage("Fehler: " + (data?.error || `HTTP ${res.status}`)); return; }
      setFeedbackAnswers(Array(10).fill(""));
      setMessage("✅ " + t.feedbackThanks);
      if (currentCompany && (currentCompany.role === "owner" || currentCompany.role === "admin" || currentCompany.role === "project_manager")) loadFeedback();
    } catch (e: any) {
      setMessage("Fehler beim Senden: " + String(e?.message || e));
    } finally {
      setFeedbackSending(false);
    }
  }
  async function loadFeedback() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch("/api/feedback", { method: "GET", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.feedback)) setFeedbackList(data.feedback);
    } catch { /* still ignorieren */ }
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

  // ── Zusatzeintraege je Tag (zweiter Arbeitsschritt mit eigener Zeit/Fahrzeit/km) ──
  function addExtraEntry(dayIndex: number) {
    const copy = [...days];
    const day: any = { ...copy[dayIndex] };
    day.extra = [...(day.extra || []), emptySubEntry()];
    copy[dayIndex] = day;
    setDays(copy);
  }
  function removeExtraEntry(dayIndex: number, exIndex: number) {
    const copy = [...days];
    const day: any = { ...copy[dayIndex] };
    day.extra = (day.extra || []).filter((_: any, i: number) => i !== exIndex);
    copy[dayIndex] = day;
    setDays(copy);
  }
  function updateExtra(dayIndex: number, exIndex: number, field: keyof DaySubEntry, value: string) {
    const copy = [...days];
    const day: any = { ...copy[dayIndex] };
    const extra = [...(day.extra || [])];
    const sub: any = { ...extra[exIndex], [field]: value };
    if (field === "startTime" || field === "endTime" || field === "breakMinutes") {
      const c = computeDayHours(sub.startTime, sub.endTime, sub.breakMinutes);
      if (c !== "") sub.hours = c;
    }
    extra[exIndex] = sub;
    day.extra = extra;
    copy[dayIndex] = day;
    setDays(copy);
  }

  // ── Zeiten je Arbeitsanweisung (Mitarbeiter traegt Stunden/Pause/Fahrzeit/km ein) ──
  // Fuer welche Tage wird eingetragen? Bei scope="week" die ganze Woche (Mo–So) rund um
  // das work_date, sonst nur der eine Tag.
  function instrDatesFor(instruction: any): string[] {
    const base = instruction?.work_date;
    if (!base) return [];
    if (instruction?.scope !== "week") return [base];
    const [y, m, d] = String(base).split("-").map(Number);
    if (!y || !m || !d) return [base];
    const date = new Date(Date.UTC(y, m - 1, d));
    const dayNum = date.getUTCDay() || 7;
    const monday = new Date(date); monday.setUTCDate(date.getUTCDate() - dayNum + 1);
    return Array.from({ length: 7 }, (_, i) => { const nd = new Date(monday); nd.setUTCDate(monday.getUTCDate() + i); return nd.toISOString().split("T")[0]; });
  }
  // Deckt eine Anweisung diesen Tag ab? Tag-Anweisung: nur work_date. Wochen-Anweisung: ganze Woche.
  function instructionCoversDate(instruction: any, dateStr: string): boolean {
    if (!dateStr) return false;
    if (instruction?.scope === "week") return instrDatesFor(instruction).includes(dateStr);
    return instruction?.work_date === dateStr;
  }
  function instrTime(instrId: string, date: string): Record<string, string> {
    return instrTimes[instrId]?.[date] || {};
  }
  function setInstrTimeField(instrId: string, date: string, field: string, value: string) {
    setInstrTimes((prev) => {
      const forInstr = { ...(prev[instrId] || {}) };
      const day: Record<string, string> = { ...(forInstr[date] || {}), [field]: value };
      if (field === "startTime" || field === "endTime" || field === "breakMinutes") {
        const c = computeDayHours(day.startTime, day.endTime, day.breakMinutes);
        if (c !== "") day.hours = c;
      }
      forInstr[date] = day;
      return { ...prev, [instrId]: forInstr };
    });
  }
  async function instrTimesCall(payload: any) {
    let token = tokenRef.current;
    if (!token) {
      try {
        const sess = await dbTimeout(supabase.auth.getSession(), 5000);
        token = sess?.data?.session?.access_token || "";
      } catch { /* Route antwortet dann mit 401 */ }
    }
    const res = await fetch("/api/instruction-times", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => ({ error: "Antwort konnte nicht gelesen werden." }));
  }
  async function loadInstrTimes(_companyId: string, _uid: string) {
    try {
      const data = await instrTimesCall({ action: "list" });
      const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];
      const map: Record<string, Record<string, Record<string, string>>> = {};
      for (const r of rows) {
        (map[r.work_instruction_id] ||= {})[r.work_date] = {
          startTime: r.start_time || "", endTime: r.end_time || "", breakMinutes: r.break_minutes || "", hours: r.hours || "",
          travelOutStart: r.travel_out_start || "", travelOutEnd: r.travel_out_end || "", travelOutKm: r.travel_out_km || "",
          travelReturnStart: r.travel_return_start || "", travelReturnEnd: r.travel_return_end || "", travelReturnKm: r.travel_return_km || "",
        };
      }
      setInstrTimes(map);
    } catch { /* still ignorieren */ }
  }
  async function saveInstrTimes(instruction: any) {
    if (!user || !currentCompany) return;
    setInstrTimesSaving(instruction.id);
    const rows = instrDatesFor(instruction).map((date) => {
      const d = instrTime(instruction.id, date);
      return {
        work_date: date,
        start_time: d.startTime || null, end_time: d.endTime || null, break_minutes: d.breakMinutes || null, hours: d.hours || null,
        travel_out_start: d.travelOutStart || null, travel_out_end: d.travelOutEnd || null, travel_out_km: d.travelOutKm || null,
        travel_return_start: d.travelReturnStart || null, travel_return_end: d.travelReturnEnd || null, travel_return_km: d.travelReturnKm || null,
      };
    });
    if (rows.length === 0) { setInstrTimesSaving(""); return; }
    const data = await instrTimesCall({ action: "save", instructionId: instruction.id, rows });
    setInstrTimesSaving("");
    setMessage(data?.error ? ("Fehler: " + data.error) : (tx.timesSaved || "Zeiten gespeichert."));
  }
  // Zeiten des aktuellen Nutzers in einen Regiebericht-Tag uebernehmen (leere Felder nicht ueberschreiben).
  function applyInstrTimeToDay(dayEntry: DayEntry, instrId: string, date: string): DayEntry {
    const tm = instrTime(instrId, date);
    return {
      ...dayEntry,
      startTime: tm.startTime || dayEntry.startTime,
      endTime: tm.endTime || dayEntry.endTime,
      breakMinutes: tm.breakMinutes || dayEntry.breakMinutes,
      hours: tm.hours || dayEntry.hours,
      travelOutStart: tm.travelOutStart || dayEntry.travelOutStart,
      travelOutEnd: tm.travelOutEnd || dayEntry.travelOutEnd,
      travelOutKm: tm.travelOutKm || dayEntry.travelOutKm,
      travelReturnStart: tm.travelReturnStart || dayEntry.travelReturnStart,
      travelReturnEnd: tm.travelReturnEnd || dayEntry.travelReturnEnd,
      travelReturnKm: tm.travelReturnKm || dayEntry.travelReturnKm,
    };
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

  // Liefert alle Kommentare eines Arbeitsschritts (ein Eintrag pro Mitarbeiter).
  // Faellt auf den alten Einzel-Kommentar zurueck, solange noch keine Liste existiert.
  function taskCommentList(task: any): any[] {
    const list = Array.isArray(task?.comments) ? task.comments : [];
    if (list.length > 0) return list;
    const legacy = (task?.employee_comment || "").trim();
    if (legacy) return [{ user_id: null, name: task?.comment_by || "", text: task.employee_comment, lang: task?.comment_lang || "" }];
    return [];
  }
  // Schluessel fuer die Uebersetzung eines einzelnen Kommentars.
  function commentKey(taskId: string, entry: any): string {
    const idPart = entry?.id || `${entry?.name || "x"}_${(entry?.text || "").length}`;
    return `comment_${taskId}_${idPart}`;
  }
  // Anzeigename des angemeldeten Benutzers (fuer die Zuordnung von Kommentaren).
  function myDisplayName(): string {
    return (companyUsers.find((m: any) => m.user_id === user?.id)?.full_name) || user?.email || "";
  }
  // Gehoert dieser Kommentar mir? (per Benutzer-ID, bei Altdaten ersatzweise per Name)
  function isMyComment(c: any): boolean {
    if (c?.user_id && user?.id) return c.user_id === user.id;
    if (!c?.user_id && c?.name) return c.name === myDisplayName();
    return false;
  }
  // Eigener Kommentar (des angemeldeten Benutzers) an einem Arbeitsschritt.
  function ownComment(task: any): any | null {
    return taskCommentList(task).find((c: any) => isMyComment(c)) || null;
  }

  function getTranslated(instructionId: string, field: string, fallback: string): string {
    const trans = instructionTranslations[instructionId];
    if (trans && trans.language === uiLanguage && trans[field]) return trans[field];
    return fallback;
  }

  function getTranslatedComment(instructionId: string, taskId: string, entry: any): string {
    const raw = (entry?.text || "");
    const { body, weather } = splitWeather(raw);
    const trans = instructionTranslations[instructionId];
    const key = commentKey(taskId, entry);
    const translatedBody = (trans && trans.language === uiLanguage && trans.tasks?.[key]) ? trans.tasks[key] : body;
    const loc = weather.map((w) => localizeWeather(w, uiLanguage));
    return [translatedBody, ...loc].filter(Boolean).join("\n");
  }

  function getTranslatedTask(instructionId: string, taskId: string, fallback: string): string {
    const trans = instructionTranslations[instructionId];
    if (trans && trans.language === uiLanguage && trans.tasks?.[taskId]) return trans.tasks[taskId];
    return fallback;
  }

  // Markiert eine Arbeitsanweisung als gelesen (Mitarbeiter ODER Projektleiter), einmalig.
  async function markInstructionRead(instructionId: string) {
    // Jeder angemeldete Nutzer kann den Lesestatus setzen (auch Owner/Admin,
    // wenn ihnen eine Arbeitsanweisung zugewiesen ist).
    if (!user?.id) return;
    const inst = workInstructions.find((i: any) => i.id === instructionId);
    if ((inst?.instruction_reads || []).some((r: any) => r.user_id === user.id)) return;
    try {
      await supabase.from("instruction_reads").upsert({ instruction_id: instructionId, user_id: user.id }, { onConflict: "instruction_id,user_id", ignoreDuplicates: true });
      setWorkInstructions((prev: any[]) => prev.map((i: any) => i.id === instructionId ? { ...i, instruction_reads: [...(i.instruction_reads || []), { user_id: user.id, read_at: new Date().toISOString() }] } : i));
    } catch { /* ignorieren */ }
  }

  // Springt vom Dashboard zur Arbeitsanweisung (Tagesansicht, passendes Datum, aufgeklappt).
  function openInstructionFromDashboard(inst: any) {
    if (inst?.work_date) setSelectedDayDate(inst.work_date);
    setOpenDayCards((prev) => ({ ...prev, [inst.id]: true }));
    setActiveTab("tag");
    markInstructionRead(inst.id);
  }

  // Oeffnet die Bedienungsanleitung in der aktuellen Anzeige-Sprache.
  // Reihenfolge: hinterlegte Zeile fuer die Sprache, sonst deutsche Vorlage live uebersetzen
  // (Cache der translate-Route -> jede Sprache nur einmal wirklich uebersetzt), sonst Deutsch.
  async function openHelp() {
    setHelpOpen(true); setHelpText(null);
    try {
      // a. Schon hinterlegte Uebersetzung fuer diese Sprache?
      const res = await supabase.from("user_guides").select("content").eq("lang", uiLanguage).maybeSingle();
      const direct = res.data?.content || "";
      if (direct.trim()) { setHelpText(direct); return; }

      // b. Deutsche Vorlage laden
      const fb = await supabase.from("user_guides").select("content").eq("lang", "Deutsch").maybeSingle();
      const german = fb.data?.content || "";
      if (!german.trim()) { setHelpText(""); return; }
      if (uiLanguage === "Deutsch") { setHelpText(german); return; }

      // c. Live in die Anzeige-Sprache uebersetzen, Fallback Deutsch bei Fehler
      try {
        const tr = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: german, fromLanguage: "Deutsch", toLanguage: uiLanguage }) });
        const trData = await tr.json();
        setHelpText(!trData.error && trData.translation ? trData.translation : german);
      } catch {
        setHelpText(german);
      }
    } catch { setHelpText(""); }
  }

  // Zeigt den Lesestatus: Mitarbeiter sehen "gelesen", Manager sehen wer gelesen hat / wer nicht.
  function renderReadStatus(instruction: any) {
    const reads = instruction.instruction_reads || [];
    const readerIds = new Set(reads.map((r: any) => r.user_id));
    const role = currentCompany?.role;
    const assigned: string[] = instruction.assigned_user_ids || [];
    const nameOf = (id: string) => { const u = companyUsers.find((m: any) => m.user_id === id); return u ? (u.full_name || u.email || id) : id; };
    if (role === "employee") {
      const iRead = !!user?.id && readerIds.has(user.id);
      return iRead ? (<p className="text-xs text-green-600">✅ {t.readLabel}</p>) : null;
    }
    if (assigned.length === 0) return null;
    const readers = assigned.filter((id) => readerIds.has(id));
    return (
      <p className="text-xs break-words">
        <span className={readers.length === assigned.length ? "text-green-600" : "text-orange-600"}>👁 {t.readLabel} {readers.length}/{assigned.length}</span>
        <span className="text-gray-500"> — {assigned.map((id) => `${nameOf(id)} ${readerIds.has(id) ? "✓" : "✗"}`).join(", ")}</span>
      </p>
    );
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
        { key: "material", text: inst.material || "" },
        { key: "werkzeug", text: inst.werkzeug || "" },
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
        // Aufgaben-Notiz (Freitext vom Mitarbeiter) mit uebersetzen.
        const noteText = (task.note || "").trim();
        if (noteText && !(sameLang && existing?.tasks?.[`note_${task.id}`])) {
          jobs.push({ instId: inst.id, storeKey: `note_${task.id}`, inTasks: true, text: noteText, sourceLang: "automatisch" });
        }
        for (const entry of taskCommentList(task)) {
          const cBody = splitWeather(entry?.text || "").body.trim();
          if (!cBody) continue;
          const key = commentKey(task.id, entry);
          if (sameLang && existing?.tasks?.[key]) continue;
          const declared = entry?.lang;
          const sourceLang = declared && declared !== targetLang ? declared : "automatisch";
          jobs.push({ instId: inst.id, storeKey: key, inTasks: true, text: cBody, sourceLang });
        }
      }
      // Verbrauchtes Material (Bezeichnungen)
      for (const m of (Array.isArray(inst.used_material) ? inst.used_material : [])) {
        const mName = (m?.name || "").trim();
        if (!mName) continue;
        const mKey = materialKey(mName);
        if (sameLang && existing?.tasks?.[mKey]) continue;
        jobs.push({ instId: inst.id, storeKey: mKey, inTasks: true, text: mName, sourceLang: "automatisch" });
      }
    }
    if (jobs.length === 0) return;
    const fieldUpdates: Record<string, Record<string, string>> = {};
    const taskUpdates: Record<string, Record<string, string>> = {};
    // Dedupliziert + gedrosselt: gleicher Text wird nur EINMAL uebersetzt (Anweisungen
    // wiederholen sich stark), max. CONCURRENCY gleichzeitig -> Verbindungen bleiben frei.
    const uniqueTexts = new Map<string, { text: string; sourceLang: string }>();
    for (const job of jobs) {
      const k = job.sourceLang + "|||" + job.text;
      if (!uniqueTexts.has(k)) uniqueTexts.set(k, { text: job.text, sourceLang: job.sourceLang });
    }
    const translations = new Map<string, string>();
    const CONCURRENCY = 4;
    const entries = Array.from(uniqueTexts.entries());
    const runOne = async (entry: [string, { text: string; sourceLang: string }]) => {
      const [k, v] = entry;
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: v.text, fromLanguage: v.sourceLang, toLanguage: targetLang }) });
        const data = await res.json();
        if (!data.error && data.translation) translations.set(k, data.translation);
      } catch { /* Übersetzung übersprungen */ }
    };
    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      await Promise.all(entries.slice(i, i + CONCURRENCY).map(runOne));
    }
    for (const job of jobs) {
      const tr = translations.get(job.sourceLang + "|||" + job.text);
      if (!tr) continue;
      if (job.inTasks) {
        if (!taskUpdates[job.instId]) taskUpdates[job.instId] = {};
        taskUpdates[job.instId][job.storeKey] = tr;
      } else {
        if (!fieldUpdates[job.instId]) fieldUpdates[job.instId] = {};
        fieldUpdates[job.instId][job.storeKey] = tr;
      }
    }
    const ids = new Set([...Object.keys(fieldUpdates), ...Object.keys(taskUpdates)]);
    // Inzwischen wurde die Sprache gewechselt? Dann dieses (veraltete) Ergebnis verwerfen,
    // damit es die aktuelle Anzeige-Sprache nicht ueberschreibt.
    if (targetLang !== uiLanguageRef.current) return;
    if (ids.size > 0) {
      setInstructionTranslations((prev) => {
        const next: Record<string, any> = { ...prev };
        for (const id of ids) {
          // WICHTIG: Nur Eintraege der GLEICHEN Sprache weiterverwenden. Sonst blieben Texte
          // einer frueheren Ziel-Sprache (z. B. Englisch) stehen und wuerden faelschlich als
          // Uebersetzung der aktuellen Sprache angezeigt (gemischte Sprachen in der Anzeige).
          const base = next[id]?.language === targetLang ? next[id] : {};
          next[id] = {
            ...base,
            ...(fieldUpdates[id] || {}),
            language: targetLang,
            tasks: { ...(base?.tasks || {}), ...(taskUpdates[id] || {}) },
          };
        }
        return next;
      });
    }
  }

  // Bestehende Arbeitsanweisung zum Bearbeiten ins Formular laden.
  function startEditInstruction(instruction: any) {
    setEditingInstructionId(instruction.id);
    setInstructionTitle(instruction.title || "");
    setInstructionProject(instruction.project || "");
    setInstructionCustomer(instruction.customer || "");
    setInstructionSite(instruction.site || "");
    setInstructionStreet(instruction.street || "");
    setInstructionAddress2(instruction.address2 || "");
    setInstructionAddr2Desc(instruction.address2_desc || "");
    setInstructionAddr2Name(instruction.address2_name || "");
    setInstructionAddr2Street(instruction.address2_street || "");
    setInstructionAddr2Zip(instruction.address2_zip || "");
    setInstructionAddr2City(instruction.address2_city || "");
    setAddr2Open(!!(instruction.address2_desc || instruction.address2_name || instruction.address2_street || instruction.address2_zip || instruction.address2_city || instruction.address2));
    setInstructionZip(instruction.zip || "");
    setInstructionCity(instruction.city || "");
    setInstructionDescription(instruction.description || "");
    setInstructionProblems(instruction.problems_text || "");
    setInstructionMaterial(instruction.material || "");
    setInstructionWerkzeug(instruction.werkzeug || "");
    setInstructionPhotos(instruction.photos || []);
    setInstructionDate(instruction.work_date || "");
    setInstructionScope(instruction.scope === "week" ? "week" : "day");
    setSelectedProjectId(instruction.project_id || "");
    setAssignedUserIds(instruction.assigned_user_ids || []);
    const sorted = [...(instruction.work_instruction_tasks || [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const tasks = sorted.map((tk: any) => tk.task_text || "");
    const photos: Record<number, string[]> = {};
    const statuses: Record<number, string> = {};
    sorted.forEach((tk: any, i: number) => { photos[i] = tk.photos || []; statuses[i] = tk.status || "open"; });
    setInstructionTasks(tasks.length > 0 ? tasks : [""]);
    setInstructionTaskPhotos(photos);
    setInstructionTaskStatuses(statuses);
    setMessage("✏️ " + (instruction.title || ""));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Bearbeiten abbrechen und Formular leeren.
  function cancelEditInstruction() {
    setEditingInstructionId(null);
    setInstructionTitle(""); setInstructionProject(""); setInstructionCustomer(""); setInstructionSite(""); setInstructionStreet(""); setInstructionZip(""); setInstructionCity(""); setInstructionAddress2(""); setInstructionAddr2Desc(""); setInstructionAddr2Name(""); setInstructionAddr2Street(""); setInstructionAddr2Zip(""); setInstructionAddr2City(""); setAddr2Open(false); setInstructionDescription(""); setInstructionTasks([""]); setInstructionProblems(""); setInstructionMaterial(""); setInstructionWerkzeug(""); setInstructionPhotos([]); setInstructionTaskPhotos({}); setInstructionTaskStatuses({}); setAssignedUserIds([]); setSelectedProjectId(""); setInstructionDate(""); setInstructionScope("day");
    setMessage("");
  }

  async function saveWorkInstruction() {
    setMessage(t.msgSaving);
    if (!currentCompany) { setMessage(t.msgNoFirm); return; }
    if (!instructionTitle.trim()) { setMessage(t.msgNoTitle); return; }
    if (!instructionDate) { setMessage((t as any).msgNoDate || "Bitte ein Datum für die Arbeitsanweisung eintragen."); return; }
    await ensureFreshSession();
    const instructionPayload = { company_id: currentCompany.company_id, project_id: selectedProjectId || null, work_date: instructionDate || null, scope: instructionScope, assigned_user_ids: assignedUserIds, title: instructionTitle, project: instructionProject, customer: instructionCustomer, site: instructionSite, street: instructionStreet, zip: instructionZip, city: instructionCity, address2: null, address2_desc: instructionAddr2Desc || null, address2_name: instructionAddr2Name || null, address2_street: instructionAddr2Street || null, address2_zip: instructionAddr2Zip || null, address2_city: instructionAddr2City || null, description: instructionDescription, problems_text: instructionProblems, material: instructionMaterial, werkzeug: instructionWerkzeug, photos: instructionPhotos };
    let instruction: any; let error: any;
    if (editingInstructionId) {
      const upd = await dbTimeout(supabase.from("work_instructions").update(instructionPayload).eq("id", editingInstructionId).select().single());
      instruction = upd.data; error = upd.error;
      // Alte Schritte entfernen – werden gleich neu geschrieben.
      if (!error) { await dbTimeout(supabase.from("work_instruction_tasks").delete().eq("work_instruction_id", editingInstructionId)); }
    } else {
      const ins = await dbTimeout(supabase.from("work_instructions").insert({ ...instructionPayload, created_by: user?.id }).select().single());
      instruction = ins.data; error = ins.error;
    }
    if (error) { setMessage("Fehler: " + error.message); return; }
    if (!instruction) { setMessage("Fehler: Anweisung konnte nicht gespeichert werden."); return; }
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
      const { error: taskError } = await dbTimeout(supabase.from("work_instruction_tasks").insert(taskRows));
      if (taskError) { setMessage("Arbeitsanweisung gespeichert, aber Schritte nicht: " + taskError.message); return; }
    }
    setInstructionTitle(""); setInstructionProject(""); setInstructionCustomer(""); setInstructionSite(""); setInstructionStreet(""); setInstructionZip(""); setInstructionCity(""); setInstructionAddress2(""); setInstructionAddr2Desc(""); setInstructionAddr2Name(""); setInstructionAddr2Street(""); setInstructionAddr2Zip(""); setInstructionAddr2City(""); setAddr2Open(false); setInstructionDescription(""); setInstructionTasks([""]); setInstructionProblems(""); setInstructionMaterial(""); setInstructionWerkzeug(""); setInstructionPhotos([]); setInstructionTaskPhotos({}); setInstructionTaskStatuses({}); setAssignedUserIds([]); setEditingInstructionId(null);
    await loadWorkInstructions(currentCompany.company_id);
    setMessage(t.msgInstructionSaved);
  }

  async function deleteWorkInstruction(id: string) {
    if (!currentCompany) return;
    if (typeof window !== "undefined" && !window.confirm(tx.instrDeleteAsk || "Arbeitsanweisung wirklich löschen?")) return;
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
    setMessage(t.msgNoteSaved);
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
  // Alle Positionen (Haupt- + Zusatzeintraege) fuer die Summen.
  const allItems = days.flatMap(dayLineItems);
  const totalHours = allItems.reduce((sum, it) => sum + parseHours(it.hours), 0);
  const projectTotals = allItems.reduce<Record<string, number>>((acc, it) => {
    if (!it.projectNumber) return acc;
    acc[it.projectNumber] = (acc[it.projectNumber] || 0) + parseHours(it.hours);
    return acc;
  }, {});
  // Fahrzeit-Summe pro Woche: Dauer (Hin- + Rueckfahrt) in Minuten und km gesamt.
  function travelMinutes(start?: string, end?: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return mins;
  }
  function formatTravelTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${m.toString().padStart(2, "0")}`;
  }
  const totalTravelMinutes = allItems.reduce((sum, it) => sum + travelMinutes(it.travelOutStart, it.travelOutEnd) + travelMinutes(it.travelReturnStart, it.travelReturnEnd), 0);
  const totalTravelKm = allItems.reduce((sum, it) => sum + (Number((it.travelOutKm || "").replace(",", ".")) || 0) + (Number((it.travelReturnKm || "").replace(",", ".")) || 0), 0);
  const totalTravelKmDisplay = (Math.round(totalTravelKm * 10) / 10).toString().replace(".", ",");
  const travelKmByProject = allItems.reduce<Record<string, number>>((acc, it) => {
    if (!it.projectNumber) return acc;
    const km = (Number((it.travelOutKm || "").replace(",", ".")) || 0) + (Number((it.travelReturnKm || "").replace(",", ".")) || 0);
    if (km > 0) acc[it.projectNumber] = (acc[it.projectNumber] || 0) + km;
    return acc;
  }, {});
  const formatKm = (km: number) => (Math.round(km * 10) / 10).toString().replace(".", ",");

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
    const { data } = await supabase.from("company_settings").select("*").eq("user_id", ownerUserId).maybeSingle();
    const settings = data || { user_id: ownerUserId, company_name: "", company_logo: "", street: "", zip_code: "", city: "", phone: "", email: "", website: "", tax_number: "" };
    setCompanySettings(settings);
  }

  async function saveCompanySettings() {
    if (!user || !companySettings) return;
    await ensureFreshSession();
    const { error } = await dbTimeout(supabase.from("company_settings").upsert({ ...companySettings, user_id: user.id }, { onConflict: "user_id" }));
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
    setMessage(t.msgLogoUploaded);
  }

  // Begrenzt einen Supabase-Aufruf zeitlich. Bleibt er haengen (z. B. blockierter
  // Token-Refresh in der Handy-App), kommt nach `ms` ein Fehler statt ewigem Warten.
  function dbTimeout(p: any, ms = 12000): Promise<any> {
    return Promise.race([
      Promise.resolve(p),
      new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: "Zeitüberschreitung – bitte App neu laden und neu anmelden." } }), ms)),
    ]);
  }

  // Stellt vor jedem Schreibvorgang sicher, dass die Sitzung gueltig ist und
  // erneuert das Token bei Bedarf – selbst zeitlich begrenzt, damit es nie haengt.
  async function ensureFreshSession() {
    try {
      const { data } = await dbTimeout(supabase.auth.getSession(), 8000);
      const expMs = data?.session?.expires_at ? data.session.expires_at * 1000 : 0;
      if (!data?.session || expMs - Date.now() < 60000) {
        await dbTimeout(supabase.auth.refreshSession(), 8000);
      }
    } catch { /* ignorieren */ }
  }

  // Erzeugt einen eindeutigen, fortlaufend nummerierten Berichtsnamen,
  // z. B. "KW 26 - Jasmin 1", "KW 26 - Jasmin 2", ... (naechste freie Nummer).
  function buildReportName(): string {
    const base = `${calendarWeek || "Woche"} - ${employee || "Bericht"}`;
    const taken = new Set(savedReports.map((r: any) => (r.report_name || "").trim()));
    let n = 1;
    while (taken.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }

  async function saveReport() {
    setMessage("");
    if (!user) { setMessage(t.msgPleaseLogin); return; }
    await ensureFreshSession();
    const name = reportName.trim() || buildReportName();
    const report = { report_name: name, employee, from_language: fromLanguage, to_language: toLanguage, pdf_language: pdfLanguage, days, project_id: selectedProjectId || null, signature_employee: sigEmployee || null, signature_customer: sigCustomer || null };
    const wasUpdate = !!currentReportId;
    const data = await reportsCall({ action: "save", id: currentReportId || undefined, report });
    if (data?.error) { setMessage("Fehler beim Speichern: " + data.error); return; }
    if (!wasUpdate && data?.id) setCurrentReportId(data.id);
    setReportName(name);
    setMessage(wasUpdate ? t.msgUpdated : t.msgSaved);
    await loadReportsFromDatabase();
  }

  // Speichert den aktuellen Inhalt IMMER als NEUEN Bericht (eigene ID).
  // Der bisher geoeffnete Bericht bleibt unveraendert erhalten.
  async function saveAsNewReport() {
    setMessage("");
    if (!user) { setMessage(t.msgPleaseLogin); return; }
    await ensureFreshSession();
    const typed = reportName.trim();
    const takenNames = new Set(savedReports.map((r: any) => (r.report_name || "").trim()));
    const name = (typed && !takenNames.has(typed)) ? typed : buildReportName();
    const report = { report_name: name, employee, from_language: fromLanguage, to_language: toLanguage, pdf_language: pdfLanguage, days, project_id: selectedProjectId || null, signature_employee: sigEmployee || null, signature_customer: sigCustomer || null };
    const data = await reportsCall({ action: "save", report });
    if (data?.error) { setMessage("Fehler beim Speichern: " + data.error); return; }
    if (data?.id) setCurrentReportId(data.id);
    setReportLoaded(false);
    setReportName(name);
    setMessage(t.msgSaved);
    await loadReportsFromDatabase();
  }

  function loadReport(report: SavedReport) {
    setReportLoaded(true);
    setCurrentReportId(report.id); setReportName(report.report_name); setEmployee(report.employee || "");
    setFromLanguage(report.from_language || "Deutsch"); setToLanguage(report.to_language || "Polnisch");
    setPdfLanguage(report.pdf_language || "Deutsch"); setDays(report.days || createEmptyDays());
    setSigEmployee((report as any).signature_employee || ""); setSigCustomer((report as any).signature_customer || "");
    setReportVersion((v) => v + 1);
    setMessage(t.msgLoaded); setActiveTab("regiebericht");
  }

  async function deleteReport(id: string) {
    const data = await reportsCall({ action: "delete", id });
    if (data?.error) { setMessage("Fehler beim Löschen: " + data.error); return; }
    if (currentReportId === id) newReport();
    setMessage(t.msgDeleted); await loadReportsFromDatabase();
    setAllReports((prev) => prev.filter((r: any) => r.id !== id));
  }

  function newReport() {
    setReportLoaded(false);
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

  // Baut aus Baustelle + Straße + PLZ + Ort eine Adresszeile (fuer Arbeitsanweisung/Bericht/PDF).
  function formatProjectAddress(p: any): string {
    const zc = [p?.zip, p?.city].filter(Boolean).map((x: any) => String(x).trim()).join(" ");
    return [p?.site, p?.street, zc].map((x: any) => (x || "").toString().trim()).filter(Boolean).join(", ");
  }
  // Reine Navigations-Adresse (Straße + PLZ/Ort; ohne Baustellen-Name, damit Maps sauber findet).
  function projectNavAddress(p: any): string {
    const zc = [p?.zip, p?.city].filter(Boolean).map((x: any) => String(x).trim()).join(" ");
    const parts = [p?.street, zc].map((x: any) => (x || "").toString().trim()).filter(Boolean);
    if (parts.length === 0 && p?.site) parts.push(String(p.site).trim());
    return parts.join(", ");
  }
  function projectNavUrl(p: any): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(projectNavAddress(p))}`;
  }
  // Navigations-Adresse einer Arbeitsanweisung (Straße + PLZ/Ort; sonst Baustelle).
  function instructionNavAddress(i: any): string {
    const zc = [i?.zip, i?.city].filter(Boolean).map((x: any) => String(x).trim()).join(" ");
    const parts = [i?.street, zc].map((x: any) => (x || "").toString().trim()).filter(Boolean);
    if (parts.length === 0 && i?.site) parts.push(String(i.site).trim());
    return parts.join(", ");
  }
  function instructionNavUrl(i: any): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(instructionNavAddress(i))}`;
  }
  function navUrlForAddress(address: string): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((address || "").trim())}`;
  }
  // Zweite Adresse (Name, Straße, PLZ, Ort) als Zeichenkette; Fallback: altes Freitext-Feld.
  function instructionAddr2(i: any): string {
    const zc = [i?.address2_zip, i?.address2_city].filter(Boolean).map((x: any) => String(x).trim()).join(" ");
    const parts = [i?.address2_name, i?.address2_street, zc].map((x: any) => (x || "").toString().trim()).filter(Boolean);
    if (parts.length) return parts.join(", ");
    return (i?.address2 || "").toString().trim();
  }

  // Liefert die Projekte, die in einem Bericht vorkommen (fuer die Anzeige hinter dem Namen).
  function reportProjects(r: any): string {
    const list = (r?.days || [])
      .map((d: any) => (d?.projectNumber || "").toString().trim())
      .filter(Boolean);
    return Array.from(new Set(list)).join(", ");
  }

  // Projekt-Formular leeren und den Bearbeiten-Modus beenden.
  function resetProjectForm() {
    setProjectName(""); setProjectCustomer(""); setProjectSite(""); setProjectStreet(""); setProjectZip(""); setProjectCity(""); setProjectManager("");
    setEditingProjectId(null);
  }
  // Bestehendes Projekt in das Formular laden.
  function startEditProject(p: any) {
    setEditingProjectId(p.id);
    setProjectName(p.name || ""); setProjectCustomer(p.customer || ""); setProjectSite(p.site || "");
    setProjectStreet(p.street || ""); setProjectZip(p.zip || ""); setProjectCity(p.city || "");
    setProjectManager(p.project_manager || "");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProject() {
    if (!currentCompany) return;
    if (!projectName.trim()) { setMessage(t.msgFillRequired); return; }
    await ensureFreshSession();
    const payload = { name: projectName, customer: projectCustomer, site: projectSite, street: projectStreet, zip: projectZip, city: projectCity, project_manager: projectManager };
    if (editingProjectId) {
      const { error } = await dbTimeout(supabase.from("projects").update(payload).eq("id", editingProjectId));
      if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    } else {
      const { error } = await dbTimeout(supabase.from("projects").insert({ company_id: currentCompany.company_id, ...payload }));
      if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    }
    resetProjectForm();
    await loadProjects(); setMessage(t.msgProjectSaved);
  }

  async function updateProjectManager(projectId: string, newPm: string) {
    const project = projects.find((p: any) => p.id === projectId);
    if (!project) return;
    if ((project.project_manager || "") === (newPm || "")) { setMessage(t.msgPmUnchanged); return; }
    const { error } = await supabase.from("projects").update({ project_manager: newPm }).eq("id", projectId);
    if (error) { setMessage("Fehler beim Ändern des Projektleiters: " + error.message); return; }
    await loadProjects(); setMessage(t.msgPmChanged);
  }

  // Neuen Projektleiter (additiv) allen Anweisungen des Projekts zuweisen, damit er sie sieht.
  async function assignPmToProjectInstructions(projectId: string, pmName: string) {
    if (!currentCompany) return;
    const member = companyUsers.find((m: any) => m.role === "project_manager" && (m.full_name || m.email) === pmName);
    if (!member) { setMessage(t.msgPmNotFound); return; }
    const newId = member.user_id;
    const { data: insts, error: loadErr } = await supabase.from("work_instructions").select("id, assigned_user_ids").eq("project_id", projectId);
    if (loadErr) { setMessage("Fehler beim Laden der Anweisungen: " + loadErr.message); return; }
    if (!insts || insts.length === 0) { setMessage(t.msgProjectNoInstr); return; }
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
        for (const entry of taskCommentList(task)) { if ((entry?.text || "").trim()) items.push({ key: commentKey(task.id, entry), text: entry.text }); }
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
        for (const entry of taskCommentList(task)) {
          const k = commentKey(task.id, entry);
          if (out[k]) translatedTasks[k] = out[k];
        }
      }
      setInstructionTranslations((prev) => ({ ...prev, [instruction.id]: { ...translatedFields, tasks: translatedTasks, language: instructionToLanguage } }));
      setMessage(t.msgInstructionTranslated);
    } catch (err) { setMessage(t.msgTranslateErr + String(err)); }
    setTranslatingInstructionId(null);
  }

  // Ist dieser Tag in einem Bericht noch frei (vorhanden und ohne Inhalt)?
  function dayIsFreeInReport(report: any, date: string): boolean {
    if (!date) return false;
    const day = (report?.days || []).find((d: any) => d.date === date);
    if (!day) return false;
    const hasContent = (day.description || "").trim() || (day.hours || "").trim() || (day.startTime || "").trim();
    return !hasContent;
  }

  // Übernahme starten: bei einer Tages-Anweisung mit Projekt zuerst pruefen, ob es
  // schon einen Regiebericht dieses Projekts gibt, in dem der Tag frei ist -> nachfragen.
  async function startTransfer(instruction: any) {
    // Berichte frisch laden (State-Update ist nicht sofort sichtbar -> direkt lesen).
    let reports: SavedReport[] = [];
    try {
      const { data: au } = await supabase.auth.getUser();
      const uid = au?.user?.id;
      if (uid) {
        const { data } = await supabase.from("reports").select("*").eq("user_id", uid).order("created_at", { ascending: false });
        reports = (data || []) as SavedReport[];
        setSavedReports(reports);
      }
    } catch { /* Auswahl-Dialog kommt trotzdem */ }
    const targetDate = instruction.work_date || "";
    const pid = instruction.project_id || "";
    if (instruction.scope !== "week" && pid && targetDate) {
      const candidate = reports.find((r: any) => r.project_id === pid && dayIsFreeInReport(r, targetDate));
      if (candidate) { setTransferConfirm({ instruction, report: candidate }); return; }
    }
    setTransferInst(instruction);
  }

  async function createReportFromInstruction(instruction: any, targetReport?: SavedReport | null) {
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
      setMessage(t.msgTranslatingGeneric);
      const targetLang = uiLanguage;
      const translatedFields: Record<string, string> = {};
      for (const item of [
        { key: "title", text: instruction.title || "" },
        { key: "problems_text", text: instruction.problems_text || "" },
        { key: "material", text: instruction.material || "" },
        { key: "werkzeug", text: instruction.werkzeug || "" },
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
      }
      setInstructionTranslations(prev => ({ ...prev, [instruction.id]: { ...translatedFields, tasks: mergedTasks, language: targetLang } }));
      setMessage("");
      // Direkt die frischen Übersetzungen verwenden
      Object.assign(currentTranslations, translatedFields);
    }

    // Kommentare fuer den Regiebericht: der KOMPLETTE Verlauf des Arbeitsschritts
    // (alle Beitraege, jeweils mit Name), uebersetzt in die Sprache des Erstellers.
    const freshComments: Record<string, string> = {};
    for (const task of instruction.work_instruction_tasks || []) {
      const entries = taskCommentList(task).filter((c: any) => (chatOn || isMyComment(c)) && (c?.text || "").trim());
      if (entries.length === 0) continue;
      const lines: string[] = [];
      for (const entry of entries) {
        const parts = splitWeather((entry.text || "").trim());
        const loc = parts.weather.map((w) => localizeWeather(w, uiLanguage));
        let body = parts.body.trim();
        if (body && uiLanguage !== "Deutsch") {
          try {
            const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: body, fromLanguage: "automatisch", toLanguage: uiLanguage }) });
            const data = await res.json();
            if (!data.error && data.translation) body = data.translation;
          } catch { /* Original belassen */ }
        }
        const text = [body, ...loc].filter(Boolean).join("\n");
        if (!text) continue;
        lines.push(chatOn && entry.name ? `${entry.name}: ${text}` : text);
      }
      if (lines.length > 0) freshComments[task.id] = lines.join("\n");
    }
    const getTaskText = (taskId: string, fallback: string) => mergedTasks[taskId] || fallback;
    const getCommentText = (taskId: string, fallback: string) => freshComments[taskId] || fallback;
    const getTitleText = () => currentTranslations.title || instruction.title;
    const getProblemsText = () => currentTranslations.problems_text || instruction.problems_text || "";
    const getMaterialText = () => currentTranslations.material || instruction.material || "";
    const getWerkzeugText = () => currentTranslations.werkzeug || instruction.werkzeug || "";

    const currentTexts = texts[uiLanguage];
    const buildTaskLine = (task: any) => {
      const statusText = task.status === "completed" ? currentTexts.statusCompleted : task.status === "in_progress" ? currentTexts.statusInProgress : task.status === "stopped" ? currentTexts.statusStopped : currentTexts.statusOpen;
      const taskText = getTaskText(task.id, task.task_text);
      const lines = [`${statusText}: ${taskText}`];
      if (task.note) lines.push(`   📝 ${currentTexts.feedbackLabel}: ${task.note}`);
      const cmtText = freshComments[task.id] || "";
      if (cmtText) {
        for (const cl of cmtText.split("\n")) {
          if (cl.trim()) lines.push(`   💬 ${currentTexts.commentLabel}: ${cl}`);
        }
      }
      return lines.join("\n");
    };
    const sortedTasks = (instruction.work_instruction_tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
    const completedTasks = sortedTasks.map(buildTaskLine);
    const titleTranslated = getTitleText();
    const problemsTranslated = getProblemsText();
    const materialTranslated = getMaterialText();
    const werkzeugTranslated = getWerkzeugText();
    const buildDescription = (taskBlocks: string[]) => [
      titleTranslated !== instruction.title ? `📋 ${titleTranslated}` : "",
      ...taskBlocks,
      problemsTranslated ? `─────\n⚠️ ${currentTexts.problemsHints}: ${problemsTranslated}` : "",
      materialTranslated ? `📦 ${currentTexts.material}: ${materialTranslated}` : "",
      usedMaterialList(instruction).length > 0 ? `📦 ${currentTexts.materialUsed}: ${usedMaterialList(instruction).map((m: any) => `${m.qty} ${unitLabel(m.unit, uiLanguage)} ${getTranslatedMaterial(instruction.id, m.name)}`).join(", ")}` : "",
      werkzeugTranslated ? `🔧 ${currentTexts.werkzeug}: ${werkzeugTranslated}` : "",
      instruction.employee_note ? `${currentTexts.feedbackLabel}: ${instruction.employee_note}` : ""
    ].filter(Boolean).join("\n─────\n");
    const description = buildDescription(completedTasks);
    const targetDate = instruction.work_date || "";
    // Block (fuer eine Anweisung) in einen Tag setzen/ersetzen – kein doppelter Text.
    const putInstrBlock = (dayEntry: DayEntry, text: string): DayEntry => {
      const existingDesc = (dayEntry.description || "").trim();
      const prevBlocks = Array.isArray(dayEntry.blocks) ? dayEntry.blocks! : [];
      const blocks = prevBlocks.length > 0 ? [...prevBlocks] : (existingDesc ? [{ id: "legacy", text: existingDesc }] : []);
      const bIdx = blocks.findIndex((b) => b.id === instruction.id);
      if (bIdx >= 0) blocks[bIdx] = { id: instruction.id, text };
      else blocks.push({ id: instruction.id, text });
      const mergedDesc = blocks.map((b) => b.text).filter(Boolean).join("\n─────\n");
      return { ...dayEntry, customer: dayEntry.customer || instruction.customer || "", projectNumber: dayEntry.projectNumber || instruction.project || "", site: dayEntry.site || formatProjectAddress(instruction) || "", description: mergedDesc, blocks };
    };
    const isWeek = instruction.scope === "week";

    // Tag hat schon Inhalt? (Beschreibung / Stunden / Anfang) -> nicht ueberschreiben.
    const dayHasContent = (d: any) => !!((d?.description || "").trim() || (d?.hours || "").trim() || (d?.startTime || "").trim());

    // Zusatzeintrag (zweiter Arbeitsschritt am selben Tag) aus der Anweisung + erfassten Zeiten bauen.
    const buildSubEntry = (date: string, text: string): DaySubEntry => {
      const tm = instrTime(instruction.id, date);
      return {
        customer: instruction.customer || "",
        projectNumber: instruction.project || "",
        site: formatProjectAddress(instruction) || "",
        startTime: tm.startTime || "", endTime: tm.endTime || "", breakMinutes: tm.breakMinutes || "", hours: tm.hours || "",
        travelOutStart: tm.travelOutStart || "", travelOutEnd: tm.travelOutEnd || "", travelOutKm: tm.travelOutKm || "",
        travelReturnStart: tm.travelReturnStart || "", travelReturnEnd: tm.travelReturnEnd || "", travelReturnKm: tm.travelReturnKm || "",
        description: text,
      };
    };
    // Zusatzeintrag an einen Tag anhaengen (ersetzt einen frueheren Zusatz derselben Anweisung nicht,
    // aber verhindert exakte Doppelung des gleichen Textes).
    const appendSub = (dayEntry: DayEntry, date: string, text: string): DayEntry => {
      const extra = [...(dayEntry.extra || [])];
      if (extra.some((s) => (s.description || "").trim() === text.trim())) return dayEntry;
      extra.push(buildSubEntry(date, text));
      return { ...dayEntry, extra };
    };

    // In einen BESTEHENDEN Bericht einfuegen
    if (targetReport) {
      const baseDays: DayEntry[] = (targetReport.days && targetReport.days.length === 7) ? targetReport.days.map((d: any) => ({ ...d })) : createEmptyDays();
      if (isWeek) {
        // Wochen-Anweisung: leere Tage -> Haupteintrag; volle Tage -> Zusatzeintrag (kein Ueberschreiben).
        for (const date of instrDatesFor(instruction)) {
          const di = baseDays.findIndex((d) => d.date === date);
          if (di < 0) continue;
          if (dayHasContent(baseDays[di])) {
            baseDays[di] = appendSub(baseDays[di], date, description);
          } else {
            baseDays[di] = putInstrBlock(baseDays[di], description);
            baseDays[di] = applyInstrTimeToDay(baseDays[di], instruction.id, date);
            baseDays[di] = { ...baseDays[di], translation: "" };
          }
        }
      } else {
        // Tages-Anweisung: genau der Zieltag. Leer -> Haupteintrag, sonst Zusatzeintrag.
        const idx = targetDate ? baseDays.findIndex((d) => d.date === targetDate) : -1;
        if (idx < 0) { setMessage(tx.dayFilled || "Dieser Tag ist im Regiebericht bereits ausgefüllt."); return; }
        if (dayHasContent(baseDays[idx])) {
          baseDays[idx] = appendSub(baseDays[idx], targetDate, description);
        } else {
          baseDays[idx] = putInstrBlock(baseDays[idx], description);
          baseDays[idx] = applyInstrTimeToDay(baseDays[idx], instruction.id, targetDate);
          baseDays[idx] = { ...baseDays[idx], translation: "" };
        }
      }
      setDays(baseDays); setCurrentReportId(targetReport.id); setReportName(targetReport.report_name || ""); setReportLoaded(true); setReportVersion((v) => v + 1); setReportInstruction(instruction); setActiveTab("regiebericht"); setMessage(t.msgReportPrepared);
      return;
    }

    // NEUER Bericht: frische, leere Woche -> nur der uebertragene Tag wird gefuellt
    const copy = createEmptyDays();
    if (targetDate) {
      const [year, month, day] = targetDate.split("-").map(Number);
      const selectedDate = new Date(Date.UTC(year, month - 1, day));
      const dayNumber = selectedDate.getUTCDay() || 7;
      const monday = new Date(selectedDate);
      monday.setUTCDate(selectedDate.getUTCDate() - dayNumber + 1);
      for (let i = 0; i < 7; i++) { const nextDate = new Date(monday); nextDate.setUTCDate(monday.getUTCDate() + i); copy[i] = { ...copy[i], date: nextDate.toISOString().split("T")[0] }; }
    }
    if (isWeek) {
      // Wochen-Anweisung: an JEDEM Tag der Woche die offenen Arbeitsschritte + Zeiten.
      for (const date of instrDatesFor(instruction)) {
        const di = copy.findIndex((d) => d.date === date);
        if (di < 0) continue;
        copy[di] = putInstrBlock(copy[di], description);
        copy[di] = applyInstrTimeToDay(copy[di], instruction.id, date);
      }
    } else {
      const targetIndex = targetDate ? copy.findIndex((day) => day.date === targetDate) : 0;
      const indexToUse = targetIndex >= 0 ? targetIndex : 0;
      copy[indexToUse] = putInstrBlock(copy[indexToUse], description);
      copy[indexToUse] = applyInstrTimeToDay(copy[indexToUse], instruction.id, targetDate);
    }
    setDays(copy); setCurrentReportId(null); setReportName(""); setReportLoaded(false); setReportVersion((v) => v + 1); setReportInstruction(instruction); setActiveTab("regiebericht"); setMessage(t.msgReportPrepared);
  }

  // ── FIXED: kein window.location.reload() ──
  async function changePassword() {
    if (!newPassword.trim() || newPassword.length < 8) { setMessage("Passwort muss mindestens 8 Zeichen haben."); return; }
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
      // Paket-Features (company_features) werden vom Super-Admin gesetzt – per RLS gegen Client-Schreiben geschuetzt.
    }
    const { error } = await supabase.from("company_settings").upsert({ ...companySettings, user_id: user.id }, { onConflict: "user_id" });
    if (error) { setMessage("Fehler beim Speichern: " + error.message); return; }
    await loadCompanyContext(user.id);
    setShowOnboarding(false); setOnboardingDone(true); setMessage("Willkommen! Ihre Firmendaten wurden gespeichert.");
  }

  async function createPDF(sendByEmail = false, src?: { days?: DayEntry[]; reportName?: string; calendarWeek?: string; employee?: string; sigEmployee?: string; sigCustomer?: string }) {
    const pdfDays = src?.days ?? days;
    const pdfReportName = src?.reportName ?? reportName;
    const pdfCalendarWeek = src?.calendarWeek ?? calendarWeek;
    const pdfEmployee = src?.employee ?? employee;
    const pdfSigEmployee = src ? (src.sigEmployee || "") : sigEmployee;
    const pdfSigCustomer = src ? (src.sigCustomer || "") : sigCustomer;
    const p = pdfTexts[uiLanguage as keyof typeof pdfTexts] || pdfTexts["Deutsch" as keyof typeof pdfTexts];
    // Summen aus den tatsaechlich gedruckten Tagen (inkl. Zusatzeintraege) – nicht aus dem Formular-State.
    const pdfItems = pdfDays.flatMap(dayLineItems);
    const totalHours = pdfItems.reduce((s: number, it: any) => s + parseHours(it.hours), 0);
    const projectTotals = pdfItems.reduce<Record<string, number>>((acc: Record<string, number>, it: any) => {
      if (!it.projectNumber) return acc;
      acc[it.projectNumber] = (acc[it.projectNumber] || 0) + parseHours(it.hours);
      return acc;
    }, {});
    const totalTravelMinutes = pdfItems.reduce((s: number, it: any) => s + travelMinutes(it.travelOutStart, it.travelOutEnd) + travelMinutes(it.travelReturnStart, it.travelReturnEnd), 0);
    const totalTravelKm = pdfItems.reduce((s: number, it: any) => s + (Number((it.travelOutKm || "").replace(",", ".")) || 0) + (Number((it.travelReturnKm || "").replace(",", ".")) || 0), 0);
    const totalTravelKmDisplay = (Math.round(totalTravelKm * 10) / 10).toString().replace(".", ",");
    const travelKmByProject = pdfItems.reduce<Record<string, number>>((acc: Record<string, number>, it: any) => {
      if (!it.projectNumber) return acc;
      const km = (Number((it.travelOutKm || "").replace(",", ".")) || 0) + (Number((it.travelReturnKm || "").replace(",", ".")) || 0);
      if (km > 0) acc[it.projectNumber] = (acc[it.projectNumber] || 0) + km;
      return acc;
    }, {});
    const doc = new jsPDF("p", "mm", "a4");
    const FONT = await loadPdfFont(doc);
    pdfUnicodeSymbols = FONT === "NotoSans";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 15; const marginRight = 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let y = 15;
    const addFooter = () => { doc.setFontSize(8); doc.setTextColor(120); doc.text(companySettings?.company_name || currentCompany?.companies?.name || p.company, marginLeft, pageHeight - 10); doc.text(`${p.createdAt}: ${new Date().toLocaleDateString("de-DE")}`, pageWidth - marginRight, pageHeight - 10, { align: "right" }); doc.setTextColor(0); };
    const addNewPageIfNeeded = (neededHeight: number) => { if (y + neededHeight > pageHeight - 25) { addFooter(); doc.addPage(); y = 15; } };
    const qrText = `${p.title} ${pdfCalendarWeek || ""} - ${pdfEmployee}`;
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
    doc.text(`${p.report}: ${pdfReportName || "-"}`, marginLeft, y); y += 6;
    doc.text(`${p.calendarWeek}: ${pdfCalendarWeek || "-"}`, marginLeft, y); y += 6;
    doc.text(`${p.employee}: ${pdfEmployee || "-"}`, marginLeft, y);
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
    // Fuer das PDF die BEREITS in der App angezeigte Uebersetzung verwenden (day.translation).
    // So steht im PDF genau das, was der Betrachter in seiner Sprache sieht. Liegt keine
    // Uebersetzung vor (Original ist schon in der Anzeige-Sprache), wird das Original genommen.
    const pdfDayText: string[] = [];
    for (let di = 0; di < pdfDays.length; di++) {
      const src = (pdfDays[di].description || "").trim();
      const trans = (pdfDays[di].translation || "").trim();
      pdfDayText[di] = trans || src;
    }
    for (let di = 0; di < pdfDays.length; di++) {
      const day = pdfDays[di];
      const hasContent = day.description || day.hours || day.customer || day.projectNumber || day.site || day.photos.length > 0 || (day.extra || []).length > 0;
      if (!hasContent) continue;
      const descriptionText = sanitizePdfText(pdfDayText[di] || day.description || "-");
      const splitDescription = doc.splitTextToSize(descriptionText, contentWidth - 8);
      // Nur sicherstellen, dass der Tages-Kopf passt; der Text fliesst danach ueber die Seiten.
      addNewPageIfNeeded(40);
      doc.setFillColor(230, 230, 230); doc.rect(marginLeft, y, contentWidth, 9, "F");
      const wdIdx = weekdays.indexOf(day.weekday);
      const wdLabel = (wdIdx >= 0 && t.weekdays && t.weekdays[wdIdx]) ? t.weekdays[wdIdx] : day.weekday;
      doc.setFontSize(11); doc.setFont(FONT, "bold"); doc.text(`${wdLabel} - ${day.date || "-"}`, marginLeft + 3, y + 6); y += 13;
      doc.setFont(FONT, "normal"); doc.setFontSize(9);
      doc.text(`${p.customer}: ${day.customer || "-"}`, marginLeft + 3, y); doc.text(`${p.project}: ${day.projectNumber || "-"}`, marginLeft + 80, y); y += 6;
      doc.text(`${p.hours}: ${day.hours || "-"}`, marginLeft + 3, y); y += 6;
      const siteLines = doc.splitTextToSize(sanitizePdfText(`${p.site}: ${day.site || "-"}`), pageWidth - marginLeft - marginRight - 6);
      siteLines.forEach((ln: string) => { doc.text(ln, marginLeft + 3, y); y += 6; });
      if (day.startTime || day.endTime || day.breakMinutes) { doc.text(`${p.startLabel}: ${day.startTime || "-"}   ${p.endLabel}: ${day.endTime || "-"}   ${p.pauseLabel}: ${day.breakMinutes ? day.breakMinutes + " min" : "-"}`, marginLeft + 3, y); y += 6; }
      if (day.travelOutStart || day.travelOutEnd || day.travelOutKm || day.travelReturnStart || day.travelReturnEnd || day.travelReturnKm) {
        doc.text(sanitizePdfText(`${t.travelTime}:`), marginLeft + 3, y); y += 6;
        if (day.travelOutStart || day.travelOutEnd || day.travelOutKm) { doc.text(sanitizePdfText(`  ${t.travelOut}: ${day.travelOutStart || "-"} - ${day.travelOutEnd || "-"}   ${day.travelOutKm ? day.travelOutKm + " km" : "-"}`), marginLeft + 3, y); y += 6; }
        if (day.travelReturnStart || day.travelReturnEnd || day.travelReturnKm) { doc.text(sanitizePdfText(`  ${t.travelReturn}: ${day.travelReturnStart || "-"} - ${day.travelReturnEnd || "-"}   ${day.travelReturnKm ? day.travelReturnKm + " km" : "-"}`), marginLeft + 3, y); y += 6; }
      }
      y += 2;
      doc.setFont(FONT, "bold"); doc.text(`${p.description}:`, marginLeft + 3, y); y += 6;
      doc.setFont(FONT, "normal");
      for (const line of splitDescription) { addNewPageIfNeeded(6); doc.text(line, marginLeft + 3, y); y += 5; }
      y += 5;
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
      // Zusatzeintraege (zweiter Arbeitsschritt am selben Tag) mit eigener Zeit/Fahrzeit/km.
      for (const ex of (day.extra || [])) {
        addNewPageIfNeeded(34);
        doc.setDrawColor(120); doc.setLineWidth(0.2); doc.line(marginLeft + 3, y, pageWidth - marginRight - 3, y); y += 5; doc.setDrawColor(0);
        doc.setFont(FONT, "bold"); doc.setFontSize(9);
        doc.text(sanitizePdfText(`+ ${p.customer}: ${ex.customer || "-"}`), marginLeft + 3, y); doc.text(sanitizePdfText(`${p.project}: ${ex.projectNumber || "-"}`), marginLeft + 80, y); y += 6;
        doc.setFont(FONT, "normal");
        doc.text(`${p.hours}: ${ex.hours || "-"}`, marginLeft + 3, y); y += 6;
        if (ex.site) { const sl = doc.splitTextToSize(sanitizePdfText(`${p.site}: ${ex.site}`), contentWidth - 6); sl.forEach((ln: string) => { doc.text(ln, marginLeft + 3, y); y += 6; }); }
        if (ex.startTime || ex.endTime || ex.breakMinutes) { doc.text(`${p.startLabel}: ${ex.startTime || "-"}   ${p.endLabel}: ${ex.endTime || "-"}   ${p.pauseLabel}: ${ex.breakMinutes ? ex.breakMinutes + " min" : "-"}`, marginLeft + 3, y); y += 6; }
        if (ex.travelOutStart || ex.travelOutEnd || ex.travelOutKm || ex.travelReturnStart || ex.travelReturnEnd || ex.travelReturnKm) {
          doc.text(sanitizePdfText(`${t.travelTime}:`), marginLeft + 3, y); y += 6;
          if (ex.travelOutStart || ex.travelOutEnd || ex.travelOutKm) { doc.text(sanitizePdfText(`  ${t.travelOut}: ${ex.travelOutStart || "-"} - ${ex.travelOutEnd || "-"}   ${ex.travelOutKm ? ex.travelOutKm + " km" : "-"}`), marginLeft + 3, y); y += 6; }
          if (ex.travelReturnStart || ex.travelReturnEnd || ex.travelReturnKm) { doc.text(sanitizePdfText(`  ${t.travelReturn}: ${ex.travelReturnStart || "-"} - ${ex.travelReturnEnd || "-"}   ${ex.travelReturnKm ? ex.travelReturnKm + " km" : "-"}`), marginLeft + 3, y); y += 6; }
        }
        const exText = (ex.translation || "").trim() || (ex.description || "").trim();
        if (exText) {
          doc.setFont(FONT, "bold"); doc.text(`${p.description}:`, marginLeft + 3, y); y += 6; doc.setFont(FONT, "normal");
          const exLines = doc.splitTextToSize(sanitizePdfText(exText), contentWidth - 8);
          for (const line of exLines) { addNewPageIfNeeded(6); doc.text(line, marginLeft + 3, y); y += 5; }
        }
        y += 3;
      }
      doc.setDrawColor(200); doc.line(marginLeft, y, pageWidth - marginRight, y); y += 10; doc.setDrawColor(0);
    }
    const sigW = 70; const sigH = 21;
    const anySig = !!(pdfSigEmployee || pdfSigCustomer);
    addNewPageIfNeeded(anySig ? 92 : 65);
    doc.setFontSize(12); doc.setFont(FONT, "bold"); doc.text(p.summary, marginLeft, y); y += 8;
    doc.setFontSize(10); doc.setFont(FONT, "normal");
    doc.text(`${p.totalHours}: ${totalHours.toString().replace(".", ",")} ${p.hours}`, marginLeft, y); y += 8;
    Object.entries(projectTotals).forEach(([project, total]) => { doc.text(sanitizePdfText(`${p.project} ${project}: ${total.toString().replace(".", ",")} ${p.hours}${travelKmByProject[project] ? ` · ${formatKm(travelKmByProject[project])} ${t.km}` : ""}`), marginLeft, y); y += 6; });
    if (totalTravelMinutes > 0 || totalTravelKm > 0) { doc.text(sanitizePdfText(`${t.travelTime} (${t.total}): ${formatTravelTime(totalTravelMinutes)} h · ${totalTravelKmDisplay} ${t.km}`), marginLeft, y); y += 8; }
    y += anySig ? 30 : 18;
    if (pdfSigEmployee) { try { doc.addImage(pdfSigEmployee, "PNG", marginLeft, y - sigH, sigW, sigH); } catch {} }
    if (pdfSigCustomer) { try { doc.addImage(pdfSigCustomer, "PNG", pageWidth - marginRight - sigW, y - sigH, sigW, sigH); } catch {} }
    doc.line(marginLeft, y, marginLeft + 70, y); doc.line(pageWidth - marginRight - 70, y, pageWidth - marginRight, y);
    y += 6; doc.setFontSize(9); doc.text(p.signatureEmployee, marginLeft, y); doc.text(p.signatureCustomer, pageWidth - marginRight - 70, y);
    addFooter();
    // Dateiname = Berichtsname (z. B. "KW 26 - Jasmin 2.pdf"); falls leer -> Projekt_KW_Mitarbeiter
    const illegal = (s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "");
    const nameFromReport = illegal(pdfReportName || "").trim();
    let filename: string;
    if (nameFromReport) {
      filename = `${nameFromReport}.pdf`;
    } else {
      const projectNumbers = Array.from(new Set((pdfDays || []).map((d: any) => (d.projectNumber || "").trim()).filter(Boolean)));
      const projectPart = illegal(projectNumbers.length === 0 ? "Projekt" : projectNumbers.join("-")).replace(/\s+/g, "_");
      const kwPart = illegal(pdfCalendarWeek || "Woche").replace(/\s+/g, "");
      const employeePart = illegal(pdfEmployee || "Mitarbeiter").replace(/\s+/g, "_");
      filename = `${projectPart}_${kwPart}_${employeePart}.pdf`;
    }
    if (sendByEmail) {
      if (!companyFeatures?.email_enabled) { setMessage(t.msgEmailNotEnabled); return; }
      if (!emailTo.trim()) { setMessage(t.msgEmailRequired); return; }
      setMessage(t.msgEmailSending);
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      const res = await fetch("/api/send-report", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ to: emailTo, subject: `${p.title} ${pdfCalendarWeek || ""}`, pdfBase64, filename }) });
      const data = await res.json();
      if (data.error) { setMessage("Fehler beim E-Mail-Versand: " + data.error); return; }
      // Gedruckt/versendet -> eigenen gespeicherten Bericht ins Archiv verschieben.
      if (!src && currentReportId) await archiveReport(currentReportId, true);
      setMessage(t.msgEmailSent); return;
    }
    doc.save(filename);
    // Gedruckt -> eigenen gespeicherten Bericht ins Archiv verschieben.
    if (!src && currentReportId) await archiveReport(currentReportId, true);
  }

  async function createInstructionPDF(instruction: any) {
    let inst = instruction;
    if (currentCompany) {
      const { data } = await supabase.from("work_instructions").select("*, work_instruction_tasks (*)").eq("id", instruction.id).single();
      if (data) inst = data;
    }
    const p = pdfTexts[uiLanguage as keyof typeof pdfTexts] || pdfTexts["Deutsch" as keyof typeof pdfTexts];
    const doc = new jsPDF("p", "mm", "a4");
    const FONT = await loadPdfFont(doc);
    pdfUnicodeSymbols = FONT === "NotoSans";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 15; const marginRight = 15;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let y = 15;
    // Bei Bedarf in die Anzeige-Sprache uebersetzen (Deutsch = unveraendert).
    const tr = async (text: string): Promise<string> => {
      const src = (text || "").trim();
      if (!src || uiLanguage === "Deutsch") return src;
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: src, fromLanguage: "Deutsch", toLanguage: uiLanguage }) });
        const data = await res.json();
        return (!data.error && data.translation && data.translation.trim()) ? data.translation : src;
      } catch { return src; }
    };
    const addFooter = () => { doc.setFontSize(8); doc.setTextColor(120); doc.text(companySettings?.company_name || currentCompany?.companies?.name || p.company, marginLeft, pageHeight - 10); doc.text(`${p.createdAt}: ${new Date().toLocaleDateString("de-DE")}`, pageWidth - marginRight, pageHeight - 10, { align: "right" }); doc.setTextColor(0); };
    const addNewPageIfNeeded = (neededHeight: number) => { if (y + neededHeight > pageHeight - 25) { addFooter(); doc.addPage(); y = 15; } };
    let logoBase64 = "";
    if (companySettings?.company_logo) {
      try {
        const response = await fetch(companySettings.company_logo);
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob); });
      } catch (error) { console.error("Logo konnte nicht geladen werden:", error); }
    }
    doc.setFillColor(240, 240, 240); doc.rect(0, 0, pageWidth, 70, "F");
    doc.setFontSize(20); doc.setFont(FONT, "bold"); doc.text(sanitizePdfText(t.instructionDoc), marginLeft, y);
    doc.setFontSize(11); doc.setFont(FONT, "normal"); y += 8;
    doc.text(companySettings?.company_name || currentCompany?.companies?.name || "Regie International", marginLeft, y); y += 6;
    if (companySettings?.street) { doc.text(companySettings.street, marginLeft, y); y += 5; }
    if (companySettings?.zip_code || companySettings?.city) { doc.text(`${companySettings?.zip_code || ""} ${companySettings?.city || ""}`, marginLeft, y); y += 5; }
    if (companySettings?.phone) { doc.text(`Tel: ${companySettings.phone}`, marginLeft, y); y += 5; }
    if (companySettings?.email) { doc.text(`E-Mail: ${companySettings.email}`, marginLeft, y); y += 5; }
    y += 7;
    const titleTr = await tr(inst.title || "");
    doc.setFont(FONT, "bold"); doc.setFontSize(13); doc.text(sanitizePdfText(titleTr || "-"), marginLeft, y); doc.setFontSize(11); doc.setFont(FONT, "normal"); y += 6;
    doc.text(sanitizePdfText(`${p.project}: ${inst.project || "-"}`), marginLeft, y); y += 6;
    doc.text(sanitizePdfText(`${p.customer}: ${inst.customer || "-"}`), marginLeft, y);
    if (logoBase64) {
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
    }
    y += 10; if (y < 78) y = 78;
    doc.setFontSize(10);
    doc.text(sanitizePdfText(`${p.site}: ${formatProjectAddress(inst) || "-"}`), marginLeft, y); y += 6;
    doc.text(sanitizePdfText(`${t.date}: ${inst.work_date || "-"}`), marginLeft, y); y += 8;
    const block = async (label: string, value: string) => {
      const v = (value || "").trim();
      if (!v) return;
      const txt = sanitizePdfText(await tr(v));
      addNewPageIfNeeded(14);
      doc.setFont(FONT, "bold"); doc.text(sanitizePdfText(`${label}:`), marginLeft, y); y += 6;
      doc.setFont(FONT, "normal");
      for (const line of doc.splitTextToSize(txt, contentWidth)) { addNewPageIfNeeded(6); doc.text(line, marginLeft, y); y += 5; }
      y += 3;
    };
    await block(t.problems, inst.problems_text || "");
    await block(t.material, inst.material || "");
    if (usedMaterialList(inst).length > 0) {
      await block(t.materialUsed, usedMaterialList(inst).map((m: any) => `${m.qty} ${unitLabel(m.unit, uiLanguage)} ${m.name}`).join(", "));
    }
    await block(t.werkzeug, inst.werkzeug || "");
    const tasks = (inst.work_instruction_tasks || []).slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (tasks.length > 0) {
      addNewPageIfNeeded(12);
      doc.setFont(FONT, "bold"); doc.setFontSize(12); doc.text(sanitizePdfText(`${t.workSteps}:`), marginLeft, y); y += 7;
      doc.setFontSize(10); doc.setFont(FONT, "normal");
      let nr = 1;
      for (const task of tasks) {
        const statusLabel = task.status === "completed" ? t.statusCompleted : task.status === "in_progress" ? t.statusInProgress : task.status === "stopped" ? t.statusStopped : t.statusOpen;
        const taskTextTr = sanitizePdfText(await tr(task.task_text || ""));
        addNewPageIfNeeded(14);
        doc.setFont(FONT, "bold"); doc.text(sanitizePdfText(`${nr}. [${statusLabel}]`), marginLeft, y); doc.setFont(FONT, "normal"); y += 5;
        for (const line of doc.splitTextToSize(taskTextTr, contentWidth - 6)) { addNewPageIfNeeded(6); doc.text(line, marginLeft + 6, y); y += 5; }
        if ((task.note || "").trim()) {
          const noteTr = sanitizePdfText(`${t.feedbackLabel}: ${task.note}`);
          for (const line of doc.splitTextToSize(noteTr, contentWidth - 6)) { addNewPageIfNeeded(6); doc.text(line, marginLeft + 6, y); y += 5; }
        }
        for (const entry of taskCommentList(task)) {
          if (!chatOn && !isMyComment(entry)) continue;
          const raw = (entry?.text || "").trim();
          if (!raw) continue;
          const who = chatOn && entry?.name ? `${entry.name}: ` : "";
          const cTr = sanitizePdfText(`${t.commentLabel}: ${who}${await tr(raw)}`);
          for (const line of doc.splitTextToSize(cTr, contentWidth - 6)) { addNewPageIfNeeded(6); doc.text(line, marginLeft + 6, y); y += 5; }
        }
        y += 3; nr++;
      }
    }
    const photos = (inst.photos || []) as string[];
    if (photos.length > 0 && companyFeatures?.photos_enabled) {
      addNewPageIfNeeded(12);
      doc.setFont(FONT, "bold"); doc.text(sanitizePdfText(`${p.photos}:`), marginLeft, y); y += 6; doc.setFont(FONT, "normal");
      for (let i = 0; i < photos.length; i++) {
        try {
          const response = await fetch(photos[i]);
          const blob = await response.blob();
          const photoBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob); });
          addNewPageIfNeeded(65);
          doc.text(`${p.photo} ${i + 1}:`, marginLeft, y); y += 5;
          doc.addImage(photoBase64, "JPEG", marginLeft, y, 70, 50); y += 56;
        } catch { doc.text(`${p.photo} ${i + 1}: -`, marginLeft, y); y += 6; }
      }
    }
    addFooter();
    const titlePart = (inst.title || "Arbeitsanweisung").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
    const datePart = (inst.work_date || "").replace(/[^0-9-]/g, "");
    const filename = `Arbeitsanweisung_${titlePart || "Anweisung"}${datePart ? "_" + datePart : ""}.pdf`;
    doc.save(filename);
  }

  if (!user) {
    return (
      <main className="max-w-xl mx-auto p-4 md:p-8 space-y-6 bg-slate-100 min-h-screen text-black">
        <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 bg-white">
          <h1 className="text-3xl font-bold">{t.loginTitle}</h1>
          {message && <div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-yellow-100 text-black">{message}</div>}
          <form onSubmit={(e) => { e.preventDefault(); signIn(); }} autoComplete="on" className="space-y-3">
          <div className="space-y-3">
            <input name="company" autoComplete="organization" className="border p-3 w-full text-black bg-white rounded-lg" placeholder="Firmenkürzel (z.B. luger)" value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} />
            <input name="username" autoComplete="username" className="border p-3 w-full text-black bg-white rounded-lg" placeholder="Benutzername (z.B. max)" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="relative">
            <input name="password" autoComplete="current-password" className="border p-3 w-full text-black bg-white pr-12" placeholder={t.password} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">{showPassword ? "🙈" : "👁️"}</button>
          </div>
          <button type="submit" className="bg-cyan-600 text-white px-4 py-3 rounded-lg w-full">{t.login}</button>
          </form>
        </section>
        <footer className="text-center text-xs text-gray-500 mt-6">
          <a href="/impressum" className="underline hover:text-gray-700">Impressum</a>
          <span className="mx-2">·</span>
          <a href="/datenschutz" className="underline hover:text-gray-700">Datenschutz</a>
          <span className="mx-2">·</span>
          <a href="/agb" className="underline hover:text-gray-700">AGB</a>
        </footer>
      </main>
    );
  }

  if (user && mustChangePassword) {
    return (
      <main className="max-w-md mx-auto p-4 md:p-8 min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 w-full shadow-lg">
          <div className="text-center"><div className="text-5xl mb-3">🔐</div><h2 className="text-2xl font-bold">Passwort ändern</h2><p className="text-gray-500 text-sm mt-1">Bitte ändern Sie Ihr temporäres Passwort.</p></div>
          {message && <div className="bg-yellow-50 border border-slate-200 rounded-xl p-3 shadow-sm text-sm">{message}</div>}
          <input className="border p-3 w-full rounded-lg text-black" placeholder="Neues Passwort (min. 8 Zeichen)" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input className="border p-3 w-full rounded-lg text-black" placeholder="Passwort bestätigen" type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} />
          <button type="button" onClick={changePassword} disabled={changingPassword} className="w-full bg-cyan-700 text-white py-3 rounded-lg font-bold disabled:opacity-50">{changingPassword ? "Wird gespeichert..." : "Passwort speichern & weiter"}</button>
        </div>
      </main>
    );
  }

  if (user && companyBlocked) {
    return (
      <main className="max-w-md mx-auto p-4 md:p-8 min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 w-full shadow-lg text-center">
          <div className="text-6xl mb-2">🔒</div>
          <h2 className="text-2xl font-bold text-red-700">Konto gesperrt</h2>
          <p className="text-gray-600">Dieses Firmenkonto ist derzeit gesperrt. Bitte kontaktieren Sie Ihren Anbieter, um den Zugang wieder freizuschalten.</p>
          <button type="button" onClick={signOut} className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold">Abmelden</button>
        </div>
      </main>
    );
  }

  if (user && showOnboarding && false) {
    return (
      <main className="max-w-xl mx-auto p-4 md:p-8 min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 w-full shadow-lg">
          <div className="flex items-center gap-2 mb-2">{[1, 2, 3].map((step) => (<div key={step} className={`flex-1 h-2 rounded-full ${onboardingStep >= step ? "bg-cyan-600" : "bg-gray-200"}`} />))}</div>
          {onboardingStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">👋 Willkommen!</h2>
              <p className="text-gray-600">Bitte hinterlegen Sie zuerst Ihre Firmendaten.</p>
              <div className="space-y-3">
                <input className="border p-3 w-full rounded-lg text-black" placeholder="Firmenname *" value={companySettings?.company_name || ""} onChange={(e) => updateCompanyField("company_name", e.target.value)} />
                <input className="border p-3 w-full rounded-lg text-black" placeholder="Straße" value={companySettings?.street || ""} onChange={(e) => updateCompanyField("street", e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="border p-3 rounded-lg text-black" placeholder="PLZ" value={companySettings?.zip_code || ""} onChange={(e) => updateCompanyField("zip_code", e.target.value)} />
                  <input className="border p-3 rounded-lg text-black" placeholder="Ort" value={companySettings?.city || ""} onChange={(e) => updateCompanyField("city", e.target.value)} />
                </div>
              </div>
              <button type="button" onClick={() => { if (!companySettings?.company_name?.trim()) { setMessage("Bitte Firmenname eingeben."); return; } setOnboardingStep(2); }} className="w-full bg-cyan-700 text-white py-3 rounded-lg font-bold">Weiter →</button>
            </div>
          )}
          {onboardingStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">📞 Kontaktdaten</h2>
              <div className="space-y-3">
                <input className="border p-3 w-full rounded-lg text-black" placeholder="Telefon" value={companySettings?.phone || ""} onChange={(e) => updateCompanyField("phone", e.target.value)} />
                <input className="border p-3 w-full rounded-lg text-black" placeholder="E-Mail" value={companySettings?.email || ""} onChange={(e) => updateCompanyField("email", e.target.value)} />
                <input className="border p-3 w-full rounded-lg text-black" placeholder="Webseite" value={companySettings?.website || ""} onChange={(e) => updateCompanyField("website", e.target.value)} />
                <input className="border p-3 w-full rounded-lg text-black" placeholder="UID / Steuernummer" value={companySettings?.tax_number || ""} onChange={(e) => updateCompanyField("tax_number", e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setOnboardingStep(1)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium">← Zurück</button>
                <button type="button" onClick={() => setOnboardingStep(3)} className="flex-1 bg-cyan-700 text-white py-3 rounded-lg font-bold">Weiter →</button>
              </div>
            </div>
          )}
          {onboardingStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">🖼️ Firmenlogo</h2>
              <p className="text-gray-600">Optional — kann später hinzugefügt werden.</p>
              {companySettings?.company_logo && (<img src={companySettings?.company_logo} alt="Logo" className="h-20 object-contain border rounded-lg p-2" />)}
              <input type="file" accept="image/*" className="border p-3 w-full rounded-lg text-black bg-white" onChange={(e) => uploadCompanyLogo(e.target.files)} />
              {message && <div className="bg-yellow-50 border border-slate-200 rounded-xl p-3 shadow-sm text-sm">{message}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setOnboardingStep(2)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium">← Zurück</button>
                <button type="button" onClick={saveOnboarding} className="flex-1 bg-green-700 text-white py-3 rounded-lg font-bold">✅ Speichern & Starten</button>
              </div>
              <button type="button" onClick={() => setShowOnboarding(false)} className="w-full text-gray-400 text-sm underline">Überspringen</button>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 bg-slate-100 min-h-screen text-black overflow-x-hidden">
      <header className="bg-cyan-600 rounded-2xl p-5 space-y-1 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-bold text-white">{t.title}</h1>
        <p className="text-cyan-100 text-sm">{t.subtitle}</p>
        <p className="text-cyan-50 text-sm break-words">{t.loggedInAs}: <strong className="text-white">{user.email}</strong></p>
        {currentCompany && (<p className="text-cyan-50 text-sm break-words">{t.firma}: <strong>{currentCompany.companies.name}</strong> | {t.role}: <strong>{currentCompany.role === "owner" ? "Owner" : currentCompany.role === "admin" ? t.roleAdmin : currentCompany.role === "project_manager" ? t.roleProjectManager : t.roleEmployee}</strong></p>)}
        <p className="text-cyan-100 text-xs break-words mt-1">⚠️ {t.translatorHint}</p>
        <div className="flex items-center flex-wrap gap-2 mt-3">
          <button type="button" onClick={signOut} className="bg-white text-cyan-700 px-4 py-2.5 rounded-lg font-medium">{t.logout}</button>
          <button type="button" onClick={refreshAll} disabled={refreshing} title="Aktualisieren" className="bg-cyan-700 text-white px-4 py-2.5 rounded-lg disabled:opacity-50">{refreshing ? "⏳" : "🔄"}</button>
          <button type="button" onClick={openHelp} title={t.help} aria-label={t.help} className="bg-cyan-700 text-white px-4 py-2.5 rounded-lg">❓</button>
          {currentCompany?.role !== "employee" && (<select className="p-2.5 rounded-lg text-black bg-white text-sm border-0" value={uiLanguage} onChange={(e) => {
            // Sprache umschalten + pro Benutzer in der DB merken (geraeteuebergreifend).
            const newLang = e.target.value as Language;
            setUiLanguage(newLang);
            if (user?.id) { supabase.from("company_users").update({ preferred_language: newLang }).eq("user_id", user.id); }
          }}>
            {getAllowedLanguages(companyFeatures).filter(l => languages.includes(l as Language)).map((lang) => (<option key={lang} value={lang}>🌐 {lang}</option>))}
          </select>)}
        </div>
      </header>

      {/* Hauptansichten: immer sichtbar */}
      <nav className="flex flex-wrap gap-2">
        <TabButton label={t.dashboard}          tabName="dashboard"          activeTab={activeTab} onClick={() => setActiveTab("dashboard")} />
        <TabButton label={t.tabDay}             tabName="tag"                activeTab={activeTab} onClick={() => { setActiveTab("tag"); if (currentCompany) loadWorkInstructions(currentCompany.company_id); }} />
        <TabButton label={t.tabWeek}            tabName="woche"              activeTab={activeTab} onClick={() => { setActiveTab("woche"); if (currentCompany) loadWorkInstructions(currentCompany.company_id); }} />
        <TabButton label={t.tabMonth}           tabName="monat"              activeTab={activeTab} onClick={() => { setActiveTab("monat"); if (currentCompany) loadWorkInstructions(currentCompany.company_id); }} />
        {companyFeatures?.translator_enabled && (
        <TabButton label={`🌐 ${t.translatorTab}`} tabName="uebersetzer" activeTab={activeTab} onClick={() => setActiveTab("uebersetzer")} />
        )}
        {/* Mitarbeiter: "Mehr"-Umschalter. Manager sehen alle Buttons direkt. */}
        {!(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (() => { const showMore = moreTabsOpen || !["dashboard", "tag", "woche", "monat", "uebersetzer"].includes(activeTab); return (
        <button type="button" onClick={() => setMoreTabsOpen((v) => !v)} className={`px-5 py-3 rounded-full text-sm font-medium transition-colors border ${showMore ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
          {showMore ? "▾" : "▸"} {tx.moreTabs}
        </button>
        ); })()}
      </nav>

      {/* Weitere Ansichten: Manager immer; Mitarbeiter nur aufgeklappt oder wenn eine davon aktiv ist */}
      {((currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") || moreTabsOpen || !["dashboard", "tag", "woche", "monat", "uebersetzer"].includes(activeTab)) && (
      <nav className="flex flex-wrap gap-2 border border-slate-200 rounded-2xl p-3 bg-slate-50">
        <TabButton label={t.tabReport}          tabName="regiebericht"       activeTab={activeTab} onClick={() => setActiveTab("regiebericht")} />
        <TabButton label={t.saveLoad}           tabName="berichte"           activeTab={activeTab} onClick={() => { setActiveTab("berichte"); loadAllReports(); }} />
        {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
          <TabButton label={t.projectsTab}      tabName="projekte"           activeTab={activeTab} onClick={() => { setActiveTab("projekte"); loadProjects(); }} />
        )}
        {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
          <TabButton label={t.workInstructions}   tabName="arbeitsanweisungen" activeTab={activeTab} onClick={() => setActiveTab("arbeitsanweisungen")} />
        )}
        {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
          <TabButton label={t.employeeManagement} tabName="mitarbeiter"      activeTab={activeTab} onClick={() => setActiveTab("mitarbeiter")} />
        )}
        {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
          <TabButton label={t.teamReports}       tabName="teamberichte"      activeTab={activeTab} onClick={() => { setActiveTab("teamberichte"); loadTeamReports(); }} />
        )}
        {(currentCompany?.role === "owner" || currentCompany?.role === "admin") && (
          <TabButton label={t.companyData}      tabName="firmendaten"        activeTab={activeTab} onClick={() => setActiveTab("firmendaten")} />
        )}
        {companyFeatures?.material_enabled && (currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
        <TabButton label={`📦 ${t.materialCatalog}`} tabName="material" activeTab={activeTab} onClick={() => { setActiveTab("material"); loadMaterialCatalog(); }} />
        )}
        {companyFeatures?.material_enabled && !readOnlyUser && (
        <TabButton label={`🛒 ${t.materialOrders}`} tabName="bestellungen" activeTab={activeTab} onClick={() => { setActiveTab("bestellungen"); loadMaterialOrders(); }} />
        )}
        {companyFeatures?.export_enabled && (currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
        <TabButton label={`📊 ${t.exportTab}`} tabName="export" activeTab={activeTab} onClick={() => { setActiveTab("export"); loadTeamReports(); }} />
        )}
        {companyFeatures?.equipment_enabled && !readOnlyUser && (
        <TabButton label={`🚚 ${t.equipmentTab}`} tabName="geraete" activeTab={activeTab} onClick={() => { setActiveTab("geraete"); loadEquipment(); loadEquipmentPlans(); }} />
        )}
        {companyFeatures?.absence_enabled && (
        <TabButton label={`🌴 ${t.absenceTab}`} tabName="urlaub" activeTab={activeTab} onClick={() => { setActiveTab("urlaub"); loadAbsences(); }} />
        )}
        {companyFeatures?.feedback_enabled && !readOnlyUser && (
        <TabButton label={`💬 ${t.feedbackTab}`} tabName="feedback" activeTab={activeTab} onClick={() => { setActiveTab("feedback"); if (currentCompany && (currentCompany.role === "owner" || currentCompany.role === "admin" || currentCompany.role === "project_manager")) loadFeedback(); }} />
        )}
      </nav>
      )}

      {message && <div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-yellow-100 text-black">{message}</div>}

      {activeTab === "dashboard" && (
        <section className="space-y-4">
          {(() => {
            const today = new Date().toISOString().split("T")[0];
            const todayDate = new Date(today + "T00:00:00Z");
            const addDays = (n: number) => { const d = new Date(todayDate); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().split("T")[0]; };
            const tomorrow = addDays(1);
            const dow = todayDate.getUTCDay();
            const diffToMon = dow === 0 ? -6 : 1 - dow;
            const weekStart = addDays(diffToMon);
            const weekEnd = addDays(diffToMon + 6);
            const nextWeekStart = addDays(diffToMon + 7);
            const nextWeekEnd = addDays(diffToMon + 13);
            const winStart = dashRange === "nextweek" ? nextWeekStart : dashRange === "week" ? weekStart : dashRange === "tomorrow" ? tomorrow : today;
            const winEnd = dashRange === "nextweek" ? nextWeekEnd : dashRange === "week" ? weekEnd : dashRange === "tomorrow" ? tomorrow : today;
            const rangeLabel = dashRange === "nextweek" ? `${nextWeekStart} – ${nextWeekEnd}` : dashRange === "week" ? `${weekStart} – ${weekEnd}` : dashRange === "tomorrow" ? tomorrow : today;
            const visible = workInstructions.filter(canSeeInstruction);
            const groups: Record<string, any> = {};
            for (const i of visible) {
              const key = i.project_id || i.project || "__none__";
              if (!groups[key]) groups[key] = { name: i.project || t.noProject, customer: i.customer || "", site: i.site || "", instructions: [] };
              if (!groups[key].customer && i.customer) groups[key].customer = i.customer;
              if (!groups[key].site && i.site) groups[key].site = i.site;
              groups[key].instructions.push(i);
            }
            const dashRole = currentCompany?.role;
            if (dashRole === "owner" || dashRole === "admin") {
              for (const pr of projects) {
                if (!groups[pr.id]) groups[pr.id] = { name: pr.name || t.noProject, customer: pr.customer || "", site: pr.site || "", instructions: [] };
              }
            }
            const isManager = dashRole === "owner" || dashRole === "admin" || dashRole === "project_manager";
            const statusRank: Record<string, number> = { stopped: 0, in_progress: 1, open: 2, completed: 3 };
            const built = Object.entries(groups).map(([gkey, g]: [string, any]) => {
              const rows: any[] = [];
              const relevant = new Set<any>();
              let winTotal = 0, winDone = 0;
              for (const inst of g.instructions) {
                const wd = inst.work_date || "";
                const inWindow = !!wd && wd >= winStart && wd <= winEnd;
                for (const task of (inst.work_instruction_tasks || [])) {
                  const st = task.status || "open";
                  const overdueOpen = !!wd && wd < today && st !== "completed";
                  if (inWindow || overdueOpen) {
                    winTotal++;
                    relevant.add(inst);
                    if (st === "completed") { winDone++; }
                    else { rows.push({ task, inst, date: wd, overdue: wd < today && st !== "completed" }); }
                  }
                }
              }
              rows.sort((a, b) => (a.date || "").localeCompare(b.date || "") || ((statusRank[a.task.status || "open"] ?? 2) - (statusRank[b.task.status || "open"] ?? 2)));
              const stoppedN = rows.filter((r) => r.task.status === "stopped").length;
              const doneN = winDone;
              let unread = 0, totalAssign = 0;
              relevant.forEach((inst: any) => {
                const readerIds = new Set((inst.instruction_reads || []).map((r: any) => r.user_id));
                for (const uid of (inst.assigned_user_ids || [])) { totalAssign++; if (!readerIds.has(uid)) unread++; }
              });
              return { key: gkey, g, rows, stoppedN, doneN, winTotal, unread, totalAssign };
            });
            built.sort((a, b) => {
              const ra = a.stoppedN > 0 ? 0 : a.rows.length > 0 ? 1 : 2;
              const rb = b.stoppedN > 0 ? 0 : b.rows.length > 0 ? 1 : 2;
              return ra - rb;
            });
            const dashShown = built.filter((b: any) => b.rows.length > 0);
            return (
              <>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <h2 className="text-xl font-bold">{t.dashMyProjects}</h2>
                  <p className="text-gray-500 text-sm">{rangeLabel} · {dashShown.length} {t.projects}</p>
                  <div className="flex gap-2 mt-3">
                    {([["today", t.dashToday], ["tomorrow", t.dashTomorrow], ["week", t.dashWeek], ["nextweek", t.dashNextWeek]] as [string, string][]).map(([val, lbl]) => (
                      <button key={val} type="button" onClick={() => setDashRange(val)} className={`px-3 py-1 rounded-lg text-sm ${dashRange === val ? "bg-cyan-600 text-white" : "bg-gray-100 text-gray-700"}`}>{lbl}</button>
                    ))}
                  </div>
                </div>
                {dashShown.length === 0 && (<div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-gray-500 text-center shadow-sm">{built.length === 0 ? t.dashNoProjects : t.dashNothingToday}</div>)}
                {dashShown.map((b) => {
                  const dOpen = openDashProjects[b.key] === true;
                  return (
                  <div key={b.key} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-3 cursor-pointer select-none" onClick={() => setOpenDashProjects((prev) => ({ ...prev, [b.key]: !(prev[b.key] === true) }))}>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg break-words">{dOpen ? "▾" : "▸"} {b.g.name}</h3>
                        {(b.g.customer || b.g.site) && (<p className="text-gray-500 text-sm break-words">{[b.g.customer, b.g.site].filter(Boolean).join(" · ")}</p>)}
                        {isManager && b.totalAssign > 0 && (<p className={`text-xs ${b.unread > 0 ? "text-orange-600" : "text-green-600"}`}>{b.unread > 0 ? `👁 ${b.unread} ${t.readUnread}` : `✅ ${t.readAllDone}`}</p>)}
                      </div>
                      {b.stoppedN > 0 ? (
                        <span className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded-lg whitespace-nowrap">{b.stoppedN} {t.statusStopped}</span>
                      ) : b.rows.length > 0 ? (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg whitespace-nowrap">{b.doneN} / {b.winTotal} {t.dashDone}</span>
                      ) : null}
                    </div>
                    {dOpen && (b.rows.length === 0 ? (
                      <p className="text-gray-400 text-sm">{t.dashNothingToday}</p>
                    ) : (
                      <div className="space-y-2">
                        {b.rows.map((r, ri) => {
                          const s = r.task.status || "open";
                          const icon = s === "completed" ? "✅" : s === "stopped" ? "⛔" : s === "in_progress" ? "🟡" : "⚪";
                          return (
                            <div key={ri} className="flex items-center gap-2 text-sm">
                              <span>{icon}</span>
                              <span className={`flex-1 break-words ${s === "completed" ? "line-through text-gray-400" : ""}`}>{getTranslatedTask(r.inst.id, r.task.id, r.task.task_text)}</span>
                              {r.date && r.date !== today ? (<span className={r.overdue ? "text-xs text-red-600 whitespace-nowrap" : "text-xs text-gray-500 whitespace-nowrap"}>{r.overdue ? t.dashOverdue + ": " : ""}{r.date}</span>) : (r.task.note ? (<span className="text-xs text-gray-500 whitespace-nowrap break-words">{getTranslatedTask(r.inst.id, `note_${r.task.id}`, r.task.note)}</span>) : null)}
                              <button type="button" onClick={() => openInstructionFromDashboard(r.inst)} title={t.dashOpen} aria-label={t.dashOpen} className="text-cyan-700 hover:text-cyan-800 shrink-0 px-1 font-bold">→</button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  );
                })}
              </>
            );
          })()}
        </section>
      )}

      {activeTab === "regiebericht" && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 bg-white text-black">
            <h2 className="text-xl font-bold">{t.general}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border p-3 text-black bg-white" placeholder={t.employee} value={employee} onChange={(e) => setEmployee(e.target.value)} />
              <input className="border p-3 bg-gray-200 text-black" value={calendarWeek} readOnly placeholder={t.calendarWeek} />
              {companyFeatures?.email_enabled ? <input className="border p-3 text-black bg-white md:col-span-2" placeholder={t.recipientEmail} value={emailTo} onChange={(e) => setEmailTo(e.target.value)} /> : <div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50 text-sm text-gray-400 md:col-span-2">🔒 E-Mail-Versand ist in deinem Paket nicht aktiviert.</div>}
            </div>
          </section>
          <section className="border rounded-lg bg-white text-black">
            <div className="p-4 cursor-pointer select-none flex justify-between items-center" onClick={() => setReportExpanded(v => !v)}>
              <h2 className="text-xl font-bold">{reportExpanded ? "▾" : "▸"} {t.tabReport}{reportName ? ` — ${t.calendarWeek}: ${reportName}` : (calendarWeek ? ` — ${t.calendarWeek}: ${calendarWeek}` : "")}{reportName ? "" : (employee ? ` — ${employee}` : "")}</h2>
            </div>
          </section>
          {reportExpanded && (<>
          {days.map((day, index) => (
            <section key={day.weekday} className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 bg-white text-black">
              <h2 className="text-xl font-bold cursor-pointer select-none" onClick={() => setOpenReportDays(prev => ({ ...prev, [day.weekday]: !prev[day.weekday] }))}>{openReportDays[day.weekday] ? "▾" : "▸"} {t.weekdays[index] || day.weekday}{(day.description || day.hours || day.customer || day.projectNumber || day.site || (day.photos && day.photos.length > 0)) ? <span className="inline-block w-3 h-3 rounded-full bg-green-500 ml-2 align-middle"></span> : null}</h2>
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
                <div className="md:col-span-2 border-t pt-3 mt-1 space-y-3">
                  <p className="text-sm font-semibold text-gray-600">{t.travelTime}</p>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t.travelOut}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="text-xs text-gray-500 block mb-1">{t.startTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={day.travelOutStart || ""} onChange={(e) => updateDay(index, "travelOutStart", e.target.value)} /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">{t.endTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={day.travelOutEnd || ""} onChange={(e) => updateDay(index, "travelOutEnd", e.target.value)} /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">{t.km}</label><input type="number" min="0" className="border p-2 w-full text-black bg-white" value={day.travelOutKm || ""} onChange={(e) => updateDay(index, "travelOutKm", e.target.value)} /></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t.travelReturn}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="text-xs text-gray-500 block mb-1">{t.startTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={day.travelReturnStart || ""} onChange={(e) => updateDay(index, "travelReturnStart", e.target.value)} /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">{t.endTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={day.travelReturnEnd || ""} onChange={(e) => updateDay(index, "travelReturnEnd", e.target.value)} /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">{t.km}</label><input type="number" min="0" className="border p-2 w-full text-black bg-white" value={day.travelReturnKm || ""} onChange={(e) => updateDay(index, "travelReturnKm", e.target.value)} /></div>
                    </div>
                  </div>
                </div>
              </div>
              <AutoTextarea className="border p-3 w-full text-black bg-white resize-none overflow-hidden" placeholder={t.description} value={day.description} onChange={(v) => updateDay(index, "description", v)} />
              <button type="button" onClick={() => insertWeatherIntoDay(index, day.description)} title={t.weather} className="bg-cyan-50 text-cyan-700 border border-cyan-200 px-3 py-2 rounded-lg text-sm w-fit">🌦️ {t.weather}</button>
              {companyFeatures?.photos_enabled ? <input type="file" accept="image/*" multiple className="border p-3 w-full text-black bg-white" onChange={(e) => handlePhotos(index, e.target.files)} /> : <div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50 text-sm text-gray-400">🔒 Foto-Upload ist in deinem Paket nicht aktiviert.</div>}
              {day.photos.length > 0 && (<div className="grid grid-cols-2 gap-3">{day.photos.map((photo, photoIndex) => (<div key={photoIndex} className="border rounded-lg p-2"><img src={photo} alt="Foto" className="w-full h-32 object-cover" /><button type="button" onClick={() => deletePhoto(index, photoIndex)} className="mt-2 bg-red-600 text-white px-2 py-2.5 rounded-lg w-full">{t.deletePhoto}</button></div>))}</div>)}
              {day.translation && (<div className="border p-3 rounded-lg bg-gray-100 text-black"><strong>{t.translation}:</strong><p className="whitespace-pre-wrap break-words mt-1 leading-relaxed">{day.translation}</p></div>)}
              {/* Zusatzeintraege: zweiter Arbeitsschritt mit eigener Zeit/Fahrzeit/km */}
              {(day.extra || []).map((ex, exIndex) => (
                <div key={exIndex} className="border-2 border-cyan-200 rounded-xl p-3 bg-cyan-50/40 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold text-cyan-800">➕ {tx.extraEntry} {exIndex + 2}</p>
                    <button type="button" onClick={() => removeExtraEntry(index, exIndex)} className="text-xs px-2 py-1 rounded border text-red-600 bg-white">🗑️ {tx.removeEntry}</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="border p-3 text-black bg-white" placeholder={t.customer} value={ex.customer} onChange={(e) => updateExtra(index, exIndex, "customer", e.target.value)} />
                    <input className="border p-3 text-black bg-white" placeholder={t.projectNumber} value={ex.projectNumber} onChange={(e) => updateExtra(index, exIndex, "projectNumber", e.target.value)} />
                    <input className="border p-3 text-black bg-white md:col-span-2" placeholder={t.site} value={ex.site} onChange={(e) => updateExtra(index, exIndex, "site", e.target.value)} />
                    <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><label className="text-xs text-gray-500 block mb-1">{t.startTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={ex.startTime || ""} onChange={(e) => updateExtra(index, exIndex, "startTime", e.target.value)} /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">{t.endTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={ex.endTime || ""} onChange={(e) => updateExtra(index, exIndex, "endTime", e.target.value)} /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">{t.breakLabel}</label><input type="number" min="0" step="5" className="border p-2 w-full text-black bg-white" value={ex.breakMinutes || ""} onChange={(e) => updateExtra(index, exIndex, "breakMinutes", e.target.value)} /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">{t.hours}</label><input className="border p-2 w-full text-black bg-white" value={ex.hours} readOnly={!!(ex.startTime && ex.endTime)} onChange={(e) => updateExtra(index, exIndex, "hours", e.target.value)} /></div>
                    </div>
                    <div className="md:col-span-2 border-t pt-3 space-y-3">
                      <p className="text-sm font-semibold text-gray-600">{t.travelTime}</p>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t.travelOut}</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div><label className="text-xs text-gray-500 block mb-1">{t.startTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={ex.travelOutStart || ""} onChange={(e) => updateExtra(index, exIndex, "travelOutStart", e.target.value)} /></div>
                          <div><label className="text-xs text-gray-500 block mb-1">{t.endTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={ex.travelOutEnd || ""} onChange={(e) => updateExtra(index, exIndex, "travelOutEnd", e.target.value)} /></div>
                          <div><label className="text-xs text-gray-500 block mb-1">{t.km}</label><input type="number" min="0" className="border p-2 w-full text-black bg-white" value={ex.travelOutKm || ""} onChange={(e) => updateExtra(index, exIndex, "travelOutKm", e.target.value)} /></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t.travelReturn}</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div><label className="text-xs text-gray-500 block mb-1">{t.startTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={ex.travelReturnStart || ""} onChange={(e) => updateExtra(index, exIndex, "travelReturnStart", e.target.value)} /></div>
                          <div><label className="text-xs text-gray-500 block mb-1">{t.endTime}</label><input type="time" className="border p-2 w-full text-black bg-white" value={ex.travelReturnEnd || ""} onChange={(e) => updateExtra(index, exIndex, "travelReturnEnd", e.target.value)} /></div>
                          <div><label className="text-xs text-gray-500 block mb-1">{t.km}</label><input type="number" min="0" className="border p-2 w-full text-black bg-white" value={ex.travelReturnKm || ""} onChange={(e) => updateExtra(index, exIndex, "travelReturnKm", e.target.value)} /></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <AutoTextarea className="border p-3 w-full text-black bg-white resize-none overflow-hidden" placeholder={t.description} value={ex.description} onChange={(v) => updateExtra(index, exIndex, "description", v)} />
                  {ex.translation && (<div className="border p-3 rounded-lg bg-gray-100 text-black"><strong>{t.translation}:</strong><p className="whitespace-pre-wrap break-words mt-1 leading-relaxed">{ex.translation}</p></div>)}
                </div>
              ))}
              <button type="button" onClick={() => addExtraEntry(index)} className="bg-cyan-100 text-cyan-800 border border-cyan-300 px-3 py-2 rounded-lg text-sm w-fit">{tx.addEntry}</button>
              </>)}
            </section>
          ))}
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2 bg-white text-black">
            <h2 className="text-xl font-bold">{t.hoursOverview}</h2>
            <p><strong>{t.total}:</strong> {totalHours.toString().replace(".", ",")} {t.hours}</p>
            {Object.entries(projectTotals).map(([project, total]) => (<p key={project}><strong>{t.projectNumber} {project}:</strong> {total.toString().replace(".", ",")} {t.hours}{travelKmByProject[project] ? ` · ${formatKm(travelKmByProject[project])} ${t.km}` : ""}</p>))}
            {(totalTravelMinutes > 0 || totalTravelKm > 0) && (<p><strong>{t.travelTime} ({t.total}):</strong> {formatTravelTime(totalTravelMinutes)} h · {totalTravelKmDisplay} {t.km}</p>)}
          </section>
          </>)}
          {companyFeatures?.signature_enabled && (
            <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 bg-white text-black">
              <h2 className="text-xl font-bold">✍️ Unterschriften</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SignaturePad label={pdfTexts[uiLanguage as keyof typeof pdfTexts]?.signatureEmployee || "Unterschrift Mitarbeiter"} value={sigEmployee} onChange={setSigEmployee} />
                <SignaturePad label={pdfTexts[uiLanguage as keyof typeof pdfTexts]?.signatureCustomer || "Unterschrift Kunde / Bauleitung"} value={sigCustomer} onChange={setSigCustomer} />
              </div>
            </section>
          )}
          <div className="flex flex-wrap gap-4">
            <button type="button" onClick={saveReport} className="bg-orange-600 text-white px-4 py-3 rounded-lg">{currentReportId ? t.update : t.save}</button>
            {reportLoaded && <button type="button" onClick={saveAsNewReport} className="bg-amber-700 text-white px-4 py-3 rounded-lg">{t.saveAsNew}</button>}
            <button type="button" onClick={() => createPDF(false)} className="bg-green-600 text-white px-4 py-3 rounded-lg">{t.downloadPdf}</button>
            {companyFeatures?.email_enabled && <button type="button" onClick={() => createPDF(true)} className="bg-purple-600 text-white px-4 py-3 rounded-lg">{t.sendPdf}</button>}
          </div>
        </div>
      )}

      {activeTab === "berichte" && (
        <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.saveLoad}</h2>
          <input className="border p-3 w-full text-black bg-white" placeholder={t.reportName} value={reportName} onChange={(e) => setReportName(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={saveReport} className="bg-orange-600 text-white px-4 py-3 rounded-lg">{currentReportId ? t.updateReport : t.saveReport}</button>
            <button type="button" onClick={() => { newReport(); setMessage(t.msgNewReport); }} className="bg-gray-700 text-white px-4 py-3 rounded-lg">{t.newReport}</button>
          </div>
          {(() => {
            const isAdminOwner = currentCompany?.role === "owner" || currentCompany?.role === "admin";
            const activeReports = savedReports.filter((r: any) => !r.archived);
            // Archiv: Admin/Owner sehen alle, sonst nur eigene.
            const archiveSource = isAdminOwner ? allReports : savedReports;
            const archivedReports = archiveSource.filter((r: any) => r.archived).sort((a: any, b: any) => {
              const e = (a.employee || "").localeCompare(b.employee || "");
              if (e !== 0) return e;
              return reportFirstDate(b).localeCompare(reportFirstDate(a));
            });
            return (
              <>
                {activeReports.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-bold">{t.savedReports}</h3>
                    {activeReports.map((report: any) => (
                      <div key={report.id} className="border border-slate-200 rounded-xl p-3 shadow-sm space-y-2">
                        <strong>{report.report_name}</strong>{reportProjects(report) ? <span className="text-xs text-cyan-700"> · {reportProjects(report)}</span> : null}
                        <p className="text-sm text-gray-700">{t.employee}: {report.employee || "-"}{reportKw(report) ? ` · ${reportKw(report)}` : ""} | {new Date(report.created_at).toLocaleString("de-DE")}</p>
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={() => loadReport(report)} className="bg-cyan-600 text-white px-3 py-2.5 rounded-lg">{t.loadEdit}</button>
                          <button type="button" onClick={() => archiveReport(report.id, true)} className="bg-slate-600 text-white px-3 py-2.5 rounded-lg">📥 {tx.toArchive}</button>
                          <button type="button" onClick={() => deleteReport(report.id)} className="bg-red-600 text-white px-3 py-2.5 rounded-lg">{t.delete}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {archivedReports.length > 0 && (
                  <div className="border-t pt-3 mt-2">
                    <button type="button" onClick={() => setArchiveOpen((v) => !v)} className="w-full flex justify-between items-center font-bold text-left">
                      <span>🗄️ {tx.archiveTab} ({archivedReports.length})</span>
                      <span className="text-gray-400">{archiveOpen ? "▾" : "▸"}</span>
                    </button>
                    {archiveOpen && (
                      <div className="space-y-3 mt-2">
                        {(() => {
                          const groups: Record<string, any[]> = {};
                          for (const r of archivedReports) { const key = (r.employee || "?").trim() || "?"; (groups[key] ||= []).push(r); }
                          return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).map(([emp, reports]) => (
                            <div key={emp} className="space-y-2">
                              <p className="text-sm font-bold text-gray-700">👤 {emp}</p>
                              {reports.map((report: any) => (
                                <div key={report.id} className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50 space-y-2">
                                  <strong>{report.report_name}</strong>{reportKw(report) ? <span className="text-xs text-cyan-700"> · {reportKw(report)}</span> : null}{reportProjects(report) ? <span className="text-xs text-cyan-700"> · {reportProjects(report)}</span> : null}
                                  <p className="text-sm text-gray-500">{new Date(report.created_at).toLocaleString("de-DE")}</p>
                                  <div className="flex gap-2 flex-wrap">
                                    <button type="button" onClick={() => loadReport(report)} className="bg-cyan-600 text-white px-3 py-2.5 rounded-lg text-sm">{t.loadEdit}</button>
                                    <button type="button" onClick={() => archiveReport(report.id, false)} className="bg-amber-600 text-white px-3 py-2.5 rounded-lg text-sm">📤 {tx.fromArchive}</button>
                                    <button type="button" onClick={() => deleteReport(report.id)} className="bg-red-600 text-white px-3 py-2.5 rounded-lg text-sm">{t.delete}</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      {activeTab === "projekte" && (
        <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.projectsTab}{editingProjectId ? <span className="ml-2 text-sm font-normal text-amber-700">✏️ {t.editBtn}</span> : null}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border p-3 w-full" placeholder={t.projectName} value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <input className="border p-3 w-full" placeholder={t.customer} value={projectCustomer} onChange={(e) => setProjectCustomer(e.target.value)} />
            <input className="border p-3 w-full" placeholder={t.site} value={projectSite} onChange={(e) => setProjectSite(e.target.value)} />
            <input className="border p-3 w-full" placeholder={t.street} value={projectStreet} onChange={(e) => setProjectStreet(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="border p-3 w-full" placeholder={t.zip} value={projectZip} onChange={(e) => setProjectZip(e.target.value)} />
              <input className="border p-3 w-full" placeholder={t.city} value={projectCity} onChange={(e) => setProjectCity(e.target.value)} />
            </div>
            <select className="border p-3 w-full" value={projectManager} onChange={(e) => setProjectManager(e.target.value)}>
              <option value="">{t.projectManager}</option>
              {companyUsers.filter((m: any) => m.role === "project_manager").map((m: any) => (<option key={m.user_id} value={m.full_name || m.email || ""}>{m.full_name || m.email}</option>))}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={saveProject} className="bg-cyan-700 text-white px-4 py-3 rounded-lg">{editingProjectId ? `💾 ${t.update}` : t.saveProject}</button>
            {editingProjectId && (<button type="button" onClick={resetProjectForm} className="bg-gray-200 px-4 py-3 rounded-lg">{t.cancelBtn}</button>)}
          </div>
          <div className="space-y-3 mt-4">
            {projects.map((project) => (
              <div key={project.id} className="border border-slate-200 rounded-xl p-3 shadow-sm space-y-2">
                <strong>{project.name}</strong>
                <p>{t.customer}: {project.customer || "-"}</p>
                <p>{t.site}: {project.site || "-"}</p>
                {(project.street || project.zip || project.city) && (<p className="text-sm text-gray-600">{[project.street, [project.zip, project.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>)}
                {(currentCompany?.role === "owner" || currentCompany?.role === "admin") ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{t.projectManager}:</span>
                  <select className="border p-2 rounded-lg text-sm" value={pmEdits[project.id] ?? (project.project_manager || "")} onChange={(e) => setPmEdits((prev) => ({ ...prev, [project.id]: e.target.value }))}>
                    <option value="">—</option>
                    {project.project_manager && !companyUsers.some((m: any) => (m.full_name || m.email) === project.project_manager && m.role === "project_manager") && (<option value={project.project_manager}>{project.project_manager}</option>)}
                    {companyUsers.filter((m: any) => m.role === "project_manager").map((m: any) => (<option key={m.user_id} value={m.full_name || m.email || ""}>{m.full_name || m.email}</option>))}
                  </select>
                  <button type="button" onClick={() => updateProjectManager(project.id, pmEdits[project.id] ?? (project.project_manager || ""))} className="bg-cyan-700 text-white px-3 py-1 rounded-lg text-sm">{t.save}</button>
                  <button type="button" onClick={() => assignPmToProjectInstructions(project.id, pmEdits[project.id] ?? (project.project_manager || ""))} className="bg-green-700 text-white px-3 py-1 rounded-lg text-sm">{t.assignVisibility}</button>
                </div>
                ) : (
                <p>{t.projectManager}: {project.project_manager || "-"}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => setSelectedProjectDetailId(project.id === selectedProjectDetailId ? "" : project.id)} className="bg-gray-700 text-white px-3 py-2.5 rounded-lg">{project.id === selectedProjectDetailId ? t.closeProject : t.openProject}</button>
                  {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (<button type="button" onClick={() => startEditProject(project)} className="bg-amber-600 text-white px-3 py-2.5 rounded-lg">✏️ {t.editBtn}</button>)}
                  <button type="button" onClick={() => deleteProject(project.id)} className="bg-red-600 text-white px-3 py-2.5 rounded-lg">{t.deleteProject}</button>
                </div>
                {selectedProjectDetailId === project.id && (
                  <div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50 space-y-3 mt-2">
                    {(() => {
                      const tasks = workInstructions.filter((i) => i.project_id === project.id).flatMap((i) => i.work_instruction_tasks || []);
                      const completedCount = tasks.filter((t: any) => t.status === "completed").length;
                      const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
                      return (<div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-100"><p>{t.statusOpen}: {tasks.filter((t: any) => (t.status || "open") === "open").length}</p><p>{t.statusInProgress}: {tasks.filter((t: any) => t.status === "in_progress").length}</p><p>{t.statusStopped}: {tasks.filter((t: any) => t.status === "stopped").length}</p><p>{t.statusCompleted}: {completedCount}</p><p className="font-bold mt-2">{t.progress}: {progressPercent}%</p><div className="w-full bg-gray-300 rounded-lg h-4 mt-1"><div className="bg-green-600 h-4 rounded-lg" style={{ width: `${progressPercent}%` }} /></div></div>);
                    })()}
                    <h4 className="font-bold">{t.workInstructions}</h4>
                    {workInstructions.filter((i) => i.project_id === project.id).map((instruction) => (
                      <div key={instruction.id} className="border border-slate-200 rounded-xl p-3 shadow-sm bg-white space-y-2">
                        <strong>{getTranslated(instruction.id, "title", instruction.title)}</strong>
                        <p><strong>{t.date}:</strong> {instruction.work_date || "-"}</p>
                        <p><strong>{t.customer}:</strong> {instruction.customer || "-"}</p>
                        <p><strong>{t.site}:</strong> {instruction.site || "-"}</p>
                        {instruction.street && <p><strong>{t.street}:</strong> {instruction.street}</p>}
                        {(instruction.zip || instruction.city) && <p><strong>{t.zip} / {t.city}:</strong> {[instruction.zip, instruction.city].filter(Boolean).join(" ")}</p>}
                        {instruction.problems_text && <p><strong>{t.problems}:</strong> {getTranslated(instruction.id, "problems_text", instruction.problems_text)}</p>}
                        {(instruction.work_instruction_tasks || []).length > 0 && (<ul className="list-disc pl-6 space-y-1">{instruction.work_instruction_tasks.map((task: any) => (<li key={task.id}>{task.status === "completed" ? t.statusCompleted : task.status === "in_progress" ? t.statusInProgress : task.status === "stopped" ? t.statusStopped : t.statusOpen}{" "}{getTranslatedTask(instruction.id, task.id, task.task_text)}{task.note && <div className="text-sm text-gray-600 ml-2">{t.feedbackLabel}: {getTranslatedTask(instruction.id, `note_${task.id}`, task.note)}</div>}</li>))}</ul>)}
                        {companyFeatures?.module_auto_reports ? (<button type="button" onClick={() => startTransfer(instruction)} className="bg-green-700 text-white px-3 py-2.5 rounded-lg">{t.toReport}</button>) : (<p className="text-sm text-gray-500">{t.autoReportLocked}</p>)}
                        <button type="button" onClick={() => createInstructionPDF(instruction)} className="bg-slate-700 text-white px-3 py-2.5 rounded-lg text-sm">📄 PDF</button>
                      </div>
                    ))}
                    {workInstructions.filter((i) => i.project_id === project.id).length === 0 && <p className="text-gray-600">{t.noInstructions}</p>}
                    <h4 className="font-bold mt-2">{t.reportsTab}</h4>
                    {savedReports.filter((r: any) => r.project_id === project.id).map((report: any) => (<div key={report.id} className="border border-slate-200 rounded-xl p-3 shadow-sm bg-white"><strong>{report.report_name}</strong>{reportProjects(report) ? <span className="text-xs text-cyan-700"> · {reportProjects(report)}</span> : null}<p>{t.employee}: {report.employee || "-"}</p></div>))}
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
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 bg-white text-black">
            <h2 className="text-xl font-bold">{editingInstructionId ? "✏️ " + (instructionTitle || t.newInstruction) : t.newInstruction}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border p-3 text-black bg-white" placeholder={t.instructionTitle} value={instructionTitle} onChange={(e) => setInstructionTitle(e.target.value)} />
              <select className="border p-3 text-black bg-white" value={selectedProjectId} onChange={(e) => { const pid = e.target.value; setSelectedProjectId(pid); const sp = projects.find((p) => p.id === pid); if (sp) { setInstructionProject(sp.name || ""); setInstructionCustomer(sp.customer || ""); setInstructionSite(sp.site || ""); setInstructionStreet(sp.street || ""); setInstructionZip(sp.zip || ""); setInstructionCity(sp.city || ""); } }}>
                <option value="">{t.selectProject}</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <input className="border p-3 text-black bg-white" placeholder={t.customer} value={instructionCustomer} onChange={(e) => setInstructionCustomer(e.target.value)} />
              <input className="border p-3 text-black bg-white" placeholder={t.site} value={instructionSite} onChange={(e) => setInstructionSite(e.target.value)} />
              <input className="border p-3 text-black bg-white" placeholder={t.street} value={instructionStreet} onChange={(e) => setInstructionStreet(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className="border p-3 text-black bg-white" placeholder={t.zip} value={instructionZip} onChange={(e) => setInstructionZip(e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder={t.city} value={instructionCity} onChange={(e) => setInstructionCity(e.target.value)} />
              </div>
              {instructionScope === "week" ? (() => {
                const canonical = instructionDate ? isoWeekToMonday(dateToIsoWeek(instructionDate)) : "";
                const opts = buildWeekOptions();
                if (canonical && !opts.some((o) => o.value === canonical)) opts.unshift({ value: canonical, label: `${getCalendarWeek(canonical)} · ${canonical}` });
                return (
                  <select className="border p-3 text-black bg-white" value={canonical} onChange={(e) => setInstructionDate(e.target.value)}>
                    <option value="">{tx.scopeWeek} …</option>
                    {opts.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                );
              })() : (
                <input type="date" className="border p-3 text-black bg-white" value={instructionDate} onChange={(e) => setInstructionDate(e.target.value)} />
              )}
              <select className="border p-3 text-black bg-white" value={instructionScope} onChange={(e) => { const v = e.target.value as "day" | "week"; setInstructionScope(v); if (v === "week" && instructionDate) setInstructionDate(isoWeekToMonday(dateToIsoWeek(instructionDate))); }}>
                <option value="day">📅 {tx.scopeDay}</option>
                <option value="week">🗓️ {tx.scopeWeek}</option>
              </select>
              <div className="md:col-span-2 border border-slate-200 rounded-xl bg-gray-50">
                <button type="button" onClick={() => setAddr2Open((v) => !v)} className="w-full flex justify-between items-center px-3 py-2.5 text-sm font-medium text-gray-700">
                  <span>🧭 {tx.navAddr2}</span>
                  <span className="text-gray-400">{addr2Open ? "▾" : "▸"}</span>
                </button>
                {addr2Open && (
                  <div className="p-3 pt-0 grid grid-cols-1 gap-2">
                    <input className="border p-3 text-black bg-white" placeholder={tx.addr2Desc} value={instructionAddr2Desc} onChange={(e) => setInstructionAddr2Desc(e.target.value)} />
                    <input className="border p-3 text-black bg-white" placeholder={t.name} value={instructionAddr2Name} onChange={(e) => setInstructionAddr2Name(e.target.value)} />
                    <input className="border p-3 text-black bg-white" placeholder={t.street} value={instructionAddr2Street} onChange={(e) => setInstructionAddr2Street(e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className="border p-3 text-black bg-white" placeholder={t.zip} value={instructionAddr2Zip} onChange={(e) => setInstructionAddr2Zip(e.target.value)} />
                      <input className="border p-3 text-black bg-white" placeholder={t.city} value={instructionAddr2City} onChange={(e) => setInstructionAddr2City(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Mitarbeiter zuweisen – Mehrfachauswahl */}
            {companyUsers.filter(m => m.role === "employee").length > 0 && (
              <div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50 space-y-2">
                <h3 className="font-bold text-sm">👤 {t.assignEmployees}</h3>
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
              <div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50 space-y-2">
                <h3 className="font-bold text-sm">👷 {t.assignProjectManager}</h3>
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
            {/* Owner / Admin zuweisen – Mehrfachauswahl */}
            {companyUsers.filter(m => m.role === "owner" || m.role === "admin").length > 0 && (
              <div className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50 space-y-2">
                <h3 className="font-bold text-sm">👑 Owner / Admin</h3>
                {companyUsers.filter(m => m.role === "owner" || m.role === "admin").map((m) => (
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
            <input className="border p-3 w-full text-black bg-white" placeholder={t.material} value={instructionMaterial} onChange={(e) => setInstructionMaterial(e.target.value)} />
            <input className="border p-3 w-full text-black bg-white" placeholder={t.werkzeug} value={instructionWerkzeug} onChange={(e) => setInstructionWerkzeug(e.target.value)} />
            {companyFeatures?.photos_enabled && (
              <div>
                <h3 className="font-bold mb-2">{t.photos}</h3>
                <input type="file" accept="image/*" multiple className="border p-3 w-full text-black bg-white" onChange={(e) => handleInstructionPhotos(e.target.files)} />
                {instructionPhotos.length > 0 && (<div className="grid grid-cols-3 gap-2 mt-2">{instructionPhotos.map((photo, i) => (<div key={i} className="relative"><img src={photo} alt="Foto" className="w-full h-24 object-cover rounded-lg" /><button type="button" onClick={() => setInstructionPhotos((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs">✕</button></div>))}</div>)}
              </div>
            )}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold">{t.workSteps}</h3>
              <button type="button" onClick={openCopyModal} className="bg-indigo-600 text-white px-3 py-2.5 rounded-lg text-sm">📋 {t.copyInstruction}</button>
            </div>
            {instructionTasks.map((task, index) => (
              <div key={index} className="border border-slate-200 rounded-xl p-3 shadow-sm space-y-2 bg-gray-50">
                <input className="border p-3 w-full text-black bg-white" placeholder={`${t.workSteps} ${index + 1}`} value={task} onChange={(e) => { const copy = [...instructionTasks]; copy[index] = e.target.value; setInstructionTasks(copy); }} />
                {companyFeatures?.photos_enabled && (<><input type="file" accept="image/*" multiple className="border p-2 w-full text-black bg-white text-sm" onChange={(e) => handleInstructionTaskPhotos(index, e.target.files)} />{(instructionTaskPhotos[index] || []).length > 0 && (<div className="grid grid-cols-3 gap-2">{(instructionTaskPhotos[index] || []).map((photo, pi) => (<div key={pi} className="relative"><img src={photo} alt="Foto" className="w-full h-20 object-cover rounded-lg" /><button type="button" onClick={() => setInstructionTaskPhotos((prev) => ({ ...prev, [index]: (prev[index] || []).filter((_, idx) => idx !== pi) }))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs">✕</button></div>))}</div>)}</>)}
              </div>
            ))}
            <div className="flex gap-3">
              <button type="button" onClick={() => setInstructionTasks([...instructionTasks, ""])} className="bg-gray-700 text-white px-4 py-3 rounded-lg">{t.addStep}</button>
              <button type="button" onClick={saveWorkInstruction} className="bg-cyan-700 text-white px-4 py-3 rounded-lg">{t.saveInstruction}</button>
              {editingInstructionId && (<button type="button" onClick={cancelEditInstruction} className="bg-gray-500 text-white px-4 py-3 rounded-lg">{t.copyCancel}</button>)}
            </div>
          </section>
          ) : (
            <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-yellow-50 text-black"><p className="text-yellow-700 text-sm">🔒 {t.instructionsLocked}</p></section>
          )}
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-cyan-50 text-black"><p className="text-cyan-700 text-sm">💡 {t.savedInstructions} → {t.tabDay} / {t.tabWeek} / {t.tabMonth}</p></section>
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold cursor-pointer select-none" onClick={() => setOpenInstrList((v) => !v)}>{openInstrList ? "▾" : "▸"} {t.savedInstructions}</h2>
            {openInstrList && (() => {
              const allInstructions = workInstructions.filter(canSeeInstruction);
              if (allInstructions.length === 0) return (<p className="text-gray-500">{t.noInstructionsSaved}</p>);
              return (
                <ul className="space-y-2">
                  {allInstructions.map((instruction) => (
                    <li key={instruction.id} className="border border-slate-200 rounded-xl p-3 shadow-sm">
                      <div className="flex justify-between items-start cursor-pointer select-none gap-2" onClick={() => setOpenInstrCards((prev) => ({ ...prev, [instruction.id]: !prev[instruction.id] }))}>
                        <div>
                          <p className="font-bold">{openInstrCards[instruction.id] ? "▾" : "▸"} {instruction.title || "-"}</p>
                          <p className="text-sm text-gray-600 ml-4">{t.project}: {instruction.project || "-"}</p>
                          <p className="text-sm text-gray-600 ml-4">{t.customer}: {instruction.customer || "-"}</p>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{instruction.work_date || "—"} · {t.workSteps}: {(instruction.work_instruction_tasks || []).length}</span>
                      </div>
                      {renderReadStatus(instruction)}
                      {openInstrCards[instruction.id] && (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-gray-600">{t.site}: {instruction.site || "-"}</p>
                          {(instruction.street || instruction.zip || instruction.city) && (<p className="text-sm text-gray-600">{[instruction.street, [instruction.zip, instruction.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>)}
                          <div className="flex gap-2 flex-wrap">
                            {instructionNavAddress(instruction) && (<a href={instructionNavUrl(instruction)} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-3 py-2.5 rounded-lg text-sm inline-flex items-center">🧭 {t.navigate}</a>)}
                            {instructionAddr2(instruction) && (<a href={navUrlForAddress(instructionAddr2(instruction))} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-3 py-2.5 rounded-lg text-sm inline-flex items-center">🧭 {(instruction.address2_desc || "").trim() || `${t.navigate} 2`}</a>)}
                            <button type="button" onClick={() => createInstructionPDF(instruction)} className="bg-slate-700 text-white px-3 py-2.5 rounded-lg text-sm">📄 PDF</button>
                            {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (<button type="button" onClick={() => startEditInstruction(instruction)} className="bg-amber-600 text-white px-3 py-2.5 rounded-lg text-sm">✏️ {t.loadEdit}</button>)}
                            {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (<button type="button" onClick={() => deleteWorkInstruction(instruction.id)} className="bg-red-600 text-white px-3 py-2.5 rounded-lg text-sm">{t.deleteInstruction}</button>)}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </section>
        </div>
      )}

      {activeTab === "teamberichte" && (currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (() => {
        // Aktive oder archivierte Team-Berichte.
        const source = teamReports.filter((r: any) => (teamShowArchive ? r.archived : !r.archived));
        const groups: Record<string, { name: string; reports: SavedReport[] }> = {};
        for (const r of source) {
          const uid = r.user_id || "unknown";
          if (!groups[uid]) { const m = companyUsers.find((u: any) => u.user_id === uid); groups[uid] = { name: m?.full_name || m?.email || r.employee || uid, reports: [] }; }
          groups[uid].reports.push(r);
        }
        // Im Archiv innerhalb eines Mitarbeiters nach KW (Datum) sortieren.
        if (teamShowArchive) { for (const g of Object.values(groups)) g.reports.sort((a: any, b: any) => reportFirstDate(b).localeCompare(reportFirstDate(a))); }
        const allEntries = Object.entries(groups).sort((a, b) => a[1].name.localeCompare(b[1].name));
        const entries = teamFilterUid ? allEntries.filter(([uid]) => uid === teamFilterUid) : allEntries;
        return (
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 bg-white text-black">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">👁 {t.teamReports}{teamShowArchive ? ` · 🗄️ ${tx.archiveTab}` : ""}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => { setTeamShowArchive((v) => !v); setTeamOpenId(null); }} className={`px-3 py-2.5 rounded-lg text-sm border ${teamShowArchive ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-300"}`}>🗄️ {tx.archiveTab}</button>
                <select value={teamFilterUid} onChange={(e) => { setTeamFilterUid(e.target.value); setTeamOpenId(null); }} className="border p-2 rounded-lg text-black bg-white text-sm max-w-[14rem]">
                  <option value="">{t.employee} · {allEntries.length}</option>
                  {allEntries.map(([uid, group]) => (<option key={uid} value={uid}>{group.name} ({group.reports.length})</option>))}
                </select>
                <button type="button" onClick={loadTeamReports} className="bg-gray-200 px-3 py-2.5 rounded-lg text-sm">🔄</button>
              </div>
            </div>
            {teamLoading ? (<p className="text-gray-500">⏳ ...</p>) : entries.length === 0 ? (<p className="text-gray-500">{t.teamNoReports}</p>) : entries.map(([uid, group]) => (
              <div key={uid} className="border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setCollapsedGroups((prev) => ({ ...prev, [uid]: !(prev[uid] ?? true) }))} className="w-full bg-gray-100 px-3 py-2 font-bold flex justify-between items-center gap-2">
                  <span>{group.name} ({group.reports.length})</span>
                  <span className="text-gray-400">{(collapsedGroups[uid] ?? true) ? "▼" : "▲"}</span>
                </button>
                {!(collapsedGroups[uid] ?? true) && (
                <div className="divide-y">
                  {group.reports.map((r) => (
                    <div key={r.id} className="p-3 space-y-2">
                      <button type="button" onClick={() => { const willOpen = teamOpenId !== r.id; setTeamOpenId(willOpen ? r.id : null); if (willOpen) translateTeamReport(r); }} className="w-full text-left flex justify-between items-center gap-2">
                        <span className="truncate"><strong>{r.report_name}</strong>{reportProjects(r) ? <span className="text-xs text-cyan-700"> · {reportProjects(r)}</span> : null} <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString("de-DE")}</span></span>
                        <span className="text-gray-400">{teamOpenId === r.id ? "▲" : "▼"}</span>
                      </button>
                      {teamOpenId === r.id && (
                        <div className="space-y-2 pt-1">
                          {(r.days || []).map((d, di) => ({ d, di })).filter((x) => x.d.description || x.d.customer || x.d.projectNumber || x.d.site || x.d.hours || x.d.startTime || x.d.endTime || x.d.travelOutStart || x.d.travelReturnStart || x.d.travelOutKm || x.d.travelReturnKm || ((x.d.photos || []).length > 0)).map(({ d, di }) => (
                            <div key={di} className="border rounded-lg p-2 bg-gray-50 text-sm space-y-1">
                              <p className="font-semibold">{(() => { const wi = weekdays.indexOf(d.weekday); return (wi >= 0 && t.weekdays[wi]) ? t.weekdays[wi] : d.weekday; })()}{d.date ? ` – ${d.date}` : ""}</p>
                              <p>{t.customer}: {d.customer || "-"} | {t.projectNumber}: {d.projectNumber || "-"}</p>
                              <p>{t.site}: {d.site || "-"} | {t.hours}: {d.hours || "-"}</p>
                              {(d.startTime || d.endTime || d.breakMinutes) && (<p>{t.startTime}: {d.startTime || "-"} | {t.endTime}: {d.endTime || "-"} | {t.breakLabel}: {d.breakMinutes ? `${d.breakMinutes} min` : "-"}</p>)}
                              {(d.travelOutStart || d.travelOutEnd || d.travelOutKm || d.travelReturnStart || d.travelReturnEnd || d.travelReturnKm) && (<p className="text-xs text-gray-600">{t.travelTime}: {t.travelOut} {d.travelOutStart || "-"}–{d.travelOutEnd || "-"} {d.travelOutKm ? d.travelOutKm + " km" : ""} | {t.travelReturn} {d.travelReturnStart || "-"}–{d.travelReturnEnd || "-"} {d.travelReturnKm ? d.travelReturnKm + " km" : ""}</p>)}
                              {d.description && (<p className="whitespace-pre-wrap break-words">{(teamTrans[r.id] && teamTrans[r.id].lang === uiLanguage && teamTrans[r.id].days[di]) || d.description}</p>)}
                              {(d.extra || []).map((ex: any, exi: number) => (
                                <div key={exi} className="border-l-2 border-cyan-300 pl-2 mt-1 space-y-0.5">
                                  <p className="text-cyan-800 font-medium">➕ {tx.extraEntry} {exi + 2}</p>
                                  <p>{t.customer}: {ex.customer || "-"} | {t.projectNumber}: {ex.projectNumber || "-"} | {t.hours}: {ex.hours || "-"}</p>
                                  {(ex.startTime || ex.endTime || ex.breakMinutes) && (<p>{t.startTime}: {ex.startTime || "-"} | {t.endTime}: {ex.endTime || "-"} | {t.breakLabel}: {ex.breakMinutes ? `${ex.breakMinutes} min` : "-"}</p>)}
                                  {(ex.travelOutStart || ex.travelOutEnd || ex.travelOutKm || ex.travelReturnStart || ex.travelReturnEnd || ex.travelReturnKm) && (<p className="text-xs text-gray-600">{t.travelTime}: {t.travelOut} {ex.travelOutStart || "-"}–{ex.travelOutEnd || "-"} {ex.travelOutKm ? ex.travelOutKm + " km" : ""} | {t.travelReturn} {ex.travelReturnStart || "-"}–{ex.travelReturnEnd || "-"} {ex.travelReturnKm ? ex.travelReturnKm + " km" : ""}</p>)}
                                  {ex.description && (<p className="whitespace-pre-wrap break-words">{(teamTrans[r.id] && teamTrans[r.id].lang === uiLanguage && teamTrans[r.id].extras && teamTrans[r.id].extras![`${di}_${exi}`]) || ex.translation || ex.description}</p>)}
                                </div>
                              ))}
                              {(d.photos || []).length > 0 && (
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                  {(d.photos || []).map((photo: string, pi: number) => (
                                    <a key={pi} href={photo} target="_blank" rel="noopener noreferrer">
                                      <img src={photo} alt="Foto" className="w-full h-20 object-cover rounded-lg border" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          <div className="pt-1 flex gap-2 flex-wrap">
                            <button type="button" onClick={() => createTeamPDF(r)} className="bg-cyan-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium">📄 {"PDF"}</button>
                            {(r as any).archived
                              ? (<button type="button" onClick={() => archiveReport(r.id, false)} className="bg-amber-600 text-white px-4 py-2.5 rounded-lg text-sm">📤 {tx.fromArchive}</button>)
                              : (<button type="button" onClick={() => archiveReport(r.id, true)} className="bg-slate-600 text-white px-4 py-2.5 rounded-lg text-sm">📥 {tx.toArchive}</button>)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                )}
              </div>
            ))}
          </section>
        );
      })()}

      {activeTab === "urlaub" && companyFeatures?.absence_enabled && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">🌴 {t.absenceTab}</h2>
            {!readOnlyUser && (
              <div className="flex gap-2 flex-wrap items-end border-b pb-3">
                <select value={absDraft.type} onChange={(e) => setAbsDraft(p => ({ ...p, type: e.target.value }))} className="border p-2 rounded-lg text-black bg-white">
                  <option value="vacation">🌴 {t.absenceVacation}</option>
                  <option value="sick">🤒 {t.absenceSick}</option>
                </select>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500">{t.absenceFrom}</label>
                  <input type="date" value={absDraft.start} onChange={(e) => setAbsDraft(p => ({ ...p, start: e.target.value }))} className="border p-2 rounded-lg text-black bg-white" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500">{t.absenceTo}</label>
                  <input type="date" value={absDraft.end} onChange={(e) => setAbsDraft(p => ({ ...p, end: e.target.value }))} className="border p-2 rounded-lg text-black bg-white" />
                </div>
                <input placeholder={t.orderNote} value={absDraft.note} onChange={(e) => setAbsDraft(p => ({ ...p, note: e.target.value }))} className="border p-2 rounded-lg text-black bg-white flex-1 min-w-[8rem]" />
                <button type="button" disabled={absSaving} onClick={createAbsence} className="bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm disabled:opacity-50">{absSaving ? "⏳" : "📩"} {t.absenceRequest}</button>
              </div>
            )}
            {absences.length === 0 ? (
              <p className="text-gray-500">{t.absenceEmpty}</p>
            ) : (() => {
              // Nach Mitarbeiter gruppieren (alphabetisch)
              const gruppen: Record<string, { name: string; items: any[] }> = {};
              for (const ab of absences as any[]) {
                const key = String(ab.user_id || ab.user_name || "?");
                if (!gruppen[key]) gruppen[key] = { name: ab.user_name || "?", items: [] };
                gruppen[key].items.push(ab);
              }
              const sortiert = Object.entries(gruppen).sort((x, y) => x[1].name.localeCompare(y[1].name));
              return (
              <div className="space-y-3">
                {sortiert.map(([uid, g]) => (
                  <div key={uid} className="border rounded-lg overflow-hidden">
                    <button type="button" onClick={() => setAbsCollapsed(prev => ({ ...prev, [uid]: !prev[uid] }))} className="w-full bg-gray-100 px-3 py-2 font-bold flex justify-between items-center gap-2">
                      <span>👤 {g.name} ({g.items.length})</span>
                      <span className="text-gray-400">{absCollapsed[uid] ? "▼" : "▲"}</span>
                    </button>
                    {!absCollapsed[uid] && (
                    <div className="p-2 space-y-2">
                {g.items.map((a: any) => (
                  <div key={a.id} className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-2">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold break-words">
                          {a.type === "sick" ? "🤒" : "🌴"} {a.type === "sick" ? t.absenceSick : t.absenceVacation}
                          <span className="font-normal"> · {a.start_date}{a.end_date !== a.start_date ? ` – ${a.end_date}` : ""} ({absenceDayCount(a)} {t.exportDays})</span>
                        </p>
                        <p className="text-xs text-gray-500">{a.user_name || "?"}{a.note ? ` · ${absTrans[a.id] || a.note}` : ""}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${a.type === "sick" ? "bg-blue-100 text-blue-700" : a.status === "approved" ? "bg-green-100 text-green-700" : a.status === "rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                        {a.type === "sick" ? t.absenceReported : a.status === "approved" ? t.absenceApproved : a.status === "rejected" ? t.absenceRejected : t.absencePending}
                      </span>
                    </div>
                    {a.status === "rejected" && (a.reject_reason || "").trim() && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1"><strong>{tx.absRejectReason}:</strong> {a.reject_reason}</p>
                    )}
                    {rejectingId === a.id && (
                      <div className="flex gap-2 flex-wrap items-center">
                        <input autoFocus className="border p-2 rounded-lg text-sm text-black bg-white flex-1 min-w-[10rem]" placeholder={tx.absRejectReason} value={rejectReasonDraft} onChange={(e) => setRejectReasonDraft(e.target.value)} />
                        <button type="button" onClick={() => decideAbsence(a.id, "rejected", rejectReasonDraft.trim())} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm">✖️ {t.absenceReject}</button>
                        <button type="button" onClick={() => { setRejectingId(null); setRejectReasonDraft(""); }} className="bg-gray-200 text-black px-3 py-2 rounded-lg text-sm">{t.cancelBtn}</button>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap items-center">
                      {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && a.type !== "sick" && (
                        <>
                          <button type="button" onClick={() => decideAbsence(a.id, "approved")} className="bg-green-700 text-white px-3 py-2 rounded-lg text-sm">✅ {t.absenceApprove}</button>
                          <button type="button" onClick={() => { setRejectingId(a.id); setRejectReasonDraft(""); }} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm">✖️ {t.absenceReject}</button>
                        </>
                      )}
                      {((currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") || (a.user_id === user?.id && a.status === "pending")) && (
                        <button type="button" onClick={() => deleteAbsence(a.id)} className="text-xs px-2 py-1 rounded border text-red-600">🗑️</button>
                      )}
                      {a.decided_by_name && <span className="text-xs text-gray-400">{a.decided_by_name}</span>}
                    </div>
                  </div>
                ))}
                    </div>
                    )}
                  </div>
                ))}
              </div>
              );
            })()}
          </section>
        </div>
      )}

      {activeTab === "geraete" && companyFeatures?.equipment_enabled && !readOnlyUser && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">🚚 {t.equipmentTab}</h2>
            {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
              <div className="flex gap-2 flex-wrap items-center border-b pb-3">
                <select value={eqDraft.type} onChange={(e) => setEqDraft(p => ({ ...p, type: e.target.value }))} className="border p-2 rounded-lg text-black bg-white">
                  <option value="tool">🔧 {t.equipmentTool}</option>
                  <option value="vehicle">🚚 {t.equipmentVehicle}</option>
                </select>
                <input placeholder={t.nameLabel} value={eqDraft.name} onChange={(e) => setEqDraft(p => ({ ...p, name: e.target.value }))} className="border p-2 rounded-lg text-black bg-white flex-1 min-w-[10rem]" />
                <input placeholder={t.equipmentIdentifier} value={eqDraft.identifier} onChange={(e) => setEqDraft(p => ({ ...p, identifier: e.target.value }))} className="border p-2 rounded-lg text-black bg-white" />
                <button type="button" onClick={saveEquipment} className="bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm">{eqDraft.id ? `💾 ${t.saveBtn}` : `➕ ${t.materialAdd}`}</button>
                {eqDraft.id && (<button type="button" onClick={() => setEqDraft({ id: "", type: "tool", name: "", identifier: "", note: "" })} className="bg-gray-200 px-4 py-2.5 rounded-lg text-sm">{t.cancelBtn}</button>)}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {[{ k: "all", label: t.filterAll }, { k: "vehicle", label: `🚚 ${t.equipmentVehicle}` }, { k: "tool", label: `🔧 ${t.equipmentTool}` }].map((f) => (
                <button key={f.k} type="button" onClick={() => setEqFilter(f.k)} className={`px-3 py-2 rounded-lg text-sm border ${eqFilter === f.k ? "bg-cyan-700 text-white border-cyan-700" : "bg-white text-gray-700"}`}>
                  {f.label} ({f.k === "all" ? equipment.length : equipment.filter((x: any) => (x.type || "tool") === f.k).length})
                </button>
              ))}
            </div>
            {equipment.filter((eq: any) => eqFilter === "all" || (eq.type || "tool") === eqFilter).length === 0 ? (
              <p className="text-gray-500">{t.equipmentEmpty}</p>
            ) : (
              <div className="space-y-2">
                {equipment.filter((eq: any) => eqFilter === "all" || (eq.type || "tool") === eqFilter).map((eq: any) => (
                  <div key={eq.id} className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-2">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold break-words">{eq.type === "vehicle" ? "🚚" : "🔧"} {eqTrans[eq.id] || eq.name}{eq.identifier ? <span className="text-gray-500 font-normal"> · {eq.identifier}</span> : null}</p>
                        <p className="text-sm">
                          {eq.assigned_to_name
                            ? <span className="text-amber-700">👤 {eq.assigned_to_name}{eq.assigned_at ? <span className="text-xs text-gray-500"> · {new Date(eq.assigned_at).toLocaleDateString("de-DE")}</span> : null}</span>
                            : <span className="text-green-700">✅ {t.equipmentFree}</span>}
                        </p>
                        {eq.type === "vehicle" && (eq.start_km != null || eq.end_km != null) && (
                          <p className="text-sm text-gray-700">🚗 {tx.kmStart}: {eq.start_km != null ? eq.start_km : "–"} · {tx.kmEnd}: {eq.end_km != null ? eq.end_km : "–"}{eq.start_km != null && eq.end_km != null ? <span className="font-semibold"> · {tx.kmDriven}: {Math.max(0, Number(eq.end_km) - Number(eq.start_km))} {t.km}</span> : null}</p>
                        )}
                      </div>
                      <button type="button" onClick={() => toggleEquipmentHistory(eq.id)} className="text-xs px-2 py-1 rounded border">🕓 {t.equipmentHistory} {eqOpenId === eq.id ? "▲" : "▼"}</button>
                    </div>
                    {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
                      <div className="flex gap-2 flex-wrap items-center">
                        <select value={eq.assigned_to || ""} onChange={(e) => { if (!e.target.value && eq.assigned_to) { requestReturn(eq); } else { assignEquipment(eq.id, e.target.value); } }} className="border p-2 rounded-lg text-sm text-black bg-white">
                          <option value="">— {t.equipmentFree} —</option>
                          {companyUsers.map((m: any) => (<option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>))}
                        </select>
                        {eq.assigned_to && (<button type="button" onClick={() => requestReturn(eq)} className="bg-gray-200 px-3 py-2 rounded-lg text-sm">↩️ {t.equipmentReturn}</button>)}
                        <button type="button" onClick={() => setEqDraft({ id: eq.id, type: eq.type || "tool", name: eq.name || "", identifier: eq.identifier || "", note: eq.note || "" })} className="text-xs px-2 py-1 rounded border">✏️</button>
                        <button type="button" onClick={() => deleteEquipment(eq.id)} className="text-xs px-2 py-1 rounded border text-red-600">🗑️</button>
                      </div>
                    )}
                    {!eq.assigned_to && !(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
                      <div className="flex gap-2 flex-wrap items-center">
                        <button type="button" onClick={() => takeSelf(eq.id)} className="bg-cyan-700 text-white px-3 py-2 rounded-lg text-sm">📥 {tx.take}</button>
                      </div>
                    )}
                    {eq.mine && !(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
                      <div className="flex gap-2 flex-wrap items-center">
                        <button type="button" onClick={() => requestReturn(eq)} className="bg-gray-200 px-3 py-2 rounded-lg text-sm">↩️ {t.equipmentReturn}</button>
                      </div>
                    )}
                    {eq.type === "vehicle" && eq.assigned_to && (eq.mine || currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (() => {
                      const s = eqKmDraft[eq.id]?.start ?? (eq.start_km != null ? String(eq.start_km) : "");
                      const e2 = eqKmDraft[eq.id]?.end ?? (eq.end_km != null ? String(eq.end_km) : "");
                      const upd = (patch: { start?: string; end?: string }) => setEqKmDraft(prev => ({ ...prev, [eq.id]: { start: prev[eq.id]?.start ?? (eq.start_km != null ? String(eq.start_km) : ""), end: prev[eq.id]?.end ?? (eq.end_km != null ? String(eq.end_km) : ""), ...patch } }));
                      const startNum = s !== "" ? (Number(String(s).replace(",", ".")) || 0) : null;
                      const endNum = e2 !== "" ? (Number(String(e2).replace(",", ".")) || 0) : null;
                      const negative = startNum != null && endNum != null && endNum < startNum;
                      const driven = startNum != null && endNum != null && !negative ? endNum - startNum : null;
                      return (
                        <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-2 space-y-2">
                          {/* Schritt 1: Start-km (jetzt speichern) */}
                          <div className="flex gap-2 flex-wrap items-center">
                            <span className="text-sm font-medium w-20">🚗 {tx.kmStart}</span>
                            <input type="number" inputMode="numeric" placeholder={tx.kmStart} value={s} onChange={(ev) => upd({ start: ev.target.value })} className="border p-2 rounded-lg text-black bg-white w-28" />
                            <button type="button" disabled={s === ""} onClick={() => setKm(eq.id, { startKm: s })} className="bg-cyan-700 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50">💾 {tx.kmStart}</button>
                            {eq.start_km != null && <span className="text-xs text-green-700 whitespace-nowrap">✓ {eq.start_km}</span>}
                          </div>
                          {/* Schritt 2: End-km (spaeter, nur wenn plausibel) */}
                          <div className="flex gap-2 flex-wrap items-center">
                            <span className="text-sm font-medium w-20">🏁 {tx.kmEnd}</span>
                            <input type="number" inputMode="numeric" placeholder={tx.kmEnd} value={e2} onChange={(ev) => upd({ end: ev.target.value })} className={`border p-2 rounded-lg text-black bg-white w-28 ${negative ? "border-red-500" : ""}`} />
                            <button type="button" disabled={e2 === "" || startNum == null || negative} onClick={() => setKm(eq.id, { endKm: e2 })} className="bg-cyan-700 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">💾 {tx.kmEnd}</button>
                            {driven != null && <span className="text-sm text-gray-700 whitespace-nowrap">= {driven} {t.km}</span>}
                            {negative && <span className="text-sm text-red-600 font-medium whitespace-nowrap">⚠️ {tx.kmWarnNegative}</span>}
                          </div>
                        </div>
                      );
                    })()}
                    {eqOpenId === eq.id && (
                      <div className="border-t pt-2 space-y-1">
                        {(eqHistory[eq.id] || []).length === 0 ? (
                          <p className="text-xs text-gray-500">–</p>
                        ) : (eqHistory[eq.id] || []).map((h: any) => (
                          <p key={h.id} className="text-xs text-gray-600">
                            {h.action === "km" ? "🚗" : h.action === "assigned" ? "➡️" : "↩️"} {h.action === "km" ? (eqHistTrans[h.id] || h.note || "") : (h.user_name || "?")} · {new Date(h.at).toLocaleString("de-DE")}{h.by_name ? ` · ${h.by_name}` : ""}{h.action !== "km" && h.note ? (() => {
                              const p = parseReturnNote(h.note);
                              const label = p.kind === "none" ? tx.returnNoDamage : p.kind === "damage" ? tx.returnDamage : p.kind === "other" ? tx.returnOther : "";
                              const free = p.free ? (eqHistTrans[h.id] || p.free) : "";
                              const text = p.kind === "legacy" ? free : (free ? `${label}: ${free}` : label);
                              return <span className="text-amber-700"> · ⚠️ {text}</span>;
                            })() : null}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {returnTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setReturnTarget(null); setReturnNote(""); }}>
              <div className="bg-white rounded-2xl p-4 w-full max-w-md space-y-3 text-black shadow-xl" onClick={(ev) => ev.stopPropagation()}>
                <h3 className="text-lg font-bold">↩️ {tx.returnTitle}: {returnTarget.name}</h3>
                <p className="text-sm text-gray-700">{tx.returnQuestion}</p>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="returnKind" checked={returnKind === "none"} onChange={() => setReturnKind("none")} /> ✅ {tx.returnNoDamage}</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="returnKind" checked={returnKind === "damage"} onChange={() => setReturnKind("damage")} /> ⚠️ {tx.returnDamage}</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="returnKind" checked={returnKind === "other"} onChange={() => setReturnKind("other")} /> 📝 {tx.returnOther}</label>
                </div>
                {returnKind !== "none" && (
                  <textarea value={returnNote} onChange={(ev) => setReturnNote(ev.target.value)} placeholder={tx.returnPlaceholder} rows={3} className="border p-2 rounded-lg w-full text-black bg-white" />
                )}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setReturnTarget(null); setReturnNote(""); setReturnKind("none"); }} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">{tx.planCancel}</button>
                  <button type="button" onClick={confirmReturn} className="bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm">↩️ {tx.returnConfirm}</button>
                </div>
              </div>
            </div>
          )}

          {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">📊 {tx.eqReportTitle}</h2>
            <div className="flex gap-2 flex-wrap items-center">
              <label className="text-sm font-medium">{t.exportMonth}</label>
              <input type="month" value={eqReportMonth} onChange={(e) => { setEqReportMonth(e.target.value); setEqReportWeek(""); }} className="border p-2 rounded-lg text-black bg-white" />
              <select value={eqReportWeek} onChange={(e) => setEqReportWeek(e.target.value)} className="border p-2 rounded-lg text-black bg-white">
                <option value="">{t.filterAll}</option>
                {calendarWeeksOfMonth(eqReportMonth).map((w) => (<option key={w} value={w}>{w}</option>))}
              </select>
              <button type="button" onClick={() => downloadEquipmentCsv("vehicle")} className="bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium">🚚 {tx.eqReportVehicles}</button>
              <button type="button" onClick={() => downloadEquipmentCsv("tool")} className="bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium">🔧 {tx.eqReportTools}</button>
            </div>
          </section>
          )}

          {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">📅 {tx.planTitle}</h2>
            <div className="flex gap-2 flex-wrap items-end border-b pb-3">
              <div className="flex flex-col">
                <label className="text-xs text-gray-500">{tx.planEquipment}</label>
                <select value={eqPlanDraft.equipmentId} onChange={(e) => { setEqPlanConflict(null); setEqPlanDraft(p => ({ ...p, equipmentId: e.target.value })); }} className="border p-2 rounded-lg text-black bg-white">
                  <option value="">{tx.planPick}</option>
                  {equipment.map((eq: any) => (<option key={eq.id} value={eq.id}>{eq.type === "vehicle" ? "🚚" : "🔧"} {eq.name}{eq.identifier ? ` · ${eq.identifier}` : ""}</option>))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-500">{tx.planEmployee}</label>
                <select value={eqPlanDraft.userId} onChange={(e) => setEqPlanDraft(p => ({ ...p, userId: e.target.value }))} className="border p-2 rounded-lg text-black bg-white">
                  <option value="">{tx.planPick}</option>
                  {companyUsers.map((m: any) => (<option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-500">{tx.planFrom}</label>
                <input type="date" value={eqPlanDraft.dateFrom} onChange={(e) => { setEqPlanConflict(null); setEqPlanDraft(p => ({ ...p, dateFrom: e.target.value, dateTo: p.dateTo && p.dateTo < e.target.value ? e.target.value : p.dateTo })); }} className="border p-2 rounded-lg text-black bg-white" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-500">{tx.planTo}</label>
                <input type="date" value={eqPlanDraft.dateTo} min={eqPlanDraft.dateFrom || undefined} onChange={(e) => { setEqPlanConflict(null); setEqPlanDraft(p => ({ ...p, dateTo: e.target.value })); }} className="border p-2 rounded-lg text-black bg-white" />
              </div>
              <input placeholder={tx.planNote} value={eqPlanDraft.note} onChange={(e) => setEqPlanDraft(p => ({ ...p, note: e.target.value }))} className="border p-2 rounded-lg text-black bg-white flex-1 min-w-[8rem]" />
              <button type="button" disabled={eqPlanSaving} onClick={() => savePlan(false)} className="bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm disabled:opacity-50">{eqPlanDraft.id ? `💾 ${t.saveBtn}` : `➕ ${tx.planSave}`}</button>
              {eqPlanDraft.id && (<button type="button" onClick={() => { setEqPlanConflict(null); setEqPlanDraft({ id: "", equipmentId: "", userId: "", dateFrom: "", dateTo: "", note: "" }); }} className="bg-gray-200 px-4 py-2.5 rounded-lg text-sm">{tx.planCancel}</button>)}
            </div>

            {eqPlanConflict && (
              <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 text-sm space-y-2">
                <p className="font-semibold text-amber-800">⚠️ {tx.planConflictTitle}</p>
                <p className="text-amber-800">{tx.planConflictText}</p>
                <ul className="list-disc pl-5 text-amber-900">
                  {eqPlanConflict.map((c: any) => (<li key={c.id}>👤 {c.user_name || "?"} · {c.date_from} – {c.date_to}</li>))}
                </ul>
                <div className="flex gap-2">
                  <button type="button" disabled={eqPlanSaving} onClick={() => savePlan(true)} className="bg-amber-700 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50">{tx.planSaveAnyway}</button>
                  <button type="button" onClick={() => setEqPlanConflict(null)} className="bg-gray-200 px-3 py-2 rounded-lg text-sm">{tx.planCancel}</button>
                </div>
              </div>
            )}

            <div>
              <p className="font-semibold text-sm mb-2">{tx.planUpcoming}</p>
              {eqPlans.length === 0 ? (
                <p className="text-gray-500 text-sm">{tx.planEmpty}</p>
              ) : (
                <div className="space-y-2">
                  {eqPlans.map((p: any) => {
                    const eq = equipment.find((e: any) => e.id === p.equipment_id);
                    return (
                      <div key={p.id} className="border border-slate-200 rounded-xl p-3 bg-gray-50 flex justify-between items-start gap-2 flex-wrap">
                        <div className="text-sm">
                          <p className="font-semibold break-words">{eq ? (eq.type === "vehicle" ? "🚚" : "🔧") : "📦"} {eq ? eq.name : "?"}{eq?.identifier ? <span className="text-gray-500 font-normal"> · {eq.identifier}</span> : null}</p>
                          <p>👤 {p.user_name || "?"} · 🗓️ {p.date_from} – {p.date_to} {p.activated ? <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{tx.planActive}</span> : <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{tx.planPlanned}</span>}</p>
                          {p.note ? <p className="text-gray-600 text-xs mt-0.5">📝 {p.note}</p> : null}
                        </div>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => { setEqPlanConflict(null); setEqPlanDraft({ id: p.id, equipmentId: p.equipment_id, userId: p.user_id || "", dateFrom: p.date_from, dateTo: p.date_to, note: p.note || "" }); }} className="text-xs px-2 py-1 rounded border">✏️</button>
                          <button type="button" onClick={() => deletePlan(p.id)} className="text-xs px-2 py-1 rounded border text-red-600">🗑️</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
          )}
        </div>
      )}

      {activeTab === "export" && companyFeatures?.export_enabled && (currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (() => {
        const gruppen = monthlyHoursByEmployee(exportMonth, exportWeek || undefined);
        const sum = gruppen.reduce((acc, g) => ({ days: acc.days + g.days.length, hours: acc.hours + g.hours, travelMin: acc.travelMin + g.travelMin, km: acc.km + g.km }), { days: 0, hours: 0, travelMin: 0, km: 0 });
        return (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">📊 {t.exportTab}</h2>
            <div className="space-y-3">
              {/* Zeile 1: Stunden nach Mitarbeiter – inkl. Monat/Woche (gelten fuer beide Exporte) */}
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-sm font-semibold w-full sm:w-44">👤 {tx.exportByEmployee}</span>
                <label className="text-sm font-medium">{t.exportMonth}</label>
                <input type="month" value={exportMonth} onChange={(e) => { setExportMonth(e.target.value); setExportWeek(""); setExportProject(""); }} className="border p-2 rounded-lg text-black bg-white" />
                <select value={exportWeek} onChange={(e) => { setExportWeek(e.target.value); setExportProject(""); }} className="border p-2 rounded-lg text-black bg-white">
                  <option value="">{t.filterAll}</option>
                  {weeksInMonth(exportMonth).map((w) => (<option key={w} value={w}>{w}</option>))}
                </select>
                <button type="button" onClick={loadTeamReports} className="bg-gray-200 px-3 py-2.5 rounded-lg text-sm">🔄</button>
                <button type="button" onClick={() => downloadHoursCsv()} className="bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium">⬇️ {t.exportDownload}</button>
              </div>
              {/* Zeile 2: Stunden nach Projekt */}
              <div className="flex gap-2 flex-wrap items-center border-t pt-3">
                <span className="text-sm font-semibold w-full sm:w-44">📁 {tx.exportByProject}</span>
                <select value={exportProject} onChange={(e) => setExportProject(e.target.value)} className="border p-2 rounded-lg text-black bg-white" title={tx.exportProjectLabel}>
                  <option value="">{tx.exportProjectLabel}: {t.filterAll}</option>
                  {monthlyHoursByProject(exportMonth, exportWeek || undefined).map((g) => (<option key={g.project} value={g.project}>{g.project}</option>))}
                </select>
                <button type="button" onClick={() => downloadProjectCsv()} className="bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium">⬇️ {t.exportDownload}</button>
              </div>
            </div>
            {gruppen.length === 0 ? (
              <p className="text-gray-500">{t.exportEmpty}</p>
            ) : (
              <div className="space-y-3">
                {gruppen.map((g) => (
                  <div key={g.name} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-3 py-2 flex justify-between items-center gap-2">
                      <button type="button" onClick={() => setExpCollapsed(prev => ({ ...prev, [g.name]: !prev[g.name] }))} className="font-bold flex-1 text-left">
                        👤 {g.name} · {csvNum(g.hours)} {t.hours} ({g.days.length} {t.exportDays})
                      </button>
                      <button type="button" onClick={() => downloadHoursCsv(g.name)} title={t.exportDownload} className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">⬇️ CSV</button>
                      <button type="button" onClick={() => setExpCollapsed(prev => ({ ...prev, [g.name]: !prev[g.name] }))} className="text-gray-400 px-1">{expCollapsed[g.name] ? "▼" : "▲"}</button>
                    </div>
                    {!expCollapsed[g.name] && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-2 py-2 font-bold">{t.date}</th>
                              <th className="px-2 py-2 font-bold">{t.customer}</th>
                              <th className="px-2 py-2 font-bold">{t.projectNumber}</th>
                              <th className="px-2 py-2 font-bold">{t.startTime}</th>
                              <th className="px-2 py-2 font-bold">{t.endTime}</th>
                              <th className="px-2 py-2 font-bold text-right">{t.hours}</th>
                              <th className="px-2 py-2 font-bold text-right">{t.km}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.days.map((d2: any, di: number) => (
                              <tr key={di} className="border-t border-slate-200">
                                <td className="px-2 py-2 whitespace-nowrap">{d2.date}</td>
                                <td className="px-2 py-2 break-words">{d2.customer || "-"}</td>
                                <td className="px-2 py-2 break-words">{d2.project || "-"}</td>
                                <td className="px-2 py-2">{d2.start || "-"}</td>
                                <td className="px-2 py-2">{d2.end || "-"}</td>
                                <td className="px-2 py-2 text-right">{csvNum(d2.hours)}</td>
                                <td className="px-2 py-2 text-right">{d2.km ? csvNum(d2.km, 1) : "-"}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-slate-300 font-bold bg-gray-50">
                              <td className="px-2 py-2" colSpan={5}>{t.total}</td>
                              <td className="px-2 py-2 text-right">{csvNum(g.hours)}</td>
                              <td className="px-2 py-2 text-right">{csvNum(g.km, 1)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
                <p className="font-bold text-right pr-2">{t.total}: {csvNum(sum.hours)} {t.hours} · {csvNum(sum.km, 1)} {t.km}</p>
              </div>
            )}
          </section>
        </div>
        );
      })()}

      {activeTab === "bestellungen" && companyFeatures?.material_enabled && !readOnlyUser && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">🛒 {t.materialOrders} ({materialOrders.length})</h2>
              <button type="button" onClick={loadMaterialOrders} className="bg-gray-200 px-3 py-2.5 rounded-lg text-sm">🔄</button>
            </div>
            {materialOrders.length === 0 ? (
              <p className="text-gray-500">{t.ordersEmpty}</p>
            ) : (() => {
              // Nach Kalenderwoche und Projekt gruppieren (neueste Woche zuerst)
              const weeks: Record<string, { label: string; sort: string; projects: Record<string, any[]> }> = {};
              for (const o of materialOrders as any[]) {
                const datum = (o.work_date || String(o.created_at || "").slice(0, 10)) || "";
                const wk = datum ? `${getCalendarWeek(datum)} · ${datum.slice(0, 4)}` : "–";
                const pr = String(o.project || "").trim() || t.noProject;
                if (!weeks[wk]) weeks[wk] = { label: wk, sort: datum, projects: {} };
                if (datum > weeks[wk].sort) weeks[wk].sort = datum;
                if (!weeks[wk].projects[pr]) weeks[wk].projects[pr] = [];
                weeks[wk].projects[pr].push(o);
              }
              const sorted = Object.values(weeks).sort((a, b) => b.sort.localeCompare(a.sort));
              return (
              <div className="space-y-4">
                {sorted.map((w) => (
                  <div key={w.label} className="space-y-2">
                    <p className="font-bold text-cyan-800 border-b pb-1">📅 {w.label}</p>
                    {Object.entries(w.projects).map(([projekt, list]) => (
                      <div key={projekt} className="space-y-2">
                        <p className="text-sm font-semibold text-gray-700 pl-1">🏗️ {projekt} ({list.length})</p>
                        {list.map((o: any) => (
                  <div key={o.id} className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-2">
                    <p className="break-words"><strong>{o.qty} {unitLabel(o.unit, uiLanguage)}</strong> {orderTrans[o.id] || o.name}{o.note ? <span className="text-gray-600"> · {orderTrans[`n_${o.id}`] || o.note}</span> : null}</p>
                    <p className="text-xs text-gray-500">{o.created_by_name || "?"} · {new Date(o.created_at).toLocaleString("de-DE")}</p>
                    <div className="flex gap-2 flex-wrap items-center">
                      {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") ? (
                        <>
                          <select value={o.status || "open"} onChange={(e) => setOrderStatus(o.id, e.target.value)} className="border p-2 rounded-lg text-sm text-black bg-white">
                            <option value="open">{t.orderOpen}</option>
                            <option value="ordered">{t.orderOrdered}</option>
                            <option value="delivered">{t.orderDelivered}</option>
                          </select>
                          <button type="button" onClick={() => deleteOrder(o.id)} className="text-xs px-2 py-1 rounded border text-red-600">🗑️</button>
                        </>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded ${o.status === "delivered" ? "bg-green-100 text-green-700" : o.status === "ordered" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{orderStatusLabel(o.status)}</span>
                      )}
                    </div>
                  </div>
                ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              );
            })()}
          </section>
        </div>
      )}

      {activeTab === "material" && companyFeatures?.material_enabled && (currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">📦 {t.materialCatalog}</h2>
            {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
              <div className="flex gap-2 flex-wrap items-center">
                <input placeholder={t.materialName} value={catDraft.name} onChange={(e) => setCatDraft(p => ({ ...p, name: e.target.value }))} className="border p-3 rounded-lg text-black bg-white flex-1 min-w-[12rem]" />
                <select value={catDraft.unit} onChange={(e) => setCatDraft(p => ({ ...p, unit: e.target.value }))} className="border p-3 rounded-lg text-black bg-white">
                  {MATERIAL_UNITS.map((u) => (<option key={u} value={u}>{unitLabel(u, uiLanguage)}</option>))}
                </select>
                <button type="button" onClick={saveCatalogItem} className="bg-cyan-700 text-white px-4 py-3 rounded-lg text-sm">{catDraft.id ? `💾 ${t.saveBtn}` : `➕ ${t.materialAdd}`}</button>
                {catDraft.id && (<button type="button" onClick={() => setCatDraft({ id: "", name: "", unit: MATERIAL_UNITS[0] })} className="bg-gray-200 px-4 py-3 rounded-lg text-sm">{t.cancelBtn}</button>)}
              </div>
            )}
            {materialCatalog.length === 0 ? (
              <p className="text-gray-500">{t.materialCatalogEmpty}</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 font-bold">{t.materialName}</th>
                      <th className="px-3 py-2 font-bold">{t.materialUnit}</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialCatalog.map((m: any) => (
                      <tr key={m.id} className="border-t border-slate-200">
                        <td className="px-3 py-2 break-words">{catTrans[m.id] || m.name}</td>
                        <td className="px-3 py-2">{m.unit ? unitLabel(m.unit, uiLanguage) : "-"}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (<button type="button" onClick={() => setCatDraft({ id: m.id, name: m.name || "", unit: m.unit || MATERIAL_UNITS[0] })} className="text-xs px-2 py-1 rounded border mr-1">✏️</button>)}
                          {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (<button type="button" onClick={() => deleteCatalogItem(m.id)} className="text-xs px-2 py-1 rounded border text-red-600">🗑️</button>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "feedback" && companyFeatures?.feedback_enabled && !readOnlyUser && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">💬 {t.feedbackTitle}</h2>
            <p className="text-sm text-gray-500">{t.feedbackIntro}</p>
            {t.feedbackPoints.map((pt: string, i: number) => (
              <div key={i} className="space-y-1">
                <label className="text-sm font-medium">{i + 1}. {pt}</label>
                <textarea rows={2} value={feedbackAnswers[i] || ""} onChange={(e) => { const c = [...feedbackAnswers]; c[i] = e.target.value; setFeedbackAnswers(c); }} className="border p-2 w-full rounded-lg text-black bg-white resize-none" />
              </div>
            ))}
            <button type="button" onClick={submitFeedback} disabled={feedbackSending} className="bg-cyan-600 text-white px-5 py-3 rounded-lg font-medium disabled:opacity-50">{feedbackSending ? "⏳ …" : "💬 " + t.feedbackSend}</button>
          </section>
          {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
            <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">{t.feedbackReview} ({feedbackList.length})</h3>
                <button type="button" onClick={loadFeedback} className="bg-gray-200 px-3 py-2.5 rounded-lg text-sm">🔄</button>
              </div>
              {feedbackList.length === 0 ? (<p className="text-gray-500">{t.feedbackNone}</p>) : feedbackList.map((f: any) => (
                <div key={f.id} className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-1">
                  <p className="font-semibold text-sm">{f.user_name || "?"}{f.role ? ` (${roleLabel(f.role)})` : ""} · {new Date(f.created_at).toLocaleString("de-DE")}</p>
                  {t.feedbackPoints.map((pt: string, i: number) => (((f.answers?.[i] || "").trim()) ? (<p key={i} className="text-sm break-words"><strong>{pt}:</strong> {f.answers[i]}</p>) : null))}
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {activeTab === "uebersetzer" && companyFeatures?.translator_enabled && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">🌐 {t.translatorTitle}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select className="border p-3 rounded-lg text-black bg-white" value={transFrom} onChange={(e) => setTransFrom(e.target.value)}>
                {getAllowedLanguages(companyFeatures).filter(l => languages.includes(l as Language)).map((l) => (<option key={l} value={l}>{l}</option>))}
              </select>
              <button type="button" onClick={() => { const f = transFrom; setTransFrom(transTo); setTransTo(f); setTransInput(transOutput || transInput); setTransOutput(""); }} className="bg-gray-200 px-3 py-3 rounded-lg" title={t.translatorSwap}>↔</button>
              <select className="border p-3 rounded-lg text-black bg-white" value={transTo} onChange={(e) => setTransTo(e.target.value)}>
                {getAllowedLanguages(companyFeatures).filter(l => languages.includes(l as Language)).map((l) => (<option key={l} value={l}>{l}</option>))}
              </select>
            </div>
            <textarea className="border p-3 w-full text-black bg-white rounded-lg resize-none" rows={5} placeholder={t.translatorPlaceholder} value={transInput} onChange={(e) => setTransInput(e.target.value)} />
            <button type="button" onClick={runLiveTranslate} disabled={transLoading || !transInput.trim()} className="bg-cyan-600 text-white px-5 py-3 rounded-lg font-medium disabled:opacity-50">{transLoading ? "⏳ …" : "🌐 " + t.translatorBtn}</button>
            <p className="text-xs text-gray-400">⚠️ {t.translatorHint}</p>
            {transOutput && (
              <div className="border border-slate-200 rounded-lg p-3 bg-gray-50 space-y-1">
                <p className="text-xs text-gray-500">{transTo}</p>
                <p className="whitespace-pre-wrap break-words">{transOutput}</p>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "tag" && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">{t.dayView}</h2>
            <input type="date" className="border p-3 rounded-lg text-black bg-white" value={selectedDayDate} onChange={(e) => setSelectedDayDate(e.target.value)} />
          </section>
          {(() => {
            const dayInstructions = workInstructions.filter((i) => {
              if (!instructionCoversDate(i, selectedDayDate)) return false;
              return canSeeInstruction(i);
            });
            if (dayInstructions.length === 0) return (<section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black"><p className="text-gray-500">{t.noInstructionsDay}</p></section>);
            return dayInstructions.map((instruction) => (
              <section key={instruction.id} className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-2">
                <div className="flex justify-between items-start cursor-pointer select-none" onClick={() => { const willOpen = !openDayCards[instruction.id]; setOpenDayCards(prev => ({ ...prev, [instruction.id]: !prev[instruction.id] })); if (willOpen) markInstructionRead(instruction.id); }}>
                  <div>
                    <h3 className="font-bold text-lg">{openDayCards[instruction.id] ? "▾" : "▸"} {getTranslated(instruction.id, "title", instruction.title)}</h3>
                    <p className="text-sm text-gray-600 ml-5"><strong>{t.project}:</strong> {instruction.project || "-"} &nbsp;·&nbsp; <strong>{t.site}:</strong> {instruction.site || "-"}{(instruction.street || instruction.zip || instruction.city) ? `, ${[instruction.street, [instruction.zip, instruction.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}` : ""}</p>
                  </div>
                  <span className="text-sm text-gray-500 flex flex-col items-end gap-1">{instruction.work_date}{instruction.scope === "week" && (<span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">🗓️ {tx.scopeWeek}</span>)}</span>
                </div>
                {renderReadStatus(instruction)}
                {openDayCards[instruction.id] && (<>
                <p><strong>{t.customer}:</strong> {instruction.customer || "-"}</p>
                <div className="flex gap-2 flex-wrap">
                  {instructionNavAddress(instruction) && (<a href={instructionNavUrl(instruction)} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-3 py-2.5 rounded-lg text-sm inline-flex items-center w-fit">🧭 {t.navigate}</a>)}
                  {instructionAddr2(instruction) && (<a href={navUrlForAddress(instructionAddr2(instruction))} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-3 py-2.5 rounded-lg text-sm inline-flex items-center w-fit">🧭 {(instruction.address2_desc || "").trim() || `${t.navigate} 2`}</a>)}
                </div>
                {instruction.problems_text && (<div className="bg-yellow-50 border rounded-lg p-2"><strong>{t.problemsHints}:</strong> {getTranslated(instruction.id, "problems_text", instruction.problems_text)}</div>)}
                {instruction.material && (<div className="bg-cyan-50 border rounded-lg p-2"><strong>{t.material}:</strong> {getTranslated(instruction.id, "material", instruction.material)}</div>)}
                {instruction.werkzeug && (<div className="bg-green-50 border rounded-lg p-2"><strong>{t.werkzeug}:</strong> {getTranslated(instruction.id, "werkzeug", instruction.werkzeug)}</div>)}
                {(instruction.photos || []).length > 0 && companyFeatures?.photos_enabled && (<div className="grid grid-cols-3 gap-2">{(instruction.photos || []).map((photo: string, i: number) => (<img key={i} src={photo} alt="Foto" className="w-full h-24 object-cover rounded-lg border" />))}</div>)}
                <ul className="space-y-4 mt-2">
                  {(instruction.work_instruction_tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((task: any) => (
                    <li key={task.id} className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50 space-y-3">
                      <div className="flex items-center gap-2">
                        <select className="border rounded-lg p-1 text-sm text-black bg-white disabled:opacity-60" disabled={readOnlyUser} value={task.status || "open"} onChange={(e) => updateTaskStatus(task.id, e.target.value)}>
                          <option value="open">{t.statusOpen}</option><option value="in_progress">{t.statusInProgress}</option><option value="stopped">{t.statusStopped}</option><option value="completed">{t.statusCompleted}</option>
                        </select>
                        <span className="font-medium">{getTranslatedTask(instruction.id, task.id, task.task_text)}</span>
                      </div>
                      {task.note && <p className="text-sm text-gray-600 ml-2">{t.feedbackLabel}: {getTranslatedTask(instruction.id, `note_${task.id}`, task.note)}</p>}
                      {(task.photos || []).length > 0 && companyFeatures?.photos_enabled && (<div className="grid grid-cols-3 gap-1">{(task.photos || []).map((photo: string, pi: number) => (<img key={pi} src={photo} alt="Foto" className="w-full h-16 object-cover rounded-lg" />))}</div>)}
                      {/* Kommentare. Modul AN = offener Chat (alle sehen alles),
                          Modul AUS = privater Kommentar (jeder sieht nur seinen eigenen). */}
                      <div className="border-t pt-2 space-y-2">
                        {taskCommentList(task).filter((c: any) => chatOn || isMyComment(c)).map((c: any, ci: number) => (
                          <div key={c.id || ci} className={`border rounded-lg p-2 ${isMyComment(c) ? "bg-cyan-50 border-cyan-200" : "bg-gray-50"}`}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-cyan-700">💬 {c.name || "?"}{c.at ? <span className="ml-1 font-normal text-gray-400">{new Date(c.at).toLocaleString("de-DE")}</span> : null}{c.edited_at ? <span className="ml-1 font-normal text-gray-400">({t.commentEdited})</span> : null}</p>
                              {chatOn && isMyComment(c) && c.id && !readOnlyUser && (
                                <span className="flex gap-1 shrink-0">
                                  <button type="button" title={t.editBtn} onClick={() => { setTaskComments(prev => ({ ...prev, [task.id]: c.text || "" })); setEditingCommentId(prev => ({ ...prev, [task.id]: c.id })); }} className="text-xs px-2 py-1 rounded bg-white border">✏️</button>
                                  <button type="button" title={t.delete} onClick={() => deleteTaskComment(task.id, c.id)} className="text-xs px-2 py-1 rounded bg-white border text-red-600">🗑️</button>
                                </span>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words">{getTranslatedComment(instruction.id, task.id, c)}</p>
                          </div>
                        ))}
                        {readOnlyUser ? (
                          <p className="text-xs text-gray-500">👁️ {t.readOnlyHint}</p>
                        ) : (<>
                        <p className="text-sm font-medium text-gray-700">💬 {t.commentLabel} (max. 1000 {t.charsLabel}):{myDisplayName() ? <span className="ml-1 font-normal text-cyan-700">— {myDisplayName()}</span> : null}</p>
                        <textarea
                          className="border p-2 w-full rounded-lg text-sm text-black bg-white"
                          rows={5}
                          maxLength={1000}
                          placeholder={t.commentPlaceholder}
                          value={taskComments[task.id] !== undefined ? taskComments[task.id] : (chatOn ? "" : (ownComment(task)?.text || ""))}
                          onChange={(e) => { setTaskComments(prev => ({ ...prev, [task.id]: e.target.value.slice(0, 1000) })); setCommentSaveState(prev => ({ ...prev, [task.id]: "" })); }}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">
                            {((taskComments[task.id] !== undefined ? taskComments[task.id] : (chatOn ? "" : (ownComment(task)?.text || ""))) || "").length} / 1000 {t.charsLabel}
                          </span>
                          <div className="flex items-center gap-2">
                            {commentSaveState[task.id] === "saving" && <span className="text-xs text-gray-500">⏳ {t.commentSaving}</span>}
                            {commentSaveState[task.id] === "saved" && <span className="text-xs text-green-700 font-medium">✓ {t.commentSaved}</span>}
                            {commentSaveState[task.id]?.startsWith("error:") && <span className="text-xs text-red-600">{t.commentErrorLabel}: {commentSaveState[task.id].slice(6)}</span>}
                            <button type="button" onClick={() => insertWeatherIntoComment(task.id, taskComments[task.id] !== undefined ? taskComments[task.id] : (chatOn ? "" : (ownComment(task)?.text || "")))} title={t.weather} className="bg-cyan-50 text-cyan-700 border border-cyan-200 px-3 py-2.5 rounded-lg text-sm">🌦️ {t.weather}</button>
                            <button
                              type="button"
                              disabled={commentSaveState[task.id] === "saving" || (chatOn && !(taskComments[task.id] || "").trim())}
                              onClick={() => {
                                const val = taskComments[task.id] !== undefined ? taskComments[task.id] : (chatOn ? "" : (ownComment(task)?.text || ""));
                                const cid = editingCommentId[task.id];
                                const validCid = chatOn && cid && !cid.startsWith("local-") ? cid : undefined;
                                updateTaskComment(task.id, val, validCid);
                              }}
                              className="bg-cyan-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                              💾 {editingCommentId[task.id] ? (t.update) : t.commentSaveBtn}
                            </button>
                            {editingCommentId[task.id] && (
                              <button type="button" onClick={() => { setEditingCommentId(prev => { const n = { ...prev }; delete n[task.id]; return n; }); setTaskComments(prev => ({ ...prev, [task.id]: "" })); }} className="bg-gray-200 px-3 py-2.5 rounded-lg text-sm">{t.cancelBtn}</button>
                            )}
                          </div>
                        </div>
                        </>)}
                      </div>
                    </li>
                  ))}
                </ul>
                {companyFeatures?.material_enabled && (
                  <div className="border-t pt-2 mt-2 space-y-2">
                    <p className="text-sm font-medium text-gray-700">📦 {t.materialUsed}</p>
                    {usedMaterialList(instruction).length === 0 ? (
                      <p className="text-xs text-gray-500">{t.materialNone}</p>
                    ) : (
                      <ul className="space-y-1">
                        {usedMaterialList(instruction).map((m: any, mi: number) => (
                          <li key={mi} className="flex items-center justify-between gap-2 bg-white border rounded-lg px-2 py-1 text-sm">
                            <span className="break-words"><strong>{m.qty} {unitLabel(m.unit, uiLanguage)}</strong> {getTranslatedMaterial(instruction.id, m.name)}{m.by ? <span className="text-xs text-gray-400"> · {m.by}</span> : null}</span>
                            {!readOnlyUser && (<button type="button" title={t.delete} onClick={() => removeMaterial(instruction, mi)} className="text-xs px-2 py-1 rounded border text-red-600 shrink-0">🗑️</button>)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!readOnlyUser && (
                      <div className="flex gap-2 flex-wrap items-center">
                        <input type="number" inputMode="decimal" placeholder={t.materialQty} value={matDraft[instruction.id]?.qty ?? ""} onChange={(e) => setMatDraft(p => ({ ...p, [instruction.id]: { ...(p[instruction.id] || { qty: "", unit: MATERIAL_UNITS[0], name: "" }), qty: e.target.value } }))} className="border p-2 rounded-lg text-sm w-24 text-black bg-white" />
                        <select value={matDraft[instruction.id]?.unit ?? MATERIAL_UNITS[0]} onChange={(e) => setMatDraft(p => ({ ...p, [instruction.id]: { ...(p[instruction.id] || { qty: "", unit: MATERIAL_UNITS[0], name: "" }), unit: e.target.value } }))} className="border p-2 rounded-lg text-sm text-black bg-white">
                          {MATERIAL_UNITS.map((u) => (<option key={u} value={u}>{unitLabel(u, uiLanguage)}</option>))}
                        </select>
                        <input list={`matlist-${instruction.id}`} placeholder={t.materialName} value={matDraft[instruction.id]?.name ?? ""} onChange={(e) => { const v = e.target.value; const u = unitForMaterial(v); setMatDraft(p => { const cur = p[instruction.id] || { qty: "", unit: MATERIAL_UNITS[0], name: "" }; return { ...p, [instruction.id]: { ...cur, name: v, unit: u || cur.unit } }; }); }} className="border p-2 rounded-lg text-sm text-black bg-white flex-1 min-w-[10rem]" />
                        <datalist id={`matlist-${instruction.id}`}>
                          {catalogSuggestions.map((m) => (<option key={m.name} value={m.name} />))}
                        </datalist>
                        <button type="button" disabled={matSaving === instruction.id} onClick={() => addMaterial(instruction)} className="bg-cyan-600 text-white px-3 py-2.5 rounded-lg text-sm disabled:opacity-50">{matSaving === instruction.id ? "⏳" : "➕"} {t.materialAdd}</button>
                      </div>
                    )}
                  </div>
                )}
                {companyFeatures?.material_enabled && !readOnlyUser && (
                  <div className="border-t pt-2 mt-2 space-y-2">
                    <p className="text-sm font-medium text-gray-700">🛒 {t.materialOrder}</p>
                    {materialOrders.filter((o: any) => o.instruction_id === instruction.id).map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between gap-2 bg-white border rounded-lg px-2 py-1 text-sm">
                        <span className="break-words"><strong>{o.qty} {unitLabel(o.unit, uiLanguage)}</strong> {orderTrans[o.id] || o.name}{o.note ? <span className="text-gray-500"> · {orderTrans[`n_${o.id}`] || o.note}</span> : null}</span>
                        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${o.status === "delivered" ? "bg-green-100 text-green-700" : o.status === "ordered" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{orderStatusLabel(o.status)}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 flex-wrap items-center">
                      <input type="number" inputMode="decimal" placeholder={t.materialQty} value={orderDraft[instruction.id]?.qty ?? ""} onChange={(e) => setOrderDraft(p => ({ ...p, [instruction.id]: { ...(p[instruction.id] || { qty: "", unit: MATERIAL_UNITS[0], name: "", note: "" }), qty: e.target.value } }))} className="border p-2 rounded-lg text-sm w-24 text-black bg-white" />
                      <select value={orderDraft[instruction.id]?.unit ?? MATERIAL_UNITS[0]} onChange={(e) => setOrderDraft(p => ({ ...p, [instruction.id]: { ...(p[instruction.id] || { qty: "", unit: MATERIAL_UNITS[0], name: "", note: "" }), unit: e.target.value } }))} className="border p-2 rounded-lg text-sm text-black bg-white">
                        {MATERIAL_UNITS.map((u) => (<option key={u} value={u}>{unitLabel(u, uiLanguage)}</option>))}
                      </select>
                      <input list={`matlist-${instruction.id}`} placeholder={t.materialName} value={orderDraft[instruction.id]?.name ?? ""} onChange={(e) => { const v = e.target.value; const u = unitForMaterial(v); setOrderDraft(p => { const cur = p[instruction.id] || { qty: "", unit: MATERIAL_UNITS[0], name: "", note: "" }; return { ...p, [instruction.id]: { ...cur, name: v, unit: u || cur.unit } }; }); }} className="border p-2 rounded-lg text-sm text-black bg-white flex-1 min-w-[10rem]" />
                      <input placeholder={t.orderNote} value={orderDraft[instruction.id]?.note ?? ""} onChange={(e) => setOrderDraft(p => ({ ...p, [instruction.id]: { ...(p[instruction.id] || { qty: "", unit: MATERIAL_UNITS[0], name: "", note: "" }), note: e.target.value } }))} className="border p-2 rounded-lg text-sm text-black bg-white flex-1 min-w-[8rem]" />
                      <button type="button" disabled={orderSaving === instruction.id} onClick={() => createOrder(instruction.id)} className="bg-amber-600 text-white px-3 py-2.5 rounded-lg text-sm disabled:opacity-50">{orderSaving === instruction.id ? "⏳" : "🛒"} {t.materialOrder}</button>
                    </div>
                  </div>
                )}
                {companyFeatures?.module_auto_reports && !readOnlyUser && (
                  <div className="border-t pt-3 mt-2 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">⏱️ {tx.myTimes}</p>
                    {instrDatesFor(instruction).map((date) => {
                      const tm = instrTime(instruction.id, date);
                      const wdIdx = (() => { const [yy, mm, dd] = date.split("-").map(Number); const dt = new Date(Date.UTC(yy, mm - 1, dd)); return (dt.getUTCDay() + 6) % 7; })();
                      const wdLabel = t.weekdays[wdIdx] || "";
                      const [yy2, mm2, dd2] = date.split("-");
                      return (
                        <div key={date} className="border border-slate-200 rounded-xl p-3 bg-gray-50 space-y-2">
                          <p className="text-sm font-medium text-gray-700">{wdLabel}, {dd2}.{mm2}.{yy2}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div><label className="text-xs text-gray-500 block mb-1">{t.startTime}</label><input type="time" className="border p-2 w-full text-black bg-white rounded-lg" value={tm.startTime || ""} onChange={(e) => setInstrTimeField(instruction.id, date, "startTime", e.target.value)} /></div>
                            <div><label className="text-xs text-gray-500 block mb-1">{t.endTime}</label><input type="time" className="border p-2 w-full text-black bg-white rounded-lg" value={tm.endTime || ""} onChange={(e) => setInstrTimeField(instruction.id, date, "endTime", e.target.value)} /></div>
                            <div><label className="text-xs text-gray-500 block mb-1">{t.breakLabel}</label><input type="number" min="0" step="5" className="border p-2 w-full text-black bg-white rounded-lg" value={tm.breakMinutes || ""} onChange={(e) => setInstrTimeField(instruction.id, date, "breakMinutes", e.target.value)} /></div>
                            <div><label className="text-xs text-gray-500 block mb-1">{t.hours}</label><input className="border p-2 w-full text-black bg-white rounded-lg" value={tm.hours || ""} readOnly={!!(tm.startTime && tm.endTime)} onChange={(e) => setInstrTimeField(instruction.id, date, "hours", e.target.value)} /></div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">🚗 {t.travelTime} · {t.travelOut}</p>
                            <div className="grid grid-cols-3 gap-2">
                              <input type="time" title={t.startTime} className="border p-2 w-full text-black bg-white rounded-lg" value={tm.travelOutStart || ""} onChange={(e) => setInstrTimeField(instruction.id, date, "travelOutStart", e.target.value)} />
                              <input type="time" title={t.endTime} className="border p-2 w-full text-black bg-white rounded-lg" value={tm.travelOutEnd || ""} onChange={(e) => setInstrTimeField(instruction.id, date, "travelOutEnd", e.target.value)} />
                              <input type="number" min="0" placeholder={t.km} className="border p-2 w-full text-black bg-white rounded-lg" value={tm.travelOutKm || ""} onChange={(e) => setInstrTimeField(instruction.id, date, "travelOutKm", e.target.value)} />
                            </div>
                            <p className="text-xs text-gray-500">🏠 {t.travelReturn}</p>
                            <div className="grid grid-cols-3 gap-2">
                              <input type="time" title={t.startTime} className="border p-2 w-full text-black bg-white rounded-lg" value={tm.travelReturnStart || ""} onChange={(e) => setInstrTimeField(instruction.id, date, "travelReturnStart", e.target.value)} />
                              <input type="time" title={t.endTime} className="border p-2 w-full text-black bg-white rounded-lg" value={tm.travelReturnEnd || ""} onChange={(e) => setInstrTimeField(instruction.id, date, "travelReturnEnd", e.target.value)} />
                              <input type="number" min="0" placeholder={t.km} className="border p-2 w-full text-black bg-white rounded-lg" value={tm.travelReturnKm || ""} onChange={(e) => setInstrTimeField(instruction.id, date, "travelReturnKm", e.target.value)} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <button type="button" disabled={instrTimesSaving === instruction.id} onClick={() => saveInstrTimes(instruction)} className="bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm disabled:opacity-50">{instrTimesSaving === instruction.id ? "⏳" : "💾"} {tx.saveTimes}</button>
                  </div>
                )}
                <div className="flex gap-2 pt-2 border-t flex-wrap">
                  {companyFeatures?.module_auto_reports && (<button type="button" onClick={() => startTransfer(instruction)} className="bg-green-700 text-white px-3 py-2.5 rounded-lg text-sm">📋 {t.toReport}</button>)}
                  <button type="button" onClick={() => createInstructionPDF(instruction)} className="bg-slate-700 text-white px-3 py-2.5 rounded-lg text-sm">📄 PDF</button>
                  {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (<button type="button" onClick={() => startEditInstruction(instruction)} className="bg-amber-600 text-white px-3 py-2.5 rounded-lg text-sm">✏️ {t.loadEdit}</button>)}
                  {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (<button type="button" onClick={() => deleteWorkInstruction(instruction.id)} className="bg-red-600 text-white px-3 py-2.5 rounded-lg text-sm">{t.deleteInstruction}</button>)}
                </div>
                </>)}
              </section>
            ));
          })()}
        </div>
      )}

      {activeTab === "woche" && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">{t.weekView}</h2>
            <div className="flex items-center gap-3"><label className="text-sm font-medium">{t.selectDate}:</label><input type="date" className="border p-3 rounded-lg text-black bg-white" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} /></div>
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
              if (!weekDates.some((d) => instructionCoversDate(i, d))) return false;
              return canSeeInstruction(i);
            });
            const todayStr = new Date().toISOString().split("T")[0];
            return (
              <>
                <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black">
                  <h3 className="font-bold mb-3">{t.week}: {getCalendarWeek(selectedWeek)}</h3>
                  {/* Handy: Tage untereinander (gut lesbar). Ab Tablet: 7-Spalten-Raster. */}
                  <div className="md:hidden space-y-2">
                    {weekDates.map((dateStr, wi) => {
                      const entries = weekInstructions.filter((inst) => instructionCoversDate(inst, dateStr));
                      const isToday = dateStr === todayStr;
                      const [yy, mm, dd] = dateStr.split("-");
                      return (
                        <div key={dateStr} onClick={() => { setSelectedDayDate(dateStr); setActiveTab("tag"); }} className={`border rounded-xl p-3 cursor-pointer active:bg-gray-100 ${isToday ? "border-cyan-600 bg-cyan-50" : entries.length > 0 ? "bg-green-50 border-green-300" : "bg-white"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-bold ${isToday ? "text-cyan-700" : "text-gray-800"}`}>{t.weekdays[wi]}, {dd}.{mm}.</span>
                            <span className="text-xs text-gray-500">{entries.length > 0 ? `${entries.length} ✓` : "–"}</span>
                          </div>
                          {entries.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {entries.map((e: any) => (
                                <li key={e.id} className="text-sm bg-white border border-green-200 rounded-lg px-2 py-1 text-gray-700 break-words">{getTranslated(e.id, "title", e.title)}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block">
                    <div className="grid grid-cols-7 gap-1 mb-1">{t.weekdays.map((label) => (<div key={label} className="text-center text-xs font-bold text-gray-500 py-1">{label.slice(0, 2)}</div>))}</div>
                    <div className="grid grid-cols-7 gap-1">
                      {weekDates.map((dateStr) => {
                        const entries = weekInstructions.filter((inst) => instructionCoversDate(inst, dateStr));
                        const isToday = dateStr === todayStr;
                        const dayNo = Number(dateStr.split("-")[2]);
                        return (<div key={dateStr} onClick={() => { setSelectedDayDate(dateStr); setActiveTab("tag"); }} className={`border rounded-lg p-2 min-h-24 min-w-0 cursor-pointer hover:border-cyan-500 transition-colors flex flex-col gap-1 ${isToday ? "border-cyan-600 bg-cyan-50" : entries.length > 0 ? "bg-green-50 border-green-300" : "bg-white"}`}><div className={`text-xs font-bold ${isToday ? "text-cyan-700" : "text-gray-700"}`}>{dayNo}{entries.length > 0 ? ` · ${entries.length} ✓` : ""}</div>{entries.map((e: any) => (<div key={e.id} className="text-xs leading-tight bg-white border border-green-200 rounded px-1 py-0.5 text-gray-700 truncate">{getTranslated(e.id, "title", e.title)}</div>))}</div>);
                      })}
                    </div>
                  </div>
                </section>
                <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-2">
                  <h3 className="font-bold">{t.workInstructions} ({weekInstructions.length})</h3>
                  {weekInstructions.length === 0 && <p className="text-gray-500">{t.noInstructionsWeek}</p>}
                  {weekInstructions.sort((a, b) => (a.work_date || "").localeCompare(b.work_date || "")).map((instruction) => (<div key={instruction.id} className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50"><div onClick={() => { markInstructionRead(instruction.id); setSelectedDayDate(instruction.work_date); setActiveTab("tag"); }} className="cursor-pointer hover:bg-gray-100 flex justify-between items-center"><div><span className="font-medium">{getTranslated(instruction.id, "title", instruction.title)}</span><span className="text-gray-500 text-sm ml-2">{instruction.customer || "-"}{instruction.project ? ` · ${t.project}: ${instruction.project}` : ""}</span></div><span className="text-sm text-gray-500">{instruction.work_date}</span></div>{renderReadStatus(instruction)}</div>))}
                </section>
              </>
            );
          })()}
        </div>
      )}

      {activeTab === "monat" && (
        <div className="space-y-4">
          <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-3">
            <h2 className="text-xl font-bold">{t.monthView}</h2>
            <input type="month" className="border p-3 rounded-lg text-black bg-white" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          </section>
          {(() => {
            const monthInstructions = workInstructions.filter((i) => {
              if (!instrDatesFor(i).some((d) => d.startsWith(selectedMonth))) return false;
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
                <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black">
                  <h3 className="font-bold mb-3">{selectedMonth}</h3>
                  <div className="grid grid-cols-7 gap-1 mb-1">{t.weekdays.map((label) => (<div key={label} className="text-center text-xs font-bold text-gray-500 py-1">{label.slice(0, 2)}</div>))}</div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, i) => {
                      if (!day) return <div key={`e-${i}`} />;
                      const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                      const entries = monthInstructions.filter((inst) => instructionCoversDate(inst, dateStr));
                      const isToday = dateStr === new Date().toISOString().split("T")[0];
                      return (<div key={day} onClick={() => { setSelectedDayDate(dateStr); setActiveTab("tag"); }} className={`border rounded-lg p-1 min-h-14 min-w-0 cursor-pointer hover:border-cyan-500 transition-colors ${isToday ? "border-cyan-600 bg-cyan-50" : entries.length > 0 ? "bg-green-50 border-green-300" : "bg-white"}`}><div className={`text-xs font-bold ${isToday ? "text-cyan-700" : "text-gray-700"}`}>{day}</div>{entries.length > 0 && <div className="text-xs text-green-700 font-medium">{entries.length} ✓</div>}{entries[0] && <div className="text-xs text-gray-500 truncate">{getTranslated(entries[0].id, "title", entries[0].title)}</div>}</div>);
                    })}
                  </div>
                </section>
                <section className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white text-black space-y-2">
                  <h3 className="font-bold">{t.workInstructions} ({monthInstructions.length})</h3>
                  {monthInstructions.length === 0 && <p className="text-gray-500">{t.noInstructionsMonth}</p>}
                  {monthInstructions.sort((a, b) => (a.work_date || "").localeCompare(b.work_date || "")).map((instruction) => (<div key={instruction.id} className="border border-slate-200 rounded-xl p-3 shadow-sm bg-gray-50"><div onClick={() => { markInstructionRead(instruction.id); setSelectedDayDate(instruction.work_date); setActiveTab("tag"); }} className="cursor-pointer hover:bg-gray-100 flex justify-between items-center"><div><span className="font-medium">{getTranslated(instruction.id, "title", instruction.title)}</span><span className="text-gray-500 text-sm ml-2">{instruction.customer || "-"}{instruction.project ? ` · ${t.project}: ${instruction.project}` : ""}</span></div><span className="text-sm text-gray-500">{instruction.work_date}</span></div>{renderReadStatus(instruction)}</div>))}
                </section>
              </>
            );
          })()}
        </div>
      )}

      {activeTab === "mitarbeiter" && (
        <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 bg-white text-black">
          <h2 className="text-xl font-bold">{t.employeeManagement}</h2>
          {(currentCompany?.role === "owner" || currentCompany?.role === "admin" || currentCompany?.role === "project_manager") && (
            <div className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-gray-50 space-y-3">
              <h3 className="font-bold">Neuen Mitarbeiter anlegen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border p-3 text-black bg-white" placeholder="Vollständiger Name *" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder="Benutzername * (für Login)" value={newUserUsername} onChange={(e) => setNewUserUsername(e.target.value)} />
                <input className="border p-3 text-black bg-white" placeholder="Passwort * (min. 8 Zeichen)" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                <select className="border p-3 text-black bg-white" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                  <option value="employee">{t.roleEmployee}</option>
                  {(currentCompany?.role === "owner" || currentCompany?.role === "admin") && <option value="project_manager">{t.roleProjectManager}</option>}
                  {currentCompany?.role === "owner" && <option value="admin">{t.roleAdmin}</option>}
                </select>
                <select className="border p-3 text-black bg-white" value={newUserLanguage} onChange={(e) => setNewUserLanguage(e.target.value)}>
                  {getAllowedLanguages(companyFeatures).filter(l => languages.includes(l as Language)).map((lang) => (<option key={lang} value={lang}>🌐 {lang}</option>))}
                </select>
                <select className="border p-3 text-black bg-white" value={newUserNationality} onChange={(e) => setNewUserNationality(e.target.value)}>
                  <option value="">Nationalität *</option>
                  {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
                <input className="border p-3 text-black bg-white" placeholder="Telefonnummer *" value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={newUserReadOnly} onChange={(e) => setNewUserReadOnly(e.target.checked)} />
                👁️ {t.readOnlyLabel}
              </label>
              <button type="button" onClick={addCompanyUser} disabled={creatingEmployee} className="bg-cyan-700 text-white px-4 py-3 rounded-lg disabled:opacity-50">{creatingEmployee ? "Wird angelegt..." : t.addEmployee}</button>
              <p className="text-xs text-gray-400">Der Mitarbeiter meldet sich mit seinem Benutzernamen und Passwort an.</p>
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p>{t.currentEmployees}: <strong>{companyUsers.length}</strong></p>
            <button type="button" onClick={() => setShowOverview(v => !v)} className="bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm">📋 {t.overviewBtn} {showOverview ? "▲" : "▼"}</button>
          </div>
          {showOverview && (
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 font-bold">{t.nameLabel}</th>
                    <th className="px-3 py-2 font-bold">{t.role}</th>
                    <th className="px-3 py-2 font-bold">🌐 {t.languageLabel}</th>
                    <th className="px-3 py-2 font-bold">{t.nationalityLabel}</th>
                    <th className="px-3 py-2 font-bold">📞 {t.phoneLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...companyUsers].sort((a: any, b: any) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "")).map((m: any) => (
                    <tr key={m.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">{m.full_name || m.email || "-"}</td>
                      <td className="px-3 py-2">{roleLabel(m.role)}</td>
                      <td className="px-3 py-2">{m.preferred_language || "-"}</td>
                      <td className="px-3 py-2">{m.nationality || "-"}</td>
                      <td className="px-3 py-2">{m.phone || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="space-y-3">
            {companyUsers.map((member) => (
              <div key={member.id} className="border border-slate-200 rounded-xl p-3 shadow-sm space-y-2">
                <strong>{member.full_name || "-"}</strong>
                <p>{member.email || "-"}</p>
                <p>{t.role}: {roleLabel(member.role)}{member.preferred_language ? ` · 🌐 ${member.preferred_language}` : ""}</p>
                <p className="text-sm text-gray-600">{member.nationality || "-"}{member.phone ? ` · 📞 ${member.phone}` : ""}{member.read_only ? " · 👁️ nur lesen" : ""}</p>
                <div className="flex gap-2 flex-wrap">
                  {member.email && (<button type="button" onClick={() => resetCompanyUserPassword(member.email)} className="bg-gray-700 text-white px-3 py-2.5 rounded-lg">{t.resetPassword}</button>)}
                  {currentCompany && canManageMember(currentCompany.role, member.role) && (
                    <button type="button" onClick={() => { const open = editMemberId !== member.id; setEditMemberId(open ? member.id : null); if (open) { setEditRole(member.role); setEditLang(member.preferred_language || "Deutsch"); setEditNationality(member.nationality || ""); setEditPhone(member.phone || ""); setEditReadOnly(!!member.read_only); } }} className="bg-cyan-700 text-white px-3 py-2.5 rounded-lg">✏️ {t.editBtn}</button>
                  )}
                  {currentCompany && canDelete(currentCompany.role, member.role) && member.user_id !== user?.id && (
                    <button type="button" onClick={() => deleteCompanyUser(member.id, member.user_id)} className="bg-red-600 text-white px-3 py-2.5 rounded-lg">🗑️ Löschen</button>
                  )}
                </div>
                {editMemberId === member.id && currentCompany && (
                  <div className="border-t pt-2 mt-1 space-y-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">{t.role}</label>
                      <select className="border p-2 rounded-lg text-black bg-white" value={editRole} disabled={member.user_id === user?.id} onChange={(e) => setEditRole(e.target.value)}>
                        {Array.from(new Set([member.role, ...settableRoles(currentCompany.role)])).map((r) => (<option key={r} value={r}>{roleLabel(r)}</option>))}
                      </select>
                      {member.user_id === user?.id && <span className="text-xs text-gray-400">Die eigene Rolle kann hier nicht geändert werden.</span>}
                      <label className="text-sm font-medium">🌐 {t.languageLabel}</label>
                      <select className="border p-2 rounded-lg text-black bg-white" value={editLang} onChange={(e) => setEditLang(e.target.value)}>
                        {getAllowedLanguages(companyFeatures).filter(l => languages.includes(l as Language)).map((lang) => (<option key={lang} value={lang}>{lang}</option>))}
                      </select>
                      <label className="text-sm font-medium">Nationalität</label>
                      <select className="border p-2 rounded-lg text-black bg-white" value={editNationality} onChange={(e) => setEditNationality(e.target.value)}>
                        <option value="">– bitte wählen –</option>
                        {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select>
                      <label className="text-sm font-medium">📞 Telefon</label>
                      <input className="border p-2 rounded-lg text-black bg-white" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                      <label className="flex items-center gap-2 text-sm font-medium mt-1">
                        <input type="checkbox" checked={editReadOnly} onChange={(e) => setEditReadOnly(e.target.checked)} />
                        👁️ {t.readOnlyLabel}
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" disabled={savingEdit} onClick={() => updateEmployee(member)} className="bg-cyan-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">{savingEdit ? "⏳" : "💾"} {t.saveBtn}</button>
                      <button type="button" onClick={() => setEditMemberId(null)} className="bg-gray-200 px-4 py-2.5 rounded-lg text-sm">{t.cancelBtn}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "firmendaten" && (
        <section className="border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 bg-white text-black">
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
          <button type="button" onClick={saveCompanySettings} className="bg-cyan-700 text-white px-4 py-3 rounded-lg">{t.saveCompany}</button>
        </section>
      )}

      {/* ── NEU: Kopier-Dialog – Schritte aus bestehender Anweisung ins Formular übernehmen ── */}
      {copyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setCopyModalOpen(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold">📋 {t.copyTitle}</h3>
            <div>
              <label className="block text-sm font-medium mb-1">{t.copySource}</label>
              <select className="border p-3 w-full rounded-lg text-black bg-white" value={copyModalInstruction?.id || ""} onChange={(e) => selectCopySource(e.target.value)}>
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
                  <button type="button" className="text-xs text-cyan-700 underline" onClick={() => {
                    const all = (copyModalInstruction.work_instruction_tasks || []).map((task: any) => task.id);
                    setCopySelectedTaskIds((prev) => prev.length === all.length ? [] : all);
                  }}>{t.copyAllNone}</button>
                </div>
                {(copyModalInstruction.work_instruction_tasks || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((task: any) => (
                  <label key={task.id} className="flex items-start gap-2 border rounded-lg p-2 cursor-pointer bg-gray-50">
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
              <button type="button" onClick={() => setCopyModalOpen(false)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium">{t.copyCancel}</button>
              <button type="button" disabled={!copyModalInstruction || copySelectedTaskIds.length === 0} onClick={applyCopiedSteps} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold disabled:opacity-50">{t.copyConfirm}</button>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setHelpOpen(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center sticky top-0 bg-white pb-2 border-b">
              <h2 className="text-xl font-bold">❓ {t.help}</h2>
              <button type="button" onClick={() => setHelpOpen(false)} className="text-gray-500 text-3xl leading-none px-2">×</button>
            </div>
            {helpText === null ? (<p className="text-gray-400">…</p>) : helpText.trim() === "" ? (<p className="text-gray-500">{t.helpEmpty}</p>) : (<div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{helpText}</div>)}
          </div>
        </div>
      )}

      {transferConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setTransferConfirm(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 text-black" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-xl font-bold">📋 {tx.exReportTitle}</h2>
              <button type="button" onClick={() => setTransferConfirm(null)} className="text-gray-500 text-3xl leading-none px-2">×</button>
            </div>
            <p className="text-sm">{tx.exReportAsk}</p>
            <div className="border rounded-lg p-2 bg-gray-50 text-sm">
              <strong>{transferConfirm.report.report_name}</strong>
              {reportProjects(transferConfirm.report) ? <span className="text-xs text-cyan-700"> · {reportProjects(transferConfirm.report)}</span> : null}
              <span className="text-xs text-gray-500 block">{getCalendarWeek(transferConfirm.instruction.work_date)} · {transferConfirm.instruction.work_date}</span>
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => { const c = transferConfirm; setTransferConfirm(null); createReportFromInstruction(c.instruction, c.report); }} className="w-full bg-green-700 text-white px-4 py-3 rounded-lg">✅ {tx.exReportYes} · {getCalendarWeek(transferConfirm.instruction.work_date)}</button>
              <button type="button" onClick={() => { const inst = transferConfirm.instruction; setTransferConfirm(null); createReportFromInstruction(inst); }} className="w-full bg-cyan-600 text-white px-4 py-3 rounded-lg">➕ {tx.exReportNo}</button>
            </div>
          </div>
        </div>
      )}

      {transferInst && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setTransferInst(null)}>
          <div className="bg-white rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto p-5 space-y-3 text-black" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-xl font-bold">{t.transferTitle}</h2>
              <button type="button" onClick={() => setTransferInst(null)} className="text-gray-500 text-3xl leading-none px-2">×</button>
            </div>
            <button type="button" onClick={() => { const inst = transferInst; setTransferInst(null); createReportFromInstruction(inst); }} className="w-full bg-green-700 text-white px-4 py-3 rounded-lg">➕ {t.newReport}</button>
            {savedReports.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                {savedReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between gap-2 border rounded-lg p-2">
                    <span className="text-sm truncate"><strong>{report.report_name}</strong>{reportProjects(report) ? <span className="text-xs text-cyan-700"> · {reportProjects(report)}</span> : null}</span>
                    <button type="button" onClick={() => { const inst = transferInst; setTransferInst(null); createReportFromInstruction(inst, report); }} className="bg-cyan-600 text-white px-3 py-2.5 rounded-lg text-sm whitespace-nowrap">{t.transferInsert}</button>
                  </div>
                ))}
              </div>
            )}
            {savedReports.length === 0 && (<p className="text-sm text-gray-500 text-center py-1">{t.transferNoReports}</p>)}
            <button type="button" onClick={() => setTransferInst(null)} className="w-full bg-gray-300 text-black px-4 py-2.5 rounded-lg">{t.copyCancel}</button>
          </div>
        </div>
      )}

      <footer className="text-center text-xs text-gray-500 pt-4 pb-2">
        <a href="/impressum" className="underline hover:text-gray-700">Impressum</a>
        <span className="mx-2">·</span>
        <a href="/datenschutz" className="underline hover:text-gray-700">Datenschutz</a>
        <span className="mx-2">·</span>
        <a href="/agb" className="underline hover:text-gray-700">AGB</a>
      </footer>

    </main>
  );
}
