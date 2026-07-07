import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

const MANAGER_ROLES = ["owner", "admin", "project_manager"];

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getCaller(request: Request, supabaseAdmin: any) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Nicht angemeldet.", status: 401 };
  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  const caller = userData?.user;
  if (error || !caller) return { error: "Ungültige oder abgelaufene Sitzung.", status: 401 };
  const { data: member } = await supabaseAdmin
    .from("company_users")
    .select("company_id, role, full_name, email")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (!member) return { error: "Keine Berechtigung (kein Firmenkonto).", status: 403 };
  return { caller, member };
}

// Feedback abgeben
export async function POST(request: Request) {
  try {
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const supabaseAdmin = admin();
    if (!supabaseAdmin) return Response.json({ error: "Server-Konfiguration fehlt." }, { status: 500 });

    const c = await getCaller(request, supabaseAdmin);
    if ((c as any).error) return Response.json({ error: (c as any).error }, { status: (c as any).status });
    const { caller, member } = c as any;

    const body = await request.json();
    let answers = body?.answers;
    if (!Array.isArray(answers)) return Response.json({ error: "Ungültige Daten." }, { status: 400 });
    // auf max. 10 Eintraege und je 4000 Zeichen begrenzen
    answers = answers.slice(0, 10).map((a: any) => (typeof a === "string" ? a.slice(0, 4000) : ""));
    if (!answers.some((a: string) => a && a.trim())) {
      return Response.json({ error: "Bitte mindestens ein Feld ausfüllen." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("feedback").insert({
      company_id: member.company_id,
      user_id: caller.id,
      user_name: member.full_name || member.email || "?",
      role: member.role,
      answers,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

// Feedback-Uebersicht (nur Owner/Admin/PL der eigenen Firma)
export async function GET(request: Request) {
  try {
    const supabaseAdmin = admin();
    if (!supabaseAdmin) return Response.json({ error: "Server-Konfiguration fehlt." }, { status: 500 });

    const c = await getCaller(request, supabaseAdmin);
    if ((c as any).error) return Response.json({ error: (c as any).error }, { status: (c as any).status });
    const { member } = c as any;

    if (!MANAGER_ROLES.includes(member.role)) {
      return Response.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .select("id, user_name, role, answers, created_at")
      .eq("company_id", member.company_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ feedback: data || [] });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}