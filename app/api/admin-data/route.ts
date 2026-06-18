import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const PACKAGES: Record<string, any> = {
  starter:    { max_employees: 5,    module_reports: true,  module_work_orders: false, module_auto_reports: false, photos_enabled: false, email_enabled: false, signature_enabled: false, ai_enabled: false, allowed_languages: ["Deutsch"] },
  team:       { max_employees: 20,   module_reports: true,  module_work_orders: true,  module_auto_reports: false, photos_enabled: true,  email_enabled: true,  signature_enabled: false, ai_enabled: true,  allowed_languages: ["Deutsch", "Polnisch"] },
  business:   { max_employees: 100,  module_reports: true,  module_work_orders: true,  module_auto_reports: true,  photos_enabled: true,  email_enabled: true,  signature_enabled: true,  ai_enabled: true,  allowed_languages: ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"] },
  enterprise: { max_employees: 9999, module_reports: true,  module_work_orders: true,  module_auto_reports: true,  photos_enabled: true,  email_enabled: true,  signature_enabled: true,  ai_enabled: true,  allowed_languages: ["Deutsch", "Kroatisch", "Slowenisch", "Polnisch", "Englisch"] },
};

export async function GET() {
  const { data: companies, error } = await supabaseAdmin.from("companies").select("*").order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const result = [];
  for (const company of companies || []) {
    const { data: features } = await supabaseAdmin.from("company_features").select("*").eq("company_id", company.id).single();
    const { data: users } = await supabaseAdmin.from("company_users").select("*").eq("company_id", company.id);
    result.push({ ...company, features: features || null, users: users || [] });
  }
  return Response.json({ companies: result });
}

export async function POST(request: Request) {
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

  return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
}