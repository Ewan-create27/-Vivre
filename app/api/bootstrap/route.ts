import { getSession, listWishesForOwner, serverError, unauthorized } from "@/lib/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    return Response.json({ profile: session.user, wishes: await listWishesForOwner(session.user.id) });
  } catch (error) {
    return serverError(error);
  }
}
