import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

// /api/price-ai
// KI-Kalkulationsvorschlag für Angebotspositionen ohne Preis (Stufe 9c).
// Body (POST, mit Bearer-Token): { positions: [{ id, text, unit, qty }] }  (max. 30 je Aufruf)
// Antwort: { items: [{ id, mat_ek, minutes, note }] }  — Werte JE EINHEIT, netto.
// Die Schätzung ist bewusst nur ein VORSCHLAG (🤖-Kennzeichnung im Client, Nutzer prüft).

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
    if (!positions.length) return NextResponse.json({ items: [] });

    const key = getApiKey();
    if (!key) return NextResponse.json({ error: "Kein OpenAI-API-Key gefunden." }, { status: 500 });

    const limited = await rateLimit(req, "translate"); // gleiche OpenAI-Schutzgrenze wie Übersetzungen
    if (limited) return limited;

    const list = positions.map((p) => ({
      id: String(p?.id ?? ""),
      text: String(p?.text ?? "").slice(0, 500),
      unit: String(p?.unit ?? "St").slice(0, 10),
      qty: Number(p?.qty) || 1,
    })).filter((p) => p.id && p.text.trim());

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `Du bist erfahrener Kalkulator in einem deutschen Elektrotechnik-Handwerksbetrieb. ` +
              `Du bekommst Angebotspositionen (JSON-Liste mit id, text, unit, qty). ` +
              `Schätze für JEDE Position die Kalkulationswerte JE EINHEIT (unit), nicht für die Gesamtmenge: ` +
              `"mat_ek" = marktüblicher Netto-Material-Einkaufspreis im deutschen Elektrogroßhandel in EUR je Einheit ` +
              `(0 bei reinen Dienstleistungen wie Anmeldung, Dokumentation, Einweisung); ` +
              `"minutes" = realistische Montage-/Arbeitszeit in Minuten je Einheit inkl. üblicher Nebenarbeiten; ` +
              `"note" = sehr kurze Annahme (max. 10 Wörter, Deutsch). ` +
              `Bei Pauschalpositionen (psch/Psch) gilt: je 1 Pauschale. ` +
              `Antworte AUSSCHLIESSLICH als JSON-Objekt exakt in dieser Form: ` +
              `{"items":[{"id":"...","mat_ek":0.00,"minutes":0,"note":"..."}]}`,
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

    let items: any[] = [];
    try {
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
      if (Array.isArray(parsed?.items)) items = parsed.items;
    } catch { /* unten leeres Ergebnis */ }

    const clean = items
      .map((it: any) => ({
        id: String(it?.id ?? ""),
        mat_ek: Number.isFinite(Number(it?.mat_ek)) ? Math.max(0, Math.round(Number(it.mat_ek) * 100) / 100) : null,
        minutes: Number.isFinite(Number(it?.minutes)) ? Math.max(0, Math.round(Number(it.minutes) * 10) / 10) : null,
        note: String(it?.note ?? "").slice(0, 120),
      }))
      .filter((it: any) => it.id && (it.mat_ek !== null || it.minutes !== null));

    return NextResponse.json({ items: clean });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
