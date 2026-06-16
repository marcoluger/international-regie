export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const to = body.to;
    const subject = body.subject || "Regiebericht";
    const pdfBase64 = body.pdfBase64;
    const filename = body.filename || "regiebericht.pdf";

    if (!to || !pdfBase64) {
      return Response.json(
        { error: "Empfänger oder PDF fehlt." },
        { status: 400 }
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Regiebericht <onboarding@resend.dev>",
        to: [to],
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
      return Response.json(
        { error: data.message || "E-Mail konnte nicht gesendet werden." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}