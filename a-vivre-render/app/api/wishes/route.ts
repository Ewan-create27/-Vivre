import { dbQuery } from "@/lib/db";
import { COLORS, STATUSES, badRequest, cleanDate, cleanText, getSession, getOwnedWish, listWishesForOwner, newId, now, serverError, unauthorized, validChoice } from "@/lib/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    return Response.json({ wishes: await listWishesForOwner(session.user.id) });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await request.json() as Record<string, unknown>;
    const title = cleanText(body.title, 100);
    if (!title) return badRequest("Donne un titre à ce rêve.");
    const progress = Math.max(0, Math.min(100, Math.round(Number(body.progress) || 0)));
    const completedAt = cleanDate(body.completedAt);
    if (progress === 100 && !completedAt) return badRequest("Indique la date à laquelle ce rêve a été réalisé.");
    const order = await dbQuery<{ lowest: number | string | null }>("SELECT MIN(sort_order) AS lowest FROM wishes WHERE owner_id = $1", [session.user.id]);
    const lowest = Number(order.rows[0]?.lowest ?? 0);
    const id = newId();
    const timestamp = now();
    await dbQuery(
      `INSERT INTO wishes (id, owner_id, title, description, category, color, status, progress, next_step, target_date, completed_at, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
      [
        id,
        session.user.id,
        title,
        cleanText(body.description, 1500),
        cleanText(body.category, 50) || "À vivre",
        validChoice(cleanText(body.color, 20), COLORS, "terracotta"),
        progress === 100 ? "done" : validChoice(cleanText(body.status, 20), STATUSES, "dreaming"),
        progress,
        cleanText(body.nextStep, 500),
        cleanText(body.targetDate, 20) || null,
        progress === 100 ? completedAt : null,
        Number.isFinite(lowest) ? lowest - 1 : -1,
        timestamp,
      ],
    );
    const wish = await getOwnedWish(id, session.user.id);
    return Response.json({ wish }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
