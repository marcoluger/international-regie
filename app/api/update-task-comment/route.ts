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

    // 2) Name des Absenders serverseitig ermitteln (nicht vom Client uebernehmen)
    const { data: member } = await supabaseAdmin
      .from("company_users")
      .select("full_name, email")
      .eq("user_id", caller.id)
      .maybeSingle();
    const authorName = member?.full_name || member?.email || "";

    // 3a) Ist das Chat-Modul fuer die Firma des Aufrufers freigeschaltet?
    const { data: callerMember } = await supabaseAdmin
      .from("company_users")
      .select("company_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    let chatMode = false;
    if (callerMember?.company_id) {
      const { data: feat } = await supabaseAdmin
        .from("company_features")
        .select("comments_enabled")
        .eq("company_id", callerMember.company_id)
        .maybeSingle();
      chatMode = !!feat?.comments_enabled;
    }

    // 3b) Bestehende Kommentarliste des Arbeitsschritts laden
    const { data: row, error: readErr } = await supabaseAdmin
      .from("work_instruction_tasks")
      .select("id, comments, employee_comment, comment_by, comment_lang")
      .eq("id", taskId)
      .maybeSingle();
    if (readErr) {
      return Response.json({ error: readErr.message }, { status: 500 });
    }
    if (!row) {
      return Response.json({ error: "Arbeitsschritt nicht gefunden (taskId ohne Treffer)." }, { status: 404 });
    }

    let list: any[] = Array.isArray(row.comments) ? row.comments : [];
    // Altdaten (einzelner Kommentar) einmalig in die Liste uebernehmen
    if (list.length === 0 && (row.employee_comment || "").trim()) {
      list = [{ user_id: null, name: row.comment_by || "", text: row.employee_comment, lang: row.comment_lang || "" }];
    }

    const cleanComment = comment.slice(0, 1000);
    const isMine = (c: any) =>
      (c?.user_id && c.user_id === caller.id) ||
      (!c?.user_id && c?.name && authorName && c.name === authorName);

    if (chatMode) {
      // CHAT: neuen Beitrag ANHAENGEN, nichts ueberschreiben.
      if (!cleanComment.trim()) {
        return Response.json({ error: "Kommentar ist leer." }, { status: 400 });
      }
      list.push({
        id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        user_id: caller.id,
        name: authorName,
        text: cleanComment,
        lang: typeof lang === "string" && lang.trim() ? lang.trim() : null,
        at: new Date().toISOString(),
      });
      if (list.length > 200) list = list.slice(list.length - 200);
    } else {
      // PRIVAT (Modul aus): jeder hat GENAU EINEN eigenen Kommentar; fremde bleiben unberuehrt.
      list = list.filter((c: any) => !isMine(c));
      if (cleanComment.trim()) {
        list.push({
          id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
          user_id: caller.id,
          name: authorName,
          text: cleanComment,
          lang: typeof lang === "string" && lang.trim() ? lang.trim() : null,
          at: new Date().toISOString(),
        });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("work_instruction_tasks")
      .update({ comments: list })
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