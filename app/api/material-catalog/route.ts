import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// /api/material-catalog
// Materialstamm einer Firma: auflisten, speichern, loeschen.
// Body (POST): { action: "list" | "save" | "delete", ... }

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
      .select("company_id, role, read_only")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!member) {
      return Response.json({ error: "Keine Berechtigung (kein Firmenkonto)." }, { status: 403 });
    }

    const body = await request.json();
    const action = body?.action || "list";

    // ── Auflisten (alle Rollen duerfen lesen) ──
    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("material_catalog")
        .select("id, name, unit")
        .eq("company_id", member.company_id)
        .order("name", { ascending: true })
        .limit(2000);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ items: data || [] });
    }

    // Ab hier: Aendern – nicht fuer Nur-lesen-Konten
    if (member.read_only) {
      return Response.json({ error: "Dieses Konto darf nur lesen." }, { status: 403 });
    }

    // ── Speichern (neu oder aendern) ──
    if (action === "save") {
      const name = String(body?.name ?? "").trim().slice(0, 200);
      const unit = String(body?.unit ?? "").trim().slice(0, 20);
      if (!name) return Response.json({ error: "Bezeichnung fehlt." }, { status: 400 });

      if (body?.id) {
        const { error } = await supabaseAdmin
          .from("material_catalog")
          .update({ name, unit })
          .eq("id", body.id)
          .eq("company_id", member.company_id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true });
      }

      // Neu: doppelte Bezeichnung still ignorieren
      const { data: exists } = await supabaseAdmin
        .from("material_catalog")
        .select("id")
        .eq("company_id", member.company_id)
        .ilike("name", name)
        .maybeSingle();
      if (exists) {
        await supabaseAdmin.from("material_catalog").update({ unit }).eq("id", exists.id);
        return Response.json({ success: true, id: exists.id });
      }
      const { data, error } = await supabaseAdmin
        .from("material_catalog")
        .insert({ company_id: member.company_id, name, unit })
        .select("id")
        .single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true, id: data?.id });
    }

    // ── Loeschen (nur Owner/Admin/Projektleiter) ──
    if (action === "delete") {
      if (!MANAGER_ROLES.includes(member.role)) {
        return Response.json({ error: "Keine Berechtigung zum Löschen." }, { status: 403 });
      }
      if (!body?.id) return Response.json({ error: "id fehlt." }, { status: 400 });
      const { error } = await supabaseAdmin
        .from("material_catalog")
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