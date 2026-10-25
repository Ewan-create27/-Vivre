import { dbQuery } from "@/lib/db";
import { badRequest, getSession, listWishesForOwner, serverError, unauthorized } from "@/lib/server";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await request.json() as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
    if (!ids.length || new Set(ids).size !== ids.length) return badRequest("L’ordre des objectifs est invalide.");
    const owned = await dbQuery<{ id: string }>("SELECT id FROM wishes WHERE owner_id = $1", [session.user.id]);
    const ownedIds = new Set(owned.rows.map((wish) => wish.id));
    if (ids.length !== ownedIds.size || ids.some((id) => !ownedIds.has(id))) {
      return badRequest("Tous les objectifs doivent être présents dans le nouvel ordre.");
    }
    const timestamp = new Date().toISOString();
    await Promise.all(ids.map((id, index) => dbQuery(
      "UPDATE wishes SET sort_order = $1, updated_at = $2 WHERE id = $3 AND owner_id = $4",
      [index, timestamp, id, session.user.id],
    )));
    return Response.json({ wishes: await listWishesForOwner(session.user.id) });
  } catch (error) {
    return serverError(error);
  }
}
