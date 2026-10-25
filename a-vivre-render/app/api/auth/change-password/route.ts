import { createSession, getSession, hashPassword, serverError, sessionCookie, unauthorized, verifyPassword } from "@/lib/server";
import { dbQuery } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await request.json() as Record<string, unknown>;
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const nextPassword = typeof body.nextPassword === "string" ? body.nextPassword : "";
    if (nextPassword.length < 8 || nextPassword.length > 128) return Response.json({ error: "Choisis un mot de passe de 8 caractères minimum." }, { status: 400 });
    const user = await dbQuery<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [session.user.id]);
    if (!user.rows[0] || !(await verifyPassword(currentPassword, user.rows[0].password_hash))) {
      return Response.json({ error: "Le mot de passe actuel est incorrect." }, { status: 401 });
    }
    await dbQuery("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", [await hashPassword(nextPassword), new Date().toISOString(), session.user.id]);
    await dbQuery("DELETE FROM sessions WHERE user_id = $1", [session.user.id]);
    const nextSession = await createSession(session.user.id);
    return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookie(nextSession.token, nextSession.expiresAt) } });
  } catch (error) {
    return serverError(error);
  }
}
