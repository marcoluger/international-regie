import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// /api/update-task-comment
// Speichert einen Mitarbeiter-Kommentar serverseitig mit dem Service-Role-Key.
// ABGESICHERT: prüft die Anmeldung und die Berechtigung des Aufrufers.
// Body: { taskId, comment, lang }  + Header: Authorization: Bearer <access_token>
//   -> { ok: true } | { error }

function getServiceKey(): string | null {
  const names = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE", "SERVICE_ROLE_KEY"];
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { taskId, comment, lang } = await req.json();
    if (!taskId) {
      return NextResponse.json({ error: "taskId fehlt" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = getServiceKey();
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Server-Konfiguration fehlt (URL oder Service-Role-Key)." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) AUTHENTIFIZIERUNG: gültige Benutzer-Sitzung verlangen
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) {
      return NextResponse.json({ error: "Ungültige oder abgelaufene Sitzung." }, { status: 401 });
    }

    // 2) Aufgabe + zugehörige Arbeitsanweisung laden
    const { data: task, error: taskErr } = await supabaseAdmin
      .from("work_instruction_tasks")
      .select("id, work_instruction_id")
      .eq("id", taskId)
      .single();
    if (taskErr || !task) {
      return NextResponse.json({ error: "Aufgabe nicht gefunden." }, { status: 404 });
    }
    const { data: instruction, error: instErr } = await supabaseAdmin
      .from("work_instructions")
      .select("company_id, assigned_user_ids")
      .eq("id", task.work_instruction_id)
      .single();
    if (instErr || !instruction) {
      return NextResponse.json({ error: "Arbeitsanweisung nicht gefunden." }, { status: 404 });
    }
    const companyId = instruction.company_id;
    const assigned: string[] = instruction.assigned_user_ids || [];

    // 3) AUTORISIERUNG: Benutzer muss zur selben Firma gehören und entweder
    //    privilegiert (owner/admin/project_manager) oder dem Auftrag zugewiesen sein.
    const { data: member } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member || member.company_id !== companyId) {
      return NextResponse.json({ error: "Keine Berechtigung (andere oder keine Firma)." }, { status: 403 });
    }
    const privileged = ["owner", "admin", "project_manager"].includes(member.role);
    const isAssigned = assigned.includes(user.id);
    if (!privileged && !isAssigned) {
      return NextResponse.json({ error: "Keine Berechtigung für diese Aufgabe." }, { status: 403 });
    }

    // 4) Speichern (mit Ursprungssprache, falls Spalte vorhanden)
    const payload: Record<string, any> = { employee_comment: comment ?? "" };
    if (lang) payload.comment_lang = lang;

    let { error } = await supabaseAdmin.from("work_instruction_tasks").update(payload).eq("id", taskId);
    if (error && /comment_lang/i.test(error.message)) {
      ({ error } = await supabaseAdmin
        .from("work_instruction_tasks")
        .update({ employee_comment: comment ?? "" })
        .eq("id", taskId));
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}