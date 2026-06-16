import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, fullName, role, companyId } = body;

    if (!username || !password || !companyId) {
      return Response.json({ error: "Benutzername, Passwort und Firma fehlen." }, { status: 400 });
    }

    // Fake-E-Mail aus Benutzername generieren
    const email = `${username.toLowerCase().replace(/\s+/g, ".")}@regie-internal.app`;

    // Supabase Admin Client mit Service Role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // User in auth.users anlegen
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Keine E-Mail-Bestätigung nötig
      user_metadata: {
        full_name: fullName,
        username,
      },
    });

    if (authError) {
      return Response.json({ error: authError.message }, { status: 500 });
    }

    // User in company_users eintragen
    const { error: companyUserError } = await supabaseAdmin
      .from("company_users")
      .insert({
        company_id: companyId,
        user_id: newUser.user.id,
        email,
        full_name: fullName,
        role: role || "employee",
      });

    if (companyUserError) {
      return Response.json({ error: companyUserError.message }, { status: 500 });
    }

    return Response.json({ success: true, email });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}