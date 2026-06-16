import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, fullName, role, companyId, mustChangePassword } = body;

    if (!username || !password || !companyId) {
      return Response.json({ error: "Benutzername, Passwort und Firma fehlen." }, { status: 400 });
    }

    const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, ".")}@regie-internal.app`;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // User in auth.users anlegen
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username },
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
        full_name: fullName || username,
        role: role || "employee",
        must_change_password: mustChangePassword !== false, // default true
      });

    if (companyUserError) {
      return Response.json({ error: companyUserError.message }, { status: 500 });
    }

    return Response.json({ success: true, email, username });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}