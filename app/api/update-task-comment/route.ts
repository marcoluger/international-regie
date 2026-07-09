import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// /api/update-task-comment
// Speichert den Kommentar eines Arbeitsschritts (work_instruction_tasks.employee_comment).
// Body (POST): { taskId, comment, lang } -> { success } | { error }
// Nutzt den Service-Role-Key (umgeht RLS), prueft aber die Anmeldung.

export async function POST(request: Request) {
  try {
    // Rate-Limiting (greift nur, wenn Upstash konfiguriert ist)
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const { taskId, comment, lang } = await request.json();
    if (!taskId) {
      return Response.json({ error: "taskId fehlt." }, { status: 400 });
    }
    if (typeof comment !== "string") {
      return Response.json({ error: "Kommentar fehlt." }, { status: 400 });
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

    // 2) SPEICHERN – auf max. 1000 Zeichen begrenzen
    const cleanComment = comment.slice(0, 1000);
    const updatePayload: Record<string, any> = { employee_comment: cleanComment };
    if (typeof lang === "string" && lang.trim()) updatePayload.comment_lang = lang.trim();

    const { data, error } = await supabaseAdmin
      .from("work_instruction_tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .select("id");

    // Echten DB-Fehler zurueckgeben (nicht mehr still "200")
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    // Kein Treffer -> die taskId existiert nicht (sonst wuerde man einen Fehler nie sehen)
    if (!data || data.length === 0) {
      return Response.json({ error: "Arbeitsschritt nicht gefunden (taskId ohne Treffer)." }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}