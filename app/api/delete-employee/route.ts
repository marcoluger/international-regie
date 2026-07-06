import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// Wer darf wen bearbeiten?
// Owner -> jeden
// Admin -> project_manager, employee
// Projektleiter -> employee
function canManage(myRole: string, targetRole: string): boolean {
  if (myRole === "owner") return true;
  if (myRole === "admin") return targetRole === "employee" || targetRole === "project_manager";
  if (myRole === "project_manager") return targetRole === "employee";
  return false;
}

// Welche Rollen darf wer VERGEBEN?
const ALLOWED_TO_SET: Record<string, string[]> = {
  owner: ["owner", "admin", "project_manager", "employee"],
  admin: ["project_manager", "employee"],
  project_manager: ["employee"],
};

export async function POST(request: Request) {
  try {
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const { userId, role, preferredLanguage } = await request.json();
    if (!userId) {
      return Response.json({ error: "User ID fehlt." }, { status: 400 });
    }

    // Es muss mindestens etwas zu aendern geben
    const wantRole = typeof role === "string" && role.trim() ? role.trim() : null;
    const wantLang =
      typeof preferredLanguage === "string" && preferredLanguage.trim()
        ? preferredLanguage.trim()
        : null;
    if (!wantRole && !wantLang) {
      return Response.json({ error: "Nichts zu aendern." }, { status: 400 });
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
      return Response.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });
    }
    if (targetMember.company_id !== callerMember.company_id) {
      return Response.json({ error: "Keine Berechtigung (andere Firma)." }, { status: 403 });
    }

    // 4) Darf der Aufrufer dieses Ziel ueberhaupt bearbeiten?
    if (!canManage(callerMember.role, targetMember.role)) {
      return Response.json({ error: "Keine Berechtigung, diesen Mitarbeiter zu bearbeiten." }, { status: 403 });
    }

    const updates: Record<string, any> = {};

    // 5) Rollenwechsel (optional) – mit Schutzregeln
    if (wantRole && wantRole !== targetMember.role) {
      // Sich selbst nicht in der Rolle aendern (Aussperr-Schutz)
      if (caller.id === userId) {
        return Response.json({ error: "Die eigene Rolle kann hier nicht geaendert werden." }, { status: 403 });
      }
      // Neue Rolle muss der Aufrufer vergeben duerfen
      const settable = ALLOWED_TO_SET[callerMember.role] || [];
      if (!settable.includes(wantRole)) {
        return Response.json({ error: "Keine Berechtigung, diese Rolle zu vergeben." }, { status: 403 });
      }
      // Letzten Owner nicht herabstufen
      if (targetMember.role === "owner" && wantRole !== "owner") {
        const { count } = await supabaseAdmin
          .from("company_users")
          .select("user_id", { count: "exact", head: true })
          .eq("company_id", callerMember.company_id)
          .eq("role", "owner");
        if ((count ?? 0) <= 1) {
          return Response.json({ error: "Der letzte Owner kann nicht herabgestuft werden." }, { status: 403 });
        }
      }
      updates.role = wantRole;
    }

    // 6) Sprache (optional)
    if (wantLang) {
      updates.preferred_language = wantLang;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: true, unchanged: true });
    }

    const { error: updErr } = await supabaseAdmin
      .from("company_users")
      .update(updates)
      .eq("user_id", userId);
    if (updErr) return Response.json({ error: updErr.message }, { status: 500 });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}