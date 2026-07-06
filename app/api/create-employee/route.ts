import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

// Welche Rolle darf welche Rollen anlegen?
// Owner -> admin, project_manager, employee
// Admin -> project_manager, employee
// Projektleiter -> employee
// Mitarbeiter -> niemand
const ALLOWED_TO_CREATE: Record<string, string[]> = {
  owner: ["admin", "project_manager", "employee"],
  admin: ["project_manager", "employee"],
  project_manager: ["employee"],
};

export async function POST(request: Request) {
  try {
    // Rate-Limiting (greift nur, wenn Upstash konfiguriert ist)
    const limited = await rateLimit(request, "standard");
    if (limited) return limited;

    const { username, password, fullName, role, companyId, companySlug, mustChangePassword, preferredLanguage, nationality, phone } = await request.json();

    if (!username || !password || !companyId) {
      return Response.json({ error: "Pflichtfelder fehlen." }, { status: 400 });
    }

    // Mindest-Passwortlaenge serverseitig erzwingen (clientseitiger Check ist umgehbar).
    if (typeof password !== "string" || password.length < 8) {
      return Response.json({ error: "Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
    }

    // Nationalitaet + Telefon sind Pflicht.
    const nat = typeof nationality === "string" ? nationality.trim() : "";
    const tel = typeof phone === "string" ? phone.trim() : "";
    if (!nat || !tel) {
      return Response.json({ error: "Nationalität und Telefonnummer sind Pflicht." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !serviceKey) {
      return Response.json({ error: "Server-Konfiguration fehlt." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) AUTHENTIFIZIERUNG: gültige Sitzung verlangen
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return Response.json({ error: "Ungültige oder abgelaufene Sitzung." }, { status: 401 });
    }

    // 2) AUTORISIERUNG: Rolle + Firma des Aufrufers laden
    const { data: callerMember } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerMember) {
      return Response.json({ error: "Keine Berechtigung (kein Firmenkonto)." }, { status: 403 });
    }
    // Nur die EIGENE Firma
    if (callerMember.company_id !== companyId) {
      return Response.json({ error: "Keine Berechtigung für diese Firma." }, { status: 403 });
    }

    // Welche Rolle soll angelegt werden? (Standard: employee)
    const targetRole = role || "employee";
    const allowedRoles = ALLOWED_TO_CREATE[callerMember.role] || [];
    if (!allowedRoles.includes(targetRole)) {
      return Response.json(
        { error: "Keine Berechtigung, diese Rolle anzulegen." },
        { status: 403 }
      );
    }

    // Sprache (optional): nur uebernehmen, wenn ein nicht-leerer String kommt.
    const prefLang =
      typeof preferredLanguage === "string" && preferredLanguage.trim()
        ? preferredLanguage.trim()
        : null;

    // Ab hier: Aufrufer ist berechtigt -> wie gehabt anlegen
    const slug = companySlug || companyId.slice(0, 8);
    const cleanUsername = username.toLowerCase().replace(/\s+/g, ".");
    const email = `${slug}.${cleanUsername}@regie-internal.app`;

    // Prüfen ob Auth-User bereits existiert
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    let userId: string;

    if (existingUser) {
      // Auth-User existiert bereits – Passwort updaten und wiederverwenden
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
      userId = existingUser.id;
      // Alten company_users Eintrag löschen falls vorhanden
      await supabaseAdmin.from("company_users").delete().eq("user_id", existingUser.id);
    } else {
      // Neuen Auth-User anlegen
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) return Response.json({ error: authError.message }, { status: 500 });
      userId = authUser.user.id;
    }

    // company_users Eintrag anlegen
    const { error: dbError } = await supabaseAdmin.from("company_users").insert({
      company_id: companyId,
      user_id: userId,
      email,
      full_name: fullName || username,
      role: targetRole,
      must_change_password: mustChangePassword ?? true,
      preferred_language: prefLang,
      nationality: nat,
      phone: tel,
    });

    if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

    return Response.json({ success: true, email, userId });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}