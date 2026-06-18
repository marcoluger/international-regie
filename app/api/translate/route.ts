import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { description, fromLanguage, toLanguage, hours } = await request.json();

    if (!description?.trim()) return Response.json({ translation: "" });

    const prompt = hours
      ? `Du bist ein professioneller Übersetzer für Bauberichte. Übersetze den folgenden Arbeitsbericht von ${fromLanguage} nach ${toLanguage}. Gib NUR die Übersetzung zurück, ohne Erklärungen.\n\nText:\n${description}`
      : `Übersetze den folgenden Text exakt von ${fromLanguage} nach ${toLanguage}. Gib NUR die direkte Übersetzung zurück, keine Erklärungen. Auch einzelne Wörter müssen übersetzt werden.\n\nText: ${description}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    });

    const translation = completion.choices[0]?.message?.content?.trim() || "";
    return Response.json({ translation });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}