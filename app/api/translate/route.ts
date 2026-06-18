import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { description, fromLanguage, toLanguage, hours } = await request.json();

    if (!description?.trim()) return Response.json({ translation: "" });

    const systemPrompt = `Du bist ein professioneller Übersetzer. Deine einzige Aufgabe ist es, Text zu übersetzen. 
Regeln:
- Gib IMMER NUR die Übersetzung zurück, niemals Erklärungen
- Übersetze auch einzelne Wörter, Namen und kurze Texte direkt
- Wenn ein Wort ein Eigenname ist (z.B. Personenname), behalte ihn unverändert
- Schreibe KEINE Kommentare, KEINE Erklärungen, KEINE Entschuldigungen
- Antworte immer nur mit dem übersetzten Text`;

    const userPrompt = hours
      ? `Übersetze von ${fromLanguage} nach ${toLanguage}:\n\n${description}`
      : `Übersetze von ${fromLanguage} nach ${toLanguage}: ${description}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const translation = completion.choices[0]?.message?.content?.trim() || "";
    return Response.json({ translation });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}