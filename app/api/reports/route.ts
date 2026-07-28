import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// Berichte-Aktionen, die andere Nutzer betreffen (Admin/Owner sehen alle,
// archivieren/loeschen fremde Berichte). Laeuft ueber den Service-Key -> RLS-sicher.
export async function POST(request: Request) {
  try {
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !serviceKey) return Response.json({ error: "Server-Konfiguration fehlt." }, { status: 500 });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) return Response.json({ error: "Ungültige oder abgelaufene Sitzung." }, { status: 401 });

    const { data: callerMember } = await admin
      .from("company_users").select("company_id, role").eq("user_id", caller.id).maybeSingle();
    if (!callerMember) return Response.json({ error: "Keine Berechtigung." }, { status: 403 });
    const companyId = callerMember.company_id;
    const role = callerMember.role;
    const isAdminOwner = role === "owner" || role === "admin";

    // user_ids der eigenen Firma
    const { data: members } = await admin
      .from("company_users").select("user_id").eq("company_id", companyId);
    const memberIds = (members || []).map((m: any) => m.user_id);

    const body = await request.json();
    const action = body?.action;

    if (action === "list_all") {
      if (!isAdminOwner) return Response.json({ rows: [] });
      const { data, error } = await admin
        .from("reports").select("*").in("user_id", memberIds).order("created_at", { ascending: false });
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ rows: data || [] });
    }

    if (action === "archive" || action === "delete") {
      const id = body?.id;
      if (!id) return Response.json({ error: "ID fehlt." }, { status: 400 });
      const { data: report } = await admin.from("reports").select("id, user_id").eq("id", id).maybeSingle();
      if (!report) return Response.json({ error: "Bericht nicht gefunden." }, { status: 404 });
      // Nur eigene Firma; fremde Berichte nur Admin/Owner.
      if (!memberIds.includes(report.user_id)) return Response.json({ error: "Keine Berechtigung (andere Firma)." }, { status: 403 });
      if (report.user_id !== caller.id && !isAdminOwner) return Response.json({ error: "Keine Berechtigung." }, { status: 403 });

      if (action === "archive") {
        const { error } = await admin.from("reports").update({ archived: !!body?.value }).eq("id", id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true });
      }
      const { error } = await admin.from("reports").delete().eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
