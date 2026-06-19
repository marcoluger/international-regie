import { NextResponse } from "next/server";

// /api/translate
// Übersetzt Text von fromLanguage nach toLanguage – in BEIDE Richtungen.
// Body (POST): { description, fromLanguage, toLanguage }  ->  { translation } | { error }
// GET: Selbsttest im Browser aufrufbar (zeigt, ob der API-Key gefunden wird und ob KR->DE klappt)

function getApiKey(): { key: string | null; foundName: string | null; checked: string[] } {
  const names = ["OPENAI_API_KEY", "OPENAI_KEY", "OPENAI_SECRET_KEY", "OPENAI_APIKEY", "OPEN_AI_API_KEY"];
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return { key: v, foundName: n, checked: names };
  }
  return { key: null, foundName: null, checked: names };
}

async function translate(description: string, fromLanguage: string, toLanguage: string) {
  if (!description || !description.trim()) return { translation: "" };
  if (!toLanguage || fromLanguage === toLanguage) return { translation: description };

  const { key } = getApiKey();
  if (!key) return { error: "Kein OpenAI-API-Key gefunden." };

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
            `Du bist ein professioneller Übersetzer für Bau- und Handwerks-Regieberichte. ` +
            `Übersetze den folgenden Text von ${fromLanguage} nach ${toLanguage}. ` +
            `Erkenne die Ausgangssprache notfalls selbst, falls sie abweicht. ` +
            `Gib ausschließlich die reine Übersetzung zurück – ohne Anführungszeichen, ohne Erklärungen, ohne Zusätze. ` +
            `Behalte Fachbegriffe, Mengen, Maße und Eigennamen sinngemäß bei.`,
        },
        { role: "user", content: description },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) return { error: data?.error?.message || "Übersetzung fehlgeschlagen.", status: res.status };
  const translation: string = data?.choices?.[0]?.message?.content?.trim() || description;
  return { translation };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const description: string = body?.description ?? "";
    const fromLanguage: string = body?.fromLanguage ?? "Deutsch";
    const toLanguage: string = body?.toLanguage ?? "Deutsch";
    const result = await translate(description, fromLanguage, toLanguage);
    if ((result as any).error) {
      return NextResponse.json({ error: (result as any).error }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// Im Browser aufrufbar: https://DEINE-DOMAIN/api/translate
export async function GET() {
  const { foundName, checked } = getApiKey();
  const testText = "Sve limenke su izbušene";
  const result = await translate(testText, "Kroatisch", "Deutsch");
  return NextResponse.json({
    apiKeyGefunden: Boolean(foundName),
    apiKeyName: foundName,
    gepruefteNamen: checked,
    test_eingabe_kroatisch: testText,
    test_ausgabe_deutsch: (result as any).translation ?? null,
    fehler: (result as any).error ?? null,
  });
}