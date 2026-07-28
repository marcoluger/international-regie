import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// Zeiten, die ein Mitarbeiter je Arbeitsanweisung/Tag erfasst.
// Laeuft ueber den Service-Key -> unabhaengig von RLS.
export async function POST(request: Request) {
  try {
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !serviceKey) {
      return Response.json({ error: "Server-Konfiguration fehlt." }, { status: 500 });
    }
    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Authentifizierung
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return Response.json({ error: "Ungültige oder abgelaufene Sitzung." }, { status: 401 });
    }

    // Firma des Aufrufers
    const { data: callerMember } = await supabaseAdmin
      .from("company_users")
      .select("company_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!callerMember) {
      return Response.json({ error: "Keine Berechtigung (kein Firmenkonto)." }, { status: 403 });
    }
    const companyId = callerMember.company_id;

    const body = await request.json();
    const action = body?.action;

    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("work_instruction_times")
        .select("*")
        .eq("company_id", companyId)
        .eq("user_id", caller.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ rows: data || [] });
    }

    if (action === "save") {
      const instructionId = body?.instructionId;
      const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
      if (!instructionId || rows.length === 0) {
        return Response.json({ error: "Keine Daten." }, { status: 400 });
      }
      const payload = rows.map((r) => ({
        work_instruction_id: instructionId,
        company_id: companyId,
        user_id: caller.id,
        work_date: r.work_date,
        start_time: r.start_time ?? null,
        end_time: r.end_time ?? null,
        break_minutes: r.break_minutes ?? null,
        hours: r.hours ?? null,
        travel_out_start: r.travel_out_start ?? null,
        travel_out_end: r.travel_out_end ?? null,
        travel_out_km: r.travel_out_km ?? null,
        travel_return_start: r.travel_return_start ?? null,
        travel_return_end: r.travel_return_end ?? null,
        travel_return_km: r.travel_return_km ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabaseAdmin
        .from("work_instruction_times")
        .upsert(payload, { onConflict: "work_instruction_id,user_id,work_date" });
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
