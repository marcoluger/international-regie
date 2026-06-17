import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username, password, fullName, role, companyId, companySlug, mustChangePassword } = await request.json();

    if (!username || !password || !companyId) {
      return Response.json({ error: "Pflichtfelder fehlen." }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const slug = companySlug || companyId.slice(0, 8);
    const cleanUsername = username.toLowerCase().replace(/\s+/g, ".");
    const email = `${slug}.${cleanUsername}@regie-internal.app`;

    // Prüfen ob Auth-User bereits existiert
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // Auth-User existiert bereits – Passwort updaten und wiederverwenden
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
      userId = existingUser.id;
      // Alten company_users Eintrag löschen falls vorhanden
      await supabaseAdmin.from("company_users").delete().eq("user_id", existingUser.id);
    } else {
      // Neuen Auth-User anlegen
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) return Response.json({ error: authError.message }, { status: 500 });
      userId = authUser.user.id;
    }

    // company_users Eintrag anlegen
    const { error: dbError } = await supabaseAdmin.from("company_users").insert({
      company_id: companyId,
      user_id: userId,
      email,
      full_name: fullName || username,
      role: role || "employee",
      must_change_password: mustChangePassword ?? true,
    });

    if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

    return Response.json({ success: true, email, userId });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}