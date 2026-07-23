import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// /api/equipment
// Fahrzeuge & Werkzeuge: auflisten, anlegen/aendern, loeschen, zuweisen/zurueckgeben, Verlauf.
// Body (POST): { action: "list" | "save" | "delete" | "assign" | "history", ... }

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
      .select("equipment_enabled")
      .eq("company_id", member.company_id)
      .maybeSingle();
    if (!feat?.equipment_enabled) {
      return Response.json({ error: "Das Modul Fahrzeuge & Werkzeuge ist nicht freigeschaltet." }, { status: 403 });
    }

    const body = await request.json();
    const action = body?.action || "list";
    const isManager = MANAGER_ROLES.includes(member.role);
    const byName = member.full_name || member.email || "";

    // ── Auflisten (alle duerfen sehen, wer welches Geraet hat) ──
    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("equipment")
        .select("id, type, name, identifier, note, assigned_to, assigned_to_name, assigned_at")
        .eq("company_id", member.company_id)
        .order("name", { ascending: true })
        .limit(1000);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ items: data || [] });
    }

    // ── Verlauf eines Geraets ──
    if (action === "history") {
      if (!body?.id) return Response.json({ error: "id fehlt." }, { status: 400 });
      const { data, error } = await supabaseAdmin
        .from("equipment_log")
        .select("id, action, user_name, by_name, at")
        .eq("company_id", member.company_id)
        .eq("equipment_id", body.id)
        .order("at", { ascending: false })
        .limit(200);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ history: data || [] });
    }

    // Ab hier: nur Owner/Admin/Projektleiter
    if (!isManager) {
      return Response.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    // ── Anlegen / Aendern ──
    if (action === "save") {
      const name = String(body?.name ?? "").trim().slice(0, 200);
      if (!name) return Response.json({ error: "Bezeichnung fehlt." }, { status: 400 });
      const row = {
        type: body?.type === "vehicle" ? "vehicle" : "tool",
        name,
        identifier: String(body?.identifier ?? "").trim().slice(0, 100),
        note: String(body?.note ?? "").trim().slice(0, 500),
      };
      if (body?.id) {
        const { error } = await supabaseAdmin
          .from("equipment")
          .update(row)
          .eq("id", body.id)
          .eq("company_id", member.company_id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true });
      }
      const { error } = await supabaseAdmin
        .from("equipment")
        .insert({ ...row, company_id: member.company_id });
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    // ── Loeschen ──
    if (action === "delete") {
      if (!body?.id) return Response.json({ error: "id fehlt." }, { status: 400 });
      await supabaseAdmin.from("equipment_log").delete().eq("equipment_id", body.id).eq("company_id", member.company_id);
      const { error } = await supabaseAdmin
        .from("equipment")
        .delete()
        .eq("id", body.id)
        .eq("company_id", member.company_id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    // ── Zuweisen / Zurueckgeben ──
    if (action === "assign") {
      if (!body?.id) return Response.json({ error: "id fehlt." }, { status: 400 });
      const targetId = body?.userId || null;

      // Geraet muss zur eigenen Firma gehoeren
      const { data: eq } = await supabaseAdmin
        .from("equipment")
        .select("id, company_id, assigned_to, assigned_to_name")
        .eq("id", body.id)
        .maybeSingle();
      if (!eq || eq.company_id !== member.company_id) {
        return Response.json({ error: "Gerät nicht gefunden." }, { status: 404 });
      }

      let targetName = "";
      if (targetId) {
        const { data: target } = await supabaseAdmin
          .from("company_users")
          .select("company_id, full_name, email")
          .eq("user_id", targetId)
          .maybeSingle();
        if (!target || target.company_id !== member.company_id) {
          return Response.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });
        }
        targetName = target.full_name || target.email || "";
      }

      const { error } = await supabaseAdmin
        .from("equipment")
        .update({
          assigned_to: targetId,
          assigned_to_name: targetId ? targetName : null,
          assigned_at: targetId ? new Date().toISOString() : null,
        })
        .eq("id", body.id)
        .eq("company_id", member.company_id);
      if (error) return Response.json({ error: error.message }, { status: 500 });

      // Verlauf schreiben
      await supabaseAdmin.from("equipment_log").insert({
        company_id: member.company_id,
        equipment_id: body.id,
        action: targetId ? "assigned" : "returned",
        user_id: targetId,
        user_name: targetId ? targetName : (eq.assigned_to_name || ""),
        by_name: byName,
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}