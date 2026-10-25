export async function sendResetCode(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("La récupération par e-mail doit être configurée avant d’être utilisée.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Ton code À vivre",
      html: `<p>Voici ton code de récupération :</p><p style="font-size:28px;font-weight:700;letter-spacing:7px">${code}</p><p>Il expire dans 15 minutes.</p>`,
    }),
  });
  if (!response.ok) throw new Error("L’e-mail de récupération n’a pas pu être envoyé.");
}
