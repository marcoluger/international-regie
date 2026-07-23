import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// /api/material-orders
// Materialbestellungen: auflisten, anlegen, Status setzen, loeschen.
// Body (POST): { action: "list" | "create" | "status" | "delete", ... }

const MANAGER_ROLES = ["owner", "admin", "project_manager"];
const STATUSES = ["open", "ordered", "delivered"];

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

    // Anmeldung
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
      .select("company_id, role, read_only, full_name, email")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!member) {
      return Response.json({ error: "Keine Berechtigung (kein Firmenkonto)." }, { status: 403 });
    }

    // Modul muss freigeschaltet sein
    const { data: feat } = await supabaseAdmin
      .from("company_features")
      .select("material_enabled")
      .eq("company_id", member.company_id)
      .maybeSingle();
    if (!feat?.material_enabled) {
      return Response.json({ error: "Das Modul Materialerfassung ist nicht freigeschaltet." }, { status: 403 });
    }

    const body = await request.json();
    const action = body?.action || "list";
    const isManager = MANAGER_ROLES.includes(member.role);

    // ── Auflisten ──
    // Owner/Admin/Projektleiter sehen alle Bestellungen der Firma,
    // Mitarbeiter nur die eigenen.
    if (action === "list") {
      let q = supabaseAdmin
        .from("material_orders")
        .select("id, instruction_id, qty, unit, name, note, status, created_by_name, created_at")
        .eq("company_id", member.company_id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!isManager) q = q.eq("created_by", caller.id);
      const { data, error } = await q;
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ orders: data || [] });
    }

    // Ab hier: Aenderungen – nicht fuer Nur-lesen-Konten
    if (member.read_only) {
      return Response.json({ error: "Dieses Konto darf nur lesen." }, { status: 403 });
    }

    // ── Anlegen ──
    if (action === "create") {
      const name = String(body?.name ?? "").trim().slice(0, 200);
      if (!name) return Response.json({ error: "Bezeichnung fehlt." }, { status: 400 });
      const row = {
        company_id: member.company_id,
        instruction_id: body?.instructionId || null,
        qty: String(body?.qty ?? "").trim().slice(0, 20),
        unit: String(body?.unit ?? "").trim().slice(0, 20),
        name,
        note: String(body?.note ?? "").trim().slice(0, 500),
        status: "open",
        created_by: caller.id,
        created_by_name: member.full_name || member.email || "",
      };
      const { error } = await supabaseAdmin.from("material_orders").insert(row);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    // ── Status setzen (nur Owner/Admin/Projektleiter) ──
    if (action === "status") {
      if (!isManager) return Response.json({ error: "Keine Berechtigung." }, { status: 403 });
      const status = String(body?.status ?? "");
      if (!STATUSES.includes(status)) return Response.json({ error: "Ungültiger Status." }, { status: 400 });
      if (!body?.id) return Response.json({ error: "id fehlt." }, { status: 400 });
      const { error } = await supabaseAdmin
        .from("material_orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", body.id)
        .eq("company_id", member.company_id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    // ── Loeschen (nur Owner/Admin/Projektleiter) ──
    if (action === "delete") {
      if (!isManager) return Response.json({ error: "Keine Berechtigung." }, { status: 403 });
      if (!body?.id) return Response.json({ error: "id fehlt." }, { status: 400 });
      const { error } = await supabaseAdmin
        .from("material_orders")
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