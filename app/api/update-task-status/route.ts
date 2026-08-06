import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// /api/update-task-status
// Setzt den Status eines Arbeitsschritts (work_instruction_tasks.status).
// Body (POST): { taskId, status } -> { success, propagated } | { error }
//
// Besonderheit: Beim Uebernehmen offener Schritte in eine neue Arbeitsanweisung
// entstehen unverknuepfte Kopien desselben Schritts (gleicher Text) an frueheren
// Tagen. Wird ein Schritt auf "Erledigt" gesetzt, werden deshalb im selben Projekt
// alle aelteren, noch nicht erledigten Kopien (gleicher Text, work_date <= Datum
// der aktuellen Anweisung) mit auf "Erledigt" gesetzt - sonst bleiben sie im
// Dashboard ewig als "ueberfaellig offen" stehen.
//
// Rechte: Owner/Admin/Projektleiter der Firma oder als Bauleiter (foreman_user_ids)
// eingetragene Mitarbeiter. Konten mit "Nur lesen" sind gesperrt.

const ALLOWED_STATUS = ["open", "in_progress", "completed", "stopped"];

// Gleiche Schritttexte tolerant vergleichen (Gross-/Kleinschreibung, Mehrfach-Leerzeichen).
function normText(s: unknown): string {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  try {
    // Rate-Limiting (greift nur, wenn Upstash konfiguriert ist)
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const { taskId, status } = await request.json();
    if (!taskId) {
      return Response.json({ error: "taskId fehlt." }, { status: 400 });
    }
    if (!ALLOWED_STATUS.includes(status)) {
      return Response.json({ error: "Ungueltiger Status." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !serviceKey) {
      return Response.json({ error: "Server-Konfiguration fehlt." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) AUTHENTIFIZIERUNG: gueltige Sitzung verlangen
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return Response.json({ error: "Ungueltige oder abgelaufene Sitzung." }, { status: 401 });
    }

    // 2) Arbeitsschritt + zugehoerige Anweisung laden
    const { data: task, error: taskErr } = await supabaseAdmin
      .from("work_instruction_tasks")
      .select("id, task_text, status, work_instruction_id")
      .eq("id", taskId)
      .maybeSingle();
    if (taskErr) {
      return Response.json({ error: taskErr.message }, { status: 500 });
    }
    if (!task) {
      return Response.json({ error: "Arbeitsschritt nicht gefunden (taskId ohne Treffer)." }, { status: 404 });
    }

    const { data: instruction, error: instErr } = await supabaseAdmin
      .from("work_instructions")
      .select("id, company_id, project_id, project, work_date, foreman_user_ids")
      .eq("id", task.work_instruction_id)
      .maybeSingle();
    if (instErr) {
      return Response.json({ error: instErr.message }, { status: 500 });
    }
    if (!instruction) {
      return Response.json({ error: "Arbeitsanweisung nicht gefunden." }, { status: 404 });
    }

    // 3) BERECHTIGUNG: Firmenzugehoerigkeit, kein "Nur lesen", Manager oder Bauleiter
    const { data: member } = await supabaseAdmin
      .from("company_users")
      .select("role, read_only")
      .eq("user_id", caller.id)
      .eq("company_id", instruction.company_id)
      .maybeSingle();
    if (!member) {
      return Response.json({ error: "Kein Zugriff auf diese Firma." }, { status: 403 });
    }
    if (member.read_only) {
      return Response.json({ error: "Dieses Konto darf nur lesen." }, { status: 403 });
    }
    const isManager = member.role === "owner" || member.role === "admin" || member.role === "project_manager";
    const isForeman = Array.isArray(instruction.foreman_user_ids) && instruction.foreman_user_ids.includes(caller.id);
    if (!isManager && !isForeman) {
      return Response.json({ error: "Keine Berechtigung, den Status zu aendern." }, { status: 403 });
    }

    // 4) Status setzen
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("work_instruction_tasks")
      .update({ status })
      .eq("id", taskId)
      .select("id");
    if (updErr) {
      return Response.json({ error: updErr.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return Response.json({ error: "Arbeitsschritt nicht gefunden (taskId ohne Treffer)." }, { status: 404 });
    }

    // 5) Bei "Erledigt": aeltere Kopien desselben Schritts im selben Projekt mitziehen.
    let propagated = 0;
    const textNorm = normText(task.task_text);
    const hasProject = !!instruction.project_id || !!(instruction.project || "").trim();
    if (status === "completed" && textNorm && hasProject) {
      // Stichtag: Datum der aktuellen Anweisung; ohne Datum gilt "heute".
      const refDate = instruction.work_date || new Date().toISOString().split("T")[0];
      let query = supabaseAdmin
        .from("work_instructions")
        .select("id")
        .eq("company_id", instruction.company_id)
        .neq("id", instruction.id)
        .lte("work_date", refDate);
      if (instruction.project_id) query = query.eq("project_id", instruction.project_id);
      else query = query.eq("project", instruction.project);
      const { data: siblings, error: sibErr } = await query;
      if (!sibErr && siblings && siblings.length > 0) {
        const instIds = siblings.map((s: any) => s.id);
        const { data: candidates } = await supabaseAdmin
          .from("work_instruction_tasks")
          .select("id, task_text, status")
          .in("work_instruction_id", instIds)
          .or("status.is.null,status.neq.completed");
        const matchIds = (candidates || [])
          .filter((c: any) => normText(c.task_text) === textNorm)
          .map((c: any) => c.id);
        if (matchIds.length > 0) {
          const { data: propRows, error: propErr } = await supabaseAdmin
            .from("work_instruction_tasks")
            .update({ status: "completed" })
            .in("id", matchIds)
            .select("id");
          // Propagation ist "best effort": ein Fehler hier macht das eigentliche
          // Statusupdate nicht kaputt, wird aber zurueckgemeldet.
          if (!propErr) propagated = (propRows || []).length;
        }
      }
    }

    return Response.json({ success: true, propagated });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
