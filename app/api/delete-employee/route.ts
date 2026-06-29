import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// Wer darf wen löschen? (entspricht canDelete in der App)
// Owner -> alle außer Owner
// Admin -> project_manager, employee
// Projektleiter -> employee
function canDelete(myRole: string, targetRole: string): boolean {
  if (myRole === "owner") return targetRole !== "owner";
  if (myRole === "admin") return targetRole === "employee" || targetRole === "project_manager";
  if (myRole === "project_manager") return targetRole === "employee";
  return false;
}

export async function POST(request: Request) {
  try {
    // Rate-Limiting (standard; greift nur, wenn Upstash konfiguriert ist)
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const { userId } = await request.json();
    if (!userId) {
      return Response.json({ error: "User ID fehlt." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !serviceKey) {
      return Response.json({ error: "Server-Konfiguration fehlt." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) AUTHENTIFIZIERUNG
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

    // Sich selbst löschen ist nicht erlaubt
    if (caller.id === userId) {
      return Response.json({ error: "Sie können sich nicht selbst löschen." }, { status: 403 });
    }

    // 2) Aufrufer-Rolle/Firma laden
    const { data: callerMember } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!callerMember) {
      return Response.json({ error: "Keine Berechtigung (kein Firmenkonto)." }, { status: 403 });
    }

    // 3) Ziel-Benutzer laden (muss zur selben Firma gehören)
    const { data: targetMember } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!targetMember) {
      return Response.json({ error: "Zu löschender Mitarbeiter nicht gefunden." }, { status: 404 });
    }
    if (targetMember.company_id !== callerMember.company_id) {
      return Response.json({ error: "Keine Berechtigung (andere Firma)." }, { status: 403 });
    }

    // 4) Rollenregeln prüfen
    if (!canDelete(callerMember.role, targetMember.role)) {
      return Response.json({ error: "Keine Berechtigung, diesen Mitarbeiter zu löschen." }, { status: 403 });
    }

    // 5) Löschen – erst Firmen-Eintrag, dann Auth-User
    await supabaseAdmin.from("company_users").delete().eq("user_id", userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error && !error.message.includes("not found") && !error.message.includes("User not found")) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
