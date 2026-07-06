import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const PACKAGES: Record<string, any> = {
  starter:    { max_employees: 5,    max_photos: 2,  module_reports: true,  module_work_orders: false, module_auto_reports: false, photos_enabled: false, email_enabled: false, signature_enabled: false, ai_enabled: false, allowed_languages: ["Deutsch"] },
  team:       { max_employees: 20,   max_photos: 10, module_reports: true,  module_work_orders: true,  module_auto_reports: false, photos_enabled: true,  email_enabled: true,  signature_enabled: false, ai_enabled: true,  allowed_languages: ["Deutsch", "Polnisch"] },
  business:   { max_employees: 100,  max_photos: 30, module_reports: true,  module_work_orders: true,  module_auto_reports: true,  photos_enabled: true,  email_enabled: true,  signature_enabled: true,  ai_enabled: true,  allowed_languages: ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"] },
  enterprise: { max_employees: 9999, max_photos: 0,  module_reports: true,  module_work_orders: true,  module_auto_reports: true,  photos_enabled: true,  email_enabled: true,  signature_enabled: true,  ai_enabled: true,  allowed_languages: ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"] },
};

// Erzeugt ein lesbares Temporaer-Passwort (mehrdeutige Zeichen vermieden). Wird sofort vom Nutzer geaendert.
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

// Liste erlaubter Super-Admin User-IDs aus der Umgebungsvariable SUPER_ADMIN_IDS
// (kommagetrennt in Vercel hinterlegen).
function getSuperAdminIds(): string[] {
  return (process.env.SUPER_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Prüft Anmeldung + Super-Admin-Berechtigung. Gibt bei Erfolg null zurück,
// sonst eine fertige Fehler-Response.
async function requireSuperAdmin(request: Request): Promise<Response | null> {
  const allowed = getSuperAdminIds();
  if (allowed.length === 0) {
    return Response.json({ error: "Super-Admin ist nicht konfiguriert (SUPER_ADMIN_IDS fehlt)." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const caller = userData?.user;
  if (userErr || !caller) {
    return Response.json({ error: "Ungültige oder abgelaufene Sitzung." }, { status: 401 });
  }
  if (!allowed.includes(caller.id)) {
    return Response.json({ error: "Kein Zugriff (nur Plattform-Administrator)." }, { status: 403 });
  }
  return null; // berechtigt
}

export async function GET(request: Request) {
  const denied = await requireSuperAdmin(request);
  if (denied) return denied;

  const { data: companies, error } = await supabaseAdmin.from("companies").select("*").order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const result = [];
  for (const company of companies || []) {
    const { data: features } = await supabaseAdmin.from("company_features").select("*").eq("company_id", company.id).single();
    const { data: users } = await supabaseAdmin.from("company_users").select("*").eq("company_id", company.id);
    const owner = (users || []).find((u: any) => u.role === "owner");
    let settings: any = null;
    if (owner?.user_id) {
      const { data: s } = await supabaseAdmin.from("company_settings").select("*").eq("user_id", owner.user_id).maybeSingle();
      settings = s || null;
    }
    result.push({ ...company, features: features || null, users: users || [], owner_user_id: owner?.user_id || null, settings });
  }
  const { data: legalRow } = await supabaseAdmin.from("site_legal").select("*").eq("id", "main").maybeSingle();
  return Response.json({ companies: result, legal: legalRow || { impressum: "", datenschutz: "" } });
}

export async function POST(request: Request) {
  const denied = await requireSuperAdmin(request);
  if (denied) return denied;

  const body = await request.json();
  const { action } = body;

  if (action === "saveFeatures") {
    const { companyId, features } = body;
    const cleanFeatures = {
      ...features,
      valid_until: features.valid_until || null, // Leerer String → null
      company_id: companyId,
    };
    const { error } = await supabaseAdmin.from("company_features").upsert(cleanFeatures, { onConflict: "company_id" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  if (action === "updateSlug") {
    const { companyId, slug } = body;
    const { error } = await supabaseAdmin.from("companies").update({ slug }).eq("id", companyId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  if (action === "updateCompanyName") {
    const { companyId, name } = body;
    if (!name || !String(name).trim()) return Response.json({ error: "Firmenname fehlt" }, { status: 400 });
    const { error } = await supabaseAdmin.from("companies").update({ name: String(name).trim() }).eq("id", companyId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  if (action === "saveCompanySettings") {
    const { ownerUserId, settings } = body;
    if (!ownerUserId) return Response.json({ error: "Kein Owner für diese Firma gefunden – Firmendaten können nicht gespeichert werden." }, { status: 400 });
    const allowed = ["company_name", "street", "zip_code", "city", "phone", "email", "website", "tax_number"];
    const clean: Record<string, any> = { user_id: ownerUserId };
    for (const k of allowed) {
      if (settings && k in settings) clean[k] = settings[k] ?? "";
    }
    // company_logo wird bewusst NICHT ueberschrieben, damit ein bestehendes Logo erhalten bleibt.
    const { error } = await supabaseAdmin.from("company_settings").upsert(clean, { onConflict: "user_id" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  if (action === "resetUserPassword") {
    const { userId } = body;
    if (!userId) return Response.json({ error: "userId fehlt" }, { status: 400 });
    const newPassword = generatePassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("company_users").update({ must_change_password: true }).eq("user_id", userId);
    return Response.json({ success: true, password: newPassword });
  }

  if (action === "createCompany") {
    const { name, slug, ownerUsername, ownerFullName, ownerPassword, packageName } = body;

    // 1. Firma anlegen
    const { data: company, error: companyError } = await supabaseAdmin.from("companies").insert({ name, slug }).select().single();
    if (companyError) return Response.json({ error: companyError.message }, { status: 500 });

    // 2. Owner Auth-User anlegen
    const email = `${slug}.${ownerUsername.toLowerCase().replace(/\s+/g, ".")}@regie-internal.app`;
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

    let userId: string;
    if (existingUser) {
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: ownerPassword });
      userId = existingUser.id;
      await supabaseAdmin.from("company_users").delete().eq("user_id", existingUser.id);
    } else {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password: ownerPassword, email_confirm: true });
      if (authError) return Response.json({ error: authError.message }, { status: 500 });
      userId = authUser.user.id;
    }

    // 3. company_users Eintrag
    await supabaseAdmin.from("company_users").insert({ company_id: company.id, user_id: userId, email, full_name: ownerFullName, role: "owner", must_change_password: true });

    // 4. company_settings
    await supabaseAdmin.from("company_settings").insert({ user_id: userId, company_name: name });

    // 5. Features
    const pkg = PACKAGES[packageName] || PACKAGES.starter;
    await supabaseAdmin.from("company_features").insert({ ...pkg, company_id: company.id, package_name: packageName });

    return Response.json({ success: true, email, userId });
  }

  if (action === "deleteCompany") {
    const { companyId } = body;
    // Auth-User löschen
    const { data: users } = await supabaseAdmin.from("company_users").select("user_id").eq("company_id", companyId);
    for (const u of users || []) {
      await supabaseAdmin.auth.admin.deleteUser(u.user_id);
    }
    await supabaseAdmin.from("company_features").delete().eq("company_id", companyId);
    await supabaseAdmin.from("company_users").delete().eq("company_id", companyId);
    await supabaseAdmin.from("companies").delete().eq("id", companyId);
    return Response.json({ success: true });
  }

  if (action === "setCompanyStatus") {
    const { companyId, status } = body;
    if (status !== "active" && status !== "blocked") return Response.json({ error: "Ungültiger Status" }, { status: 400 });
    const { error } = await supabaseAdmin.from("companies").update({ status }).eq("id", companyId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  if (action === "saveLegal") {
    const { impressum, datenschutz } = body;
    const { error } = await supabaseAdmin.from("site_legal").upsert({ id: "main", impressum: impressum ?? "", datenschutz: datenschutz ?? "" }, { onConflict: "id" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
}