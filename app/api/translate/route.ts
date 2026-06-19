import { NextResponse } from "next/server";

// /api/translate
// Übersetzt einen Text von fromLanguage nach toLanguage – in BEIDE Richtungen.
// Erwartet im Body: { description, fromLanguage, toLanguage }  (hours wird ignoriert)
// Gibt zurück: { translation }  oder  { error }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const description: string = body?.description ?? "";
    const fromLanguage: string = body?.fromLanguage ?? "Deutsch";
    const toLanguage: string = body?.toLanguage ?? "Deutsch";

    // Nichts zu übersetzen
    if (!description || !description.trim()) {
      return NextResponse.json({ translation: "" });
    }
    // Gleiche Sprache -> Originaltext zurückgeben
    if (!toLanguage || fromLanguage === toLanguage) {
      return NextResponse.json({ translation: description });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY ist nicht gesetzt." }, { status: 500 });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Übersetzung fehlgeschlagen." },
        { status: 500 }
      );
    }

    const translation: string = data?.choices?.[0]?.message?.content?.trim() || description;
    return NextResponse.json({ translation });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}