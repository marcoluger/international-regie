import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// /api/absences
// Urlaub & Abwesenheiten: melden, auflisten, genehmigen/ablehnen, loeschen.
// Body (POST): { action: "list" | "create" | "decide" | "delete", ... }

const MANAGER_ROLES = ["owner", "admin", "project_manager"];

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

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return Response.json({ error: "Ungültige oder abgelaufene Sitzung." }, { status: 401 });
    }

    const { data: member } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role, full_name, email")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!member) {
      return Response.json({ error: "Keine Berechtigung (kein Firmenkonto)." }, { status: 403 });
    }

    const { data: feat } = await supabaseAdmin
      .from("company_features")
      .select("absence_enabled")
      .eq("company_id", member.company_id)
      .maybeSingle();
    if (!feat?.absence_enabled) {
      return Response.json({ error: "Das Modul Urlaub & Abwesenheiten ist nicht freigeschaltet." }, { status: 403 });
    }

    const body = await request.json();
    const action = body?.action || "list";
    const isManager = MANAGER_ROLES.includes(member.role);
    const myName = member.full_name || member.email || "";

    // ── Auflisten: Manager sehen alle, Mitarbeiter nur die eigenen ──
    if (action === "list") {
      let q = supabaseAdmin
        .from("absences")
        .select("id, user_id, user_name, type, start_date, end_date, note, status, decided_by_name, decided_at, created_at")
        .eq("company_id", member.company_id)
        .order("start_date", { ascending: false })
        .limit(500);
      if (!isManager) q = q.eq("user_id", caller.id);
      const { data, error } = await q;
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ items: data || [] });
    }

    // ── Melden ──
    if (action === "create") {
      const start = String(body?.startDate ?? "").slice(0, 10);
      const end = String(body?.endDate ?? "").slice(0, 10) || start;
      if (!start) return Response.json({ error: "Startdatum fehlt." }, { status: 400 });
      if (end < start) return Response.json({ error: "Das Enddatum liegt vor dem Startdatum." }, { status: 400 });
      const row = {
        company_id: member.company_id,
        user_id: caller.id,
        user_name: myName,
        type: body?.type === "sick" ? "sick" : "vacation",
        start_date: start,
        end_date: end,
        note: String(body?.note ?? "").trim().slice(0, 500),
        status: "pending",
      };
      const { error } = await supabaseAdmin.from("absences").insert(row);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    // ── Genehmigen / Ablehnen (nur Owner/Admin/Projektleiter) ──
    if (action === "decide") {
      if (!isManager) return Response.json({ error: "Keine Berechtigung." }, { status: 403 });
      const status = String(body?.status ?? "");
      if (!["pending", "approved", "rejected"].includes(status)) {
        return Response.json({ error: "Ungültiger Status." }, { status: 400 });
      }
      if (!body?.id) return Response.json({ error: "id fehlt." }, { status: 400 });
      const { error } = await supabaseAdmin
        .from("absences")
        .update({ status, decided_by_name: myName, decided_at: new Date().toISOString() })
        .eq("id", body.id)
        .eq("company_id", member.company_id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    // ── Loeschen: Manager immer, Mitarbeiter nur die eigene offene Meldung ──
    if (action === "delete") {
      if (!body?.id) return Response.json({ error: "id fehlt." }, { status: 400 });
      const { data: row } = await supabaseAdmin
        .from("absences")
        .select("id, company_id, user_id, status")
        .eq("id", body.id)
        .maybeSingle();
      if (!row || row.company_id !== member.company_id) {
        return Response.json({ error: "Meldung nicht gefunden." }, { status: 404 });
      }
      if (!isManager && !(row.user_id === caller.id && row.status === "pending")) {
        return Response.json({ error: "Keine Berechtigung." }, { status: 403 });
      }
      const { error } = await supabaseAdmin
        .from("absences")
        .delete()
        .eq("id", body.id)
        .eq("company_id", member.company_id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}