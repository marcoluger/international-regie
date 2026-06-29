import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "../../../lib/rateLimit";

// /api/translate
// Uebersetzt Text von fromLanguage nach toLanguage – in BEIDE Richtungen.
// Mit Datenbank-Cache: jeder Text wird pro Zielsprache nur EINMAL an OpenAI geschickt,
// danach kommt das Ergebnis aus der Tabelle translation_cache (spart OpenAI-Anfragen).
// Body (POST): { description, fromLanguage, toLanguage }  ->  { translation } | { error }

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

// Stabiler Schluessel pro (Quelle|Ziel|Text)
async function hashKey(s: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return "fb_" + (h >>> 0).toString(16) + "_" + s.length;
  }
}

async function cacheGet(key: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("translation_cache")
      .select("translation")
      .eq("cache_key", key)
      .maybeSingle();
    return data?.translation ?? null;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, translation: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("translation_cache")
      .upsert({ cache_key: key, translation }, { onConflict: "cache_key" });
  } catch {
    /* Cache ist optional – Fehler hier ignorieren */
  }
}

export async function POST(req: Request) {
  try {
    // Rate-Limiting (translate – grosszuegig; greift nur, wenn Upstash konfiguriert ist)
    const limited = await rateLimit(req, "translate");
    if (limited) return limited;

    const body = await req.json();
    const description: string = body?.description ?? "";
    const fromLanguage: string = body?.fromLanguage ?? "Deutsch";
    const toLanguage: string = body?.toLanguage ?? "Deutsch";

    // Nichts zu uebersetzen
    if (!description || !description.trim()) {
      return NextResponse.json({ translation: "" });
    }
    // Gleiche Sprache -> Originaltext zurueckgeben
    if (!toLanguage || fromLanguage === toLanguage) {
      return NextResponse.json({ translation: description });
    }

    // Schritt 1: Cache pruefen – kein OpenAI-Aufruf, wenn schon vorhanden
    const cacheKey = await hashKey(`${fromLanguage}|||${toLanguage}|||${description}`);
    const cached = await cacheGet(cacheKey);
    if (cached != null) {
      return NextResponse.json({ translation: cached, cached: true });
    }

    const key = getApiKey();
    if (!key) {
      return NextResponse.json({ error: "Kein OpenAI-API-Key gefunden." }, { status: 500 });
    }

    // Schritt 2: OpenAI aufrufen
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              `Du bist ein professioneller Uebersetzer fuer Bau- und Handwerks-Regieberichte. ` +
              `Uebersetze den folgenden Text von ${fromLanguage} nach ${toLanguage}. ` +
              `Erkenne die Ausgangssprache notfalls selbst, falls sie abweicht. ` +
              `Gib ausschliesslich die reine Uebersetzung zurueck – ohne Anfuehrungszeichen, ohne Erklaerungen, ohne Zusaetze. ` +
              `Behalte Fachbegriffe, Mengen, Masse und Eigennamen sinngemaess bei.`,
          },
          { role: "user", content: description },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const status = res.status === 429 ? 429 : 500;
      return NextResponse.json({ error: data?.error?.message || "Uebersetzung fehlgeschlagen." }, { status });
    }
    const translation: string = data?.choices?.[0]?.message?.content?.trim() || description;

    // Schritt 3: Nur echte Uebersetzungen cachen
    if (translation && translation !== description) {
      await cacheSet(cacheKey, translation);
    }

    return NextResponse.json({ translation });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
