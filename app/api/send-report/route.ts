import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Rate-Limiting (strict – E-Mail-Versand; greift nur, wenn Upstash konfiguriert ist)
    const limited = await rateLimit(request, "strict");
    if (limited) return limited;

    const body = await request.json();

    const to = body.to;
    const subject = body.subject || "Regiebericht";
    const pdfBase64 = body.pdfBase64;
    const filename = body.filename || "regiebericht.pdf";

    if (!to || !pdfBase64) {
      return Response.json({ error: "Empfänger oder PDF fehlt." }, { status: 400 });
    }

    // Einfache Empfänger-Prüfung (eine oder mehrere E-Mail-Adressen)
    const recipients: string[] = Array.isArray(to) ? to : [to];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of recipients) {
      if (typeof r !== "string" || !emailRegex.test(r.trim())) {
        return Response.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
      }
    }

    // ── AUTHENTIFIZIERUNG: nur angemeldete Benutzer dürfen senden ──
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
    if (!token) {
      return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) {
      return Response.json({ error: "Ungültige oder abgelaufene Sitzung." }, { status: 401 });
    }
    // Muss zu einer Firma gehören (kein anonymer Versand)
    const { data: member } = await supabaseAdmin
      .from("company_users")
      .select("company_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!member) {
      return Response.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    // ── VERSAND über Resend ──
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return Response.json({ error: "E-Mail-Konfiguration fehlt (RESEND_API_KEY)." }, { status: 500 });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Regiebericht <onboarding@resend.dev>",
        to: recipients,
        subject,
        html: "<p>Anbei der Regiebericht als PDF.</p>",
        attachments: [
          {
            filename,
            content: pdfBase64,
          },
        ],
      }),
    });

    const data = await resendResponse.json();
    if (!resendResponse.ok) {
      return Response.json({ error: data?.message || "E-Mail-Versand fehlgeschlagen." }, { status: 500 });
    }

    return Response.json({ success: true, id: data?.id ?? null });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
