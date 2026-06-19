import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// /api/update-task-comment
// Speichert einen Mitarbeiter-Kommentar serverseitig mit dem Service-Role-Key.
// Dadurch wird RLS umgangen -> funktioniert für JEDEN angemeldeten Benutzer.
// Body: { taskId, comment, lang }  ->  { ok: true } | { error }

function getServiceKey(): string | null {
  const names = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "SERVICE_ROLE_KEY",
  ];
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

    // 1) Kommentar speichern (mit Ursprungssprache, falls Spalte vorhanden)
    const payload: Record<string, any> = { employee_comment: comment ?? "" };
    if (lang) payload.comment_lang = lang;

    let { error } = await supabaseAdmin.from("work_instruction_tasks").update(payload).eq("id", taskId);

    // 2) Falls die Spalte comment_lang fehlt -> ohne sie speichern
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