import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Rate-Limiting (greift nur, wenn Upstash konfiguriert ist)
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return Response.json({ error: "User ID und Passwort fehlen." }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // 1) Anmeldung pruefen: Bearer-Token aus dem Header lesen und Nutzer ermitteln.
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    // 2) Nutzer darf NUR das eigene Passwort aendern (verhindert Account-Uebernahme).
    if (authData.user.id !== userId) {
      return Response.json({ error: "Kein Zugriff." }, { status: 403 });
    }

    // 3) Mindest-Passwortlaenge serverseitig erzwingen (clientseitiger Check ist umgehbar).
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return Response.json({ error: "Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
