import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// /api/equipment
// Fahrzeuge & Werkzeuge: auflisten, anlegen/aendern, loeschen, zuweisen/zurueckgeben, Verlauf.
// Planung: geplante Zuordnungen (Geraet -> Mitarbeiter, von-bis), die am Starttag
// automatisch zur echten Zuweisung werden.
// Body (POST): { action: "list" | "save" | "delete" | "assign" | "history"
//                       | "plan_list" | "plan_save" | "plan_delete", ... }

const MANAGER_ROLES = ["owner", "admin", "project_manager"];

// Heutiges Datum als YYYY-MM-DD.
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Faellige Planungen automatisch anwenden (Uebernahme am Starttag, Rueckgabe nach Enddatum).
// Wird bei jedem "list" aufgerufen, damit die Realitaet ohne Hintergrundjob in Sync bleibt.
// Fehler hier duerfen das Auflisten NIE blockieren.
async function reconcilePlans(supabaseAdmin: any, companyId: string, byName: string): Promise<void> {
  const today = todayStr();
  try {
    // 1) Aktivieren: Plan laeuft heute, aber noch nicht uebernommen.
    const { data: due } = await supabaseAdmin
      .from("equipment_plan")
      .select("id, equipment_id, user_id, user_name")
      .eq("company_id", companyId)
      .eq("activated", false)
      .eq("closed", false)
      .lte("date_from", today)
      .gte("date_to", today)
      .limit(500);
    for (const p of due || []) {
      const { data: eq } = await supabaseAdmin
        .from("equipment")
        .select("id, assigned_to")
        .eq("id", p.equipment_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!eq) { await supabaseAdmin.from("equipment_plan").update({ closed: true }).eq("id", p.id); continue; }
      if (eq.assigned_to !== p.user_id) {
        await supabaseAdmin.from("equipment").update({
          assigned_to: p.user_id,
          assigned_to_name: p.user_name || null,
          assigned_at: new Date().toISOString(),
        }).eq("id", p.equipment_id).eq("company_id", companyId);
        await supabaseAdmin.from("equipment_log").insert({
          company_id: companyId,
          equipment_id: p.equipment_id,
          action: "assigned",
          user_id: p.user_id,
          user_name: p.user_name || "",
          by_name: byName ? `${byName} (Plan)` : "Plan",
        });
      }
      await supabaseAdmin.from("equipment_plan").update({ activated: true }).eq("id", p.id);
    }

    // 2) Abschliessen: Plan-Ende liegt in der Vergangenheit.
    const { data: expired } = await supabaseAdmin
      .from("equipment_plan")
      .select("id, equipment_id, user_id, user_name, activated")
      .eq("company_id", companyId)
      .eq("closed", false)
      .lt("date_to", today)
      .limit(500);
    for (const p of expired || []) {
      if (p.activated) {
        const { data: eq } = await supabaseAdmin
          .from("equipment")
          .select("id, assigned_to, assigned_to_name")
          .eq("id", p.equipment_id)
          .eq("company_id", companyId)
          .maybeSingle();
        if (eq && eq.assigned_to === p.user_id) {
          await supabaseAdmin.from("equipment").update({
            assigned_to: null, assigned_to_name: null, assigned_at: null,
          }).eq("id", p.equipment_id).eq("company_id", companyId);
          await supabaseAdmin.from("equipment_log").insert({
            company_id: companyId,
            equipment_id: p.equipment_id,
            action: "returned",
            user_id: null,
            user_name: p.user_name || eq.assigned_to_name || "",
            by_name: byName ? `${byName} (Plan)` : "Plan",
          });
        }
      }
      await supabaseAdmin.from("equipment_plan").update({ closed: true }).eq("id", p.id);
    }
  } catch {
    /* Reconcile ist best-effort – Fehler ignorieren, damit die Liste laedt. */
  }
}

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
      // Faellige Planungen zuerst anwenden, dann den aktuellen Stand ausliefern.
      await reconcilePlans(supabaseAdmin, member.company_id, byName);
      const { data, error } = await supabaseAdmin
        .from("equipment")
        .select("id, type, name, identifier, note, assigned_to, assigned_to_name, assigned_at")
        .eq("company_id", member.company_id)
        .order("name", { ascending: true })
        .limit(1000);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ items: data || [] });
    }

    // ── Planungen auflisten (alle duerfen sehen) ──
    if (action === "plan_list") {
      const { data, error } = await supabaseAdmin
        .from("equipment_plan")
        .select("id, equipment_id, user_id, user_name, date_from, date_to, note, activated, closed")
        .eq("company_id", member.company_id)
        .eq("closed", false)
        .order("date_from", { ascending: true })
        .limit(1000);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ plans: data || [] });
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

    // ── Planung anlegen / aendern (mit Konfliktpruefung) ──
    if (action === "plan_save") {
      const equipmentId = body?.equipmentId;
      const userId = body?.userId;
      const dateFrom = String(body?.dateFrom ?? "").slice(0, 10);
      const dateTo = String(body?.dateTo ?? "").slice(0, 10);
      const note = String(body?.note ?? "").trim().slice(0, 500);
      const force = body?.force === true;
      if (!equipmentId || !userId || !dateFrom || !dateTo) {
        return Response.json({ error: "Gerät, Mitarbeiter und Zeitraum sind nötig." }, { status: 400 });
      }
      if (dateTo < dateFrom) {
        return Response.json({ error: "Das Enddatum liegt vor dem Startdatum." }, { status: 400 });
      }
      // Geraet muss zur Firma gehoeren
      const { data: eq } = await supabaseAdmin
        .from("equipment")
        .select("id, company_id, name")
        .eq("id", equipmentId)
        .maybeSingle();
      if (!eq || eq.company_id !== member.company_id) {
        return Response.json({ error: "Gerät nicht gefunden." }, { status: 404 });
      }
      // Mitarbeiter muss zur Firma gehoeren
      const { data: target } = await supabaseAdmin
        .from("company_users")
        .select("company_id, full_name, email")
        .eq("user_id", userId)
        .maybeSingle();
      if (!target || target.company_id !== member.company_id) {
        return Response.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });
      }
      const targetName = target.full_name || target.email || "";

      // Konfliktpruefung: dasselbe Geraet im ueberlappenden Zeitraum schon verplant?
      const { data: overlaps } = await supabaseAdmin
        .from("equipment_plan")
        .select("id, user_name, date_from, date_to")
        .eq("company_id", member.company_id)
        .eq("equipment_id", equipmentId)
        .eq("closed", false)
        .lte("date_from", dateTo)
        .gte("date_to", dateFrom)
        .limit(50);
      const conflicts = (overlaps || []).filter((o: any) => o.id !== body?.id);
      if (conflicts.length > 0 && !force) {
        return Response.json({ conflict: true, conflicts });
      }

      const row = {
        company_id: member.company_id,
        equipment_id: equipmentId,
        user_id: userId,
        user_name: targetName,
        date_from: dateFrom,
        date_to: dateTo,
        note,
      };
      if (body?.id) {
        const { error } = await supabaseAdmin
          .from("equipment_plan")
          .update(row)
          .eq("id", body.id)
          .eq("company_id", member.company_id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true });
      }
      const { error } = await supabaseAdmin
        .from("equipment_plan")
        .insert({ ...row, activated: false, closed: false, created_by: byName });
      if (error) return Response.json({ error: error.message }, { status: 500 });
      // Faellig (Start = heute/vergangen)? Dann direkt anwenden.
      await reconcilePlans(supabaseAdmin, member.company_id, byName);
      return Response.json({ success: true });
    }

    // ── Planung loeschen ──
    if (action === "plan_delete") {
      if (!body?.id) return Response.json({ error: "id fehlt." }, { status: 400 });
      const { error } = await supabaseAdmin
        .from("equipment_plan")
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