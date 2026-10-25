import { clearSessionCookie, destroyCurrentSession, serverError } from "@/lib/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroyCurrentSession();
    return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
  } catch (error) {
    return serverError(error);
  }
}
