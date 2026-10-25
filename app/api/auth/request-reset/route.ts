import { dbQuery } from "@/lib/db";
import { sendResetCode } from "@/lib/email";
import { createResetCode, findUserByEmail, hashResetCode, newId, normalizeEmail, now, serverError } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Entre une adresse e-mail valide." }, { status: 400 });
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      return Response.json({ error: "La récupération par e-mail doit d’abord être configurée." }, { status: 503 });
    }
    const user = await findUserByEmail(email);
    if (user) {
      const code = createResetCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await dbQuery("DELETE FROM password_resets WHERE user_id = $1", [user.id]);
      await dbQuery(
        "INSERT INTO password_resets (id, user_id, code_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)",
        [newId(), user.id, hashResetCode(code), expiresAt, now()],
      );
      await sendResetCode(user.email, code);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
