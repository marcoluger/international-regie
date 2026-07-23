import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// /api/update-material
// Speichert das verbrauchte Material einer Arbeitsanweisung
// (work_instructions.used_material als Liste: { qty, unit, name, by, at }).
// Body (POST): { instructionId, material: [] } -> { success } | { error }

export async function POST(request: Request) {
  try {
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const { instructionId, material } = await request.json();
    if (!instructionId) {
      return Response.json({ error: "instructionId fehlt." }, { status: 400 });
    }
    if (!Array.isArray(material)) {
      return Response.json({ error: "Ungültige Daten." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !serviceKey) {
      return Response.json({ error: "Server-Konfiguration fehlt." }, { status: 500 });
    }
    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Anmeldung pruefen
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return Response.json({ error: "Ungültige oder abgelaufene Sitzung." }, { status: 401 });
    }

    // 2) Firma + Rechte des Aufrufers
    const { data: member } = await supabaseAdmin
      .from("company_users")
      .select("company_id, read_only")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!member) {
      return Response.json({ error: "Keine Berechtigung (kein Firmenkonto)." }, { status: 403 });
    }
    if (member.read_only) {
      return Response.json({ error: "Dieses Konto darf nur lesen." }, { status: 403 });
    }

    // 3) Modul muss freigeschaltet sein
    const { data: feat } = await supabaseAdmin
      .from("company_features")
      .select("material_enabled")
      .eq("company_id", member.company_id)
      .maybeSingle();
    if (!feat?.material_enabled) {
      return Response.json({ error: "Das Modul Materialerfassung ist nicht freigeschaltet." }, { status: 403 });
    }

    // 4) Arbeitsanweisung muss zur eigenen Firma gehoeren
    const { data: inst } = await supabaseAdmin
      .from("work_instructions")
      .select("id, company_id")
      .eq("id", instructionId)
      .maybeSingle();
    if (!inst) {
      return Response.json({ error: "Arbeitsanweisung nicht gefunden." }, { status: 404 });
    }
    if (inst.company_id !== member.company_id) {
      return Response.json({ error: "Keine Berechtigung (andere Firma)." }, { status: 403 });
    }

    // 5) Bereinigen und speichern (max. 200 Positionen)
    const clean = material.slice(0, 200).map((m: any) => ({
      qty: String(m?.qty ?? "").slice(0, 20),
      unit: String(m?.unit ?? "").slice(0, 20),
      name: String(m?.name ?? "").slice(0, 200),
      by: String(m?.by ?? "").slice(0, 100),
      at: m?.at || new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from("work_instructions")
      .update({ used_material: clean })
      .eq("id", instructionId);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 6) Materialstamm mitlernen: neue Bezeichnungen automatisch aufnehmen.
    try {
      const seen = new Set<string>();
      for (const m of clean) {
        const name = (m.name || "").trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        const { data: exists } = await supabaseAdmin
          .from("material_catalog")
          .select("id")
          .eq("company_id", member.company_id)
          .ilike("name", name)
          .maybeSingle();
        if (!exists) {
          await supabaseAdmin
            .from("material_catalog")
            .insert({ company_id: member.company_id, name, unit: m.unit || "" });
        }
      }
    } catch {
      /* Der Materialstamm ist nur eine Hilfe - Fehler hier duerfen das Speichern nicht stoppen. */
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}