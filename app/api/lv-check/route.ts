import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

// /api/lv-check
// Zweiter KI-Prüfer (Autopilot Schritt 4): liest ein fertig bepreistes LV gegen.
// Body (POST, mit Bearer-Token): { positions: [{ id, oz, text, unit, qty, ep, minutes, mat_ek, quelle }] } (max. 30 je Aufruf)
// Antwort: { findings: [{ id, schwere: "hoch"|"mittel"|"info", problem }] } — NUR echte Auffälligkeiten,
// unauffällige Positionen tauchen nicht auf. Die Hinweise sind Anregungen, kein Urteil.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function getApiKey(): string | null {
  const names = ["OPENAI_API_KEY", "OPENAI_KEY", "OPENAI_SECRET_KEY", "OPENAI_APIKEY", "OPEN_AI_API_KEY"];
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    // Nur angemeldete Nutzer dürfen die (kostenpflichtige) KI aufrufen.
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return NextResponse.json({ error: "Anmeldung ungültig." }, { status: 401 });

    const body = await req.json();
    const positions: any[] = Array.isArray(body?.positions) ? body.positions.slice(0, 30) : [];
    if (!positions.length) return NextResponse.json({ findings: [] });

    const key = getApiKey();
    if (!key) return NextResponse.json({ error: "Kein OpenAI-API-Key gefunden." }, { status: 500 });

    const limited = await rateLimit(req, "translate"); // gleiche OpenAI-Schutzgrenze wie Übersetzungen
    if (limited) return limited;

    const list = positions.map((p) => ({
      id: String(p?.id ?? ""),
      oz: String(p?.oz ?? "").slice(0, 20),
      text: String(p?.text ?? "").slice(0, 300),
      unit: String(p?.unit ?? "St").slice(0, 10),
      qty: Number(p?.qty) || 0,
      ep: Number(p?.ep) || 0,
      minutes: Number(p?.minutes) || 0,
      mat_ek: Number(p?.mat_ek) || 0,
      quelle: String(p?.quelle ?? "").slice(0, 40),
    })).filter((p) => p.id && p.text.trim());

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `Du bist ein sehr erfahrener, kritischer Kalkulationsprüfer in einem deutschen ` +
              `Elektrotechnik-Handwerksbetrieb. Du bekommst ein fertig bepreistes Leistungsverzeichnis ` +
              `(JSON-Liste mit id, oz, text, unit, qty, ep (Netto-Einheitspreis EUR, Verkauf), ` +
              `minutes (Montageminuten je Einheit), mat_ek (Material-Einkauf EUR je Einheit), ` +
              `quelle (woher der Preis stammt)). Prüfe JEDE Position und melde NUR echte Auffälligkeiten: ` +
              `1) EP wirkt für die beschriebene Leistung deutlich zu hoch oder zu niedrig (Verkaufspreis-Niveau ` +
              `im deutschen Elektrohandwerk als Maßstab, Lohnverrechnungssatz ca. 55 EUR/h); ` +
              `2) Montageminuten unplausibel (viel zu kurz oder zu lang für die beschriebene Arbeit je Einheit); ` +
              `3) Einheit passt nicht zum Text (z. B. Kabel in "St" statt "m", Pauschale mit großer Menge); ` +
              `4) EP = 0 oder alles leer, obwohl der Text eine echte Leistung beschreibt; ` +
              `5) Text deutet auf Gerät/Bühne/Gerüst, aber Preis wirkt wie Kleinmaterial (oder umgekehrt); ` +
              `6) Menge wirkt offensichtlich falsch (z. B. 0 bei echter Leistung). ` +
              `Schweregrade: "hoch" = wahrscheinlich Fehler mit Geldwirkung, "mittel" = sollte man ansehen, ` +
              `"info" = Kleinigkeit. "problem" = 1 kurzer deutscher Satz mit konkretem Grund und ggf. Grössenordnung. ` +
              `Melde KEINE Position, die plausibel ist — lieber wenige gute Hinweise als viele belanglose. ` +
              `Antworte AUSSCHLIESSLICH als JSON-Objekt exakt in dieser Form: ` +
              `{"findings":[{"id":"...","schwere":"hoch","problem":"..."}]}`,
          },
          { role: "user", content: JSON.stringify(list) },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const status = res.status === 429 ? 429 : 500;
      return NextResponse.json({ error: data?.error?.message || "KI-Anfrage fehlgeschlagen." }, { status });
    }

    let findings: any[] = [];
    try {
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
      if (Array.isArray(parsed?.findings)) findings = parsed.findings;
    } catch { /* unten leeres Ergebnis */ }

    const ids = new Set(list.map((p) => p.id));
    const clean = findings
      .map((f: any) => ({
        id: String(f?.id ?? ""),
        schwere: ["hoch", "mittel", "info"].includes(String(f?.schwere)) ? String(f.schwere) : "info",
        problem: String(f?.problem ?? "").slice(0, 200),
      }))
      .filter((f: any) => f.id && ids.has(f.id) && f.problem.trim());

    return NextResponse.json({ findings: clean });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
