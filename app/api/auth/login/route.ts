import { createSession, findUserByEmail, normalizeEmail, profileForOwner, serverError, sessionCookie, verifyPassword } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return Response.json({ error: "Renseigne ton e-mail et ton mot de passe." }, { status: 400 });
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return Response.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });
    }
    const session = await createSession(user.id);
    return Response.json({ profile: profileForOwner(user) }, { headers: { "set-cookie": sessionCookie(session.token, session.expiresAt) } });
  } catch (error) {
    return serverError(error);
  }
}
