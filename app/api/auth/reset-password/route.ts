import { dbQuery } from "@/lib/db";
import { createSession, findUserByEmail, hashPassword, hashResetCode, normalizeEmail, profileForOwner, serverError, sessionCookie } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const nextPassword = typeof body.nextPassword === "string" ? body.nextPassword : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) {
      return Response.json({ error: "Entre ton e-mail et le code reçu." }, { status: 400 });
    }
    if (nextPassword.length < 8 || nextPassword.length > 128) {
      return Response.json({ error: "Choisis un mot de passe de 8 caractères minimum." }, { status: 400 });
    }
    const user = await findUserByEmail(email);
    if (!user) return Response.json({ error: "Code invalide ou expiré." }, { status: 400 });
    const reset = await dbQuery<{ id: string }>(
      "SELECT id FROM password_resets WHERE user_id = $1 AND code_hash = $2 AND expires_at > $3 LIMIT 1",
      [user.id, hashResetCode(code), new Date().toISOString()],
    );
    if (!reset.rows[0]) return Response.json({ error: "Code invalide ou expiré." }, { status: 400 });
    await dbQuery("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", [await hashPassword(nextPassword), new Date().toISOString(), user.id]);
    await dbQuery("DELETE FROM password_resets WHERE user_id = $1", [user.id]);
    await dbQuery("DELETE FROM sessions WHERE user_id = $1", [user.id]);
    const session = await createSession(user.id);
    const updated = await findUserByEmail(email);
    return Response.json(
      { profile: profileForOwner(updated ?? user) },
      { headers: { "set-cookie": sessionCookie(session.token, session.expiresAt) } },
    );
  } catch (error) {
    return serverError(error);
  }
}
