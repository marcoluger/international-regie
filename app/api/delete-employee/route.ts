import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// Wer darf wen loeschen?
// Owner -> jeden (ausser sich selbst / letzter Owner)
// Admin -> project_manager, employee
// Projektleiter -> employee
function canManage(myRole: string, targetRole: string): boolean {
  if (myRole === "owner") return true;
  if (myRole === "admin") return targetRole === "employee" || targetRole === "project_manager";
  if (myRole === "project_manager") return targetRole === "employee";
  return false;
}

export async function POST(request: Request) {
  try {
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

    // 1) Authentifizierung
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return Response.json({ error: "Ungültige oder abgelaufene Sitzung." }, { status: 401 });
    }

    // 2) Aufrufer laden
    const { data: callerMember } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!callerMember) {
      return Response.json({ error: "Keine Berechtigung (kein Firmenkonto)." }, { status: 403 });
    }

    // 3) Ziel laden (gleiche Firma)
    const { data: targetMember } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!targetMember) {
      return Response.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });
    }
    if (targetMember.company_id !== callerMember.company_id) {
      return Response.json({ error: "Keine Berechtigung (andere Firma)." }, { status: 403 });
    }

    // 4) Berechtigung
    if (!canManage(callerMember.role, targetMember.role)) {
      return Response.json({ error: "Keine Berechtigung, diesen Mitarbeiter zu löschen." }, { status: 403 });
    }
    // 5) Schutzregeln
    if (caller.id === userId) {
      return Response.json({ error: "Das eigene Konto kann hier nicht gelöscht werden." }, { status: 403 });
    }
    if (targetMember.role === "owner") {
      const { count } = await supabaseAdmin
        .from("company_users")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", callerMember.company_id)
        .eq("role", "owner");
      if ((count ?? 0) <= 1) {
        return Response.json({ error: "Der letzte Owner kann nicht gelöscht werden." }, { status: 403 });
      }
    }

    // 6) Aufraeumen: zugewiesene Geraete freigeben, offene Planungen entfernen (best effort)
    try {
      await supabaseAdmin
        .from("equipment")
        .update({ assigned_to: null, assigned_to_name: null, assigned_at: null })
        .eq("company_id", callerMember.company_id)
        .eq("assigned_to", userId);
    } catch { /* Modul evtl. nicht vorhanden */ }
    try {
      await supabaseAdmin
        .from("equipment_plan")
        .delete()
        .eq("company_id", callerMember.company_id)
        .eq("user_id", userId);
    } catch { /* Tabelle evtl. nicht vorhanden */ }

    // 7) Firmen-Mitgliedschaft loeschen
    const { error: delErr } = await supabaseAdmin
      .from("company_users")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", callerMember.company_id);
    if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

    // 8) Login-Konto entfernen (best effort – falls schon weg, ignorieren)
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch { /* Auth-Konto evtl. bereits entfernt */ }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
