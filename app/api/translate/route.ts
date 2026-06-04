import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { hours, description, fromLanguage, toLanguage } = data;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: `
Übersetze die folgende Arbeitsbeschreibung für einen Regiebericht.

Regeln:
- Übersetze nur die Arbeitsbeschreibung
- Zahlen und Stunden nicht verändern
- Fachbegriffe aus Elektroinstallation korrekt übersetzen
- Kurz und professionell schreiben

Von: ${fromLanguage}
Nach: ${toLanguage}

Stunden:
${hours}

Arbeitsbeschreibung:
${description}
`,
    });

    return Response.json({
      translation: response.output_text,
    });
  } catch (error) {
    return Response.json(
      {
        error: String(error),
      },
      { status: 500 }
    );
  }
}